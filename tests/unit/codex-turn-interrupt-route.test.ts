import { beforeEach, describe, expect, it, vi } from "vitest";

const mockReadThreadMetadata = vi.fn();
const mockGetActiveTurnId = vi.fn();
const mockInterruptTurn = vi.fn();
const mockAudit = vi.fn();

vi.mock("../../src/server/auth", () => ({
  isRequestAuthenticated: () => true
}));

vi.mock("../../src/server/security", () => ({
  audit: (...args: unknown[]) => mockAudit(...args)
}));

vi.mock("../../src/server/app-server/runtime", () => ({
  getAppServerGateway: () => ({
    readThreadMetadata: (...args: unknown[]) => mockReadThreadMetadata(...args),
    getActiveTurnId: (...args: unknown[]) => mockGetActiveTurnId(...args),
    interruptTurn: (...args: unknown[]) => mockInterruptTurn(...args)
  })
}));

describe("codex turn interrupt route", () => {
  beforeEach(() => {
    vi.resetModules();
    mockReadThreadMetadata.mockReset();
    mockGetActiveTurnId.mockReset();
    mockInterruptTurn.mockReset();
    mockAudit.mockReset();
    mockReadThreadMetadata.mockResolvedValue({
      id: "thread-1",
      title: "会话",
      preview: "",
      cwd: "C:\\repo",
      modelProvider: "custom",
      status: "active",
      updatedAt: 1,
      lastTurnId: "turn-running",
      timeline: []
    });
    mockGetActiveTurnId.mockReturnValue("turn-running");
    mockInterruptTurn.mockResolvedValue(undefined);
  });

  it("未传 turnId 时使用 gateway 已知 active turn 中断", async () => {
    const { POST } = await import("../../src/app/api/codex/turns/[threadId]/interrupt/route");

    const response = await POST(
      new Request("http://localhost/api/codex/turns/thread-1/interrupt", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({})
      }),
      { params: Promise.resolve({ threadId: "thread-1" }) }
    );

    expect(response.status).toBe(200);
    expect(mockGetActiveTurnId).toHaveBeenCalledWith("thread-1");
    expect(mockReadThreadMetadata).not.toHaveBeenCalled();
    expect(mockInterruptTurn).toHaveBeenCalledWith("thread-1", "turn-running");
    expect(mockAudit).toHaveBeenCalledWith("turn.interrupt", {
      threadId: "thread-1",
      turnId: "turn-running"
    });
  });

  it("显式 turnId 优先于 gateway active turn", async () => {
    const { POST } = await import("../../src/app/api/codex/turns/[threadId]/interrupt/route");

    const response = await POST(
      new Request("http://localhost/api/codex/turns/thread-1/interrupt", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ turnId: "turn-explicit" })
      }),
      { params: Promise.resolve({ threadId: "thread-1" }) }
    );

    expect(response.status).toBe(200);
    expect(mockGetActiveTurnId).not.toHaveBeenCalled();
    expect(mockReadThreadMetadata).not.toHaveBeenCalled();
    expect(mockInterruptTurn).toHaveBeenCalledWith("thread-1", "turn-explicit");
  });

  it("没有已知 active turn 时返回稳定 409 且不读取 metadata", async () => {
    mockGetActiveTurnId.mockReturnValue(null);
    const { POST } = await import("../../src/app/api/codex/turns/[threadId]/interrupt/route");

    const response = await POST(
      new Request("http://localhost/api/codex/turns/thread-1/interrupt", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({})
      }),
      { params: Promise.resolve({ threadId: "thread-1" }) }
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ ok: false, error: "暂无可中断的 turn" });
    expect(mockReadThreadMetadata).not.toHaveBeenCalled();
    expect(mockInterruptTurn).not.toHaveBeenCalled();
  });
});
