import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// @ts-expect-error 脚本是运行时 ESM，测试只需要验证导出的实际行为。
const dockerUtils = await import("../../scripts/docker-utils.mjs");

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function readRepoFile(filePath: string) {
  return readFileSync(path.join(rootDir, filePath), "utf8");
}

function normalizedLines(filePath: string) {
  return readRepoFile(filePath)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
}

describe("Docker deployment files", () => {
  it(".dockerignore 排除本地和敏感文件，同时保留示例环境文件", () => {
    const lines = normalizedLines(".dockerignore");

    expect(lines).toEqual(
      expect.arrayContaining([
        ".env",
        ".env.*",
        "node_modules",
        "logs",
        "uploads",
        "coverage",
        "test-results",
        "nohup.out",
        ".next",
        "dist",
        ".cache",
        ".turbo",
        "!.env.example",
        "!.env.docker.example"
      ])
    );
  });

  it("Docker smoke 端口默认避开当前服务端口 23000", () => {
    expect(dockerUtils.CURRENT_SERVICE_PORT).toBe(23000);
    expect(dockerUtils.DEFAULT_DOCKER_SMOKE_HOST_PORT).toBe(23001);
    expect(() => dockerUtils.parseDockerSmokeHostPort("23000")).toThrow(/23000/);
    expect(dockerUtils.parseDockerSmokeHostPort("23001")).toBe(23001);
  });

  it("Compose 示例使用 external app-server、显式 env 文件、数据卷和 host gateway", () => {
    const compose = readRepoFile("compose.yaml");

    expect(compose).toContain("env_file:");
    expect(compose).toContain(".env.docker");
    expect(compose).toContain("CODEX_WEB_APP_SERVER_MODE: external");
    expect(compose).toContain("CODEX_WEB_APP_SERVER_URL: ws://host.docker.internal:31317");
    expect(compose).toContain("host.docker.internal:host-gateway");
    expect(compose).toContain("codex-web-uploads");
    expect(compose).toContain("codex-web-logs");
    expect(compose).toContain("codex-web-data");
    expect(compose).toContain("CODEX_WEB_DATA_DIR: /var/lib/codex-web/data");
    expect(compose).toContain("${CODEX_WEB_WORKSPACE_ROOTS");
  });

  it("Compose 示例配置自动重启和可调整的资源限制", () => {
    const compose = readRepoFile("compose.yaml");
    const productionCompose = readRepoFile("compose.production.yaml");

    for (const content of [compose, productionCompose]) {
      expect(content).toContain("restart: unless-stopped");
      expect(content).toContain("mem_limit: ${CODEX_WEB_MEMORY_LIMIT:-2g}");
      expect(content).toContain("memswap_limit: ${CODEX_WEB_MEMORY_SWAP_LIMIT:-2g}");
      expect(content).toContain('cpus: "${CODEX_WEB_CPU_LIMIT:-2.0}"');
    }
  });

  it("Dockerfile 使用多阶段生产构建和生产启动命令", () => {
    const dockerfile = readRepoFile("Dockerfile");

    expect(dockerfile).toContain("AS builder");
    expect(dockerfile).toContain("AS runner");
    expect(dockerfile).toContain("ARG NODE_IMAGE=node:22-bookworm-slim");
    expect(dockerfile).toContain("RUN npm ci");
    expect(dockerfile).toContain("RUN npm run build");
    expect(dockerfile).toContain("npm ci --omit=dev");
    expect(dockerfile).toContain('CMD ["npm", "run", "start"]');
    expect(dockerfile).not.toContain("tsx");
  });

  it(".env.docker.example 记录 Docker 部署必需环境变量", () => {
    const envExample = readRepoFile(".env.docker.example");

    for (const key of [
      "CODEX_WEB_ACCESS_TOKEN",
      "CODEX_WEB_WORKSPACE_ROOTS",
      "CODEX_WEB_UPLOAD_DIR",
      "CODEX_WEB_AUDIT_LOG_PATH",
      "CODEX_WEB_DATA_DIR",
      "CODEX_WEB_BIND_HOST",
      "CODEX_WEB_BIND_PORT",
      "CODEX_WEB_APP_SERVER_MODE",
      "CODEX_WEB_APP_SERVER_URL",
      "CODEX_WEB_MEMORY_LIMIT",
      "CODEX_WEB_MEMORY_SWAP_LIMIT",
      "CODEX_WEB_CPU_LIMIT"
    ]) {
      expect(envExample).toContain(`${key}=`);
    }
  });
});
