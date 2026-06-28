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
        additionalContext,
        collaborationMode: expect.objectContaining({ mode: "plan" })
      })
    );
  });
});
