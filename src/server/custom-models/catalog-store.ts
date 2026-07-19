import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  CUSTOM_MODEL_CATALOG_SCHEMA_VERSION,
  MAX_CUSTOM_MODELS,
  type CustomModelCatalog,
  type CustomModelCatalogFile,
  type CustomModelConfig,
  type CustomModelErrorCode,
  type CustomModelInput
} from "../../shared/custom-models";
import { atomicWriteJson } from "../persistence/atomic-json-file";
import {
  FileLockTimeoutError,
  withFileLock,
  type FileLockOptions
} from "../persistence/file-lock";
import {
  CustomModelValidationError,
  assertUniqueCustomModel,
  normalizeCustomModelInput
} from "./validation";

type AtomicWrite = (filePath: string, value: unknown) => Promise<void>;

type CustomModelCatalogStoreOptions = {
  dataDir: string;
  now?: () => Date;
  generateId?: () => string;
  lockOptions?: FileLockOptions;
  atomicWrite?: AtomicWrite;
};

export class CustomModelStoreError extends Error {
  constructor(
    readonly code: CustomModelErrorCode,
    message: string,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = "CustomModelStoreError";
  }
}

export class CatalogRevisionConflictError extends CustomModelStoreError {
  constructor(readonly latestCatalog: CustomModelCatalog) {
    super("CATALOG_REVISION_CONFLICT", "自定义模型目录已被其他客户端修改");
    this.name = "CatalogRevisionConflictError";
  }
}

function isNodeError(error: unknown, code: string): boolean {
  return error instanceof Error && "code" in error && error.code === code;
}

function cloneCatalog(file: CustomModelCatalogFile): CustomModelCatalog {
  return structuredClone({ revision: file.revision, models: file.models });
}

function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string") {
    return false;
  }
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value;
}

function validatePersistedModel(value: unknown): CustomModelConfig {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("models 条目必须是对象");
  }
  const record = value as Record<string, unknown>;
  const allowed = new Set([
    "customModelId",
    "model",
    "label",
    "contextWindow",
    "inputModalities",
    "supportedReasoningEfforts",
    "defaultReasoningEffort",
    "createdAt",
    "updatedAt"
  ]);
  if (Object.keys(record).some((key) => !allowed.has(key))) {
    throw new Error("models 条目包含未知字段");
  }
  if (typeof record.customModelId !== "string" || record.customModelId.trim().length === 0) {
    throw new Error("customModelId 无效");
  }
  if (!isIsoDate(record.createdAt) || !isIsoDate(record.updatedAt)) {
    throw new Error("模型时间戳无效");
  }
  const mutableInput = {
    model: record.model,
    label: record.label,
    contextWindow: record.contextWindow,
    inputModalities: record.inputModalities,
    supportedReasoningEfforts: record.supportedReasoningEfforts,
    defaultReasoningEffort: record.defaultReasoningEffort
  };
  const normalized = normalizeCustomModelInput(mutableInput, { requireComplete: true });
  for (const key of Object.keys(normalized) as Array<keyof CustomModelInput>) {
    if (JSON.stringify(normalized[key]) !== JSON.stringify(record[key])) {
      throw new Error(`模型字段未规范化: ${key}`);
    }
  }
  return {
    ...normalized,
    customModelId: record.customModelId,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
  };
}

function validateCatalogFile(value: unknown): CustomModelCatalogFile {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("目录必须是对象");
  }
  const record = value as Record<string, unknown>;
  if (
    Object.keys(record).some((key) => !["schemaVersion", "revision", "models"].includes(key)) ||
    record.schemaVersion !== CUSTOM_MODEL_CATALOG_SCHEMA_VERSION ||
    !Number.isSafeInteger(record.revision) ||
    (record.revision as number) < 0 ||
    !Array.isArray(record.models) ||
    record.models.length > MAX_CUSTOM_MODELS
  ) {
    throw new Error("目录 schema 或 revision 无效");
  }
  const models = record.models.map(validatePersistedModel);
  const ids = new Set<string>();
  const modelNames = new Set<string>();
  for (const model of models) {
    if (ids.has(model.customModelId) || modelNames.has(model.model)) {
      throw new Error("目录包含重复身份或模型标识");
    }
    ids.add(model.customModelId);
    modelNames.add(model.model);
  }
  return {
    schemaVersion: CUSTOM_MODEL_CATALOG_SCHEMA_VERSION,
    revision: record.revision as number,
    models
  };
}

export class CustomModelCatalogStore {
  readonly filePath: string;
  readonly lockPath: string;
  private readonly now: () => Date;
  private readonly generateId: () => string;
  private readonly lockOptions: FileLockOptions;
  private readonly atomicWrite: AtomicWrite;

  constructor(options: CustomModelCatalogStoreOptions) {
    this.filePath = join(options.dataDir, "custom-models.json");
    this.lockPath = `${this.filePath}.lock`;
    this.now = options.now ?? (() => new Date());
    this.generateId = options.generateId ?? randomUUID;
    this.lockOptions = options.lockOptions ?? {};
    this.atomicWrite = options.atomicWrite ?? atomicWriteJson;
  }

  async read(): Promise<CustomModelCatalog> {
    try {
      return cloneCatalog(await this.readFile());
    } catch (error) {
      if (!isNodeError(error, "ENOENT")) {
        throw this.asStoreError(error);
      }
    }

    return this.withLock(async () => cloneCatalog(await this.readOrInitialize()));
  }

  async create(input: CustomModelInput, expectedRevision: number): Promise<CustomModelCatalog> {
    return this.mutate(expectedRevision, async (current) => {
      if (current.models.length >= MAX_CUSTOM_MODELS) {
        throw new CustomModelStoreError("CUSTOM_MODEL_LIMIT_REACHED", "自定义模型目录已达到 200 条上限");
      }
      const normalized = normalizeCustomModelInput(input, { requireComplete: true });
      assertUniqueCustomModel(current.models, normalized.model);
      const timestamp = this.now().toISOString();
      current.models.push({
        ...normalized,
        customModelId: this.generateId(),
        createdAt: timestamp,
        updatedAt: timestamp
      });
    });
  }

  async replace(
    customModelId: string,
    input: CustomModelInput,
    expectedRevision: number
  ): Promise<CustomModelCatalog> {
    return this.mutate(expectedRevision, async (current) => {
      const index = current.models.findIndex((model) => model.customModelId === customModelId);
      if (index < 0) {
        throw new CustomModelStoreError("CUSTOM_MODEL_NOT_FOUND", "自定义模型不存在");
      }
      const normalized = normalizeCustomModelInput(input, { requireComplete: true });
      assertUniqueCustomModel(current.models, normalized.model, customModelId);
      const existing = current.models[index];
      current.models[index] = {
        ...normalized,
        customModelId,
        createdAt: existing.createdAt,
        updatedAt: this.now().toISOString()
      };
    });
  }

  async delete(customModelId: string, expectedRevision: number): Promise<CustomModelCatalog> {
    return this.mutate(expectedRevision, async (current) => {
      const index = current.models.findIndex((model) => model.customModelId === customModelId);
      if (index < 0) {
        throw new CustomModelStoreError("CUSTOM_MODEL_NOT_FOUND", "自定义模型不存在");
      }
      current.models.splice(index, 1);
    });
  }

  private async mutate(
    expectedRevision: number,
    update: (current: CustomModelCatalogFile) => Promise<void>
  ): Promise<CustomModelCatalog> {
    if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) {
      throw new CustomModelStoreError("CUSTOM_MODEL_VALIDATION_FAILED", "expectedRevision 必须是非负安全整数");
    }
    return this.withLock(async () => {
      const current = await this.readOrInitialize();
      if (current.revision !== expectedRevision) {
        throw new CatalogRevisionConflictError(cloneCatalog(current));
      }
      try {
        await update(current);
      } catch (error) {
        if (error instanceof CustomModelValidationError) {
          throw new CustomModelStoreError(error.code, error.message, { cause: error });
        }
        throw error;
      }
      current.revision += 1;
      try {
        await this.atomicWrite(this.filePath, current);
      } catch (error) {
        throw new CustomModelStoreError("CUSTOM_MODEL_STORAGE_ERROR", "写入自定义模型目录失败", {
          cause: error
        });
      }
      return cloneCatalog(current);
    });
  }

  private async readOrInitialize(): Promise<CustomModelCatalogFile> {
    try {
      return await this.readFile();
    } catch (error) {
      if (!isNodeError(error, "ENOENT")) {
        throw this.asStoreError(error);
      }
    }
    const empty: CustomModelCatalogFile = {
      schemaVersion: CUSTOM_MODEL_CATALOG_SCHEMA_VERSION,
      revision: 0,
      models: []
    };
    try {
      await this.atomicWrite(this.filePath, empty);
    } catch (error) {
      throw new CustomModelStoreError("CUSTOM_MODEL_STORAGE_ERROR", "初始化自定义模型目录失败", {
        cause: error
      });
    }
    return empty;
  }

  private async readFile(): Promise<CustomModelCatalogFile> {
    const contents = await readFile(this.filePath, "utf8");
    return validateCatalogFile(JSON.parse(contents) as unknown);
  }

  private async withLock<T>(callback: () => Promise<T>): Promise<T> {
    try {
      return await withFileLock(this.lockPath, callback, this.lockOptions);
    } catch (error) {
      if (error instanceof FileLockTimeoutError) {
        throw new CustomModelStoreError("CUSTOM_MODEL_LOCK_TIMEOUT", error.message, { cause: error });
      }
      throw this.asStoreError(error);
    }
  }

  private asStoreError(error: unknown): CustomModelStoreError {
    if (error instanceof CustomModelStoreError) {
      return error;
    }
    return new CustomModelStoreError("CUSTOM_MODEL_STORAGE_ERROR", "读取自定义模型目录失败", {
      cause: error
    });
  }
}
