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
};
