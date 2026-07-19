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

vi.mock("../../src/server/custom-models/runtime", () => ({
  getThreadModelLifecycleService: () => ({
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
          approvalPolicy: "on-request",
          approvalsReviewer: "auto_review"
        })
      }),
      { params: Promise.resolve({ threadId: "thread-1" }) }
    );

    expect(response.status).toBe(200);
    expect(mockUpdateThreadSettings).toHaveBeenCalledWith({
      threadId: "thread-1",
      reasoningEffort: undefined,
      permissions: ":workspace",
      approvalPolicy: "on-request",
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
          approvalPolicy: null,
          approvalsReviewer: null
        })
      }),
      { params: Promise.resolve({ threadId: "thread-1" }) }
    );

    expect(response.status).toBe(200);
    expect(mockUpdateThreadSettings).toHaveBeenCalledWith({
      threadId: "thread-1",
      reasoningEffort: undefined,
      permissions: null,
      approvalPolicy: null,
      approvalsReviewer: null,
      collaborationMode: undefined
    });
  });

  it("明确拒绝 model 字段且不调用 app-server", async () => {
    const { POST } = await import("../../src/app/api/codex/threads/[threadId]/settings/route");
    const response = await POST(
      new Request("http://localhost/api/codex/threads/thread-1/settings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ model: "mimo-v2.5-pro" })
      }),
      { params: Promise.resolve({ threadId: "thread-1" }) }
    );

    expect(response.status).toBe(400);
    expect(mockUpdateThreadSettings).not.toHaveBeenCalled();
  });

  it("reasoning 更新交给 binding-aware 生命周期服务", async () => {
    mockUpdateThreadSettings.mockResolvedValueOnce({
      operationId: "operation-reasoning",
      bindingVersion: "binding-2",
      reasoningEffort: "xhigh"
    });
    const { POST } = await import("../../src/app/api/codex/threads/[threadId]/settings/route");
    const response = await POST(
      new Request("http://localhost/api/codex/threads/thread-1/settings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reasoningEffort: "xhigh" })
      }),
      { params: Promise.resolve({ threadId: "thread-1" }) }
    );

    expect(response.status).toBe(200);
    expect(mockUpdateThreadSettings).toHaveBeenCalledWith({
      threadId: "thread-1",
      reasoningEffort: "xhigh",
      permissions: undefined,
      approvalPolicy: undefined,
      approvalsReviewer: undefined,
      collaborationMode: undefined
    });
    expect(mockAudit).toHaveBeenCalledWith("thread.model.binding.update", {
      threadId: "thread-1",
      operationId: "operation-reasoning",
      bindingVersion: "binding-2",
      reasoningEffort: "xhigh"
    });
  });

  it("拒绝非法 approvalPolicy 且不调用 app-server", async () => {
    const { POST } = await import("../../src/app/api/codex/threads/[threadId]/settings/route");
    const response = await POST(
      new Request("http://localhost/api/codex/threads/thread-1/settings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          permissions: ":danger-full-access",
          approvalPolicy: "always",
          approvalsReviewer: null
        })
      }),
      { params: Promise.resolve({ threadId: "thread-1" }) }
    );

    expect(response.status).toBe(400);
    expect(mockUpdateThreadSettings).not.toHaveBeenCalled();
  });
});
