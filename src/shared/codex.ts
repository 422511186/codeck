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

export type MobileMcpServerView = {
  name: string;
  authStatus: string;
  toolCount: number;
  resourceCount: number;
  resourceTemplateCount: number;
};

export type MobileCollaborationModeView = {
  name: string;
  mode: string | null;
  model: string | null;
  reasoningEffort: string | null;
};

export type MobileTimelineItem = {
  id: string;
  role: "user" | "agent" | "reasoning" | "plan" | "tool";
  text: string;
};

export type MobileThreadDetail = MobileThreadSummary & {
  lastTurnId: string | null;
  timeline: MobileTimelineItem[];
  tokenUsageTotal?: number;
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

export type MobileCommandResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

export type MobileSettingsView = {
  model: string | null;
  modelProvider: string | null;
  reasoningEffort: string | null;
  approvalPolicy: string | null;
  sandboxMode: string | null;
  remoteControlStatus: string;
  account: MobileAccountView;
  rateLimit: MobileRateLimitView | null;
  providerCapabilities: MobileModelProviderCapabilitiesView;
  remoteControlClients: MobileRemoteControlClientView[];
  mcpServers: MobileMcpServerView[];
  collaborationModes: MobileCollaborationModeView[];
  permissionProfiles: MobilePermissionProfileOption[];
};
