import { createRuntimeConfig, type RuntimeConfig } from "../config/env";

const globalForRuntime = globalThis as typeof globalThis & {
  __codexWebRuntimeConfig?: RuntimeConfig;
};

export function getRuntimeConfig(): RuntimeConfig {
  if (!globalForRuntime.__codexWebRuntimeConfig) {
    globalForRuntime.__codexWebRuntimeConfig = createRuntimeConfig();
  }

  return globalForRuntime.__codexWebRuntimeConfig;
}
