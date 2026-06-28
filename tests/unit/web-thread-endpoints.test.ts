import { beforeEach, describe, expect, it, vi } from "vitest";

const mockApi = vi.fn();

vi.mock("../../src/web/api/client", () => ({
  api: (...args: unknown[]) => mockApi(...args)
}));

describe("web thread endpoints", () => {
  beforeEach(() => {
    mockApi.mockReset();
    mockApi.mockResolvedValue({ ok: true, threads: [], nextCursor: null });
  });

  it("按 cwd 查询会话时把路径交给后端精确过滤", async () => {
    const { codex } = await import("../../src/web/api/endpoints");

    await codex.listThreadsForCwd("C:\\Users\\huang");

    expect(mockApi).toHaveBeenCalledTimes(1);
    expect(mockApi).toHaveBeenCalledWith("/api/codex/threads", {
      query: {
        cwd: "C:\\Users\\huang",
        archived: false
      }
    });
  });

  it("恢复会话调用 thread resume endpoint", async () => {
    mockApi.mockResolvedValue({
      ok: true,
      thread: {
        id: "thread-1",
        title: "会话",
        preview: "",
        cwd: "C:\\repo",
        modelProvider: "custom",
        status: "idle",
        updatedAt: 1,
        lastTurnId: null,
        timeline: []
      }
    });
    const { codex } = await import("../../src/web/api/endpoints");

    await codex.resumeThread("thread-1");

    expect(mockApi).toHaveBeenCalledWith("/api/codex/threads/thread-1/resume", {
      method: "POST"
    });
  });

  it("读取 collaboration modes 时只调用轻量 preset endpoint", async () => {
    mockApi.mockResolvedValue({
      ok: true,
      modes: [{ name: "Ask", mode: "ask", model: null, reasoningEffort: null }]
    });
    const { codex } = await import("../../src/web/api/endpoints");

    await expect(codex.collaborationModes()).resolves.toEqual([
      { name: "Ask", mode: "ask", model: null, reasoningEffort: null }
    ]);

    expect(mockApi).toHaveBeenCalledWith("/api/codex/collaboration-modes");
  });
});
