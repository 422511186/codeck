import { loadJson, saveJson, StorageKeys } from "./localStore";
import type { ChatMode } from "../api/types";

export type ThemeMode = "system" | "light" | "dark";

export type WebSettings = {
  defaultModel: string | null;
  defaultMode: ChatMode;
  theme: ThemeMode;
};

const DEFAULT_SETTINGS: WebSettings = {
  defaultModel: null,
  defaultMode: "build",
  theme: "system"
};

let cache: WebSettings = DEFAULT_SETTINGS;
let loaded = false;

export function loadWebSettings(): WebSettings {
  return { ...DEFAULT_SETTINGS, ...loadJson<Partial<WebSettings>>(StorageKeys.Settings, DEFAULT_SETTINGS) };
}

export function saveWebSettings(settings: WebSettings): void {
  cache = settings;
  saveJson(StorageKeys.Settings, settings);
}

export function updateWebSettings(patch: Partial<WebSettings>): WebSettings {
  const next = { ...loadWebSettings(), ...patch };
  saveWebSettings(next);
  return next;
}

export const settingsStore = {
  load(): WebSettings {
    if (!loaded) {
      cache = loadWebSettings();
      loaded = true;
    }
    return cache;
  },
  get(): WebSettings {
    return cache;
  },
  update(patch: Partial<WebSettings>): WebSettings {
    cache = { ...cache, ...patch };
    saveWebSettings(cache);
    return cache;
  }
};

export function applyTheme(theme: ThemeMode): void {
  if (typeof document === "undefined") return;
  if (theme === "system") {
    delete document.documentElement.dataset.theme;
    return;
  }
  document.documentElement.dataset.theme = theme;
}

export function themeLabel(theme: ThemeMode): string {
  if (theme === "light") return "明亮";
  if (theme === "dark") return "暗黑";
  return "自适应";
}
