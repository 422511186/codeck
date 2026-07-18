import { Buffer } from "node:buffer";
import path from "node:path";
import type { InitializeParams } from "../../../docs/generated/app-server-ts/InitializeParams";
import type { InitializeResponse } from "../../../docs/generated/app-server-ts/InitializeResponse";
import type { FuzzyFileSearchParams } from "../../../docs/generated/app-server-ts/FuzzyFileSearchParams";
import type { FuzzyFileSearchResponse } from "../../../docs/generated/app-server-ts/FuzzyFileSearchResponse";
import type { FuzzyFileSearchResult } from "../../../docs/generated/app-server-ts/FuzzyFileSearchResult";
import type { FuzzyFileSearchSessionStartParams } from "../../../docs/generated/app-server-ts/FuzzyFileSearchSessionStartParams";
import type { FuzzyFileSearchSessionStopParams } from "../../../docs/generated/app-server-ts/FuzzyFileSearchSessionStopParams";
import type { FuzzyFileSearchSessionUpdateParams } from "../../../docs/generated/app-server-ts/FuzzyFileSearchSessionUpdateParams";
import type { GetAuthStatusParams } from "../../../docs/generated/app-server-ts/GetAuthStatusParams";
import type { GetAuthStatusResponse } from "../../../docs/generated/app-server-ts/GetAuthStatusResponse";
import type { GetConversationSummaryParams } from "../../../docs/generated/app-server-ts/GetConversationSummaryParams";
import type { GetConversationSummaryResponse } from "../../../docs/generated/app-server-ts/GetConversationSummaryResponse";
import type { GitDiffToRemoteParams } from "../../../docs/generated/app-server-ts/GitDiffToRemoteParams";
import type { GitDiffToRemoteResponse } from "../../../docs/generated/app-server-ts/GitDiffToRemoteResponse";
import type { CollaborationMode } from "../../../docs/generated/app-server-ts/CollaborationMode";
import type { JsonValue } from "../../../docs/generated/app-server-ts/serde_json/JsonValue";
import type { ThreadMemoryMode } from "../../../docs/generated/app-server-ts/ThreadMemoryMode";
import type { AppInfo } from "../../../docs/generated/app-server-ts/v2/AppInfo";
import type { AppsListParams } from "../../../docs/generated/app-server-ts/v2/AppsListParams";
import type { AppsListResponse } from "../../../docs/generated/app-server-ts/v2/AppsListResponse";
import type { CommandExecParams } from "../../../docs/generated/app-server-ts/v2/CommandExecParams";
import type { CommandExecResizeParams } from "../../../docs/generated/app-server-ts/v2/CommandExecResizeParams";
import type { CommandExecResponse } from "../../../docs/generated/app-server-ts/v2/CommandExecResponse";
import type { CommandExecTerminateParams } from "../../../docs/generated/app-server-ts/v2/CommandExecTerminateParams";
import type { CommandExecWriteParams } from "../../../docs/generated/app-server-ts/v2/CommandExecWriteParams";
import type { ConfigBatchWriteParams } from "../../../docs/generated/app-server-ts/v2/ConfigBatchWriteParams";
import type { ConfigEdit } from "../../../docs/generated/app-server-ts/v2/ConfigEdit";
import type { ConfigRequirements } from "../../../docs/generated/app-server-ts/v2/ConfigRequirements";
import type { ConfigRequirementsReadResponse } from "../../../docs/generated/app-server-ts/v2/ConfigRequirementsReadResponse";
import type { ConfigReadResponse } from "../../../docs/generated/app-server-ts/v2/ConfigReadResponse";
import type { ConfigValueWriteParams } from "../../../docs/generated/app-server-ts/v2/ConfigValueWriteParams";
import type { ConfigWriteResponse } from "../../../docs/generated/app-server-ts/v2/ConfigWriteResponse";
import type { ConsumeAccountRateLimitResetCreditParams } from "../../../docs/generated/app-server-ts/v2/ConsumeAccountRateLimitResetCreditParams";
import type { ConsumeAccountRateLimitResetCreditResponse } from "../../../docs/generated/app-server-ts/v2/ConsumeAccountRateLimitResetCreditResponse";
import type { CancelLoginAccountParams } from "../../../docs/generated/app-server-ts/v2/CancelLoginAccountParams";
import type { CancelLoginAccountResponse } from "../../../docs/generated/app-server-ts/v2/CancelLoginAccountResponse";
import type { EnvironmentAddParams } from "../../../docs/generated/app-server-ts/v2/EnvironmentAddParams";
import type { EnvironmentAddResponse } from "../../../docs/generated/app-server-ts/v2/EnvironmentAddResponse";
import type { ExperimentalFeatureEnablementSetParams } from "../../../docs/generated/app-server-ts/v2/ExperimentalFeatureEnablementSetParams";
import type { ExperimentalFeatureListParams } from "../../../docs/generated/app-server-ts/v2/ExperimentalFeatureListParams";
import type { ExperimentalFeatureListResponse } from "../../../docs/generated/app-server-ts/v2/ExperimentalFeatureListResponse";
import type { ExternalAgentConfigDetectParams } from "../../../docs/generated/app-server-ts/v2/ExternalAgentConfigDetectParams";
import type { ExternalAgentConfigDetectResponse } from "../../../docs/generated/app-server-ts/v2/ExternalAgentConfigDetectResponse";
import type { ExternalAgentConfigImportParams } from "../../../docs/generated/app-server-ts/v2/ExternalAgentConfigImportParams";
import type { ExternalAgentConfigImportResponse } from "../../../docs/generated/app-server-ts/v2/ExternalAgentConfigImportResponse";
import type { FeedbackUploadParams } from "../../../docs/generated/app-server-ts/v2/FeedbackUploadParams";
import type { FeedbackUploadResponse } from "../../../docs/generated/app-server-ts/v2/FeedbackUploadResponse";
import type { FsCopyParams } from "../../../docs/generated/app-server-ts/v2/FsCopyParams";
import type { FsCreateDirectoryParams } from "../../../docs/generated/app-server-ts/v2/FsCreateDirectoryParams";
import type { FsGetMetadataParams } from "../../../docs/generated/app-server-ts/v2/FsGetMetadataParams";
import type { FsGetMetadataResponse } from "../../../docs/generated/app-server-ts/v2/FsGetMetadataResponse";
import type { FsReadDirectoryParams } from "../../../docs/generated/app-server-ts/v2/FsReadDirectoryParams";
import type { FsReadDirectoryResponse } from "../../../docs/generated/app-server-ts/v2/FsReadDirectoryResponse";
import type { FsReadFileParams } from "../../../docs/generated/app-server-ts/v2/FsReadFileParams";
import type { FsReadFileResponse } from "../../../docs/generated/app-server-ts/v2/FsReadFileResponse";
import type { FsRemoveParams } from "../../../docs/generated/app-server-ts/v2/FsRemoveParams";
import type { FsUnwatchParams } from "../../../docs/generated/app-server-ts/v2/FsUnwatchParams";
import type { FsWatchParams } from "../../../docs/generated/app-server-ts/v2/FsWatchParams";
import type { FsWatchResponse } from "../../../docs/generated/app-server-ts/v2/FsWatchResponse";
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
import type { MarketplaceAddParams } from "../../../docs/generated/app-server-ts/v2/MarketplaceAddParams";
import type { MarketplaceAddResponse } from "../../../docs/generated/app-server-ts/v2/MarketplaceAddResponse";
import type { MarketplaceRemoveParams } from "../../../docs/generated/app-server-ts/v2/MarketplaceRemoveParams";
import type { MarketplaceRemoveResponse } from "../../../docs/generated/app-server-ts/v2/MarketplaceRemoveResponse";
import type { MarketplaceUpgradeParams } from "../../../docs/generated/app-server-ts/v2/MarketplaceUpgradeParams";
import type { MarketplaceUpgradeResponse } from "../../../docs/generated/app-server-ts/v2/MarketplaceUpgradeResponse";
import type { ModelListParams } from "../../../docs/generated/app-server-ts/v2/ModelListParams";
import type { ModelListResponse } from "../../../docs/generated/app-server-ts/v2/ModelListResponse";
import type { ModelProviderCapabilitiesReadResponse } from "../../../docs/generated/app-server-ts/v2/ModelProviderCapabilitiesReadResponse";
import type { MockExperimentalMethodParams } from "../../../docs/generated/app-server-ts/v2/MockExperimentalMethodParams";
import type { MockExperimentalMethodResponse } from "../../../docs/generated/app-server-ts/v2/MockExperimentalMethodResponse";
import type { McpResourceReadParams } from "../../../docs/generated/app-server-ts/v2/McpResourceReadParams";
import type { McpResourceReadResponse } from "../../../docs/generated/app-server-ts/v2/McpResourceReadResponse";
import type { McpServerOauthLoginParams } from "../../../docs/generated/app-server-ts/v2/McpServerOauthLoginParams";
import type { McpServerOauthLoginResponse } from "../../../docs/generated/app-server-ts/v2/McpServerOauthLoginResponse";
import type { McpServerToolCallParams } from "../../../docs/generated/app-server-ts/v2/McpServerToolCallParams";
import type { McpServerToolCallResponse } from "../../../docs/generated/app-server-ts/v2/McpServerToolCallResponse";
import type { PermissionProfileListResponse } from "../../../docs/generated/app-server-ts/v2/PermissionProfileListResponse";
import type { PluginDetail } from "../../../docs/generated/app-server-ts/v2/PluginDetail";
import type { PluginInstallParams } from "../../../docs/generated/app-server-ts/v2/PluginInstallParams";
import type { PluginInstallResponse } from "../../../docs/generated/app-server-ts/v2/PluginInstallResponse";
import type { PluginInstalledParams } from "../../../docs/generated/app-server-ts/v2/PluginInstalledParams";
import type { PluginInstalledResponse } from "../../../docs/generated/app-server-ts/v2/PluginInstalledResponse";
import type { PluginListParams } from "../../../docs/generated/app-server-ts/v2/PluginListParams";
import type { PluginListResponse } from "../../../docs/generated/app-server-ts/v2/PluginListResponse";
import type { PluginReadParams } from "../../../docs/generated/app-server-ts/v2/PluginReadParams";
import type { PluginReadResponse } from "../../../docs/generated/app-server-ts/v2/PluginReadResponse";
import type { PluginShareCheckoutParams } from "../../../docs/generated/app-server-ts/v2/PluginShareCheckoutParams";
import type { PluginShareCheckoutResponse } from "../../../docs/generated/app-server-ts/v2/PluginShareCheckoutResponse";
import type { PluginShareDeleteParams } from "../../../docs/generated/app-server-ts/v2/PluginShareDeleteParams";
import type { PluginShareDeleteResponse } from "../../../docs/generated/app-server-ts/v2/PluginShareDeleteResponse";
import type { PluginShareListParams } from "../../../docs/generated/app-server-ts/v2/PluginShareListParams";
import type { PluginShareListResponse } from "../../../docs/generated/app-server-ts/v2/PluginShareListResponse";
import type { PluginShareSaveParams } from "../../../docs/generated/app-server-ts/v2/PluginShareSaveParams";
import type { PluginShareSaveResponse } from "../../../docs/generated/app-server-ts/v2/PluginShareSaveResponse";
import type { PluginShareUpdateTargetsParams } from "../../../docs/generated/app-server-ts/v2/PluginShareUpdateTargetsParams";
import type { PluginShareUpdateTargetsResponse } from "../../../docs/generated/app-server-ts/v2/PluginShareUpdateTargetsResponse";
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
import type { ThreadDecrementElicitationParams } from "../../../docs/generated/app-server-ts/v2/ThreadDecrementElicitationParams";
import type { ThreadDecrementElicitationResponse } from "../../../docs/generated/app-server-ts/v2/ThreadDecrementElicitationResponse";
import type { ThreadIncrementElicitationParams } from "../../../docs/generated/app-server-ts/v2/ThreadIncrementElicitationParams";
import type { ThreadIncrementElicitationResponse } from "../../../docs/generated/app-server-ts/v2/ThreadIncrementElicitationResponse";
import type { ThreadGoal } from "../../../docs/generated/app-server-ts/v2/ThreadGoal";
import type { ThreadGoalClearParams } from "../../../docs/generated/app-server-ts/v2/ThreadGoalClearParams";
import type { ThreadGoalGetParams } from "../../../docs/generated/app-server-ts/v2/ThreadGoalGetParams";
import type { ThreadGoalGetResponse } from "../../../docs/generated/app-server-ts/v2/ThreadGoalGetResponse";
import type { ThreadGoalSetParams } from "../../../docs/generated/app-server-ts/v2/ThreadGoalSetParams";
import type { ThreadGoalSetResponse } from "../../../docs/generated/app-server-ts/v2/ThreadGoalSetResponse";
import type { ThreadItem } from "../../../docs/generated/app-server-ts/v2/ThreadItem";
import type { ThreadItemsListParams } from "../../../docs/generated/app-server-ts/v2/ThreadItemsListParams";
import type { ThreadItemsListResponse } from "../../../docs/generated/app-server-ts/v2/ThreadItemsListResponse";
import type { ThreadReadResponse } from "../../../docs/generated/app-server-ts/v2/ThreadReadResponse";
import type { ThreadRealtimeAppendAudioParams } from "../../../docs/generated/app-server-ts/v2/ThreadRealtimeAppendAudioParams";
import type { ThreadRealtimeAppendAudioResponse } from "../../../docs/generated/app-server-ts/v2/ThreadRealtimeAppendAudioResponse";
import type { ThreadRealtimeAppendSpeechParams } from "../../../docs/generated/app-server-ts/v2/ThreadRealtimeAppendSpeechParams";
import type { ThreadRealtimeAppendSpeechResponse } from "../../../docs/generated/app-server-ts/v2/ThreadRealtimeAppendSpeechResponse";
import type { ThreadRealtimeAppendTextParams } from "../../../docs/generated/app-server-ts/v2/ThreadRealtimeAppendTextParams";
import type { ThreadRealtimeAppendTextResponse } from "../../../docs/generated/app-server-ts/v2/ThreadRealtimeAppendTextResponse";
import type { ThreadRealtimeListVoicesParams } from "../../../docs/generated/app-server-ts/v2/ThreadRealtimeListVoicesParams";
import type { ThreadRealtimeListVoicesResponse } from "../../../docs/generated/app-server-ts/v2/ThreadRealtimeListVoicesResponse";
import type { ThreadRealtimeStartParams } from "../../../docs/generated/app-server-ts/v2/ThreadRealtimeStartParams";
import type { ThreadRealtimeStartResponse } from "../../../docs/generated/app-server-ts/v2/ThreadRealtimeStartResponse";
import type { ThreadRealtimeStopParams } from "../../../docs/generated/app-server-ts/v2/ThreadRealtimeStopParams";
import type { ThreadRealtimeStopResponse } from "../../../docs/generated/app-server-ts/v2/ThreadRealtimeStopResponse";
import type { ThreadResumeParams } from "../../../docs/generated/app-server-ts/v2/ThreadResumeParams";
import type { ThreadResumeResponse } from "../../../docs/generated/app-server-ts/v2/ThreadResumeResponse";
import type { ThreadForkParams } from "../../../docs/generated/app-server-ts/v2/ThreadForkParams";
import type { ThreadForkResponse } from "../../../docs/generated/app-server-ts/v2/ThreadForkResponse";
import type { ThreadListParams } from "../../../docs/generated/app-server-ts/v2/ThreadListParams";
import type { ThreadListResponse } from "../../../docs/generated/app-server-ts/v2/ThreadListResponse";
import type { ThreadLoadedListParams } from "../../../docs/generated/app-server-ts/v2/ThreadLoadedListParams";
import type { ThreadLoadedListResponse } from "../../../docs/generated/app-server-ts/v2/ThreadLoadedListResponse";
import type { ThreadMemoryModeSetParams } from "../../../docs/generated/app-server-ts/v2/ThreadMemoryModeSetParams";
import type { ThreadMetadataUpdateParams } from "../../../docs/generated/app-server-ts/v2/ThreadMetadataUpdateParams";
import type { ThreadMetadataUpdateResponse } from "../../../docs/generated/app-server-ts/v2/ThreadMetadataUpdateResponse";
import type { ThreadRollbackParams } from "../../../docs/generated/app-server-ts/v2/ThreadRollbackParams";
import type { ThreadRollbackResponse } from "../../../docs/generated/app-server-ts/v2/ThreadRollbackResponse";
import type { ThreadSearchParams } from "../../../docs/generated/app-server-ts/v2/ThreadSearchParams";
import type { ThreadSearchResponse } from "../../../docs/generated/app-server-ts/v2/ThreadSearchResponse";
import type { ThreadSetNameParams } from "../../../docs/generated/app-server-ts/v2/ThreadSetNameParams";
import type { ThreadSettingsUpdateParams } from "../../../docs/generated/app-server-ts/v2/ThreadSettingsUpdateParams";
import type { ThreadShellCommandParams } from "../../../docs/generated/app-server-ts/v2/ThreadShellCommandParams";
import type { ThreadStartParams } from "../../../docs/generated/app-server-ts/v2/ThreadStartParams";
import type { ThreadStartResponse } from "../../../docs/generated/app-server-ts/v2/ThreadStartResponse";
import type { ThreadStatus } from "../../../docs/generated/app-server-ts/v2/ThreadStatus";
import type { ThreadTurnsListParams } from "../../../docs/generated/app-server-ts/v2/ThreadTurnsListParams";
import type { ThreadTurnsListResponse } from "../../../docs/generated/app-server-ts/v2/ThreadTurnsListResponse";
import type { ThreadUnarchiveParams } from "../../../docs/generated/app-server-ts/v2/ThreadUnarchiveParams";
import type { ThreadUnarchiveResponse } from "../../../docs/generated/app-server-ts/v2/ThreadUnarchiveResponse";
import type { ThreadUnsubscribeParams } from "../../../docs/generated/app-server-ts/v2/ThreadUnsubscribeParams";
import type { ThreadUnsubscribeResponse } from "../../../docs/generated/app-server-ts/v2/ThreadUnsubscribeResponse";
import type { ThreadApproveGuardianDeniedActionParams } from "../../../docs/generated/app-server-ts/v2/ThreadApproveGuardianDeniedActionParams";
import type { ThreadInjectItemsParams } from "../../../docs/generated/app-server-ts/v2/ThreadInjectItemsParams";
import type { TurnError } from "../../../docs/generated/app-server-ts/v2/TurnError";
import type { TurnInterruptParams } from "../../../docs/generated/app-server-ts/v2/TurnInterruptParams";
import type { TurnStatus } from "../../../docs/generated/app-server-ts/v2/TurnStatus";
import type { TurnStartParams } from "../../../docs/generated/app-server-ts/v2/TurnStartParams";
import type { ReasoningSummary } from "../../../docs/generated/app-server-ts/ReasoningSummary";
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
  MobileAuthStatusView,
  MobileAppPage,
  MobileAppView,
  MobileBackgroundTerminalPage,
  MobileCollaborationModeView,
  MobileConfigEditInput,
  MobileConfigRequirementsView,
  MobileConfigWriteResultView,
  MobileEnvironmentAddInput,
  MobileEnvironmentAddResult,
  MobileExperimentalFeatureView,
  MobileExternalAgentConfigDetectInput,
  MobileExternalAgentConfigDetectResult,
  MobileExternalAgentConfigImportInput,
  MobileExternalAgentConfigImportResult,
  MobileFeedbackUploadInput,
  MobileFeedbackUploadResult,
  MobileFileContent,
  MobileFileEntry,
  MobileFileMetadata,
  MobileFileSearchResult,
  MobileHookErrorView,
  MobileHookNoticeView,
  MobileHookView,
  MobileGitDiffView,
  MobileJsonValue,
  MobileMcpServerView,
  MobileMcpLoginView,
  MobileModelDefaultsView,
  MobileModelOption,
  MobileModelProviderCapabilitiesView,
  MobileMarketplaceAddInput,
  MobileMarketplaceAddResult,
  MobileMarketplaceRemoveResult,
  MobileMarketplaceUpgradeResult,
  MobileMockExperimentalMethodResult,
  MobileMcpToolCallInput,
  MobileMcpToolCallResult,
  MobileMcpResourceReadView,
  MobilePluginInstalledInput,
  MobilePluginInstalledResult,
  MobilePluginMarketplaceErrorView,
  MobilePluginDetailView,
  MobilePluginInstallResultView,
  MobilePluginShareCheckoutResult,
  MobilePluginShareDeleteResult,
  MobilePluginShareListResult,
  MobilePluginShareSaveInput,
  MobilePluginShareSaveResult,
  MobilePluginShareUpdateTargetsInput,
  MobilePluginShareUpdateTargetsResult,
  MobilePluginSkillContentView,
  MobilePluginView,
  MobileRateLimitView,
  MobileRateLimitResetCreditConsumeResult,
  MobileRemoteControlClientView,
  MobileRemoteControlPairingStatusView,
  MobileRemoteControlPairingView,
  MobileRemoteControlStatusView,
  MobileSettingsView,
  MobileSkillConfigWriteResultView,
  MobileSkillErrorView,
  MobileSkillListView,
  MobileSkillReference,
  MobileSkillView,
  MobileThreadElicitationResult,
  MobileThreadGoalView,
  MobileThreadMetadataUpdateInput,
  MobileThreadRealtimeAppendAudioInput,
  MobileThreadRealtimeAppendSpeechInput,
  MobileThreadRealtimeAppendTextInput,
  MobileThreadRealtimeStartInput,
  MobileThreadRealtimeStatusResult,
  MobileThreadRealtimeVoicesResult,
  MobileThreadUnsubscribeResult,
  MobileTimelinePage,
  MobileThreadDetail,
  MobileThreadPage,
  MobileThreadSummary,
  MobileTimelineItem,
  MobileWindowsSandboxReadinessView,
  MobileWindowsSandboxSetupResultView
} from "../../shared/codex";
import { createTurnUserInput } from "./user-input";

const DEFAULT_TIMELINE_PAGE_LIMIT = 30;
const MAX_TIMELINE_PAGE_LIMIT = 100;
const LEGACY_THREAD_TURN_PAGE_LIMIT = 1;
const LEGACY_ITEM_CURSOR_KIND = "legacy-thread-items";

type LegacyItemCursor = {
  kind: typeof LEGACY_ITEM_CURSOR_KIND;
  turnCursor: string | null;
  itemOffset: number;
};

function timelinePageLimit(limit: number | null | undefined): number {
  if (typeof limit !== "number" || !Number.isFinite(limit)) {
    return DEFAULT_TIMELINE_PAGE_LIMIT;
  }
  return Math.max(1, Math.min(Math.floor(limit), MAX_TIMELINE_PAGE_LIMIT));
}

function parseLegacyItemCursor(cursor: string | null | undefined): LegacyItemCursor | null {
  if (!cursor) return null;
  try {
    const parsed = JSON.parse(cursor) as Partial<LegacyItemCursor>;
    if (
      parsed.kind === LEGACY_ITEM_CURSOR_KIND &&
      (typeof parsed.turnCursor === "string" || parsed.turnCursor === null) &&
      typeof parsed.itemOffset === "number" &&
      Number.isInteger(parsed.itemOffset) &&
      parsed.itemOffset >= 0
    ) {
      return parsed as LegacyItemCursor;
    }
  } catch {
    return null;
  }
  return null;
}

function legacyItemCursor(turnCursor: string | null, itemOffset: number): string {
  return JSON.stringify({ kind: LEGACY_ITEM_CURSOR_KIND, turnCursor, itemOffset } satisfies LegacyItemCursor);
}

export type AppServerPeer = {
  request(method: string, params: unknown): Promise<unknown>;
  notify?(method: string, params?: unknown): void | Promise<void>;
};

export type StartThreadInput = {
  cwd?: string;
  workspaceRoots?: string[];
  model?: string;
  permissions?: string | null;
  approvalsReviewer?: ThreadStartParams["approvalsReviewer"];
};

export type StartTurnInput = {
  threadId: string;
  text: string;
  imagePaths?: string[];
  skillReferences?: MobileSkillReference[];
  clientUserMessageId?: string;
  model?: string;
  reasoningEffort?: string;
  reasoningSummary?: ReasoningSummary;
  permissions?: string | null;
  approvalsReviewer?: TurnStartParams["approvalsReviewer"];
  additionalContext?: TurnStartParams["additionalContext"];
  collaborationMode?: TurnStartParams["collaborationMode"];
};

export type ThreadTurnExecutionState = {
  turnId: string;
  status: TurnStatus;
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

export type StartFileSearchSessionInput = {
  sessionId: string;
  roots: string[];
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
  archived?: boolean | null;
};

export type GetConversationSummaryInput =
  | { conversationId: string; rolloutPath?: never }
  | { rolloutPath: string; conversationId?: never };

export type UpdateThreadSettingsInput = {
  threadId: string;
  model?: string;
  reasoningEffort?: string;
  permissions?: string | null;
  approvalsReviewer?: ThreadSettingsUpdateParams["approvalsReviewer"];
  collaborationMode?: ThreadSettingsUpdateParams["collaborationMode"];
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

export type ListSkillsInput = {
  enabledOnly?: boolean;
  forceReload?: boolean;
  cwds?: string[];
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

export type AddEnvironmentInput = MobileEnvironmentAddInput;
export type DetectExternalAgentConfigInput = MobileExternalAgentConfigDetectInput;
export type ImportExternalAgentConfigInput = MobileExternalAgentConfigImportInput;
export type UploadFeedbackInput = MobileFeedbackUploadInput;
export type AddMarketplaceInput = MobileMarketplaceAddInput;
export type ListInstalledPluginsInput = MobilePluginInstalledInput;
export type SavePluginShareInput = MobilePluginShareSaveInput;
export type UpdatePluginShareTargetsInput = MobilePluginShareUpdateTargetsInput;
export type CallMcpToolInput = MobileMcpToolCallInput;
export type StartThreadRealtimeInput = MobileThreadRealtimeStartInput;
export type AppendThreadRealtimeAudioInput = MobileThreadRealtimeAppendAudioInput;
export type AppendThreadRealtimeTextInput = MobileThreadRealtimeAppendTextInput;
export type AppendThreadRealtimeSpeechInput = MobileThreadRealtimeAppendSpeechInput;

function configWriteResultView(response: ConfigWriteResponse): MobileConfigWriteResultView {
  return {
    status: String(response.status),
    version: response.version,
    filePath: response.filePath
  };
}

function mobileJson(value: unknown): MobileJsonValue {
  return value as MobileJsonValue;
}

function mobileJsonArray(value: unknown[]): MobileJsonValue[] {
  return value.map((item) => mobileJson(item));
}

function externalAgentConfigDetectView(
  response: ExternalAgentConfigDetectResponse
): MobileExternalAgentConfigDetectResult {
  return {
    items: response.items.map((item) => ({
      itemType: item.itemType,
      description: item.description,
      cwd: item.cwd,
      details: item.details ? mobileJson(item.details) : null
    }))
  };
}

function pluginInstalledView(response: PluginInstalledResponse): MobilePluginInstalledResult {
  return {
    marketplaces: mobileJsonArray(response.marketplaces),
    marketplaceLoadErrors: mobileJsonArray(response.marketplaceLoadErrors)
  };
}

function mcpToolCallView(response: McpServerToolCallResponse): MobileMcpToolCallResult {
  return {
    content: mobileJsonArray(response.content),
    structuredContent: response.structuredContent === undefined ? undefined : mobileJson(response.structuredContent),
    isError: Boolean(response.isError),
    meta: response._meta === undefined ? undefined : mobileJson(response._meta)
  };
}

function elicitationResultView(
  response: ThreadIncrementElicitationResponse | ThreadDecrementElicitationResponse
): MobileThreadElicitationResult {
  return {
    count: Number(response.count),
    paused: response.paused
  };
}

function configEditParams(edit: MobileConfigEditInput): ConfigEdit {
  return {
    keyPath: edit.keyPath,
    value: edit.value,
    mergeStrategy: "replace"
  };
}

function normalizeReasoningEffort(value: unknown): string | null {
  if (typeof value === "string") {
    return value;
  }

  if (value && typeof value === "object" && "reasoningEffort" in value) {
    const effort = (value as { reasoningEffort?: unknown }).reasoningEffort;
    return typeof effort === "string" ? effort : null;
  }

  return null;
}

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

function timestampSeconds(value: string | null): number {
  if (!value) {
    return 0;
  }

  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? Math.floor(timestamp / 1000) : 0;
}

function stringifyJson(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function extractToolResultText(value: unknown): string {
  if (!value) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "object" && value !== null) {
    const record = value as Record<string, unknown>;
    if (Array.isArray(record.content)) {
      return record.content
        .map((item) => {
          if (typeof item === "object" && item !== null && "text" in item) {
            return String((item as { text?: unknown }).text ?? "");
          }
          return stringifyJson(item);
        })
        .filter(Boolean)
        .join("\n");
    }
  }

  return stringifyJson(value);
}

function textFromFragments(fragments: Array<{ text?: unknown }>): string {
  return fragments
    .map((fragment) => (typeof fragment.text === "string" ? fragment.text : stringifyJson(fragment)))
    .filter(Boolean)
    .join("\n");
}

function toolStatus(status: unknown, failed = false): "running" | "success" | "failed" {
  const normalized = typeof status === "string" ? status.toLowerCase() : "";
  if (failed || normalized.includes("fail") || normalized.includes("error")) {
    return "failed";
  }
  if (normalized.includes("running") || normalized.includes("inprogress") || normalized.includes("pending")) {
    return "running";
  }
  return "success";
}

function diffStats(diff: string): { added: number; removed: number } {
  let added = 0;
  let removed = 0;

  for (const line of diff.split("\n")) {
    if (line.startsWith("+++") || line.startsWith("---")) {
      continue;
    }
    if (line.startsWith("+")) {
      added += 1;
    } else if (line.startsWith("-")) {
      removed += 1;
    }
  }

  return { added, removed };
}

function userMessageView(item: Extract<ThreadItem, { type: "userMessage" }>): MobileTimelineItem {
  const imagePaths: string[] = [];
  const skillReferences: MobileSkillReference[] = [];
  const text = item.content
    .map((content) => {
      if (content.type === "text") {
        return content.text;
      }

      if (content.type === "localImage") {
        imagePaths.push(content.path);
        return "";
      }

      if (content.type === "image") {
        imagePaths.push(content.url);
        return "";
      }

      if (content.type === "skill") {
        skillReferences.push({ name: content.name, path: content.path });
        return "";
      }

      return `[${content.type}]`;
    })
    .filter((part) => part.trim().length > 0)
    .join("\n");

  return {
    id: item.id,
    ...(item.clientId ? { clientUserMessageId: item.clientId } : {}),
    role: "user",
    text,
    ...(imagePaths.length ? { imagePaths } : {}),
    ...(skillReferences.length ? { skillReferences } : {})
  };
}

export function timelineItem(item: ThreadItem): MobileTimelineItem | null {
  if (item.type === "userMessage") {
    return userMessageView(item);
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

  if (item.type === "hookPrompt") {
    return {
      id: item.id,
      role: "system",
      text: textFromFragments(item.fragments) || "Hook prompt",
      toolKind: "system"
    };
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
      text: item.aggregatedOutput ? `${item.command}\n${item.aggregatedOutput}` : item.command,
      toolKind: "command",
      actionKind: commandActionKind(item.commandActions),
      server: item.cwd,
      tool: item.command,
      status: toolStatus(item.status, item.exitCode !== null && item.exitCode !== 0)
    };
  }

  if (item.type === "mcpToolCall") {
    return {
      id: item.id,
      role: "tool",
      text: item.error ? stringifyJson(item.error) : extractToolResultText(item.result),
      toolKind: "mcp",
      server: item.server,
      tool: item.tool,
      arguments: stringifyJson(item.arguments),
      status: toolStatus(item.status, Boolean(item.error))
    };
  }

  if (item.type === "dynamicToolCall") {
    return {
      id: item.id,
      role: "tool",
      text: extractToolResultText(item.contentItems),
      toolKind: "dynamic",
      server: item.namespace ?? "dynamic",
      tool: item.tool,
      arguments: stringifyJson(item.arguments),
      status: toolStatus(item.status, item.success === false)
    };
  }

  if (item.type === "collabAgentToolCall") {
    return {
      id: item.id,
      role: "tool",
      text: stringifyJson({
        prompt: item.prompt,
        model: item.model,
        reasoningEffort: item.reasoningEffort,
        receiverThreadIds: item.receiverThreadIds,
        agentsStates: item.agentsStates
      }),
      toolKind: "dynamic",
      server: "collab",
      tool: item.tool,
      status: toolStatus(item.status)
    };
  }

  if (item.type === "subAgentActivity") {
    return {
      id: item.id,
      role: "tool",
      text: stringifyJson({
        agentThreadId: item.agentThreadId,
        agentPath: item.agentPath,
        kind: item.kind
      }),
      toolKind: "dynamic",
      server: "sub-agent",
      tool: item.kind,
      status: item.kind === "interrupted" ? "failed" : item.kind === "started" ? "running" : "success"
    };
  }

  if (item.type === "fileChange") {
    const diffs = item.changes.map((change) => change.diff).filter(Boolean);
    const diff = diffs.join("\n");
    const stats = diffStats(diff);
    return {
      id: item.id,
      role: "tool",
      text: diff || stringifyJson(item.changes),
      toolKind: "file",
      server: "file",
      tool: item.changes.length === 1 ? item.changes[0]?.path : "工作区变更",
      diffPath: item.changes.length === 1 ? item.changes[0]?.path : "工作区变更",
      added: stats.added,
      removed: stats.removed,
      status: toolStatus(item.status)
    };
  }

  if (item.type === "webSearch") {
    return {
      id: item.id,
      role: "tool",
      text: item.action ? stringifyJson(item.action) : "",
      toolKind: "web",
      server: "web",
      tool: item.query,
      status: "success"
    };
  }

  if (item.type === "imageView") {
    return {
      id: item.id,
      role: "tool",
      text: item.path,
      imagePaths: [item.path],
      toolKind: "image",
      server: "image",
      tool: "view",
      status: "success"
    };
  }

  if (item.type === "imageGeneration") {
    const path = item.savedPath ?? null;
    return {
      id: item.id,
      role: "tool",
      text: item.revisedPrompt ?? "",
      ...(path ? { imagePaths: [path] } : {}),
      toolKind: "image",
      server: "image",
      tool: "generation",
      status: toolStatus(item.status)
    };
  }

  if (item.type === "contextCompaction") {
    return {
      id: item.id,
      role: "system",
      text: "压缩上下文已完成",
      toolKind: "system",
      systemKind: "context-compaction",
      status: "success"
    };
  }

  if (item.type === "sleep") {
    return {
      id: item.id,
      role: "system",
      text: `等待 ${item.durationMs}ms`,
      toolKind: "system"
    };
  }

  const record = item as unknown as { id?: unknown; type?: unknown };
  const type = typeof record.type === "string" ? record.type : "item";
  return {
    id: typeof record.id === "string" ? record.id : `unknown-${type}`,
    role: "tool",
    text: stringifyJson(item),
    toolKind: "dynamic",
    server: "raw",
    tool: type,
    status: "success"
  };
}

function threadItemTimelineMeta(item: ThreadItem): Pick<MobileTimelineItem, "turnId" | "createdAt"> {
  const raw = item as ThreadItem & { turnId?: unknown; createdAt?: unknown; createdAtMs?: unknown };
  const turnId = typeof raw.turnId === "string" ? raw.turnId : undefined;
  const createdAt = typeof raw.createdAtMs === "number"
    ? raw.createdAtMs
    : typeof raw.createdAt === "number"
      ? raw.createdAt
      : undefined;
  return {
    ...(turnId ? { turnId } : {}),
    ...(typeof createdAt === "number" ? { createdAt } : {})
  };
}

function commandActionKind(actions: Array<{ type: string }> | null | undefined): "read" | "list" | "search" | "command" {
  if (!actions?.length) {
    return "command";
  }
  if (actions.some((action) => action.type === "search")) {
    return "search";
  }
  if (actions.some((action) => action.type === "read")) {
    return "read";
  }
  if (actions.some((action) => action.type === "listFiles")) {
    return "list";
  }
  return "command";
}

function turnErrorTimelineItem(turnId: string, turnIndex: number | undefined, error: TurnError): MobileTimelineItem {
  const details = error.additionalDetails?.trim() ? `：${error.additionalDetails}` : "";
  return {
    id: `${turnId}-error`,
    turnId,
    ...(typeof turnIndex === "number" ? { turnIndex } : {}),
    role: "error",
    text: `${error.message}${details}`
  };
}

function timelineItemsForTurn(turn: Thread["turns"][number], turnIndex?: number): MobileTimelineItem[] {
  const items = turn.items.flatMap((item) => {
    const mapped = timelineItem(item);
    return mapped
      ? [
          {
            ...mapped,
            turnId: turn.id,
            ...(typeof turnIndex === "number" ? { turnIndex } : {})
          }
        ]
      : [];
  });
  return turn.error ? [...items, turnErrorTimelineItem(turn.id, turnIndex, turn.error)] : items;
}

function threadDetail(
  thread: Thread,
  extras: Partial<Pick<MobileThreadDetail, "model" | "reasoningEffort" | "nextCursor" | "activePermissionProfile" | "approvalsReviewer">> = {}
): MobileThreadDetail {
  const timeline = thread.turns.flatMap((turn, turnIndex) => timelineItemsForTurn(turn, turnIndex));

  return {
    ...threadSummary(thread),
    lastTurnId: thread.turns.at(-1)?.id || null,
    nextCursor: extras.nextCursor ?? null,
    timeline,
    ...extras
  };
}

function isUnmaterializedThreadTimelinePageError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    /not materialized yet|not loaded/i.test(message) &&
    /(?:before|until) (?:the )?first user message/i.test(message)
  );
}

function isUnsupportedThreadItemsListError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /thread\/items\/list/i.test(message) && (/not supported/i.test(message) || /unknown variant/i.test(message));
}

function threadWithRecentTurns(thread: Thread, turns: Thread["turns"]): Thread {
  return { ...thread, turns };
}

function chronologicalTurnsFromDescPage(turns: Thread["turns"]): Thread["turns"] {
  return [...turns].reverse();
}

function conversationSummaryView(response: GetConversationSummaryResponse): MobileThreadSummary {
  const summary = response.summary;
  return {
    id: summary.conversationId,
    title: summary.preview || "未命名会话",
    preview: summary.preview,
    cwd: summary.cwd,
    modelProvider: summary.modelProvider,
    status: "summary",
    updatedAt: timestampSeconds(summary.updatedAt || summary.timestamp)
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

function authStatusView(response: GetAuthStatusResponse): MobileAuthStatusView {
  return {
    authMethod: response.authMethod,
    hasAuthToken: Boolean(response.authToken),
    requiresOpenaiAuth: response.requiresOpenaiAuth
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
    resetsAt: primary.resetsAt,
    resetCreditsAvailable: response.rateLimitResetCredits
      ? Number(response.rateLimitResetCredits.availableCount)
      : null
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

function normalizeCollaborationMode(
  mode: TurnStartParams["collaborationMode"]
): CollaborationMode | null | undefined {
  if (!mode) return mode;
  if ((mode as { mode?: unknown }).mode === "ask") {
    return { ...mode, mode: "plan" };
  }
  return mode;
}

function skillViews(response: SkillsListResponse): MobileSkillView[] {
  return response.data.flatMap((entry) =>
    entry.skills.map((skill) => ({
      cwd: entry.cwd,
      name: skill.name,
      path: skill.path,
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
        name: "codex-web-backend",
        title: "Codex Web 后端",
        version: "0.1.0"
      },
      capabilities: {
        experimentalApi: true,
        requestAttestation: false,
        optOutNotificationMethods: []
      }
    };

    const response = (await this.peer.request("initialize", params)) as InitializeResponse;
    await this.peer.notify?.("initialized");
    return response;
  }

  async listThreads(params: ThreadListParams = {}): Promise<MobileThreadPage> {
    const response = (await this.peer.request("thread/list", params)) as ThreadListResponse;

    return {
      threads: response.data.map(threadSummary),
      nextCursor: response.nextCursor ?? null
    };
  }

  async searchThreads(input: SearchThreadsInput): Promise<MobileThreadPage> {
    const params: ThreadSearchParams = {
      searchTerm: input.searchTerm,
      cursor: input.cursor,
      limit: input.limit,
      sortKey: "updated_at",
      sortDirection: "desc",
      archived: input.archived
    };
    const response = (await this.peer.request("thread/search", params)) as ThreadSearchResponse;

    return {
      threads: response.data.map((result) => ({
        ...threadSummary(result.thread),
        preview: result.snippet || result.thread.preview
      })),
      nextCursor: response.nextCursor ?? null
    };
  }

  async getConversationSummary(input: GetConversationSummaryInput): Promise<MobileThreadSummary> {
    const params: GetConversationSummaryParams =
      input.conversationId !== undefined ? { conversationId: input.conversationId } : { rolloutPath: input.rolloutPath };
    const response = (await this.peer.request("getConversationSummary", params)) as GetConversationSummaryResponse;
    return conversationSummaryView(response);
  }

  async getConversationRolloutPath(threadId: string): Promise<string | null> {
    const response = (await this.peer.request("getConversationSummary", {
      conversationId: threadId
    } satisfies GetConversationSummaryParams)) as GetConversationSummaryResponse;
    return response.summary.path || null;
  }

  async gitDiffToRemote(cwd: string): Promise<MobileGitDiffView> {
    const params: GitDiffToRemoteParams = { cwd };
    const response = (await this.peer.request("gitDiffToRemote", params)) as GitDiffToRemoteResponse;
    return {
      sha: response.sha,
      diff: response.diff
    };
  }

  async readThread(threadId: string): Promise<MobileThreadDetail> {
    const goalPromise = this.readThreadGoal(threadId);
    const response = (await this.peer.request("thread/read", {
        threadId,
        includeTurns: false
    })) as ThreadReadResponse;
    const initialPage = await this.readInitialThreadTurns(threadId);
    const goal = await goalPromise;

    return {
      ...threadDetail(threadWithRecentTurns(response.thread, initialPage.turns), {
        nextCursor: initialPage.nextCursor
      }),
      goal
    };
  }

  async readThreadMetadata(threadId: string): Promise<MobileThreadDetail> {
    const [response, goal] = await Promise.all([
      this.peer.request("thread/read", { threadId, includeTurns: false }) as Promise<ThreadReadResponse>,
      this.readThreadGoal(threadId)
    ]);
    return {
      ...threadDetail({ ...response.thread, turns: [] }, { nextCursor: null }),
      goal
    };
  }

  async readThreadSummary(threadId: string): Promise<MobileThreadSummary> {
    const response = (await this.peer.request("thread/read", {
      threadId,
      includeTurns: false
    })) as ThreadReadResponse;
    return threadSummary(response.thread);
  }

  async readLatestThreadTurnState(threadId: string): Promise<ThreadTurnExecutionState | null> {
    let response: ThreadTurnsListResponse;
    try {
      response = (await this.peer.request("thread/turns/list", {
        threadId,
        limit: 1,
        sortDirection: "desc",
        itemsView: "notLoaded"
      } satisfies ThreadTurnsListParams)) as ThreadTurnsListResponse;
    } catch (error) {
      if (isUnmaterializedThreadTimelinePageError(error)) {
        return null;
      }
      throw error;
    }
    const latestTurn = response.data[0];
    return latestTurn ? { turnId: latestTurn.id, status: latestTurn.status } : null;
  }

  private async readInitialThreadTurns(
    threadId: string
  ): Promise<{ turns: Thread["turns"]; nextCursor: string | null }> {
    try {
      const response = (await this.peer.request("thread/turns/list", {
        threadId,
        limit: 30,
        sortDirection: "desc",
        itemsView: "full"
      } satisfies ThreadTurnsListParams)) as ThreadTurnsListResponse;
      return { turns: chronologicalTurnsFromDescPage(response.data), nextCursor: response.nextCursor };
    } catch (error) {
      if (isUnmaterializedThreadTimelinePageError(error)) {
        return { turns: [], nextCursor: null };
      }
      throw error;
    }
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
      ? { ...response.thread, turns: chronologicalTurnsFromDescPage(response.initialTurnsPage.data) }
      : { ...response.thread, turns: [] };

    return {
      ...threadDetail(thread, {
        model: response.model,
        reasoningEffort: response.reasoningEffort,
        activePermissionProfile: response.activePermissionProfile,
        approvalsReviewer: response.approvalsReviewer,
        nextCursor: response.initialTurnsPage?.nextCursor ?? null
      }),
      goal
    };
  }

  async startThread(input: StartThreadInput): Promise<MobileThreadSummary> {
    const params: ThreadStartParams = {
      cwd: input.cwd,
      runtimeWorkspaceRoots: input.workspaceRoots,
      model: input.model,
      permissions: input.permissions,
      approvalsReviewer: input.approvalsReviewer
    };

    const response = (await this.peer.request("thread/start", params)) as ThreadStartResponse;
    return {
      ...threadSummary(response.thread),
      activePermissionProfile: response.activePermissionProfile,
      approvalsReviewer: response.approvalsReviewer
    };
  }

  async startTurn(input: StartTurnInput): Promise<{ turnId: string }> {
    const params: TurnStartParams = {
      threadId: input.threadId,
      clientUserMessageId: input.clientUserMessageId,
      input: createTurnUserInput(input.text, input.imagePaths, input.skillReferences),
      model: input.model,
      effort: input.reasoningEffort,
      summary: input.reasoningSummary,
      permissions: input.permissions,
      approvalsReviewer: input.approvalsReviewer,
      additionalContext: input.additionalContext,
      collaborationMode: normalizeCollaborationMode(input.collaborationMode)
    };

    const response = (await this.peer.request("turn/start", params)) as TurnStartResponse;
    return { turnId: response.turn.id };
  }

  async forkThread(threadId: string): Promise<MobileThreadDetail> {
    const params: ThreadForkParams = {
      threadId,
      excludeTurns: true
    };
    const response = (await this.peer.request("thread/fork", params)) as ThreadForkResponse;
    return threadDetail({ ...response.thread, turns: [] }, {
      model: response.model,
      reasoningEffort: response.reasoningEffort,
      activePermissionProfile: response.activePermissionProfile,
      approvalsReviewer: response.approvalsReviewer
    });
  }

  async rollbackThread(threadId: string, numTurns: number): Promise<MobileThreadDetail> {
    const params: ThreadRollbackParams = {
      threadId,
      numTurns
    };
    const response = (await this.peer.request("thread/rollback", params)) as ThreadRollbackResponse;
    const page = await this.readInitialThreadTurns(threadId);
    return threadDetail(threadWithRecentTurns(response.thread, page.turns), { nextCursor: page.nextCursor });
  }

  async setThreadName(threadId: string, name: string): Promise<void> {
    const params: ThreadSetNameParams = { threadId, name };
    await this.peer.request("thread/name/set", params);
  }

  async archiveThread(threadId: string): Promise<void> {
    const params: ThreadArchiveParams = { threadId };
    await this.peer.request("thread/archive", params);
  }

  async unarchiveThread(threadId: string): Promise<MobileThreadDetail> {
    const params: ThreadUnarchiveParams = { threadId };
    const response = (await this.peer.request("thread/unarchive", params)) as ThreadUnarchiveResponse;
    return threadDetail({ ...response.thread, turns: [] });
  }

  async unsubscribeThread(threadId: string): Promise<MobileThreadUnsubscribeResult> {
    const params: ThreadUnsubscribeParams = { threadId };
    const response = (await this.peer.request("thread/unsubscribe", params)) as ThreadUnsubscribeResponse;
    return { status: response.status };
  }

  async runThreadShellCommand(threadId: string, command: string): Promise<void> {
    const params: ThreadShellCommandParams = { threadId, command };
    await this.peer.request("thread/shellCommand", params);
  }

  async incrementThreadElicitation(threadId: string): Promise<MobileThreadElicitationResult> {
    const params: ThreadIncrementElicitationParams = { threadId };
    const response = (await this.peer.request(
      "thread/increment_elicitation",
      params
    )) as ThreadIncrementElicitationResponse;
    return elicitationResultView(response);
  }

  async decrementThreadElicitation(threadId: string): Promise<MobileThreadElicitationResult> {
    const params: ThreadDecrementElicitationParams = { threadId };
    const response = (await this.peer.request(
      "thread/decrement_elicitation",
      params
    )) as ThreadDecrementElicitationResponse;
    return elicitationResultView(response);
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
      permissions: input.permissions,
      approvalsReviewer: input.approvalsReviewer,
      collaborationMode: normalizeCollaborationMode(input.collaborationMode)
    };
    await this.peer.request("thread/settings/update", params);
  }

  async listCollaborationModes(): Promise<MobileCollaborationModeView[]> {
    const response = (await this.peer.request(
      "collaborationMode/list",
      {}
    )) as CollaborationModeListResponse;
    return collaborationModeViews(response);
  }

  async updateThreadMetadata(input: MobileThreadMetadataUpdateInput): Promise<MobileThreadDetail> {
    const params: ThreadMetadataUpdateParams = {
      threadId: input.threadId,
      gitInfo: input.gitInfo
    };
    const response = (await this.peer.request("thread/metadata/update", params)) as ThreadMetadataUpdateResponse;
    return threadDetail(response.thread);
  }

  async injectThreadItems(threadId: string, items: MobileJsonValue[]): Promise<void> {
    const params: ThreadInjectItemsParams = { threadId, items: items as JsonValue[] };
    await this.peer.request("thread/inject_items", params);
  }

  async approveGuardianDeniedAction(threadId: string, event: MobileJsonValue): Promise<void> {
    const params: ThreadApproveGuardianDeniedActionParams = { threadId, event: event as JsonValue };
    await this.peer.request("thread/approveGuardianDeniedAction", params);
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

  async mockExperimentalMethod(value?: string | null): Promise<MobileMockExperimentalMethodResult> {
    const params: MockExperimentalMethodParams = { value: value ?? null };
    const response = (await this.peer.request("mock/experimentalMethod", params)) as MockExperimentalMethodResponse;
    return { echoed: response.echoed };
  }

  async addEnvironment(input: AddEnvironmentInput): Promise<MobileEnvironmentAddResult> {
    const params: EnvironmentAddParams = {
      environmentId: input.environmentId,
      execServerUrl: input.execServerUrl
    };
    await this.peer.request("environment/add", params);
    return { added: true };
  }

  async detectExternalAgentConfig(
    input: DetectExternalAgentConfigInput = {}
  ): Promise<MobileExternalAgentConfigDetectResult> {
    const params: ExternalAgentConfigDetectParams = {
      includeHome: input.includeHome,
      cwds: input.cwds
    };
    const response = (await this.peer.request("externalAgentConfig/detect", params)) as ExternalAgentConfigDetectResponse;
    return externalAgentConfigDetectView(response);
  }

  async importExternalAgentConfig(
    input: ImportExternalAgentConfigInput
  ): Promise<MobileExternalAgentConfigImportResult> {
    const params: ExternalAgentConfigImportParams = {
      migrationItems: input.migrationItems as ExternalAgentConfigImportParams["migrationItems"]
    };
    const response = (await this.peer.request("externalAgentConfig/import", params)) as ExternalAgentConfigImportResponse;
    return { importId: response.importId };
  }

  async uploadFeedback(input: UploadFeedbackInput): Promise<MobileFeedbackUploadResult> {
    const params: FeedbackUploadParams = {
      classification: input.classification,
      reason: input.reason ?? null,
      threadId: input.threadId ?? null,
      includeLogs: input.includeLogs,
      extraLogFiles: input.extraLogFiles ?? null,
      tags: input.tags ?? null
    };
    const response = (await this.peer.request("feedback/upload", params)) as FeedbackUploadResponse;
    return { threadId: response.threadId };
  }

  async addMarketplace(input: AddMarketplaceInput): Promise<MobileMarketplaceAddResult> {
    const params: MarketplaceAddParams = {
      source: input.source,
      refName: input.refName ?? null,
      sparsePaths: input.sparsePaths ?? null
    };
    const response = (await this.peer.request("marketplace/add", params)) as MarketplaceAddResponse;
    return {
      marketplaceName: response.marketplaceName,
      installedRoot: response.installedRoot,
      alreadyAdded: response.alreadyAdded
    };
  }

  async removeMarketplace(marketplaceName: string): Promise<MobileMarketplaceRemoveResult> {
    const params: MarketplaceRemoveParams = { marketplaceName };
    const response = (await this.peer.request("marketplace/remove", params)) as MarketplaceRemoveResponse;
    return {
      marketplaceName: response.marketplaceName,
      installedRoot: response.installedRoot
    };
  }

  async upgradeMarketplace(marketplaceName?: string | null): Promise<MobileMarketplaceUpgradeResult> {
    const params: MarketplaceUpgradeParams = { marketplaceName: marketplaceName ?? null };
    const response = (await this.peer.request("marketplace/upgrade", params)) as MarketplaceUpgradeResponse;
    return {
      selectedMarketplaces: response.selectedMarketplaces,
      upgradedRoots: response.upgradedRoots,
      errors: response.errors.map((error) => ({
        marketplaceName: error.marketplaceName,
        message: error.message
      }))
    };
  }

  async listInstalledPlugins(input: ListInstalledPluginsInput = {}): Promise<MobilePluginInstalledResult> {
    const params: PluginInstalledParams = {
      cwds: input.cwds ?? null,
      installSuggestionPluginNames: input.installSuggestionPluginNames ?? null
    };
    const response = (await this.peer.request("plugin/installed", params)) as PluginInstalledResponse;
    return pluginInstalledView(response);
  }

  async savePluginShare(input: SavePluginShareInput): Promise<MobilePluginShareSaveResult> {
    const params: PluginShareSaveParams = {
      pluginPath: input.pluginPath,
      remotePluginId: input.remotePluginId ?? null,
      discoverability: (input.discoverability ?? null) as PluginShareSaveParams["discoverability"],
      shareTargets: (input.shareTargets ?? null) as PluginShareSaveParams["shareTargets"]
    };
    const response = (await this.peer.request("plugin/share/save", params)) as PluginShareSaveResponse;
    return {
      remotePluginId: response.remotePluginId,
      shareUrl: response.shareUrl
    };
  }

  async updatePluginShareTargets(
    input: UpdatePluginShareTargetsInput
  ): Promise<MobilePluginShareUpdateTargetsResult> {
    const params: PluginShareUpdateTargetsParams = {
      remotePluginId: input.remotePluginId,
      discoverability: input.discoverability as PluginShareUpdateTargetsParams["discoverability"],
      shareTargets: input.shareTargets as PluginShareUpdateTargetsParams["shareTargets"]
    };
    const response = (await this.peer.request(
      "plugin/share/updateTargets",
      params
    )) as PluginShareUpdateTargetsResponse;
    return {
      principals: mobileJsonArray(response.principals),
      discoverability: response.discoverability
    };
  }

  async listPluginShares(): Promise<MobilePluginShareListResult> {
    const params: PluginShareListParams = {};
    const response = (await this.peer.request("plugin/share/list", params)) as PluginShareListResponse;
    return { data: mobileJsonArray(response.data) };
  }

  async checkoutPluginShare(remotePluginId: string): Promise<MobilePluginShareCheckoutResult> {
    const params: PluginShareCheckoutParams = { remotePluginId };
    const response = (await this.peer.request("plugin/share/checkout", params)) as PluginShareCheckoutResponse;
    return {
      remotePluginId: response.remotePluginId,
      pluginId: response.pluginId,
      pluginName: response.pluginName,
      pluginPath: response.pluginPath,
      marketplaceName: response.marketplaceName,
      marketplacePath: response.marketplacePath,
      remoteVersion: response.remoteVersion
    };
  }

  async deletePluginShare(remotePluginId: string): Promise<MobilePluginShareDeleteResult> {
    const params: PluginShareDeleteParams = { remotePluginId };
    await this.peer.request("plugin/share/delete", params) as PluginShareDeleteResponse;
    return { deleted: true };
  }

  async callMcpTool(input: CallMcpToolInput): Promise<MobileMcpToolCallResult> {
    const params: McpServerToolCallParams = {
      threadId: input.threadId,
      server: input.server,
      tool: input.tool,
      arguments: input.arguments as JsonValue | undefined,
      _meta: input.meta as JsonValue | undefined
    };
    const response = (await this.peer.request("mcpServer/tool/call", params)) as McpServerToolCallResponse;
    return mcpToolCallView(response);
  }

  async startThreadRealtime(input: StartThreadRealtimeInput): Promise<MobileThreadRealtimeStatusResult> {
    const params: ThreadRealtimeStartParams = {
      threadId: input.threadId,
      codexResponsesAsItems: input.codexResponsesAsItems ?? null,
      codexResponseItemPrefix: input.codexResponseItemPrefix ?? null,
      model: input.model ?? null,
      outputModality: input.outputModality,
      includeStartupContext: input.includeStartupContext ?? null,
      prompt: input.prompt ?? null,
      realtimeSessionId: input.realtimeSessionId ?? null,
      transport: (input.transport ?? null) as ThreadRealtimeStartParams["transport"],
      version: input.version ?? null,
      voice: input.voice ?? null
    };
    await this.peer.request("thread/realtime/start", params) as ThreadRealtimeStartResponse;
    return { started: true };
  }

  async appendThreadRealtimeAudio(input: AppendThreadRealtimeAudioInput): Promise<MobileThreadRealtimeStatusResult> {
    const params: ThreadRealtimeAppendAudioParams = {
      threadId: input.threadId,
      audio: input.audio
    };
    await this.peer.request("thread/realtime/appendAudio", params) as ThreadRealtimeAppendAudioResponse;
    return { accepted: true };
  }

  async appendThreadRealtimeText(input: AppendThreadRealtimeTextInput): Promise<MobileThreadRealtimeStatusResult> {
    const params: ThreadRealtimeAppendTextParams = {
      threadId: input.threadId,
      text: input.text,
      role: input.role
    };
    await this.peer.request("thread/realtime/appendText", params) as ThreadRealtimeAppendTextResponse;
    return { accepted: true };
  }

  async appendThreadRealtimeSpeech(input: AppendThreadRealtimeSpeechInput): Promise<MobileThreadRealtimeStatusResult> {
    const params: ThreadRealtimeAppendSpeechParams = {
      threadId: input.threadId,
      text: input.text
    };
    await this.peer.request("thread/realtime/appendSpeech", params) as ThreadRealtimeAppendSpeechResponse;
    return { accepted: true };
  }

  async stopThreadRealtime(threadId: string): Promise<MobileThreadRealtimeStatusResult> {
    const params: ThreadRealtimeStopParams = { threadId };
    await this.peer.request("thread/realtime/stop", params) as ThreadRealtimeStopResponse;
    return { stopped: true };
  }

  async listThreadRealtimeVoices(): Promise<MobileThreadRealtimeVoicesResult> {
    const params: ThreadRealtimeListVoicesParams = {};
    const response = (await this.peer.request("thread/realtime/listVoices", params)) as ThreadRealtimeListVoicesResponse;
    return { voices: response.voices };
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

  async getAuthStatus(): Promise<MobileAuthStatusView> {
    const params: GetAuthStatusParams = { includeToken: false, refreshToken: false };
    const response = (await this.peer.request("getAuthStatus", params)) as GetAuthStatusResponse;
    return authStatusView(response);
  }

  async consumeRateLimitResetCredit(idempotencyKey: string): Promise<MobileRateLimitResetCreditConsumeResult> {
    const params: ConsumeAccountRateLimitResetCreditParams = { idempotencyKey };
    const response = (await this.peer.request(
      "account/rateLimitResetCredit/consume",
      params
    )) as ConsumeAccountRateLimitResetCreditResponse;
    return { outcome: response.outcome };
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
      nextCursor: response.nextCursor ?? null
    };
  }

  async getConfigRequirements(): Promise<MobileConfigRequirementsView | null> {
    const response = (await this.peer.request("configRequirements/read", undefined)) as ConfigRequirementsReadResponse;
    return configRequirementsView(response.requirements);
  }

  async readConfig(): Promise<ConfigReadResponse> {
    return (await this.peer.request("config/read", {})) as ConfigReadResponse;
  }

  async writeConfigValue(keyPath: string, value: MobileConfigEditInput["value"]): Promise<MobileConfigWriteResultView> {
    const params: ConfigValueWriteParams = {
      keyPath,
      value,
      mergeStrategy: "replace",
      filePath: null,
      expectedVersion: null
    };
    const response = (await this.peer.request("config/value/write", params)) as ConfigWriteResponse;
    return configWriteResultView(response);
  }

  async writeConfigBatch(edits: MobileConfigEditInput[]): Promise<MobileConfigWriteResultView> {
    const params: ConfigBatchWriteParams = {
      edits: edits.map(configEditParams),
      filePath: null,
      expectedVersion: null,
      reloadUserConfig: true
    };
    const response = (await this.peer.request("config/batchWrite", params)) as ConfigWriteResponse;
    return configWriteResultView(response);
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

  async listSkills(input: ListSkillsInput = {}): Promise<MobileSkillListView> {
    const params: SkillsListParams = {
      forceReload: input.forceReload ?? false
    };
    if (input.cwds?.length) {
      params.cwds = input.cwds;
    }
    const response = (await this.peer.request("skills/list", params)) as SkillsListResponse;
    const skills = skillViews(response);
    return {
      skills: input.enabledOnly ? skills.filter((skill) => skill.enabled) : skills,
      skillErrors: skillErrorViews(response)
    };
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
        supportedReasoningEfforts: model.supportedReasoningEfforts.flatMap((effort) => {
          const normalized = normalizeReasoningEffort(effort);
          return normalized ? [normalized] : [];
        }),
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

  async watchPath(watchId: string, targetPath: string): Promise<{ watchId: string; path: string }> {
    const params: FsWatchParams = { watchId, path: targetPath };
    const response = (await this.peer.request("fs/watch", params)) as FsWatchResponse;
    return { watchId, path: response.path };
  }

  async unwatchPath(watchId: string): Promise<void> {
    const params: FsUnwatchParams = { watchId };
    await this.peer.request("fs/unwatch", params);
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

  async startFileSearchSession(input: StartFileSearchSessionInput): Promise<void> {
    const params: FuzzyFileSearchSessionStartParams = {
      sessionId: input.sessionId,
      roots: input.roots
    };
    await this.peer.request("fuzzyFileSearch/sessionStart", params);
  }

  async updateFileSearchSession(sessionId: string, query: string): Promise<void> {
    const params: FuzzyFileSearchSessionUpdateParams = { sessionId, query };
    await this.peer.request("fuzzyFileSearch/sessionUpdate", params);
  }

  async stopFileSearchSession(sessionId: string): Promise<void> {
    const params: FuzzyFileSearchSessionStopParams = { sessionId };
    await this.peer.request("fuzzyFileSearch/sessionStop", params);
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

  async readModelDefaults(): Promise<MobileModelDefaultsView> {
    const response = (await this.peer.request("config/read", {})) as ConfigReadResponse;
    const config = response.config;
    return {
      model: settingsValue(config.model),
      modelProvider: settingsValue(config.model_provider),
      reasoningEffort: settingsValue(config.model_reasoning_effort),
      reasoningSummary: settingsValue(config.model_reasoning_summary)
    };
  }

  async readSettings(): Promise<MobileSettingsView> {
    const [
      configResponse,
      remoteControlResponse,
      permissionProfileResponse,
      accountResponse,
      authStatusResponse,
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
      this.peer.request("getAuthStatus", { includeToken: false, refreshToken: false } satisfies GetAuthStatusParams),
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
      reasoningSummary: settingsValue(config.model_reasoning_summary),
      approvalPolicy: settingsValue(config.approval_policy),
      sandboxMode: settingsValue(config.sandbox_mode),
      loadedThreadIds: (loadedThreadsResponse as ThreadLoadedListResponse).data,
      experimentalFeatures: experimentalFeatureViews(experimentalFeaturesResponse as ExperimentalFeatureListResponse),
      remoteControlStatus: remoteControl.status,
      remoteControlServerName: remoteControl.serverName,
      remoteControlInstallationId: remoteControl.installationId,
      remoteControlEnvironmentId: remoteControl.environmentId,
      account: accountView(accountResponse as GetAccountResponse),
      authStatus: authStatusView(authStatusResponse as GetAuthStatusResponse),
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
    const legacyCursor = parseLegacyItemCursor(input.cursor);
    const params: ThreadItemsListParams = {
      threadId: input.threadId,
      cursor: legacyCursor ? undefined : input.cursor,
      limit: timelinePageLimit(input.limit),
      sortDirection: "desc"
    };
    let response: ThreadItemsListResponse;
    try {
      if (legacyCursor) {
        throw new Error("thread/items/list is not supported yet");
      }
      response = (await this.peer.request("thread/items/list", params)) as ThreadItemsListResponse;
    } catch (error) {
      if (isUnmaterializedThreadTimelinePageError(error)) {
        return { items: [], nextCursor: null };
      }
      if (!isUnsupportedThreadItemsListError(error)) {
        throw error;
      }
      const pageLimit = timelinePageLimit(input.limit);
      const chunks: MobileTimelineItem[][] = [];
      const seenTurnCursors = new Set<string>();
      let remaining = pageLimit;
      let turnCursor = legacyCursor ? legacyCursor.turnCursor : (input.cursor ?? null);
      let itemOffset = legacyCursor?.itemOffset ?? 0;
      let nextCursor: string | null = turnCursor;

      for (let requestCount = 0; requestCount < pageLimit && remaining > 0; requestCount += 1) {
        const cursorKey = turnCursor ?? "__latest__";
        if (seenTurnCursors.has(cursorKey)) {
          break;
        }
        seenTurnCursors.add(cursorKey);
        let legacyResponse: ThreadTurnsListResponse;
        try {
          legacyResponse = (await this.peer.request("thread/turns/list", {
            threadId: input.threadId,
            cursor: turnCursor,
            limit: LEGACY_THREAD_TURN_PAGE_LIMIT,
            sortDirection: "desc",
            itemsView: "full"
          } satisfies ThreadTurnsListParams)) as ThreadTurnsListResponse;
        } catch (error) {
          if (isUnmaterializedThreadTimelinePageError(error)) {
            return { items: [], nextCursor: null };
          }
          throw error;
        }
        const legacyItems = chronologicalTurnsFromDescPage(legacyResponse.data)
          .flatMap((turn) => timelineItemsForTurn(turn));
        const pageEnd = Math.max(0, legacyItems.length - itemOffset);
        const pageStart = Math.max(0, pageEnd - remaining);
        const selected = legacyItems.slice(pageStart, pageEnd);
        if (selected.length) {
          chunks.unshift(selected);
          remaining -= selected.length;
        }
        if (pageStart > 0) {
          nextCursor = legacyItemCursor(turnCursor, itemOffset + selected.length);
          break;
        }

        nextCursor = legacyResponse.nextCursor ?? null;
        if (remaining === 0 || !nextCursor) {
          break;
        }
        turnCursor = nextCursor;
        itemOffset = 0;
      }

      return {
        items: chunks.flat(),
        nextCursor
      };
    }

    return {
      items: response.data.flatMap((item) => {
        const mapped = timelineItem(item);
        return mapped ? [{ ...mapped, ...threadItemTimelineMeta(item) }] : [];
      }).reverse(),
      nextCursor: response.nextCursor ?? null
    };
  }

  async listThreadTurnItems(input: ListThreadTurnItemsInput): Promise<MobileTimelinePage> {
    const params: ThreadItemsListParams = {
      threadId: input.threadId,
      turnId: input.turnId,
      cursor: input.cursor,
      limit: timelinePageLimit(input.limit),
      sortDirection: "desc"
    };
    const response = (await this.peer.request("thread/items/list", params)) as ThreadItemsListResponse;

    return {
      items: response.data.flatMap((item) => {
        const mapped = timelineItem(item);
        return mapped ? [{ ...mapped, turnId: input.turnId }] : [];
      }),
      nextCursor: response.nextCursor
    };
  }
}
