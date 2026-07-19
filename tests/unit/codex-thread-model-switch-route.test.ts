import { beforeEach, describe, expect, it, vi } from "vitest";
import { ThreadModelSwitchConflictError } from "../../src/server/custom-models/switch-service";
import type { ThreadModelStateView } from "../../src/shared/custom-models";

const mockAuthenticated = vi.fn(() => true);
const mockAudit = vi.fn();
const mockSwitchModel = vi.fn();
const mockRecoverPendingOperation = vi.fn();

vi.mock("../../src/server/auth", () => ({
  isRequestAuthenticated: () => mockAuthenticated()
}));

vi.mock("../../src/server/security", () => ({
  assertRuntimePathAllowed: (path: string) => path,
  assertRuntimeWorkspaceRootsAllowed: (roots: string[]) => roots,
  audit: (...args: unknown[]) => mockAudit(...args)
}));

vi.mock("../../src/server/custom-models/runtime", () => ({
  getThreadModelSwitchService: () => ({
    switchModel: (...args: unknown[]) => mockSwitchModel(...args),
    recoverPendingOperation: (...args: unknown[]) => mockRecoverPendingOperation(...args)
  })
}));

function request(pathname: string, body: unknown): Request {
  return new Request(`http://localhost${pathname}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}

function switchBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    target: { source: "custom", customModelId: "custom-1" },
    expectedCatalogRevision: 3,
    expectedCurrent: {
      selection: { source: "app-server", model: "gpt-5.6-sol" },
      reasoningEffort: "high",
      bindingVersion: null
    },
    ...overrides
  };
}

const latestState: ThreadModelStateView = {
  selection: { source: "custom", customModelId: "custom-1" },
  model: "mimo-v2.5-pro",
  label: "MIMO",
  contextWindow: 200_000,
  inputModalities: ["text"],
  supportedReasoningEfforts: [],
  defaultReasoningEffort: null,
  reasoningEffort: null,
  bindingVersion: "binding-1",
  sourceUpdatedAt: "2026-07-18T00:00:00.000Z",
  blocked: false,
  operationId: null
};

describe("thread model switch routes", () => {
  beforeEach(() => {
    vi.resetModules();
    mockAuthenticated.mockReset();
    mockAuthenticated.mockReturnValue(true);
    mockAudit.mockReset();
    mockAudit.mockResolvedValue(undefined);
    mockSwitchModel.mockReset();
    mockRecoverPendingOperation.mockReset();
  });

  it("switch 和 recover 均要求认证", async () => {
    mockAuthenticated.mockReturnValue(false);
    const switchRoute = await import("../../src/app/api/codex/threads/[threadId]/model/switch/route");
    const recoverRoute = await import("../../src/app/api/codex/threads/[threadId]/model/recover/route");
    const context = { params: Promise.resolve({ threadId: "thread-1" }) };

    expect((await switchRoute.POST(request("/switch", switchBody()), context)).status).toBe(401);
    expect((await recoverRoute.POST(request("/recover", { action: "restore-old" }), context)).status).toBe(401);
    expect(mockSwitchModel).not.toHaveBeenCalled();
  });

  it("拒绝 malformed JSON、字符串推断和未知字段", async () => {
    const { POST } = await import("../../src/app/api/codex/threads/[threadId]/model/switch/route");
    const context = { params: Promise.resolve({ threadId: "thread-1" }) };
    const malformed = new Request("http://localhost/switch", { method: "POST", body: "{" });

    expect((await POST(malformed, context)).status).toBe(400);
    expect((await POST(request("/switch", switchBody({ target: "mimo-v2.5-pro" })), context)).status).toBe(400);
    expect((await POST(request("/switch", switchBody({ provider: "injected" })), context)).status).toBe(400);
    expect(mockSwitchModel).not.toHaveBeenCalled();
  });

  it("200 switched 仅在服务终态后返回完整状态", async () => {
    mockSwitchModel.mockImplementation(async (_threadId, _input, operationId) => ({
      httpStatus: 200,
      outcome: "switched",
      operationId,
      thread: { id: "thread-1" },
      latestState
    }));
    const { POST } = await import("../../src/app/api/codex/threads/[threadId]/model/switch/route");
    const response = await POST(request("/switch", switchBody()), {
      params: Promise.resolve({ threadId: "thread-1" })
    });

    expect(response.status).toBe(200);
    expect(mockSwitchModel).toHaveBeenCalledWith(
      "thread-1",
      expect.objectContaining({
        target: { source: "custom", customModelId: "custom-1" },
        expectedCatalogRevision: 3
      }),
      expect.any(String)
    );
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      outcome: "switched",
      operationId: expect.any(String),
      latestState
    });
    const requestAudit = mockAudit.mock.calls.find(([action]) => action === "thread.model.switch.request");
    const resultAudit = mockAudit.mock.calls.find(([action]) => action === "thread.model.switch.result");
    expect(requestAudit?.[1]).toMatchObject({
      operationId: expect.any(String),
      threadId: "thread-1",
      expectedCatalogRevision: 3,
      expectedCurrent: switchBody().expectedCurrent,
      target: switchBody().target
    });
    expect(resultAudit?.[1]).toMatchObject({
      operationId: requestAudit?.[1].operationId,
      threadId: "thread-1",
      outcome: "switched",
      old: switchBody().expectedCurrent,
      target: latestState.selection,
      bindingVersion: "binding-1",
      reasoningEffort: null,
      contextWindow: 200_000
    });
  });

  it("过期前置条件返回 409、稳定 code、operationId 和最新状态", async () => {
    mockSwitchModel.mockRejectedValue(
      new ThreadModelSwitchConflictError(
        "CURRENT_MODEL_STALE",
        "operation-conflict",
        latestState,
        { revision: 4, models: [] },
        "会话当前模型状态已变化"
      )
    );
    const { POST } = await import("../../src/app/api/codex/threads/[threadId]/model/switch/route");
    const response = await POST(request("/switch", switchBody()), {
      params: Promise.resolve({ threadId: "thread-1" })
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      code: "CURRENT_MODEL_STALE",
      operationId: "operation-conflict",
      latestState,
      catalog: { revision: 4, models: [] }
    });
  });

  it.each([
    [502, "recovered", "SWITCH_TARGET_FAILED"],
    [500, "recovery_failed", "SWITCH_RECOVERY_FAILED"]
  ])("终态 %s/%s 保留结构化 body", async (httpStatus, outcome, code) => {
    mockSwitchModel.mockResolvedValue({
      httpStatus,
      outcome,
      code,
      operationId: "operation-failed",
      thread: outcome === "recovered" ? { id: "thread-1" } : null,
      latestState: { ...latestState, blocked: outcome === "recovery_failed" },
      error: "clean summary"
    });
    const { POST } = await import("../../src/app/api/codex/threads/[threadId]/model/switch/route");
    const response = await POST(request("/switch", switchBody()), {
      params: Promise.resolve({ threadId: "thread-1" })
    });

    expect(response.status).toBe(httpStatus);
    await expect(response.json()).resolves.toMatchObject({ ok: false, outcome, code, operationId: "operation-failed" });
  });

  it("恢复 API 只允许 restore-old/retry-target 并返回服务终态", async () => {
    mockRecoverPendingOperation.mockResolvedValue({
      httpStatus: 200,
      outcome: "recovered",
      operationId: "operation-residual",
      thread: { id: "thread-1" },
      latestState
    });
    const { POST } = await import("../../src/app/api/codex/threads/[threadId]/model/recover/route");
    const context = { params: Promise.resolve({ threadId: "thread-1" }) };

    expect((await POST(request("/recover", { action: "ignore" }), context)).status).toBe(400);
    const response = await POST(request("/recover", { action: "restore-old" }), context);
    expect(response.status).toBe(200);
    expect(mockRecoverPendingOperation).toHaveBeenCalledWith("thread-1", "restore-old");
    await expect(response.json()).resolves.toMatchObject({ ok: true, outcome: "recovered" });
    expect(mockAudit).toHaveBeenCalledWith("thread.model.binding.recover", expect.objectContaining({
      operationId: "operation-residual",
      threadId: "thread-1",
      action: "restore-old",
      outcome: "recovered",
      bindingVersion: "binding-1"
    }));
  });
});
