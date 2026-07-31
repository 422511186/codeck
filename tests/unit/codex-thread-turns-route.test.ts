import { beforeEach, describe, expect, it, vi } from "vitest";

const mockListThreadTurns = vi.fn();

vi.mock("../../src/server/auth", () => ({
  isRequestAuthenticated: () => true
}));

vi.mock("../../src/server/app-server/runtime", () => ({
  getAppServerGateway: () => ({ listThreadTurns: (...args: unknown[]) => mockListThreadTurns(...args) })
}));

describe("codex thread turns route", () => {
  beforeEach(() => {
    vi.resetModules();
    mockListThreadTurns.mockReset();
  });

  it("透传 bounded owner resolver 的 repair reason 与分页参数", async () => {
    mockListThreadTurns.mockResolvedValueOnce({
      items: [{ id: "item-unresolved", role: "agent", text: "owner 未知" }],
      nextCursor: "older",
      turnManifest: { turnIds: [] },
      completeness: { status: "repair-required", reason: "source-gap" }
    });

    const { GET } = await import("../../src/app/api/codex/threads/[threadId]/turns/route");
    const response = await GET(
      new Request("http://localhost/api/codex/threads/thread-1/turns?cursor=page-2&limit=12"),
      { params: Promise.resolve({ threadId: "thread-1" }) }
    );

    expect(response.status).toBe(200);
    expect(mockListThreadTurns).toHaveBeenCalledWith({
      threadId: "thread-1",
      cursor: "page-2",
      limit: 12
    });
    await expect(response.json()).resolves.toEqual({
      ok: true,
      page: expect.objectContaining({
        completeness: { status: "repair-required", reason: "source-gap" }
      })
    });
  });
});
