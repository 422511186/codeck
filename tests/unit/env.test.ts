import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { createRuntimeConfig, loadRuntimeEnvConfig } from "../../src/config/env";

const execFileAsync = promisify(execFile);

describe("createRuntimeConfig", () => {
  it("优先使用显式配置的登录 token", () => {
    const config = createRuntimeConfig({
      CODEX_WEB_ACCESS_TOKEN: "sk-user-configured",
      CODEX_WEB_WORKSPACE_ROOTS: "C:\\Users\\huang\\workspace",
      CODEX_WEB_BIND_HOST: "0.0.0.0",
      CODEX_WEB_BIND_PORT: "3100"
    });

    expect(config.accessToken).toBe("sk-user-configured");
    expect(config.generatedAccessToken).toBe(false);
    expect(config.workspaceRoots).toEqual(["C:\\Users\\huang\\workspace"]);
    expect(config.bindHost).toBe("0.0.0.0");
    expect(config.bindPort).toBe(3100);
    expect(config.uploadDir).toContain("uploads");
  });

  it("未配置登录 token 时生成临时 token", () => {
    const config = createRuntimeConfig({
      CODEX_WEB_WORKSPACE_ROOTS: "C:\\Users\\huang\\workspace"
    });

    expect(config.accessToken.length).toBeGreaterThanOrEqual(32);
    expect(config.generatedAccessToken).toBe(true);
  });

  it("可以配置图片上传暂存目录", () => {
    const config = createRuntimeConfig({
      CODEX_WEB_ACCESS_TOKEN: "sk-user-configured",
      CODEX_WEB_UPLOAD_DIR: "C:\\Users\\huang\\workspace\\codex-web\\.uploads"
    });

    expect(config.uploadDir).toBe("C:\\Users\\huang\\workspace\\codex-web\\.uploads");
  });

  it("可以配置审计日志路径", () => {
    const config = createRuntimeConfig({
      CODEX_WEB_ACCESS_TOKEN: "sk-user-configured",
      CODEX_WEB_AUDIT_LOG_PATH: "C:\\Users\\huang\\workspace\\codex-web\\logs\\audit.jsonl"
    });

    expect(config.auditLogPath).toBe("C:\\Users\\huang\\workspace\\codex-web\\logs\\audit.jsonl");
  });

  it("配置外部 app-server endpoint 时自动使用 external 模式", () => {
    const config = createRuntimeConfig({
      CODEX_WEB_ACCESS_TOKEN: "sk-user-configured",
      CODEX_WEB_APP_SERVER_URL: "ws://127.0.0.1:31317"
    });

    expect(config.appServer).toMatchObject({ mode: "external" });
    if (config.appServer.mode !== "external") {
      throw new Error("expected external app-server mode");
    }
    expect(config.appServer.url).toBe("ws://127.0.0.1:31317");
  });

  it("未配置 app-server endpoint 时默认由 Web 后端托管 Codex app-server", () => {
    const config = createRuntimeConfig({
      CODEX_WEB_ACCESS_TOKEN: "sk-user-configured"
    });

    expect(config.appServer).toMatchObject({ mode: "spawn" });
    if (config.appServer.mode !== "spawn") {
      throw new Error("expected spawn app-server mode");
    }
    expect(config.appServer.codexBin).toBe("codex");
    expect(config.appServer.host).toBe("127.0.0.1");
  });

  it("支持 spawn-or-connect 自动复用模式和固定 host/port", () => {
    const config = createRuntimeConfig({
      CODEX_WEB_ACCESS_TOKEN: "sk-user-configured",
      CODEX_WEB_APP_SERVER_MODE: "spawn-or-connect",
      CODEX_WEB_APP_SERVER_HOST: "127.0.0.1",
      CODEX_WEB_APP_SERVER_PORT: "31317",
      CODEX_WEB_APP_SERVER_STATE_DIR: "/tmp/codex-web-app-server-test",
      CODEX_WEB_CODEX_BIN: "/usr/local/bin/codex"
    });

    expect(config.appServer).toMatchObject({ mode: "spawn-or-connect" });
    if (config.appServer.mode !== "spawn-or-connect") {
      throw new Error("expected spawn-or-connect app-server mode");
    }
    expect(config.appServer.codexBin).toBe("/usr/local/bin/codex");
    expect(config.appServer.host).toBe("127.0.0.1");
    expect(config.appServer.port).toBe(31317);
    expect(config.appServer.stateDir).toBe("/tmp/codex-web-app-server-test");
  });

  it("显式 spawn-or-connect 不会被 app-server URL 自动覆盖为 external", () => {
    const config = createRuntimeConfig({
      CODEX_WEB_ACCESS_TOKEN: "sk-user-configured",
      CODEX_WEB_APP_SERVER_MODE: "spawn-or-connect",
      CODEX_WEB_APP_SERVER_URL: "ws://127.0.0.1:31317",
      CODEX_WEB_APP_SERVER_PORT: "31317"
    });

    expect(config.appServer.mode).toBe("spawn-or-connect");
  });

  it("拒绝未知 app-server 模式", () => {
    expect(() =>
      createRuntimeConfig({
        CODEX_WEB_ACCESS_TOKEN: "sk-user-configured",
        CODEX_WEB_APP_SERVER_MODE: "reuse"
      })
    ).toThrow("CODEX_WEB_APP_SERVER_MODE 无效");
  });

  it("从项目 .env 加载运行时配置", async () => {
    const dir = await mkdtemp(join(tmpdir(), "codex-web-env-"));
    const previousPort = process.env.CODEX_WEB_BIND_PORT;
    delete process.env.CODEX_WEB_BIND_PORT;

    try {
      await writeFile(join(dir, ".env"), "CODEX_WEB_BIND_PORT=3999\n", "utf8");

      loadRuntimeEnvConfig(dir, false);

      expect(process.env.CODEX_WEB_BIND_PORT).toBe("3999");
    } finally {
      if (previousPort === undefined) {
        delete process.env.CODEX_WEB_BIND_PORT;
      } else {
        process.env.CODEX_WEB_BIND_PORT = previousPort;
      }
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("可通过 tsx 运行时导入 env 模块", async () => {
    const { stdout } = await execFileAsync(
      process.execPath,
      [
        join(process.cwd(), "node_modules", "tsx", "dist", "cli.mjs"),
        "-e",
        "import('./src/config/env.ts').then((mod) => console.log(typeof mod.loadRuntimeEnvConfig))"
      ],
      { cwd: process.cwd() }
    );

    expect(stdout.trim()).toBe("function");
  });
});
