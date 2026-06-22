import { Buffer } from "node:buffer";
import path from "node:path";
import type { InitializeParams } from "../../../docs/generated/app-server-ts/InitializeParams";
import type { InitializeResponse } from "../../../docs/generated/app-server-ts/InitializeResponse";
import type { CommandExecParams } from "../../../docs/generated/app-server-ts/v2/CommandExecParams";
import type { CommandExecResponse } from "../../../docs/generated/app-server-ts/v2/CommandExecResponse";
import type { ConfigReadResponse } from "../../../docs/generated/app-server-ts/v2/ConfigReadResponse";
import type { FsReadDirectoryParams } from "../../../docs/generated/app-server-ts/v2/FsReadDirectoryParams";
import type { FsReadDirectoryResponse } from "../../../docs/generated/app-server-ts/v2/FsReadDirectoryResponse";
import type { FsReadFileParams } from "../../../docs/generated/app-server-ts/v2/FsReadFileParams";
import type { FsReadFileResponse } from "../../../docs/generated/app-server-ts/v2/FsReadFileResponse";
import type { GetAccountRateLimitsResponse } from "../../../docs/generated/app-server-ts/v2/GetAccountRateLimitsResponse";
import type { GetAccountResponse } from "../../../docs/generated/app-server-ts/v2/GetAccountResponse";
import type { CollaborationModeListResponse } from "../../../docs/generated/app-server-ts/v2/CollaborationModeListResponse";
import type { ListMcpServerStatusResponse } from "../../../docs/generated/app-server-ts/v2/ListMcpServerStatusResponse";
import type { ModelListParams } from "../../../docs/generated/app-server-ts/v2/ModelListParams";
import type { ModelListResponse } from "../../../docs/generated/app-server-ts/v2/ModelListResponse";
import type { ModelProviderCapabilitiesReadResponse } from "../../../docs/generated/app-server-ts/v2/ModelProviderCapabilitiesReadResponse";
import type { PermissionProfileListResponse } from "../../../docs/generated/app-server-ts/v2/PermissionProfileListResponse";
import type { RemoteControlClientsListResponse } from "../../../docs/generated/app-server-ts/v2/RemoteControlClientsListResponse";
import type { RemoteControlStatusReadResponse } from "../../../docs/generated/app-server-ts/v2/RemoteControlStatusReadResponse";
import type { Thread } from "../../../docs/generated/app-server-ts/v2/Thread";
import type { ThreadArchiveParams } from "../../../docs/generated/app-server-ts/v2/ThreadArchiveParams";
import type { ThreadDeleteParams } from "../../../docs/generated/app-server-ts/v2/ThreadDeleteParams";
import type { ThreadGoal } from "../../../docs/generated/app-server-ts/v2/ThreadGoal";
import type { ThreadGoalClearParams } from "../../../docs/generated/app-server-ts/v2/ThreadGoalClearParams";
import type { ThreadGoalGetParams } from "../../../docs/generated/app-server-ts/v2/ThreadGoalGetParams";
import type { ThreadGoalGetResponse } from "../../../docs/generated/app-server-ts/v2/ThreadGoalGetResponse";
import type { ThreadGoalSetParams } from "../../../docs/generated/app-server-ts/v2/ThreadGoalSetParams";
import type { ThreadGoalSetResponse } from "../../../docs/generated/app-server-ts/v2/ThreadGoalSetResponse";
import type { ThreadItem } from "../../../docs/generated/app-server-ts/v2/ThreadItem";
import type { ThreadReadResponse } from "../../../docs/generated/app-server-ts/v2/ThreadReadResponse";
import type { ThreadResumeParams } from "../../../docs/generated/app-server-ts/v2/ThreadResumeParams";
import type { ThreadResumeResponse } from "../../../docs/generated/app-server-ts/v2/ThreadResumeResponse";
import type { ThreadForkParams } from "../../../docs/generated/app-server-ts/v2/ThreadForkParams";
import type { ThreadForkResponse } from "../../../docs/generated/app-server-ts/v2/ThreadForkResponse";
import type { ThreadListParams } from "../../../docs/generated/app-server-ts/v2/ThreadListParams";
import type { ThreadListResponse } from "../../../docs/generated/app-server-ts/v2/ThreadListResponse";
import type { ThreadRollbackParams } from "../../../docs/generated/app-server-ts/v2/ThreadRollbackParams";
import type { ThreadRollbackResponse } from "../../../docs/generated/app-server-ts/v2/ThreadRollbackResponse";
import type { ThreadSearchParams } from "../../../docs/generated/app-server-ts/v2/ThreadSearchParams";
import type { ThreadSearchResponse } from "../../../docs/generated/app-server-ts/v2/ThreadSearchResponse";
import type { ThreadSetNameParams } from "../../../docs/generated/app-server-ts/v2/ThreadSetNameParams";
import type { ThreadSettingsUpdateParams } from "../../../docs/generated/app-server-ts/v2/ThreadSettingsUpdateParams";
import type { ThreadStartParams } from "../../../docs/generated/app-server-ts/v2/ThreadStartParams";
import type { ThreadStartResponse } from "../../../docs/generated/app-server-ts/v2/ThreadStartResponse";
import type { ThreadStatus } from "../../../docs/generated/app-server-ts/v2/ThreadStatus";
import type { ThreadTurnsItemsListParams } from "../../../docs/generated/app-server-ts/v2/ThreadTurnsItemsListParams";
import type { ThreadTurnsItemsListResponse } from "../../../docs/generated/app-server-ts/v2/ThreadTurnsItemsListResponse";
import type { ThreadTurnsListParams } from "../../../docs/generated/app-server-ts/v2/ThreadTurnsListParams";
import type { ThreadTurnsListResponse } from "../../../docs/generated/app-server-ts/v2/ThreadTurnsListResponse";
import type { TurnInterruptParams } from "../../../docs/generated/app-server-ts/v2/TurnInterruptParams";
import type { TurnStartParams } from "../../../docs/generated/app-server-ts/v2/TurnStartParams";
import type { TurnStartResponse } from "../../../docs/generated/app-server-ts/v2/TurnStartResponse";
import type { TurnSteerParams } from "../../../docs/generated/app-server-ts/v2/TurnSteerParams";
import type { TurnSteerResponse } from "../../../docs/generated/app-server-ts/v2/TurnSteerResponse";
import type {
  MobileCommandResult,
  MobileAccountView,
  MobileCollaborationModeView,
  MobileFileContent,
  MobileFileEntry,
  MobileMcpServerView,
  MobileModelOption,
  MobileModelProviderCapabilitiesView,
  MobileRateLimitView,
  MobileRemoteControlClientView,
  MobileSettingsView,
  MobileThreadGoalView,
  MobileTimelinePage,
  MobileThreadDetail,
  MobileThreadPage,
  MobileThreadSummary,
  MobileTimelineItem
} from "../../shared/codex";
import { createTurnUserInput } from "./user-input";

export type AppServerPeer = {
  request(method: string, params: unknown): Promise<unknown>;
};

export type StartThreadInput = {
  cwd?: string;
  workspaceRoots?: string[];
  model?: string;
  permissions?: string;
};

export type StartTurnInput = {
  threadId: string;
  text: string;
  imagePaths?: string[];
  model?: string;
  reasoningEffort?: string;
  permissions?: string;
};

export type ExecCommandInput = {
  command: string[];
  cwd?: string;
  timeoutMs?: number;
};

export type ListThreadTurnsInput = {
  threadId: string;
  cursor?: string | null;
  limit?: number | null;
};

export type ListThreadTurnItemsInput = {
  threadId: string;
  turnId: string;
  cursor?: string | null;
  limit?: number | null;
};

export type SearchThreadsInput = {
  searchTerm: string;
  cursor?: string | null;
  limit?: number | null;
};

export type UpdateThreadSettingsInput = {
  threadId: string;
  model?: string;
  reasoningEffort?: string;
  permissions?: string;
};

export type SetThreadGoalInput = {
  threadId: string;
  objective: string;
  status?: "active" | "paused" | "blocked" | "usageLimited" | "budgetLimited" | "complete";
  tokenBudget?: number | null;
};

function statusLabel(status: ThreadStatus): string {
  if (status.type === "active") {
    return "active";
  }

  return status.type;
}

function threadSummary(thread: Thread): MobileThreadSummary {
  return {
    id: thread.id,
    title: thread.name || thread.preview || "未命名会话",
    preview: thread.preview,
    cwd: thread.cwd,
    modelProvider: thread.modelProvider,
    status: statusLabel(thread.status),
    updatedAt: thread.updatedAt
  };
}

function userMessageText(item: Extract<ThreadItem, { type: "userMessage" }>): string {
  return item.content
    .map((content) => {
      if (content.type === "text") {
        return content.text;
      }

      if (content.type === "image" || content.type === "localImage") {
        return "[图片]";
      }

      return `[${content.type}]`;
    })
    .join("\n");
}

function timelineItem(item: ThreadItem): MobileTimelineItem | null {
  if (item.type === "userMessage") {
    return { id: item.id, role: "user", text: userMessageText(item) };
  }

  if (item.type === "agentMessage") {
    return { id: item.id, role: "agent", text: item.text };
  }

  if (item.type === "reasoning") {
    return { id: item.id, role: "reasoning", text: [...item.summary, ...item.content].join("\n") };
  }

  if (item.type === "plan") {
    return { id: item.id, role: "plan", text: item.text };
  }

  if (item.type === "commandExecution") {
    return {
      id: item.id,
      role: "tool",
      text: item.aggregatedOutput ? `${item.command}\n${item.aggregatedOutput}` : item.command
    };
  }

  return null;
}

function threadDetail(thread: Thread): MobileThreadDetail {
  const timeline = thread.turns.flatMap((turn) =>
    turn.items.flatMap((item) => {
      const mapped = timelineItem(item);
      return mapped ? [mapped] : [];
    })
  );

  return {
    ...threadSummary(thread),
    lastTurnId: thread.turns.at(-1)?.id || null,
    timeline
  };
}

function goalView(goal: ThreadGoal | null): MobileThreadGoalView | null {
  if (!goal) {
    return null;
  }

  return {
    threadId: goal.threadId,
    objective: goal.objective,
    status: goal.status,
    tokenBudget: goal.tokenBudget,
    tokensUsed: goal.tokensUsed,
    timeUsedSeconds: goal.timeUsedSeconds,
    createdAt: goal.createdAt,
    updatedAt: goal.updatedAt
  };
}

function joinChildPath(parentPath: string, childName: string): string {
  const hasWindowsSeparator = parentPath.includes("\\");
  const pathApi = hasWindowsSeparator ? path.win32 : path.posix;
  return pathApi.join(parentPath, childName);
}

function settingsValue(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  return typeof value === "string" ? value : JSON.stringify(value);
}

function accountView(response: GetAccountResponse): MobileAccountView {
  if (!response.account) {
    return {
      type: "none",
      email: null,
      planType: null,
      requiresOpenaiAuth: response.requiresOpenaiAuth
    };
  }

  if (response.account.type === "chatgpt") {
    return {
      type: "chatgpt",
      email: response.account.email,
      planType: response.account.planType,
      requiresOpenaiAuth: response.requiresOpenaiAuth
    };
  }

  return {
    type: response.account.type,
    email: null,
    planType: null,
    requiresOpenaiAuth: response.requiresOpenaiAuth
  };
}

function rateLimitView(response: GetAccountRateLimitsResponse): MobileRateLimitView | null {
  const snapshot = response.rateLimitsByLimitId?.codex || response.rateLimits;
  const primary = snapshot.primary;

  if (!primary) {
    return null;
  }

  return {
    limitId: snapshot.limitId,
    limitName: snapshot.limitName,
    usedPercent: primary.usedPercent,
    windowDurationMins: primary.windowDurationMins,
    resetsAt: primary.resetsAt
  };
}

function providerCapabilitiesView(
  response: ModelProviderCapabilitiesReadResponse
): MobileModelProviderCapabilitiesView {
  return {
    namespaceTools: response.namespaceTools,
    imageGeneration: response.imageGeneration,
    webSearch: response.webSearch
  };
}

function remoteControlClientViews(response: RemoteControlClientsListResponse): MobileRemoteControlClientView[] {
  return response.data.map((client) => ({
    clientId: client.clientId,
    displayName: client.displayName,
    deviceType: client.deviceType,
    platform: client.platform,
    lastSeenAt: client.lastSeenAt === null ? null : Number(client.lastSeenAt)
  }));
}

function mcpServerViews(response: ListMcpServerStatusResponse): MobileMcpServerView[] {
  return response.data.map((server) => ({
    name: server.name,
    authStatus: server.authStatus,
    toolCount: Object.keys(server.tools).length,
    resourceCount: server.resources.length,
    resourceTemplateCount: server.resourceTemplates.length
  }));
}

function collaborationModeViews(response: CollaborationModeListResponse): MobileCollaborationModeView[] {
  return response.data.map((mode) => ({
    name: mode.name,
    mode: mode.mode,
    model: mode.model,
    reasoningEffort: mode.reasoning_effort
  }));
}

export class CodexAppServerClient {
  constructor(private readonly peer: AppServerPeer) {}

  async initialize(): Promise<InitializeResponse> {
    const params: InitializeParams = {
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
    };

    return this.peer.request("initialize", params) as Promise<InitializeResponse>;
  }

  async listThreads(params: ThreadListParams = {}): Promise<MobileThreadPage> {
    const response = (await this.peer.request("thread/list", params)) as ThreadListResponse;

    return {
      threads: response.data.map(threadSummary),
      nextCursor: response.nextCursor
    };
  }

  async searchThreads(input: SearchThreadsInput): Promise<MobileThreadPage> {
    const params: ThreadSearchParams = {
      searchTerm: input.searchTerm,
      cursor: input.cursor,
      limit: input.limit,
      sortKey: "updated_at",
      sortDirection: "desc"
    };
    const response = (await this.peer.request("thread/search", params)) as ThreadSearchResponse;

    return {
      threads: response.data.map((result) => ({
        ...threadSummary(result.thread),
        preview: result.snippet || result.thread.preview
      })),
      nextCursor: response.nextCursor
    };
  }

  async readThread(threadId: string): Promise<MobileThreadDetail> {
    const [response, goal] = await Promise.all([
      this.peer.request("thread/read", {
        threadId,
        includeTurns: true
      }) as Promise<ThreadReadResponse>,
      this.readThreadGoal(threadId)
    ]);

    return { ...threadDetail(response.thread), goal };
  }

  async resumeThread(threadId: string): Promise<MobileThreadDetail> {
    const params: ThreadResumeParams = {
      threadId,
      excludeTurns: true,
      initialTurnsPage: {
        limit: 30,
        sortDirection: "desc",
        itemsView: "full"
      }
    };
    const [response, goal] = await Promise.all([
      this.peer.request("thread/resume", params) as Promise<ThreadResumeResponse>,
      this.readThreadGoal(threadId)
    ]);
    const thread = response.initialTurnsPage
      ? { ...response.thread, turns: response.initialTurnsPage.data }
      : response.thread;

    return { ...threadDetail(thread), goal };
  }

  async startThread(input: StartThreadInput): Promise<MobileThreadSummary> {
    const params: ThreadStartParams = {
      cwd: input.cwd,
      runtimeWorkspaceRoots: input.workspaceRoots,
      model: input.model,
      permissions: input.permissions
    };

    const response = (await this.peer.request("thread/start", params)) as ThreadStartResponse;
    return threadSummary(response.thread);
  }

  async startTurn(input: StartTurnInput): Promise<{ turnId: string }> {
    const params: TurnStartParams = {
      threadId: input.threadId,
      input: createTurnUserInput(input.text, input.imagePaths),
      model: input.model,
      effort: input.reasoningEffort,
      permissions: input.permissions
    };

    const response = (await this.peer.request("turn/start", params)) as TurnStartResponse;
    return { turnId: response.turn.id };
  }

  async forkThread(threadId: string): Promise<MobileThreadDetail> {
    const params: ThreadForkParams = {
      threadId,
      excludeTurns: false
    };
    const response = (await this.peer.request("thread/fork", params)) as ThreadForkResponse;
    return threadDetail(response.thread);
  }

  async rollbackThread(threadId: string, numTurns: number): Promise<MobileThreadDetail> {
    const params: ThreadRollbackParams = {
      threadId,
      numTurns
    };
    const response = (await this.peer.request("thread/rollback", params)) as ThreadRollbackResponse;
    return threadDetail(response.thread);
  }

  async setThreadName(threadId: string, name: string): Promise<void> {
    const params: ThreadSetNameParams = { threadId, name };
    await this.peer.request("thread/name/set", params);
  }

  async archiveThread(threadId: string): Promise<void> {
    const params: ThreadArchiveParams = { threadId };
    await this.peer.request("thread/archive", params);
  }

  async deleteThread(threadId: string): Promise<void> {
    const params: ThreadDeleteParams = { threadId };
    await this.peer.request("thread/delete", params);
  }

  async updateThreadSettings(input: UpdateThreadSettingsInput): Promise<void> {
    const params: ThreadSettingsUpdateParams = {
      threadId: input.threadId,
      model: input.model,
      effort: input.reasoningEffort,
      permissions: input.permissions
    };
    await this.peer.request("thread/settings/update", params);
  }

  async readThreadGoal(threadId: string): Promise<MobileThreadGoalView | null> {
    const params: ThreadGoalGetParams = { threadId };
    const response = (await this.peer.request("thread/goal/get", params)) as ThreadGoalGetResponse;
    return goalView(response.goal);
  }

  async setThreadGoal(input: SetThreadGoalInput): Promise<MobileThreadGoalView> {
    const params: ThreadGoalSetParams = {
      threadId: input.threadId,
      objective: input.objective,
      status: input.status ?? "active",
      tokenBudget: input.tokenBudget
    };
    const response = (await this.peer.request("thread/goal/set", params)) as ThreadGoalSetResponse;
    return goalView(response.goal) as MobileThreadGoalView;
  }

  async clearThreadGoal(threadId: string): Promise<void> {
    const params: ThreadGoalClearParams = { threadId };
    await this.peer.request("thread/goal/clear", params);
  }

  async interruptTurn(threadId: string, turnId: string): Promise<void> {
    const params: TurnInterruptParams = {
      threadId,
      turnId
    };
    await this.peer.request("turn/interrupt", params);
  }

  async steerTurn(input: { threadId: string; expectedTurnId: string; text: string }): Promise<{ turnId: string }> {
    const params: TurnSteerParams = {
      threadId: input.threadId,
      expectedTurnId: input.expectedTurnId,
      input: createTurnUserInput(input.text)
    };
    const response = (await this.peer.request("turn/steer", params)) as TurnSteerResponse;
    return { turnId: response.turnId };
  }

  async listModels(params: ModelListParams = {}): Promise<MobileModelOption[]> {
    const response = (await this.peer.request("model/list", params)) as ModelListResponse;

    return response.data
      .filter((model) => !model.hidden)
      .map((model) => ({
        id: model.id,
        label: model.displayName || model.model,
        isDefault: model.isDefault,
        supportedReasoningEfforts: model.supportedReasoningEfforts.map(String),
        inputModalities: model.inputModalities.map(String)
      }));
  }

  async readDirectory(directoryPath: string): Promise<MobileFileEntry[]> {
    const params: FsReadDirectoryParams = { path: directoryPath };
    const response = (await this.peer.request("fs/readDirectory", params)) as FsReadDirectoryResponse;

    return response.entries.map((entry) => ({
      name: entry.fileName,
      path: joinChildPath(directoryPath, entry.fileName),
      isDirectory: entry.isDirectory,
      isFile: entry.isFile
    }));
  }

  async readFile(filePath: string): Promise<MobileFileContent> {
    const params: FsReadFileParams = { path: filePath };
    const response = (await this.peer.request("fs/readFile", params)) as FsReadFileResponse;

    return {
      path: filePath,
      text: Buffer.from(response.dataBase64, "base64").toString("utf8")
    };
  }

  async execCommand(input: ExecCommandInput): Promise<MobileCommandResult> {
    const params: CommandExecParams = {
      command: input.command,
      cwd: input.cwd,
      timeoutMs: input.timeoutMs ?? 30_000
    };
    const response = (await this.peer.request("command/exec", params)) as CommandExecResponse;

    return {
      exitCode: response.exitCode,
      stdout: response.stdout,
      stderr: response.stderr
    };
  }

  async readSettings(): Promise<MobileSettingsView> {
    const [
      configResponse,
      remoteControlResponse,
      permissionProfileResponse,
      accountResponse,
      rateLimitsResponse,
      mcpServerStatusResponse,
      providerCapabilitiesResponse,
      collaborationModeResponse
    ] = await Promise.all([
      this.peer.request("config/read", {}),
      this.peer.request("remoteControl/status/read", {}),
      this.peer.request("permissionProfile/list", {}),
      this.peer.request("account/read", { refreshToken: false }),
      this.peer.request("account/rateLimits/read", undefined),
      this.peer.request("mcpServerStatus/list", { detail: "full", limit: 50 }),
      this.peer.request("modelProvider/capabilities/read", {}),
      this.peer.request("collaborationMode/list", {})
    ]);
    const config = (configResponse as ConfigReadResponse).config;
    const remoteControl = remoteControlResponse as RemoteControlStatusReadResponse;
    const permissionProfiles = (permissionProfileResponse as PermissionProfileListResponse).data;
    const remoteControlClientsResponse = remoteControl.environmentId
      ? await this.peer.request("remoteControl/client/list", {
          environmentId: remoteControl.environmentId,
          limit: 20,
          order: "desc"
        })
      : { data: [], nextCursor: null };

    return {
      model: settingsValue(config.model),
      modelProvider: settingsValue(config.model_provider),
      reasoningEffort: settingsValue(config.model_reasoning_effort),
      approvalPolicy: settingsValue(config.approval_policy),
      sandboxMode: settingsValue(config.sandbox_mode),
      remoteControlStatus: remoteControl.status,
      account: accountView(accountResponse as GetAccountResponse),
      rateLimit: rateLimitView(rateLimitsResponse as GetAccountRateLimitsResponse),
      providerCapabilities: providerCapabilitiesView(providerCapabilitiesResponse as ModelProviderCapabilitiesReadResponse),
      remoteControlClients: remoteControlClientViews(remoteControlClientsResponse as RemoteControlClientsListResponse),
      mcpServers: mcpServerViews(mcpServerStatusResponse as ListMcpServerStatusResponse),
      collaborationModes: collaborationModeViews(collaborationModeResponse as CollaborationModeListResponse),
      permissionProfiles: permissionProfiles.map((profile) => ({
        id: profile.id,
        label: profile.id,
        description: profile.description
      }))
    };
  }

  async listThreadTurns(input: ListThreadTurnsInput): Promise<MobileTimelinePage> {
    const params: ThreadTurnsListParams = {
      threadId: input.threadId,
      cursor: input.cursor,
      limit: input.limit,
      itemsView: "full"
    };
    const response = (await this.peer.request("thread/turns/list", params)) as ThreadTurnsListResponse;

    return {
      items: response.data.flatMap((turn) => turn.items.flatMap((item) => {
        const mapped = timelineItem(item);
        return mapped ? [mapped] : [];
      })),
      nextCursor: response.nextCursor
    };
  }

  async listThreadTurnItems(input: ListThreadTurnItemsInput): Promise<MobileTimelinePage> {
    const params: ThreadTurnsItemsListParams = {
      threadId: input.threadId,
      turnId: input.turnId,
      cursor: input.cursor,
      limit: input.limit
    };
    const response = (await this.peer.request("thread/turns/items/list", params)) as ThreadTurnsItemsListResponse;

    return {
      items: response.data.flatMap((item) => {
        const mapped = timelineItem(item);
        return mapped ? [mapped] : [];
      }),
      nextCursor: response.nextCursor
    };
  }
}
