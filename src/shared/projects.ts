export const PROJECT_CATALOG_SCHEMA_VERSION = 1;

export type ProjectStorage = "client" | "server";

export type ProjectRecord = {
  id: string;
  name: string;
  path: string;
  addedAt: number;
  lastUsedAt: number;
  storage: ProjectStorage;
};

export type ServerProjectRecord = ProjectRecord & {
  storage: "server";
};

export type ProjectCatalog = {
  revision: number;
  defaultStorage: ProjectStorage;
  projects: ServerProjectRecord[];
};

export type ProjectCatalogFile = ProjectCatalog & {
  schemaVersion: typeof PROJECT_CATALOG_SCHEMA_VERSION;
};

export type ProjectCreateInput = {
  id?: string;
  name: string;
  path: string;
  addedAt?: number;
  lastUsedAt?: number;
};

export type ProjectCatalogErrorCode =
  | "PROJECT_CATALOG_REVISION_CONFLICT"
  | "PROJECT_PATH_CONFLICT"
  | "PROJECT_ID_CONFLICT"
  | "PROJECT_NOT_FOUND"
  | "PROJECT_CATALOG_LOCK_TIMEOUT"
  | "PROJECT_CATALOG_VALIDATION_FAILED"
  | "PROJECT_CATALOG_STORAGE_ERROR";

export function normalizeProjectPathKey(value: string): string {
  const normalized = value.trim().replace(/\\/g, "/").replace(/\/+$/, "");
  return /^[a-zA-Z]:\//.test(normalized) ? normalized.toLowerCase() : normalized;
}
