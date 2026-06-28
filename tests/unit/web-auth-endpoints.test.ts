import { beforeEach, describe, expect, it, vi } from "vitest";

const mockApi = vi.fn();

vi.mock("../../src/web/api/client", () => ({
  api: (...args: unknown[]) => mockApi(...args)
}));

describe("web auth endpoints", () => {
  beforeEach(() => {
    mockApi.mockReset();
    mockApi.mockResolvedValue({ ok: true });
  });

  it("logs out through the dedicated logout endpoint", async () => {
    const { auth } = await import("../../src/web/api/endpoints");

    await auth.logout();

    expect(mockApi).toHaveBeenCalledWith("/api/auth/logout", {
      method: "POST",
      skipSessionRedirect: true
    });
  });

  it("reads account auth status from the route payload", async () => {
    mockApi.mockResolvedValueOnce({
      ok: true,
      authStatus: { authMethod: "apikey", hasAuthToken: false, requiresOpenaiAuth: true }
    });
    const { codex } = await import("../../src/web/api/endpoints");

    await expect(codex.authStatus()).resolves.toEqual({
      authMethod: "apikey",
      hasAuthToken: false,
      requiresOpenaiAuth: true
    });
  });

  it("reads token usage from the route payload", async () => {
    mockApi.mockResolvedValueOnce({
      ok: true,
      usage: { summary: { lifetimeTokens: 123, peakDailyTokens: 45 } }
    });
    const { codex } = await import("../../src/web/api/endpoints");

    await expect(codex.tokenUsage()).resolves.toEqual({
      summary: { lifetimeTokens: 123, peakDailyTokens: 45 }
    });
  });
});
