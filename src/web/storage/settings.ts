import { loadJson, saveJson, StorageKeys } from "./localStore";
import type { ChatMode } from "../api/types";
import type { ModelSelection, SelectableModel } from "../../shared/custom-models";

export type ThemeMode = "system" | "light" | "dark";

export type WebSettings = {
  defaultModel: ModelSelection | null;
  defaultMode: ChatMode;
  theme: ThemeMode;
};

type PersistedWebSettings = WebSettings & {
  schemaVersion: 1;
};

const DEFAULT_SETTINGS: WebSettings = {
  defaultModel: null,
  defaultMode: "build",
  theme: "system"
};

let cache: WebSettings = DEFAULT_SETTINGS;
let loaded = false;

export function loadWebSettings(): WebSettings {
  const value = loadJson<unknown>(StorageKeys.Settings, null);
  if (!isRecord(value) || value.schemaVersion !== 1) {
    return legacySettingsWithoutUnverifiedModel(value);
  }
  return {
    defaultModel: readModelSelection(value.defaultModel),
    defaultMode: value.defaultMode === "plan" ? "plan" : "build",
    theme: readTheme(value.theme)
  };
}

export function saveWebSettings(settings: WebSettings): void {
  cache = settings;
  saveJson<PersistedWebSettings>(StorageKeys.Settings, { schemaVersion: 1, ...settings });
}

export function updateWebSettings(patch: Partial<WebSettings>): WebSettings {
  const next = { ...loadWebSettings(), ...patch };
  saveWebSettings(next);
  return next;
}

export function migrateLegacyDefaultModel(
  _models: SelectableModel[],
  appServerModelNames: string[]
): WebSettings {
  const persisted = loadJson<unknown>(StorageKeys.Settings, null);
  if (isRecord(persisted) && persisted.schemaVersion === 1) {
    const current = loadWebSettings();
    cache = current;
    loaded = true;
    return current;
  }
  const legacyModel = isRecord(persisted) && typeof persisted.defaultModel === "string"
    ? persisted.defaultModel
    : null;
  const next: WebSettings = {
    ...legacySettingsWithoutUnverifiedModel(persisted),
    defaultModel: legacyModel !== null && appServerModelNames.includes(legacyModel)
      ? { source: "app-server", model: legacyModel }
      : null
  };
  saveWebSettings(next);
  loaded = true;
  return next;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readModelSelection(value: unknown): ModelSelection | null {
  if (!isRecord(value)) {
    return null;
  }
  if (value.source === "custom" && typeof value.customModelId === "string" && value.customModelId) {
    return { source: "custom", customModelId: value.customModelId };
  }
  if (value.source === "app-server" && typeof value.model === "string" && value.model) {
    return { source: "app-server", model: value.model };
  }
  return null;
}

function readTheme(value: unknown): ThemeMode {
  return value === "light" || value === "dark" ? value : "system";
}

function legacySettingsWithoutUnverifiedModel(value: unknown): WebSettings {
  return {
    defaultModel: null,
    defaultMode: isRecord(value) && value.defaultMode === "plan" ? "plan" : "build",
    theme: isRecord(value) ? readTheme(value.theme) : "system"
  };
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
