import { beforeEach, describe, expect, it, vi } from "vitest";

const mockStartTurn = vi.fn();
const mockReadThread = vi.fn();
const mockReadThreadSummary = vi.fn();
const mockListThreadTurns = vi.fn();
const mockListSkills = vi.fn();
const mockAudit = vi.fn();
const mockEnsureThreadReady = vi.fn();
const mockInspectCanonicalRegularFile = vi.fn();
let mockBootId = "boot-a";

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
    getTimelineBootId: () => mockBootId,
    readThread: (...args: unknown[]) => mockReadThread(...args),
    readThreadSummary: (...args: unknown[]) => mockReadThreadSummary(...args),
    listThreadTurns: (...args: unknown[]) => mockListThreadTurns(...args),
    listSkills: (...args: unknown[]) => mockListSkills(...args)
  })
}));

vi.mock("../../src/server/custom-models/runtime", () => ({
  getThreadModelLifecycleService: () => ({
    ensureThreadReady: (...args: unknown[]) => mockEnsureThreadReady(...args)
  })
}));

vi.mock("../../src/server/uploads", () => ({
  inspectCanonicalRegularFile: (...args: unknown[]) => mockInspectCanonicalRegularFile(...args)
}));

describe("codex turn start route", () => {
  beforeEach(() => {
    vi.resetModules();
    mockStartTurn.mockReset();
    mockReadThread.mockReset();
    mockReadThreadSummary.mockReset();
    mockListThreadTurns.mockReset();
    mockListSkills.mockReset();
    mockAudit.mockReset();
    mockEnsureThreadReady.mockReset();
    mockInspectCanonicalRegularFile.mockReset();
    mockEnsureThreadReady.mockResolvedValue(undefined);
    mockInspectCanonicalRegularFile.mockImplementation(async (path: string) => ({ path, size: 1 }));
    mockBootId = "boot-a";
    mockStartTurn.mockResolvedValue({ turnId: "turn-1" });
    mockListSkills.mockResolvedValue({
      skills: [
        {
          cwd: "C:\\repo",
          name: "openai-docs",
          path: "C:\\Users\\huang\\.codex\\skills\\openai-docs\\SKILL.md",
          description: "查询 OpenAI 官方文档",
          shortDescription: "OpenAI 文档",
          scope: "user",
          enabled: true
        }
      ],
      skillErrors: []
    });
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
    mockReadThreadSummary.mockResolvedValue({
      id: "thread-1",
      title: "会话",
      preview: "",
      cwd: "C:\\repo",
      modelProvider: "custom",
      status: "active",
      updatedAt: 1
    });
    mockListThreadTurns.mockResolvedValue({ items: [], nextCursor: null });
  });

  it("pending operation 恢复失败时在 turn/start 前返回阻塞终态", async () => {
    mockEnsureThreadReady.mockRejectedValue({
      code: "SWITCH_RECOVERY_FAILED",
      httpStatus: 500,
      result: {
        outcome: "recovery_failed",
        operationId: "operation-1",
        latestState: { blocked: true }
      }
    });
    const { POST } = await import("../../src/app/api/codex/turns/start/route");
    const response = await POST(
      new Request("http://localhost/api/codex/turns/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ threadId: "thread-1", text: "不能发送" })
      })
    );

    expect(response.status).toBe(500);
    expect(mockStartTurn).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      code: "START_REJECTED",
      recoveryCode: "SWITCH_RECOVERY_FAILED",
      outcome: "recovery_failed",
      operationId: "operation-1",
      latestState: { blocked: true }
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

  it("turn/start 后不再立即读取完整会话详情", async () => {
    const { POST } = await import("../../src/app/api/codex/turns/start/route");

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
    expect(mockReadThread).not.toHaveBeenCalled();
    expect(mockReadThreadSummary).not.toHaveBeenCalled();
    expect(json).toMatchObject({ ok: true, turnId: "turn-1" });
    expect(json.thread).toBeUndefined();
  });

  it("把权限 payload 从 HTTP body 转发给 app-server", async () => {
    const { POST } = await import("../../src/app/api/codex/turns/start/route");

    const response = await POST(
      new Request("http://localhost/api/codex/turns/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          threadId: "thread-1",
          text: "替我审批",
          permissions: ":workspace",
          approvalPolicy: "on-request",
          approvalsReviewer: "auto_review"
        })
      })
    );

    expect(response.status).toBe(200);
    expect(mockStartTurn).toHaveBeenCalledWith(
      expect.objectContaining({
        threadId: "thread-1",
        text: "替我审批",
        permissions: ":workspace",
        approvalPolicy: "on-request",
        approvalsReviewer: "auto_review"
      })
    );
  });

  it("把 permissions null 和 approvalsReviewer null 从 HTTP body 转发给 app-server", async () => {
    const { POST } = await import("../../src/app/api/codex/turns/start/route");

    const response = await POST(
      new Request("http://localhost/api/codex/turns/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          threadId: "thread-1",
          text: "回到配置默认权限",
          permissions: null,
          approvalPolicy: null,
          approvalsReviewer: null
        })
      })
    );

    expect(response.status).toBe(200);
    expect(mockStartTurn).toHaveBeenCalledWith(
      expect.objectContaining({
        threadId: "thread-1",
        text: "回到配置默认权限",
        permissions: null,
        approvalPolicy: null,
        approvalsReviewer: null
      })
    );
  });

  it("校验并转发结构化 Skill 引用", async () => {
    const { POST } = await import("../../src/app/api/codex/turns/start/route");

    const response = await POST(
      new Request("http://localhost/api/codex/turns/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          threadId: "thread-1",
          text: "查文档",
          skillReferences: [
            {
              name: "openai-docs",
              path: "C:\\Users\\huang\\.codex\\skills\\openai-docs\\SKILL.md"
            }
          ]
        })
      })
    );

    expect(response.status).toBe(200);
    expect(mockReadThreadSummary).toHaveBeenCalledWith("thread-1");
    expect(mockListSkills).toHaveBeenCalledWith({ enabledOnly: true, cwds: ["C:\\repo"] });
    expect(mockStartTurn).toHaveBeenCalledWith(
      expect.objectContaining({
        skillReferences: [
          {
            name: "openai-docs",
            path: "C:\\Users\\huang\\.codex\\skills\\openai-docs\\SKILL.md"
          }
        ]
      })
    );
  });

  it("拒绝不可用的 Skill 引用", async () => {
    const { POST } = await import("../../src/app/api/codex/turns/start/route");

    const response = await POST(
      new Request("http://localhost/api/codex/turns/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          threadId: "thread-1",
          text: "查文档",
          skillReferences: [{ name: "missing", path: "C:\\missing\\SKILL.md" }]
        })
      })
    );

    expect(response.status).toBe(502);
    expect(mockReadThreadSummary).toHaveBeenCalledWith("thread-1");
    expect(mockListSkills).toHaveBeenCalledWith({ enabledOnly: true, cwds: ["C:\\repo"] });
    expect(mockStartTurn).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      code: "START_REJECTED",
      error: "Skill 不可用：missing"
    });
  });

  it("明确前置拒绝不污染幂等缓存且条件恢复后可重新提交同 identity", async () => {
    const { POST } = await import("../../src/app/api/codex/turns/start/route");
    const request = () => POST(new Request("http://localhost/api/codex/turns/start", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        threadId: "thread-1",
        text: "稍后启用 Skill",
        clientUserMessageId: "local-user-rejected",
        skillReferences: [{ name: "missing", path: "C:\\missing\\SKILL.md" }]
      })
    }));

    expect((await request()).status).toBe(502);
    expect(mockStartTurn).not.toHaveBeenCalled();
    mockListSkills.mockResolvedValueOnce({
      skills: [{ name: "missing", path: "C:\\missing\\SKILL.md", enabled: true }],
      skillErrors: []
    });

    const retried = await request();

    expect(retried.status).toBe(200);
    expect(mockStartTurn).toHaveBeenCalledTimes(1);
    await expect(retried.json()).resolves.toMatchObject({ turnId: "turn-1" });
  });

  it("审计写入失败是 confirmed rejection 且不会污染 operation cache", async () => {
    mockAudit.mockRejectedValueOnce(new Error("audit unavailable"));
    const { POST } = await import("../../src/app/api/codex/turns/start/route");
    const request = () => POST(new Request("http://localhost/api/codex/turns/start", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        threadId: "thread-1",
        text: "审计恢复后发送",
        clientUserMessageId: "local-user-audit-rejected"
      })
    }));

    const rejected = await request();
    expect(rejected.status).toBe(502);
    await expect(rejected.json()).resolves.toMatchObject({
      ok: false,
      code: "START_REJECTED",
      error: "audit unavailable"
    });
    expect(mockStartTurn).not.toHaveBeenCalled();

    const retried = await request();
    expect(retried.status).toBe(200);
    expect(mockAudit).toHaveBeenCalledTimes(2);
    expect(mockStartTurn).toHaveBeenCalledTimes(1);
  });

  it("resolved cache 命中不被后续审计状态阻断", async () => {
    const { POST } = await import("../../src/app/api/codex/turns/start/route");
    const request = () => POST(new Request("http://localhost/api/codex/turns/start", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        threadId: "thread-1",
        text: "复用已审计操作",
        clientUserMessageId: "local-user-audit-cache"
      })
    }));

    expect((await request()).status).toBe(200);
    mockAudit.mockRejectedValueOnce(new Error("audit became unavailable"));

    const repeated = await request();
    expect(repeated.status).toBe(200);
    expect(mockAudit).toHaveBeenCalledTimes(1);
    expect(mockStartTurn).toHaveBeenCalledTimes(1);
    await expect(repeated.json()).resolves.toMatchObject({ turnId: "turn-1" });
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
    expect(mockReadThread).not.toHaveBeenCalled();
    await expect(first.json()).resolves.toMatchObject({ turnId: "turn-1" });
    await expect(second.json()).resolves.toMatchObject({ turnId: "turn-1" });
  });

  it("同一个 clientUserMessageId 的串行重复请求复用已缓存 turn", async () => {
    const { POST } = await import("../../src/app/api/codex/turns/start/route");
    const request = () =>
      POST(
        new Request("http://localhost/api/codex/turns/start", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            threadId: "thread-1",
            text: "重复提交",
            clientUserMessageId: "local-user-serial"
          })
        })
      );

    const first = await request();
    const second = await request();

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(mockStartTurn).toHaveBeenCalledTimes(1);
    await expect(first.json()).resolves.toMatchObject({ turnId: "turn-1" });
    await expect(second.json()).resolves.toMatchObject({ turnId: "turn-1" });
  });

  it("resolved cache 命中不受重复请求时可变前置条件失效影响", async () => {
    const { POST } = await import("../../src/app/api/codex/turns/start/route");
    const request = () => POST(new Request("http://localhost/api/codex/turns/start", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        threadId: "thread-1",
        text: "复用已有结果",
        clientUserMessageId: "local-user-precondition-cache",
        skillReferences: [{
          name: "openai-docs",
          path: "C:\\Users\\huang\\.codex\\skills\\openai-docs\\SKILL.md"
        }]
      })
    }));

    expect((await request()).status).toBe(200);
    mockEnsureThreadReady.mockRejectedValueOnce(new Error("thread model now blocked"));
    mockListSkills.mockResolvedValueOnce({ skills: [], skillErrors: [] });

    const repeated = await request();

    expect(repeated.status).toBe(200);
    expect(mockStartTurn).toHaveBeenCalledTimes(1);
    expect(mockEnsureThreadReady).toHaveBeenCalledTimes(1);
    expect(mockListSkills).toHaveBeenCalledTimes(1);
    await expect(repeated.json()).resolves.toMatchObject({ turnId: "turn-1" });
  });

  it("gateway boot 改变后不直接复用旧 boot 的 resolved turn", async () => {
    const { POST } = await import("../../src/app/api/codex/turns/start/route");
    const request = () => POST(new Request("http://localhost/api/codex/turns/start", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        threadId: "thread-1",
        text: "跨 boot 重试已完成请求",
        clientUserMessageId: "local-user-resolved-cross-boot"
      })
    }));

    expect((await request()).status).toBe(200);
    mockBootId = "boot-b";

    const retried = await request();

    expect(retried.status).toBe(502);
    expect(mockStartTurn).toHaveBeenCalledTimes(1);
    expect(mockListThreadTurns).toHaveBeenCalledTimes(1);
    await expect(retried.json()).resolves.toMatchObject({
      error: expect.stringContaining("ambiguous-start-unresolved")
    });
  });

  it("cache miss 的 ambiguous retry 只查询有界历史且不启动新 turn", async () => {
    const { POST } = await import("../../src/app/api/codex/turns/start/route");
    const response = await POST(new Request("http://localhost/api/codex/turns/start", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        threadId: "thread-1",
        text: "Web 重启后的未决请求",
        clientUserMessageId: "local-user-cache-miss",
        startBootId: "boot-before-web-restart",
        retryAmbiguousStart: true
      })
    }));

    expect(response.status).toBe(502);
    expect(mockListThreadTurns).toHaveBeenCalledTimes(1);
    expect(mockStartTurn).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringContaining("ambiguous-start-unresolved")
    });
  });

  it("cache miss ambiguous recovery 不受已过期附件阻断", async () => {
    mockInspectCanonicalRegularFile.mockRejectedValueOnce(new Error("expired"));
    mockListThreadTurns.mockResolvedValueOnce({
      items: [{
        id: "persisted-user",
        turnId: "turn-with-expired-file",
        role: "user",
        text: "恢复含附件的发送",
        clientUserMessageId: "local-user-expired-file"
      }],
      nextCursor: null
    });
    const { POST } = await import("../../src/app/api/codex/turns/start/route");
    const response = await POST(new Request("http://localhost/api/codex/turns/start", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        threadId: "thread-1",
        text: "恢复含附件的发送",
        clientUserMessageId: "local-user-expired-file",
        startBootId: "boot-before-web-restart",
        retryAmbiguousStart: true,
        fileReferences: [{
          id: "file-1",
          name: "old.txt",
          path: "C:\\uploads\\old.txt",
          mimeType: "text/plain",
          size: 1
        }]
      })
    }));

    expect(response.status).toBe(200);
    expect(mockListThreadTurns).toHaveBeenCalledTimes(1);
    expect(mockInspectCanonicalRegularFile).not.toHaveBeenCalled();
    expect(mockStartTurn).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({ turnId: "turn-with-expired-file" });
  });

  it("旧 boot 的迟到 start 结果不覆盖新 boot 的恢复结果", async () => {
    const deferred: { resolve?: (value: { turnId: string }) => void } = {};
    mockStartTurn.mockReturnValueOnce(new Promise((resolve) => {
      deferred.resolve = resolve;
    }));
    const { POST } = await import("../../src/app/api/codex/turns/start/route");
    const request = () => POST(new Request("http://localhost/api/codex/turns/start", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        threadId: "thread-1",
        text: "迟到结果",
        clientUserMessageId: "local-user-stale-promise"
      })
    }));

    const firstPromise = request();
    await vi.waitFor(() => expect(mockStartTurn).toHaveBeenCalledTimes(1));
    mockBootId = "boot-b";
    mockListThreadTurns.mockResolvedValue({
      items: [{
        id: "persisted-user",
        turnId: "turn-recovered",
        role: "user",
        text: "迟到结果",
        clientUserMessageId: "local-user-stale-promise"
      }],
      nextCursor: null
    });

    const recoveredPromise = request();
    await vi.waitFor(() => expect(mockListThreadTurns).toHaveBeenCalledTimes(1));
    deferred.resolve?.({ turnId: "turn-stale" });
    const [first, recovered] = await Promise.all([firstPromise, recoveredPromise]);
    const cached = await request();

    expect(first.status).toBe(200);
    expect(recovered.status).toBe(200);
    expect(cached.status).toBe(200);
    await expect(first.json()).resolves.toMatchObject({ turnId: "turn-recovered" });
    await expect(recovered.json()).resolves.toMatchObject({ turnId: "turn-recovered" });
    await expect(cached.json()).resolves.toMatchObject({ turnId: "turn-recovered" });
    expect(mockStartTurn).toHaveBeenCalledTimes(1);
  });

  it("连续 boot recovery 被抢占时所有 waiter 都收敛到最新结果", async () => {
    const recoveryB: { resolve?: (value: unknown) => void } = {};
    const { POST } = await import("../../src/app/api/codex/turns/start/route");
    const request = () => POST(new Request("http://localhost/api/codex/turns/start", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        threadId: "thread-1",
        text: "连续重启",
        clientUserMessageId: "local-user-multi-boot",
        startBootId: "boot-a",
        retryAmbiguousStart: true
      })
    }));
    mockBootId = "boot-b";
    mockListThreadTurns.mockReturnValueOnce(new Promise((resolve) => {
      recoveryB.resolve = resolve;
    }));
    const bootBPromise = request();
    await vi.waitFor(() => expect(mockListThreadTurns).toHaveBeenCalledTimes(1));

    mockBootId = "boot-c";
    mockListThreadTurns.mockResolvedValueOnce({
      items: [{
        id: "persisted-user-c",
        turnId: "turn-c",
        role: "user",
        text: "连续重启",
        clientUserMessageId: "local-user-multi-boot"
      }],
      nextCursor: null
    });
    const bootCPromise = request();
    await vi.waitFor(() => expect(mockListThreadTurns).toHaveBeenCalledTimes(2));
    recoveryB.resolve?.({
      items: [{
        id: "persisted-user-b",
        turnId: "turn-b-stale",
        role: "user",
        text: "连续重启",
        clientUserMessageId: "local-user-multi-boot"
      }],
      nextCursor: null
    });

    const [bootB, bootC] = await Promise.all([bootBPromise, bootCPromise]);
    expect(bootB.status).toBe(200);
    expect(bootC.status).toBe(200);
    await expect(bootB.json()).resolves.toMatchObject({ turnId: "turn-c" });
    await expect(bootC.json()).resolves.toMatchObject({ turnId: "turn-c" });
    expect(mockStartTurn).not.toHaveBeenCalled();
  });

  it("同一个 clientUserMessageId 模糊失败后查询已持久化 turn 且不重复启动", async () => {
    const { POST } = await import("../../src/app/api/codex/turns/start/route");
    mockStartTurn
      .mockRejectedValueOnce(new Error("start failed"))
      .mockResolvedValueOnce({ turnId: "turn-after-retry" });
    const request = () =>
      POST(
        new Request("http://localhost/api/codex/turns/start", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            threadId: "thread-1",
            text: "失败后重试",
            clientUserMessageId: "local-user-retry"
          })
        })
      );

    const failed = await request();
    const retried = await request();
    mockListThreadTurns.mockResolvedValueOnce({
      items: [{
        id: "user-recovered",
        turnId: "turn-after-persistence",
        role: "user",
        text: "失败后重试",
        clientUserMessageId: "local-user-retry"
      }],
      nextCursor: null
    });
    const recovered = await request();

    expect(failed.status).toBe(502);
    expect(retried.status).toBe(502);
    expect(recovered.status).toBe(200);
    expect(mockStartTurn).toHaveBeenCalledTimes(1);
    expect(mockListThreadTurns).toHaveBeenCalledTimes(2);
    await expect(recovered.json()).resolves.toMatchObject({ turnId: "turn-after-persistence" });
  });

  it("gateway boot 改变后对未决发送动作失败关闭而不再次启动", async () => {
    const { POST } = await import("../../src/app/api/codex/turns/start/route");
    mockStartTurn.mockRejectedValueOnce(new Error("response timeout"));
    const request = () => POST(new Request("http://localhost/api/codex/turns/start", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        threadId: "thread-1",
        text: "可能已经发送",
        clientUserMessageId: "local-user-cross-boot"
      })
    }));

    expect((await request()).status).toBe(502);
    mockBootId = "boot-b";
    const retried = await request();

    expect(retried.status).toBe(502);
    expect(mockStartTurn).toHaveBeenCalledTimes(1);
    expect(mockListThreadTurns).toHaveBeenCalledTimes(1);
    await expect(retried.json()).resolves.toMatchObject({
      error: expect.stringContaining("ambiguous-start-unresolved")
    });
  });

  it("gateway boot 改变后可从 bounded latest page 唯一恢复原 turn", async () => {
    const { POST } = await import("../../src/app/api/codex/turns/start/route");
    mockStartTurn.mockRejectedValueOnce(new Error("response timeout"));
    const request = () => POST(new Request("http://localhost/api/codex/turns/start", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        threadId: "thread-1",
        text: "可恢复发送",
        clientUserMessageId: "local-user-cross-boot-recovered"
      })
    }));

    expect((await request()).status).toBe(502);
    mockBootId = "boot-b";
    mockListThreadTurns.mockResolvedValueOnce({
      items: [{
        id: "persisted-user",
        turnId: "turn-persisted",
        role: "user",
        text: "可恢复发送",
        clientUserMessageId: "local-user-cross-boot-recovered"
      }],
      nextCursor: null
    });

    const recovered = await request();

    expect(recovered.status).toBe(200);
    expect(mockStartTurn).toHaveBeenCalledTimes(1);
    await expect(recovered.json()).resolves.toMatchObject({ turnId: "turn-persisted" });
  });

  it("拒绝超过普通文件数量或聚合大小限制", async () => {
    const { POST } = await import("../../src/app/api/codex/turns/start/route");
    const files = Array.from({ length: 11 }, (_, index) => ({ id: String(index), name: `${index}.txt`, path: `C:/uploads/${index}.txt`, mimeType: "text/plain", size: 1 }));
    const response = await POST(new Request("http://localhost/api/codex/turns/start", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ threadId: "thread-1", text: "hello", fileReferences: files })
    }));
    expect(response.status).toBe(400);
    expect(mockStartTurn).not.toHaveBeenCalled();
  });

  it("将普通文件元数据纳入审计", async () => {
    const { POST } = await import("../../src/app/api/codex/turns/start/route");
    const response = await POST(new Request("http://localhost/api/codex/turns/start", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ threadId: "thread-1", text: "hello", fileReferences: [{ id: "a", name: "a.txt", path: "C:/uploads/a.txt", mimeType: "text/plain", size: 1 }] })
    }));
    expect(response.status).toBe(200);
    expect(mockAudit).toHaveBeenCalledWith("turn.start", expect.objectContaining({ fileCount: 1, fileBytes: 1, textLength: 5 }));
    expect(mockAudit).not.toHaveBeenCalledWith("turn.start", expect.objectContaining({ text: expect.any(String), fileNames: expect.anything() }));
  });
});
