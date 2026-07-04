export type AppServerStatusView = {
  state: "disabled" | "idle" | "starting" | "connecting" | "ready" | "error";
  message?: string;
  mode?: "spawn" | "spawn-or-connect" | "external" | "mock" | "off";
  managedByCurrentProcess?: boolean;
  reusedExisting?: boolean;
  pidKnown?: boolean;
  errorKind?: "timeout" | "unavailable" | "handshake-failed" | "startup-failed" | "lock-timeout" | "stale-lock";
  cleanupState?: "none" | "child-terminated" | "metadata-cleared" | "stale-lock-cleared";
};

export type MobileThreadSummary = {
  id: string;
  title: string;
  preview: string;
  cwd: string;
  modelProvider: string;
  status: string;
  updatedAt: number;
  activePermissionProfile?: MobileActivePermissionProfile | null;
  approvalsReviewer?: MobileApprovalsReviewer | null;
};

export type MobileThreadPage = {
  threads: MobileThreadSummary[];
  nextCursor: string | null;
};

export type MobileModelOption = {
  id: string;
  label: string;
  isDefault: boolean;
  supportedReasoningEfforts: string[];
  inputModalities: string[];
};

export type MobilePermissionProfileOption = {
  id: string;
  label: string;
  description: string | null;
};

export type MobileActivePermissionProfile = {
  id: string;
  extends: string | null;
};

export type MobileApprovalsReviewer = "user" | "auto_review" | "guardian_subagent";

export type MobilePermissionPayload = {
  activePermissionProfile?: MobileActivePermissionProfile | null;
  approvalsReviewer?: MobileApprovalsReviewer | null;
};

export type MobileAccountView = {
  type: "apiKey" | "chatgpt" | "amazonBedrock" | "none";
  email: string | null;
  planType: string | null;
  requiresOpenaiAuth: boolean;
};

export type MobileAccountLoginView =
  | { type: "apiKey" }
  | { type: "chatgpt"; loginId: string; authUrl: string }
  | { type: "chatgptDeviceCode"; loginId: string; verificationUrl: string; userCode: string }
  | { type: "chatgptAuthTokens" };

export type MobileAccountLoginCancelView = {
  status: "canceled" | "notFound";
};

export type MobileAccountTokenUsageView = {
  summary: {
    lifetimeTokens: number | null;
    peakDailyTokens: number | null;
    longestRunningTurnSec: number | null;
    currentStreakDays: number | null;
    longestStreakDays: number | null;
  };
  dailyUsageBuckets: Array<{
    startDate: string;
    tokens: number;
  }> | null;
};

export type MobileAuthStatusView = {
  authMethod: string | null;
  hasAuthToken: boolean;
  requiresOpenaiAuth: boolean | null;
};

export type MobileAddCreditsNudgeResultView = {
  status: "sent" | "cooldown_active";
};

export type MobileRateLimitResetCreditConsumeResult = {
  outcome: "reset" | "nothingToReset" | "noCredit" | "alreadyRedeemed";
};

export type MobileJsonValue =
  | number
  | string
  | boolean
  | MobileJsonValue[]
  | { [key: string]: MobileJsonValue | undefined }
  | null;

export type MobileEnvironmentAddInput = {
  environmentId: string;
  execServerUrl: string;
};

export type MobileEnvironmentAddResult = {
  added: boolean;
};

export type MobileExternalAgentConfigMigrationItem = {
  itemType: string;
  description: string;
  cwd: string | null;
  details: MobileJsonValue | null;
};

export type MobileExternalAgentConfigDetectInput = {
  includeHome?: boolean;
  cwds?: string[] | null;
};

export type MobileExternalAgentConfigDetectResult = {
  items: MobileExternalAgentConfigMigrationItem[];
};

export type MobileExternalAgentConfigImportInput = {
  migrationItems: MobileExternalAgentConfigMigrationItem[];
};

export type MobileExternalAgentConfigImportResult = {
  importId: string;
};

export type MobileExternalAgentConfigImportTypeResult = {
  itemType: string;
  successes: Array<{
    itemType: string;
    cwd: string | null;
    source: string | null;
    target: string | null;
  }>;
  failures: Array<{
    itemType: string;
    failureStage: string;
    message: string;
    cwd: string | null;
    source: string | null;
  }>;
};

export type MobileFeedbackUploadInput = {
  classification: string;
  reason?: string | null;
  threadId?: string | null;
  includeLogs?: boolean;
  extraLogFiles?: string[] | null;
  tags?: Record<string, string> | null;
};

export type MobileFeedbackUploadResult = {
  threadId: string;
};

export type MobileMarketplaceAddInput = {
  source: string;
  refName?: string | null;
  sparsePaths?: string[] | null;
};

export type MobileMarketplaceAddResult = {
  marketplaceName: string;
  installedRoot: string;
  alreadyAdded: boolean;
};

export type MobileMarketplaceRemoveResult = {
  marketplaceName: string;
  installedRoot: string | null;
};

export type MobileMarketplaceUpgradeResult = {
  selectedMarketplaces: string[];
  upgradedRoots: string[];
  errors: Array<{
    marketplaceName: string;
    message: string;
  }>;
};

export type MobilePluginInstalledInput = {
  cwds?: string[] | null;
  installSuggestionPluginNames?: string[] | null;
};

export type MobilePluginInstalledResult = {
  marketplaces: MobileJsonValue[];
  marketplaceLoadErrors: MobileJsonValue[];
};

export type MobilePluginShareTarget = {
  principalType: string;
  principalId: string;
  role: string;
};

export type MobilePluginShareSaveInput = {
  pluginPath: string;
  remotePluginId?: string | null;
  discoverability?: string | null;
  shareTargets?: MobilePluginShareTarget[] | null;
};

export type MobilePluginShareSaveResult = {
  remotePluginId: string;
  shareUrl: string;
};

export type MobilePluginShareUpdateTargetsInput = {
  remotePluginId: string;
  discoverability: string;
  shareTargets: MobilePluginShareTarget[];
};

export type MobilePluginShareUpdateTargetsResult = {
  principals: MobileJsonValue[];
  discoverability: string;
};

export type MobilePluginShareListResult = {
  data: MobileJsonValue[];
};

export type MobilePluginShareCheckoutResult = {
  remotePluginId: string;
  pluginId: string;
  pluginName: string;
  pluginPath: string;
  marketplaceName: string;
  marketplacePath: string;
  remoteVersion: string | null;
};

export type MobilePluginShareDeleteResult = {
  deleted: boolean;
};

export type MobileMcpToolCallInput = {
  threadId: string;
  server: string;
  tool: string;
  arguments?: MobileJsonValue;
  meta?: MobileJsonValue;
};

export type MobileMcpToolCallResult = {
  content: MobileJsonValue[];
  structuredContent?: MobileJsonValue;
  isError: boolean;
  meta?: MobileJsonValue;
};

export type MobileRealtimeOutputModality = "text" | "audio";
export type MobileRealtimeVoice =
  | "alloy"
  | "arbor"
  | "ash"
  | "ballad"
  | "breeze"
  | "cedar"
  | "coral"
  | "cove"
  | "echo"
  | "ember"
  | "juniper"
  | "maple"
  | "marin"
  | "sage"
  | "shimmer"
  | "sol"
  | "spruce"
  | "vale"
  | "verse";
export type MobileRealtimeConversationVersion = "v1" | "v2";
export type MobileRealtimeConversationArchitecture = "realtimeapi" | "avas";
export type MobileConversationTextRole = "user" | "developer";

export type MobileThreadRealtimeAudioChunk = {
  data: string;
  sampleRate: number;
  numChannels: number;
  samplesPerChannel: number | null;
  itemId: string | null;
};

export type MobileThreadRealtimeStartInput = {
  threadId: string;
  outputModality: MobileRealtimeOutputModality;
  architecture?: MobileRealtimeConversationArchitecture | null;
  codexResponsesAsItems?: boolean | null;
  codexResponseItemPrefix?: string | null;
  model?: string | null;
  includeStartupContext?: boolean | null;
  prompt?: string | null;
  realtimeSessionId?: string | null;
  transport?: MobileJsonValue | null;
  version?: MobileRealtimeConversationVersion | null;
  voice?: MobileRealtimeVoice | null;
};

export type MobileThreadRealtimeStatusResult = {
  started?: boolean;
  stopped?: boolean;
  accepted?: boolean;
};

export type MobileThreadRealtimeAppendAudioInput = {
  threadId: string;
  audio: MobileThreadRealtimeAudioChunk;
};

export type MobileThreadRealtimeAppendTextInput = {
  threadId: string;
  text: string;
  role: MobileConversationTextRole;
};

export type MobileThreadRealtimeAppendSpeechInput = {
  threadId: string;
  text: string;
};

export type MobileThreadRealtimeVoicesResult = {
  voices: {
    v1: MobileRealtimeVoice[];
    v2: MobileRealtimeVoice[];
    defaultV1: MobileRealtimeVoice;
    defaultV2: MobileRealtimeVoice;
  };
};

export type MobileThreadMetadataUpdateInput = {
  threadId: string;
  gitInfo?: {
    sha?: string | null;
    branch?: string | null;
    originUrl?: string | null;
  } | null;
};

export type MobileMockExperimentalMethodResult = {
  echoed: string | null;
};

export type MobileRateLimitView = {
  limitId: string | null;
  limitName: string | null;
  usedPercent: number | null;
  windowDurationMins: number | null;
  resetsAt: number | null;
  resetCreditsAvailable: number | null;
};

export type MobileModelProviderCapabilitiesView = {
  namespaceTools: boolean;
  imageGeneration: boolean;
  webSearch: boolean;
};

export type MobileRemoteControlClientView = {
  clientId: string;
  displayName: string | null;
  deviceType: string | null;
  platform: string | null;
  lastSeenAt: number | null;
};

export type MobileRemoteControlStatusView = {
  status: string;
  serverName: string;
  installationId: string;
  environmentId: string | null;
};

export type MobileRemoteControlPairingView = {
  pairingCode: string;
  manualPairingCode: string | null;
  environmentId: string;
  expiresAt: number;
};

export type MobileRemoteControlPairingStatusView = {
  claimed: boolean;
};

export type MobileMcpServerView = {
  name: string;
  authStatus: string;
  toolCount: number;
  resourceCount: number;
  resourceTemplateCount: number;
  resources: MobileMcpResourceView[];
};

export type MobileMcpResourceView = {
  uri: string;
  name: string;
  mimeType: string | null;
};

export type MobileMcpLoginView = {
  authorizationUrl: string;
};

export type MobileMcpResourceContentView = {
  uri: string;
  mimeType: string | null;
  text?: string;
  blob?: string;
};

export type MobileMcpResourceReadView = {
  contents: MobileMcpResourceContentView[];
};

export type MobileCollaborationModeView = {
  name: string;
  mode: string | null;
  model: string | null;
  reasoningEffort: string | null;
};

export type MobileModelDefaultsView = {
  model: string | null;
  modelProvider: string | null;
  reasoningEffort: string | null;
  reasoningSummary: string | null;
};

export type MobileSkillView = {
  cwd: string;
  name: string;
  path: string;
  description: string;
  shortDescription: string | null;
  scope: string;
  enabled: boolean;
};

export type MobileSkillReference = {
  name: string;
  path: string;
};

export type MobileSkillErrorView = {
  cwd: string;
  path: string;
  message: string;
};

export type MobileSkillListView = {
  skills: MobileSkillView[];
  skillErrors: MobileSkillErrorView[];
};

export type MobileHookView = {
  cwd: string;
  key: string;
  eventName: string;
  handlerType: string;
  matcher: string | null;
  command: string | null;
  source: string;
  sourcePath: string;
  pluginId: string | null;
  enabled: boolean;
  trustStatus: string;
  statusMessage: string | null;
};

export type MobileHookNoticeView = {
  cwd: string;
  message: string;
};

export type MobileHookErrorView = {
  cwd: string;
  path: string;
  message: string;
};

export type MobilePluginView = {
  marketplaceName: string;
  marketplacePath: string | null;
  marketplaceDisplayName: string | null;
  id: string;
  name: string;
  displayName: string | null;
  shortDescription: string | null;
  installed: boolean;
  enabled: boolean;
  availability: string;
  sourceType: string;
};

export type MobilePluginMarketplaceErrorView = {
  marketplacePath: string;
  message: string;
};

export type MobilePluginDetailView = {
  marketplaceName: string;
  marketplacePath: string | null;
  id: string;
  remotePluginId: string | null;
  name: string;
  displayName: string | null;
  description: string | null;
  installed: boolean;
  enabled: boolean;
  authPolicy: string;
  installPolicy: string;
  availability: string;
  skillCount: number;
  skills: Array<{
    name: string;
    description: string;
    enabled: boolean;
  }>;
  hookCount: number;
  appCount: number;
  mcpServers: string[];
};

export type MobilePluginSkillContentView = {
  contents: string | null;
};

export type MobileSkillConfigWriteResultView = {
  effectiveEnabled: boolean;
};

export type MobilePluginInstallResultView = {
  authPolicy: string;
  appsNeedingAuth: Array<{
    id: string;
    name: string;
    description: string | null;
    installUrl: string | null;
    category: string | null;
  }>;
};

export type MobileAppView = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  developer: string | null;
  installUrl: string | null;
  isAccessible: boolean;
  isEnabled: boolean;
  pluginDisplayNames: string[];
};

export type MobileAppPage = {
  apps: MobileAppView[];
  nextCursor: string | null;
};

export type MobileConfigRequirementsView = {
  allowedApprovalPolicies: string[] | null;
  allowedSandboxModes: string[] | null;
  allowedWindowsSandboxImplementations: string[] | null;
  allowedPermissionProfiles: Record<string, boolean> | null;
  defaultPermissions: string | null;
  allowManagedHooksOnly: boolean | null;
  allowAppshots: boolean | null;
  allowRemoteControl: boolean | null;
  featureRequirements: Record<string, boolean> | null;
};

export type MobileConfigEditInput = {
  keyPath: string;
  value: string | number | boolean | null | Array<string | number | boolean | null>;
};

export type MobileConfigWriteResultView = {
  status: string;
  version: string;
  filePath: string;
};

export type MobileWindowsSandboxReadinessView = {
  status: "ready" | "notConfigured" | "updateRequired";
};

export type MobileWindowsSandboxSetupResultView = {
  started: boolean;
};

export type MobileExperimentalFeatureView = {
  name: string;
  stage: string;
  displayName: string | null;
  description: string | null;
  announcement: string | null;
  enabled: boolean;
  defaultEnabled: boolean;
};

export type MobileTimelineItem = {
  id: string;
  turnId?: string;
  turnIndex?: number;
  clientUserMessageId?: string;
  generation?: number;
  snapshotSequence?: number;
  role: "user" | "agent" | "reasoning" | "plan" | "tool" | "diff" | "system" | "error";
  text: string;
  done?: boolean;
  imagePaths?: string[];
  skillReferences?: MobileSkillReference[];
  toolKind?: "command" | "mcp" | "dynamic" | "file" | "web" | "image" | "system";
  actionKind?: "read" | "list" | "search" | "command";
  server?: string;
  tool?: string;
  arguments?: string;
  status?: "running" | "success" | "failed";
  diffPath?: string;
  added?: number;
  removed?: number;
};

export type MobileThreadGoalView = {
  threadId: string;
  objective: string;
  status: string;
  tokenBudget: number | null;
  tokensUsed: number;
  timeUsedSeconds: number;
  createdAt: number;
  updatedAt: number;
};

export type MobileThreadDetail = MobileThreadSummary & {
  lastTurnId: string | null;
  nextCursor: string | null;
  generation?: number;
  snapshotSequence?: number;
  timeline: MobileTimelineItem[];
  model?: string | null;
  reasoningEffort?: string | null;
  activePermissionProfile?: MobileActivePermissionProfile | null;
  approvalsReviewer?: MobileApprovalsReviewer | null;
  tokenUsageTotal?: number;
  goal?: MobileThreadGoalView | null;
};

export type MobileTimelinePage = {
  items: MobileTimelineItem[];
  nextCursor: string | null;
};

export type MobileFileEntry = {
  name: string;
  path: string;
  isDirectory: boolean;
  isFile: boolean;
};

export type MobileFileContent = {
  path: string;
  text: string;
};

export type MobileFileMetadata = {
  isDirectory: boolean;
  isFile: boolean;
  isSymlink: boolean;
  createdAtMs: number;
  modifiedAtMs: number;
};

export type MobileFileSearchResult = {
  root: string;
  path: string;
  fullPath: string;
  fileName: string;
  matchType: "file" | "directory";
  score: number;
  indices: number[] | null;
};

export type MobileFileSearchSessionView = {
  sessionId: string;
};

export type MobileCommandResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

export type MobileGitDiffView = {
  sha: string;
  diff: string;
};

export type MobileTerminalSession = {
  processHandle: string;
  cwd: string;
  command: string[];
  output: string;
  exitCode: number | null;
  running: boolean;
};

export type MobileBackgroundTerminalView = {
  itemId: string;
  processId: string;
  command: string;
  cwd: string;
  osPid: number | null;
  cpuPercent: number | null;
  rssKb: number | null;
};

export type MobileBackgroundTerminalPage = {
  terminals: MobileBackgroundTerminalView[];
  nextCursor: string | null;
};

export type MobileBackgroundTerminalTerminateResult = {
  terminated: boolean;
};

export type MobileThreadUnsubscribeResult = {
  status: "notLoaded" | "notSubscribed" | "unsubscribed";
};

export type MobileThreadElicitationResult = {
  count: number;
  paused: boolean;
};

export type MobileSettingsView = {
  model: string | null;
  modelProvider: string | null;
  reasoningEffort: string | null;
  reasoningSummary: string | null;
  approvalPolicy: string | null;
  sandboxMode: string | null;
  loadedThreadIds: string[];
  experimentalFeatures: MobileExperimentalFeatureView[];
  authStatus: MobileAuthStatusView;
  remoteControlStatus: string;
  remoteControlServerName: string;
  remoteControlInstallationId: string;
  remoteControlEnvironmentId: string | null;
  account: MobileAccountView;
  rateLimit: MobileRateLimitView | null;
  providerCapabilities: MobileModelProviderCapabilitiesView;
  remoteControlClients: MobileRemoteControlClientView[];
  mcpServers: MobileMcpServerView[];
  collaborationModes: MobileCollaborationModeView[];
  permissionProfiles: MobilePermissionProfileOption[];
  skills: MobileSkillView[];
  skillErrors: MobileSkillErrorView[];
  hooks: MobileHookView[];
  hookWarnings: MobileHookNoticeView[];
  hookErrors: MobileHookErrorView[];
  plugins: MobilePluginView[];
  pluginMarketplaceErrors: MobilePluginMarketplaceErrorView[];
};
