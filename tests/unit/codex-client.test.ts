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
});
