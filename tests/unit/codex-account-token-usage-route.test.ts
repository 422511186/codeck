import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetAccountTokenUsage = vi.fn();

vi.mock("../../src/server/auth", () => ({
  isRequestAuthenticated: () => true
}));

vi.mock("../../src/server/app-server/runtime", () => ({
  getAppServerGateway: () => ({
    getAccountTokenUsage: (...args: unknown[]) => mockGetAccountTokenUsage(...args)
  })
}));

describe("account token usage route", () => {
  beforeEach(() => {
    vi.resetModules();
    mockGetAccountTokenUsage.mockReset();
  });

  it("账号用量不可用时返回空用量而不是 502", async () => {
    mockGetAccountTokenUsage.mockRejectedValue(new Error("chatgpt authentication required to read token usage"));
    const { GET } = await import("../../src/app/api/codex/account/token-usage/route");

    const response = await GET(new Request("http://localhost/api/codex/account/token-usage"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      usage: {
        summary: {
          lifetimeTokens: null,
          peakDailyTokens: null
        },
        dailyUsageBuckets: null
      }
    });
  });

  it("未知错误仍然返回 502", async () => {
    mockGetAccountTokenUsage.mockRejectedValue(new Error("app-server disconnected"));
    const { GET } = await import("../../src/app/api/codex/account/token-usage/route");

    const response = await GET(new Request("http://localhost/api/codex/account/token-usage"));

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({ ok: false, error: "app-server disconnected" });
  });
});
