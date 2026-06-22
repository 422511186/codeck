import { randomBytes } from "node:crypto";
import { resolve } from "node:path";

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
      mode: "external";
      url: string;
    }
  | {
      mode: "mock";
    }
  | {
      mode: "off";
    };

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

  if (explicitMode === "mock") {
    return { mode: "mock" };
  }

  if (explicitMode === "off") {
    return { mode: "off" };
  }

  if (explicitMode === "external" || url) {
    if (!url) {
      throw new Error("CODEX_WEB_APP_SERVER_MODE=external 时必须配置 CODEX_WEB_APP_SERVER_URL");
    }

    return { mode: "external", url };
  }

  return {
    mode: "spawn",
    codexBin: env.CODEX_WEB_CODEX_BIN?.trim() || "codex",
    host: env.CODEX_WEB_APP_SERVER_HOST?.trim() || "127.0.0.1",
    port: parseOptionalPort(env.CODEX_WEB_APP_SERVER_PORT)
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
    uploadDir: env.CODEX_WEB_UPLOAD_DIR?.trim() || resolve("uploads"),
    auditLogPath: env.CODEX_WEB_AUDIT_LOG_PATH?.trim() || resolve("logs", "audit.jsonl"),
    appServer: parseAppServerConfig(env)
  };
}
