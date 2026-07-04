import { beforeEach, describe, expect, it, vi } from "vitest";

const mockListThreads = vi.fn();

vi.mock("../../src/server/auth", () => ({
  isRequestAuthenticated: () => true
}));

vi.mock("../../src/server/app-server/runtime", () => ({
  getAppServerGateway: () => ({
    listThreads: (...args: unknown[]) => mockListThreads(...args),
    searchThreads: vi.fn()
  })
}));

describe("codex threads route", () => {
  beforeEach(() => {
    vi.resetModules();
    mockListThreads.mockReset();
  });

  it("cwd 查询交给 app-server 精确过滤，并保留 archived 参数", async () => {
    mockListThreads.mockResolvedValueOnce({
      threads: [
        {
          id: "root-thread",
          title: "root",
          preview: "",
          cwd: "C:\\Users\\huang",
          modelProvider: "openai",
          status: "idle",
          updatedAt: 1
        }
      ],
      nextCursor: "older"
    });

    const { GET } = await import("../../src/app/api/codex/threads/route");
    const response = await GET(
      new Request("http://localhost/api/codex/threads?cwd=C%3A%5CUsers%5Chuang&archived=false")
    );

    expect(response.status).toBe(200);
    expect(mockListThreads).toHaveBeenCalledTimes(1);
    expect(mockListThreads).toHaveBeenCalledWith({
      limit: 30,
      cursor: null,
      sortKey: "updated_at",
      sortDirection: "desc",
      archived: false,
      cwd: "C:\\Users\\huang"
    });
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      threads: [
        expect.objectContaining({
          id: "root-thread",
          cwd: "C:\\Users\\huang"
        })
      ],
      nextCursor: "older"
    });
  });
});
