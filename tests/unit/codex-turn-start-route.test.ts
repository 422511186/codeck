import { beforeEach, describe, expect, it, vi } from "vitest";

const mockStartTurn = vi.fn();
const mockReadThread = vi.fn();
const mockAudit = vi.fn();

vi.mock("../../src/server/auth", () => ({
  isRequestAuthenticated: () => true
}));

vi.mock("../../src/server/runtime", () => ({
  getRuntimeConfig: () => ({
    uploadDir: "C:\\uploads"
  })
}));

vi.mock("../../src/server/security", () => ({
  assertRuntimePathAllowed: (path: string) => path,
  audit: (...args: unknown[]) => mockAudit(...args)
}));

vi.mock("../../src/server/app-server/runtime", () => ({
  getAppServerGateway: () => ({
    startTurn: (...args: unknown[]) => mockStartTurn(...args),
    readThread: (...args: unknown[]) => mockReadThread(...args)
  })
}));

describe("codex turn start route", () => {
  beforeEach(() => {
    vi.resetModules();
    mockStartTurn.mockReset();
    mockReadThread.mockReset();
    mockAudit.mockReset();
    mockStartTurn.mockResolvedValue({ turnId: "turn-1" });
    mockReadThread.mockResolvedValue({
      id: "thread-1",
      title: "会话",
      preview: "",
      cwd: "C:\\repo",
      modelProvider: "custom",
      status: "active",
      updatedAt: 1,
      lastTurnId: "turn-1",
      timeline: []
    });
  });

  it("把 additionalContext 从 HTTP body 转发给 app-server", async () => {
    const { POST } = await import("../../src/app/api/codex/turns/start/route");
    const additionalContext = {
      "codex-web:test": {
        kind: "application" as const,
        value: "context value"
      }
    };

    const response = await POST(
      new Request("http://localhost/api/codex/turns/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          threadId: "thread-1",
          text: "请规划",
          reasoningSummary: "auto",
          additionalContext,
          collaborationMode: {
            mode: "plan",
            settings: {
              model: "gpt-5-codex",
              reasoning_effort: null,
              developer_instructions: null
            }
          }
        })
      })
    );

    expect(response.status).toBe(200);
    expect(mockStartTurn).toHaveBeenCalledWith(
      expect.objectContaining({
        threadId: "thread-1",
        text: "请规划",
        reasoningSummary: "auto",
        additionalContext,
        collaborationMode: expect.objectContaining({ mode: "plan" })
      })
    );
  });

  it("turn/start 后返回 readThread 提供的空会话详情", async () => {
    const { POST } = await import("../../src/app/api/codex/turns/start/route");
    mockReadThread.mockResolvedValueOnce({
      id: "thread-1",
      title: "新会话",
      preview: "",
      cwd: "C:\\repo",
      modelProvider: "custom",
      status: "idle",
      updatedAt: 1,
      lastTurnId: null,
      timeline: []
    });

    const response = await POST(
      new Request("http://localhost/api/codex/turns/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          threadId: "thread-1",
          text: "第一条消息"
        })
      })
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(mockReadThread).toHaveBeenCalledWith("thread-1");
    expect(json.thread).toMatchObject({
      id: "thread-1",
      timeline: [],
      lastTurnId: null
    });
  });

  it("同一个 clientUserMessageId 的并发重复请求只启动一次 turn", async () => {
    const { POST } = await import("../../src/app/api/codex/turns/start/route");
    const requestBody = {
      threadId: "thread-1",
      text: "不要放大",
      clientUserMessageId: "local-user-1"
    };

    const [first, second] = await Promise.all([
      POST(
        new Request("http://localhost/api/codex/turns/start", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(requestBody)
        })
      ),
      POST(
        new Request("http://localhost/api/codex/turns/start", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(requestBody)
        })
      )
    ]);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(mockStartTurn).toHaveBeenCalledTimes(1);
    expect(mockReadThread).toHaveBeenCalledTimes(1);
    await expect(first.json()).resolves.toMatchObject({ turnId: "turn-1" });
    await expect(second.json()).resolves.toMatchObject({ turnId: "turn-1" });
  });
});
