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
  });

  it("未配置登录 token 时生成临时 token", () => {
    const config = createRuntimeConfig({
      CODEX_WEB_WORKSPACE_ROOTS: "C:\\Users\\huang\\workspace"
    });

    expect(config.accessToken.length).toBeGreaterThanOrEqual(32);
    expect(config.generatedAccessToken).toBe(true);
  });
});
