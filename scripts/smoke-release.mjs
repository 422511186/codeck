import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assertRequiredEntries, findAvailableSmokePort, parseSmokePort } from "./release-utils.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const host = process.env.CODEX_WEB_SMOKE_BIND_HOST || "127.0.0.1";
const configuredPort = parseSmokePort(process.env.CODEX_WEB_BIND_PORT);
const port = configuredPort ?? (await findAvailableSmokePort(host));
const smokeDir = await mkdtemp(path.join(tmpdir(), "codex-web-smoke-"));
const serverPath = path.join(rootDir, "dist", "server", "http.js");
const timeoutMs = Number(process.env.CODEX_WEB_SMOKE_TIMEOUT_MS || 30000);

await assertRequiredEntries(rootDir, [".next", "dist/server", "package.json"]);

const child = spawn(process.execPath, [serverPath], {
  cwd: rootDir,
  env: {
    ...process.env,
    NODE_ENV: "production",
    CODEX_WEB_APP_SERVER_MODE: "mock",
    CODEX_WEB_ACCESS_TOKEN: process.env.CODEX_WEB_ACCESS_TOKEN || "sk-release-smoke-test",
    CODEX_WEB_BIND_HOST: host,
    CODEX_WEB_BIND_PORT: String(port),
    CODEX_WEB_UPLOAD_DIR: path.join(smokeDir, "uploads"),
    CODEX_WEB_AUDIT_LOG_PATH: path.join(smokeDir, "logs", "audit.jsonl")
  },
  stdio: ["ignore", "pipe", "pipe"]
});

let output = "";
child.stdout.on("data", (chunk) => {
  output += chunk.toString();
});
child.stderr.on("data", (chunk) => {
  output += chunk.toString();
});

try {
  await waitForHealth(`http://${host}:${port}/api/health`, timeoutMs);
  await assertFileUploadRoute(`http://${host}:${port}/api/codex/uploads/files`);
  console.log(`Release smoke test passed on http://${host}:${port}`);
} finally {
  await stopChild(child);
  await rm(smokeDir, { recursive: true, force: true });
}

async function assertFileUploadRoute(url) {
  const response = await fetch(url, { method: "POST" });
  if (response.status !== 401) {
    throw new Error(`普通文件上传路由 smoke 失败: ${response.status}`);
  }
}

async function waitForHealth(url, timeout) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeout) {
    if (child.exitCode !== null) {
      throw new Error(`release smoke test 服务提前退出: ${child.exitCode}\n${output}`);
    }

    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // 服务启动期间连接失败是正常的，继续轮询。
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`release smoke test 超时，未能访问 ${url}\n${output}`);
}

async function stopChild(childProcess) {
  if (childProcess.exitCode !== null) {
    return;
  }

  childProcess.kill("SIGTERM");

  await new Promise((resolve) => {
    const timeout = setTimeout(() => {
      if (childProcess.exitCode === null) {
        childProcess.kill("SIGKILL");
      }
      resolve();
    }, 5000);

    childProcess.once("exit", () => {
      clearTimeout(timeout);
      resolve();
    });
  });
}
