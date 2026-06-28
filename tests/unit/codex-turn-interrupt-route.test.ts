import { beforeEach, describe, expect, it, vi } from "vitest";

const mockReadThread = vi.fn();
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
    readThread: (...args: unknown[]) => mockReadThread(...args),
    interruptTurn: (...args: unknown[]) => mockInterruptTurn(...args)
  })
}));

describe("codex turn interrupt route", () => {
  beforeEach(() => {
    vi.resetModules();
    mockReadThread.mockReset();
    mockInterruptTurn.mockReset();
    mockAudit.mockReset();
    mockReadThread.mockResolvedValue({
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
    mockInterruptTurn.mockResolvedValue(undefined);
  });

  it("未传 turnId 时读取当前会话 lastTurnId 后中断", async () => {
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
    expect(mockReadThread).toHaveBeenCalledWith("thread-1");
    expect(mockInterruptTurn).toHaveBeenCalledWith("thread-1", "turn-running");
    expect(mockAudit).toHaveBeenCalledWith("turn.interrupt", {
      threadId: "thread-1",
      turnId: "turn-running"
    });
  });
});
