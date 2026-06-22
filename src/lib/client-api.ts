import type {
  AppServerStatusView,
  MobileCommandResult,
  MobileFileContent,
  MobileFileEntry,
  MobileModelOption,
  MobilePluginDetailView,
  MobilePluginInstallResultView,
  MobileRemoteControlPairingStatusView,
  MobileRemoteControlPairingView,
  MobileRemoteControlStatusView,
  MobileSettingsView,
  MobileThreadDetail,
  MobileThreadGoalView,
  MobileThreadPage,
  MobileTimelinePage
} from "../shared/codex";
import type { PendingServerRequestView } from "../server/app-server/pending-requests";

export async function loginWithToken(token: string): Promise<boolean> {
  const response = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token })
  });

  return response.ok;
}

export async function readSession(): Promise<{ authenticated: boolean }> {
  const response = await fetch("/api/auth/session", { cache: "no-store" });
  if (!response.ok) {
    return { authenticated: false };
  }

  return response.json() as Promise<{ authenticated: boolean }>;
}

export async function readCodexStatus(): Promise<AppServerStatusView> {
  const response = await fetch("/api/codex/status", { cache: "no-store" });
  if (!response.ok) {
    return { state: "error", message: "无法读取 Codex 状态" };
  }

  const payload = (await response.json()) as { appServer: AppServerStatusView };
  return payload.appServer;
}

export async function listThreads(searchTerm = ""): Promise<MobileThreadPage> {
  const params = new URLSearchParams();
  if (searchTerm.trim()) {
    params.set("search", searchTerm.trim());
  }
  const query = params.toString();
  const response = await fetch(`/api/codex/threads${query ? `?${query}` : ""}`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error("无法读取会话历史");
  }

  return response.json() as Promise<MobileThreadPage>;
}

export async function listModels(): Promise<MobileModelOption[]> {
  const response = await fetch("/api/codex/models", { cache: "no-store" });
  if (!response.ok) {
    throw new Error("无法读取模型列表");
  }

  const payload = (await response.json()) as { models: MobileModelOption[] };
  return payload.models;
}

export async function readThread(threadId: string): Promise<MobileThreadDetail> {
  const response = await fetch(`/api/codex/threads/${encodeURIComponent(threadId)}`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error("无法读取会话内容");
  }

  const payload = (await response.json()) as { thread: MobileThreadDetail };
  return payload.thread;
}

export async function resumeThread(threadId: string): Promise<MobileThreadDetail> {
  const response = await fetch(`/api/codex/threads/${encodeURIComponent(threadId)}/resume`, { method: "POST" });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || "无法恢复会话");
  }

  const payload = (await response.json()) as { thread: MobileThreadDetail };
  return payload.thread;
}

export async function startThread(input: { model?: string; permissions?: string } = {}): Promise<MobileThreadDetail> {
  const response = await fetch("/api/codex/threads/start", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input)
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || "无法新建会话");
  }

  const payload = (await response.json()) as { thread: { id: string } };
  return readThread(payload.thread.id);
}

export async function startTurn(input: {
  threadId: string;
  text: string;
  imagePaths?: string[];
  model?: string;
  reasoningEffort?: string;
  permissions?: string;
}): Promise<MobileThreadDetail> {
  const response = await fetch("/api/codex/turns/start", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input)
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || "无法发送消息");
  }

  const payload = (await response.json()) as { thread: MobileThreadDetail };
  return payload.thread;
}

export async function uploadImage(file: File): Promise<{ path: string }> {
  const formData = new FormData();
  formData.set("image", file);
  const response = await fetch("/api/codex/uploads/images", {
    method: "POST",
    body: formData
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || "无法上传图片");
  }

  const payload = (await response.json()) as { image: { path: string } };
  return { path: payload.image.path };
}

export async function forkThread(threadId: string): Promise<MobileThreadDetail> {
  const response = await fetch(`/api/codex/threads/${encodeURIComponent(threadId)}/fork`, { method: "POST" });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || "无法 fork 会话");
  }

  const payload = (await response.json()) as { thread: MobileThreadDetail };
  return payload.thread;
}

export async function rollbackThread(threadId: string, numTurns = 1): Promise<MobileThreadDetail> {
  const response = await fetch(`/api/codex/threads/${encodeURIComponent(threadId)}/rollback`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ numTurns })
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || "无法 rollback 会话");
  }

  const payload = (await response.json()) as { thread: MobileThreadDetail };
  return payload.thread;
}

export async function renameThread(threadId: string, name: string): Promise<MobileThreadDetail> {
  const response = await fetch(`/api/codex/threads/${encodeURIComponent(threadId)}/name`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name })
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || "无法重命名会话");
  }

  const payload = (await response.json()) as { thread: MobileThreadDetail };
  return payload.thread;
}

export async function archiveThread(threadId: string): Promise<void> {
  const response = await fetch(`/api/codex/threads/${encodeURIComponent(threadId)}/archive`, { method: "POST" });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || "无法归档会话");
  }
}

export async function deleteThread(threadId: string): Promise<void> {
  const response = await fetch(`/api/codex/threads/${encodeURIComponent(threadId)}/delete`, { method: "POST" });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || "无法删除会话");
  }
}

export async function updateThreadSettings(input: {
  threadId: string;
  model?: string;
  reasoningEffort?: string;
  permissions?: string;
}): Promise<void> {
  const response = await fetch(`/api/codex/threads/${encodeURIComponent(input.threadId)}/settings`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: input.model,
      reasoningEffort: input.reasoningEffort,
      permissions: input.permissions
    })
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || "无法更新会话设置");
  }
}

export async function setThreadGoal(input: {
  threadId: string;
  objective: string;
  tokenBudget?: number | null;
}): Promise<MobileThreadGoalView> {
  const response = await fetch(`/api/codex/threads/${encodeURIComponent(input.threadId)}/goal`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      objective: input.objective,
      tokenBudget: input.tokenBudget
    })
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || "无法设置会话目标");
  }

  const payload = (await response.json()) as { goal: MobileThreadGoalView };
  return payload.goal;
}

export async function clearThreadGoal(threadId: string): Promise<void> {
  const response = await fetch(`/api/codex/threads/${encodeURIComponent(threadId)}/goal`, { method: "DELETE" });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || "无法清除会话目标");
  }
}

export async function compactThread(threadId: string): Promise<void> {
  const response = await fetch(`/api/codex/threads/${encodeURIComponent(threadId)}/compact`, { method: "POST" });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || "无法压缩上下文");
  }
}

export async function startReview(threadId: string): Promise<MobileThreadDetail> {
  const response = await fetch(`/api/codex/threads/${encodeURIComponent(threadId)}/review`, { method: "POST" });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || "无法启动代码审查");
  }

  const payload = (await response.json()) as { thread: MobileThreadDetail };
  return payload.thread;
}

export async function setThreadMemoryMode(threadId: string, mode: "enabled" | "disabled"): Promise<void> {
  const response = await fetch(`/api/codex/threads/${encodeURIComponent(threadId)}/memory`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ mode })
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || "无法切换记忆模式");
  }
}

export async function resetMemory(): Promise<void> {
  const response = await fetch("/api/codex/memory/reset", { method: "POST" });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || "无法重置记忆");
  }
}

export async function enableRemoteControl(): Promise<MobileRemoteControlStatusView> {
  const response = await fetch("/api/codex/remote-control/enable", { method: "POST" });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || "无法启用远程控制");
  }

  const payload = (await response.json()) as { status: MobileRemoteControlStatusView };
  return payload.status;
}

export async function disableRemoteControl(): Promise<MobileRemoteControlStatusView> {
  const response = await fetch("/api/codex/remote-control/disable", { method: "POST" });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || "无法关闭远程控制");
  }

  const payload = (await response.json()) as { status: MobileRemoteControlStatusView };
  return payload.status;
}

export async function startRemoteControlPairing(): Promise<MobileRemoteControlPairingView> {
  const response = await fetch("/api/codex/remote-control/pairing", { method: "POST" });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || "无法开始配对");
  }

  const payload = (await response.json()) as { pairing: MobileRemoteControlPairingView };
  return payload.pairing;
}

export async function readRemoteControlPairingStatus(input: {
  pairingCode?: string | null;
  manualPairingCode?: string | null;
}): Promise<MobileRemoteControlPairingStatusView> {
  const response = await fetch("/api/codex/remote-control/pairing/status", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input)
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || "无法读取配对状态");
  }

  const payload = (await response.json()) as { pairingStatus: MobileRemoteControlPairingStatusView };
  return payload.pairingStatus;
}

export async function revokeRemoteControlClient(environmentId: string, clientId: string): Promise<void> {
  const response = await fetch(`/api/codex/remote-control/clients/${encodeURIComponent(clientId)}/revoke`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ environmentId })
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || "无法撤销远程客户端");
  }
}

export async function readPlugin(input: {
  marketplaceName?: string | null;
  marketplacePath?: string | null;
  pluginName: string;
}): Promise<MobilePluginDetailView> {
  const response = await fetch(`/api/codex/plugins/${encodeURIComponent(input.pluginName)}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      marketplaceName: input.marketplaceName ?? null,
      marketplacePath: input.marketplacePath ?? null
    })
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || "无法读取插件详情");
  }

  const payload = (await response.json()) as { plugin: MobilePluginDetailView };
  return payload.plugin;
}

export async function installPlugin(input: {
  marketplaceName?: string | null;
  marketplacePath?: string | null;
  pluginName: string;
}): Promise<MobilePluginInstallResultView> {
  const response = await fetch(`/api/codex/plugins/${encodeURIComponent(input.pluginName)}/install`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      marketplaceName: input.marketplaceName ?? null,
      marketplacePath: input.marketplacePath ?? null
    })
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || "无法安装插件");
  }

  const payload = (await response.json()) as { result: MobilePluginInstallResultView };
  return payload.result;
}

export async function uninstallPlugin(pluginId: string): Promise<void> {
  const response = await fetch(`/api/codex/plugins/${encodeURIComponent(pluginId)}/uninstall`, { method: "POST" });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || "无法卸载插件");
  }
}

export async function interruptTurn(threadId: string, turnId: string): Promise<void> {
  const response = await fetch(`/api/codex/turns/${encodeURIComponent(threadId)}/interrupt`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ turnId })
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || "无法 interrupt turn");
  }
}

export async function steerTurn(input: {
  threadId: string;
  expectedTurnId: string;
  text: string;
}): Promise<MobileThreadDetail> {
  const response = await fetch(`/api/codex/turns/${encodeURIComponent(input.threadId)}/steer`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input)
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || "无法 steer turn");
  }

  const payload = (await response.json()) as { thread: MobileThreadDetail };
  return payload.thread;
}

export async function listPendingServerRequests(): Promise<PendingServerRequestView[]> {
  const response = await fetch("/api/codex/requests", { cache: "no-store" });
  if (!response.ok) {
    throw new Error("无法读取待确认请求");
  }

  const payload = (await response.json()) as { requests: PendingServerRequestView[] };
  return payload.requests;
}

export async function resolveServerRequest(requestId: number, responsePayload: unknown): Promise<void> {
  const response = await fetch(`/api/codex/requests/${requestId}/resolve`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ response: responsePayload })
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || "无法处理请求");
  }
}

export async function readDirectory(path: string): Promise<MobileFileEntry[]> {
  const response = await fetch(`/api/codex/fs/directory?path=${encodeURIComponent(path)}`, { cache: "no-store" });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || "无法读取目录");
  }

  const payload = (await response.json()) as { entries: MobileFileEntry[] };
  return payload.entries;
}

export async function readFile(path: string): Promise<MobileFileContent> {
  const response = await fetch(`/api/codex/fs/file?path=${encodeURIComponent(path)}`, { cache: "no-store" });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || "无法读取文件");
  }

  const payload = (await response.json()) as { file: MobileFileContent };
  return payload.file;
}

export async function execCommand(input: {
  command: string[];
  cwd?: string;
  timeoutMs?: number;
}): Promise<MobileCommandResult> {
  const response = await fetch("/api/codex/terminal/exec", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input)
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || "无法执行命令");
  }

  const payload = (await response.json()) as { result: MobileCommandResult };
  return payload.result;
}

export async function readSettings(): Promise<MobileSettingsView> {
  const response = await fetch("/api/codex/settings", { cache: "no-store" });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || "无法读取设置");
  }

  const payload = (await response.json()) as { settings: MobileSettingsView };
  return payload.settings;
}

export async function listThreadTurns(input: {
  threadId: string;
  cursor?: string | null;
  limit?: number;
}): Promise<MobileTimelinePage> {
  const params = new URLSearchParams();
  if (input.cursor) {
    params.set("cursor", input.cursor);
  }
  if (input.limit) {
    params.set("limit", String(input.limit));
  }

  const response = await fetch(`/api/codex/threads/${encodeURIComponent(input.threadId)}/turns?${params.toString()}`, {
    cache: "no-store"
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || "无法读取 turn 分页");
  }

  const payload = (await response.json()) as { page: MobileTimelinePage };
  return payload.page;
}

export async function listThreadTurnItems(input: {
  threadId: string;
  turnId: string;
  cursor?: string | null;
  limit?: number;
}): Promise<MobileTimelinePage> {
  const params = new URLSearchParams();
  if (input.cursor) {
    params.set("cursor", input.cursor);
  }
  if (input.limit) {
    params.set("limit", String(input.limit));
  }

  const response = await fetch(
    `/api/codex/threads/${encodeURIComponent(input.threadId)}/turns/${encodeURIComponent(input.turnId)}/items?${params.toString()}`,
    { cache: "no-store" }
  );
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || "无法读取 item 分页");
  }

  const payload = (await response.json()) as { page: MobileTimelinePage };
  return payload.page;
}
