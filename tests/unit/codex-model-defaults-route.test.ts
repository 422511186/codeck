import { beforeEach, describe, expect, it, vi } from "vitest";

const mockReadModelDefaults = vi.fn();

vi.mock("../../src/server/auth", () => ({
  isRequestAuthenticated: () => true
}));

vi.mock("../../src/server/app-server/runtime", () => ({
  getAppServerGateway: () => ({
    readModelDefaults: (...args: unknown[]) => mockReadModelDefaults(...args)
  })
}));

describe("codex model defaults route", () => {
  beforeEach(() => {
    vi.resetModules();
    mockReadModelDefaults.mockReset();
  });

  it("读取 app-server 默认模型失败时降级为空默认值，避免前端收到 502", async () => {
    mockReadModelDefaults.mockRejectedValueOnce(new Error("config/read unavailable"));

    const { GET } = await import("../../src/app/api/codex/settings/model-defaults/route");
    const response = await GET(new Request("http://localhost/api/codex/settings/model-defaults"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      settings: {
        model: null,
        modelProvider: null,
        reasoningEffort: null,
        reasoningSummary: null
      }
    });
  });

  it("读取 app-server 默认模型成功时返回默认设置", async () => {
    mockReadModelDefaults.mockResolvedValueOnce({
      model: "gpt-5.5",
      modelProvider: "openai",
      reasoningEffort: "high",
      reasoningSummary: "auto"
    });

    const { GET } = await import("../../src/app/api/codex/settings/model-defaults/route");
    const response = await GET(new Request("http://localhost/api/codex/settings/model-defaults"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      settings: {
        model: "gpt-5.5",
        modelProvider: "openai",
        reasoningEffort: "high",
        reasoningSummary: "auto"
      }
    });
  });
});
