export type AppServerStatusView = {
  state: "disabled" | "idle" | "starting" | "connecting" | "ready" | "error";
  message?: string;
};

export type MobileThreadSummary = {
  id: string;
  title: string;
  preview: string;
  cwd: string;
  modelProvider: string;
  status: string;
  updatedAt: number;
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

export type MobileAccountView = {
  type: "apiKey" | "chatgpt" | "amazonBedrock" | "none";
  email: string | null;
  planType: string | null;
  requiresOpenaiAuth: boolean;
};

export type MobileRateLimitView = {
  limitId: string | null;
  limitName: string | null;
  usedPercent: number | null;
  windowDurationMins: number | null;
  resetsAt: number | null;
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

export type MobileSkillView = {
  cwd: string;
  name: string;
  description: string;
  shortDescription: string | null;
  scope: string;
  enabled: boolean;
};

export type MobileSkillErrorView = {
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

export type MobileTimelineItem = {
  id: string;
  role: "user" | "agent" | "reasoning" | "plan" | "tool";
  text: string;
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
  timeline: MobileTimelineItem[];
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

export type MobileCommandResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

export type MobileTerminalSession = {
  processHandle: string;
  cwd: string;
  command: string[];
  output: string;
  exitCode: number | null;
  running: boolean;
};

export type MobileSettingsView = {
  model: string | null;
  modelProvider: string | null;
  reasoningEffort: string | null;
  approvalPolicy: string | null;
  sandboxMode: string | null;
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
  plugins: MobilePluginView[];
  pluginMarketplaceErrors: MobilePluginMarketplaceErrorView[];
};
