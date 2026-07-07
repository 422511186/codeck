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

  it("读取会话详情时保留首屏历史分页 cursor", async () => {
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
        lastTurnId: "turn-newest",
        timeline: [],
        nextCursor: "turn-older"
      }
    });
    const { codex } = await import("../../src/web/api/endpoints");

    await expect(codex.readThread("thread-1")).resolves.toMatchObject({
      nextCursor: "turn-older"
    });
  });

  it("读取会话状态时调用不携带 timeline 的 summary endpoint", async () => {
    mockApi.mockResolvedValue({
      ok: true,
      thread: {
        id: "thread-1",
        title: "会话",
        preview: "",
        cwd: "C:\\repo",
        modelProvider: "custom",
        status: "active",
        updatedAt: 1
      }
    });
    const { codex } = await import("../../src/web/api/endpoints");

    await expect(codex.readThreadSummary("thread-1")).resolves.toMatchObject({
      id: "thread-1",
      status: "active"
    });

    expect(mockApi).toHaveBeenCalledWith("/api/codex/threads/thread-1/summary");
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

  it("设置会话目标时由 Web API 封装清空 token budget", async () => {
    mockApi.mockResolvedValue({
      ok: true,
      goal: {
        threadId: "thread-1",
        objective: "只保留目标描述",
        status: "active",
        tokenBudget: null,
        tokensUsed: 0,
        timeUsedSeconds: 0,
        createdAt: 1,
        updatedAt: 1
      }
    });
    const { codex } = await import("../../src/web/api/endpoints");

    await codex.setThreadGoal("thread-1", { objective: "只保留目标描述" });

    expect(mockApi).toHaveBeenCalledWith("/api/codex/threads/thread-1/goal", {
      method: "POST",
      body: {
        objective: "只保留目标描述",
        tokenBudget: null
      }
    });
  });
});
