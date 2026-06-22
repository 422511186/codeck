import { describe, expect, it } from "vitest";
import { createRuntimeConfig } from "../../src/config/env";

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
});
