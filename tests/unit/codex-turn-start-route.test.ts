import { beforeEach, describe, expect, it, vi } from "vitest";

const mockStartTurn = vi.fn();
const mockReadThread = vi.fn();
const mockReadThreadSummary = vi.fn();
const mockListSkills = vi.fn();
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
    readThread: (...args: unknown[]) => mockReadThread(...args),
    readThreadSummary: (...args: unknown[]) => mockReadThreadSummary(...args),
    listSkills: (...args: unknown[]) => mockListSkills(...args)
  })
}));

describe("codex turn start route", () => {
  beforeEach(() => {
    vi.resetModules();
    mockStartTurn.mockReset();
    mockReadThread.mockReset();
    mockReadThreadSummary.mockReset();
    mockListSkills.mockReset();
    mockAudit.mockReset();
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

  it("把 permissions null 从 HTTP body 转发给 app-server", async () => {
    const { POST } = await import("../../src/app/api/codex/turns/start/route");

    const response = await POST(
      new Request("http://localhost/api/codex/turns/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          threadId: "thread-1",
          text: "回到配置默认权限",
          permissions: null
        })
      })
    );

    expect(response.status).toBe(200);
    expect(mockStartTurn).toHaveBeenCalledWith(
      expect.objectContaining({
        threadId: "thread-1",
        text: "回到配置默认权限",
        permissions: null
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

  it("同一个 clientUserMessageId 启动失败后释放缓存并允许重试", async () => {
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

    expect(failed.status).toBe(502);
    expect(retried.status).toBe(200);
    expect(mockStartTurn).toHaveBeenCalledTimes(2);
    await expect(retried.json()).resolves.toMatchObject({ turnId: "turn-after-retry" });
  });
});
