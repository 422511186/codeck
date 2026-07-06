import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { access } from "node:fs/promises";
import net from "node:net";
import path from "node:path";

export const CURRENT_SERVICE_PORT = 23000;
export const DEFAULT_SMOKE_PORT = 23001;

export const releaseEntries = [
  ".next",
  "dist/server",
  "public",
  "scripts",
  "package.json",
  "package-lock.json",
  "next.config.mjs",
  ".env.example",
  ".env.docker.example",
  "Dockerfile",
  ".dockerignore",
  "compose.yaml",
  "README.md",
  "docs/release.md",
  "docs/docker-deployment.md"
];

export const excludedReleaseEntries = [
  ".env",
  ".env.*",
  ".next/cache",
  ".next/dev",
  "node_modules",
  "logs",
  "uploads",
  "coverage",
  "test-results",
  "nohup.out"
];

export const releasePruneEntries = [".next/cache", ".next/dev"];

export function releaseName(version) {
  const normalized = String(version || "").trim();
  if (!normalized) {
    throw new Error("package.json version 不能为空");
  }

  return `codex-web-v${normalized}`;
}

export function assertSafeSmokePort(port) {
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`CODEX_WEB_BIND_PORT 无效: ${port}`);
  }

  if (port === CURRENT_SERVICE_PORT) {
    throw new Error(`release smoke test 禁止使用当前服务端口 ${CURRENT_SERVICE_PORT}`);
  }
}

export function parseSmokePort(value) {
  if (!value) {
    return null;
  }

  const port = Number(value);
  assertSafeSmokePort(port);
  return port;
}

export async function findAvailableSmokePort(host = "127.0.0.1", startPort = DEFAULT_SMOKE_PORT) {
  for (let port = startPort; port <= 65535; port += 1) {
    if (port === CURRENT_SERVICE_PORT) {
      continue;
    }

    if (await canListen(host, port)) {
      return port;
    }
  }

  throw new Error("没有找到可用于 release smoke test 的空闲端口");
}

export async function assertRequiredEntries(rootDir, entries = releaseEntries) {
  const missing = [];

  for (const entry of entries) {
    try {
      await access(path.join(rootDir, entry));
    } catch {
      missing.push(entry);
    }
  }

  if (missing.length > 0) {
    throw new Error(`release 缺少必要文件: ${missing.join(", ")}`);
  }
}

export function sha256File(filePath) {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(filePath);

    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}

function canListen(host, port) {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, host);
  });
}
