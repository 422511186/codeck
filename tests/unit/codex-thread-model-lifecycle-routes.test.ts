import { beforeEach, describe, expect, it, vi } from "vitest";

const mockAuthenticated = vi.fn(() => true);
const mockAudit = vi.fn();
const mockResumeThread = vi.fn();
const mockReadThreadMetadata = vi.fn();
const mockForkThread = vi.fn();
const mockDeleteThread = vi.fn();
const mockUnarchiveThread = vi.fn();

vi.mock("../../src/server/auth", () => ({
  isRequestAuthenticated: () => mockAuthenticated()
}));

vi.mock("../../src/server/security", () => ({
  audit: (...args: unknown[]) => mockAudit(...args)
}));

vi.mock("../../src/server/custom-models/runtime", () => ({
  getThreadModelLifecycleService: () => ({
    readThreadMetadata: (...args: unknown[]) => mockReadThreadMetadata(...args),
    resumeThread: (...args: unknown[]) => mockResumeThread(...args),
    forkThread: (...args: unknown[]) => mockForkThread(...args),
    deleteThread: (...args: unknown[]) => mockDeleteThread(...args),
    unarchiveThread: (...args: unknown[]) => mockUnarchiveThread(...args)
  })
}));

describe("binding-aware thread lifecycle routes", () => {
  beforeEach(() => {
    vi.resetModules();
    mockAuthenticated.mockReset();
    mockAuthenticated.mockReturnValue(true);
    mockAudit.mockReset();
    mockAudit.mockResolvedValue(undefined);
    mockResumeThread.mockReset();
    mockReadThreadMetadata.mockReset();
    mockForkThread.mockReset();
    mockDeleteThread.mockReset();
    mockUnarchiveThread.mockReset();
  });

  it("resume 返回来源身份与绑定状态，并继续裁掉 timeline", async () => {
    mockResumeThread.mockResolvedValue({
      id: "thread-1",
      model: "mimo-v2.5-pro",
      timeline: [{ id: "unexpected" }],
      nextCursor: "older",
      modelState: {
        selection: { source: "custom", customModelId: "custom-1" },
        bindingVersion: "binding-1"
      }
    });
    const { POST } = await import("../../src/app/api/codex/threads/[threadId]/resume/route");
    const response = await POST(new Request("http://localhost/resume", { method: "POST" }), {
      params: Promise.resolve({ threadId: "thread-1" })
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockResumeThread).toHaveBeenCalledWith("thread-1");
    expect(body.thread.timeline).toEqual([]);
    expect(body.thread.modelState).toMatchObject({ bindingVersion: "binding-1" });
  });

  it("thread GET 通过生命周期服务返回来源状态", async () => {
    mockReadThreadMetadata.mockResolvedValue({
      id: "thread-1",
      model: "mimo-v2.5-pro",
      modelState: {
        selection: { source: "custom", customModelId: "custom-1" },
        bindingVersion: "binding-1"
      }
    });
    const { GET } = await import("../../src/app/api/codex/threads/[threadId]/route");
    const response = await GET(new Request("http://localhost/thread"), {
      params: Promise.resolve({ threadId: "thread-1" })
    });

    expect(response.status).toBe(200);
    expect(mockReadThreadMetadata).toHaveBeenCalledWith("thread-1");
    await expect(response.json()).resolves.toMatchObject({
      thread: { modelState: { bindingVersion: "binding-1" } }
    });
  });

  it("thread GET 观察到自定义标称与实际窗口偏差时记录结构化审计", async () => {
    mockReadThreadMetadata.mockResolvedValue({
      id: "thread-1",
      modelState: {
        selection: { source: "custom", customModelId: "custom-1" },
        contextWindow: 200_000
      },
      contextUsage: { modelContextWindow: 128_000 }
    });
    const { GET } = await import("../../src/app/api/codex/threads/[threadId]/route");
    const response = await GET(new Request("http://localhost/thread"), {
      params: Promise.resolve({ threadId: "thread-1" })
    });

    expect(response.status).toBe(200);
    expect(mockAudit).toHaveBeenCalledWith("thread.model.context_mismatch", {
      threadId: "thread-1",
      selection: { source: "custom", customModelId: "custom-1" },
      configuredContextWindow: 200_000,
      actualContextWindow: 128_000
    });
  });

  it("thread GET 记录 bounded final reconcile 原因且不包含正文", async () => {
    mockReadThreadMetadata.mockResolvedValue({
      id: "thread-1",
      status: "idle",
      activeTurnId: null,
      timeline: []
    });
    const { GET } = await import("../../src/app/api/codex/threads/[threadId]/route");
    const response = await GET(
      new Request("http://localhost/thread?repairReason=summary-idle"),
      { params: Promise.resolve({ threadId: "thread-1" }) }
    );

    expect(response.status).toBe(200);
    expect(mockAudit).toHaveBeenCalledWith("thread.timeline.reconcile", {
      threadId: "thread-1",
      reason: "summary-idle"
    });
  });

  it("thread GET 对 recovery_failed 返回结构化阻塞状态", async () => {
    mockReadThreadMetadata.mockRejectedValue({
      code: "SWITCH_RECOVERY_FAILED",
      httpStatus: 500,
      result: {
        outcome: "recovery_failed",
        operationId: "operation-1",
        latestState: { blocked: true }
      },
      thread: { id: "thread-1", title: "保留的会话", modelState: { blocked: true } }
    });
    const { GET } = await import("../../src/app/api/codex/threads/[threadId]/route");
    const response = await GET(new Request("http://localhost/thread"), {
      params: Promise.resolve({ threadId: "thread-1" })
    });

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toMatchObject({
      code: "SWITCH_RECOVERY_FAILED",
      outcome: "recovery_failed",
      operationId: "operation-1",
      thread: { id: "thread-1", title: "保留的会话" }
    });
  });

  it("recovery_failed resume 返回 500 阻塞状态", async () => {
    mockResumeThread.mockRejectedValue({
      code: "SWITCH_RECOVERY_FAILED",
      httpStatus: 500,
      result: {
        outcome: "recovery_failed",
        operationId: "operation-1",
        latestState: { blocked: true }
      }
    });
    const { POST } = await import("../../src/app/api/codex/threads/[threadId]/resume/route");
    const response = await POST(new Request("http://localhost/resume", { method: "POST" }), {
      params: Promise.resolve({ threadId: "thread-1" })
    });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      code: "SWITCH_RECOVERY_FAILED",
      outcome: "recovery_failed",
      operationId: "operation-1"
    });
  });

  it("fork/delete/unarchive 均走 binding-aware 生命周期服务", async () => {
    mockForkThread.mockResolvedValue({ id: "thread-fork" });
    mockDeleteThread.mockResolvedValue(undefined);
    mockUnarchiveThread.mockResolvedValue({ id: "thread-1", modelState: { bindingVersion: "binding-1" } });
    const forkRoute = await import("../../src/app/api/codex/threads/[threadId]/fork/route");
    const deleteRoute = await import("../../src/app/api/codex/threads/[threadId]/delete/route");
    const unarchiveRoute = await import("../../src/app/api/codex/threads/[threadId]/unarchive/route");
    const context = { params: Promise.resolve({ threadId: "thread-1" }) };

    expect((await forkRoute.POST(new Request("http://localhost/fork", { method: "POST" }), context)).status).toBe(200);
    expect((await deleteRoute.POST(new Request("http://localhost/delete", { method: "POST" }), context)).status).toBe(200);
    expect((await unarchiveRoute.POST(new Request("http://localhost/unarchive", { method: "POST" }), context)).status).toBe(200);
    expect(mockForkThread).toHaveBeenCalledWith("thread-1");
    expect(mockDeleteThread).toHaveBeenCalledWith("thread-1");
    expect(mockUnarchiveThread).toHaveBeenCalledWith("thread-1");
  });
});
