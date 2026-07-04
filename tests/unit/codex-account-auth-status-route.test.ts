import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetAuthStatus = vi.fn();

vi.mock("../../src/server/auth", () => ({
  isRequestAuthenticated: () => true
}));

vi.mock("../../src/server/app-server/runtime", () => ({
  getAppServerGateway: () => ({
    getAuthStatus: (...args: unknown[]) => mockGetAuthStatus(...args)
  })
}));

describe("account auth status route", () => {
  beforeEach(() => {
    vi.resetModules();
    mockGetAuthStatus.mockReset();
  });

  it("上游返回 HTML 错误页时不把原始 HTML 暴露给前端", async () => {
    mockGetAuthStatus.mockRejectedValue(
      new Error("<!DOCTYPE html><title>huangzy.cyou | 502: Bad gateway</title><body>Cloudflare</body>")
    );
    const { GET } = await import("../../src/app/api/codex/account/auth-status/route");

    const response = await GET(new Request("http://localhost/api/codex/account/auth-status"));

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "上游服务暂不可用（502 Bad gateway）"
    });
  });
});
