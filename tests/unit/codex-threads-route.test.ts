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

  it("cwd 查询只返回精确匹配路径的会话，不包含子目录", async () => {
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
        },
        {
          id: "child-thread",
          title: "child",
          preview: "",
          cwd: "C:\\Users\\huang\\workspace",
          modelProvider: "openai",
          status: "idle",
          updatedAt: 2
        }
      ],
      nextCursor: null
    });

    const { GET } = await import("../../src/app/api/codex/threads/route");
    const response = await GET(
      new Request("http://localhost/api/codex/threads?cwd=C%3A%5CUsers%5Chuang")
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      threads: [
        expect.objectContaining({
          id: "root-thread",
          cwd: "C:\\Users\\huang"
        })
      ],
      nextCursor: null
    });
  });
});
