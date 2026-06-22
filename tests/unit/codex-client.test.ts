import { describe, expect, it } from "vitest";
import { CodexAppServerClient, type AppServerPeer } from "../../src/server/app-server/client";

class FakePeer implements AppServerPeer {
  readonly calls: Array<{ method: string; params: unknown }> = [];

  async request(method: string, params: unknown): Promise<unknown> {
    this.calls.push({ method, params });

    if (method === "initialize") {
      return {
        userAgent: "codex-test",
        codexHome: "C:\\Users\\huang\\.codex",
        platformFamily: "windows",
        platformOs: "windows"
      };
    }

    if (method === "thread/list") {
      return {
        data: [
          {
            id: "thread-1",
            sessionId: "session-1",
            forkedFromId: null,
            parentThreadId: null,
            preview: "帮我修复登录",
            ephemeral: false,
            modelProvider: "openai",
            createdAt: 100,
            updatedAt: 200,
            status: { type: "idle" },
            path: null,
            cwd: "C:\\Users\\huang\\workspace\\demo",
            cliVersion: "0.141.0",
            source: "vscode",
            threadSource: null,
            agentNickname: null,
            agentRole: null,
            gitInfo: null,
            name: "登录修复",
            turns: []
          }
        ],
        nextCursor: null,
        backwardsCursor: "prev"
      };
    }

    if (method === "thread/read") {
      return {
        thread: {
          id: "thread-1",
          sessionId: "session-1",
          forkedFromId: null,
          parentThreadId: null,
          preview: "帮我修复登录",
          ephemeral: false,
          modelProvider: "openai",
          createdAt: 100,
          updatedAt: 200,
          status: { type: "idle" },
          path: null,
          cwd: "C:\\Users\\huang\\workspace\\demo",
          cliVersion: "0.141.0",
          source: "vscode",
          threadSource: null,
          agentNickname: null,
          agentRole: null,
          gitInfo: null,
          name: "登录修复",
          turns: [
            {
              id: "turn-1",
              itemsView: { type: "complete" },
              status: { type: "completed" },
              error: null,
              startedAt: 101,
              completedAt: 199,
              durationMs: 98000,
              items: [
                {
                  type: "userMessage",
                  id: "item-user-1",
                  clientId: "client-user-1",
                  content: [{ type: "text", text: "请检查登录逻辑", text_elements: [] }]
                },
                {
                  type: "agentMessage",
                  id: "item-agent-1",
                  text: "我会先阅读认证相关代码。",
                  phase: "final",
                  memoryCitation: null
                }
              ]
            }
          ]
        }
      };
    }

    if (method === "thread/search") {
      return {
        data: [
          {
            thread: {
              id: "search-thread-1",
              sessionId: "search-session-1",
              forkedFromId: null,
              parentThreadId: null,
              preview: "搜索命中的预览",
              ephemeral: false,
              modelProvider: "openai",
              createdAt: 600,
              updatedAt: 700,
              status: { type: "idle" },
              path: null,
              cwd: "C:\\Users\\huang\\workspace\\demo",
              cliVersion: "0.141.0",
              source: "vscode",
              threadSource: null,
              agentNickname: null,
              agentRole: null,
              gitInfo: null,
              name: "搜索结果",
              turns: []
            },
            snippet: "命中片段"
          }
        ],
        nextCursor: "search-next",
        backwardsCursor: null
      };
    }

    if (method === "thread/resume") {
      return {
        thread: {
          id: "thread-1",
          sessionId: "session-1",
          forkedFromId: null,
          parentThreadId: null,
          preview: "帮我修复登录",
          ephemeral: false,
          modelProvider: "openai",
          createdAt: 100,
          updatedAt: 250,
          status: { type: "idle" },
          path: null,
          cwd: "C:\\Users\\huang\\workspace\\demo",
          cliVersion: "0.141.0",
          source: "vscode",
          threadSource: null,
          agentNickname: null,
          agentRole: null,
          gitInfo: null,
          name: "登录修复",
          turns: []
        },
        model: "gpt-5-codex",
        modelProvider: "openai",
        serviceTier: null,
        cwd: "C:\\Users\\huang\\workspace\\demo",
        runtimeWorkspaceRoots: ["C:\\Users\\huang\\workspace"],
        instructionSources: [],
        approvalPolicy: "untrusted",
        approvalsReviewer: "user",
        sandbox: { mode: "workspace-write" },
        activePermissionProfile: null,
        reasoningEffort: "medium",
        initialTurnsPage: {
          data: [
            {
              id: "turn-resume-1",
              itemsView: { type: "complete" },
              status: { type: "completed" },
              error: null,
              startedAt: 201,
              completedAt: 249,
              durationMs: 48000,
              items: [
                {
                  type: "userMessage",
                  id: "item-resume-user-1",
                  clientId: "client-resume-user-1",
                  content: [{ type: "text", text: "恢复这个会话", text_elements: [] }]
                },
                {
                  type: "agentMessage",
                  id: "item-resume-agent-1",
                  text: "已恢复会话。",
                  phase: "final",
                  memoryCitation: null
                }
              ]
            }
          ],
          nextCursor: "resume-next",
          backwardsCursor: null
        }
      };
    }

    if (method === "thread/turns/list") {
      return {
        data: [
          {
            id: "turn-page-1",
            itemsView: { type: "complete" },
            status: { type: "completed" },
            error: null,
            startedAt: 201,
            completedAt: 299,
            durationMs: 98000,
            items: [
              {
                type: "agentMessage",
                id: "item-page-agent-1",
                text: "分页 turn",
                phase: "final",
                memoryCitation: null
              }
            ]
          }
        ],
        nextCursor: "turn-next",
        backwardsCursor: "turn-prev"
      };
    }

    if (method === "thread/turns/items/list") {
      return {
        data: [
          {
            type: "agentMessage",
            id: "item-page-agent-2",
            text: "分页 item",
            phase: "final",
            memoryCitation: null
          }
        ],
        nextCursor: "item-next",
        backwardsCursor: "item-prev"
      };
    }

    if (method === "thread/start") {
      return {
        thread: {
          id: "new-thread-1",
          sessionId: "new-session-1",
          forkedFromId: null,
          parentThreadId: null,
          preview: "",
          ephemeral: false,
          modelProvider: "openai",
          createdAt: 300,
          updatedAt: 300,
          status: { type: "idle" },
          path: null,
          cwd: "C:\\Users\\huang\\workspace\\demo",
          cliVersion: "0.141.0",
          source: "appServer",
          threadSource: null,
          agentNickname: null,
          agentRole: null,
          gitInfo: null,
          name: null,
          turns: []
        },
        model: "gpt-5-codex",
        modelProvider: "openai",
        serviceTier: null,
        cwd: "C:\\Users\\huang\\workspace\\demo",
        runtimeWorkspaceRoots: ["C:\\Users\\huang\\workspace"],
        instructionSources: [],
        approvalPolicy: "untrusted",
        approvalsReviewer: "user",
        sandbox: { mode: "workspace-write" },
        activePermissionProfile: null,
        reasoningEffort: "medium"
      };
    }

    if (method === "thread/fork") {
      return {
        thread: {
          id: "fork-thread-1",
          sessionId: "fork-session-1",
          forkedFromId: "thread-1",
          parentThreadId: "thread-1",
          preview: "帮我修复登录",
          ephemeral: false,
          modelProvider: "openai",
          createdAt: 400,
          updatedAt: 400,
          status: { type: "idle" },
          path: null,
          cwd: "C:\\Users\\huang\\workspace\\demo",
          cliVersion: "0.141.0",
          source: "appServer",
          threadSource: null,
          agentNickname: null,
          agentRole: null,
          gitInfo: null,
          name: "登录修复 fork",
          turns: []
        },
        model: "gpt-5-codex",
        modelProvider: "openai",
        serviceTier: null,
        cwd: "C:\\Users\\huang\\workspace\\demo",
        runtimeWorkspaceRoots: ["C:\\Users\\huang\\workspace"],
        instructionSources: [],
        approvalPolicy: "untrusted",
        approvalsReviewer: "user",
        sandbox: { mode: "workspace-write" },
        activePermissionProfile: null,
        reasoningEffort: "medium"
      };
    }

    if (method === "thread/rollback") {
      return {
        thread: {
          id: "thread-1",
          sessionId: "session-1",
          forkedFromId: null,
          parentThreadId: null,
          preview: "帮我修复登录",
          ephemeral: false,
          modelProvider: "openai",
          createdAt: 100,
          updatedAt: 500,
          status: { type: "idle" },
          path: null,
          cwd: "C:\\Users\\huang\\workspace\\demo",
          cliVersion: "0.141.0",
          source: "vscode",
          threadSource: null,
          agentNickname: null,
          agentRole: null,
          gitInfo: null,
          name: "登录修复",
          turns: []
        }
      };
    }

    if (method === "thread/name/set" || method === "thread/archive" || method === "thread/delete") {
      return {};
    }

    if (method === "turn/start") {
      return {
        turn: {
          id: "turn-new-1",
          itemsView: "full",
          status: "inProgress",
          error: null,
          startedAt: 301,
          completedAt: null,
          durationMs: null,
          items: [
            {
              type: "userMessage",
              id: "item-user-new-1",
              clientId: "client-user-new-1",
              content: [{ type: "text", text: "继续开发发送功能", text_elements: [] }]
            }
          ]
        }
      };
    }

    if (method === "turn/interrupt") {
      return {};
    }

    if (method === "turn/steer") {
      return { turnId: "turn-steer-1" };
    }

    if (method === "model/list") {
      return {
        data: [
          {
            id: "gpt-5-codex",
            model: "gpt-5-codex",
            upgrade: null,
            upgradeInfo: null,
            availabilityNux: null,
            displayName: "GPT-5 Codex",
            description: "Codex 默认模型",
            hidden: false,
            supportedReasoningEfforts: ["low", "medium", "high"],
            defaultReasoningEffort: "medium",
            inputModalities: ["text", "image"],
            supportsPersonality: true,
            additionalSpeedTiers: [],
            serviceTiers: [],
            defaultServiceTier: null,
            isDefault: true
          }
        ],
        nextCursor: null
      };
    }

    if (method === "permissionProfile/list") {
      return {
        data: [
          { id: "default", description: "默认权限" },
          { id: "read-only", description: "只读" },
          { id: "full-auto", description: "自动执行" }
        ],
        nextCursor: null
      };
    }

    if (method === "fs/readDirectory") {
      return {
        entries: [
          { fileName: "src", isDirectory: true, isFile: false },
          { fileName: "README.md", isDirectory: false, isFile: true }
        ]
      };
    }

    if (method === "fs/readFile") {
      return {
        dataBase64: Buffer.from("# README").toString("base64")
      };
    }

    if (method === "command/exec") {
      return {
        exitCode: 0,
        stdout: "ok",
        stderr: ""
      };
    }

    if (method === "config/read") {
      return {
        config: {
          model: "gpt-5-codex",
          model_provider: "openai",
          model_reasoning_effort: "medium",
          approval_policy: "untrusted",
          sandbox_mode: "workspace-write"
        },
        origins: {},
        layers: null
      };
    }

    if (method === "remoteControl/status/read") {
      return {
        status: "connected",
        serverName: "mock",
        installationId: "install-1",
        environmentId: null
      };
    }

    throw new Error(`unexpected method ${method}`);
  }
}

describe("CodexAppServerClient", () => {
  it("初始化时声明移动端 Web 客户端能力", async () => {
    const peer = new FakePeer();
    const client = new CodexAppServerClient(peer);

    await client.initialize();

    expect(peer.calls[0]).toEqual({
      method: "initialize",
      params: {
        clientInfo: {
          name: "codex-mobile-web",
          title: "Codex 移动端 Web",
          version: "0.1.0"
        },
        capabilities: {
          experimentalApi: true,
          requestAttestation: false,
          optOutNotificationMethods: []
        }
      }
    });
  });

  it("能把 thread/list 结果整理成移动端会话摘要", async () => {
    const client = new CodexAppServerClient(new FakePeer());

    const page = await client.listThreads({ limit: 20 });

    expect(page.threads).toEqual([
      {
        id: "thread-1",
        title: "登录修复",
        preview: "帮我修复登录",
        cwd: "C:\\Users\\huang\\workspace\\demo",
        modelProvider: "openai",
        status: "idle",
        updatedAt: 200
      }
    ]);
    expect(page.nextCursor).toBeNull();
  });

  it("能把 model/list 结果整理成模型选择项", async () => {
    const client = new CodexAppServerClient(new FakePeer());

    const models = await client.listModels();

    expect(models).toEqual([
      {
        id: "gpt-5-codex",
        label: "GPT-5 Codex",
        isDefault: true,
        supportedReasoningEfforts: ["low", "medium", "high"],
        inputModalities: ["text", "image"]
      }
    ]);
  });

  it("能把 thread/read 结果整理成移动端 timeline", async () => {
    const client = new CodexAppServerClient(new FakePeer());

    const detail = await client.readThread("thread-1");

    expect(detail.id).toBe("thread-1");
    expect(detail.lastTurnId).toBe("turn-1");
    expect(detail.timeline).toEqual([
      {
        id: "item-user-1",
        role: "user",
        text: "请检查登录逻辑"
      },
      {
        id: "item-agent-1",
        role: "agent",
        text: "我会先阅读认证相关代码。"
      }
    ]);
  });

  it("能通过 thread/resume 恢复会话并使用初始 turns 页", async () => {
    const peer = new FakePeer();
    const client = new CodexAppServerClient(peer);

    await expect(client.resumeThread("thread-1")).resolves.toMatchObject({
      id: "thread-1",
      title: "登录修复",
      lastTurnId: "turn-resume-1",
      timeline: [
        { id: "item-resume-user-1", role: "user", text: "恢复这个会话" },
        { id: "item-resume-agent-1", role: "agent", text: "已恢复会话。" }
      ]
    });
    expect(peer.calls.at(-1)).toEqual({
      method: "thread/resume",
      params: {
        threadId: "thread-1",
        excludeTurns: true,
        initialTurnsPage: {
          limit: 30,
          sortDirection: "desc",
          itemsView: "full"
        }
      }
    });
  });

  it("能用 cwd、模型、思考强度和权限启动新会话", async () => {
    const peer = new FakePeer();
    const client = new CodexAppServerClient(peer);

    const thread = await client.startThread({
      cwd: "C:\\Users\\huang\\workspace\\demo",
      workspaceRoots: ["C:\\Users\\huang\\workspace"],
      model: "gpt-5-codex",
      permissions: "default"
    });

    expect(thread.id).toBe("new-thread-1");
    expect(peer.calls.at(-1)).toEqual({
      method: "thread/start",
      params: {
        cwd: "C:\\Users\\huang\\workspace\\demo",
        runtimeWorkspaceRoots: ["C:\\Users\\huang\\workspace"],
        model: "gpt-5-codex",
        permissions: "default"
      }
    });
  });

  it("能把文本发送为 turn/start", async () => {
    const peer = new FakePeer();
    const client = new CodexAppServerClient(peer);

    const result = await client.startTurn({
      threadId: "thread-1",
      text: "继续开发发送功能",
      model: "gpt-5-codex",
      reasoningEffort: "high"
    });

    expect(result.turnId).toBe("turn-new-1");
    expect(peer.calls.at(-1)).toEqual({
      method: "turn/start",
      params: {
        threadId: "thread-1",
        input: [{ type: "text", text: "继续开发发送功能", text_elements: [] }],
        model: "gpt-5-codex",
        effort: "high"
      }
    });
  });

  it("能把图片路径作为 localImage 发送为 turn/start", async () => {
    const peer = new FakePeer();
    const client = new CodexAppServerClient(peer);

    await client.startTurn({
      threadId: "thread-1",
      text: "看图",
      imagePaths: ["C:\\Users\\huang\\workspace\\codex-web\\uploads\\shot.png"]
    });

    expect(peer.calls.at(-1)).toMatchObject({
      method: "turn/start",
      params: {
        threadId: "thread-1",
        input: [
          { type: "text", text: "看图", text_elements: [] },
          { type: "localImage", path: "C:\\Users\\huang\\workspace\\codex-web\\uploads\\shot.png" }
        ]
      }
    });
  });

  it("能 fork 当前会话", async () => {
    const peer = new FakePeer();
    const client = new CodexAppServerClient(peer);

    const thread = await client.forkThread("thread-1");

    expect(thread.id).toBe("fork-thread-1");
    expect(peer.calls.at(-1)).toEqual({
      method: "thread/fork",
      params: { threadId: "thread-1", excludeTurns: false }
    });
  });

  it("能 rollback 当前会话", async () => {
    const peer = new FakePeer();
    const client = new CodexAppServerClient(peer);

    const thread = await client.rollbackThread("thread-1", 1);

    expect(thread.id).toBe("thread-1");
    expect(peer.calls.at(-1)).toEqual({
      method: "thread/rollback",
      params: { threadId: "thread-1", numTurns: 1 }
    });
  });

  it("能重命名当前会话", async () => {
    const peer = new FakePeer();
    const client = new CodexAppServerClient(peer);

    await expect(client.setThreadName("thread-1", "新的会话名")).resolves.toBeUndefined();

    expect(peer.calls.at(-1)).toEqual({
      method: "thread/name/set",
      params: { threadId: "thread-1", name: "新的会话名" }
    });
  });

  it("能归档和删除当前会话", async () => {
    const peer = new FakePeer();
    const client = new CodexAppServerClient(peer);

    await expect(client.archiveThread("thread-1")).resolves.toBeUndefined();
    await expect(client.deleteThread("thread-1")).resolves.toBeUndefined();

    expect(peer.calls.slice(-2)).toEqual([
      { method: "thread/archive", params: { threadId: "thread-1" } },
      { method: "thread/delete", params: { threadId: "thread-1" } }
    ]);
  });

  it("能中断运行中的 turn", async () => {
    const peer = new FakePeer();
    const client = new CodexAppServerClient(peer);

    await client.interruptTurn("thread-1", "turn-1");

    expect(peer.calls.at(-1)).toEqual({
      method: "turn/interrupt",
      params: { threadId: "thread-1", turnId: "turn-1" }
    });
  });

  it("能向运行中的 turn 追加 steer 指令", async () => {
    const peer = new FakePeer();
    const client = new CodexAppServerClient(peer);

    const result = await client.steerTurn({
      threadId: "thread-1",
      expectedTurnId: "turn-1",
      text: "请继续"
    });

    expect(result.turnId).toBe("turn-steer-1");
    expect(peer.calls.at(-1)).toEqual({
      method: "turn/steer",
      params: {
        threadId: "thread-1",
        expectedTurnId: "turn-1",
        input: [{ type: "text", text: "请继续", text_elements: [] }]
      }
    });
  });

  it("能读取目录和文件内容", async () => {
    const peer = new FakePeer();
    const client = new CodexAppServerClient(peer);

    await expect(client.readDirectory("C:\\Users\\huang\\workspace\\demo")).resolves.toEqual([
      {
        name: "src",
        path: "C:\\Users\\huang\\workspace\\demo\\src",
        isDirectory: true,
        isFile: false
      },
      {
        name: "README.md",
        path: "C:\\Users\\huang\\workspace\\demo\\README.md",
        isDirectory: false,
        isFile: true
      }
    ]);
    await expect(client.readFile("C:\\Users\\huang\\workspace\\demo\\README.md")).resolves.toEqual({
      path: "C:\\Users\\huang\\workspace\\demo\\README.md",
      text: "# README"
    });
  });

  it("能执行终端命令", async () => {
    const peer = new FakePeer();
    const client = new CodexAppServerClient(peer);

    await expect(client.execCommand({ command: ["npm", "--version"], cwd: "C:\\repo" })).resolves.toEqual({
      exitCode: 0,
      stdout: "ok",
      stderr: ""
    });
    expect(peer.calls.at(-1)).toEqual({
      method: "command/exec",
      params: { command: ["npm", "--version"], cwd: "C:\\repo", timeoutMs: 30_000 }
    });
  });

  it("能读取设置状态", async () => {
    const peer = new FakePeer();
    const client = new CodexAppServerClient(peer);

    await expect(client.readSettings()).resolves.toEqual({
      model: "gpt-5-codex",
      modelProvider: "openai",
      reasoningEffort: "medium",
      approvalPolicy: "untrusted",
      sandboxMode: "workspace-write",
      remoteControlStatus: "connected",
      permissionProfiles: [
        { id: "default", label: "default", description: "默认权限" },
        { id: "read-only", label: "read-only", description: "只读" },
        { id: "full-auto", label: "full-auto", description: "自动执行" }
      ]
    });
    expect(peer.calls.map((call) => call.method)).toContain("permissionProfile/list");
  });

  it("能分页读取 turns 和 turn items", async () => {
    const peer = new FakePeer();
    const client = new CodexAppServerClient(peer);

    await expect(client.listThreadTurns({ threadId: "thread-1", cursor: "cursor-1", limit: 10 })).resolves.toEqual({
      items: [{ id: "item-page-agent-1", role: "agent", text: "分页 turn" }],
      nextCursor: "turn-next"
    });
    expect(peer.calls.at(-1)).toEqual({
      method: "thread/turns/list",
      params: {
        threadId: "thread-1",
        cursor: "cursor-1",
        limit: 10,
        itemsView: "full"
      }
    });

    await expect(
      client.listThreadTurnItems({ threadId: "thread-1", turnId: "turn-page-1", cursor: "cursor-2", limit: 20 })
    ).resolves.toEqual({
      items: [{ id: "item-page-agent-2", role: "agent", text: "分页 item" }],
      nextCursor: "item-next"
    });
    expect(peer.calls.at(-1)).toEqual({
      method: "thread/turns/items/list",
      params: {
        threadId: "thread-1",
        turnId: "turn-page-1",
        cursor: "cursor-2",
        limit: 20
      }
    });
  });

  it("能搜索会话历史并整理成移动端摘要", async () => {
    const peer = new FakePeer();
    const client = new CodexAppServerClient(peer);

    await expect(client.searchThreads({ searchTerm: "登录", limit: 10, cursor: "search-cursor" })).resolves.toEqual({
      threads: [
        {
          id: "search-thread-1",
          title: "搜索结果",
          preview: "命中片段",
          cwd: "C:\\Users\\huang\\workspace\\demo",
          modelProvider: "openai",
          status: "idle",
          updatedAt: 700
        }
      ],
      nextCursor: "search-next"
    });
    expect(peer.calls.at(-1)).toEqual({
      method: "thread/search",
      params: {
        searchTerm: "登录",
        limit: 10,
        cursor: "search-cursor",
        sortKey: "updated_at",
        sortDirection: "desc"
      }
    });
  });
});
