import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  PROJECT_CATALOG_SCHEMA_VERSION,
  normalizeProjectPathKey,
  type ProjectCatalog,
  type ProjectCatalogErrorCode,
  type ProjectCatalogFile,
  type ProjectCreateInput,
  type ProjectStorage,
  type ServerProjectRecord
} from "../../shared/projects";
import { atomicWriteJson } from "../persistence/atomic-json-file";
import { FileLockTimeoutError, withFileLock, type FileLockOptions } from "../persistence/file-lock";

const MAX_PROJECTS = 2_000;
const MAX_NAME_LENGTH = 256;
const MAX_PATH_LENGTH = 4_096;

type AtomicWrite = (filePath: string, value: unknown) => Promise<void>;

type ProjectCatalogStoreOptions = {
  dataDir: string;
  now?: () => number;
  generateId?: () => string;
  lockOptions?: FileLockOptions;
  atomicWrite?: AtomicWrite;
};

export class ProjectCatalogStoreError extends Error {
  constructor(
    readonly code: ProjectCatalogErrorCode,
    message: string,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = "ProjectCatalogStoreError";
  }
}

export class ProjectCatalogRevisionConflictError extends ProjectCatalogStoreError {
  constructor(readonly latestCatalog: ProjectCatalog) {
    super("PROJECT_CATALOG_REVISION_CONFLICT", "项目目录已被其他设备修改");
    this.name = "ProjectCatalogRevisionConflictError";
  }
}

export class ProjectPathConflictError extends ProjectCatalogStoreError {
  constructor(readonly latestCatalog: ProjectCatalog, readonly conflictingProject: ServerProjectRecord) {
    super("PROJECT_PATH_CONFLICT", "该工作区路径已存在服务端项目");
    this.name = "ProjectPathConflictError";
  }
}

function isNodeError(error: unknown, code: string): boolean {
  return error instanceof Error && "code" in error && error.code === code;
}

function cloneCatalog(file: ProjectCatalogFile): ProjectCatalog {
  return structuredClone({
    revision: file.revision,
    defaultStorage: file.defaultStorage,
    projects: file.projects
  });
}

function validTimestamp(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function normalizeName(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new ProjectCatalogStoreError("PROJECT_CATALOG_VALIDATION_FAILED", "项目名称不能为空");
  }
  const name = value.trim();
  if (name.length > MAX_NAME_LENGTH) {
    throw new ProjectCatalogStoreError("PROJECT_CATALOG_VALIDATION_FAILED", "项目名称过长");
  }
  return name;
}

function normalizePath(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new ProjectCatalogStoreError("PROJECT_CATALOG_VALIDATION_FAILED", "项目路径不能为空");
  }
  const path = value.trim();
  if (path.length > MAX_PATH_LENGTH) {
    throw new ProjectCatalogStoreError("PROJECT_CATALOG_VALIDATION_FAILED", "项目路径过长");
  }
  return path;
}

function normalizeId(value: unknown, generateId: () => string): string {
  const id = value === undefined ? generateId() : value;
  if (typeof id !== "string" || !/^[a-zA-Z0-9._-]{1,128}$/.test(id)) {
    throw new ProjectCatalogStoreError("PROJECT_CATALOG_VALIDATION_FAILED", "项目 ID 无效");
  }
  return id;
}

function validateProject(value: unknown): ServerProjectRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("projects 条目必须是对象");
  }
  const record = value as Record<string, unknown>;
  const allowed = new Set(["id", "name", "path", "addedAt", "lastUsedAt", "storage"]);
  if (Object.keys(record).some((key) => !allowed.has(key)) || record.storage !== "server") {
    throw new Error("projects 条目包含未知字段或存储位置无效");
  }
  if (!validTimestamp(record.addedAt) || !validTimestamp(record.lastUsedAt)) {
    throw new Error("项目时间戳无效");
  }
  return {
    id: normalizeId(record.id, randomUUID),
    name: normalizeName(record.name),
    path: normalizePath(record.path),
    addedAt: record.addedAt,
    lastUsedAt: record.lastUsedAt,
    storage: "server"
  };
}

function validateCatalogFile(value: unknown): ProjectCatalogFile {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("项目目录必须是对象");
  }
  const record = value as Record<string, unknown>;
  if (
    Object.keys(record).some((key) => !["schemaVersion", "revision", "defaultStorage", "projects"].includes(key)) ||
    record.schemaVersion !== PROJECT_CATALOG_SCHEMA_VERSION ||
    !Number.isSafeInteger(record.revision) ||
    (record.revision as number) < 0 ||
    (record.defaultStorage !== "client" && record.defaultStorage !== "server") ||
    !Array.isArray(record.projects) ||
    record.projects.length > MAX_PROJECTS
  ) {
    throw new Error("项目目录 schema 或 revision 无效");
  }
  const projects = record.projects.map(validateProject);
  const ids = new Set<string>();
  const paths = new Set<string>();
  for (const project of projects) {
    const pathKey = normalizeProjectPathKey(project.path);
    if (ids.has(project.id) || paths.has(pathKey)) {
      throw new Error("项目目录包含重复 ID 或路径");
    }
    ids.add(project.id);
    paths.add(pathKey);
  }
  return {
    schemaVersion: PROJECT_CATALOG_SCHEMA_VERSION,
    revision: record.revision as number,
    defaultStorage: record.defaultStorage,
    projects
  };
}

export class ProjectCatalogStore {
  readonly filePath: string;
  readonly lockPath: string;
  private readonly now: () => number;
  private readonly generateId: () => string;
  private readonly lockOptions: FileLockOptions;
  private readonly atomicWrite: AtomicWrite;

  constructor(options: ProjectCatalogStoreOptions) {
    this.filePath = join(options.dataDir, "projects.json");
    this.lockPath = `${this.filePath}.lock`;
    this.now = options.now ?? Date.now;
    this.generateId = options.generateId ?? randomUUID;
    this.lockOptions = options.lockOptions ?? {};
    this.atomicWrite = options.atomicWrite ?? atomicWriteJson;
  }

  async read(): Promise<ProjectCatalog> {
    try {
      return cloneCatalog(await this.readFile());
    } catch (error) {
      if (!isNodeError(error, "ENOENT")) {
        throw this.asStoreError(error);
      }
    }
    return this.withLock(async () => cloneCatalog(await this.readOrInitialize()));
  }

  async create(input: ProjectCreateInput, expectedRevision: number): Promise<ProjectCatalog> {
    return this.mutate(expectedRevision, async (current) => {
      if (current.projects.length >= MAX_PROJECTS) {
        throw new ProjectCatalogStoreError("PROJECT_CATALOG_VALIDATION_FAILED", "项目目录已达到数量上限");
      }
      const timestamp = this.now();
      const project: ServerProjectRecord = {
        id: normalizeId(input.id, this.generateId),
        name: normalizeName(input.name),
        path: normalizePath(input.path),
        addedAt: input.addedAt === undefined ? timestamp : input.addedAt,
        lastUsedAt: input.lastUsedAt === undefined ? timestamp : input.lastUsedAt,
        storage: "server"
      };
      if (!validTimestamp(project.addedAt) || !validTimestamp(project.lastUsedAt)) {
        throw new ProjectCatalogStoreError("PROJECT_CATALOG_VALIDATION_FAILED", "项目时间戳无效");
      }
      if (current.projects.some((entry) => entry.id === project.id)) {
        throw new ProjectCatalogStoreError("PROJECT_ID_CONFLICT", "项目 ID 已存在");
      }
      const pathKey = normalizeProjectPathKey(project.path);
      const pathConflict = current.projects.find((entry) => normalizeProjectPathKey(entry.path) === pathKey);
      if (pathConflict) {
        throw new ProjectPathConflictError(cloneCatalog(current), structuredClone(pathConflict));
      }
      current.projects.push(project);
    });
  }

  async rename(projectId: string, name: string, expectedRevision: number): Promise<ProjectCatalog> {
    return this.mutate(expectedRevision, async (current) => {
      const project = current.projects.find((entry) => entry.id === projectId);
      if (!project) {
        throw new ProjectCatalogStoreError("PROJECT_NOT_FOUND", "项目不存在");
      }
      project.name = normalizeName(name);
    });
  }

  async delete(projectId: string, expectedRevision: number): Promise<ProjectCatalog> {
    return this.mutate(expectedRevision, async (current) => {
      const index = current.projects.findIndex((entry) => entry.id === projectId);
      if (index < 0) {
        throw new ProjectCatalogStoreError("PROJECT_NOT_FOUND", "项目不存在");
      }
      current.projects.splice(index, 1);
    });
  }

  async setDefaultStorage(defaultStorage: ProjectStorage, expectedRevision: number): Promise<ProjectCatalog> {
    if (defaultStorage !== "client" && defaultStorage !== "server") {
      throw new ProjectCatalogStoreError("PROJECT_CATALOG_VALIDATION_FAILED", "默认项目存储位置无效");
    }
    return this.mutate(expectedRevision, async (current) => {
      current.defaultStorage = defaultStorage;
    });
  }

  async touch(projectId: string, lastUsedAt: number): Promise<ProjectCatalog> {
    if (!validTimestamp(lastUsedAt)) {
      throw new ProjectCatalogStoreError("PROJECT_CATALOG_VALIDATION_FAILED", "最近使用时间无效");
    }
    return this.withLock(async () => {
      const current = await this.readOrInitialize();
      const project = current.projects.find((entry) => entry.id === projectId);
      if (!project) {
        throw new ProjectCatalogStoreError("PROJECT_NOT_FOUND", "项目不存在");
      }
      if (lastUsedAt > project.lastUsedAt) {
        project.lastUsedAt = lastUsedAt;
        await this.write(current);
      }
      return cloneCatalog(current);
    });
  }

  private async mutate(
    expectedRevision: number,
    update: (current: ProjectCatalogFile) => Promise<void>
  ): Promise<ProjectCatalog> {
    if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) {
      throw new ProjectCatalogStoreError("PROJECT_CATALOG_VALIDATION_FAILED", "expectedRevision 必须是非负安全整数");
    }
    return this.withLock(async () => {
      const current = await this.readOrInitialize();
      if (current.revision !== expectedRevision) {
        throw new ProjectCatalogRevisionConflictError(cloneCatalog(current));
      }
      await update(current);
      current.revision += 1;
      await this.write(current);
      return cloneCatalog(current);
    });
  }

  private async readOrInitialize(): Promise<ProjectCatalogFile> {
    try {
      return await this.readFile();
    } catch (error) {
      if (!isNodeError(error, "ENOENT")) {
        throw this.asStoreError(error);
      }
    }
    const empty: ProjectCatalogFile = {
      schemaVersion: PROJECT_CATALOG_SCHEMA_VERSION,
      revision: 0,
      defaultStorage: "server",
      projects: []
    };
    await this.write(empty);
    return empty;
  }

  private async readFile(): Promise<ProjectCatalogFile> {
    const contents = await readFile(this.filePath, "utf8");
    try {
      return validateCatalogFile(JSON.parse(contents) as unknown);
    } catch (error) {
      throw new Error("项目目录文件无效", { cause: error });
    }
  }

  private async write(value: ProjectCatalogFile): Promise<void> {
    try {
      await this.atomicWrite(this.filePath, value);
    } catch (error) {
      throw new ProjectCatalogStoreError("PROJECT_CATALOG_STORAGE_ERROR", "写入项目目录失败", { cause: error });
    }
  }

  private async withLock<T>(callback: () => Promise<T>): Promise<T> {
    try {
      return await withFileLock(this.lockPath, callback, this.lockOptions);
    } catch (error) {
      if (error instanceof FileLockTimeoutError) {
        throw new ProjectCatalogStoreError("PROJECT_CATALOG_LOCK_TIMEOUT", error.message, { cause: error });
      }
      throw this.asStoreError(error);
    }
  }

  private asStoreError(error: unknown): ProjectCatalogStoreError {
    if (error instanceof ProjectCatalogStoreError) {
      return error;
    }
    return new ProjectCatalogStoreError("PROJECT_CATALOG_STORAGE_ERROR", "读取项目目录失败", { cause: error });
  }
}
