import { beforeEach, describe, expect, it, vi } from "vitest";

const mockAudit = vi.fn();
const mockResumeThread = vi.fn();
const mockSteerTurn = vi.fn();
const mockStartReview = vi.fn();
const mockReadThreadMetadata = vi.fn();

vi.mock("../../src/server/auth", () => ({
  isRequestAuthenticated: () => true
}));

vi.mock("../../src/server/security", () => ({
  audit: (...args: unknown[]) => mockAudit(...args)
}));

vi.mock("../../src/server/app-server/runtime", () => ({
  getAppServerGateway: () => ({
    resumeThread: (...args: unknown[]) => mockResumeThread(...args),
    steerTurn: (...args: unknown[]) => mockSteerTurn(...args),
    startReview: (...args: unknown[]) => mockStartReview(...args),
    readThreadMetadata: (...args: unknown[]) => mockReadThreadMetadata(...args)
  })
}));

vi.mock("../../src/server/custom-models/runtime", () => ({
  getThreadModelLifecycleService: () => ({
    resumeThread: (...args: unknown[]) => mockResumeThread(...args)
  })
}));

function unexpectedTimeline(): Array<{ id: string; role: "user"; text: string }> {
  return Array.from({ length: 80 }, (_, index) => ({
    id: `unexpected-${index}`,
    role: "user" as const,
    text: `history ${index}`
  }));
}

describe("codex mutation timeline boundaries", () => {
  beforeEach(() => {
    vi.resetModules();
    mockAudit.mockReset();
    mockResumeThread.mockReset();
    mockSteerTurn.mockReset();
    mockStartReview.mockReset();
    mockReadThreadMetadata.mockReset();
  });

  it("resume route 丢弃 gateway 返回的意外 timeline", async () => {
    mockResumeThread.mockResolvedValue({
      id: "thread-1",
      title: "会话",
      status: "idle",
      timeline: unexpectedTimeline(),
      nextCursor: "older"
    });
    const { POST } = await import("../../src/app/api/codex/threads/[threadId]/resume/route");

    const response = await POST(
      new Request("http://localhost/api/codex/threads/thread-1/resume", { method: "POST" }),
      { params: Promise.resolve({ threadId: "thread-1" }) }
    );
    const body = await response.json();

    expect(body.thread.timeline).toEqual([]);
    expect(body.thread.nextCursor).toBeNull();
  });

  it("steer route 只返回操作 identity", async () => {
    mockSteerTurn.mockResolvedValue({ turnId: "turn-1" });
    const { POST } = await import("../../src/app/api/codex/turns/[threadId]/steer/route");

    const response = await POST(
      new Request("http://localhost/api/codex/turns/thread-1/steer", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ expectedTurnId: "turn-1", text: "继续" })
      }),
      { params: Promise.resolve({ threadId: "thread-1" }) }
    );
    const body = await response.json();

    expect(body).toMatchObject({ ok: true, turnId: "turn-1" });
    expect(body).not.toHaveProperty("thread");
    expect(mockReadThreadMetadata).not.toHaveBeenCalled();
  });

  it("review route 只读取 review thread metadata", async () => {
    mockStartReview.mockResolvedValue({ reviewThreadId: "review-thread" });
    mockReadThreadMetadata.mockResolvedValue({
      id: "review-thread",
      title: "Review",
      status: "idle",
      timeline: []
    });
    const { POST } = await import("../../src/app/api/codex/threads/[threadId]/review/route");

    const response = await POST(
      new Request("http://localhost/api/codex/threads/thread-1/review", { method: "POST" }),
      { params: Promise.resolve({ threadId: "thread-1" }) }
    );
    const body = await response.json();

    expect(mockReadThreadMetadata).toHaveBeenCalledWith("review-thread");
    expect(body.thread.timeline).toEqual([]);
  });
});
