import { Buffer } from "node:buffer";
import path from "node:path";
import type { InitializeParams } from "../../../docs/generated/app-server-ts/InitializeParams";
import type { InitializeResponse } from "../../../docs/generated/app-server-ts/InitializeResponse";
import type { FuzzyFileSearchParams } from "../../../docs/generated/app-server-ts/FuzzyFileSearchParams";
import type { FuzzyFileSearchResponse } from "../../../docs/generated/app-server-ts/FuzzyFileSearchResponse";
import type { FuzzyFileSearchResult } from "../../../docs/generated/app-server-ts/FuzzyFileSearchResult";
import type { ThreadMemoryMode } from "../../../docs/generated/app-server-ts/ThreadMemoryMode";
import type { AppInfo } from "../../../docs/generated/app-server-ts/v2/AppInfo";
import type { AppsListParams } from "../../../docs/generated/app-server-ts/v2/AppsListParams";
import type { AppsListResponse } from "../../../docs/generated/app-server-ts/v2/AppsListResponse";
import type { CommandExecParams } from "../../../docs/generated/app-server-ts/v2/CommandExecParams";
import type { CommandExecResizeParams } from "../../../docs/generated/app-server-ts/v2/CommandExecResizeParams";
import type { CommandExecResponse } from "../../../docs/generated/app-server-ts/v2/CommandExecResponse";
import type { CommandExecTerminateParams } from "../../../docs/generated/app-server-ts/v2/CommandExecTerminateParams";
import type { CommandExecWriteParams } from "../../../docs/generated/app-server-ts/v2/CommandExecWriteParams";
import type { ConfigRequirements } from "../../../docs/generated/app-server-ts/v2/ConfigRequirements";
import type { ConfigRequirementsReadResponse } from "../../../docs/generated/app-server-ts/v2/ConfigRequirementsReadResponse";
import type { ConfigReadResponse } from "../../../docs/generated/app-server-ts/v2/ConfigReadResponse";
import type { CancelLoginAccountParams } from "../../../docs/generated/app-server-ts/v2/CancelLoginAccountParams";
import type { CancelLoginAccountResponse } from "../../../docs/generated/app-server-ts/v2/CancelLoginAccountResponse";
import type { ExperimentalFeatureEnablementSetParams } from "../../../docs/generated/app-server-ts/v2/ExperimentalFeatureEnablementSetParams";
import type { ExperimentalFeatureListParams } from "../../../docs/generated/app-server-ts/v2/ExperimentalFeatureListParams";
import type { ExperimentalFeatureListResponse } from "../../../docs/generated/app-server-ts/v2/ExperimentalFeatureListResponse";
import type { FsCopyParams } from "../../../docs/generated/app-server-ts/v2/FsCopyParams";
import type { FsCreateDirectoryParams } from "../../../docs/generated/app-server-ts/v2/FsCreateDirectoryParams";
import type { FsGetMetadataParams } from "../../../docs/generated/app-server-ts/v2/FsGetMetadataParams";
import type { FsGetMetadataResponse } from "../../../docs/generated/app-server-ts/v2/FsGetMetadataResponse";
import type { FsReadDirectoryParams } from "../../../docs/generated/app-server-ts/v2/FsReadDirectoryParams";
import type { FsReadDirectoryResponse } from "../../../docs/generated/app-server-ts/v2/FsReadDirectoryResponse";
import type { FsReadFileParams } from "../../../docs/generated/app-server-ts/v2/FsReadFileParams";
import type { FsReadFileResponse } from "../../../docs/generated/app-server-ts/v2/FsReadFileResponse";
import type { FsRemoveParams } from "../../../docs/generated/app-server-ts/v2/FsRemoveParams";
import type { FsWriteFileParams } from "../../../docs/generated/app-server-ts/v2/FsWriteFileParams";
import type { GetAccountRateLimitsResponse } from "../../../docs/generated/app-server-ts/v2/GetAccountRateLimitsResponse";
import type { GetAccountResponse } from "../../../docs/generated/app-server-ts/v2/GetAccountResponse";
import type { GetAccountTokenUsageResponse } from "../../../docs/generated/app-server-ts/v2/GetAccountTokenUsageResponse";
import type { HooksListParams } from "../../../docs/generated/app-server-ts/v2/HooksListParams";
import type { HooksListResponse } from "../../../docs/generated/app-server-ts/v2/HooksListResponse";
import type { CollaborationModeListResponse } from "../../../docs/generated/app-server-ts/v2/CollaborationModeListResponse";
import type { ListMcpServerStatusResponse } from "../../../docs/generated/app-server-ts/v2/ListMcpServerStatusResponse";
import type { LoginAccountParams } from "../../../docs/generated/app-server-ts/v2/LoginAccountParams";
import type { LoginAccountResponse } from "../../../docs/generated/app-server-ts/v2/LoginAccountResponse";
import type { ModelListParams } from "../../../docs/generated/app-server-ts/v2/ModelListParams";
import type { ModelListResponse } from "../../../docs/generated/app-server-ts/v2/ModelListResponse";
import type { ModelProviderCapabilitiesReadResponse } from "../../../docs/generated/app-server-ts/v2/ModelProviderCapabilitiesReadResponse";
import type { McpResourceReadParams } from "../../../docs/generated/app-server-ts/v2/McpResourceReadParams";
import type { McpResourceReadResponse } from "../../../docs/generated/app-server-ts/v2/McpResourceReadResponse";
import type { McpServerOauthLoginParams } from "../../../docs/generated/app-server-ts/v2/McpServerOauthLoginParams";
import type { McpServerOauthLoginResponse } from "../../../docs/generated/app-server-ts/v2/McpServerOauthLoginResponse";
import type { PermissionProfileListResponse } from "../../../docs/generated/app-server-ts/v2/PermissionProfileListResponse";
import type { PluginDetail } from "../../../docs/generated/app-server-ts/v2/PluginDetail";
import type { PluginInstallParams } from "../../../docs/generated/app-server-ts/v2/PluginInstallParams";
import type { PluginInstallResponse } from "../../../docs/generated/app-server-ts/v2/PluginInstallResponse";
import type { PluginListParams } from "../../../docs/generated/app-server-ts/v2/PluginListParams";
import type { PluginListResponse } from "../../../docs/generated/app-server-ts/v2/PluginListResponse";
import type { PluginReadParams } from "../../../docs/generated/app-server-ts/v2/PluginReadParams";
import type { PluginReadResponse } from "../../../docs/generated/app-server-ts/v2/PluginReadResponse";
import type { PluginSkillReadParams } from "../../../docs/generated/app-server-ts/v2/PluginSkillReadParams";
import type { PluginSkillReadResponse } from "../../../docs/generated/app-server-ts/v2/PluginSkillReadResponse";
import type { PluginUninstallParams } from "../../../docs/generated/app-server-ts/v2/PluginUninstallParams";
import type { ProcessKillParams } from "../../../docs/generated/app-server-ts/v2/ProcessKillParams";
import type { ProcessResizePtyParams } from "../../../docs/generated/app-server-ts/v2/ProcessResizePtyParams";
import type { ProcessSpawnParams } from "../../../docs/generated/app-server-ts/v2/ProcessSpawnParams";
import type { ProcessWriteStdinParams } from "../../../docs/generated/app-server-ts/v2/ProcessWriteStdinParams";
import type { RemoteControlClientsListResponse } from "../../../docs/generated/app-server-ts/v2/RemoteControlClientsListResponse";
import type { RemoteControlClientsRevokeParams } from "../../../docs/generated/app-server-ts/v2/RemoteControlClientsRevokeParams";
import type { RemoteControlDisableParams } from "../../../docs/generated/app-server-ts/v2/RemoteControlDisableParams";
import type { RemoteControlDisableResponse } from "../../../docs/generated/app-server-ts/v2/RemoteControlDisableResponse";
import type { RemoteControlEnableParams } from "../../../docs/generated/app-server-ts/v2/RemoteControlEnableParams";
import type { RemoteControlEnableResponse } from "../../../docs/generated/app-server-ts/v2/RemoteControlEnableResponse";
import type { RemoteControlPairingStartParams } from "../../../docs/generated/app-server-ts/v2/RemoteControlPairingStartParams";
import type { RemoteControlPairingStartResponse } from "../../../docs/generated/app-server-ts/v2/RemoteControlPairingStartResponse";
import type { RemoteControlPairingStatusParams } from "../../../docs/generated/app-server-ts/v2/RemoteControlPairingStatusParams";
import type { RemoteControlPairingStatusResponse } from "../../../docs/generated/app-server-ts/v2/RemoteControlPairingStatusResponse";
import type { RemoteControlStatusReadResponse } from "../../../docs/generated/app-server-ts/v2/RemoteControlStatusReadResponse";
import type { ReviewStartParams } from "../../../docs/generated/app-server-ts/v2/ReviewStartParams";
import type { ReviewStartResponse } from "../../../docs/generated/app-server-ts/v2/ReviewStartResponse";
import type { SkillsListParams } from "../../../docs/generated/app-server-ts/v2/SkillsListParams";
import type { SkillsListResponse } from "../../../docs/generated/app-server-ts/v2/SkillsListResponse";
import type { SkillsConfigWriteParams } from "../../../docs/generated/app-server-ts/v2/SkillsConfigWriteParams";
import type { SkillsConfigWriteResponse } from "../../../docs/generated/app-server-ts/v2/SkillsConfigWriteResponse";
import type { SkillsExtraRootsSetParams } from "../../../docs/generated/app-server-ts/v2/SkillsExtraRootsSetParams";
import type { SendAddCreditsNudgeEmailParams } from "../../../docs/generated/app-server-ts/v2/SendAddCreditsNudgeEmailParams";
import type { SendAddCreditsNudgeEmailResponse } from "../../../docs/generated/app-server-ts/v2/SendAddCreditsNudgeEmailResponse";
import type { Thread } from "../../../docs/generated/app-server-ts/v2/Thread";
import type { ThreadArchiveParams } from "../../../docs/generated/app-server-ts/v2/ThreadArchiveParams";
import type { ThreadBackgroundTerminalsCleanParams } from "../../../docs/generated/app-server-ts/v2/ThreadBackgroundTerminalsCleanParams";
import type { ThreadBackgroundTerminalsListParams } from "../../../docs/generated/app-server-ts/v2/ThreadBackgroundTerminalsListParams";
import type { ThreadBackgroundTerminalsListResponse } from "../../../docs/generated/app-server-ts/v2/ThreadBackgroundTerminalsListResponse";
import type { ThreadBackgroundTerminalsTerminateParams } from "../../../docs/generated/app-server-ts/v2/ThreadBackgroundTerminalsTerminateParams";
import type { ThreadBackgroundTerminalsTerminateResponse } from "../../../docs/generated/app-server-ts/v2/ThreadBackgroundTerminalsTerminateResponse";
import type { ThreadCompactStartParams } from "../../../docs/generated/app-server-ts/v2/ThreadCompactStartParams";
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
import type { ThreadLoadedListParams } from "../../../docs/generated/app-server-ts/v2/ThreadLoadedListParams";
import type { ThreadLoadedListResponse } from "../../../docs/generated/app-server-ts/v2/ThreadLoadedListResponse";
import type { ThreadMemoryModeSetParams } from "../../../docs/generated/app-server-ts/v2/ThreadMemoryModeSetParams";
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
import type { WindowsSandboxReadinessResponse } from "../../../docs/generated/app-server-ts/v2/WindowsSandboxReadinessResponse";
import type { WindowsSandboxSetupMode } from "../../../docs/generated/app-server-ts/v2/WindowsSandboxSetupMode";
import type { WindowsSandboxSetupStartParams } from "../../../docs/generated/app-server-ts/v2/WindowsSandboxSetupStartParams";
import type { WindowsSandboxSetupStartResponse } from "../../../docs/generated/app-server-ts/v2/WindowsSandboxSetupStartResponse";
import type {
  MobileCommandResult,
  MobileAccountView,
  MobileAccountLoginCancelView,
  MobileAccountLoginView,
  MobileAccountTokenUsageView,
  MobileAddCreditsNudgeResultView,
  MobileAppPage,
  MobileAppView,
  MobileBackgroundTerminalPage,
  MobileCollaborationModeView,
  MobileConfigRequirementsView,
  MobileExperimentalFeatureView,
  MobileFileContent,
  MobileFileEntry,
  MobileFileMetadata,
  MobileFileSearchResult,
  MobileHookErrorView,
  MobileHookNoticeView,
  MobileHookView,
  MobileMcpServerView,
  MobileMcpLoginView,
  MobileModelOption,
  MobileModelProviderCapabilitiesView,
  MobileMcpResourceReadView,
  MobilePluginMarketplaceErrorView,
  MobilePluginDetailView,
  MobilePluginInstallResultView,
  MobilePluginSkillContentView,
  MobilePluginView,
  MobileRateLimitView,
  MobileRemoteControlClientView,
  MobileRemoteControlPairingStatusView,
  MobileRemoteControlPairingView,
  MobileRemoteControlStatusView,
  MobileSettingsView,
  MobileSkillConfigWriteResultView,
  MobileSkillErrorView,
  MobileSkillView,
  MobileThreadGoalView,
  MobileTimelinePage,
  MobileThreadDetail,
  MobileThreadPage,
  MobileThreadSummary,
  MobileTimelineItem,
  MobileWindowsSandboxReadinessView,
  MobileWindowsSandboxSetupResultView
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

export type StartCommandExecInput = {
  processId: string;
  command: string[];
  cwd: string;
};

export type SearchFilesInput = {
  query: string;
  roots: string[];
  cancellationToken?: string | null;
};

export type StartProcessInput = {
  processHandle: string;
  command: string[];
  cwd: string;
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

export type PluginLookupInput = {
  marketplacePath?: string | null;
  remoteMarketplaceName?: string | null;
  pluginName: string;
};

export type PluginSkillReadInput = {
  remoteMarketplaceName: string;
  remotePluginId: string;
  skillName: string;
};

export type ReadMcpResourceInput = {
  server: string;
  uri: string;
  threadId?: string | null;
};

export type WriteSkillConfigInput = {
  name?: string | null;
  path?: string | null;
  enabled: boolean;
};

export type ListThreadBackgroundTerminalsInput = {
  threadId: string;
  cursor?: string | null;
  limit?: number | null;
};

export type ListAppsInput = {
  cursor?: string | null;
  limit?: number | null;
  threadId?: string | null;
  forceRefetch?: boolean;
};

export type WindowsSandboxSetupInput = {
  mode: WindowsSandboxSetupMode;
  cwd?: string | null;
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

  if (item.type === "enteredReviewMode") {
    return { id: item.id, role: "tool", text: `代码审查：${item.review}` };
  }

  if (item.type === "exitedReviewMode") {
    return { id: item.id, role: "tool", text: `代码审查结束：${item.review}` };
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

function fileSearchResult(result: FuzzyFileSearchResult): MobileFileSearchResult {
  const fullPath = /^[A-Za-z]:[\\/]/.test(result.path) || result.path.startsWith("\\\\")
    ? result.path
    : joinChildPath(result.root, result.path);
  return {
    root: result.root,
    path: result.path,
    fullPath,
    fileName: result.file_name,
    matchType: result.match_type,
    score: result.score,
    indices: result.indices
  };
}

function settingsValue(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  return typeof value === "string" ? value : JSON.stringify(value);
}

function nullableNumber(value: bigint | number | null | undefined): number | null {
  return value === null || value === undefined ? null : Number(value);
}

function accountTokenUsageView(response: GetAccountTokenUsageResponse): MobileAccountTokenUsageView {
  return {
    summary: {
      lifetimeTokens: nullableNumber(response.summary.lifetimeTokens),
      peakDailyTokens: nullableNumber(response.summary.peakDailyTokens),
      longestRunningTurnSec: nullableNumber(response.summary.longestRunningTurnSec),
      currentStreakDays: nullableNumber(response.summary.currentStreakDays),
      longestStreakDays: nullableNumber(response.summary.longestStreakDays)
    },
    dailyUsageBuckets:
      response.dailyUsageBuckets?.map((bucket) => ({
        startDate: bucket.startDate,
        tokens: Number(bucket.tokens)
      })) ?? null
  };
}

function backgroundTerminalPage(response: ThreadBackgroundTerminalsListResponse): MobileBackgroundTerminalPage {
  return {
    terminals: response.data.map((terminal) => ({
      itemId: terminal.itemId,
      processId: terminal.processId,
      command: terminal.command,
      cwd: terminal.cwd,
      osPid: terminal.osPid,
      cpuPercent: terminal.cpuPercent,
      rssKb: nullableNumber(terminal.rssKb)
    })),
    nextCursor: response.nextCursor
  };
}

function appView(app: AppInfo): MobileAppView {
  return {
    id: app.id,
    name: app.name,
    description: app.description,
    category: app.branding?.category ?? app.appMetadata?.categories?.[0] ?? null,
    developer: app.branding?.developer ?? app.appMetadata?.developer ?? null,
    installUrl: app.installUrl,
    isAccessible: app.isAccessible,
    isEnabled: app.isEnabled,
    pluginDisplayNames: app.pluginDisplayNames
  };
}

function booleanRecord(value: { [key in string]?: boolean } | null): Record<string, boolean> | null {
  if (!value) {
    return null;
  }

  return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, boolean] => entry[1] !== undefined));
}

function configRequirementsView(requirements: ConfigRequirements | null): MobileConfigRequirementsView | null {
  if (!requirements) {
    return null;
  }

  return {
    allowedApprovalPolicies: requirements.allowedApprovalPolicies?.map(String) ?? null,
    allowedSandboxModes: requirements.allowedSandboxModes?.map(String) ?? null,
    allowedWindowsSandboxImplementations: requirements.allowedWindowsSandboxImplementations?.map(String) ?? null,
    allowedPermissionProfiles: booleanRecord(requirements.allowedPermissionProfiles),
    defaultPermissions: requirements.defaultPermissions,
    allowManagedHooksOnly: requirements.allowManagedHooksOnly,
    allowAppshots: requirements.allowAppshots,
    allowRemoteControl: requirements.allowRemoteControl,
    featureRequirements: booleanRecord(requirements.featureRequirements)
  };
}

function experimentalFeatureViews(response: ExperimentalFeatureListResponse): MobileExperimentalFeatureView[] {
  return response.data.map((feature) => ({
    name: feature.name,
    stage: feature.stage,
    displayName: feature.displayName,
    description: feature.description,
    announcement: feature.announcement,
    enabled: feature.enabled,
    defaultEnabled: feature.defaultEnabled
  }));
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

function remoteControlStatusView(
  response: RemoteControlEnableResponse | RemoteControlDisableResponse | RemoteControlStatusReadResponse
): MobileRemoteControlStatusView {
  return {
    status: response.status,
    serverName: response.serverName,
    installationId: response.installationId,
    environmentId: response.environmentId
  };
}

function mcpServerViews(response: ListMcpServerStatusResponse): MobileMcpServerView[] {
  return response.data.map((server) => ({
    name: server.name,
    authStatus: server.authStatus,
    toolCount: Object.keys(server.tools).length,
    resourceCount: server.resources.length,
    resourceTemplateCount: server.resourceTemplates.length,
    resources: server.resources.map((resource) => ({
      uri: resource.uri,
      name: resource.title || resource.name,
      mimeType: resource.mimeType ?? null
    }))
  }));
}

function mcpResourceReadView(response: McpResourceReadResponse): MobileMcpResourceReadView {
  return {
    contents: response.contents.map((content) => ({
      uri: content.uri,
      mimeType: content.mimeType ?? null,
      ...("text" in content ? { text: content.text } : { blob: content.blob })
    }))
  };
}

function collaborationModeViews(response: CollaborationModeListResponse): MobileCollaborationModeView[] {
  return response.data.map((mode) => ({
    name: mode.name,
    mode: mode.mode,
    model: mode.model,
    reasoningEffort: mode.reasoning_effort
  }));
}

function skillViews(response: SkillsListResponse): MobileSkillView[] {
  return response.data.flatMap((entry) =>
    entry.skills.map((skill) => ({
      cwd: entry.cwd,
      name: skill.name,
      description: skill.description,
      shortDescription: skill.shortDescription ?? null,
      scope: skill.scope,
      enabled: skill.enabled
    }))
  );
}

function skillErrorViews(response: SkillsListResponse): MobileSkillErrorView[] {
  return response.data.flatMap((entry) =>
    entry.errors.map((error) => ({
      cwd: entry.cwd,
      path: error.path,
      message: error.message
    }))
  );
}

function hookViews(response: HooksListResponse): MobileHookView[] {
  return response.data.flatMap((entry) =>
    entry.hooks.map((hook) => ({
      cwd: entry.cwd,
      key: hook.key,
      eventName: hook.eventName,
      handlerType: hook.handlerType,
      matcher: hook.matcher,
      command: hook.command,
      source: hook.source,
      sourcePath: hook.sourcePath,
      pluginId: hook.pluginId,
      enabled: hook.enabled,
      trustStatus: hook.trustStatus,
      statusMessage: hook.statusMessage
    }))
  );
}

function hookWarningViews(response: HooksListResponse): MobileHookNoticeView[] {
  return response.data.flatMap((entry) => entry.warnings.map((message) => ({ cwd: entry.cwd, message })));
}

function hookErrorViews(response: HooksListResponse): MobileHookErrorView[] {
  return response.data.flatMap((entry) =>
    entry.errors.map((error) => ({
      cwd: entry.cwd,
      path: error.path,
      message: error.message
    }))
  );
}

function pluginViews(response: PluginListResponse): MobilePluginView[] {
  return response.marketplaces.flatMap((marketplace) =>
    marketplace.plugins.map((plugin) => ({
      marketplaceName: marketplace.name,
      marketplacePath: marketplace.path,
      marketplaceDisplayName: marketplace.interface?.displayName ?? null,
      id: plugin.id,
      name: plugin.name,
      displayName: plugin.interface?.displayName ?? null,
      shortDescription: plugin.interface?.shortDescription ?? null,
      installed: plugin.installed,
      enabled: plugin.enabled,
      availability: plugin.availability,
      sourceType: plugin.source.type
    }))
  );
}

function pluginMarketplaceErrorViews(response: PluginListResponse): MobilePluginMarketplaceErrorView[] {
  return response.marketplaceLoadErrors.map((error) => ({
    marketplacePath: error.marketplacePath,
    message: error.message
  }));
}

function pluginDetailView(plugin: PluginDetail): MobilePluginDetailView {
  return {
    marketplaceName: plugin.marketplaceName,
    marketplacePath: plugin.marketplacePath,
    id: plugin.summary.id,
    remotePluginId: plugin.summary.remotePluginId,
    name: plugin.summary.name,
    displayName: plugin.summary.interface?.displayName ?? null,
    description: plugin.description ?? plugin.summary.interface?.longDescription ?? plugin.summary.interface?.shortDescription ?? null,
    installed: plugin.summary.installed,
    enabled: plugin.summary.enabled,
    authPolicy: plugin.summary.authPolicy,
    installPolicy: plugin.summary.installPolicy,
    availability: plugin.summary.availability,
    skillCount: plugin.skills.length,
    skills: plugin.skills.map((skill) => ({
      name: skill.name,
      description: skill.description,
      enabled: skill.enabled
    })),
    hookCount: plugin.hooks.length,
    appCount: plugin.apps.length,
    mcpServers: plugin.mcpServers
  };
}

function pluginLookupParams(input: PluginLookupInput): PluginReadParams {
  return {
    marketplacePath: input.marketplacePath ?? null,
    remoteMarketplaceName: input.remoteMarketplaceName ?? null,
    pluginName: input.pluginName
  };
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

  async compactThread(threadId: string): Promise<void> {
    const params: ThreadCompactStartParams = { threadId };
    await this.peer.request("thread/compact/start", params);
  }

  async startReview(threadId: string): Promise<{ turnId: string; reviewThreadId: string }> {
    const params: ReviewStartParams = {
      threadId,
      target: { type: "uncommittedChanges" },
      delivery: "inline"
    };
    const response = (await this.peer.request("review/start", params)) as ReviewStartResponse;

    return {
      turnId: response.turn.id,
      reviewThreadId: response.reviewThreadId
    };
  }

  async setThreadMemoryMode(threadId: string, mode: ThreadMemoryMode): Promise<void> {
    const params: ThreadMemoryModeSetParams = { threadId, mode };
    await this.peer.request("thread/memoryMode/set", params);
  }

  async resetMemory(): Promise<void> {
    await this.peer.request("memory/reset", undefined);
  }

  async loginWithChatGpt(): Promise<MobileAccountLoginView> {
    const params: LoginAccountParams = { type: "chatgpt", codexStreamlinedLogin: true };
    return (await this.peer.request("account/login/start", params)) as LoginAccountResponse;
  }

  async loginWithApiKey(apiKey: string): Promise<MobileAccountLoginView> {
    const params: LoginAccountParams = { type: "apiKey", apiKey };
    return (await this.peer.request("account/login/start", params)) as LoginAccountResponse;
  }

  async cancelAccountLogin(loginId: string): Promise<MobileAccountLoginCancelView> {
    const params: CancelLoginAccountParams = { loginId };
    return (await this.peer.request("account/login/cancel", params)) as CancelLoginAccountResponse;
  }

  async logoutAccount(): Promise<void> {
    await this.peer.request("account/logout", undefined);
  }

  async getAccountTokenUsage(): Promise<MobileAccountTokenUsageView> {
    const response = (await this.peer.request("account/usage/read", undefined)) as GetAccountTokenUsageResponse;
    return accountTokenUsageView(response);
  }

  async sendAddCreditsNudgeEmail(
    creditType: SendAddCreditsNudgeEmailParams["creditType"]
  ): Promise<MobileAddCreditsNudgeResultView> {
    const params: SendAddCreditsNudgeEmailParams = { creditType };
    return (await this.peer.request(
      "account/sendAddCreditsNudgeEmail",
      params
    )) as SendAddCreditsNudgeEmailResponse;
  }

  async readPlugin(input: PluginLookupInput): Promise<MobilePluginDetailView> {
    const response = (await this.peer.request("plugin/read", pluginLookupParams(input))) as PluginReadResponse;
    return pluginDetailView(response.plugin);
  }

  async installPlugin(input: PluginLookupInput): Promise<MobilePluginInstallResultView> {
    const params: PluginInstallParams = pluginLookupParams(input);
    const response = (await this.peer.request("plugin/install", params)) as PluginInstallResponse;
    return {
      authPolicy: response.authPolicy,
      appsNeedingAuth: response.appsNeedingAuth
    };
  }

  async uninstallPlugin(pluginId: string): Promise<void> {
    const params: PluginUninstallParams = { pluginId };
    await this.peer.request("plugin/uninstall", params);
  }

  async listApps(input: ListAppsInput = {}): Promise<MobileAppPage> {
    const params: AppsListParams = {
      cursor: input.cursor,
      limit: input.limit,
      threadId: input.threadId,
      forceRefetch: input.forceRefetch
    };
    const response = (await this.peer.request("app/list", params)) as AppsListResponse;
    return {
      apps: response.data.map(appView),
      nextCursor: response.nextCursor
    };
  }

  async getConfigRequirements(): Promise<MobileConfigRequirementsView | null> {
    const response = (await this.peer.request("configRequirements/read", undefined)) as ConfigRequirementsReadResponse;
    return configRequirementsView(response.requirements);
  }

  async getWindowsSandboxReadiness(): Promise<MobileWindowsSandboxReadinessView> {
    const response = (await this.peer.request("windowsSandbox/readiness", undefined)) as WindowsSandboxReadinessResponse;
    return { status: response.status };
  }

  async startWindowsSandboxSetup(input: WindowsSandboxSetupInput): Promise<MobileWindowsSandboxSetupResultView> {
    const params: WindowsSandboxSetupStartParams = {
      mode: input.mode,
      cwd: input.cwd ?? null
    };
    return (await this.peer.request("windowsSandbox/setupStart", params)) as WindowsSandboxSetupStartResponse;
  }

  async readPluginSkill(input: PluginSkillReadInput): Promise<MobilePluginSkillContentView> {
    const params: PluginSkillReadParams = {
      remoteMarketplaceName: input.remoteMarketplaceName,
      remotePluginId: input.remotePluginId,
      skillName: input.skillName
    };
    const response = (await this.peer.request("plugin/skill/read", params)) as PluginSkillReadResponse;
    return { contents: response.contents };
  }

  async setSkillsExtraRoots(extraRoots: string[]): Promise<void> {
    const params: SkillsExtraRootsSetParams = { extraRoots };
    await this.peer.request("skills/extraRoots/set", params);
  }

  async writeSkillConfig(input: WriteSkillConfigInput): Promise<MobileSkillConfigWriteResultView> {
    const params: SkillsConfigWriteParams = {
      name: input.name ?? null,
      path: input.path ?? null,
      enabled: input.enabled
    };
    const response = (await this.peer.request("skills/config/write", params)) as SkillsConfigWriteResponse;
    return { effectiveEnabled: response.effectiveEnabled };
  }

  async setExperimentalFeatureEnablement(name: string, enabled: boolean): Promise<void> {
    const params: ExperimentalFeatureEnablementSetParams = {
      enablement: { [name]: enabled }
    };
    await this.peer.request("experimentalFeature/enablement/set", params);
  }

  async refreshMcpServer(): Promise<void> {
    await this.peer.request("config/mcpServer/reload", undefined);
  }

  async loginMcpServer(serverName: string): Promise<MobileMcpLoginView> {
    const params: McpServerOauthLoginParams = { name: serverName };
    const response = (await this.peer.request("mcpServer/oauth/login", params)) as McpServerOauthLoginResponse;
    return { authorizationUrl: response.authorizationUrl };
  }

  async readMcpResource(input: ReadMcpResourceInput): Promise<MobileMcpResourceReadView> {
    const params: McpResourceReadParams = {
      server: input.server,
      uri: input.uri,
      threadId: input.threadId ?? null
    };
    const response = (await this.peer.request("mcpServer/resource/read", params)) as McpResourceReadResponse;
    return mcpResourceReadView(response);
  }

  async enableRemoteControl(): Promise<MobileRemoteControlStatusView> {
    const params: RemoteControlEnableParams = { ephemeral: false };
    const response = (await this.peer.request("remoteControl/enable", params)) as RemoteControlEnableResponse;
    return remoteControlStatusView(response);
  }

  async disableRemoteControl(): Promise<MobileRemoteControlStatusView> {
    const params: RemoteControlDisableParams = { ephemeral: false };
    const response = (await this.peer.request("remoteControl/disable", params)) as RemoteControlDisableResponse;
    return remoteControlStatusView(response);
  }

  async startRemoteControlPairing(): Promise<MobileRemoteControlPairingView> {
    const params: RemoteControlPairingStartParams = { manualCode: true };
    const response = (await this.peer.request(
      "remoteControl/pairing/start",
      params
    )) as RemoteControlPairingStartResponse;

    return {
      pairingCode: response.pairingCode,
      manualPairingCode: response.manualPairingCode,
      environmentId: response.environmentId,
      expiresAt: Number(response.expiresAt)
    };
  }

  async readRemoteControlPairingStatus(
    params: RemoteControlPairingStatusParams
  ): Promise<MobileRemoteControlPairingStatusView> {
    const response = (await this.peer.request(
      "remoteControl/pairing/status",
      params
    )) as RemoteControlPairingStatusResponse;
    return { claimed: response.claimed };
  }

  async revokeRemoteControlClient(environmentId: string, clientId: string): Promise<void> {
    const params: RemoteControlClientsRevokeParams = { environmentId, clientId };
    await this.peer.request("remoteControl/client/revoke", params);
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

  async writeFile(filePath: string, text: string): Promise<void> {
    const params: FsWriteFileParams = {
      path: filePath,
      dataBase64: Buffer.from(text, "utf8").toString("base64")
    };
    await this.peer.request("fs/writeFile", params);
  }

  async createDirectory(directoryPath: string): Promise<void> {
    const params: FsCreateDirectoryParams = { path: directoryPath, recursive: true };
    await this.peer.request("fs/createDirectory", params);
  }

  async removePath(targetPath: string): Promise<void> {
    const params: FsRemoveParams = { path: targetPath, recursive: true, force: true };
    await this.peer.request("fs/remove", params);
  }

  async copyPath(sourcePath: string, destinationPath: string): Promise<void> {
    const params: FsCopyParams = { sourcePath, destinationPath, recursive: true };
    await this.peer.request("fs/copy", params);
  }

  async getMetadata(targetPath: string): Promise<MobileFileMetadata> {
    const params: FsGetMetadataParams = { path: targetPath };
    const response = (await this.peer.request("fs/getMetadata", params)) as FsGetMetadataResponse;
    return {
      isDirectory: response.isDirectory,
      isFile: response.isFile,
      isSymlink: response.isSymlink,
      createdAtMs: response.createdAtMs,
      modifiedAtMs: response.modifiedAtMs
    };
  }

  async searchFiles(input: SearchFilesInput): Promise<MobileFileSearchResult[]> {
    const params: FuzzyFileSearchParams = {
      query: input.query,
      roots: input.roots,
      cancellationToken: input.cancellationToken ?? null
    };
    const response = (await this.peer.request("fuzzyFileSearch", params)) as FuzzyFileSearchResponse;
    return response.files.map(fileSearchResult);
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

  async startCommandExec(input: StartCommandExecInput): Promise<MobileCommandResult> {
    const params: CommandExecParams = {
      processId: input.processId,
      command: input.command,
      cwd: input.cwd,
      tty: true,
      streamStdin: true,
      streamStdoutStderr: true,
      timeoutMs: null,
      size: { cols: 80, rows: 24 }
    };
    const response = (await this.peer.request("command/exec", params)) as CommandExecResponse;

    return {
      exitCode: response.exitCode,
      stdout: response.stdout,
      stderr: response.stderr
    };
  }

  async writeCommandExec(processId: string, text: string): Promise<void> {
    const params: CommandExecWriteParams = {
      processId,
      deltaBase64: Buffer.from(text, "utf8").toString("base64"),
      closeStdin: false
    };
    await this.peer.request("command/exec/write", params);
  }

  async resizeCommandExec(processId: string, cols: number, rows: number): Promise<void> {
    const params: CommandExecResizeParams = {
      processId,
      size: { cols, rows }
    };
    await this.peer.request("command/exec/resize", params);
  }

  async terminateCommandExec(processId: string): Promise<void> {
    const params: CommandExecTerminateParams = { processId };
    await this.peer.request("command/exec/terminate", params);
  }

  async startProcess(input: StartProcessInput): Promise<void> {
    const params: ProcessSpawnParams = {
      processHandle: input.processHandle,
      command: input.command,
      cwd: input.cwd,
      tty: true,
      streamStdin: true,
      streamStdoutStderr: true,
      outputBytesCap: null,
      timeoutMs: null,
      size: { cols: 80, rows: 24 }
    };
    await this.peer.request("process/spawn", params);
  }

  async writeProcessStdin(processHandle: string, text: string): Promise<void> {
    const params: ProcessWriteStdinParams = {
      processHandle,
      deltaBase64: Buffer.from(text, "utf8").toString("base64"),
      closeStdin: false
    };
    await this.peer.request("process/writeStdin", params);
  }

  async resizeProcessPty(processHandle: string, cols: number, rows: number): Promise<void> {
    const params: ProcessResizePtyParams = {
      processHandle,
      size: { cols, rows }
    };
    await this.peer.request("process/resizePty", params);
  }

  async killProcess(processHandle: string): Promise<void> {
    const params: ProcessKillParams = { processHandle };
    await this.peer.request("process/kill", params);
  }

  async listThreadBackgroundTerminals(input: ListThreadBackgroundTerminalsInput): Promise<MobileBackgroundTerminalPage> {
    const params: ThreadBackgroundTerminalsListParams = {
      threadId: input.threadId,
      cursor: input.cursor,
      limit: input.limit
    };
    const response = (await this.peer.request(
      "thread/backgroundTerminals/list",
      params
    )) as ThreadBackgroundTerminalsListResponse;
    return backgroundTerminalPage(response);
  }

  async terminateThreadBackgroundTerminal(
    threadId: string,
    processId: string
  ): Promise<ThreadBackgroundTerminalsTerminateResponse> {
    const params: ThreadBackgroundTerminalsTerminateParams = { threadId, processId };
    return (await this.peer.request(
      "thread/backgroundTerminals/terminate",
      params
    )) as ThreadBackgroundTerminalsTerminateResponse;
  }

  async cleanThreadBackgroundTerminals(threadId: string): Promise<void> {
    const params: ThreadBackgroundTerminalsCleanParams = { threadId };
    await this.peer.request("thread/backgroundTerminals/clean", params);
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
      collaborationModeResponse,
      skillsResponse,
      hooksResponse,
      pluginResponse,
      loadedThreadsResponse,
      experimentalFeaturesResponse
    ] = await Promise.all([
      this.peer.request("config/read", {}),
      this.peer.request("remoteControl/status/read", {}),
      this.peer.request("permissionProfile/list", {}),
      this.peer.request("account/read", { refreshToken: false }),
      this.peer.request("account/rateLimits/read", undefined),
      this.peer.request("mcpServerStatus/list", { detail: "full", limit: 50 }),
      this.peer.request("modelProvider/capabilities/read", {}),
      this.peer.request("collaborationMode/list", {}),
      this.peer.request("skills/list", { forceReload: false } satisfies SkillsListParams),
      this.peer.request("hooks/list", {} satisfies HooksListParams),
      this.peer.request("plugin/list", { cwds: null, marketplaceKinds: null } satisfies PluginListParams),
      this.peer.request("thread/loaded/list", {
        cursor: undefined,
        limit: 50
      } satisfies ThreadLoadedListParams),
      this.peer.request("experimentalFeature/list", {
        cursor: undefined,
        limit: 50,
        threadId: undefined
      } satisfies ExperimentalFeatureListParams)
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
      loadedThreadIds: (loadedThreadsResponse as ThreadLoadedListResponse).data,
      experimentalFeatures: experimentalFeatureViews(experimentalFeaturesResponse as ExperimentalFeatureListResponse),
      remoteControlStatus: remoteControl.status,
      remoteControlServerName: remoteControl.serverName,
      remoteControlInstallationId: remoteControl.installationId,
      remoteControlEnvironmentId: remoteControl.environmentId,
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
      })),
      skills: skillViews(skillsResponse as SkillsListResponse),
      skillErrors: skillErrorViews(skillsResponse as SkillsListResponse),
      hooks: hookViews(hooksResponse as HooksListResponse),
      hookWarnings: hookWarningViews(hooksResponse as HooksListResponse),
      hookErrors: hookErrorViews(hooksResponse as HooksListResponse),
      plugins: pluginViews(pluginResponse as PluginListResponse),
      pluginMarketplaceErrors: pluginMarketplaceErrorViews(pluginResponse as PluginListResponse)
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
