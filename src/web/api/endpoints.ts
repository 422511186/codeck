import { api } from "./client";
import type {
  AppServerStatus,
  CodexSettings,
  CollaborationModePayload,
  CollaborationModePreset,
  ModelOption,
  PendingServerRequest,
  ThreadDetail,
  ThreadPage,
  ThreadSummary,
  TimelinePage,
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
  const data = await api<{ models: ModelOption[] }>("/api/codex/models");
  return data.models ?? [];
}

export async function readCodexSettings(): Promise<CodexSettings> {
  const data = await api<{ settings: CodexSettings }>("/api/codex/settings/model-defaults");
  return {
    model: data.settings?.model ?? null,
    modelProvider: data.settings?.modelProvider ?? null,
    reasoningEffort: data.settings?.reasoningEffort ?? null
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

export async function readThread(threadId: string): Promise<ThreadDetail> {
  const data = await api<{ thread: ThreadDetail }>(
    `/api/codex/threads/${encodeURIComponent(threadId)}`
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
  limit?: number
): Promise<TimelinePage> {
  const data = await api<{ page: TimelinePage }>(
    `/api/codex/threads/${encodeURIComponent(threadId)}/turns`,
    { query: { cursor, limit } }
  );
  return { items: data.page?.items ?? [], nextCursor: data.page?.nextCursor ?? null };
}

export type StartThreadInput = {
  cwd: string;
  workspaceRoots?: string[];
  model?: string;
  permissions?: string;
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
  model?: string;
  reasoningEffort?: string;
  permissions?: string;
  additionalContext?: Record<string, { value: string; kind: "untrusted" | "application" }>;
  collaborationMode?: CollaborationModePayload;
};

export type StartTurnResult = { turnId: string; thread: ThreadDetail };

export async function startTurn(input: StartTurnInput): Promise<StartTurnResult> {
  const data = await api<StartTurnResult>("/api/codex/turns/start", {
    method: "POST",
    body: input
  });
  return { turnId: data.turnId, thread: data.thread };
}

export async function interruptTurn(threadId: string, turnId?: string): Promise<void> {
  await api(`/api/codex/turns/${encodeURIComponent(threadId)}/interrupt`, {
    method: "POST",
    body: turnId ? { turnId } : {}
  });
}

export async function rollbackThread(threadId: string, numTurns = 1): Promise<ThreadDetail> {
  const data = await api<{ thread: ThreadDetail }>(
    `/api/codex/threads/${encodeURIComponent(threadId)}/rollback`,
    { method: "POST", body: { numTurns } }
  );
  return data.thread;
}

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
  model?: string;
  reasoningEffort?: string;
  permissions?: string;
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

export async function listPendingRequests(): Promise<PendingServerRequest[]> {
  const data = await api<{ requests: PendingServerRequest[] }>("/api/codex/requests");
  return data.requests ?? [];
}

export async function resolveRequest(
  requestId: string,
  response: Record<string, unknown>
): Promise<void> {
  await api(`/api/codex/requests/${encodeURIComponent(requestId)}/resolve`, {
    method: "POST",
    body: { response }
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
  resumeThread,
  listTurnsBefore,
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
  listPendingRequests,
  resolveRequest,
  uploadImage,
  authStatus: getAccountAuthStatus,
  tokenUsage: getTokenUsage,
  probeWorkspacePath
};
