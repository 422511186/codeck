import { randomBytes } from "node:crypto";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import nextEnv from "@next/env";

export type RuntimeConfig = {
  accessToken: string;
  generatedAccessToken: boolean;
  workspaceRoots: string[];
  bindHost: string;
  bindPort: number;
  uploadDir: string;
  auditLogPath: string;
  appServer: AppServerConfig;
};

export type RuntimeEnv = Partial<Record<string, string>>;

export type AppServerConfig =
  | {
      mode: "spawn";
      codexBin: string;
      host: string;
      port: number | null;
    }
  | {
      mode: "spawn-or-connect";
      codexBin: string;
      host: string;
      port: number | null;
      stateDir: string;
    }
  | {
      mode: "external";
      url: string;
    }
  | {
      mode: "mock";
    }
  | {
      mode: "off";
    };

export function loadRuntimeEnvConfig(projectDir = process.cwd(), dev = process.env.NODE_ENV !== "production"): void {
  nextEnv.loadEnvConfig(projectDir, dev, console, true);
}

function generateAccessToken(): string {
  return `sk-${randomBytes(32).toString("base64url")}`;
}

function parseWorkspaceRoots(value: string | undefined): string[] {
  if (!value) {
    return [process.cwd()];
  }

  return value
    .split(";")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function parsePort(value: string | undefined): number {
  if (!value) {
    return 3000;
  }

  const port = Number(value);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`CODEX_WEB_BIND_PORT 无效: ${value}`);
  }

  return port;
}

function parseOptionalPort(value: string | undefined): number | null {
  if (!value) {
    return null;
  }

  return parsePort(value);
}

function parseAppServerConfig(env: RuntimeEnv): AppServerConfig {
  const explicitMode = env.CODEX_WEB_APP_SERVER_MODE?.trim();
  const url = env.CODEX_WEB_APP_SERVER_URL?.trim();
  const spawnConfig = {
    codexBin: env.CODEX_WEB_CODEX_BIN?.trim() || "codex",
    host: env.CODEX_WEB_APP_SERVER_HOST?.trim() || "127.0.0.1",
    port: parseOptionalPort(env.CODEX_WEB_APP_SERVER_PORT)
  };

  if (explicitMode === "mock") {
    return { mode: "mock" };
  }

  if (explicitMode === "off") {
    return { mode: "off" };
  }

  if (explicitMode === "external") {
    if (!url) {
      throw new Error("CODEX_WEB_APP_SERVER_MODE=external 时必须配置 CODEX_WEB_APP_SERVER_URL");
    }

    return { mode: "external", url };
  }

  if (!explicitMode && url) {
    return { mode: "external", url };
  }

  if (explicitMode === "spawn-or-connect") {
    return {
      mode: "spawn-or-connect",
      ...spawnConfig,
      stateDir: env.CODEX_WEB_APP_SERVER_STATE_DIR?.trim() || resolve(tmpdir(), "codex-web-app-server")
    };
  }

  if (explicitMode && explicitMode !== "spawn") {
    throw new Error(
      `CODEX_WEB_APP_SERVER_MODE 无效: ${explicitMode}，可选值为 spawn、spawn-or-connect、external、mock、off`
    );
  }

  return {
    mode: "spawn",
    ...spawnConfig
  };
}

export function createRuntimeConfig(env: RuntimeEnv = process.env): RuntimeConfig {
  const configuredToken = env.CODEX_WEB_ACCESS_TOKEN?.trim();
  const generatedAccessToken = !configuredToken;

  return {
    accessToken: configuredToken || generateAccessToken(),
    generatedAccessToken,
    workspaceRoots: parseWorkspaceRoots(env.CODEX_WEB_WORKSPACE_ROOTS),
    bindHost: env.CODEX_WEB_BIND_HOST || "127.0.0.1",
    bindPort: parsePort(env.CODEX_WEB_BIND_PORT),
    uploadDir: env.CODEX_WEB_UPLOAD_DIR?.trim() || resolve(/*turbopackIgnore: true*/ "uploads"),
    auditLogPath: env.CODEX_WEB_AUDIT_LOG_PATH?.trim() || resolve(/*turbopackIgnore: true*/ "logs", "audit.jsonl"),
    appServer: parseAppServerConfig(env)
  };
}
