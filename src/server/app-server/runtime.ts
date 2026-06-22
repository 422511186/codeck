import type { AppServerConfig } from "../../config/env";
import type {
  MobileCommandResult,
  MobileFileContent,
  MobileFileEntry,
  MobileModelOption,
  MobileSettingsView,
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
  type ListThreadTurnItemsInput,
  type ListThreadTurnsInput,
  type SearchThreadsInput,
  type StartThreadInput,
  type StartTurnInput,
  type UpdateThreadSettingsInput
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
import type { ThreadResumeParams } from "../../../docs/generated/app-server-ts/v2/ThreadResumeParams";
import type { ThreadRollbackParams } from "../../../docs/generated/app-server-ts/v2/ThreadRollbackParams";
import type { ThreadSetNameParams } from "../../../docs/generated/app-server-ts/v2/ThreadSetNameParams";
import type { ThreadSettingsUpdateParams } from "../../../docs/generated/app-server-ts/v2/ThreadSettingsUpdateParams";
import type { TurnSteerParams } from "../../../docs/generated/app-server-ts/v2/TurnSteerParams";
import type { Thread } from "../../../docs/generated/app-server-ts/v2/Thread";
import type { CommandExecParams } from "../../../docs/generated/app-server-ts/v2/CommandExecParams";
import type { FsReadDirectoryParams } from "../../../docs/generated/app-server-ts/v2/FsReadDirectoryParams";
import type { FsReadFileParams } from "../../../docs/generated/app-server-ts/v2/FsReadFileParams";
import type { ThreadTurnsItemsListParams } from "../../../docs/generated/app-server-ts/v2/ThreadTurnsItemsListParams";
import type { ThreadTurnsListParams } from "../../../docs/generated/app-server-ts/v2/ThreadTurnsListParams";
import type { ThreadSearchParams } from "../../../docs/generated/app-server-ts/v2/ThreadSearchParams";

type TextUserInput = { type: "text"; text: string };

class MockAppServerPeer implements ManagedAppServerPeer {
  private status: AppServerStatus = { state: "idle" };
  private thread: Thread = this.createThread();
  private threads: Thread[] = [this.thread];
  private turnCounter = 1;
  private itemCounter = 2;
  private requestCounter = 0;
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
        entries: [
          { fileName: "src", isDirectory: true, isFile: false },
          { fileName: "README.md", isDirectory: false, isFile: true }
        ],
        path: readParams.path
      };
    }

    if (method === "fs/readFile") {
      const readParams = params as FsReadFileParams;
      const fileText = readParams.path.endsWith("README.md")
        ? "# Codex Web\n\n移动端 Web 工作台 mock 文件。"
        : `mock file: ${readParams.path}`;

      return {
        dataBase64: Buffer.from(fileText, "utf8").toString("base64")
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
        installationId: "mock-installation",
        environmentId: null
      };
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

    throw new Error(`mock app-server 未实现方法: ${method}`);
  }

  private emitNotification(message: AppServerNotificationMessage): void {
    for (const handler of this.notificationHandlers) {
      handler(message);
    }
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

  constructor(private readonly peer: ManagedAppServerPeer) {
    this.client = new CodexAppServerClient(peer as AppServerPeer);
    this.peer.onNotification((message) => {
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

  async execCommand(input: ExecCommandInput): Promise<MobileCommandResult> {
    await this.ensureReady();
    return this.client.execCommand(input);
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
