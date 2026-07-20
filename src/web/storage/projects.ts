import { loadJson, saveJson, StorageKeys } from "./localStore";
import { normalizeProjectPathKey, type ProjectRecord } from "../../shared/projects";

export type Project = ProjectRecord;

function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function deriveDefaultName(path: string): string {
  const cleaned = path.replace(/[\\/]+$/, "");
  const parts = cleaned.split(/[\\/]/);
  return parts[parts.length - 1] || cleaned;
}

function loadAll(): Project[] {
  const value = loadJson<unknown>(StorageKeys.Projects, []);
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) return [];
    const record = entry as Partial<Project>;
    if (
      typeof record.id !== "string" ||
      typeof record.name !== "string" ||
      typeof record.path !== "string" ||
      typeof record.addedAt !== "number" ||
      typeof record.lastUsedAt !== "number"
    ) {
      return [];
    }
    return [{
      id: record.id,
      name: record.name,
      path: record.path,
      addedAt: record.addedAt,
      lastUsedAt: record.lastUsedAt,
      storage: "client" as const
    }];
  });
}

function saveAll(projects: Project[]): void {
  saveJson(StorageKeys.Projects, projects);
}

export function listProjects(): Project[] {
  return loadAll().sort((a, b) => b.lastUsedAt - a.lastUsedAt);
}

export function getProject(id: string): Project | undefined {
  return loadAll().find((p) => p.id === id);
}

export function getProjectByPath(path: string): Project | undefined {
  const normalized = normalizeProjectPathKey(path);
  return loadAll().find((p) => normalizeProjectPathKey(p.path) === normalized);
}

export function addProject(path: string, name?: string): Project {
  const trimmed = path.trim();
  if (!trimmed) {
    throw new Error("项目路径不能为空");
  }
  const all = loadAll();
  const existing = all.find((p) => normalizeProjectPathKey(p.path) === normalizeProjectPathKey(trimmed));
  if (existing) {
    existing.lastUsedAt = Date.now();
    saveAll(all);
    return existing;
  }
  const project: Project = {
    id: generateId(),
    name: name?.trim() || deriveDefaultName(trimmed),
    path: trimmed,
    addedAt: Date.now(),
    lastUsedAt: Date.now(),
    storage: "client"
  };
  saveAll([project, ...all]);
  return project;
}

export function saveLocalProject(project: Omit<Project, "storage"> | Project): Project {
  const next: Project = { ...project, storage: "client" };
  const all = loadAll();
  const pathKey = normalizeProjectPathKey(next.path);
  const conflict = all.find((entry) => entry.id !== next.id && normalizeProjectPathKey(entry.path) === pathKey);
  if (conflict) {
    throw new Error("该工作区路径已存在当前设备项目");
  }
  const index = all.findIndex((entry) => entry.id === next.id);
  if (index >= 0) {
    all[index] = next;
    saveAll(all);
  } else {
    saveAll([next, ...all]);
  }
  return next;
}

export function renameProject(id: string, name: string): void {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("项目名称不能为空");
  const all = loadAll();
  const target = all.find((p) => p.id === id);
  if (!target) return;
  target.name = trimmed;
  saveAll(all);
}

export function removeProject(id: string): void {
  saveAll(loadAll().filter((p) => p.id !== id));
}

export function touchProjectLastUsed(id: string): void {
  const all = loadAll();
  const target = all.find((p) => p.id === id);
  if (!target) return;
  target.lastUsedAt = Date.now();
  saveAll(all);
}

export const touchProject = touchProjectLastUsed;
