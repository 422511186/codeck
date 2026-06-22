import { randomBytes } from "node:crypto";

export type RuntimeConfig = {
  accessToken: string;
  generatedAccessToken: boolean;
  workspaceRoots: string[];
  bindHost: string;
  bindPort: number;
};

export type RuntimeEnv = Partial<Record<string, string>>;

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

export function createRuntimeConfig(env: RuntimeEnv = process.env): RuntimeConfig {
  const configuredToken = env.CODEX_WEB_ACCESS_TOKEN?.trim();
  const generatedAccessToken = !configuredToken;

  return {
    accessToken: configuredToken || generateAccessToken(),
    generatedAccessToken,
    workspaceRoots: parseWorkspaceRoots(env.CODEX_WEB_WORKSPACE_ROOTS),
    bindHost: env.CODEX_WEB_BIND_HOST || "127.0.0.1",
    bindPort: parsePort(env.CODEX_WEB_BIND_PORT)
  };
}
