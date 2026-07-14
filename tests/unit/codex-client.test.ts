import { describe, expect, it } from "vitest";
import { CodexAppServerClient, type AppServerPeer } from "../../src/server/app-server/client";

class FakePeer implements AppServerPeer {
  readonly calls: Array<{ method: string; params: unknown }> = [];
  readonly notifications: Array<{ method: string; params: unknown }> = [];

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

    if (method === "thread/loaded/list") {
      return {
        data: ["thread-1", "thread-2"],
        nextCursor: null
      };
    }

    if (method === "experimentalFeature/list") {
      return {
        data: [
          {
            name: "appshots",
            stage: "beta",
            displayName: "Appshots",
            description: "自动保存应用截图",
            announcement: "Appshots 已可试用",
            enabled: false,
            defaultEnabled: false
          }
        ],
        nextCursor: null
      };
    }

    if (method === "experimentalFeature/enablement/set") {
      return {};
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

    if (method === "getConversationSummary") {
      return {
        summary: {
          conversationId: "thread-1",
          path: "C:\\Users\\huang\\.codex\\threads\\thread-1.jsonl",
          preview: "摘要预览",
          timestamp: "2026-06-23T01:00:00.000Z",
          updatedAt: "2026-06-23T02:00:00.000Z",
          modelProvider: "openai",
          cwd: "C:\\Users\\huang\\workspace\\demo",
          cliVersion: "0.141.0",
          source: "vscode",
          gitInfo: null
        }
      };
    }

    if (method === "gitDiffToRemote") {
      return {
        sha: "abc123",
        diff: "diff --git a/README.md b/README.md"
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
      const listParams = params as { cursor?: string | null; sortDirection?: string | null } | undefined;
      if (!listParams?.cursor && listParams?.sortDirection === "desc") {
        return {
          data: [
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
          ],
          nextCursor: "turn-older",
          backwardsCursor: null
        };
      }

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

    if (method === "thread/items/list") {
      return {
        data: [
          {
            type: "agentMessage",
            id: (params as { turnId?: string }).turnId ? "item-page-agent-2" : "item-page-agent-1",
            text: (params as { turnId?: string }).turnId ? "分页 item" : "分页 turn",
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

    if (method === "thread/unarchive") {
      return {
        thread: {
          id: "thread-1",
          sessionId: "session-1",
          forkedFromId: null,
          parentThreadId: null,
          preview: "已恢复的会话",
          ephemeral: false,
          modelProvider: "openai",
          createdAt: 100,
          updatedAt: 800,
          status: { type: "idle" },
          path: null,
          cwd: "C:\\Users\\huang\\workspace\\demo",
          cliVersion: "0.141.0",
          source: "vscode",
          threadSource: null,
          agentNickname: null,
          agentRole: null,
          gitInfo: null,
          name: "已恢复",
          turns: []
        }
      };
    }

    if (method === "thread/unsubscribe") {
      return { status: "unsubscribed" };
    }

    if (method === "thread/shellCommand") {
      return {};
    }

    if (method === "thread/increment_elicitation") {
      return { count: 1n, paused: true };
    }

    if (method === "thread/decrement_elicitation") {
      return { count: 0n, paused: false };
    }

    if (method === "thread/settings/update") {
      return {};
    }

    if (method === "thread/metadata/update") {
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
          updatedAt: 900,
          status: { type: "idle" },
          path: null,
          cwd: "C:\\Users\\huang\\workspace\\demo",
          cliVersion: "0.141.0",
          source: "vscode",
          threadSource: null,
          agentNickname: null,
          agentRole: null,
          gitInfo: { sha: "abc123", branch: "main", originUrl: null },
          name: "登录修复",
          turns: []
        }
      };
    }

    if (method === "thread/inject_items" || method === "thread/approveGuardianDeniedAction") {
      return {};
    }

    if (method === "mock/experimentalMethod") {
      const experimentalParams = params as { value?: string | null };
      return { echoed: experimentalParams.value ?? null };
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

    if (method === "account/login/start") {
      const params = this.calls.at(-1)?.params as { type?: string };
      if (params.type === "apiKey") {
        return { type: "apiKey" };
      }
      return { type: "chatgpt", loginId: "login-1", authUrl: "https://auth.openai.com/codex" };
    }

    if (method === "account/login/cancel") {
      return { status: "canceled" };
    }

    if (method === "account/logout") {
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
            supportedReasoningEfforts: [
              { reasoningEffort: "low", description: "快速" },
              { reasoningEffort: "medium", description: "平衡" },
              { reasoningEffort: "high", description: "深入" }
            ],
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

    if (method === "fs/writeFile" || method === "fs/createDirectory" || method === "fs/remove" || method === "fs/copy") {
      return {};
    }

    if (method === "fs/watch") {
      const watchParams = params as { path?: string };
      return { path: watchParams.path };
    }

    if (method === "fs/unwatch") {
      return {};
    }

    if (method === "fs/getMetadata") {
      return {
        isDirectory: false,
        isFile: true,
        isSymlink: false,
        createdAtMs: 1_700_000_000_000,
        modifiedAtMs: 1_800_000_000_000
      };
    }

    if (method === "fuzzyFileSearch") {
      return {
        files: [
          {
            root: "C:\\repo",
            path: "src\\app.ts",
            match_type: "file",
            file_name: "app.ts",
            score: 99,
            indices: [0, 1, 2]
          }
        ]
      };
    }

    if (
      method === "fuzzyFileSearch/sessionStart" ||
      method === "fuzzyFileSearch/sessionUpdate" ||
      method === "fuzzyFileSearch/sessionStop"
    ) {
      return {};
    }

    if (method === "command/exec") {
      return {
        exitCode: 0,
        stdout: "ok",
        stderr: ""
      };
    }

    if (
      method === "command/exec/write" ||
      method === "command/exec/resize" ||
      method === "command/exec/terminate"
    ) {
      return {};
    }

    if (
      method === "process/spawn" ||
      method === "process/writeStdin" ||
      method === "process/resizePty" ||
      method === "process/kill"
    ) {
      return {};
    }

    if (method === "thread/backgroundTerminals/list") {
      return {
        data: [
          {
            itemId: "item-bg-1",
            processId: "bg-proc-1",
            command: "npm run dev",
            cwd: "C:\\repo",
            osPid: 4242,
            cpuPercent: 1.5,
            rssKb: 2048n
          }
        ],
        nextCursor: null
      };
    }

    if (method === "thread/backgroundTerminals/terminate") {
      return { terminated: true };
    }

    if (method === "thread/backgroundTerminals/clean") {
      return {};
    }

    if (method === "config/read") {
      return {
        config: {
          model: "gpt-5-codex",
          model_provider: "openai",
          model_reasoning_effort: "medium",
          model_reasoning_summary: "auto",
          approval_policy: "untrusted",
          sandbox_mode: "workspace-write"
        },
        origins: {},
        layers: null
      };
    }

    if (method === "config/value/write" || method === "config/batchWrite") {
      return {
        status: "written",
        version: "config-version-2",
        filePath: "C:\\Users\\huang\\.codex\\config.toml",
        overriddenMetadata: null
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

    if (method === "getAuthStatus") {
      return {
        authMethod: "chatgpt",
        authToken: null,
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
        rateLimitResetCredits: { availableCount: 1n }
      };
    }

    if (method === "account/usage/read") {
      return {
        summary: {
          lifetimeTokens: 123456n,
          peakDailyTokens: 45678n,
          longestRunningTurnSec: 321n,
          currentStreakDays: 7n,
          longestStreakDays: 21n
        },
        dailyUsageBuckets: [{ startDate: "2026-06-23", tokens: 1200n }]
      };
    }

    if (method === "account/sendAddCreditsNudgeEmail") {
      return { status: "sent" };
    }

    if (method === "account/rateLimitResetCredit/consume") {
      return { outcome: "reset" };
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

    if (method === "config/mcpServer/reload") {
      return {};
    }

    if (method === "mcpServer/oauth/login") {
      return { authorizationUrl: "https://example.com/mcp/oauth" };
    }

    if (method === "mcpServer/resource/read") {
      return {
        contents: [{ uri: "file:///README.md", mimeType: "text/markdown", text: "# README" }]
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

    if (method === "hooks/list") {
      return {
        data: [
          {
            cwd: "C:\\Users\\huang\\workspace\\demo",
            hooks: [
              {
                key: "post-tool-use-format",
                eventName: "postToolUse",
                handlerType: "command",
                matcher: "Edit",
                command: "npm run format",
                timeoutSec: 60n,
                statusMessage: "格式化文件",
                sourcePath: "C:\\Users\\huang\\workspace\\demo\\.codex\\hooks.json",
                source: "project",
                pluginId: null,
                displayOrder: 1n,
                enabled: true,
                isManaged: false,
                currentHash: "hash-1",
                trustStatus: "trusted"
              }
            ],
            warnings: ["hook 即将迁移"],
            errors: [{ path: "C:\\bad-hook.json", message: "hook JSON 无效" }]
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
          skills: [{ name: "browser:control", description: "控制浏览器", shortDescription: "浏览器控制", enabled: true }],
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

    if (method === "app/list") {
      return {
        data: [
          {
            id: "browser-app",
            name: "Browser",
            description: "控制浏览器。",
            logoUrl: null,
            logoUrlDark: null,
            distributionChannel: "plugin",
            branding: {
              category: "tool",
              developer: "OpenAI",
              website: null,
              privacyPolicy: null,
              termsOfService: null,
              isDiscoverableApp: true
            },
            appMetadata: null,
            labels: { beta: "true" },
            installUrl: null,
            isAccessible: true,
            isEnabled: true,
            pluginDisplayNames: ["浏览器工具"]
          }
        ],
        nextCursor: null
      };
    }

    if (method === "configRequirements/read") {
      return {
        requirements: {
          allowedApprovalPolicies: ["untrusted"],
          allowedApprovalsReviewers: null,
          allowedSandboxModes: ["workspace-write"],
          allowedWindowsSandboxImplementations: ["unelevated"],
          allowedPermissionProfiles: { default: true },
          defaultPermissions: "default",
          allowedWebSearchModes: null,
          allowManagedHooksOnly: false,
          allowAppshots: true,
          allowRemoteControl: true,
          computerUse: null,
          featureRequirements: { skills: true },
          hooks: null,
          enforceResidency: null,
          network: null
        }
      };
    }

    if (method === "windowsSandbox/readiness") {
      return { status: "updateRequired" };
    }

    if (method === "windowsSandbox/setupStart") {
      return { started: true };
    }

    if (method === "plugin/skill/read") {
      return { contents: "# browser:control\n\n控制浏览器。" };
    }

    if (method === "skills/extraRoots/set") {
      return {};
    }

    if (method === "skills/config/write") {
      return { effectiveEnabled: false };
    }

    if (method === "environment/add") {
      return {};
    }

    if (method === "externalAgentConfig/detect") {
      return {
        items: [
          {
            itemType: "AGENTS_MD",
            description: "导入 AGENTS.md",
            cwd: "C:\\repo",
            details: null
          }
        ]
      };
    }

    if (method === "externalAgentConfig/import") {
      return { importId: "import-1" };
    }

    if (method === "feedback/upload") {
      return { threadId: "thread-1" };
    }

    if (method === "marketplace/add") {
      return {
        marketplaceName: "team-marketplace",
        installedRoot: "C:\\Users\\huang\\.codex\\plugins\\team",
        alreadyAdded: false
      };
    }

    if (method === "marketplace/remove") {
      return {
        marketplaceName: "team-marketplace",
        installedRoot: "C:\\Users\\huang\\.codex\\plugins\\team"
      };
    }

    if (method === "marketplace/upgrade") {
      return {
        selectedMarketplaces: ["team-marketplace"],
        upgradedRoots: ["C:\\Users\\huang\\.codex\\plugins\\team"],
        errors: [{ marketplaceName: "broken-marketplace", message: "无法拉取" }]
      };
    }

    if (method === "plugin/installed") {
      return {
        marketplaces: [
          {
            name: "个人插件市场",
            path: "C:\\Users\\huang\\.codex\\plugins\\marketplace.json",
            interface: null,
            plugins: []
          }
        ],
        marketplaceLoadErrors: []
      };
    }

    if (method === "plugin/share/save") {
      return { remotePluginId: "remote-plugin-1", shareUrl: "https://example.com/plugins/remote-plugin-1" };
    }

    if (method === "plugin/share/updateTargets") {
      return {
        discoverability: "PRIVATE",
        principals: [{ principalType: "USER", principalId: "user-1", role: "OWNER", name: "测试用户" }]
      };
    }

    if (method === "plugin/share/list") {
      return {
        data: [
          {
            plugin: {
              id: "browser-tools",
              name: "browser-tools",
              displayName: "浏览器工具",
              shortDescription: "控制浏览器",
              installed: true,
              enabled: true,
              availability: "AVAILABLE",
              sourceType: "local"
            },
            localPluginPath: "C:\\Users\\huang\\.codex\\plugins\\browser-tools"
          }
        ]
      };
    }

    if (method === "plugin/share/checkout") {
      return {
        remotePluginId: "remote-plugin-1",
        pluginId: "browser-tools",
        pluginName: "browser-tools",
        pluginPath: "C:\\Users\\huang\\.codex\\plugins\\browser-tools",
        marketplaceName: "个人插件市场",
        marketplacePath: "C:\\Users\\huang\\.codex\\plugins\\marketplace.json",
        remoteVersion: "v1"
      };
    }

    if (method === "plugin/share/delete") {
      return {};
    }

    if (method === "mcpServer/tool/call") {
      return {
        content: [{ type: "text", text: "工具结果" }],
        structuredContent: { ok: true },
        isError: false,
        _meta: { durationMs: 12 }
      };
    }

    if (
      method === "thread/realtime/start" ||
      method === "thread/realtime/appendAudio" ||
      method === "thread/realtime/appendText" ||
      method === "thread/realtime/appendSpeech" ||
      method === "thread/realtime/stop"
    ) {
      return {};
    }

    if (method === "thread/realtime/listVoices") {
      return {
        voices: {
          v1: ["alloy", "echo"],
          v2: ["cedar", "marin"],
          defaultV1: "alloy",
          defaultV2: "cedar"
        }
      };
    }

    throw new Error(`unexpected method ${method}`);
  }

  notify(method: string, params?: unknown): void {
    this.notifications.push({ method, params });
  }
}

class ActivePermissionProfilePeer extends FakePeer {
  async request(method: string, params: unknown): Promise<unknown> {
    const response = await super.request(method, params);
    if (method === "thread/resume" && response && typeof response === "object") {
      return {
        ...(response as Record<string, unknown>),
        approvalsReviewer: "auto_review",
        activePermissionProfile: { id: ":workspace", extends: "default" }
      };
    }
    return response;
  }
}

describe("CodexAppServerClient", () => {
  it("初始化时声明 Web 后端客户端能力", async () => {
    const peer = new FakePeer();
    const client = new CodexAppServerClient(peer);

    await client.initialize();

    expect(peer.calls[0]).toEqual({
      method: "initialize",
      params: {
        clientInfo: {
          name: "codex-web-backend",
          title: "Codex Web 后端",
          version: "0.1.0"
        },
        capabilities: {
          experimentalApi: true,
          requestAttestation: false,
          optOutNotificationMethods: []
        }
      }
    });
    expect(peer.notifications).toEqual([{ method: "initialized", params: undefined }]);
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

  it("thread/read 只返回元数据且不加载消息", async () => {
    const peer = new FakePeer();
    const client = new CodexAppServerClient(peer);

    const detail = await client.readThreadMetadata("thread-1");

    expect(detail.id).toBe("thread-1");
    expect(detail.lastTurnId).toBeNull();
    expect(detail.timeline).toEqual([]);
    expect(peer.calls.filter((call) => call.method === "thread/read")).toEqual([
      { method: "thread/read", params: { threadId: "thread-1", includeTurns: false } }
    ]);
    expect(peer.calls.some((call) => call.method === "thread/turns/list")).toBe(false);
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

  it("读取未 materialized 空会话时使用 metadata-only 并返回空 timeline", async () => {
    const peer = new FakePeer();
    const originalRequest = peer.request.bind(peer);
    peer.request = async (method, params) => {
      peer.calls.push({ method, params });
      if (method === "thread/read" && (params as { includeTurns?: boolean }).includeTurns) {
        throw new Error("首屏读取不应请求 includeTurns");
      }
      if (method === "thread/read") {
        return {
          thread: {
            id: "empty-thread",
            sessionId: "empty-session",
            forkedFromId: null,
            parentThreadId: null,
            preview: "",
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
            name: "新会话"
          }
        };
      }
      if (method === "thread/turns/list") {
        throw new Error(
          "thread empty-thread is not materialized yet; thread/turns/list is unavailable before first user message"
        );
      }
      return originalRequest(method, params);
    };
    const client = new CodexAppServerClient(peer);

    await expect(client.readThreadMetadata("empty-thread")).resolves.toMatchObject({
      id: "empty-thread",
      title: "新会话",
      timeline: [],
      lastTurnId: null
    });
    expect(peer.calls.filter((call) => call.method === "thread/read")).toEqual([
      {
        method: "thread/read",
        params: { threadId: "empty-thread", includeTurns: false }
      }
    ]);
    expect(peer.calls.some((call) => call.method === "thread/turns/list")).toBe(false);
  });

  it("读取刚创建未加载空会话时返回空 timeline", async () => {
    const peer = new FakePeer();
    const originalRequest = peer.request.bind(peer);
    peer.request = async (method, params) => {
      peer.calls.push({ method, params });
      if (method === "thread/read") {
        return {
          thread: {
            id: "empty-thread",
            sessionId: "empty-session",
            forkedFromId: null,
            parentThreadId: null,
            preview: "",
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
            name: "新会话"
          }
        };
      }
      if (method === "thread/turns/list") {
        throw new Error("thread empty-thread is not loaded; thread/turns/list unavailable before first user message");
      }
      return originalRequest(method, params);
    };
    const client = new CodexAppServerClient(peer);

    await expect(client.readThread("empty-thread")).resolves.toMatchObject({
      id: "empty-thread",
      title: "新会话",
      timeline: [],
      lastTurnId: null
    });
  });

  it("内部读取普通会话时使用 metadata 加固定 turns 窗口，不请求 includeTurns 全量历史", async () => {
    const peer = new FakePeer();
    const client = new CodexAppServerClient(peer);

    await client.readThread("thread-1");

    expect(peer.calls.filter((call) => call.method === "thread/read")).toEqual([
      {
        method: "thread/read",
        params: { threadId: "thread-1", includeTurns: false }
      }
    ]);
    expect(peer.calls).toContainEqual({
      method: "thread/turns/list",
      params: { threadId: "thread-1", limit: 30, sortDirection: "desc", itemsView: "full" }
    });
  });

  it("内部读取普通会话时携带固定窗口的继续 cursor", async () => {
    const peer = new FakePeer();
    const client = new CodexAppServerClient(peer);

    const detail = await client.readThread("thread-1");

    expect(detail.nextCursor).toBe("turn-older");
  });

  it("metadata flags 被上游忽略时不使用 response.thread.turns 作为分页 fallback", async () => {
    const peer = new FakePeer();
    const originalRequest = peer.request.bind(peer);
    peer.request = async (method, params) => {
      peer.calls.push({ method, params });
      if (method === "thread/read") {
        const response = await originalRequest(method, params) as { thread: { turns?: unknown[] } };
        const turnPage = await originalRequest("thread/turns/list", {
          threadId: "thread-1",
          limit: 30,
          sortDirection: "desc",
          itemsView: "full"
        }) as { data: unknown[] };
        return {
          ...response,
          thread: {
            ...response.thread,
            turns: Array.from({ length: 40 }, (_, index) => ({
              ...(turnPage.data[0] as object),
              id: `unexpected-turn-${index}`
            }))
          }
        };
      }
      if (method === "thread/turns/list") {
        return { data: [], nextCursor: null, backwardsCursor: null };
      }
      return originalRequest(method, params);
    };
    const client = new CodexAppServerClient(peer);

    const detail = await client.readThread("thread-1");

    expect(detail.timeline).toEqual([]);
    expect(detail.nextCursor).toBeNull();
  });

  it("分页读取 turns 时不返回页内重置的 turnIndex", async () => {
    const peer = new FakePeer();
    const client = new CodexAppServerClient(peer);

    const page = await client.listThreadTurns({ threadId: "thread-1", cursor: "turn-older", limit: 30 });

    expect(page.items).toEqual([
      expect.not.objectContaining({ turnIndex: expect.any(Number) })
    ]);
  });

  it("metadata 读取不会附带 userMessage 图片内容", async () => {
    const peer = new FakePeer();
    const originalRequest = peer.request.bind(peer);
    const turns = [
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
            id: "item-user-image",
            clientId: "client-user-image",
            content: [
              { type: "text", text: "请看这张图", text_elements: [] },
              { type: "localImage", path: "C:\\Users\\huang\\AppData\\Local\\Temp\\shot.png" }
            ]
          }
        ]
      }
    ];
    peer.request = async (method, params) => {
      if (method === "thread/read") {
        return {
          thread: {
            id: "thread-1",
            sessionId: "session-1",
            forkedFromId: null,
            parentThreadId: null,
            preview: "看图",
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
            name: "图片会话",
            turns: []
          }
        };
      }
      if (method === "thread/turns/list") {
        return { data: turns, nextCursor: null, backwardsCursor: null };
      }
      return originalRequest(method, params);
    };
    const client = new CodexAppServerClient(peer);

    await expect(client.readThreadMetadata("thread-1")).resolves.toMatchObject({ timeline: [] });
  });

  it("metadata 读取不会附带 MCP 工具内容", async () => {
    const peer = new FakePeer();
    const originalRequest = peer.request.bind(peer);
    const turns = [
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
            type: "mcpToolCall",
            id: "tool-1",
            server: "filesystem",
            tool: "read_file",
            status: "completed",
            arguments: { path: "README.md" },
            pluginId: null,
            result: { content: [{ type: "text", text: "README content" }], isError: false },
            error: null,
            durationMs: 12
          }
        ]
      }
    ];
    peer.request = async (method, params) => {
      if (method === "thread/read") {
        return {
          thread: {
            id: "thread-1",
            sessionId: "session-1",
            forkedFromId: null,
            parentThreadId: null,
            preview: "工具",
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
            name: "工具会话",
            turns: []
          }
        };
      }
      if (method === "thread/turns/list") {
        return { data: turns, nextCursor: null, backwardsCursor: null };
      }
      return originalRequest(method, params);
    };
    const client = new CodexAppServerClient(peer);

    await expect(client.readThreadMetadata("thread-1")).resolves.toMatchObject({ timeline: [] });
  });

  it("metadata 读取不会附带失败 turn 错误内容", async () => {
    const peer = new FakePeer();
    const originalRequest = peer.request.bind(peer);
    const turns = [
      {
        id: "turn-failed",
        itemsView: { type: "complete" },
        status: { type: "failed" },
        error: {
          message: "API 调用失败",
          codexErrorInfo: null,
          additionalDetails: "502 Bad Gateway"
        },
        startedAt: 101,
        completedAt: 199,
        durationMs: 98000,
        items: []
      }
    ];
    peer.request = async (method, params) => {
      if (method === "thread/read") {
        return {
          thread: {
            id: "thread-1",
            sessionId: "session-1",
            forkedFromId: null,
            parentThreadId: null,
            preview: "错误",
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
            name: "错误会话",
            turns: []
          }
        };
      }
      if (method === "thread/turns/list") {
        return { data: turns, nextCursor: null, backwardsCursor: null };
      }
      return originalRequest(method, params);
    };
    const client = new CodexAppServerClient(peer);

    await expect(client.readThreadMetadata("thread-1")).resolves.toMatchObject({ timeline: [] });
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
        { id: "item-resume-user-1", turnId: "turn-resume-1", turnIndex: 0, role: "user", text: "恢复这个会话" },
        { id: "item-resume-agent-1", turnId: "turn-resume-1", turnIndex: 0, role: "agent", text: "已恢复会话。" }
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

  it("thread/resume 缺少 initialTurnsPage 时丢弃非兼容 response.thread.turns", async () => {
    const peer = new FakePeer();
    const originalRequest = peer.request.bind(peer);
    peer.request = async (method, params) => {
      peer.calls.push({ method, params });
      if (method === "thread/resume") {
        const response = await originalRequest(method, params) as {
          thread: { turns?: unknown[] };
          initialTurnsPage?: unknown;
        };
        const turnPage = await originalRequest("thread/turns/list", {
          threadId: "thread-1",
          limit: 30,
          sortDirection: "desc",
          itemsView: "full"
        }) as { data: unknown[] };
        return {
          ...response,
          initialTurnsPage: undefined,
          thread: {
            ...response.thread,
            turns: Array.from({ length: 40 }, (_, index) => ({
              ...(turnPage.data[0] as object),
              id: `unexpected-resume-turn-${index}`
            }))
          }
        };
      }
      return originalRequest(method, params);
    };
    const client = new CodexAppServerClient(peer);

    const detail = await client.resumeThread("thread-1");

    expect(detail.timeline).toEqual([]);
    expect(detail.nextCursor).toBeNull();
  });

  it("thread/resume 会把 desc 初始 turns 页转换为会话正序", async () => {
    const peer = new FakePeer();
    const originalRequest = peer.request.bind(peer);
    peer.request = async (method, params) => {
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
            updatedAt: 300,
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
                id: "turn-new",
                itemsView: { type: "complete" },
                status: { type: "completed" },
                error: null,
                startedAt: 201,
                completedAt: 299,
                durationMs: 98000,
                items: [{ type: "agentMessage", id: "item-new", text: "新回复", phase: "final", memoryCitation: null }]
              },
              {
                id: "turn-old",
                itemsView: { type: "complete" },
                status: { type: "completed" },
                error: null,
                startedAt: 101,
                completedAt: 199,
                durationMs: 98000,
                items: [
                  {
                    type: "userMessage",
                    id: "item-old",
                    clientId: "client-old",
                    content: [{ type: "text", text: "旧请求", text_elements: [] }]
                  }
                ]
              }
            ],
            nextCursor: "older",
            backwardsCursor: null
          }
        };
      }

      return originalRequest(method, params);
    };
    const client = new CodexAppServerClient(peer);

    await expect(client.resumeThread("thread-1")).resolves.toMatchObject({
      lastTurnId: "turn-new",
      timeline: [
        { id: "item-old", turnId: "turn-old", turnIndex: 0, role: "user", text: "旧请求" },
        { id: "item-new", turnId: "turn-new", turnIndex: 1, role: "agent", text: "新回复" }
      ]
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

  it("能管理 Codex 账号登录状态", async () => {
    const peer = new FakePeer();
    const client = new CodexAppServerClient(peer);

    await expect(client.loginWithChatGpt()).resolves.toEqual({
      type: "chatgpt",
      loginId: "login-1",
      authUrl: "https://auth.openai.com/codex"
    });
    await expect(client.loginWithApiKey("sk-test")).resolves.toEqual({ type: "apiKey" });
    await expect(client.cancelAccountLogin("login-1")).resolves.toEqual({ status: "canceled" });
    await expect(client.logoutAccount()).resolves.toBeUndefined();

    expect(peer.calls.slice(-4)).toEqual([
      { method: "account/login/start", params: { type: "chatgpt", codexStreamlinedLogin: true } },
      { method: "account/login/start", params: { type: "apiKey", apiKey: "sk-test" } },
      { method: "account/login/cancel", params: { loginId: "login-1" } },
      { method: "account/logout", params: undefined }
    ]);
  });

  it("能用 cwd、模型、思考强度和权限启动新会话", async () => {
    const peer = new FakePeer();
    const client = new CodexAppServerClient(peer);

    const thread = await client.startThread({
      cwd: "C:\\Users\\huang\\workspace\\demo",
      workspaceRoots: ["C:\\Users\\huang\\workspace"],
      model: "gpt-5-codex",
      permissions: ":workspace",
      approvalsReviewer: "auto_review"
    });

    expect(thread.id).toBe("new-thread-1");
    expect(peer.calls.at(-1)).toEqual({
      method: "thread/start",
      params: {
        cwd: "C:\\Users\\huang\\workspace\\demo",
        runtimeWorkspaceRoots: ["C:\\Users\\huang\\workspace"],
        model: "gpt-5-codex",
        permissions: ":workspace",
        approvalsReviewer: "auto_review"
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
      reasoningSummary: "auto",
      permissions: ":workspace",
      approvalsReviewer: "auto_review",
      additionalContext: {
        "codex-web:collaboration-mode": {
          kind: "application",
          value: "# Collaboration Mode: Plan"
        }
      },
      collaborationMode: {
        mode: "plan",
        settings: {
          model: "gpt-5-codex",
          reasoning_effort: "high",
          developer_instructions: null
        }
      }
    });

    expect(result.turnId).toBe("turn-new-1");
    expect(peer.calls.at(-1)).toEqual({
      method: "turn/start",
      params: {
        threadId: "thread-1",
        input: [{ type: "text", text: "继续开发发送功能", text_elements: [] }],
        model: "gpt-5-codex",
        effort: "high",
        summary: "auto",
        permissions: ":workspace",
        approvalsReviewer: "auto_review",
        additionalContext: {
          "codex-web:collaboration-mode": {
            kind: "application",
            value: "# Collaboration Mode: Plan"
          }
        },
        collaborationMode: {
          mode: "plan",
          settings: {
            model: "gpt-5-codex",
            reasoning_effort: "high",
            developer_instructions: null
          }
        }
      }
    });
  });

  it("能把 permissions null 转发为 turn/start 清除权限 override", async () => {
    const peer = new FakePeer();
    const client = new CodexAppServerClient(peer);

    await client.startTurn({
      threadId: "thread-1",
      text: "回到配置默认权限",
      permissions: null,
      approvalsReviewer: null
    });

    expect(peer.calls.at(-1)).toMatchObject({
      method: "turn/start",
      params: {
        threadId: "thread-1",
        permissions: null,
        approvalsReviewer: null
      }
    });
  });

  it("转发 turn/start 前会把旧版 ask collaboration mode 规整为 plan", async () => {
    const peer = new FakePeer();
    const client = new CodexAppServerClient(peer);

    await client.startTurn({
      threadId: "thread-1",
      text: "只做计划",
      collaborationMode: {
        mode: "ask",
        settings: {
          model: "gpt-5-codex",
          reasoning_effort: null,
          developer_instructions: null
        }
      } as never
    });

    expect(peer.calls.at(-1)).toMatchObject({
      method: "turn/start",
      params: {
        collaborationMode: expect.objectContaining({ mode: "plan" })
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

  it("能把 Skill 引用作为结构化 UserInput 发送为 turn/start", async () => {
    const peer = new FakePeer();
    const client = new CodexAppServerClient(peer);

    await client.startTurn({
      threadId: "thread-1",
      text: "查一下官方文档",
      skillReferences: [
        {
          name: "openai-docs",
          path: "C:\\Users\\huang\\.codex\\skills\\openai-docs\\SKILL.md"
        }
      ]
    });

    expect(peer.calls.at(-1)).toMatchObject({
      method: "turn/start",
      params: {
        threadId: "thread-1",
        input: [
          { type: "text", text: "查一下官方文档", text_elements: [] },
          { type: "skill", name: "openai-docs", path: "C:\\Users\\huang\\.codex\\skills\\openai-docs\\SKILL.md" }
        ]
      }
    });
  });

  it("能把 thread/resume 的权限 payload 映射到移动端会话详情", async () => {
    const client = new CodexAppServerClient(new ActivePermissionProfilePeer());

    await expect(client.resumeThread("thread-1")).resolves.toMatchObject({
      activePermissionProfile: { id: ":workspace", extends: "default" },
      approvalsReviewer: "auto_review"
    });
  });

  it("能 fork 当前会话", async () => {
    const peer = new FakePeer();
    const client = new CodexAppServerClient(peer);

    const thread = await client.forkThread("thread-1");

    expect(thread.id).toBe("fork-thread-1");
    expect(peer.calls.at(-1)).toEqual({
      method: "thread/fork",
      params: { threadId: "thread-1", excludeTurns: true }
    });
  });

  it("能 rollback 当前会话", async () => {
    const peer = new FakePeer();
    const client = new CodexAppServerClient(peer);

    const thread = await client.rollbackThread("thread-1", 1);

    expect(thread.id).toBe("thread-1");
    expect(peer.calls).toContainEqual({
      method: "thread/rollback",
      params: { threadId: "thread-1", numTurns: 1 }
    });
  });

  it("rollback 后保留最近 turns 窗口的分页 cursor", async () => {
    const peer = new FakePeer();
    const client = new CodexAppServerClient(peer);

    const thread = await client.rollbackThread("thread-1", 1);

    expect(thread.nextCursor).toBe("turn-older");
    expect(peer.calls).toContainEqual({
      method: "thread/turns/list",
      params: {
        threadId: "thread-1",
        limit: 30,
        sortDirection: "desc",
        itemsView: "full"
      }
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

  it("能归档、恢复归档和删除当前会话", async () => {
    const peer = new FakePeer();
    const client = new CodexAppServerClient(peer);

    await expect(client.archiveThread("thread-1")).resolves.toBeUndefined();
    await expect(client.unarchiveThread("thread-1")).resolves.toMatchObject({
      id: "thread-1",
      title: "已恢复"
    });
    await expect(client.deleteThread("thread-1")).resolves.toBeUndefined();

    expect(peer.calls.slice(-3)).toEqual([
      { method: "thread/archive", params: { threadId: "thread-1" } },
      { method: "thread/unarchive", params: { threadId: "thread-1" } },
      { method: "thread/delete", params: { threadId: "thread-1" } }
    ]);
  });

  it("能取消订阅当前会话", async () => {
    const peer = new FakePeer();
    const client = new CodexAppServerClient(peer);

    await expect(client.unsubscribeThread("thread-1")).resolves.toEqual({ status: "unsubscribed" });

    expect(peer.calls.at(-1)).toEqual({
      method: "thread/unsubscribe",
      params: { threadId: "thread-1" }
    });
  });

  it("能在会话上下文执行 shell command", async () => {
    const peer = new FakePeer();
    const client = new CodexAppServerClient(peer);

    await expect(client.runThreadShellCommand("thread-1", "npm test -- --runInBand")).resolves.toBeUndefined();

    expect(peer.calls.at(-1)).toEqual({
      method: "thread/shellCommand",
      params: { threadId: "thread-1", command: "npm test -- --runInBand" }
    });
  });

  it("能增加和减少会话 elicitation 计数", async () => {
    const peer = new FakePeer();
    const client = new CodexAppServerClient(peer);

    await expect(client.incrementThreadElicitation("thread-1")).resolves.toEqual({ count: 1, paused: true });
    await expect(client.decrementThreadElicitation("thread-1")).resolves.toEqual({ count: 0, paused: false });

    expect(peer.calls.slice(-2)).toEqual([
      { method: "thread/increment_elicitation", params: { threadId: "thread-1" } },
      { method: "thread/decrement_elicitation", params: { threadId: "thread-1" } }
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
        permissions: ":danger-full-access",
        approvalsReviewer: null,
        collaborationMode: {
          mode: "default",
          settings: {
            model: "gpt-5-mini",
            reasoning_effort: "high",
            developer_instructions: null
          }
        }
      })
    ).resolves.toBeUndefined();

    expect(peer.calls.at(-1)).toEqual({
      method: "thread/settings/update",
      params: {
        threadId: "thread-1",
        model: "gpt-5-mini",
        effort: "high",
        permissions: ":danger-full-access",
        approvalsReviewer: null,
        collaborationMode: {
          mode: "default",
          settings: {
            model: "gpt-5-mini",
            reasoning_effort: "high",
            developer_instructions: null
          }
        }
      }
    });
  });

  it("能用 permissions null 和 approvalsReviewer null 更新当前会话设置以回到 config.toml", async () => {
    const peer = new FakePeer();
    const client = new CodexAppServerClient(peer);

    await expect(
      client.updateThreadSettings({
        threadId: "thread-1",
        permissions: null,
        approvalsReviewer: null
      })
    ).resolves.toBeUndefined();

    expect(peer.calls.at(-1)).toEqual({
      method: "thread/settings/update",
      params: {
        threadId: "thread-1",
        permissions: null,
        approvalsReviewer: null
      }
    });
  });

  it("能单独读取 collaboration mode preset 列表", async () => {
    const peer = new FakePeer();
    const client = new CodexAppServerClient(peer);

    await expect(client.listCollaborationModes()).resolves.toEqual([
      { name: "Code", mode: "default", model: "gpt-5-codex", reasoningEffort: "medium" },
      { name: "Ask", mode: "ask", model: null, reasoningEffort: null }
    ]);

    expect(peer.calls.at(-1)).toEqual({ method: "collaborationMode/list", params: {} });
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

  it("能写入、创建、复制、删除文件并读取元数据", async () => {
    const peer = new FakePeer();
    const client = new CodexAppServerClient(peer);

    await expect(client.writeFile("C:\\Users\\huang\\workspace\\demo\\README.md", "# 已更新")).resolves.toBeUndefined();
    await expect(client.createDirectory("C:\\Users\\huang\\workspace\\demo\\docs")).resolves.toBeUndefined();
    await expect(
      client.copyPath("C:\\Users\\huang\\workspace\\demo\\README.md", "C:\\Users\\huang\\workspace\\demo\\README.copy.md")
    ).resolves.toBeUndefined();
    await expect(client.removePath("C:\\Users\\huang\\workspace\\demo\\README.copy.md")).resolves.toBeUndefined();
    await expect(client.getMetadata("C:\\Users\\huang\\workspace\\demo\\README.md")).resolves.toEqual({
      isDirectory: false,
      isFile: true,
      isSymlink: false,
      createdAtMs: 1_700_000_000_000,
      modifiedAtMs: 1_800_000_000_000
    });

    expect(peer.calls.slice(-5)).toEqual([
      {
        method: "fs/writeFile",
        params: {
          path: "C:\\Users\\huang\\workspace\\demo\\README.md",
          dataBase64: Buffer.from("# 已更新", "utf8").toString("base64")
        }
      },
      {
        method: "fs/createDirectory",
        params: { path: "C:\\Users\\huang\\workspace\\demo\\docs", recursive: true }
      },
      {
        method: "fs/copy",
        params: {
          sourcePath: "C:\\Users\\huang\\workspace\\demo\\README.md",
          destinationPath: "C:\\Users\\huang\\workspace\\demo\\README.copy.md",
          recursive: true
        }
      },
      {
        method: "fs/remove",
        params: { path: "C:\\Users\\huang\\workspace\\demo\\README.copy.md", recursive: true, force: true }
      },
      { method: "fs/getMetadata", params: { path: "C:\\Users\\huang\\workspace\\demo\\README.md" } }
    ]);
  });

  it("能启动和停止文件系统监听", async () => {
    const peer = new FakePeer();
    const client = new CodexAppServerClient(peer);

    await expect(client.watchPath("watch-1", "C:\\repo\\src")).resolves.toEqual({
      watchId: "watch-1",
      path: "C:\\repo\\src"
    });
    await expect(client.unwatchPath("watch-1")).resolves.toBeUndefined();

    expect(peer.calls.slice(-2)).toEqual([
      { method: "fs/watch", params: { watchId: "watch-1", path: "C:\\repo\\src" } },
      { method: "fs/unwatch", params: { watchId: "watch-1" } }
    ]);
  });

  it("能搜索文件并整理成移动端结果", async () => {
    const peer = new FakePeer();
    const client = new CodexAppServerClient(peer);

    await expect(client.searchFiles({ query: "app", roots: ["C:\\repo"] })).resolves.toEqual([
      {
        root: "C:\\repo",
        path: "src\\app.ts",
        fullPath: "C:\\repo\\src\\app.ts",
        fileName: "app.ts",
        matchType: "file",
        score: 99,
        indices: [0, 1, 2]
      }
    ]);

    expect(peer.calls.at(-1)).toEqual({
      method: "fuzzyFileSearch",
      params: { query: "app", roots: ["C:\\repo"], cancellationToken: null }
    });
  });

  it("能管理会话式文件搜索", async () => {
    const peer = new FakePeer();
    const client = new CodexAppServerClient(peer);

    await expect(
      client.startFileSearchSession({ sessionId: "search-1", roots: ["C:\\repo"] })
    ).resolves.toBeUndefined();
    await expect(client.updateFileSearchSession("search-1", "app")).resolves.toBeUndefined();
    await expect(client.stopFileSearchSession("search-1")).resolves.toBeUndefined();

    expect(peer.calls.slice(-3)).toEqual([
      { method: "fuzzyFileSearch/sessionStart", params: { sessionId: "search-1", roots: ["C:\\repo"] } },
      { method: "fuzzyFileSearch/sessionUpdate", params: { sessionId: "search-1", query: "app" } },
      { method: "fuzzyFileSearch/sessionStop", params: { sessionId: "search-1" } }
    ]);
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

  it("能启动并控制 command exec 会话", async () => {
    const peer = new FakePeer();
    const client = new CodexAppServerClient(peer);

    await expect(
      client.startCommandExec({
        processId: "cmd-1",
        command: ["node", "-i"],
        cwd: "C:\\repo"
      })
    ).resolves.toEqual({
      exitCode: 0,
      stdout: "ok",
      stderr: ""
    });
    await expect(client.writeCommandExec("cmd-1", "继续\n")).resolves.toBeUndefined();
    await expect(client.resizeCommandExec("cmd-1", 100, 30)).resolves.toBeUndefined();
    await expect(client.terminateCommandExec("cmd-1")).resolves.toBeUndefined();

    expect(peer.calls.slice(-4)).toEqual([
      {
        method: "command/exec",
        params: {
          processId: "cmd-1",
          command: ["node", "-i"],
          cwd: "C:\\repo",
          tty: true,
          streamStdin: true,
          streamStdoutStderr: true,
          timeoutMs: null,
          size: { cols: 80, rows: 24 }
        }
      },
      {
        method: "command/exec/write",
        params: { processId: "cmd-1", deltaBase64: "57un57utCg==", closeStdin: false }
      },
      {
        method: "command/exec/resize",
        params: { processId: "cmd-1", size: { cols: 100, rows: 30 } }
      },
      {
        method: "command/exec/terminate",
        params: { processId: "cmd-1" }
      }
    ]);
  });

  it("能启动交互式终端会话、写入 stdin 并终止进程", async () => {
    const peer = new FakePeer();
    const client = new CodexAppServerClient(peer);

    await expect(
      client.startProcess({
        processHandle: "mobile-process-1",
        command: ["npm", "test"],
        cwd: "C:\\repo"
      })
    ).resolves.toBeUndefined();
    await expect(client.writeProcessStdin("mobile-process-1", "继续\n")).resolves.toBeUndefined();
    await expect(client.resizeProcessPty("mobile-process-1", 100, 30)).resolves.toBeUndefined();
    await expect(client.killProcess("mobile-process-1")).resolves.toBeUndefined();

    expect(peer.calls.slice(-4)).toEqual([
      {
        method: "process/spawn",
        params: {
          processHandle: "mobile-process-1",
          command: ["npm", "test"],
          cwd: "C:\\repo",
          tty: true,
          streamStdin: true,
          streamStdoutStderr: true,
          outputBytesCap: null,
          timeoutMs: null,
          size: { cols: 80, rows: 24 }
        }
      },
      {
        method: "process/writeStdin",
        params: {
          processHandle: "mobile-process-1",
          deltaBase64: Buffer.from("继续\n", "utf8").toString("base64"),
          closeStdin: false
        }
      },
      {
        method: "process/resizePty",
        params: { processHandle: "mobile-process-1", size: { cols: 100, rows: 30 } }
      },
      { method: "process/kill", params: { processHandle: "mobile-process-1" } }
    ]);
  });

  it("能管理会话后台终端", async () => {
    const peer = new FakePeer();
    const client = new CodexAppServerClient(peer);

    await expect(client.listThreadBackgroundTerminals({ threadId: "thread-1" })).resolves.toEqual({
      terminals: [
        {
          itemId: "item-bg-1",
          processId: "bg-proc-1",
          command: "npm run dev",
          cwd: "C:\\repo",
          osPid: 4242,
          cpuPercent: 1.5,
          rssKb: 2048
        }
      ],
      nextCursor: null
    });
    await expect(client.terminateThreadBackgroundTerminal("thread-1", "bg-proc-1")).resolves.toEqual({
      terminated: true
    });
    await expect(client.cleanThreadBackgroundTerminals("thread-1")).resolves.toBeUndefined();

    expect(peer.calls.slice(-3)).toEqual([
      { method: "thread/backgroundTerminals/list", params: { threadId: "thread-1", cursor: undefined, limit: undefined } },
      { method: "thread/backgroundTerminals/terminate", params: { threadId: "thread-1", processId: "bg-proc-1" } },
      { method: "thread/backgroundTerminals/clean", params: { threadId: "thread-1" } }
    ]);
  });

  it("能只通过 config/read 读取默认模型设置", async () => {
    const peer = new FakePeer();
    const client = new CodexAppServerClient(peer);

    await expect(client.readModelDefaults()).resolves.toEqual({
      model: "gpt-5-codex",
      modelProvider: "openai",
      reasoningEffort: "medium",
      reasoningSummary: "auto"
    });

    expect(peer.calls).toEqual([{ method: "config/read", params: {} }]);
  });

  it("能轻量读取会话摘要", async () => {
    const peer = new FakePeer();
    const client = new CodexAppServerClient(peer);

    await expect(client.readThreadSummary("thread-1")).resolves.toMatchObject({
      id: "thread-1",
      cwd: "C:\\Users\\huang\\workspace\\demo"
    });

    expect(peer.calls).toEqual([
      { method: "thread/read", params: { threadId: "thread-1", includeTurns: false } }
    ]);
  });

  it("能按 cwd 读取 Skill 列表", async () => {
    const peer = new FakePeer();
    const client = new CodexAppServerClient(peer);

    await expect(
      client.listSkills({ enabledOnly: false, forceReload: true, cwds: ["C:\\Users\\huang\\workspace\\demo"] })
    ).resolves.toMatchObject({
      skills: expect.arrayContaining([
        expect.objectContaining({ name: "openai-docs", enabled: true }),
        expect.objectContaining({ name: "repo-helper", enabled: false })
      ])
    });

    expect(peer.calls).toEqual([
      {
        method: "skills/list",
        params: { forceReload: true, cwds: ["C:\\Users\\huang\\workspace\\demo"] }
      }
    ]);
  });

  it("能读取设置状态", async () => {
    const peer = new FakePeer();
    const client = new CodexAppServerClient(peer);

    await expect(client.readSettings()).resolves.toEqual({
      model: "gpt-5-codex",
      modelProvider: "openai",
      reasoningEffort: "medium",
      reasoningSummary: "auto",
      approvalPolicy: "untrusted",
      sandboxMode: "workspace-write",
      loadedThreadIds: ["thread-1", "thread-2"],
      experimentalFeatures: [
        {
          name: "appshots",
          stage: "beta",
          displayName: "Appshots",
          description: "自动保存应用截图",
          announcement: "Appshots 已可试用",
          enabled: false,
          defaultEnabled: false
        }
      ],
      authStatus: {
        authMethod: "chatgpt",
        hasAuthToken: false,
        requiresOpenaiAuth: false
      },
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
        resetsAt: 1_800_000_000,
        resetCreditsAvailable: 1
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
          resourceTemplateCount: 0,
          resources: [{ uri: "file:///README.md", name: "README", mimeType: "text/markdown" }]
        },
        {
          name: "github",
          authStatus: "notLoggedIn",
          toolCount: 1,
          resourceCount: 0,
          resourceTemplateCount: 0,
          resources: []
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
          path: "C:\\Users\\huang\\.codex\\skills\\openai-docs\\SKILL.md",
          description: "查询 OpenAI 官方文档",
          shortDescription: "OpenAI 文档",
          scope: "user",
          enabled: true
        },
        {
          cwd: "C:\\Users\\huang\\workspace\\demo",
          name: "repo-helper",
          path: "C:\\Users\\huang\\workspace\\demo\\.codex\\skills\\repo-helper\\SKILL.md",
          description: "项目内辅助技能",
          shortDescription: null,
          scope: "repo",
          enabled: false
        }
      ],
      skillErrors: [{ cwd: "C:\\Users\\huang\\workspace\\demo", path: "C:\\broken\\SKILL.md", message: "缺少 description" }],
      hooks: [
        {
          cwd: "C:\\Users\\huang\\workspace\\demo",
          key: "post-tool-use-format",
          eventName: "postToolUse",
          handlerType: "command",
          matcher: "Edit",
          command: "npm run format",
          source: "project",
          sourcePath: "C:\\Users\\huang\\workspace\\demo\\.codex\\hooks.json",
          pluginId: null,
          enabled: true,
          trustStatus: "trusted",
          statusMessage: "格式化文件"
        }
      ],
      hookWarnings: [{ cwd: "C:\\Users\\huang\\workspace\\demo", message: "hook 即将迁移" }],
      hookErrors: [{ cwd: "C:\\Users\\huang\\workspace\\demo", path: "C:\\bad-hook.json", message: "hook JSON 无效" }],
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
        { method: "getAuthStatus", params: { includeToken: false, refreshToken: false } },
        { method: "account/rateLimits/read", params: undefined },
        { method: "mcpServerStatus/list", params: { detail: "full", limit: 50 } },
        { method: "modelProvider/capabilities/read", params: {} },
        { method: "collaborationMode/list", params: {} },
        { method: "skills/list", params: { forceReload: false } },
        { method: "hooks/list", params: {} },
        { method: "plugin/list", params: { cwds: null, marketplaceKinds: null } },
        { method: "thread/loaded/list", params: { cursor: undefined, limit: 50 } },
        { method: "experimentalFeature/list", params: { cursor: undefined, limit: 50, threadId: undefined } },
        { method: "remoteControl/client/list", params: { environmentId: "env-1", limit: 20, order: "desc" } }
      ])
    );
  });

  it("能写入单项和批量全局配置", async () => {
    const peer = new FakePeer();
    const client = new CodexAppServerClient(peer);

    await expect(client.writeConfigValue("model", "gpt-5-mini")).resolves.toEqual({
      status: "written",
      version: "config-version-2",
      filePath: "C:\\Users\\huang\\.codex\\config.toml"
    });
    await expect(
      client.writeConfigBatch([
        { keyPath: "model", value: "gpt-5-mini" },
        { keyPath: "model_reasoning_effort", value: "high" },
        { keyPath: "approval_policy", value: "on-request" },
        { keyPath: "sandbox_mode", value: "read-only" }
      ])
    ).resolves.toEqual({
      status: "written",
      version: "config-version-2",
      filePath: "C:\\Users\\huang\\.codex\\config.toml"
    });

    expect(peer.calls.slice(-2)).toEqual([
      {
        method: "config/value/write",
        params: {
          keyPath: "model",
          value: "gpt-5-mini",
          mergeStrategy: "replace",
          filePath: null,
          expectedVersion: null
        }
      },
      {
        method: "config/batchWrite",
        params: {
          edits: [
            { keyPath: "model", value: "gpt-5-mini", mergeStrategy: "replace" },
            { keyPath: "model_reasoning_effort", value: "high", mergeStrategy: "replace" },
            { keyPath: "approval_policy", value: "on-request", mergeStrategy: "replace" },
            { keyPath: "sandbox_mode", value: "read-only", mergeStrategy: "replace" }
          ],
          filePath: null,
          expectedVersion: null,
          reloadUserConfig: true
        }
      }
    ]);
  });

  it("能设置实验功能启用状态", async () => {
    const peer = new FakePeer();
    const client = new CodexAppServerClient(peer);

    await expect(client.setExperimentalFeatureEnablement("appshots", true)).resolves.toBeUndefined();

    expect(peer.calls.at(-1)).toEqual({
      method: "experimentalFeature/enablement/set",
      params: { enablement: { appshots: true } }
    });
  });

  it("能刷新 MCP、启动 OAuth 登录并读取资源", async () => {
    const peer = new FakePeer();
    const client = new CodexAppServerClient(peer);

    await expect(client.refreshMcpServer()).resolves.toBeUndefined();
    await expect(client.loginMcpServer("github")).resolves.toEqual({ authorizationUrl: "https://example.com/mcp/oauth" });
    await expect(
      client.readMcpResource({ server: "filesystem", uri: "file:///README.md", threadId: "thread-1" })
    ).resolves.toEqual({
      contents: [{ uri: "file:///README.md", mimeType: "text/markdown", text: "# README" }]
    });

    expect(peer.calls.slice(-3)).toEqual([
      { method: "config/mcpServer/reload", params: undefined },
      { method: "mcpServer/oauth/login", params: { name: "github" } },
      {
        method: "mcpServer/resource/read",
        params: { server: "filesystem", uri: "file:///README.md", threadId: "thread-1" }
      }
    ]);
  });

  it("能读取账号 token 用量、消费重置额度 credit 并发送加购提醒", async () => {
    const peer = new FakePeer();
    const client = new CodexAppServerClient(peer);

    await expect(client.getAccountTokenUsage()).resolves.toEqual({
      summary: {
        lifetimeTokens: 123456,
        peakDailyTokens: 45678,
        longestRunningTurnSec: 321,
        currentStreakDays: 7,
        longestStreakDays: 21
      },
      dailyUsageBuckets: [{ startDate: "2026-06-23", tokens: 1200 }]
    });
    await expect(client.consumeRateLimitResetCredit("reset-key-1")).resolves.toEqual({ outcome: "reset" });
    await expect(client.sendAddCreditsNudgeEmail("credits")).resolves.toEqual({ status: "sent" });

    expect(peer.calls.slice(-3)).toEqual([
      { method: "account/usage/read", params: undefined },
      { method: "account/rateLimitResetCredit/consume", params: { idempotencyKey: "reset-key-1" } },
      { method: "account/sendAddCreditsNudgeEmail", params: { creditType: "credits" } }
    ]);
  });

  it("能读取 Codex 鉴权状态且默认不包含 token", async () => {
    const peer = new FakePeer();
    const client = new CodexAppServerClient(peer);

    await expect(client.getAuthStatus()).resolves.toEqual({
      authMethod: "chatgpt",
      hasAuthToken: false,
      requiresOpenaiAuth: false
    });

    expect(peer.calls.at(-1)).toEqual({
      method: "getAuthStatus",
      params: { includeToken: false, refreshToken: false }
    });
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
      remotePluginId: null,
      name: "browser-tools",
      displayName: "浏览器工具",
      description: "用于移动端验证网页和截图。",
      installed: true,
      enabled: true,
      authPolicy: "ON_USE",
      installPolicy: "AVAILABLE",
      availability: "AVAILABLE",
      skillCount: 1,
      skills: [{ name: "browser:control", description: "控制浏览器", enabled: true }],
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

  it("能读取 Apps 列表", async () => {
    const peer = new FakePeer();
    const client = new CodexAppServerClient(peer);

    await expect(client.listApps()).resolves.toEqual({
      apps: [
        {
          id: "browser-app",
          name: "Browser",
          description: "控制浏览器。",
          category: "tool",
          developer: "OpenAI",
          installUrl: null,
          isAccessible: true,
          isEnabled: true,
          pluginDisplayNames: ["浏览器工具"]
        }
      ],
      nextCursor: null
    });

    expect(peer.calls.at(-1)).toEqual({ method: "app/list", params: { cursor: undefined, limit: undefined, threadId: undefined, forceRefetch: undefined } });
  });

  it("能读取配置要求和管理 Windows Sandbox", async () => {
    const peer = new FakePeer();
    const client = new CodexAppServerClient(peer);

    await expect(client.getConfigRequirements()).resolves.toEqual({
      allowedApprovalPolicies: ["untrusted"],
      allowedSandboxModes: ["workspace-write"],
      allowedWindowsSandboxImplementations: ["unelevated"],
      allowedPermissionProfiles: { default: true },
      defaultPermissions: "default",
      allowManagedHooksOnly: false,
      allowAppshots: true,
      allowRemoteControl: true,
      featureRequirements: { skills: true }
    });
    await expect(client.getWindowsSandboxReadiness()).resolves.toEqual({ status: "updateRequired" });
    await expect(client.startWindowsSandboxSetup({ mode: "unelevated", cwd: "C:\\repo" })).resolves.toEqual({
      started: true
    });

    expect(peer.calls.slice(-3)).toEqual([
      { method: "configRequirements/read", params: undefined },
      { method: "windowsSandbox/readiness", params: undefined },
      { method: "windowsSandbox/setupStart", params: { mode: "unelevated", cwd: "C:\\repo" } }
    ]);
  });

  it("能读取插件 Skill、设置额外根目录并写入 Skill 配置", async () => {
    const peer = new FakePeer();
    const client = new CodexAppServerClient(peer);

    await expect(
      client.readPluginSkill({
        remoteMarketplaceName: "个人插件市场",
        remotePluginId: "remote-browser-tools",
        skillName: "browser:control"
      })
    ).resolves.toEqual({ contents: "# browser:control\n\n控制浏览器。" });
    await expect(client.setSkillsExtraRoots(["C:\\Users\\huang\\workspace\\skills"])).resolves.toBeUndefined();
    await expect(client.writeSkillConfig({ name: "openai-docs", enabled: false })).resolves.toEqual({
      effectiveEnabled: false
    });

    expect(peer.calls).toEqual(
      expect.arrayContaining([
        {
          method: "plugin/skill/read",
          params: {
            remoteMarketplaceName: "个人插件市场",
            remotePluginId: "remote-browser-tools",
            skillName: "browser:control"
          }
        },
        { method: "skills/extraRoots/set", params: { extraRoots: ["C:\\Users\\huang\\workspace\\skills"] } },
        { method: "skills/config/write", params: { name: "openai-docs", path: null, enabled: false } }
      ])
    );
  });

  it("统一通过 thread/items/list 分页读取整个会话或指定 turn", async () => {
    const peer = new FakePeer();
    const client = new CodexAppServerClient(peer);

    await expect(client.listThreadTurns({ threadId: "thread-1", cursor: "cursor-1", limit: 10 })).resolves.toEqual({
      items: [{ id: "item-page-agent-1", role: "agent", text: "分页 turn" }],
      nextCursor: "item-next"
    });
    expect(peer.calls.at(-1)).toEqual({
      method: "thread/items/list",
      params: {
        threadId: "thread-1",
        cursor: "cursor-1",
        limit: 10,
        sortDirection: "desc"
      }
    });

    await expect(
      client.listThreadTurnItems({ threadId: "thread-1", turnId: "turn-page-1", cursor: "cursor-2", limit: 20 })
    ).resolves.toEqual({
      items: [{ id: "item-page-agent-2", turnId: "turn-page-1", role: "agent", text: "分页 item" }],
      nextCursor: "item-next"
    });
    expect(peer.calls.at(-1)).toEqual({
      method: "thread/items/list",
      params: {
        threadId: "thread-1",
        turnId: "turn-page-1",
        cursor: "cursor-2",
        limit: 20,
        sortDirection: "desc"
      }
    });
  });

  it("legacy 会话仅回退到固定一个 turn 的游标页", async () => {
    const peer = new FakePeer();
    const originalRequest = peer.request.bind(peer);
    peer.request = async (method, params) => {
      peer.calls.push({ method, params });
      if (method === "thread/items/list") {
        throw new Error("thread/items/list is not supported yet");
      }
      return originalRequest(method, params);
    };
    const client = new CodexAppServerClient(peer);

    await client.listThreadTurns({ threadId: "thread-1", cursor: "legacy-cursor", limit: 100 });

    expect(peer.calls).toContainEqual({
      method: "thread/turns/list",
      params: {
        threadId: "thread-1",
        cursor: "legacy-cursor",
        limit: 1,
        sortDirection: "desc",
        itemsView: "full"
      }
    });
  });

  it("legacy 单个 turn 的大量 items 仍按 item limit 分页", async () => {
    const peer = new FakePeer();
    peer.request = async (method, params) => {
      peer.calls.push({ method, params });
      if (method === "thread/items/list") {
        throw new Error("thread/items/list is not supported yet");
      }
      if (method === "thread/turns/list") {
        return {
          data: [{
            id: "turn-large",
            itemsView: { type: "complete" },
            status: { type: "completed" },
            error: null,
            startedAt: 1,
            completedAt: 2,
            durationMs: 1,
            items: Array.from({ length: 80 }, (_, index) => ({
              type: "agentMessage",
              id: `large-${index}`,
              text: `item ${index}`,
              phase: "final",
              memoryCitation: null
            }))
          }],
          nextCursor: "older-turn",
          backwardsCursor: null
        };
      }
      return {};
    };
    const client = new CodexAppServerClient(peer);

    const first = await client.listThreadTurns({ threadId: "thread-1", limit: 30 });
    const second = await client.listThreadTurns({ threadId: "thread-1", cursor: first.nextCursor, limit: 30 });
    const third = await client.listThreadTurns({ threadId: "thread-1", cursor: second.nextCursor, limit: 30 });

    expect(first.items).toHaveLength(30);
    expect(second.items).toHaveLength(30);
    expect(third.items).toHaveLength(20);
    expect(first.items.map((item) => item.id)).toEqual(
      Array.from({ length: 30 }, (_, index) => `large-${index + 50}`)
    );
    expect(second.items.map((item) => item.id)).toEqual(
      Array.from({ length: 30 }, (_, index) => `large-${index + 20}`)
    );
    expect(third.items.map((item) => item.id)).toEqual(
      Array.from({ length: 20 }, (_, index) => `large-${index}`)
    );
    expect(first.nextCursor).toContain("legacy-thread-items");
    expect(second.nextCursor).toContain("legacy-thread-items");
    const turnPageCalls = peer.calls.filter((call) => call.method === "thread/turns/list");
    expect(turnPageCalls[1]?.params).toEqual(expect.objectContaining({ cursor: null }));
    expect(turnPageCalls[2]?.params).toEqual(expect.objectContaining({ cursor: null }));
  });

  it("分页读取 turns 时显式请求 desc 并返回页内正序 timeline", async () => {
    const peer = new FakePeer();
    peer.request = async (method, params) => {
      peer.calls.push({ method, params });
      if (method === "thread/items/list") {
        return {
          data: [
            {
              type: "agentMessage",
              id: "item-new",
              turnId: "019f5e2a-80c2-72a2-9b84-e9b54ec7a26e",
              createdAtMs: 1_783_991_271_618,
              text: "新回复",
              phase: "final",
              memoryCitation: null
            },
            {
              type: "userMessage",
              id: "item-old",
              turnId: "019f5e29-7cfd-7431-887f-ac891cfdcc60",
              createdAtMs: 1_783_991_229_693,
              clientId: "client-old",
              content: [{ type: "text", text: "旧请求", text_elements: [] }]
            }
          ],
          nextCursor: "older",
          backwardsCursor: null
        };
      }

      return {};
    };
    const client = new CodexAppServerClient(peer);

    await expect(client.listThreadTurns({ threadId: "thread-1", cursor: "cursor-1", limit: 10 })).resolves.toEqual({
      items: [
        {
          id: "item-old",
          createdAt: 1_783_991_229_693,
          turnId: "019f5e29-7cfd-7431-887f-ac891cfdcc60",
          role: "user",
          text: "旧请求",
          clientUserMessageId: "client-old"
        },
        {
          id: "item-new",
          createdAt: 1_783_991_271_618,
          turnId: "019f5e2a-80c2-72a2-9b84-e9b54ec7a26e",
          role: "agent",
          text: "新回复"
        }
      ],
      nextCursor: "older"
    });
    expect(peer.calls.at(-1)).toEqual({
      method: "thread/items/list",
      params: {
        threadId: "thread-1",
        cursor: "cursor-1",
        limit: 10,
        sortDirection: "desc"
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

  it("能读取会话摘要", async () => {
    const peer = new FakePeer();
    const client = new CodexAppServerClient(peer);

    await expect(client.getConversationSummary({ conversationId: "thread-1" })).resolves.toEqual({
      id: "thread-1",
      title: "摘要预览",
      preview: "摘要预览",
      cwd: "C:\\Users\\huang\\workspace\\demo",
      modelProvider: "openai",
      status: "summary",
      updatedAt: Date.parse("2026-06-23T02:00:00.000Z") / 1000
    });

    expect(peer.calls.at(-1)).toEqual({
      method: "getConversationSummary",
      params: { conversationId: "thread-1" }
    });
  });

  it("能读取工作区相对远端的 Git diff", async () => {
    const peer = new FakePeer();
    const client = new CodexAppServerClient(peer);

    await expect(client.gitDiffToRemote("C:\\repo")).resolves.toEqual({
      sha: "abc123",
      diff: "diff --git a/README.md b/README.md"
    });

    expect(peer.calls.at(-1)).toEqual({
      method: "gitDiffToRemote",
      params: { cwd: "C:\\repo" }
    });
  });

  it("能更新会话 metadata、注入 items、批准 Guardian 拦截动作并调用 mock 探针", async () => {
    const peer = new FakePeer();
    const client = new CodexAppServerClient(peer);

    await expect(
      client.updateThreadMetadata({
        threadId: "thread-1",
        gitInfo: { sha: "abc123", branch: "main", originUrl: null }
      })
    ).resolves.toMatchObject({ id: "thread-1", updatedAt: 900 });
    await expect(
      client.injectThreadItems("thread-1", [{ type: "message", role: "user", content: "注入上下文" }])
    ).resolves.toBeUndefined();
    await expect(
      client.approveGuardianDeniedAction("thread-1", { type: "guardian_assessment", id: "event-1" })
    ).resolves.toBeUndefined();
    await expect(client.mockExperimentalMethod("hello")).resolves.toEqual({ echoed: "hello" });

    expect(peer.calls.slice(-4)).toEqual([
      {
        method: "thread/metadata/update",
        params: {
          threadId: "thread-1",
          gitInfo: { sha: "abc123", branch: "main", originUrl: null }
        }
      },
      {
        method: "thread/inject_items",
        params: { threadId: "thread-1", items: [{ type: "message", role: "user", content: "注入上下文" }] }
      },
      {
        method: "thread/approveGuardianDeniedAction",
        params: { threadId: "thread-1", event: { type: "guardian_assessment", id: "event-1" } }
      },
      { method: "mock/experimentalMethod", params: { value: "hello" } }
    ]);
  });

  it("能转发环境、external agent config 和 feedback 协议", async () => {
    const peer = new FakePeer();
    const client = new CodexAppServerClient(peer);

    await expect(client.addEnvironment({ environmentId: "env-1", execServerUrl: "http://127.0.0.1:4242" })).resolves.toEqual({
      added: true
    });
    await expect(client.detectExternalAgentConfig({ includeHome: true, cwds: ["C:\\repo"] })).resolves.toEqual({
      items: [
        {
          itemType: "AGENTS_MD",
          description: "导入 AGENTS.md",
          cwd: "C:\\repo",
          details: null
        }
      ]
    });
    await expect(
      client.importExternalAgentConfig({
        migrationItems: [{ itemType: "AGENTS_MD", description: "导入 AGENTS.md", cwd: "C:\\repo", details: null }]
      })
    ).resolves.toEqual({ importId: "import-1" });
    await expect(
      client.uploadFeedback({ classification: "bug", reason: "手机端报错", threadId: "thread-1", includeLogs: true })
    ).resolves.toEqual({ threadId: "thread-1" });

    expect(peer.calls.slice(-4)).toEqual([
      { method: "environment/add", params: { environmentId: "env-1", execServerUrl: "http://127.0.0.1:4242" } },
      { method: "externalAgentConfig/detect", params: { includeHome: true, cwds: ["C:\\repo"] } },
      {
        method: "externalAgentConfig/import",
        params: { migrationItems: [{ itemType: "AGENTS_MD", description: "导入 AGENTS.md", cwd: "C:\\repo", details: null }] }
      },
      {
        method: "feedback/upload",
        params: { classification: "bug", reason: "手机端报错", threadId: "thread-1", includeLogs: true, extraLogFiles: null, tags: null }
      }
    ]);
  });

  it("能转发 marketplace、plugin installed 和 plugin share 协议", async () => {
    const peer = new FakePeer();
    const client = new CodexAppServerClient(peer);

    await expect(client.addMarketplace({ source: "https://example.com/plugins.git", refName: "main" })).resolves.toEqual({
      marketplaceName: "team-marketplace",
      installedRoot: "C:\\Users\\huang\\.codex\\plugins\\team",
      alreadyAdded: false
    });
    await expect(client.removeMarketplace("team-marketplace")).resolves.toEqual({
      marketplaceName: "team-marketplace",
      installedRoot: "C:\\Users\\huang\\.codex\\plugins\\team"
    });
    await expect(client.upgradeMarketplace("team-marketplace")).resolves.toEqual({
      selectedMarketplaces: ["team-marketplace"],
      upgradedRoots: ["C:\\Users\\huang\\.codex\\plugins\\team"],
      errors: [{ marketplaceName: "broken-marketplace", message: "无法拉取" }]
    });
    await expect(client.listInstalledPlugins({ cwds: ["C:\\repo"], installSuggestionPluginNames: ["browser-tools"] })).resolves.toEqual({
      marketplaces: [{ name: "个人插件市场", path: "C:\\Users\\huang\\.codex\\plugins\\marketplace.json", interface: null, plugins: [] }],
      marketplaceLoadErrors: []
    });
    await expect(
      client.savePluginShare({ pluginPath: "C:\\Users\\huang\\.codex\\plugins\\browser-tools", discoverability: "UNLISTED" })
    ).resolves.toEqual({ remotePluginId: "remote-plugin-1", shareUrl: "https://example.com/plugins/remote-plugin-1" });
    await expect(
      client.updatePluginShareTargets({
        remotePluginId: "remote-plugin-1",
        discoverability: "PRIVATE",
        shareTargets: [{ principalType: "USER", principalId: "user-1", role: "OWNER" }]
      })
    ).resolves.toEqual({
      discoverability: "PRIVATE",
      principals: [{ principalType: "USER", principalId: "user-1", role: "OWNER", name: "测试用户" }]
    });
    await expect(client.listPluginShares()).resolves.toEqual({
      data: [
        {
          plugin: {
            id: "browser-tools",
            name: "browser-tools",
            displayName: "浏览器工具",
            shortDescription: "控制浏览器",
            installed: true,
            enabled: true,
            availability: "AVAILABLE",
            sourceType: "local"
          },
          localPluginPath: "C:\\Users\\huang\\.codex\\plugins\\browser-tools"
        }
      ]
    });
    await expect(client.checkoutPluginShare("remote-plugin-1")).resolves.toMatchObject({
      remotePluginId: "remote-plugin-1",
      pluginId: "browser-tools"
    });
    await expect(client.deletePluginShare("remote-plugin-1")).resolves.toEqual({ deleted: true });

    expect(peer.calls.slice(-9).map((call) => call.method)).toEqual([
      "marketplace/add",
      "marketplace/remove",
      "marketplace/upgrade",
      "plugin/installed",
      "plugin/share/save",
      "plugin/share/updateTargets",
      "plugin/share/list",
      "plugin/share/checkout",
      "plugin/share/delete"
    ]);
  });

  it("能转发 MCP tool call 和 thread realtime 协议", async () => {
    const peer = new FakePeer();
    const client = new CodexAppServerClient(peer);

    await expect(
      client.callMcpTool({
        threadId: "thread-1",
        server: "filesystem",
        tool: "read_file",
        arguments: { path: "README.md" },
        meta: { source: "mobile" }
      })
    ).resolves.toEqual({
      content: [{ type: "text", text: "工具结果" }],
      structuredContent: { ok: true },
      isError: false,
      meta: { durationMs: 12 }
    });
    await expect(client.startThreadRealtime({ threadId: "thread-1", outputModality: "text", voice: "alloy" })).resolves.toEqual({
      started: true
    });
    await expect(
      client.appendThreadRealtimeAudio({
        threadId: "thread-1",
        audio: { data: "AAAA", sampleRate: 24000, numChannels: 1, samplesPerChannel: null, itemId: null }
      })
    ).resolves.toEqual({ accepted: true });
    await expect(client.appendThreadRealtimeText({ threadId: "thread-1", text: "你好", role: "user" })).resolves.toEqual({
      accepted: true
    });
    await expect(client.appendThreadRealtimeSpeech({ threadId: "thread-1", text: "读出来" })).resolves.toEqual({
      accepted: true
    });
    await expect(client.stopThreadRealtime("thread-1")).resolves.toEqual({ stopped: true });
    await expect(client.listThreadRealtimeVoices()).resolves.toEqual({
      voices: {
        v1: ["alloy", "echo"],
        v2: ["cedar", "marin"],
        defaultV1: "alloy",
        defaultV2: "cedar"
      }
    });

    expect(peer.calls.slice(-7)).toEqual([
      {
        method: "mcpServer/tool/call",
        params: {
          threadId: "thread-1",
          server: "filesystem",
          tool: "read_file",
          arguments: { path: "README.md" },
          _meta: { source: "mobile" }
        }
      },
      {
        method: "thread/realtime/start",
        params: {
          threadId: "thread-1",
          outputModality: "text",
          voice: "alloy",
          codexResponsesAsItems: null,
          codexResponseItemPrefix: null,
          model: null,
          includeStartupContext: null,
          prompt: null,
          realtimeSessionId: null,
          transport: null,
          version: null
        }
      },
      {
        method: "thread/realtime/appendAudio",
        params: {
          threadId: "thread-1",
          audio: { data: "AAAA", sampleRate: 24000, numChannels: 1, samplesPerChannel: null, itemId: null }
        }
      },
      { method: "thread/realtime/appendText", params: { threadId: "thread-1", text: "你好", role: "user" } },
      { method: "thread/realtime/appendSpeech", params: { threadId: "thread-1", text: "读出来" } },
      { method: "thread/realtime/stop", params: { threadId: "thread-1" } },
      { method: "thread/realtime/listVoices", params: {} }
    ]);
  });
});
