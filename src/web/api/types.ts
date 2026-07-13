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
  generation?: number;
  snapshotSequence?: number;
  activePermissionProfile?: ActivePermissionProfile | null;
  approvalsReviewer?: ApprovalsReviewer | null;
};

export type ThreadPage = {
  threads: ThreadSummary[];
  nextCursor: string | null;
};

export type TimelineRole = "user" | "agent" | "reasoning" | "plan" | "tool" | "diff" | "system" | "error";

export type TimelineItem = {
  id: string;
  turnId?: string;
  turnIndex?: number;
  clientUserMessageId?: string;
  generation?: number;
  snapshotSequence?: number;
  role: TimelineRole;
  text: string;
  done?: boolean;
  imagePaths?: string[];
  skillReferences?: SkillReference[];
  toolKind?: "command" | "mcp" | "dynamic" | "file" | "web" | "image" | "system";
  actionKind?: "read" | "list" | "search" | "command";
  server?: string;
  tool?: string;
  arguments?: string;
  status?: "running" | "success" | "failed";
  diffPath?: string;
  added?: number;
  removed?: number;
  completeness?: TimelineCompleteness;
};

export type ThreadDetail = ThreadSummary & {
  lastTurnId: string | null;
  nextCursor: string | null;
  generation?: number;
  snapshotSequence?: number;
  timeline: TimelineItem[];
  model?: string | null;
  reasoningEffort?: string | null;
  activePermissionProfile?: ActivePermissionProfile | null;
  approvalsReviewer?: ApprovalsReviewer | null;
  contextUsage?: ThreadContextUsage | null;
  goal?: ThreadGoal | null;
  completeness?: TimelineCompleteness;
  includedBytes?: number;
};

export type ThreadGoal = {
  threadId: string;
  objective: string;
  status: string;
  tokenBudget: number | null;
  tokensUsed: number;
  timeUsedSeconds: number;
  createdAt: number;
  updatedAt: number;
};

export type ThreadContextUsage = {
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  reasoningOutputTokens: number;
  modelContextWindow: number | null;
  updatedAt: number;
};

export type TimelinePage = {
  items: TimelineItem[];
  nextCursor: string | null;
  completeness?: TimelineCompleteness;
  includedBytes?: number;
};

export type TimelineContentChunk = {
  text: string;
  startOffset: number;
  endOffset: number;
  nextCursor: string | null;
  includedBytes: number;
  completeness: TimelineCompleteness;
};

export type ModelOption = {
  id: string;
  label: string;
  isDefault: boolean;
  supportedReasoningEfforts: string[];
  inputModalities: string[];
};

export type CodexSettings = {
  model: string | null;
  modelProvider: string | null;
  reasoningEffort: string | null;
  reasoningSummary: string | null;
  permissionProfiles?: PermissionProfile[];
};

export type PermissionProfile = {
  id: string;
  label: string;
  description: string | null;
};

export type ActivePermissionProfile = {
  id: string;
  extends: string | null;
};

export type ApprovalsReviewer = "user" | "auto_review" | "guardian_subagent";

export type UploadedImage = {
  path: string;
  mimeType: string;
  size: number;
};

export type SkillReference = {
  name: string;
  path: string;
};

export type SkillOption = SkillReference & {
  cwd: string;
  description: string;
  shortDescription: string | null;
  scope: string;
  enabled: boolean;
};

export type SkillError = {
  cwd: string;
  path: string;
  message: string;
};

export type ServerRequestKind =
  | "command_approval"
  | "file_approval"
  | "permissions_approval"
  | "question"
  | "mcp_elicitation"
  | "dynamic_tool"
  | "unknown";

export type PendingServerRequestOption = {
  value: string;
  label: string;
  description?: string;
};

export type PendingServerRequest = {
  requestId: string;
  threadId?: string;
  kind: ServerRequestKind;
  title?: string;
  description?: string;
  options?: PendingServerRequestOption[];
  method?: string;
  params?: unknown;
  request?: Record<string, unknown>;
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
  mode?: "spawn" | "spawn-or-connect" | "external" | "mock" | "off";
  managedByCurrentProcess?: boolean;
  reusedExisting?: boolean;
  pidKnown?: boolean;
  errorKind?: "timeout" | "unavailable" | "handshake-failed" | "startup-failed" | "lock-timeout" | "stale-lock";
  cleanupState?: "none" | "child-terminated" | "metadata-cleared" | "stale-lock-cleared";
};

export type ChatPermissions = "read-only" | "workspace-write" | "danger-full-access";

export type ChatMode = "plan" | "build";

export type CollaborationModePreset = {
  name: string;
  mode: string | null;
  model: string | null;
  reasoningEffort: string | null;
};

type GeneratedCollaborationMode = "plan" | "default";
type SupportedCollaborationModePreset = CollaborationModePreset & {
  mode: GeneratedCollaborationMode;
};

export type CollaborationModePayload = {
  mode: GeneratedCollaborationMode;
  settings: {
    model: string;
    reasoning_effort?: string | null;
    developer_instructions?: string | null;
  };
};

export type ReasoningSummary = "auto" | "concise" | "detailed" | "none";

export const DEFAULT_COLLABORATION_MODEL = "gpt-5-codex";

export function permissionsForMode(mode: ChatMode): ChatPermissions {
  return mode === "plan" ? "read-only" : "workspace-write";
}

export function collaborationModeForChatMode(
  mode: ChatMode,
  model?: string | null,
  reasoningEffort?: string | null,
  presets: CollaborationModePreset[] = []
): CollaborationModePayload {
  const preset = selectCollaborationPreset(mode, presets);
  const protocolMode = preset?.mode ?? (mode === "plan" ? "plan" : "default");
  return {
    mode: protocolMode,
    settings: {
      model: model || preset?.model || DEFAULT_COLLABORATION_MODEL,
      reasoning_effort: reasoningEffort ?? preset?.reasoningEffort ?? null,
      developer_instructions: null
    }
  };
}

function selectCollaborationPreset(
  mode: ChatMode,
  presets: CollaborationModePreset[]
): SupportedCollaborationModePreset | null {
  const protocolMode: GeneratedCollaborationMode = mode === "plan" ? "plan" : "default";
  return presets.find((preset): preset is SupportedCollaborationModePreset => preset.mode === protocolMode) ?? null;
}
import type { TimelineCompleteness } from "../../shared/timeline-content";
