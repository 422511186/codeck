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

    if (method === "thread/goal/get") {
      return {
        goal: {
          threadId: "thread-1",
          objective: "完成移动端 Codex Web",
          status: "active",
          tokenBudget: null,
          tokensUsed: 1024,
          timeUsedSeconds: 120,
          createdAt: 1_800_000_000,
          updatedAt: 1_800_000_100
        }
      };
    }

    if (method === "thread/goal/set") {
      return {
        goal: {
          threadId: "thread-1",
          objective: "新的目标",
          status: "active",
          tokenBudget: 5000,
          tokensUsed: 0,
          timeUsedSeconds: 0,
          createdAt: 1_800_000_200,
          updatedAt: 1_800_000_200
        }
      };
    }

    if (method === "thread/goal/clear") {
      return { cleared: true };
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

    if (method === "thread/settings/update") {
      return {};
    }

    if (method === "thread/compact/start") {
      return {};
    }

    if (method === "review/start") {
      return {
        reviewThreadId: "thread-1",
        turn: {
          id: "turn-review-1",
          itemsView: "full",
          status: "inProgress",
          error: null,
          startedAt: 1_800_000_300,
          completedAt: null,
          durationMs: null,
          items: []
        }
      };
    }

    if (method === "thread/memoryMode/set") {
      return {};
    }

    if (method === "memory/reset") {
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
        environmentId: "env-1"
      };
    }

    if (method === "remoteControl/client/list") {
      return {
        data: [
          {
            clientId: "phone-1",
            displayName: "手机 Safari",
            deviceType: "phone",
            platform: "ios",
            osVersion: "18",
            deviceModel: "iPhone",
            appVersion: "0.1.0",
            lastSeenAt: 1_800_000_001n
          }
        ],
        nextCursor: null
      };
    }

    if (method === "remoteControl/enable") {
      return {
        status: "connected",
        serverName: "mock",
        installationId: "install-1",
        environmentId: "env-1"
      };
    }

    if (method === "remoteControl/disable") {
      return {
        status: "disabled",
        serverName: "mock",
        installationId: "install-1",
        environmentId: null
      };
    }

    if (method === "remoteControl/pairing/start") {
      return {
        pairingCode: "pair-code-1",
        manualPairingCode: "123-456",
        environmentId: "env-1",
        expiresAt: 1_800_000_500n
      };
    }

    if (method === "remoteControl/pairing/status") {
      return { claimed: true };
    }

    if (method === "remoteControl/client/revoke") {
      return {};
    }

    if (method === "account/read") {
      return {
        account: { type: "chatgpt", email: "dev@example.com", planType: "pro" },
        requiresOpenaiAuth: false
      };
    }

    if (method === "account/rateLimits/read") {
      return {
        rateLimits: {
          limitId: "codex",
          limitName: "Codex",
          primary: { usedPercent: 42, windowDurationMins: 300, resetsAt: 1_800_000_000 },
          secondary: null,
          credits: null,
          individualLimit: null,
          planType: "pro",
          rateLimitReachedType: null
        },
        rateLimitsByLimitId: null,
        rateLimitResetCredits: null
      };
    }

    if (method === "mcpServerStatus/list") {
      return {
        data: [
          {
            name: "filesystem",
            serverInfo: null,
            tools: { read_file: {}, write_file: {} },
            resources: [{ uri: "file:///README.md", name: "README", mimeType: "text/markdown" }],
            resourceTemplates: [],
            authStatus: "bearerToken"
          },
          {
            name: "github",
            serverInfo: null,
            tools: { search: {} },
            resources: [],
            resourceTemplates: [],
            authStatus: "notLoggedIn"
          }
        ],
        nextCursor: null
      };
    }

    if (method === "modelProvider/capabilities/read") {
      return {
        namespaceTools: true,
        imageGeneration: true,
        webSearch: false
      };
    }

    if (method === "collaborationMode/list") {
      return {
        data: [
          { name: "Code", mode: "default", model: "gpt-5-codex", reasoning_effort: "medium" },
          { name: "Ask", mode: "ask", model: null, reasoning_effort: null }
        ]
      };
    }

    if (method === "skills/list") {
      return {
        data: [
          {
            cwd: "C:\\Users\\huang\\workspace\\demo",
            skills: [
              {
                name: "openai-docs",
                description: "查询 OpenAI 官方文档",
                shortDescription: "OpenAI 文档",
                interface: null,
                dependencies: null,
                path: "C:\\Users\\huang\\.codex\\skills\\openai-docs\\SKILL.md",
                scope: "user",
                enabled: true
              },
              {
                name: "repo-helper",
                description: "项目内辅助技能",
                shortDescription: null,
                interface: null,
                dependencies: null,
                path: "C:\\Users\\huang\\workspace\\demo\\.codex\\skills\\repo-helper\\SKILL.md",
                scope: "repo",
                enabled: false
              }
            ],
            errors: [{ path: "C:\\broken\\SKILL.md", message: "缺少 description" }]
          }
        ]
      };
    }

    if (method === "plugin/list") {
      return {
        marketplaces: [
          {
            name: "个人插件市场",
            path: "C:\\Users\\huang\\.codex\\plugins\\marketplace.json",
            interface: { displayName: "个人插件" },
            plugins: [
              {
                id: "browser-tools",
                remotePluginId: null,
                localVersion: "1.0.0",
                name: "browser-tools",
                shareContext: null,
                source: { type: "local", path: "C:\\Users\\huang\\.codex\\plugins\\browser-tools" },
                installed: true,
                enabled: true,
                installPolicy: "install",
                authPolicy: "none",
                availability: "AVAILABLE",
                interface: {
                  displayName: "浏览器工具",
                  shortDescription: "控制浏览器",
                  longDescription: null,
                  developerName: null,
                  category: null,
                  capabilities: [],
                  websiteUrl: null,
                  privacyPolicyUrl: null,
                  termsOfServiceUrl: null,
                  defaultPrompt: null,
                  brandColor: null,
                  composerIcon: null,
                  composerIconUrl: null,
                  logo: null,
                  logoUrl: null,
                  screenshots: [],
                  screenshotUrls: []
                },
                keywords: ["browser"]
              },
              {
                id: "review-pack",
                remotePluginId: "remote-review-pack",
                localVersion: null,
                name: "review-pack",
                shareContext: null,
                source: { type: "remote" },
                installed: false,
                enabled: false,
                installPolicy: "ask",
                authPolicy: "none",
                availability: "DISABLED_BY_ADMIN",
                interface: null,
                keywords: []
              }
            ]
          }
        ],
        marketplaceLoadErrors: [{ marketplacePath: "C:\\bad-marketplace.json", message: "JSON 无效" }],
        featuredPluginIds: ["browser-tools"]
      };
    }

    if (method === "plugin/read") {
      return {
        plugin: {
          marketplaceName: "个人插件市场",
          marketplacePath: "C:\\Users\\huang\\.codex\\plugins\\marketplace.json",
          summary: {
            id: "browser-tools",
            remotePluginId: null,
            localVersion: "1.0.0",
            name: "browser-tools",
            shareContext: null,
            source: { type: "local", path: "C:\\Users\\huang\\.codex\\plugins\\browser-tools" },
            installed: true,
            enabled: true,
            installPolicy: "AVAILABLE",
            authPolicy: "ON_USE",
            availability: "AVAILABLE",
            interface: {
              displayName: "浏览器工具",
              shortDescription: "控制浏览器",
              longDescription: "用于移动端验证网页和截图。",
              developerName: "Codex",
              category: "tools",
              capabilities: ["browser"],
              websiteUrl: null,
              privacyPolicyUrl: null,
              termsOfServiceUrl: null,
              defaultPrompt: null,
              brandColor: null,
              composerIcon: null,
              composerIconUrl: null,
              logo: null,
              logoUrl: null,
              screenshots: [],
              screenshotUrls: []
            },
            keywords: ["browser"]
          },
          shareUrl: null,
          description: "用于移动端验证网页和截图。",
          skills: [{ name: "browser:control", description: "控制浏览器", shortDescription: "浏览器控制" }],
          hooks: [{ name: "after-edit", description: "编辑后检查" }],
          apps: [{ id: "browser-app", name: "Browser", description: "浏览器应用", installUrl: null, category: "tool" }],
          appTemplates: [],
          mcpServers: ["browser"]
        }
      };
    }

    if (method === "plugin/install") {
      return {
        authPolicy: "ON_USE",
        appsNeedingAuth: [{ id: "browser-app", name: "Browser", description: "浏览器应用", installUrl: null, category: "tool" }]
      };
    }

    if (method === "plugin/uninstall") {
      return {};
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
    expect(detail.goal).toEqual({
      threadId: "thread-1",
      objective: "完成移动端 Codex Web",
      status: "active",
      tokenBudget: null,
      tokensUsed: 1024,
      timeUsedSeconds: 120,
      createdAt: 1_800_000_000,
      updatedAt: 1_800_000_100
    });
  });

  it("能通过 thread/resume 恢复会话并使用初始 turns 页", async () => {
    const peer = new FakePeer();
    const client = new CodexAppServerClient(peer);

    await expect(client.resumeThread("thread-1")).resolves.toMatchObject({
      id: "thread-1",
      title: "登录修复",
      lastTurnId: "turn-resume-1",
      goal: expect.objectContaining({ objective: "完成移动端 Codex Web" }),
      timeline: [
        { id: "item-resume-user-1", role: "user", text: "恢复这个会话" },
        { id: "item-resume-agent-1", role: "agent", text: "已恢复会话。" }
      ]
    });
    expect(peer.calls).toContainEqual({
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

  it("能设置和清除当前会话目标", async () => {
    const peer = new FakePeer();
    const client = new CodexAppServerClient(peer);

    await expect(client.setThreadGoal({ threadId: "thread-1", objective: "新的目标", tokenBudget: 5000 })).resolves.toEqual({
      threadId: "thread-1",
      objective: "新的目标",
      status: "active",
      tokenBudget: 5000,
      tokensUsed: 0,
      timeUsedSeconds: 0,
      createdAt: 1_800_000_200,
      updatedAt: 1_800_000_200
    });
    await expect(client.clearThreadGoal("thread-1")).resolves.toBeUndefined();

    expect(peer.calls.slice(-2)).toEqual([
      {
        method: "thread/goal/set",
        params: { threadId: "thread-1", objective: "新的目标", status: "active", tokenBudget: 5000 }
      },
      { method: "thread/goal/clear", params: { threadId: "thread-1" } }
    ]);
  });

  it("能启动当前会话上下文压缩", async () => {
    const peer = new FakePeer();
    const client = new CodexAppServerClient(peer);

    await expect(client.compactThread("thread-1")).resolves.toBeUndefined();

    expect(peer.calls.at(-1)).toEqual({
      method: "thread/compact/start",
      params: { threadId: "thread-1" }
    });
  });

  it("能启动当前会话的未提交改动审查", async () => {
    const peer = new FakePeer();
    const client = new CodexAppServerClient(peer);

    await expect(client.startReview("thread-1")).resolves.toEqual({
      turnId: "turn-review-1",
      reviewThreadId: "thread-1"
    });

    expect(peer.calls.at(-1)).toEqual({
      method: "review/start",
      params: {
        threadId: "thread-1",
        target: { type: "uncommittedChanges" },
        delivery: "inline"
      }
    });
  });

  it("能切换当前会话记忆模式并重置记忆", async () => {
    const peer = new FakePeer();
    const client = new CodexAppServerClient(peer);

    await expect(client.setThreadMemoryMode("thread-1", "enabled")).resolves.toBeUndefined();
    await expect(client.resetMemory()).resolves.toBeUndefined();

    expect(peer.calls.slice(-2)).toEqual([
      { method: "thread/memoryMode/set", params: { threadId: "thread-1", mode: "enabled" } },
      { method: "memory/reset", params: undefined }
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
      reasoningEffort: "high",
      permissions: "full-auto"
    });

    expect(result.turnId).toBe("turn-new-1");
    expect(peer.calls.at(-1)).toEqual({
      method: "turn/start",
      params: {
        threadId: "thread-1",
        input: [{ type: "text", text: "继续开发发送功能", text_elements: [] }],
        model: "gpt-5-codex",
        effort: "high",
        permissions: "full-auto"
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

  it("能更新当前会话设置", async () => {
    const peer = new FakePeer();
    const client = new CodexAppServerClient(peer);

    await expect(
      client.updateThreadSettings({
        threadId: "thread-1",
        model: "gpt-5-mini",
        reasoningEffort: "high",
        permissions: "full-auto"
      })
    ).resolves.toBeUndefined();

    expect(peer.calls.at(-1)).toEqual({
      method: "thread/settings/update",
      params: {
        threadId: "thread-1",
        model: "gpt-5-mini",
        effort: "high",
        permissions: "full-auto"
      }
    });
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
      remoteControlServerName: "mock",
      remoteControlInstallationId: "install-1",
      remoteControlEnvironmentId: "env-1",
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
          clientId: "phone-1",
          displayName: "手机 Safari",
          deviceType: "phone",
          platform: "ios",
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
        { id: "default", label: "default", description: "默认权限" },
        { id: "read-only", label: "read-only", description: "只读" },
        { id: "full-auto", label: "full-auto", description: "自动执行" }
      ],
      skills: [
        {
          cwd: "C:\\Users\\huang\\workspace\\demo",
          name: "openai-docs",
          description: "查询 OpenAI 官方文档",
          shortDescription: "OpenAI 文档",
          scope: "user",
          enabled: true
        },
        {
          cwd: "C:\\Users\\huang\\workspace\\demo",
          name: "repo-helper",
          description: "项目内辅助技能",
          shortDescription: null,
          scope: "repo",
          enabled: false
        }
      ],
      skillErrors: [{ cwd: "C:\\Users\\huang\\workspace\\demo", path: "C:\\broken\\SKILL.md", message: "缺少 description" }],
      plugins: [
        {
          marketplaceName: "个人插件市场",
          marketplacePath: "C:\\Users\\huang\\.codex\\plugins\\marketplace.json",
          marketplaceDisplayName: "个人插件",
          id: "browser-tools",
          name: "browser-tools",
          displayName: "浏览器工具",
          shortDescription: "控制浏览器",
          installed: true,
          enabled: true,
          availability: "AVAILABLE",
          sourceType: "local"
        },
        {
          marketplaceName: "个人插件市场",
          marketplacePath: "C:\\Users\\huang\\.codex\\plugins\\marketplace.json",
          marketplaceDisplayName: "个人插件",
          id: "review-pack",
          name: "review-pack",
          displayName: null,
          shortDescription: null,
          installed: false,
          enabled: false,
          availability: "DISABLED_BY_ADMIN",
          sourceType: "remote"
        }
      ],
      pluginMarketplaceErrors: [
        { marketplacePath: "C:\\bad-marketplace.json", message: "JSON 无效" }
      ]
    });
    expect(peer.calls.map((call) => call.method)).toContain("permissionProfile/list");
    expect(peer.calls).toEqual(
      expect.arrayContaining([
        { method: "account/read", params: { refreshToken: false } },
        { method: "account/rateLimits/read", params: undefined },
        { method: "mcpServerStatus/list", params: { detail: "full", limit: 50 } },
        { method: "modelProvider/capabilities/read", params: {} },
        { method: "collaborationMode/list", params: {} },
        { method: "skills/list", params: { forceReload: false } },
        { method: "plugin/list", params: { cwds: null, marketplaceKinds: null } },
        { method: "remoteControl/client/list", params: { environmentId: "env-1", limit: 20, order: "desc" } }
      ])
    );
  });

  it("能管理远程控制连接、配对和客户端授权", async () => {
    const peer = new FakePeer();
    const client = new CodexAppServerClient(peer);

    await expect(client.enableRemoteControl()).resolves.toMatchObject({
      status: "connected",
      environmentId: "env-1"
    });
    await expect(client.disableRemoteControl()).resolves.toMatchObject({
      status: "disabled",
      environmentId: null
    });
    await expect(client.startRemoteControlPairing()).resolves.toEqual({
      pairingCode: "pair-code-1",
      manualPairingCode: "123-456",
      environmentId: "env-1",
      expiresAt: 1_800_000_500
    });
    await expect(
      client.readRemoteControlPairingStatus({ pairingCode: "pair-code-1", manualPairingCode: "123-456" })
    ).resolves.toEqual({ claimed: true });
    await expect(client.revokeRemoteControlClient("env-1", "phone-1")).resolves.toBeUndefined();

    expect(peer.calls).toEqual(
      expect.arrayContaining([
        { method: "remoteControl/enable", params: { ephemeral: false } },
        { method: "remoteControl/disable", params: { ephemeral: false } },
        { method: "remoteControl/pairing/start", params: { manualCode: true } },
        {
          method: "remoteControl/pairing/status",
          params: { pairingCode: "pair-code-1", manualPairingCode: "123-456" }
        },
        { method: "remoteControl/client/revoke", params: { environmentId: "env-1", clientId: "phone-1" } }
      ])
    );
  });

  it("能读取、安装和卸载插件", async () => {
    const peer = new FakePeer();
    const client = new CodexAppServerClient(peer);

    await expect(
      client.readPlugin({ marketplacePath: "C:\\Users\\huang\\.codex\\plugins\\marketplace.json", pluginName: "browser-tools" })
    ).resolves.toEqual({
      marketplaceName: "个人插件市场",
      marketplacePath: "C:\\Users\\huang\\.codex\\plugins\\marketplace.json",
      id: "browser-tools",
      name: "browser-tools",
      displayName: "浏览器工具",
      description: "用于移动端验证网页和截图。",
      installed: true,
      enabled: true,
      authPolicy: "ON_USE",
      installPolicy: "AVAILABLE",
      availability: "AVAILABLE",
      skillCount: 1,
      hookCount: 1,
      appCount: 1,
      mcpServers: ["browser"]
    });
    await expect(
      client.installPlugin({ marketplacePath: "C:\\Users\\huang\\.codex\\plugins\\marketplace.json", pluginName: "browser-tools" })
    ).resolves.toEqual({
      authPolicy: "ON_USE",
      appsNeedingAuth: [{ id: "browser-app", name: "Browser", description: "浏览器应用", installUrl: null, category: "tool" }]
    });
    await expect(client.uninstallPlugin("browser-tools")).resolves.toBeUndefined();

    expect(peer.calls).toEqual(
      expect.arrayContaining([
        {
          method: "plugin/read",
          params: {
            marketplacePath: "C:\\Users\\huang\\.codex\\plugins\\marketplace.json",
            remoteMarketplaceName: null,
            pluginName: "browser-tools"
          }
        },
        {
          method: "plugin/install",
          params: {
            marketplacePath: "C:\\Users\\huang\\.codex\\plugins\\marketplace.json",
            remoteMarketplaceName: null,
            pluginName: "browser-tools"
          }
        },
        { method: "plugin/uninstall", params: { pluginId: "browser-tools" } }
      ])
    );
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
