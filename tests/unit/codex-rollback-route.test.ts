import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRollbackThread = vi.fn();
const mockAudit = vi.fn();

vi.mock("../../src/server/auth", () => ({
  isRequestAuthenticated: () => true
}));

vi.mock("../../src/server/security", () => ({
  audit: (...args: unknown[]) => mockAudit(...args)
}));

vi.mock("../../src/server/app-server/runtime", () => ({
  getAppServerGateway: () => ({
    rollbackThread: (...args: unknown[]) => mockRollbackThread(...args)
  })
}));

describe("codex rollback route", () => {
  beforeEach(() => {
    vi.resetModules();
    mockRollbackThread.mockReset();
    mockAudit.mockReset();
    mockRollbackThread.mockResolvedValue({
      id: "thread-1",
      title: "会话",
      cwd: "C:/repo",
      modelProvider: "openai",
      status: "idle",
      updatedAt: 1,
      lastTurnId: "turn-1",
      nextCursor: null,
      timeline: []
    });
  });

  it("拒绝仅携带 numTurns 的旧破坏性请求", async () => {
    const { POST } = await import("../../src/app/api/codex/threads/[threadId]/rollback/route");
    const response = await POST(
      new Request("http://localhost/api/codex/threads/thread-1/rollback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ numTurns: 1 })
      }),
      { params: Promise.resolve({ threadId: "thread-1" }) }
    );

    expect(response.status).toBe(400);
    expect(mockRollbackThread).not.toHaveBeenCalled();
  });

  it("转发 operation、目标和权威尾部 precondition", async () => {
    const { POST } = await import("../../src/app/api/codex/threads/[threadId]/rollback/route");
    const rollbackRequest = {
      operationId: "rollback-op-1",
      targetTurnId: "turn-2",
      historyStamp: { bootId: "boot-1", generation: 3 },
      expectedTailTurnIds: ["turn-2", "turn-3"]
    };
    const response = await POST(
      new Request("http://localhost/api/codex/threads/thread-1/rollback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(rollbackRequest)
      }),
      { params: Promise.resolve({ threadId: "thread-1" }) }
    );

    expect(response.status).toBe(200);
    expect(mockRollbackThread).toHaveBeenCalledWith("thread-1", rollbackRequest);
    expect(mockAudit).toHaveBeenCalledWith("thread.rollback", expect.objectContaining(rollbackRequest));
  });

  it("以结构化 409 返回 tail conflict 并审计实际尾部", async () => {
    mockRollbackThread.mockRejectedValue(
      Object.assign(new Error("会话尾部已变化，请刷新后重试"), {
        code: "ROLLBACK_CONFLICT",
        httpStatus: 409,
        actualTailTurnIds: ["turn-3"]
      })
    );
    const { POST } = await import("../../src/app/api/codex/threads/[threadId]/rollback/route");
    const response = await POST(
      new Request("http://localhost/api/codex/threads/thread-1/rollback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          operationId: "rollback-op-conflict",
          targetTurnId: "turn-2",
          historyStamp: { bootId: "boot-1", generation: 3 },
          expectedTailTurnIds: ["turn-2"]
        })
      }),
      { params: Promise.resolve({ threadId: "thread-1" }) }
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      code: "ROLLBACK_CONFLICT",
      actualTailTurnIds: ["turn-3"]
    });
    expect(mockAudit).toHaveBeenCalledWith("thread.rollback.conflict", expect.objectContaining({
      code: "ROLLBACK_CONFLICT",
      operationId: "rollback-op-conflict",
      actualTailTurnIds: ["turn-3"]
    }));
  });

  it("以结构化 409 返回 repair exhausted 的权威 response", async () => {
    const authoritativeThread = {
      id: "thread-1",
      title: "会话",
      timeline: [],
      turnManifest: { turnIds: ["turn-1"] }
    };
    mockRollbackThread.mockRejectedValue(
      Object.assign(new Error("rollback 后的会话分页仍未收敛"), {
        code: "REPAIR_EXHAUSTED",
        authoritativeThread
      })
    );
    const { POST } = await import("../../src/app/api/codex/threads/[threadId]/rollback/route");
    const response = await POST(
      new Request("http://localhost/api/codex/threads/thread-1/rollback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          operationId: "rollback-op-repair",
          targetTurnId: "turn-2",
          historyStamp: { bootId: "boot-1", generation: 3 },
          expectedTailTurnIds: ["turn-2"]
        })
      }),
      { params: Promise.resolve({ threadId: "thread-1" }) }
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      code: "REPAIR_EXHAUSTED",
      thread: authoritativeThread
    });
  });
});
