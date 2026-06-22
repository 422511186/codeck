import { describe, expect, it } from "vitest";
import { createAppServerGateway } from "../../src/server/app-server/runtime";

describe("createAppServerGateway", () => {
  it("mock 模式可以初始化并返回移动端基础数据", async () => {
    const gateway = createAppServerGateway({ mode: "mock" });

    await gateway.ensureReady();

    expect(gateway.getStatus().state).toBe("ready");
    await expect(gateway.listThreads({ limit: 10 })).resolves.toMatchObject({
      threads: [
        {
          id: "mock-thread-1",
          title: "示例会话",
          status: "idle"
        }
      ],
      nextCursor: null
    });
    await expect(gateway.listModels()).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "gpt-5-codex",
          label: "GPT-5 Codex",
          isDefault: true
        })
      ])
    );
  });

  it("off 模式会保留 disabled 状态并拒绝请求", async () => {
    const gateway = createAppServerGateway({ mode: "off" });

    expect(gateway.getStatus()).toEqual({ state: "disabled" });
    await expect(gateway.listThreads()).rejects.toThrow("app-server 已关闭");
  });

  it("mock 模式发送消息时会广播规范化 realtime 事件", async () => {
    const gateway = createAppServerGateway({ mode: "mock" });
    const events: unknown[] = [];

    gateway.onBrowserEvent((event) => events.push(event));
    await gateway.ensureReady();
    await gateway.startTurn({ threadId: "mock-thread-1", text: "实时流测试" });
    await new Promise((resolve) => setTimeout(resolve, 40));

    expect(events).toContainEqual({
      type: "codex-event",
      event: {
        kind: "agent_message_delta",
        threadId: "mock-thread-1",
        turnId: "mock-turn-2",
        itemId: "mock-live-4",
        delta: "实时事件：实时流测试"
      }
    });
    expect(events).toContainEqual({
      type: "codex-event",
      event: {
        kind: "reasoning_delta",
        threadId: "mock-thread-1",
        turnId: "mock-turn-2",
        itemId: "mock-reasoning-4",
        delta: "思考：实时流测试"
      }
    });
    expect(events).toContainEqual({
      type: "codex-event",
      event: {
        kind: "plan_delta",
        threadId: "mock-thread-1",
        turnId: "mock-turn-2",
        itemId: "mock-plan-4",
        delta: "计划：整理请求并生成回复"
      }
    });
    expect(events).toContainEqual({
      type: "codex-event",
      event: {
        kind: "command_output_delta",
        threadId: "mock-thread-1",
        turnId: "mock-turn-2",
        itemId: "mock-command-4",
        delta: "命令输出：mock 完成"
      }
    });
    expect(events).toContainEqual({
      type: "codex-event",
      event: {
        kind: "turn_diff_updated",
        threadId: "mock-thread-1",
        turnId: "mock-turn-2",
        diff: "diff --git a/mock.txt b/mock.txt"
      }
    });
    expect(events).toContainEqual({
      type: "codex-event",
      event: {
        kind: "file_output_delta",
        threadId: "mock-thread-1",
        turnId: "mock-turn-2",
        itemId: "mock-file-4",
        delta: "文件输出：mock.txt 已更新"
      }
    });
    expect(events).toContainEqual({
      type: "codex-event",
      event: {
        kind: "token_usage_updated",
        threadId: "mock-thread-1",
        turnId: "mock-turn-2",
        totalTokens: 128,
        inputTokens: 48,
        outputTokens: 64,
        reasoningOutputTokens: 16,
        modelContextWindow: 200000
      }
    });
  });

  it("mock 模式收到 server request 时会进入 pending 队列并广播给浏览器", async () => {
    const gateway = createAppServerGateway({ mode: "mock" });
    const events: unknown[] = [];

    gateway.onBrowserEvent((event) => events.push(event));
    await gateway.ensureReady();
    await gateway.startTurn({ threadId: "mock-thread-1", text: "审批测试" });
    await new Promise((resolve) => setTimeout(resolve, 40));

    expect(gateway.listPendingServerRequests()).toHaveLength(1);
    expect(events).toContainEqual({
      type: "server-request",
      request: expect.objectContaining({
        requestId: 1,
        kind: "command_approval",
        title: "命令审批",
        description: "npm test"
      })
    });

    await gateway.resolveServerRequest(1, { decision: "accept" });

    expect(gateway.listPendingServerRequests()).toEqual([]);
    expect(events).toContainEqual({ type: "server-request-resolved", requestId: 1 });
  });

  it("mock 模式支持 fork、rollback、interrupt 和 steer", async () => {
    const gateway = createAppServerGateway({ mode: "mock" });
    await gateway.ensureReady();

    const forked = await gateway.forkThread("mock-thread-1");
    expect(forked.id).not.toBe("mock-thread-1");

    await gateway.startTurn({ threadId: forked.id, text: "需要回滚" });
    const rolledBack = await gateway.rollbackThread(forked.id, 1);
    expect(rolledBack.timeline.some((item) => item.text.includes("需要回滚"))).toBe(false);

    await expect(gateway.interruptTurn(forked.id, rolledBack.lastTurnId || "mock-turn-1")).resolves.toBeUndefined();
    await expect(
      gateway.steerTurn({ threadId: forked.id, expectedTurnId: rolledBack.lastTurnId || "mock-turn-1", text: "请继续" })
    ).resolves.toMatchObject({ turnId: expect.any(String) });
  });

  it("mock 模式支持文件、终端和设置面板所需数据", async () => {
    const gateway = createAppServerGateway({ mode: "mock" });
    await gateway.ensureReady();

    await expect(gateway.readDirectory("C:\\Users\\huang\\workspace")).resolves.toEqual([
      {
        name: "src",
        path: "C:\\Users\\huang\\workspace\\src",
        isDirectory: true,
        isFile: false
      },
      {
        name: "README.md",
        path: "C:\\Users\\huang\\workspace\\README.md",
        isDirectory: false,
        isFile: true
      }
    ]);
    await expect(gateway.readFile("C:\\Users\\huang\\workspace\\README.md")).resolves.toEqual({
      path: "C:\\Users\\huang\\workspace\\README.md",
      text: "# Codex Web\n\n移动端 Web 工作台 mock 文件。"
    });
    await expect(gateway.execCommand({ command: ["npm", "--version"], cwd: "C:\\Users\\huang\\workspace" })).resolves.toEqual({
      exitCode: 0,
      stdout: "mock command: npm --version\ncwd: C:\\Users\\huang\\workspace",
      stderr: ""
    });
    await expect(gateway.readSettings()).resolves.toEqual({
      model: "gpt-5-codex",
      modelProvider: "openai",
      reasoningEffort: "medium",
      approvalPolicy: "untrusted",
      sandboxMode: "workspace-write",
      remoteControlStatus: "connected",
      account: {
        type: "chatgpt",
        email: "dev@example.com",
        planType: "pro",
        requiresOpenaiAuth: false
      },
      rateLimit: {
        limitId: "codex",
        limitName: "Codex",
        usedPercent: 42,
        windowDurationMins: 300,
        resetsAt: 1_800_000_000
      },
      providerCapabilities: {
        namespaceTools: true,
        imageGeneration: true,
        webSearch: false
      },
      remoteControlClients: [
        {
          clientId: "mock-phone",
          displayName: "手机浏览器",
          deviceType: "phone",
          platform: "web",
          lastSeenAt: 1_800_000_001
        }
      ],
      mcpServers: [
        {
          name: "filesystem",
          authStatus: "bearerToken",
          toolCount: 2,
          resourceCount: 1,
          resourceTemplateCount: 0
        },
        {
          name: "github",
          authStatus: "notLoggedIn",
          toolCount: 1,
          resourceCount: 0,
          resourceTemplateCount: 0
        }
      ],
      collaborationModes: [
        { name: "Code", mode: "default", model: "gpt-5-codex", reasoningEffort: "medium" },
        { name: "Ask", mode: "ask", model: null, reasoningEffort: null }
      ],
      permissionProfiles: [
        { id: "default", label: "default", description: "默认权限配置" },
        { id: "read-only", label: "read-only", description: "只读工作区" },
        { id: "full-auto", label: "full-auto", description: "允许自动执行" }
      ]
    });
  });

  it("mock 模式支持 turns 和 items 分页读取", async () => {
    const gateway = createAppServerGateway({ mode: "mock" });
    await gateway.ensureReady();

    await expect(gateway.listThreadTurns({ threadId: "mock-thread-1", limit: 1 })).resolves.toMatchObject({
      items: expect.arrayContaining([expect.objectContaining({ role: "agent", text: expect.stringContaining("Codex app-server") })]),
      nextCursor: null
    });
    await expect(gateway.listThreadTurnItems({ threadId: "mock-thread-1", turnId: "mock-turn-1", limit: 2 })).resolves.toMatchObject({
      items: expect.arrayContaining([expect.objectContaining({ role: "agent", text: expect.stringContaining("Codex app-server") })]),
      nextCursor: null
    });
  });

  it("mock 模式支持搜索会话历史", async () => {
    const gateway = createAppServerGateway({ mode: "mock" });
    await gateway.ensureReady();

    await gateway.startThread({ model: "gpt-5-codex", permissions: "default" });

    await expect(gateway.searchThreads({ searchTerm: "示例", limit: 10 })).resolves.toMatchObject({
      threads: expect.arrayContaining([
        expect.objectContaining({
          id: "mock-thread-1",
          title: "示例会话",
          preview: expect.stringContaining("示例")
        })
      ]),
      nextCursor: null
    });
  });

  it("mock 模式支持 resume 会话并返回初始 timeline", async () => {
    const gateway = createAppServerGateway({ mode: "mock" });
    await gateway.ensureReady();

    await expect(gateway.resumeThread("mock-thread-1")).resolves.toMatchObject({
      id: "mock-thread-1",
      title: "示例会话",
      lastTurnId: "mock-turn-1",
      timeline: expect.arrayContaining([
        expect.objectContaining({ role: "user", text: "帮我看看当前项目" }),
        expect.objectContaining({ role: "agent", text: "我已经连上 Codex app-server，可以读取历史和模型。" })
      ])
    });
  });

  it("mock 模式支持设置和清除会话目标", async () => {
    const gateway = createAppServerGateway({ mode: "mock" });
    await gateway.ensureReady();

    await expect(
      gateway.setThreadGoal({ threadId: "mock-thread-1", objective: "手机端完整目标", tokenBudget: 9000 })
    ).resolves.toMatchObject({
      objective: "手机端完整目标",
      status: "active",
      tokenBudget: 9000
    });
    await expect(gateway.readThread("mock-thread-1")).resolves.toMatchObject({
      goal: expect.objectContaining({ objective: "手机端完整目标", tokenBudget: 9000 })
    });

    await expect(gateway.clearThreadGoal("mock-thread-1")).resolves.toBeUndefined();
    await expect(gateway.readThread("mock-thread-1")).resolves.toMatchObject({ goal: null });
  });

  it("mock 模式支持上下文压缩并广播事件", async () => {
    const gateway = createAppServerGateway({ mode: "mock" });
    const events: unknown[] = [];

    gateway.onBrowserEvent((event) => events.push(event));
    await gateway.ensureReady();
    await gateway.compactThread("mock-thread-1");

    expect(events).toContainEqual({
      type: "codex-event",
      event: {
        kind: "context_compacted",
        threadId: "mock-thread-1",
        turnId: "mock-turn-1"
      }
    });
  });

  it("mock 模式支持切换记忆模式和重置记忆", async () => {
    const gateway = createAppServerGateway({ mode: "mock" });
    await gateway.ensureReady();

    await expect(gateway.setThreadMemoryMode("mock-thread-1", "enabled")).resolves.toBeUndefined();
    await expect(gateway.resetMemory()).resolves.toBeUndefined();
  });

  it("mock 模式支持重命名当前会话", async () => {
    const gateway = createAppServerGateway({ mode: "mock" });
    await gateway.ensureReady();

    const thread = await gateway.setThreadName("mock-thread-1", "手机端新标题");

    expect(thread.title).toBe("手机端新标题");
    await expect(gateway.readThread("mock-thread-1")).resolves.toMatchObject({
      id: "mock-thread-1",
      title: "手机端新标题"
    });
  });

  it("mock 模式支持归档和删除会话后从历史移除", async () => {
    const gateway = createAppServerGateway({ mode: "mock" });
    await gateway.ensureReady();
    const newThread = await gateway.startThread({ model: "gpt-5-codex", permissions: "default" });

    await gateway.archiveThread(newThread.id);
    await expect(gateway.listThreads()).resolves.toMatchObject({
      threads: expect.not.arrayContaining([expect.objectContaining({ id: newThread.id })])
    });

    await gateway.deleteThread("mock-thread-1");
    await expect(gateway.listThreads()).resolves.toMatchObject({
      threads: expect.not.arrayContaining([expect.objectContaining({ id: "mock-thread-1" })])
    });
  });
});
