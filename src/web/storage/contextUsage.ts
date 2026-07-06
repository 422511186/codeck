import { loadJson, saveJson, StorageKeys } from "./localStore";

export type ContextUsageSnapshot = {
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  reasoningOutputTokens: number;
  modelContextWindow: number | null;
  updatedAt: number;
};

type ContextUsageMap = Record<string, unknown>;

function loadAll(): ContextUsageMap {
  return loadJson<ContextUsageMap>(StorageKeys.ContextUsage, {});
}

export function getContextUsage(threadId: string): ContextUsageSnapshot | null {
  return validSnapshot(loadAll()[threadId]);
}

export function setContextUsage(threadId: string, snapshot: ContextUsageSnapshot): void {
  const all = loadAll();
  all[threadId] = snapshot;
  saveJson(StorageKeys.ContextUsage, all);
}

export function clearContextUsage(threadId: string): void {
  const all = loadAll();
  delete all[threadId];
  saveJson(StorageKeys.ContextUsage, all);
}

function validSnapshot(value: unknown): ContextUsageSnapshot | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const candidate = value as Partial<ContextUsageSnapshot>;
  if (
    !isFiniteNumber(candidate.totalTokens) ||
    !isFiniteNumber(candidate.inputTokens) ||
    !isFiniteNumber(candidate.outputTokens) ||
    !isFiniteNumber(candidate.reasoningOutputTokens) ||
    !isFiniteNumber(candidate.updatedAt)
  ) {
    return null;
  }
  if (candidate.modelContextWindow !== null && !isFiniteNumber(candidate.modelContextWindow)) {
    return null;
  }
  return {
    totalTokens: candidate.totalTokens,
    inputTokens: candidate.inputTokens,
    outputTokens: candidate.outputTokens,
    reasoningOutputTokens: candidate.reasoningOutputTokens,
    modelContextWindow: candidate.modelContextWindow,
    updatedAt: candidate.updatedAt
  };
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
