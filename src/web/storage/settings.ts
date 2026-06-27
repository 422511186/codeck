import { loadJson, saveJson, StorageKeys } from "./localStore";
import type { ChatMode } from "../api/types";

export type WebSettings = {
  defaultModel: string | null;
  defaultMode: ChatMode;
};

const DEFAULT_SETTINGS: WebSettings = {
  defaultModel: null,
  defaultMode: "build"
};

let cache: WebSettings = DEFAULT_SETTINGS;
let loaded = false;

export function loadWebSettings(): WebSettings {
  return loadJson<WebSettings>(StorageKeys.Settings, DEFAULT_SETTINGS);
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
