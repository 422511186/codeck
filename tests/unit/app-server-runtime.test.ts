import { describe, expect, it } from "vitest";
import { createAppServerGateway } from "../../src/server/app-server/runtime";

describe("createAppServerGateway", () => {
  it("mock 模式可以初始化并返回移动端基础数据", async () => {
    const gateway = createAppServerGateway({ mode: "mock" });

    await gateway.ensureReady();

    expect(gateway.getStatus().state).toBe("ready");
    await expect(gateway.listThreads({ limit: 10 })).resolves.toMatchObject({
      threads: [
        {
          id: "mock-thread-1",
          title: "示例会话",
          status: "idle"
        }
      ],
      nextCursor: null
    });
    await expect(gateway.listModels()).resolves.toMatchObject([
      {
        id: "gpt-5-codex",
        label: "GPT-5 Codex",
        isDefault: true
      }
    ]);
  });

  it("off 模式会保留 disabled 状态并拒绝请求", async () => {
    const gateway = createAppServerGateway({ mode: "off" });

    expect(gateway.getStatus()).toEqual({ state: "disabled" });
    await expect(gateway.listThreads()).rejects.toThrow("app-server 已关闭");
  });
});
