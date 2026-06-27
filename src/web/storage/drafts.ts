import { loadJson, saveJson, StorageKeys } from "./localStore";

type DraftMap = Record<string, string>;

function loadAll(): DraftMap {
  return loadJson<DraftMap>(StorageKeys.Drafts, {});
}

export function getDraft(threadId: string): string {
  return loadAll()[threadId] ?? "";
}

export function setDraft(threadId: string, text: string): void {
  const all = loadAll();
  if (text.length === 0) {
    delete all[threadId];
  } else {
    all[threadId] = text;
  }
  saveJson(StorageKeys.Drafts, all);
}

export function clearDraft(threadId: string): void {
  setDraft(threadId, "");
}
