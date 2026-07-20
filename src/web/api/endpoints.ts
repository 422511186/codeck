import { ApiError, api } from "./client";
import type {
  CustomModelCatalog,
  CustomModelInput,
  ModelSelection,
  ModelSwitchRequest,
  SelectableModel,
  ThreadModelStateView,
  UnifiedModelCatalog
} from "../../shared/custom-models";
import type { ProjectCatalog, ProjectCreateInput, ProjectStorage } from "../../shared/projects";
import type {
  AppServerStatus,
  ApprovalPolicy,
  ApprovalsReviewer,
  CodexSettings,
  CollaborationModePayload,
  CollaborationModePreset,
  ModelOption,
  PendingServerRequest,
  SkillError,
  SkillOption,
  SkillReference,
  ThreadDetail,
  ThreadGoal,
  ThreadPage,
  ThreadSummary,
  TimelinePage,
  TimelineContentChunk,
  UploadedImage
} from "./types";

export type AuthSession = { authenticated: boolean };

export async function getSession(): Promise<AuthSession> {
  const data = await api<AuthSession>("/api/auth/session", { skipSessionRedirect: true });
  return { authenticated: Boolean(data.authenticated) };
}

export async function login(token: string): Promise<void> {
  await api("/api/auth/login", {
    method: "POST",
    body: { token },
    skipSessionRedirect: true
  });
}

export async function logout(): Promise<void> {
  try {
    await api("/api/auth/logout", { method: "POST", skipSessionRedirect: true });
  } catch {
    // ignore
  }
}

export async function getAppServerStatus(): Promise<AppServerStatus> {
  const data = await api<{ appServer: AppServerStatus }>("/api/codex/status");
  return data.appServer;
}

export async function listModels(): Promise<ModelOption[]> {
  const catalog = await getModelCatalog();
  return catalog.models.map((model) => ({
    ...model,
    id: model.source === "custom" ? model.customModelId : model.model
  })) as ModelOption[];
}

export async function getModelCatalog(): Promise<UnifiedModelCatalog> {
  const data = await api<UnifiedModelCatalog>("/api/codex/models");
  return {
    catalogRevision: data.catalogRevision ?? 0,
    appServerModelNames: data.appServerModelNames ?? [],
    models: data.models ?? []
  };
}

export async function getCustomModels(): Promise<CustomModelCatalog> {
  const data = await api<CustomModelCatalog>("/api/codex/custom-models");
  return { revision: data.revision, models: data.models ?? [] };
}

export async function createCustomModel(
  input: CustomModelInput,
  expectedRevision: number
): Promise<CustomModelCatalog> {
  const data = await api<CustomModelCatalog>("/api/codex/custom-models", {
    method: "POST",
    body: { expectedRevision, ...input }
  });
  return { revision: data.revision, models: data.models ?? [] };
}

export async function replaceCustomModel(
  customModelId: string,
  input: CustomModelInput,
  expectedRevision: number
): Promise<CustomModelCatalog> {
  const data = await api<CustomModelCatalog>(
    `/api/codex/custom-models/${encodeURIComponent(customModelId)}`,
    { method: "PUT", body: { expectedRevision, ...input } }
  );
  return { revision: data.revision, models: data.models ?? [] };
}

export async function deleteCustomModel(
  customModelId: string,
  expectedRevision: number
): Promise<CustomModelCatalog> {
  const data = await api<CustomModelCatalog>(
    `/api/codex/custom-models/${encodeURIComponent(customModelId)}`,
    { method: "DELETE", body: { expectedRevision } }
  );
  return { revision: data.revision, models: data.models ?? [] };
}

export async function getProjectCatalog(): Promise<ProjectCatalog> {
  const data = await api<ProjectCatalog>("/api/codex/projects");
  return {
    revision: data.revision,
    defaultStorage: data.defaultStorage,
    projects: data.projects ?? []
  };
}

export async function createServerProject(
  input: ProjectCreateInput,
  expectedRevision: number
): Promise<ProjectCatalog> {
  const data = await api<ProjectCatalog>("/api/codex/projects", {
    method: "POST",
    body: { expectedRevision, ...input }
  });
  return { revision: data.revision, defaultStorage: data.defaultStorage, projects: data.projects ?? [] };
}

export async function renameServerProject(
  projectId: string,
  name: string,
  expectedRevision: number
): Promise<ProjectCatalog> {
  const data = await api<ProjectCatalog>(`/api/codex/projects/${encodeURIComponent(projectId)}`, {
    method: "PUT",
    body: { expectedRevision, name }
  });
  return { revision: data.revision, defaultStorage: data.defaultStorage, projects: data.projects ?? [] };
}

export async function deleteServerProject(
  projectId: string,
  expectedRevision: number
): Promise<ProjectCatalog> {
  const data = await api<ProjectCatalog>(`/api/codex/projects/${encodeURIComponent(projectId)}`, {
    method: "DELETE",
    body: { expectedRevision }
  });
  return { revision: data.revision, defaultStorage: data.defaultStorage, projects: data.projects ?? [] };
}

export async function touchServerProject(projectId: string, lastUsedAt: number): Promise<ProjectCatalog> {
  const data = await api<ProjectCatalog>(`/api/codex/projects/${encodeURIComponent(projectId)}/touch`, {
    method: "POST",
    body: { lastUsedAt }
  });
  return { revision: data.revision, defaultStorage: data.defaultStorage, projects: data.projects ?? [] };
}

export async function updateDefaultProjectStorage(
  defaultStorage: ProjectStorage,
  expectedRevision: number
): Promise<ProjectCatalog> {
  const data = await api<ProjectCatalog>("/api/codex/projects/default-storage", {
    method: "PUT",
    body: { expectedRevision, defaultStorage }
  });
  return { revision: data.revision, defaultStorage: data.defaultStorage, projects: data.projects ?? [] };
}

export type ModelSwitchApiResult = {
  ok?: boolean;
  outcome?: "switched" | "recovered" | "recovery_failed";
  code?: string;
  operationId: string | null;
  latestState: ThreadModelStateView | null;
  catalog?: CustomModelCatalog | null;
  thread?: ThreadDetail | null;
  error?: string;
};

async function structuredModelTerminal(
  path: string,
  body: unknown
): Promise<ModelSwitchApiResult> {
  try {
    return await api<ModelSwitchApiResult>(path, { method: "POST", body });
  } catch (error) {
    if (error instanceof ApiError && typeof error.body === "object" && error.body !== null) {
      return error.body as ModelSwitchApiResult;
    }
    throw error;
  }
}

export function switchThreadModel(
  threadId: string,
  input: ModelSwitchRequest
): Promise<ModelSwitchApiResult> {
  return structuredModelTerminal(
    `/api/codex/threads/${encodeURIComponent(threadId)}/model/switch`,
    input
  );
}

export function recoverThreadModel(
  threadId: string,
  action: "restore-old" | "retry-target"
): Promise<ModelSwitchApiResult> {
  return structuredModelTerminal(
    `/api/codex/threads/${encodeURIComponent(threadId)}/model/recover`,
    { action }
  );
}

export async function listSkills(
  enabledOnly = true,
  cwd?: string
): Promise<{ skills: SkillOption[]; skillErrors: SkillError[] }> {
  const data = await api<{ skills: SkillOption[]; skillErrors: SkillError[] }>("/api/codex/skills", {
    query: { enabledOnly, cwd }
  });
  return {
    skills: data.skills ?? [],
    skillErrors: data.skillErrors ?? []
  };
}

export async function readCodexSettings(): Promise<CodexSettings> {
  let data: { settings: CodexSettings };
  try {
    data = await api<{ settings: CodexSettings }>("/api/codex/settings");
  } catch {
    data = await api<{ settings: CodexSettings }>("/api/codex/settings/model-defaults");
  }
  return {
    model: data.settings?.model ?? null,
    modelProvider: data.settings?.modelProvider ?? null,
    reasoningEffort: data.settings?.reasoningEffort ?? null,
    reasoningSummary: data.settings?.reasoningSummary ?? null,
    permissionProfiles: data.settings?.permissionProfiles ?? []
  };
}

export async function listCollaborationModes(): Promise<CollaborationModePreset[]> {
  const data = await api<{ modes: CollaborationModePreset[] }>("/api/codex/collaboration-modes");
  return data.modes ?? [];
}

export type ListThreadsParams = {
  cursor?: string | null;
  search?: string;
  cwd?: string;
  archived?: boolean;
};

export async function listThreads(params: ListThreadsParams = {}): Promise<ThreadPage> {
  const data = await api<ThreadPage>("/api/codex/threads", {
    query: {
      cursor: params.cursor,
      search: params.search,
      cwd: params.cwd,
      archived: params.archived
    }
  });
  return { threads: data.threads ?? [], nextCursor: data.nextCursor ?? null };
}

export type TimelineRepairReason =
  | "manual"
  | "mutation-retry"
  | "timeline-gap"
  | "turn-completed"
  | "summary-idle"
  | "stream-disconnected"
  | "baseline-required";

export async function readThread(
  threadId: string,
  options: { repairReason?: TimelineRepairReason } = {}
): Promise<ThreadDetail> {
  const data = await api<{ thread: ThreadDetail }>(
    `/api/codex/threads/${encodeURIComponent(threadId)}`,
    { query: { repairReason: options.repairReason } }
  );
  return data.thread;
}

export async function readThreadSummary(threadId: string): Promise<ThreadSummary> {
  const data = await api<{ thread: ThreadSummary }>(
    `/api/codex/threads/${encodeURIComponent(threadId)}/summary`
  );
  return data.thread;
}

export async function resumeThread(threadId: string): Promise<ThreadDetail> {
  const data = await api<{ thread: ThreadDetail }>(
    `/api/codex/threads/${encodeURIComponent(threadId)}/resume`,
    { method: "POST" }
  );
  return data.thread;
}

export async function listTurnsBefore(
  threadId: string,
  cursor?: string | null,
  limit?: number,
  options: { repairReason?: TimelineRepairReason } = {}
): Promise<TimelinePage> {
  const data = await api<{ page: TimelinePage }>(
    `/api/codex/threads/${encodeURIComponent(threadId)}/turns`,
    { query: { cursor, limit, repairReason: options.repairReason } }
  );
  return {
    ...data.page,
    items: data.page?.items ?? [],
    nextCursor: data.page?.nextCursor ?? null
  };
}

export async function listTurnItems(
  threadId: string,
  turnId: string,
  cursor?: string | null,
  limit?: number
): Promise<TimelinePage> {
  const data = await api<{ page: TimelinePage }>(
    `/api/codex/threads/${encodeURIComponent(threadId)}/turns/${encodeURIComponent(turnId)}/items`,
    { query: { cursor, limit } }
  );
  return {
    ...data.page,
    items: data.page?.items ?? [],
    nextCursor: data.page?.nextCursor ?? null
  };
}

export async function readTimelineContent(
  threadId: string,
  contentRef: string,
  cursor?: string | null,
  maxBytes?: number
): Promise<TimelineContentChunk> {
  const data = await api<{ chunk: TimelineContentChunk }>(
    `/api/codex/threads/${encodeURIComponent(threadId)}/content`,
    { query: { contentRef, cursor, maxBytes } }
  );
  return data.chunk;
}

export type StartThreadInput = {
  cwd: string;
  workspaceRoots?: string[];
  modelSelection?: ModelSelection;
  catalogRevision?: number;
  permissions?: string | null;
  approvalPolicy?: ApprovalPolicy | null;
  approvalsReviewer?: ApprovalsReviewer | null;
  clientOperationId?: string;
};

export async function startThread(input: StartThreadInput): Promise<ThreadDetail> {
  const data = await api<{ thread: ThreadDetail }>("/api/codex/threads/start", {
    method: "POST",
    body: input
  });
  return data.thread;
}

export type StartTurnInput = {
  threadId: string;
  text: string;
  imagePaths?: string[];
  skillReferences?: SkillReference[];
  clientUserMessageId?: string;
  model?: string;
  reasoningEffort?: string;
  reasoningSummary?: string;
  permissions?: string | null;
  approvalPolicy?: ApprovalPolicy | null;
  approvalsReviewer?: ApprovalsReviewer | null;
  additionalContext?: Record<string, { value: string; kind: "untrusted" | "application" }>;
  collaborationMode?: CollaborationModePayload;
};

export type StartTurnResult = { turnId: string };

export async function startTurn(input: StartTurnInput): Promise<StartTurnResult> {
  const data = await api<StartTurnResult>("/api/codex/turns/start", {
    method: "POST",
    body: input
  });
  return { turnId: data.turnId };
}

export async function interruptTurn(threadId: string, turnId?: string): Promise<void> {
  await api(`/api/codex/turns/${encodeURIComponent(threadId)}/interrupt`, {
    method: "POST",
    body: turnId ? { turnId } : {}
  });
}

export async function rollbackThread(
  threadId: string,
  input: RollbackThreadInput
): Promise<ThreadDetail> {
  const data = await api<{ thread: ThreadDetail }>(
    `/api/codex/threads/${encodeURIComponent(threadId)}/rollback`,
    { method: "POST", body: input }
  );
  return data.thread;
}

export type RollbackThreadInput = {
  operationId: string;
  targetTurnId: string;
  historyStamp: NonNullable<ThreadDetail["historyStamp"]>;
  expectedTailTurnIds: string[];
};

export async function archiveThread(threadId: string): Promise<void> {
  await api(`/api/codex/threads/${encodeURIComponent(threadId)}/archive`, { method: "POST" });
}

export async function unarchiveThread(threadId: string): Promise<ThreadDetail> {
  const data = await api<{ thread: ThreadDetail }>(
    `/api/codex/threads/${encodeURIComponent(threadId)}/unarchive`,
    { method: "POST" }
  );
  return data.thread;
}

export async function renameThread(threadId: string, name: string): Promise<ThreadDetail> {
  const data = await api<{ thread: ThreadDetail }>(
    `/api/codex/threads/${encodeURIComponent(threadId)}/name`,
    { method: "POST", body: { name } }
  );
  return data.thread;
}

export async function forkThread(threadId: string): Promise<ThreadDetail> {
  const data = await api<{ thread: ThreadDetail }>(
    `/api/codex/threads/${encodeURIComponent(threadId)}/fork`,
    { method: "POST" }
  );
  return data.thread;
}

export async function compactThread(threadId: string): Promise<void> {
  await api(`/api/codex/threads/${encodeURIComponent(threadId)}/compact`, { method: "POST" });
}

export type UpdateThreadSettingsInput = {
  reasoningEffort?: string;
  permissions?: string | null;
  approvalPolicy?: ApprovalPolicy | null;
  approvalsReviewer?: ApprovalsReviewer | null;
  collaborationMode?: CollaborationModePayload;
};

export async function updateThreadSettings(
  threadId: string,
  input: UpdateThreadSettingsInput
): Promise<void> {
  await api(`/api/codex/threads/${encodeURIComponent(threadId)}/settings`, {
    method: "POST",
    body: input
  });
}

export async function setThreadGoal(
  threadId: string,
  input: { objective: string }
): Promise<ThreadGoal> {
  const data = await api<{ goal: ThreadGoal }>(
    `/api/codex/threads/${encodeURIComponent(threadId)}/goal`,
    {
      method: "POST",
      body: {
        objective: input.objective,
        tokenBudget: null
      }
    }
  );
  return data.goal;
}

export async function clearThreadGoal(threadId: string): Promise<void> {
  await api(`/api/codex/threads/${encodeURIComponent(threadId)}/goal`, { method: "DELETE" });
}

export async function listPendingRequests(): Promise<PendingServerRequest[]> {
  const data = await api<{ requests: PendingServerRequest[] }>("/api/codex/requests");
  return data.requests ?? [];
}

export async function resolveRequest(
  requestId: string,
  input: { value: string } | { response: unknown }
): Promise<void> {
  await api(`/api/codex/requests/${encodeURIComponent(requestId)}/resolve`, {
    method: "POST",
    body: input
  });
}

export async function uploadImage(file: File): Promise<UploadedImage> {
  const formData = new FormData();
  formData.append("image", file);
  const data = await api<{ image: UploadedImage }>("/api/codex/uploads/images", {
    method: "POST",
    formData,
    timeoutMs: 120_000
  });
  return data.image;
}

export type AccountAuthStatus = {
  authMethod: string | null;
  hasAuthToken: boolean;
  requiresOpenaiAuth: boolean | null;
};

export async function getAccountAuthStatus(): Promise<AccountAuthStatus> {
  const data = await api<{ result?: AccountAuthStatus; authStatus?: AccountAuthStatus }>(
    "/api/codex/account/auth-status"
  );
  return data.result ?? data.authStatus!;
}

export type TokenUsageSummary = {
  summary: {
    lifetimeTokens: number | null;
    peakDailyTokens: number | null;
  };
};

export async function getTokenUsage(): Promise<TokenUsageSummary> {
  const data = await api<{ result?: TokenUsageSummary; usage?: TokenUsageSummary }>(
    "/api/codex/account/token-usage"
  );
  return data.result ?? data.usage!;
}

export type ProbeWorkspaceResult = { allowed: boolean; threadCount: number; error?: string };

export async function probeWorkspacePath(path: string): Promise<ProbeWorkspaceResult> {
  try {
    const all = await listThreads({});
    const matching = (all.threads ?? []).filter((t) => normalizePath(t.cwd) === normalizePath(path));
    return { allowed: true, threadCount: matching.length };
  } catch (error) {
    return {
      allowed: false,
      threadCount: 0,
      error: error instanceof Error ? error.message : "无法验证工作区路径"
    };
  }
}

export function normalizePath(input: string): string {
  if (!input) return "";
  return input.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
}

export async function listThreadsForCwd(
  cwd: string,
  archived = false
): Promise<ThreadSummary[]> {
  const page = await listThreads({ cwd, archived });
  return page.threads;
}

export const auth = {
  session: getSession,
  login,
  logout
};

export const codex = {
  status: getAppServerStatus,
  settings: readCodexSettings,
  models: listModels,
  modelCatalog: getModelCatalog,
  customModels: getCustomModels,
  createCustomModel,
  replaceCustomModel,
  deleteCustomModel,
  projectCatalog: getProjectCatalog,
  createServerProject,
  renameServerProject,
  deleteServerProject,
  touchServerProject,
  updateDefaultProjectStorage,
  switchThreadModel,
  recoverThreadModel,
  skills: listSkills,
  collaborationModes: listCollaborationModes,
  listThreads: async (params: { cwd?: string; archived?: boolean; cursor?: string | null; limit?: number; search?: string } = {}) => {
    if (params.cwd) {
      const items = await listThreadsForCwd(params.cwd, params.archived ?? false);
      return { threads: items, nextCursor: null };
    }
    return listThreads({
      cursor: params.cursor ?? null,
      search: params.search,
      archived: params.archived
    });
  },
  listThreadsForCwd,
  readThread,
  readThreadSummary,
  resumeThread,
  listTurnsBefore,
  listTurnItems,
  readTimelineContent,
  startThread,
  startTurn,
  interruptTurn,
  rollbackThread,
  archiveThread,
  unarchiveThread,
  renameThread,
  forkThread,
  compactThread,
  updateThreadSettings,
  setThreadGoal,
  clearThreadGoal,
  listPendingRequests,
  resolveRequest,
  uploadImage,
  authStatus: getAccountAuthStatus,
  tokenUsage: getTokenUsage,
  probeWorkspacePath
};
