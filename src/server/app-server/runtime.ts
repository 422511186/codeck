import type { AppServerConfig } from "../../config/env";
import type { ThreadMemoryMode } from "../../../docs/generated/app-server-ts/ThreadMemoryMode";
import type {
  MobileCommandResult,
  MobileFileContent,
  MobileFileEntry,
  MobileFileMetadata,
  MobileAccountLoginCancelView,
  MobileAccountLoginView,
  MobileAccountTokenUsageView,
  MobileAddCreditsNudgeResultView,
  MobileBackgroundTerminalPage,
  MobileBackgroundTerminalTerminateResult,
  MobileMcpLoginView,
  MobileMcpResourceReadView,
  MobileModelOption,
  MobilePluginDetailView,
  MobilePluginInstallResultView,
  MobilePluginSkillContentView,
  MobileRemoteControlPairingStatusView,
  MobileRemoteControlPairingView,
  MobileRemoteControlStatusView,
  MobileSettingsView,
  MobileSkillConfigWriteResultView,
  MobileTerminalSession,
  MobileThreadGoalView,
  MobileTimelinePage,
  MobileThreadDetail,
  MobileThreadPage,
  MobileThreadSummary
} from "../../shared/codex";
import { getRuntimeConfig } from "../runtime";
import {
  CodexAppServerClient,
  type AppServerPeer,
  type ExecCommandInput,
  type ListThreadBackgroundTerminalsInput,
  type ListThreadTurnItemsInput,
  type ListThreadTurnsInput,
  type PluginLookupInput,
  type PluginSkillReadInput,
  type ReadMcpResourceInput,
  type SearchThreadsInput,
  type SetThreadGoalInput,
  type StartProcessInput,
  type StartThreadInput,
  type StartTurnInput,
  type UpdateThreadSettingsInput,
  type WriteSkillConfigInput
} from "./client";
import type { AppServerNotificationMessage, BrowserCodexEventEnvelope } from "./events";
import { normalizeAppServerNotification } from "./events";
import {
  normalizePendingServerRequest,
  type AppServerServerRequestMessage,
  type BrowserServerRequestEvent,
  type PendingServerRequestView
} from "./pending-requests";
import { createManagedAppServerPeer, type AppServerStatus, type ManagedAppServerPeer } from "./transport";
import { createTextUserInput } from "./user-input";
import type { ThreadStartParams } from "../../../docs/generated/app-server-ts/v2/ThreadStartParams";
import type { TurnStartParams } from "../../../docs/generated/app-server-ts/v2/TurnStartParams";
import type { ThreadForkParams } from "../../../docs/generated/app-server-ts/v2/ThreadForkParams";
import type { ThreadCompactStartParams } from "../../../docs/generated/app-server-ts/v2/ThreadCompactStartParams";
import type { ThreadResumeParams } from "../../../docs/generated/app-server-ts/v2/ThreadResumeParams";
import type { ThreadRollbackParams } from "../../../docs/generated/app-server-ts/v2/ThreadRollbackParams";
import type { ThreadSetNameParams } from "../../../docs/generated/app-server-ts/v2/ThreadSetNameParams";
import type { ThreadSettingsUpdateParams } from "../../../docs/generated/app-server-ts/v2/ThreadSettingsUpdateParams";
import type { ThreadGoalSetParams } from "../../../docs/generated/app-server-ts/v2/ThreadGoalSetParams";
import type { ReviewStartParams } from "../../../docs/generated/app-server-ts/v2/ReviewStartParams";
import type { TurnSteerParams } from "../../../docs/generated/app-server-ts/v2/TurnSteerParams";
import type { Thread } from "../../../docs/generated/app-server-ts/v2/Thread";
import type { CommandExecParams } from "../../../docs/generated/app-server-ts/v2/CommandExecParams";
import type { FsCopyParams } from "../../../docs/generated/app-server-ts/v2/FsCopyParams";
import type { FsCreateDirectoryParams } from "../../../docs/generated/app-server-ts/v2/FsCreateDirectoryParams";
import type { FsGetMetadataParams } from "../../../docs/generated/app-server-ts/v2/FsGetMetadataParams";
import type { FsReadDirectoryParams } from "../../../docs/generated/app-server-ts/v2/FsReadDirectoryParams";
import type { FsReadFileParams } from "../../../docs/generated/app-server-ts/v2/FsReadFileParams";
import type { FsRemoveParams } from "../../../docs/generated/app-server-ts/v2/FsRemoveParams";
import type { FsWriteFileParams } from "../../../docs/generated/app-server-ts/v2/FsWriteFileParams";
import type { ProcessKillParams } from "../../../docs/generated/app-server-ts/v2/ProcessKillParams";
import type { ProcessSpawnParams } from "../../../docs/generated/app-server-ts/v2/ProcessSpawnParams";
import type { ProcessWriteStdinParams } from "../../../docs/generated/app-server-ts/v2/ProcessWriteStdinParams";
import type { ThreadTurnsItemsListParams } from "../../../docs/generated/app-server-ts/v2/ThreadTurnsItemsListParams";
import type { ThreadTurnsListParams } from "../../../docs/generated/app-server-ts/v2/ThreadTurnsListParams";
import type { ThreadSearchParams } from "../../../docs/generated/app-server-ts/v2/ThreadSearchParams";
import type { ThreadMemoryModeSetParams } from "../../../docs/generated/app-server-ts/v2/ThreadMemoryModeSetParams";

type TextUserInput = { type: "text"; text: string };
type MockFsNode = {
  type: "directory" | "file";
  createdAtMs: number;
  modifiedAtMs: number;
  text?: string;
};

class MockAppServerPeer implements ManagedAppServerPeer {
  private status: AppServerStatus = { state: "idle" };
  private thread: Thread = this.createThread();
  private threads: Thread[] = [this.thread];
  private turnCounter = 1;
  private itemCounter = 2;
  private requestCounter = 0;
  private rateLimitUsedPercent = 42;
  private remoteControlEnabled = true;
  private remoteControlEnvironmentId: string | null = "mock-env";
  private remoteControlClients = [
    {
      clientId: "mock-phone",
      displayName: "手机浏览器",
      deviceType: "phone",
      platform: "web",
      osVersion: null,
      deviceModel: null,
      appVersion: "0.1.0",
      lastSeenAt: 1_800_000_001
    }
  ];
  private remotePairingClaimed = false;
  private goals = new Map<string, MobileThreadGoalView>();
  private accountState: "chatgpt" | "apiKey" | "none" = "chatgpt";
  private backgroundTerminals = [
    {
      itemId: "mock-bg-item-1",
      processId: "mock-bg-1",
      command: "npm run dev",
      cwd: "C:\\Users\\huang\\workspace",
      osPid: 4242,
      cpuPercent: 1.5,
      rssKb: 2048n
    }
  ];
  private readonly workspaceRoot = "C:\\Users\\huang\\workspace";
  private readonly mockFs = new Map<string, MockFsNode>([
    [
      "C:\\Users\\huang\\workspace",
      { type: "directory", createdAtMs: 1_700_000_000_000, modifiedAtMs: 1_700_000_000_000 }
    ],
    [
      "C:\\Users\\huang\\workspace\\src",
      { type: "directory", createdAtMs: 1_700_000_000_000, modifiedAtMs: 1_700_000_000_000 }
    ],
    [
      "C:\\Users\\huang\\workspace\\README.md",
      {
        type: "file",
        createdAtMs: 1_700_000_000_000,
        modifiedAtMs: 1_700_000_000_000,
        text: "# Codex Web\n\n移动端 Web 工作台 mock 文件。"
      }
    ]
  ]);
  private readonly mockProcesses = new Set<string>();
  private readonly notificationHandlers = new Set<(message: AppServerNotificationMessage) => void>();
  private readonly serverRequestHandlers = new Set<(message: AppServerServerRequestMessage) => void>();

  private createThread(): Thread {
    return {
      id: "mock-thread-1",
      sessionId: "mock-session-1",
      forkedFromId: null,
      parentThreadId: null,
      preview: "这是用于移动端联调的示例会话",
      ephemeral: false,
      modelProvider: "openai",
      createdAt: 1_767_000_000,
      updatedAt: 1_767_000_600,
      status: { type: "idle" as const },
      path: null,
      cwd: "C:\\Users\\huang\\workspace",
      cliVersion: "0.141.0",
      source: "appServer" as const,
      threadSource: null,
      agentNickname: null,
      agentRole: null,
      gitInfo: null,
      name: "示例会话",
      turns: [
        {
          id: "mock-turn-1",
          itemsView: "full" as const,
          status: "completed" as const,
          error: null,
          startedAt: 1_767_000_010,
          completedAt: 1_767_000_100,
          durationMs: 90000,
          items: [
            {
              type: "userMessage" as const,
              id: "mock-user-1",
              clientId: "mock-client-user-1",
              content: [{ type: "text" as const, text: "帮我看看当前项目", text_elements: [] }]
            },
            {
              type: "agentMessage" as const,
              id: "mock-agent-1",
              text: "我已经连上 Codex app-server，可以读取历史和模型。",
              phase: "final_answer" as const,
              memoryCitation: null
            }
          ]
        }
      ]
    };
  }

  async connect(): Promise<void> {
    this.status = { state: "ready" };
  }

  getStatus(): AppServerStatus {
    return this.status;
  }

  onNotification(handler: (message: AppServerNotificationMessage) => void): () => void {
    this.notificationHandlers.add(handler);
    return () => this.notificationHandlers.delete(handler);
  }

  onServerRequest(handler: (message: AppServerServerRequestMessage) => void): () => void {
    this.serverRequestHandlers.add(handler);
    return () => this.serverRequestHandlers.delete(handler);
  }

  async respondToServerRequest(): Promise<void> {
    return undefined;
  }

  close(): void {
    this.status = { state: "idle" };
  }

  async request(method: string, params?: unknown): Promise<unknown> {
    if (method === "initialize") {
      return {
        userAgent: "codex-web-mock",
        codexHome: "C:\\Users\\huang\\.codex",
        platformFamily: "windows",
        platformOs: "windows"
      };
    }

    if (method === "thread/list") {
      return {
        data: this.threads.map((thread) => ({ ...thread, turns: [] })),
        nextCursor: null,
        backwardsCursor: null
      };
    }

    if (method === "thread/search") {
      const searchParams = params as ThreadSearchParams;
      const searchTerm = searchParams.searchTerm.trim().toLowerCase();
      const results = this.threads
        .filter((thread) => this.threadMatchesSearch(thread, searchTerm))
        .slice(0, searchParams.limit || undefined)
        .map((thread) => ({
          thread: { ...thread, turns: [] },
          snippet: this.createSearchSnippet(thread, searchParams.searchTerm)
        }));

      return {
        data: results,
        nextCursor: null,
        backwardsCursor: null
      };
    }

    if (method === "thread/read") {
      const readParams = params as { threadId?: string };
      const thread = this.selectThread(readParams.threadId);
      return {
        thread
      };
    }

    if (method === "thread/resume") {
      const resumeParams = params as ThreadResumeParams;
      const thread = this.selectThread(resumeParams.threadId);
      return {
        thread: resumeParams.excludeTurns ? { ...thread, turns: [] } : thread,
        model: "gpt-5-codex",
        modelProvider: "openai",
        serviceTier: null,
        cwd: thread.cwd,
        runtimeWorkspaceRoots: ["C:\\Users\\huang\\workspace"],
        instructionSources: [],
        approvalPolicy: "untrusted",
        approvalsReviewer: "user",
        sandbox: { mode: "workspace-write" },
        activePermissionProfile: null,
        reasoningEffort: "medium",
        initialTurnsPage: resumeParams.initialTurnsPage
          ? {
              data: thread.turns.slice(0, resumeParams.initialTurnsPage.limit || undefined),
              nextCursor: null,
              backwardsCursor: null
            }
          : null
      };
    }

    if (method === "thread/turns/list") {
      const listParams = params as ThreadTurnsListParams;
      return {
        data: this.thread.turns.slice(0, listParams.limit || undefined),
        nextCursor: null,
        backwardsCursor: null
      };
    }

    if (method === "thread/turns/items/list") {
      const listParams = params as ThreadTurnsItemsListParams;
      const turn = this.thread.turns.find((threadTurn) => threadTurn.id === listParams.turnId);
      return {
        data: (turn?.items || []).slice(0, listParams.limit || undefined),
        nextCursor: null,
        backwardsCursor: null
      };
    }

    if (method === "thread/start") {
      const startParams = params as ThreadStartParams;
      this.thread = {
        ...this.createThread(),
        id: `mock-thread-${Date.now()}`,
        sessionId: `mock-session-${Date.now()}`,
        preview: "",
        cwd: startParams.cwd || "C:\\Users\\huang\\workspace",
        name: startParams.permissions ? `新会话 ${startParams.permissions}` : "新会话",
        turns: []
      };
      this.upsertThread(this.thread);

      return {
        thread: this.thread,
        model: startParams.model || "gpt-5-codex",
        modelProvider: "openai",
        serviceTier: null,
        cwd: this.thread.cwd,
        runtimeWorkspaceRoots: startParams.runtimeWorkspaceRoots || ["C:\\Users\\huang\\workspace"],
        instructionSources: [],
        approvalPolicy: "untrusted",
        approvalsReviewer: "user",
        sandbox: { mode: "workspace-write" },
        activePermissionProfile: null,
        reasoningEffort: null
      };
    }

    if (method === "thread/fork") {
      const forkParams = params as ThreadForkParams;
      const sourceThread = this.selectThread(forkParams.threadId);
      this.thread = {
        ...sourceThread,
        id: `mock-fork-${Date.now()}`,
        sessionId: `mock-session-${Date.now()}`,
        forkedFromId: forkParams.threadId,
        parentThreadId: forkParams.threadId,
        name: `${this.thread.name || "会话"} fork`,
        updatedAt: Math.floor(Date.now() / 1000)
      };
      this.upsertThread(this.thread);

      return {
        thread: this.thread,
        model: forkParams.model || "gpt-5-codex",
        modelProvider: forkParams.modelProvider || "openai",
        serviceTier: null,
        cwd: this.thread.cwd,
        runtimeWorkspaceRoots: forkParams.runtimeWorkspaceRoots || ["C:\\Users\\huang\\workspace"],
        instructionSources: [],
        approvalPolicy: "untrusted",
        approvalsReviewer: "user",
        sandbox: { mode: "workspace-write" },
        activePermissionProfile: null,
        reasoningEffort: null
      };
    }

    if (method === "thread/rollback") {
      const rollbackParams = params as ThreadRollbackParams;
      this.selectThread(rollbackParams.threadId);
      this.thread = {
        ...this.thread,
        turns: this.thread.turns.slice(0, Math.max(0, this.thread.turns.length - rollbackParams.numTurns)),
        updatedAt: Math.floor(Date.now() / 1000)
      };
      this.upsertThread(this.thread);

      return { thread: this.thread };
    }

    if (method === "thread/name/set") {
      const nameParams = params as ThreadSetNameParams;
      const thread = this.selectThread(nameParams.threadId);
      this.thread = {
        ...thread,
        name: nameParams.name,
        updatedAt: Math.floor(Date.now() / 1000)
      };
      this.upsertThread(this.thread);
      return {};
    }

    if (method === "thread/settings/update") {
      const settingsParams = params as ThreadSettingsUpdateParams;
      this.selectThread(settingsParams.threadId);
      return {};
    }

    if (method === "thread/goal/get") {
      const goalParams = params as { threadId?: string };
      this.selectThread(goalParams.threadId);
      return { goal: this.goals.get(this.thread.id) || null };
    }

    if (method === "thread/goal/set") {
      const goalParams = params as ThreadGoalSetParams;
      this.selectThread(goalParams.threadId);
      const now = Math.floor(Date.now() / 1000);
      const previous = this.goals.get(goalParams.threadId);
      const goal: MobileThreadGoalView = {
        threadId: goalParams.threadId,
        objective: goalParams.objective ?? previous?.objective ?? "",
        status: goalParams.status ?? previous?.status ?? "active",
        tokenBudget: goalParams.tokenBudget ?? previous?.tokenBudget ?? null,
        tokensUsed: previous?.tokensUsed ?? 0,
        timeUsedSeconds: previous?.timeUsedSeconds ?? 0,
        createdAt: previous?.createdAt ?? now,
        updatedAt: now
      };
      this.goals.set(goalParams.threadId, goal);
      this.emitNotification({
        method: "thread/goal/updated",
        params: { threadId: goalParams.threadId, turnId: null, goal }
      });
      return { goal };
    }

    if (method === "thread/goal/clear") {
      const goalParams = params as { threadId?: string };
      this.selectThread(goalParams.threadId);
      this.goals.delete(this.thread.id);
      this.emitNotification({
        method: "thread/goal/cleared",
        params: { threadId: this.thread.id }
      });
      return { cleared: true };
    }

    if (method === "thread/compact/start") {
      const compactParams = params as ThreadCompactStartParams;
      this.selectThread(compactParams.threadId);
      this.emitNotification({
        method: "thread/compacted",
        params: {
          threadId: compactParams.threadId,
          turnId: this.thread.turns.at(-1)?.id || "mock-turn-1"
        }
      });
      return {};
    }

    if (method === "thread/backgroundTerminals/list") {
      this.selectThread((params as { threadId?: string }).threadId);
      return {
        data: this.backgroundTerminals,
        nextCursor: null
      };
    }

    if (method === "thread/backgroundTerminals/terminate") {
      this.selectThread((params as { threadId?: string }).threadId);
      const terminalParams = params as { processId?: string };
      const previousLength = this.backgroundTerminals.length;
      this.backgroundTerminals = this.backgroundTerminals.filter(
        (terminal) => terminal.processId !== terminalParams.processId
      );
      return { terminated: this.backgroundTerminals.length !== previousLength };
    }

    if (method === "thread/backgroundTerminals/clean") {
      this.selectThread((params as { threadId?: string }).threadId);
      this.backgroundTerminals = [];
      return {};
    }

    if (method === "review/start") {
      const reviewParams = params as ReviewStartParams;
      this.selectThread(reviewParams.threadId);
      const turnId = `mock-review-${++this.turnCounter}`;
      this.thread.turns.push({
        id: turnId,
        itemsView: "full",
        status: "completed",
        error: null,
        startedAt: Math.floor(Date.now() / 1000),
        completedAt: Math.floor(Date.now() / 1000),
        durationMs: 1,
        items: [
          {
            type: "enteredReviewMode",
            id: `mock-review-mode-${++this.itemCounter}`,
            review: "未提交改动"
          },
          {
            type: "agentMessage",
            id: `mock-review-agent-${++this.itemCounter}`,
            text: "已开始审查未提交改动",
            phase: "final_answer",
            memoryCitation: null
          }
        ]
      });
      this.thread = {
        ...this.thread,
        preview: this.thread.preview || "代码审查",
        updatedAt: Math.floor(Date.now() / 1000)
      };
      this.upsertThread(this.thread);
      return {
        turn: this.thread.turns.at(-1),
        reviewThreadId: this.thread.id
      };
    }

    if (method === "thread/memoryMode/set") {
      const memoryParams = params as ThreadMemoryModeSetParams;
      this.selectThread(memoryParams.threadId);
      return {};
    }

    if (method === "memory/reset") {
      return {};
    }

    if (method === "account/login/start") {
      const loginParams = params as { type?: string };
      if (loginParams.type === "apiKey") {
        this.accountState = "apiKey";
        return { type: "apiKey" };
      }

      this.accountState = "chatgpt";
      return { type: "chatgpt", loginId: "mock-login-1", authUrl: "https://auth.openai.com/mock-codex" };
    }

    if (method === "account/login/cancel") {
      return { status: "canceled" };
    }

    if (method === "account/logout") {
      this.accountState = "none";
      return {};
    }

    if (method === "thread/archive" || method === "thread/delete") {
      const actionParams = params as { threadId?: string };
      this.threads = this.threads.filter((item) => item.id !== actionParams.threadId);
      this.thread = this.threads[0] || this.createThread();
      return {};
    }

    if (method === "turn/start") {
      const startParams = params as TurnStartParams;
      this.selectThread(startParams.threadId);
      const textInput = startParams.input.find((item) => item.type === "text") as TextUserInput | undefined;
      const text = textInput?.text.trim() || "";
      const settingSuffix = startParams.model || startParams.effort || startParams.permissions
        ? `（模型 ${startParams.model || "默认"}，思考 ${startParams.effort || "默认"}，权限 ${startParams.permissions || "默认"}）`
        : "";
      createTextUserInput(text);
      const turnId = `mock-turn-${++this.turnCounter}`;
      const userItemId = `mock-user-${++this.itemCounter}`;
      const agentItemId = `mock-agent-${++this.itemCounter}`;
      const liveItemId = `mock-live-${this.itemCounter}`;
      this.thread.turns.push({
        id: turnId,
        itemsView: "full",
        status: "completed",
        error: null,
        startedAt: Math.floor(Date.now() / 1000),
        completedAt: Math.floor(Date.now() / 1000),
        durationMs: 1,
        items: [
          {
            type: "userMessage",
            id: userItemId,
            clientId: userItemId,
            content: startParams.input
          },
          {
            type: "agentMessage",
            id: agentItemId,
            text: `已收到：${text}${settingSuffix}`,
            phase: "final_answer",
            memoryCitation: null
          }
        ]
      });
      this.thread = {
        ...this.thread,
        preview: this.thread.preview || text,
        updatedAt: Math.floor(Date.now() / 1000)
      };
      this.upsertThread(this.thread);
      setTimeout(() => {
        const baseParams = {
          threadId: startParams.threadId,
          turnId
        };
        this.emitServerRequest(this.createMockServerRequest(text, baseParams, `mock-approval-${this.itemCounter}`));
        this.emitNotification({
          method: "item/reasoning/textDelta",
          params: { ...baseParams, itemId: `mock-reasoning-${this.itemCounter}`, delta: `思考：${text}` }
        });
        this.emitNotification({
          method: "item/plan/delta",
          params: { ...baseParams, itemId: `mock-plan-${this.itemCounter}`, delta: "计划：整理请求并生成回复" }
        });
        this.emitNotification({
          method: "item/commandExecution/outputDelta",
          params: { ...baseParams, itemId: `mock-command-${this.itemCounter}`, delta: "命令输出：mock 完成" }
        });
        this.emitNotification({
          method: "turn/diff/updated",
          params: { ...baseParams, diff: "diff --git a/mock.txt b/mock.txt" }
        });
        this.emitNotification({
          method: "item/fileChange/outputDelta",
          params: { ...baseParams, itemId: `mock-file-${this.itemCounter}`, delta: "文件输出：mock.txt 已更新" }
        });
        this.emitNotification({
          method: "thread/tokenUsage/updated",
          params: {
            ...baseParams,
            tokenUsage: {
              total: {
                totalTokens: 128,
                inputTokens: 48,
                cachedInputTokens: 0,
                outputTokens: 64,
                reasoningOutputTokens: 16
              },
              last: {
                totalTokens: 128,
                inputTokens: 48,
                cachedInputTokens: 0,
                outputTokens: 64,
                reasoningOutputTokens: 16
              },
              modelContextWindow: 200000
            }
          }
        });
        this.emitNotification({
          method: "item/agentMessage/delta",
          params: { ...baseParams, itemId: liveItemId, delta: `实时事件：${text}` }
        });
        if (text.toLowerCase().includes("warning")) {
          this.emitNotification({
            method: "warning",
            params: { threadId: startParams.threadId, message: "线程级 warning 测试" }
          });
          this.emitNotification({
            method: "configWarning",
            params: { summary: "配置 warning 测试", details: "请检查 Codex 配置" }
          });
        }
        if (text.toLowerCase().includes("settings refresh")) {
          this.rateLimitUsedPercent = 64;
          this.emitNotification({
            method: "account/rateLimits/updated",
            params: {}
          });
        }
      }, 25);

      return {
        turn: this.thread.turns.at(-1)
      };
    }

    if (method === "turn/interrupt") {
      const interruptParams = params as { threadId?: string };
      this.selectThread(interruptParams.threadId);
      this.thread = {
        ...this.thread,
        status: { type: "idle" }
      };
      this.upsertThread(this.thread);
      return {};
    }

    if (method === "turn/steer") {
      const steerParams = params as TurnSteerParams;
      this.selectThread(steerParams.threadId);
      const textInput = steerParams.input.find((item) => item.type === "text") as TextUserInput | undefined;
      const text = textInput?.text.trim() || "";
      createTextUserInput(text);
      const turnId = `mock-steer-${++this.turnCounter}`;
      this.thread.turns.push({
        id: turnId,
        itemsView: "full",
        status: "completed",
        error: null,
        startedAt: Math.floor(Date.now() / 1000),
        completedAt: Math.floor(Date.now() / 1000),
        durationMs: 1,
        items: [
          {
            type: "userMessage",
            id: `mock-steer-user-${++this.itemCounter}`,
            clientId: `mock-steer-user-${this.itemCounter}`,
            content: steerParams.input
          },
          {
            type: "agentMessage",
            id: `mock-steer-agent-${++this.itemCounter}`,
            text: `已追加：${text}`,
            phase: "final_answer",
            memoryCitation: null
          }
        ]
      });
      this.upsertThread(this.thread);
      return { turnId };
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
          },
          {
            id: "gpt-5-mini",
            model: "gpt-5-mini",
            upgrade: null,
            upgradeInfo: null,
            availabilityNux: null,
            displayName: "GPT-5 Mini",
            description: "更快的轻量模型",
            hidden: false,
            supportedReasoningEfforts: ["low", "medium", "high"],
            defaultReasoningEffort: "medium",
            inputModalities: ["text", "image"],
            supportsPersonality: true,
            additionalSpeedTiers: [],
            serviceTiers: [],
            defaultServiceTier: null,
            isDefault: false
          }
        ],
        nextCursor: null
      };
    }

    if (method === "permissionProfile/list") {
      return {
        data: [
          { id: "default", description: "默认权限配置" },
          { id: "read-only", description: "只读工作区" },
          { id: "full-auto", description: "允许自动执行" }
        ],
        nextCursor: null
      };
    }

    if (method === "fs/readDirectory") {
      const readParams = params as FsReadDirectoryParams;
      return {
        entries: this.listMockDirectory(readParams.path)
      };
    }

    if (method === "fs/readFile") {
      const readParams = params as FsReadFileParams;
      const fileText = this.readMockFile(readParams.path);

      return {
        dataBase64: Buffer.from(fileText, "utf8").toString("base64")
      };
    }

    if (method === "fs/writeFile") {
      const writeParams = params as FsWriteFileParams;
      this.writeMockFile(writeParams.path, Buffer.from(writeParams.dataBase64, "base64").toString("utf8"));
      return {};
    }

    if (method === "fs/createDirectory") {
      const createParams = params as FsCreateDirectoryParams;
      this.createMockDirectory(createParams.path);
      return {};
    }

    if (method === "fs/remove") {
      const removeParams = params as FsRemoveParams;
      this.removeMockPath(removeParams.path);
      return {};
    }

    if (method === "fs/copy") {
      const copyParams = params as FsCopyParams;
      this.copyMockPath(copyParams.sourcePath, copyParams.destinationPath);
      return {};
    }

    if (method === "fs/getMetadata") {
      const metadataParams = params as FsGetMetadataParams;
      const node = this.getMockNode(metadataParams.path);
      return {
        isDirectory: node.type === "directory",
        isFile: node.type === "file",
        isSymlink: false,
        createdAtMs: node.createdAtMs,
        modifiedAtMs: node.modifiedAtMs
      };
    }

    if (method === "command/exec") {
      const execParams = params as CommandExecParams;
      return {
        exitCode: 0,
        stdout: `mock command: ${execParams.command.join(" ")}\ncwd: ${execParams.cwd || this.thread.cwd}`,
        stderr: ""
      };
    }

    if (method === "process/spawn") {
      const spawnParams = params as ProcessSpawnParams;
      this.mockProcesses.add(spawnParams.processHandle);
      setTimeout(() => {
        if (!this.mockProcesses.has(spawnParams.processHandle)) {
          return;
        }
        this.emitProcessOutput(
          spawnParams.processHandle,
          `mock process: ${spawnParams.command.join(" ")}\ncwd: ${spawnParams.cwd}\n`
        );
      }, 5);
      return {};
    }

    if (method === "process/writeStdin") {
      const stdinParams = params as ProcessWriteStdinParams;
      if (stdinParams.deltaBase64) {
        const text = Buffer.from(stdinParams.deltaBase64, "base64").toString("utf8").trimEnd();
        this.emitProcessOutput(stdinParams.processHandle, `stdin: ${text}\n`);
      }
      return {};
    }

    if (method === "process/kill") {
      const killParams = params as ProcessKillParams;
      this.mockProcesses.delete(killParams.processHandle);
      this.emitNotification({
        method: "process/exited",
        params: {
          processHandle: killParams.processHandle,
          exitCode: 143,
          stdout: "",
          stdoutCapReached: false,
          stderr: "",
          stderrCapReached: false
        }
      });
      return {};
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
        status: this.remoteControlEnabled ? "connected" : "disabled",
        serverName: "mock",
        installationId: "mock-installation",
        environmentId: this.remoteControlEnvironmentId
      };
    }

    if (method === "remoteControl/client/list") {
      return {
        data: this.remoteControlClients,
        nextCursor: null
      };
    }

    if (method === "remoteControl/enable") {
      this.remoteControlEnabled = true;
      this.remoteControlEnvironmentId = "mock-env";
      return {
        status: "connected",
        serverName: "mock",
        installationId: "mock-installation",
        environmentId: this.remoteControlEnvironmentId
      };
    }

    if (method === "remoteControl/disable") {
      this.remoteControlEnabled = false;
      this.remoteControlEnvironmentId = null;
      return {
        status: "disabled",
        serverName: "mock",
        installationId: "mock-installation",
        environmentId: null
      };
    }

    if (method === "remoteControl/pairing/start") {
      this.remoteControlEnabled = true;
      this.remoteControlEnvironmentId = "mock-env";
      this.remotePairingClaimed = false;
      return {
        pairingCode: "pair-code-1",
        manualPairingCode: "123-456",
        environmentId: "mock-env",
        expiresAt: 1_800_000_500
      };
    }

    if (method === "remoteControl/pairing/status") {
      this.remotePairingClaimed = true;
      return { claimed: this.remotePairingClaimed };
    }

    if (method === "remoteControl/client/revoke") {
      const revokeParams = params as { clientId?: string };
      this.remoteControlClients = this.remoteControlClients.filter((client) => client.clientId !== revokeParams.clientId);
      return {};
    }

    if (method === "account/read") {
      if (this.accountState === "none") {
        return {
          account: null,
          requiresOpenaiAuth: true
        };
      }
      if (this.accountState === "apiKey") {
        return {
          account: { type: "apiKey", email: null, planType: null },
          requiresOpenaiAuth: false
        };
      }

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
          primary: { usedPercent: this.rateLimitUsedPercent, windowDurationMins: 300, resetsAt: 1_800_000_000 },
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

    if (method === "account/tokenUsage/read") {
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

    if (method === "account/addCreditsNudge/sendEmail") {
      return { status: "sent" };
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

    if (method === "mcpServer/refresh") {
      return {};
    }

    if (method === "mcpServer/oauthLogin") {
      return {
        authorizationUrl: "https://example.com/mcp/github/oauth"
      };
    }

    if (method === "mcp/resource/read") {
      return {
        contents: [
          {
            uri: "file:///README.md",
            mimeType: "text/markdown",
            text: "# README\n\n来自 MCP 资源。"
          }
        ]
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
            cwd: this.thread.cwd,
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
                path: `${this.thread.cwd}\\.codex\\skills\\repo-helper\\SKILL.md`,
                scope: "repo",
                enabled: false
              }
            ],
            errors: []
          }
        ]
      };
    }

    if (method === "hooks/list") {
      return {
        data: [
          {
            cwd: this.thread.cwd,
            hooks: [
              {
                key: "post-tool-use-format",
                eventName: "postToolUse",
                handlerType: "command",
                matcher: "Edit",
                command: "npm run format",
                timeoutSec: 60n,
                statusMessage: "格式化文件",
                sourcePath: `${this.thread.cwd}\\.codex\\hooks.json`,
                source: "project",
                pluginId: null,
                displayOrder: 1n,
                enabled: true,
                isManaged: false,
                currentHash: "mock-hook-hash",
                trustStatus: "trusted"
              }
            ],
            warnings: ["hook 即将迁移"],
            errors: []
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
        marketplaceLoadErrors: [],
        featuredPluginIds: ["browser-tools"]
      };
    }

    if (method === "plugin/read") {
      return {
        plugin: this.createMockPluginDetail()
      };
    }

    if (method === "plugin/install") {
      return {
        authPolicy: "ON_USE",
        appsNeedingAuth: [
          { id: "browser-app", name: "Browser", description: "浏览器应用", installUrl: null, category: "tool" }
        ]
      };
    }

    if (method === "plugin/uninstall") {
      return {};
    }

    if (method === "plugin/skill/read") {
      return { contents: "# browser:control\n\n控制浏览器。" };
    }

    if (method === "skills/extraRoots/set") {
      return {};
    }

    if (method === "skills/config/write") {
      const configParams = params as { enabled?: boolean };
      return { effectiveEnabled: Boolean(configParams.enabled) };
    }

    throw new Error(`mock app-server 未实现方法: ${method}`);
  }

  private createMockPluginDetail() {
    return {
      marketplaceName: "个人插件市场",
      marketplacePath: "C:\\Users\\huang\\.codex\\plugins\\marketplace.json",
      summary: {
        id: "browser-tools",
        remotePluginId: "remote-browser-tools",
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
    };
  }

  private emitNotification(message: AppServerNotificationMessage): void {
    for (const handler of this.notificationHandlers) {
      handler(message);
    }
  }

  private emitProcessOutput(processHandle: string, text: string): void {
    this.emitNotification({
      method: "process/outputDelta",
      params: {
        processHandle,
        stream: "stdout",
        deltaBase64: Buffer.from(text, "utf8").toString("base64"),
        capReached: false
      }
    });
  }

  private emitServerRequest(message: AppServerServerRequestMessage): void {
    for (const handler of this.serverRequestHandlers) {
      handler(message);
    }
  }

  private selectThread(threadId: string | undefined): Thread {
    const thread = this.threads.find((item) => item.id === threadId) || this.thread;
    this.thread = thread;
    return thread;
  }

  private upsertThread(thread: Thread): void {
    this.threads = [thread, ...this.threads.filter((item) => item.id !== thread.id)];
  }

  private normalizeMockPath(path: string): string {
    const normalized = path.replace(/\//g, "\\");
    if (/^[A-Za-z]:\\$/.test(normalized)) {
      return normalized;
    }
    return normalized.replace(/\\+$/, "");
  }

  private getMockNode(path: string): MockFsNode {
    const normalizedPath = this.normalizeMockPath(path);
    const node = this.mockFs.get(normalizedPath);
    if (!node) {
      throw new Error(`mock 文件不存在: ${normalizedPath}`);
    }
    return node;
  }

  private getMockParentPath(path: string): string {
    const normalizedPath = this.normalizeMockPath(path);
    const index = normalizedPath.lastIndexOf("\\");
    if (index <= 2) {
      return normalizedPath.slice(0, index + 1);
    }
    return normalizedPath.slice(0, index);
  }

  private getMockBaseName(path: string): string {
    const normalizedPath = this.normalizeMockPath(path);
    return normalizedPath.slice(normalizedPath.lastIndexOf("\\") + 1);
  }

  private touchMockPath(path: string): void {
    const node = this.mockFs.get(this.normalizeMockPath(path));
    if (node) {
      node.modifiedAtMs = Date.now();
    }
  }

  private createMockDirectory(path: string): void {
    const normalizedPath = this.normalizeMockPath(path);
    if (this.mockFs.has(normalizedPath)) {
      return;
    }

    const parentPath = this.getMockParentPath(normalizedPath);
    if (parentPath && !this.mockFs.has(parentPath)) {
      this.createMockDirectory(parentPath);
    }

    const now = Date.now();
    this.mockFs.set(normalizedPath, {
      type: "directory",
      createdAtMs: now,
      modifiedAtMs: now
    });
    this.touchMockPath(parentPath);
  }

  private listMockDirectory(path: string): Array<{ fileName: string; isDirectory: boolean; isFile: boolean }> {
    const normalizedPath = this.normalizeMockPath(path);
    const directory = this.getMockNode(normalizedPath);
    if (directory.type !== "directory") {
      throw new Error(`不是目录: ${normalizedPath}`);
    }

    return [...this.mockFs.entries()]
      .filter(([candidatePath]) => candidatePath !== normalizedPath && this.getMockParentPath(candidatePath) === normalizedPath)
      .map(([candidatePath, node]) => ({
        fileName: this.getMockBaseName(candidatePath),
        isDirectory: node.type === "directory",
        isFile: node.type === "file"
      }))
      .sort((left, right) => {
        if (left.isDirectory !== right.isDirectory) {
          return left.isDirectory ? -1 : 1;
        }
        return left.fileName.localeCompare(right.fileName);
      });
  }

  private readMockFile(path: string): string {
    const normalizedPath = this.normalizeMockPath(path);
    const node = this.getMockNode(normalizedPath);
    if (node.type !== "file") {
      throw new Error(`不是文件: ${normalizedPath}`);
    }
    return node.text ?? "";
  }

  private writeMockFile(path: string, text: string): void {
    const normalizedPath = this.normalizeMockPath(path);
    const parentPath = this.getMockParentPath(normalizedPath);
    this.createMockDirectory(parentPath);
    const previous = this.mockFs.get(normalizedPath);
    const now = Date.now();
    this.mockFs.set(normalizedPath, {
      type: "file",
      createdAtMs: previous?.createdAtMs ?? now,
      modifiedAtMs: now,
      text
    });
    this.touchMockPath(parentPath);
  }

  private copyMockPath(sourcePath: string, destinationPath: string): void {
    const normalizedSourcePath = this.normalizeMockPath(sourcePath);
    const normalizedDestinationPath = this.normalizeMockPath(destinationPath);
    const source = this.getMockNode(normalizedSourcePath);
    const now = Date.now();

    if (source.type === "file") {
      this.writeMockFile(normalizedDestinationPath, source.text ?? "");
      return;
    }

    this.createMockDirectory(normalizedDestinationPath);
    for (const [candidatePath, node] of [...this.mockFs.entries()]) {
      if (candidatePath === normalizedSourcePath || !candidatePath.startsWith(`${normalizedSourcePath}\\`)) {
        continue;
      }
      const targetPath = `${normalizedDestinationPath}${candidatePath.slice(normalizedSourcePath.length)}`;
      this.mockFs.set(targetPath, {
        ...node,
        createdAtMs: now,
        modifiedAtMs: now
      });
    }
    this.touchMockPath(this.getMockParentPath(normalizedDestinationPath));
  }

  private removeMockPath(path: string): void {
    const normalizedPath = this.normalizeMockPath(path);
    const parentPath = this.getMockParentPath(normalizedPath);
    for (const candidatePath of [...this.mockFs.keys()]) {
      if (candidatePath === normalizedPath || candidatePath.startsWith(`${normalizedPath}\\`)) {
        this.mockFs.delete(candidatePath);
      }
    }
    this.touchMockPath(parentPath);
  }

  private threadMatchesSearch(thread: Thread, searchTerm: string): boolean {
    if (!searchTerm) {
      return true;
    }

    const haystack = [
      thread.name,
      thread.preview,
      thread.cwd,
      ...thread.turns.flatMap((turn) =>
        turn.items.map((item) => {
          if (item.type === "agentMessage") {
            return item.text;
          }
          if (item.type === "userMessage") {
            return item.content.map((content) => (content.type === "text" ? content.text : "")).join(" ");
          }
          return "";
        })
      )
    ]
      .filter(Boolean)
      .join("\n")
      .toLowerCase();

    return haystack.includes(searchTerm);
  }

  private createSearchSnippet(thread: Thread, searchTerm: string): string {
    const candidates = [thread.preview, thread.name, thread.cwd].filter((candidate): candidate is string =>
      typeof candidate === "string"
    );
    return candidates.find((candidate) => candidate.includes(searchTerm)) || `搜索命中：${searchTerm}`;
  }

  private createMockServerRequest(
    text: string,
    baseParams: { threadId: string; turnId: string },
    itemId: string
  ): AppServerServerRequestMessage {
    if (text.includes("文件审批")) {
      return {
        id: ++this.requestCounter,
        method: "item/fileChange/requestApproval",
        params: {
          ...baseParams,
          itemId,
          startedAtMs: Date.now(),
          reason: "需要写入 mock.txt",
          grantRoot: this.thread.cwd
        }
      };
    }

    if (text.includes("权限审批")) {
      return {
        id: ++this.requestCounter,
        method: "item/permissions/requestApproval",
        params: {
          ...baseParams,
          itemId,
          environmentId: null,
          startedAtMs: Date.now(),
          cwd: this.thread.cwd,
          reason: "需要网络访问",
          permissions: { network: { mode: "allowAll" }, fileSystem: null }
        }
      };
    }

    if (text.toLowerCase().includes("question")) {
      return {
        id: ++this.requestCounter,
        method: "item/tool/requestUserInput",
        params: {
          ...baseParams,
          itemId,
          questions: [
            {
              id: "mode",
              header: "模式",
              question: "请选择执行模式",
              isOther: false,
              isSecret: false,
              options: [
                { label: "快速", description: "更快完成" },
                { label: "稳妥", description: "更仔细检查" }
              ]
            }
          ],
          autoResolutionMs: null
        }
      };
    }

    if (text.toLowerCase().includes("mcp")) {
      return {
        id: ++this.requestCounter,
        method: "mcpServer/elicitation/request",
        params: {
          ...baseParams,
          serverName: "mock-mcp",
          mode: "url",
          _meta: null,
          message: "请确认外部授权",
          url: "https://example.com",
          elicitationId: "mock-elicitation"
        }
      };
    }

    if (text.toLowerCase().includes("dynamic")) {
      return {
        id: ++this.requestCounter,
        method: "item/tool/call",
        params: {
          ...baseParams,
          callId: "mock-dynamic-call",
          namespace: "browser",
          tool: "search",
          arguments: { query: text }
        }
      };
    }

    return {
      id: ++this.requestCounter,
      method: "item/commandExecution/requestApproval",
      params: {
        ...baseParams,
        itemId,
        startedAtMs: Date.now(),
        command: "npm test",
        cwd: this.thread.cwd,
        reason: "mock 命令审批",
        availableDecisions: ["accept", "decline"]
      }
    };
  }
}

class DisabledAppServerPeer implements ManagedAppServerPeer {
  connect(): Promise<void> {
    return Promise.reject(new Error("app-server 已关闭"));
  }

  getStatus(): AppServerStatus {
    return { state: "disabled" };
  }

  onNotification(): () => void {
    return () => undefined;
  }

  onServerRequest(): () => void {
    return () => undefined;
  }

  respondToServerRequest(): Promise<void> {
    return Promise.reject(new Error("app-server 已关闭"));
  }

  close(): void {
    return undefined;
  }

  request(): Promise<unknown> {
    return Promise.reject(new Error("app-server 已关闭"));
  }
}

export class AppServerGateway {
  private initialized: Promise<void> | null = null;
  private readonly client: CodexAppServerClient;
  private readonly browserEventHandlers = new Set<(event: BrowserCodexEventEnvelope | BrowserServerRequestEvent) => void>();
  private readonly pendingServerRequests = new Map<number, PendingServerRequestView>();
  private readonly terminalSessions = new Map<string, MobileTerminalSession>();
  private processCounter = 0;

  constructor(private readonly peer: ManagedAppServerPeer) {
    this.client = new CodexAppServerClient(peer as AppServerPeer);
    this.peer.onNotification((message) => {
      this.recordProcessNotification(message);
      const event = normalizeAppServerNotification(message);
      if (!event) {
        return;
      }

      for (const handler of this.browserEventHandlers) {
        handler(event);
      }
    });
    this.peer.onServerRequest((message) => {
      const request = normalizePendingServerRequest(message);
      this.pendingServerRequests.set(request.requestId, request);
      this.emitBrowserEvent({ type: "server-request", request });
    });
  }

  getStatus(): AppServerStatus {
    return this.peer.getStatus();
  }

  onBrowserEvent(handler: (event: BrowserCodexEventEnvelope | BrowserServerRequestEvent) => void): () => void {
    this.browserEventHandlers.add(handler);
    return () => this.browserEventHandlers.delete(handler);
  }

  listPendingServerRequests(): PendingServerRequestView[] {
    return [...this.pendingServerRequests.values()];
  }

  async resolveServerRequest(requestId: number, response: unknown): Promise<void> {
    if (!this.pendingServerRequests.has(requestId)) {
      throw new Error("找不到待处理请求");
    }

    await this.peer.respondToServerRequest(requestId, response);
    this.pendingServerRequests.delete(requestId);
    this.emitBrowserEvent({ type: "server-request-resolved", requestId });
  }

  private emitBrowserEvent(event: BrowserCodexEventEnvelope | BrowserServerRequestEvent): void {
    for (const handler of this.browserEventHandlers) {
      handler(event);
    }
  }

  private recordProcessNotification(message: AppServerNotificationMessage): void {
    const params = message.params as Record<string, unknown> | null | undefined;
    if (!params || typeof params.processHandle !== "string") {
      return;
    }

    const session = this.terminalSessions.get(params.processHandle);
    if (!session) {
      return;
    }

    if (message.method === "process/outputDelta" && typeof params.deltaBase64 === "string") {
      const delta = Buffer.from(params.deltaBase64, "base64").toString("utf8");
      this.terminalSessions.set(params.processHandle, {
        ...session,
        output: `${session.output}${delta}`
      });
      return;
    }

    if (message.method === "process/exited") {
      const stdout = typeof params.stdout === "string" ? params.stdout : "";
      const stderr = typeof params.stderr === "string" ? params.stderr : "";
      this.terminalSessions.set(params.processHandle, {
        ...session,
        output: `${session.output}${stdout}${stderr}`,
        exitCode: typeof params.exitCode === "number" ? params.exitCode : null,
        running: false
      });
    }
  }

  ensureReady(): Promise<void> {
    if (!this.initialized) {
      this.initialized = this.peer.connect().then(async () => {
        await this.client.initialize();
      });
    }

    return this.initialized;
  }

  async listThreads(params = {}): Promise<MobileThreadPage> {
    await this.ensureReady();
    return this.client.listThreads(params);
  }

  async searchThreads(input: SearchThreadsInput): Promise<MobileThreadPage> {
    await this.ensureReady();
    return this.client.searchThreads(input);
  }

  async listModels(): Promise<MobileModelOption[]> {
    await this.ensureReady();
    return this.client.listModels();
  }

  async readThread(threadId: string): Promise<MobileThreadDetail> {
    await this.ensureReady();
    return this.client.readThread(threadId);
  }

  async resumeThread(threadId: string): Promise<MobileThreadDetail> {
    await this.ensureReady();
    return this.client.resumeThread(threadId);
  }

  async startThread(input: StartThreadInput): Promise<MobileThreadSummary> {
    await this.ensureReady();
    return this.client.startThread(input);
  }

  async startTurn(input: StartTurnInput): Promise<{ turnId: string }> {
    await this.ensureReady();
    return this.client.startTurn(input);
  }

  async forkThread(threadId: string): Promise<MobileThreadDetail> {
    await this.ensureReady();
    return this.client.forkThread(threadId);
  }

  async rollbackThread(threadId: string, numTurns: number): Promise<MobileThreadDetail> {
    await this.ensureReady();
    return this.client.rollbackThread(threadId, numTurns);
  }

  async setThreadName(threadId: string, name: string): Promise<MobileThreadDetail> {
    await this.ensureReady();
    await this.client.setThreadName(threadId, name);
    return this.client.readThread(threadId);
  }

  async archiveThread(threadId: string): Promise<void> {
    await this.ensureReady();
    await this.client.archiveThread(threadId);
  }

  async deleteThread(threadId: string): Promise<void> {
    await this.ensureReady();
    await this.client.deleteThread(threadId);
  }

  async updateThreadSettings(input: UpdateThreadSettingsInput): Promise<void> {
    await this.ensureReady();
    await this.client.updateThreadSettings(input);
  }

  async setThreadGoal(input: SetThreadGoalInput): Promise<MobileThreadGoalView> {
    await this.ensureReady();
    return this.client.setThreadGoal(input);
  }

  async clearThreadGoal(threadId: string): Promise<void> {
    await this.ensureReady();
    await this.client.clearThreadGoal(threadId);
  }

  async compactThread(threadId: string): Promise<void> {
    await this.ensureReady();
    await this.client.compactThread(threadId);
  }

  async startReview(threadId: string): Promise<{ turnId: string; reviewThreadId: string }> {
    await this.ensureReady();
    return this.client.startReview(threadId);
  }

  async setThreadMemoryMode(threadId: string, mode: ThreadMemoryMode): Promise<void> {
    await this.ensureReady();
    await this.client.setThreadMemoryMode(threadId, mode);
  }

  async resetMemory(): Promise<void> {
    await this.ensureReady();
    await this.client.resetMemory();
  }

  async loginWithChatGpt(): Promise<MobileAccountLoginView> {
    await this.ensureReady();
    return this.client.loginWithChatGpt();
  }

  async loginWithApiKey(apiKey: string): Promise<MobileAccountLoginView> {
    await this.ensureReady();
    return this.client.loginWithApiKey(apiKey);
  }

  async cancelAccountLogin(loginId: string): Promise<MobileAccountLoginCancelView> {
    await this.ensureReady();
    return this.client.cancelAccountLogin(loginId);
  }

  async logoutAccount(): Promise<void> {
    await this.ensureReady();
    await this.client.logoutAccount();
  }

  async getAccountTokenUsage(): Promise<MobileAccountTokenUsageView> {
    await this.ensureReady();
    return this.client.getAccountTokenUsage();
  }

  async sendAddCreditsNudgeEmail(creditType: "credits" | "usage_limit"): Promise<MobileAddCreditsNudgeResultView> {
    await this.ensureReady();
    return this.client.sendAddCreditsNudgeEmail(creditType);
  }

  async readPlugin(input: PluginLookupInput): Promise<MobilePluginDetailView> {
    await this.ensureReady();
    return this.client.readPlugin(input);
  }

  async installPlugin(input: PluginLookupInput): Promise<MobilePluginInstallResultView> {
    await this.ensureReady();
    return this.client.installPlugin(input);
  }

  async uninstallPlugin(pluginId: string): Promise<void> {
    await this.ensureReady();
    return this.client.uninstallPlugin(pluginId);
  }

  async readPluginSkill(input: PluginSkillReadInput): Promise<MobilePluginSkillContentView> {
    await this.ensureReady();
    return this.client.readPluginSkill(input);
  }

  async setSkillsExtraRoots(extraRoots: string[]): Promise<void> {
    await this.ensureReady();
    return this.client.setSkillsExtraRoots(extraRoots);
  }

  async writeSkillConfig(input: WriteSkillConfigInput): Promise<MobileSkillConfigWriteResultView> {
    await this.ensureReady();
    return this.client.writeSkillConfig(input);
  }

  async refreshMcpServer(_serverName: string): Promise<void> {
    await this.ensureReady();
    return this.client.refreshMcpServer();
  }

  async loginMcpServer(serverName: string): Promise<MobileMcpLoginView> {
    await this.ensureReady();
    return this.client.loginMcpServer(serverName);
  }

  async readMcpResource(input: ReadMcpResourceInput): Promise<MobileMcpResourceReadView> {
    await this.ensureReady();
    return this.client.readMcpResource(input);
  }

  async enableRemoteControl(): Promise<MobileRemoteControlStatusView> {
    await this.ensureReady();
    return this.client.enableRemoteControl();
  }

  async disableRemoteControl(): Promise<MobileRemoteControlStatusView> {
    await this.ensureReady();
    return this.client.disableRemoteControl();
  }

  async startRemoteControlPairing(): Promise<MobileRemoteControlPairingView> {
    await this.ensureReady();
    return this.client.startRemoteControlPairing();
  }

  async readRemoteControlPairingStatus(input: {
    pairingCode?: string | null;
    manualPairingCode?: string | null;
  }): Promise<MobileRemoteControlPairingStatusView> {
    await this.ensureReady();
    return this.client.readRemoteControlPairingStatus(input);
  }

  async revokeRemoteControlClient(environmentId: string, clientId: string): Promise<void> {
    await this.ensureReady();
    return this.client.revokeRemoteControlClient(environmentId, clientId);
  }

  async interruptTurn(threadId: string, turnId: string): Promise<void> {
    await this.ensureReady();
    return this.client.interruptTurn(threadId, turnId);
  }

  async steerTurn(input: { threadId: string; expectedTurnId: string; text: string }): Promise<{ turnId: string }> {
    await this.ensureReady();
    return this.client.steerTurn(input);
  }

  async readDirectory(path: string): Promise<MobileFileEntry[]> {
    await this.ensureReady();
    return this.client.readDirectory(path);
  }

  async readFile(path: string): Promise<MobileFileContent> {
    await this.ensureReady();
    return this.client.readFile(path);
  }

  async writeFile(path: string, text: string): Promise<void> {
    await this.ensureReady();
    return this.client.writeFile(path, text);
  }

  async createDirectory(path: string): Promise<void> {
    await this.ensureReady();
    return this.client.createDirectory(path);
  }

  async removePath(path: string): Promise<void> {
    await this.ensureReady();
    return this.client.removePath(path);
  }

  async copyPath(sourcePath: string, destinationPath: string): Promise<void> {
    await this.ensureReady();
    return this.client.copyPath(sourcePath, destinationPath);
  }

  async getMetadata(path: string): Promise<MobileFileMetadata> {
    await this.ensureReady();
    return this.client.getMetadata(path);
  }

  async execCommand(input: ExecCommandInput): Promise<MobileCommandResult> {
    await this.ensureReady();
    return this.client.execCommand(input);
  }

  async startProcessSession(input: Omit<StartProcessInput, "processHandle">): Promise<MobileTerminalSession> {
    await this.ensureReady();
    const processHandle = `mobile-process-${++this.processCounter}`;
    const session: MobileTerminalSession = {
      processHandle,
      cwd: input.cwd,
      command: input.command,
      output: "",
      exitCode: null,
      running: true
    };
    this.terminalSessions.set(processHandle, session);
    try {
      await this.client.startProcess({ ...input, processHandle });
    } catch (error) {
      this.terminalSessions.delete(processHandle);
      throw error;
    }
    return this.terminalSessions.get(processHandle) ?? session;
  }

  async writeProcessStdin(processHandle: string, text: string): Promise<void> {
    await this.ensureReady();
    await this.client.writeProcessStdin(processHandle, text);
  }

  async killProcessSession(processHandle: string): Promise<void> {
    await this.ensureReady();
    await this.client.killProcess(processHandle);
  }

  async readProcessSession(processHandle: string): Promise<MobileTerminalSession> {
    await this.ensureReady();
    const session = this.terminalSessions.get(processHandle);
    if (!session) {
      throw new Error("找不到终端会话");
    }
    return session;
  }

  async listThreadBackgroundTerminals(input: ListThreadBackgroundTerminalsInput): Promise<MobileBackgroundTerminalPage> {
    await this.ensureReady();
    return this.client.listThreadBackgroundTerminals(input);
  }

  async terminateThreadBackgroundTerminal(
    threadId: string,
    processId: string
  ): Promise<MobileBackgroundTerminalTerminateResult> {
    await this.ensureReady();
    return this.client.terminateThreadBackgroundTerminal(threadId, processId);
  }

  async cleanThreadBackgroundTerminals(threadId: string): Promise<void> {
    await this.ensureReady();
    await this.client.cleanThreadBackgroundTerminals(threadId);
  }

  async readSettings(): Promise<MobileSettingsView> {
    await this.ensureReady();
    return this.client.readSettings();
  }

  async listThreadTurns(input: ListThreadTurnsInput): Promise<MobileTimelinePage> {
    await this.ensureReady();
    return this.client.listThreadTurns(input);
  }

  async listThreadTurnItems(input: ListThreadTurnItemsInput): Promise<MobileTimelinePage> {
    await this.ensureReady();
    return this.client.listThreadTurnItems(input);
  }

  close(): void {
    this.peer.close();
    this.initialized = null;
  }
}

function createPeer(config: AppServerConfig): ManagedAppServerPeer {
  if (config.mode === "mock") {
    return new MockAppServerPeer();
  }

  if (config.mode === "off") {
    return new DisabledAppServerPeer();
  }

  return createManagedAppServerPeer(config);
}

export function createAppServerGateway(config: AppServerConfig): AppServerGateway {
  return new AppServerGateway(createPeer(config));
}

const globalForAppServer = globalThis as typeof globalThis & {
  __codexWebAppServerGateway?: AppServerGateway;
};

export function getAppServerGateway(): AppServerGateway {
  if (!globalForAppServer.__codexWebAppServerGateway) {
    globalForAppServer.__codexWebAppServerGateway = createAppServerGateway(getRuntimeConfig().appServer);
  }

  return globalForAppServer.__codexWebAppServerGateway;
}
