export type ApiOk<T> = { ok: true } & T;
export type ApiErr = { ok: false; error?: string };
export type ApiResponse<T = unknown> = ApiOk<T> | ApiErr;

export type ThreadSummary = {
  id: string;
  title: string;
  preview: string;
  cwd: string;
  modelProvider: string;
  status: string;
  updatedAt: number;
};

export type ThreadPage = {
  threads: ThreadSummary[];
  nextCursor: string | null;
};

export type TimelineRole = "user" | "agent" | "reasoning" | "plan" | "tool";

export type TimelineItem = {
  id: string;
  role: TimelineRole;
  text: string;
};

export type ThreadDetail = ThreadSummary & {
  lastTurnId: string | null;
  timeline: TimelineItem[];
};

export type TimelinePage = {
  items: TimelineItem[];
  nextCursor: string | null;
};

export type ModelOption = {
  id: string;
  label: string;
  isDefault: boolean;
  supportedReasoningEfforts: string[];
  inputModalities: string[];
};

export type UploadedImage = {
  path: string;
  mimeType: string;
  size: number;
};

export type ServerRequestKind =
  | "command_approval"
  | "file_approval"
  | "permissions_approval"
  | "question"
  | "mcp_elicitation"
  | "dynamic_tool"
  | "unknown";

export type PendingServerRequest = {
  requestId: string;
  threadId?: string;
  kind: ServerRequestKind;
  request: Record<string, unknown>;
};

export type AppServerStatusState =
  | "disabled"
  | "idle"
  | "starting"
  | "connecting"
  | "ready"
  | "error";

export type AppServerStatus = {
  state: AppServerStatusState;
  message?: string;
};

export type ChatPermissions = "read-only" | "workspace-write" | "danger-full-access";

export type ChatMode = "plan" | "build";

export function permissionsForMode(mode: ChatMode): ChatPermissions {
  return mode === "plan" ? "read-only" : "workspace-write";
}
