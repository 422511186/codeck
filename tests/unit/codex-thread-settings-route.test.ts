import { beforeEach, describe, expect, it, vi } from "vitest";

const mockUpdateThreadSettings = vi.fn();
const mockAudit = vi.fn();

vi.mock("../../src/server/auth", () => ({
  isRequestAuthenticated: () => true
}));

vi.mock("../../src/server/security", () => ({
  audit: (...args: unknown[]) => mockAudit(...args)
}));

vi.mock("../../src/server/app-server/runtime", () => ({
  getAppServerGateway: () => ({
    updateThreadSettings: (...args: unknown[]) => mockUpdateThreadSettings(...args)
  })
}));

describe("codex thread settings route", () => {
  beforeEach(() => {
    vi.resetModules();
    mockUpdateThreadSettings.mockReset();
    mockAudit.mockReset();
    mockUpdateThreadSettings.mockResolvedValue(undefined);
  });

  it("把权限 payload 从 HTTP body 转发给 app-server", async () => {
    const { POST } = await import("../../src/app/api/codex/threads/[threadId]/settings/route");

    const response = await POST(
      new Request("http://localhost/api/codex/threads/thread-1/settings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          permissions: ":workspace",
          approvalsReviewer: "auto_review"
        })
      }),
      { params: Promise.resolve({ threadId: "thread-1" }) }
    );

    expect(response.status).toBe(200);
    expect(mockUpdateThreadSettings).toHaveBeenCalledWith({
      threadId: "thread-1",
      model: undefined,
      reasoningEffort: undefined,
      permissions: ":workspace",
      approvalsReviewer: "auto_review",
      collaborationMode: undefined
    });
  });

  it("把 approvalsReviewer null 转发给 app-server 以清除 reviewer override", async () => {
    const { POST } = await import("../../src/app/api/codex/threads/[threadId]/settings/route");

    const response = await POST(
      new Request("http://localhost/api/codex/threads/thread-1/settings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          permissions: null,
          approvalsReviewer: null
        })
      }),
      { params: Promise.resolve({ threadId: "thread-1" }) }
    );

    expect(response.status).toBe(200);
    expect(mockUpdateThreadSettings).toHaveBeenCalledWith({
      threadId: "thread-1",
      model: undefined,
      reasoningEffort: undefined,
      permissions: null,
      approvalsReviewer: null,
      collaborationMode: undefined
    });
  });
});
