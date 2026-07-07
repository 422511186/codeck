import { beforeEach, describe, expect, it, vi } from "vitest";

const mockReadThreadSummary = vi.fn();

vi.mock("../../src/server/auth", () => ({
  isRequestAuthenticated: () => true
}));

vi.mock("../../src/server/app-server/runtime", () => ({
  getAppServerGateway: () => ({
    readThreadSummary: (...args: unknown[]) => mockReadThreadSummary(...args)
  })
}));

describe("codex thread summary route", () => {
  beforeEach(() => {
    vi.resetModules();
    mockReadThreadSummary.mockReset();
    mockReadThreadSummary.mockResolvedValue({
      id: "thread-1",
      title: "会话",
      preview: "",
      cwd: "/repo",
      modelProvider: "custom",
      status: "active",
      updatedAt: 1
    });
  });

  it("读取会话摘要时不请求完整 timeline", async () => {
    const { GET } = await import("../../src/app/api/codex/threads/[threadId]/summary/route");

    const response = await GET(
      new Request("http://localhost/api/codex/threads/thread-1/summary"),
      { params: Promise.resolve({ threadId: "thread-1" }) }
    );

    expect(response.status).toBe(200);
    expect(mockReadThreadSummary).toHaveBeenCalledWith("thread-1");
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      thread: {
        id: "thread-1",
        status: "active"
      }
    });
  });
});
