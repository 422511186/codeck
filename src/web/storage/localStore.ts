const NAMESPACE = "codex-web";

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function namespacedKey(key: string): string {
  return `${NAMESPACE}:${key}`;
}

export function loadJson<T>(key: string, fallback: T): T {
  if (!isBrowser()) return fallback;
  try {
    const raw = window.localStorage.getItem(namespacedKey(key));
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function saveJson<T>(key: string, value: T): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(namespacedKey(key), JSON.stringify(value));
  } catch {
    // ignore quota / private mode errors
  }
}

export function removeKey(key: string): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(namespacedKey(key));
  } catch {
    // ignore
  }
}

export const StorageKeys = {
  Projects: "projects",
  Settings: "settings",
  Drafts: "drafts",
  ChatDraftPrefix: "draft:", // 完整 key = `draft:${threadId}`
  ThreadModePrefix: "thread-mode:" // 完整 key = `thread-mode:${threadId}`
} as const;

export function draftKey(threadId: string): string {
  return `${StorageKeys.ChatDraftPrefix}${threadId}`;
}

export function threadModeKey(threadId: string): string {
  return `${StorageKeys.ThreadModePrefix}${threadId}`;
}
