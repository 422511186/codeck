import { beforeEach, describe, expect, it, vi } from "vitest";

const mockStartTurn = vi.fn();
const mockReadThread = vi.fn();
const mockReadThreadSummary = vi.fn();
const mockListThreadTurns = vi.fn();
const mockListSkills = vi.fn();
const mockAudit = vi.fn();
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

describe("codex turn start route", () => {
  beforeEach(() => {
    vi.resetModules();
    mockStartTurn.mockReset();
    mockReadThread.mockReset();
    mockReadThreadSummary.mockReset();
    mockListThreadTurns.mockReset();
    mockListSkills.mockReset();
    mockAudit.mockReset();
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
    await expect(response.json()).resolves.toMatchObject({ ok: false, error: "Skill 不可用：missing" });
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
});
