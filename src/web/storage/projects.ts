import { loadJson, saveJson, StorageKeys } from "./localStore";

export type Project = {
  id: string;
  name: string;
  path: string;
  addedAt: number;
  lastUsedAt: number;
};

function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function deriveDefaultName(path: string): string {
  const cleaned = path.replace(/[\\/]+$/, "");
  const parts = cleaned.split(/[\\/]/);
  return parts[parts.length - 1] || cleaned;
}

function loadAll(): Project[] {
  return loadJson<Project[]>(StorageKeys.Projects, []);
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
  const normalized = normalizePath(path);
  return loadAll().find((p) => normalizePath(p.path) === normalized);
}

function normalizePath(path: string): string {
  return path.replace(/[\\/]+$/, "").toLowerCase();
}

export function addProject(path: string, name?: string): Project {
  const trimmed = path.trim();
  if (!trimmed) {
    throw new Error("项目路径不能为空");
  }
  const all = loadAll();
  const existing = all.find((p) => normalizePath(p.path) === normalizePath(trimmed));
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
    lastUsedAt: Date.now()
  };
  saveAll([project, ...all]);
  return project;
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
