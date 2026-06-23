import type {
  AppServerStatusView,
  MobileAccountLoginCancelView,
  MobileAccountLoginView,
  MobileAccountTokenUsageView,
  MobileAddCreditsNudgeResultView,
  MobileAuthStatusView,
  MobileAppPage,
  MobileBackgroundTerminalPage,
  MobileBackgroundTerminalTerminateResult,
  MobileCommandResult,
  MobileConfigEditInput,
  MobileConfigRequirementsView,
  MobileConfigWriteResultView,
  MobileFileContent,
  MobileFileEntry,
  MobileFileMetadata,
  MobileFileSearchResult,
  MobileFileSearchSessionView,
  MobileGitDiffView,
  MobileMcpLoginView,
  MobileMcpResourceReadView,
  MobileModelOption,
  MobilePluginDetailView,
  MobilePluginInstallResultView,
  MobilePluginSkillContentView,
  MobileRateLimitResetCreditConsumeResult,
  MobileRemoteControlPairingStatusView,
  MobileRemoteControlPairingView,
  MobileRemoteControlStatusView,
  MobileSettingsView,
  MobileSkillConfigWriteResultView,
  MobileTerminalSession,
  MobileThreadDetail,
  MobileThreadElicitationResult,
  MobileThreadGoalView,
  MobileThreadPage,
  MobileThreadSummary,
  MobileThreadUnsubscribeResult,
  MobileTimelinePage,
  MobileWindowsSandboxReadinessView,
  MobileWindowsSandboxSetupResultView
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

export async function loginWithChatGpt(): Promise<MobileAccountLoginView> {
  const response = await fetch("/api/codex/account/login/chatgpt", { method: "POST" });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || "无法启动 ChatGPT 登录");
  }

  const payload = (await response.json()) as { login: MobileAccountLoginView };
  return payload.login;
}

export async function loginWithApiKey(apiKey: string): Promise<MobileAccountLoginView> {
  const response = await fetch("/api/codex/account/login/api-key", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ apiKey })
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || "无法使用 API Key 登录");
  }

  const payload = (await response.json()) as { login: MobileAccountLoginView };
  return payload.login;
}

export async function cancelAccountLogin(loginId: string): Promise<MobileAccountLoginCancelView> {
  const response = await fetch(`/api/codex/account/login/${encodeURIComponent(loginId)}/cancel`, { method: "POST" });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || "无法取消账号登录");
  }

  const payload = (await response.json()) as { result: MobileAccountLoginCancelView };
  return payload.result;
}

export async function logoutAccount(): Promise<void> {
  const response = await fetch("/api/codex/account/logout", { method: "POST" });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || "无法退出账号");
  }
}

export async function getAccountTokenUsage(): Promise<MobileAccountTokenUsageView> {
  const response = await fetch("/api/codex/account/token-usage", { cache: "no-store" });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || "无法读取账号 token 用量");
  }

  const payload = (await response.json()) as { usage: MobileAccountTokenUsageView };
  return payload.usage;
}

export async function getAuthStatus(): Promise<MobileAuthStatusView> {
  const response = await fetch("/api/codex/account/auth-status", { cache: "no-store" });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || "无法读取账号鉴权状态");
  }

  const payload = (await response.json()) as { authStatus: MobileAuthStatusView };
  return payload.authStatus;
}

export async function consumeRateLimitResetCredit(
  idempotencyKey: string
): Promise<MobileRateLimitResetCreditConsumeResult> {
  const response = await fetch("/api/codex/account/rate-limit-reset-credit/consume", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ idempotencyKey })
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || "无法消费重置额度 credit");
  }

  const payload = (await response.json()) as { result: MobileRateLimitResetCreditConsumeResult };
  return payload.result;
}

export async function sendAddCreditsNudgeEmail(
  creditType: "credits" | "usage_limit"
): Promise<MobileAddCreditsNudgeResultView> {
  const response = await fetch("/api/codex/account/add-credits-nudge", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ creditType })
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || "无法发送加购提醒");
  }

  const payload = (await response.json()) as { result: MobileAddCreditsNudgeResultView };
  return payload.result;
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

export async function getConversationSummary(threadId: string): Promise<MobileThreadSummary> {
  const response = await fetch(`/api/codex/conversation-summary?threadId=${encodeURIComponent(threadId)}`, {
    cache: "no-store"
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || "无法读取会话摘要");
  }

  const payload = (await response.json()) as { summary: MobileThreadSummary };
  return payload.summary;
}

export async function gitDiffToRemote(cwd: string): Promise<MobileGitDiffView> {
  const response = await fetch(`/api/codex/git/diff-to-remote?cwd=${encodeURIComponent(cwd)}`, { cache: "no-store" });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || "无法读取远端 Git diff");
  }

  const payload = (await response.json()) as { diff: MobileGitDiffView };
  return payload.diff;
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

export async function unarchiveThread(threadId: string): Promise<MobileThreadDetail> {
  const response = await fetch(`/api/codex/threads/${encodeURIComponent(threadId)}/unarchive`, { method: "POST" });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || "无法恢复归档会话");
  }

  const payload = (await response.json()) as { thread: MobileThreadDetail };
  return payload.thread;
}

export async function unsubscribeThread(threadId: string): Promise<MobileThreadUnsubscribeResult> {
  const response = await fetch(`/api/codex/threads/${encodeURIComponent(threadId)}/unsubscribe`, { method: "POST" });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || "无法取消订阅会话");
  }

  const payload = (await response.json()) as { result: MobileThreadUnsubscribeResult };
  return payload.result;
}

export async function runThreadShellCommand(threadId: string, command: string): Promise<void> {
  const response = await fetch(`/api/codex/threads/${encodeURIComponent(threadId)}/shell-command`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ command })
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || "无法执行会话 shell command");
  }
}

export async function incrementThreadElicitation(threadId: string): Promise<MobileThreadElicitationResult> {
  const response = await fetch(`/api/codex/threads/${encodeURIComponent(threadId)}/elicitation/increment`, {
    method: "POST"
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || "无法增加 elicitation 计数");
  }

  const payload = (await response.json()) as { result: MobileThreadElicitationResult };
  return payload.result;
}

export async function decrementThreadElicitation(threadId: string): Promise<MobileThreadElicitationResult> {
  const response = await fetch(`/api/codex/threads/${encodeURIComponent(threadId)}/elicitation/decrement`, {
    method: "POST"
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || "无法减少 elicitation 计数");
  }

  const payload = (await response.json()) as { result: MobileThreadElicitationResult };
  return payload.result;
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

export async function listApps(): Promise<MobileAppPage> {
  const response = await fetch("/api/codex/apps", { cache: "no-store" });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || "无法读取 Apps 列表");
  }

  return response.json() as Promise<MobileAppPage>;
}

export async function getConfigRequirements(): Promise<MobileConfigRequirementsView | null> {
  const response = await fetch("/api/codex/config/requirements", { cache: "no-store" });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || "无法读取配置要求");
  }

  const payload = (await response.json()) as { requirements: MobileConfigRequirementsView | null };
  return payload.requirements;
}

export async function writeConfigValue(
  keyPath: string,
  value: MobileConfigEditInput["value"]
): Promise<MobileConfigWriteResultView> {
  const response = await fetch("/api/codex/config/value", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ keyPath, value })
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || "无法写入全局配置");
  }

  const payload = (await response.json()) as { result: MobileConfigWriteResultView };
  return payload.result;
}

export async function writeConfigBatch(edits: MobileConfigEditInput[]): Promise<MobileConfigWriteResultView> {
  const response = await fetch("/api/codex/config/batch", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ edits })
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || "无法批量写入全局配置");
  }

  const payload = (await response.json()) as { result: MobileConfigWriteResultView };
  return payload.result;
}

export async function getWindowsSandboxReadiness(): Promise<MobileWindowsSandboxReadinessView> {
  const response = await fetch("/api/codex/windows-sandbox/readiness", { cache: "no-store" });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || "无法检查 Windows Sandbox");
  }

  const payload = (await response.json()) as { readiness: MobileWindowsSandboxReadinessView };
  return payload.readiness;
}

export async function startWindowsSandboxSetup(
  mode: "elevated" | "unelevated",
  cwd?: string | null
): Promise<MobileWindowsSandboxSetupResultView> {
  const response = await fetch("/api/codex/windows-sandbox/setup", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ mode, cwd: cwd ?? null })
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || "无法启动 Windows Sandbox 设置");
  }

  const payload = (await response.json()) as { result: MobileWindowsSandboxSetupResultView };
  return payload.result;
}

export async function readPluginSkill(input: {
  remoteMarketplaceName: string;
  remotePluginId: string;
  skillName: string;
}): Promise<MobilePluginSkillContentView> {
  const response = await fetch(`/api/codex/plugin-skills/${encodeURIComponent(input.skillName)}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      remoteMarketplaceName: input.remoteMarketplaceName,
      remotePluginId: input.remotePluginId
    })
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || "无法读取插件 Skill");
  }

  const payload = (await response.json()) as { skill: MobilePluginSkillContentView };
  return payload.skill;
}

export async function setSkillsExtraRoots(extraRoots: string[]): Promise<void> {
  const response = await fetch("/api/codex/skills/extra-roots", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ extraRoots })
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || "无法设置 Skill 根目录");
  }
}

export async function writeSkillConfig(input: {
  name?: string | null;
  path?: string | null;
  enabled: boolean;
}): Promise<MobileSkillConfigWriteResultView> {
  const response = await fetch("/api/codex/skills/config", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name: input.name ?? null,
      path: input.path ?? null,
      enabled: input.enabled
    })
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || "无法写入 Skill 配置");
  }

  const payload = (await response.json()) as { result: MobileSkillConfigWriteResultView };
  return payload.result;
}

export async function setExperimentalFeatureEnablement(name: string, enabled: boolean): Promise<void> {
  const response = await fetch("/api/codex/experimental-features/enablement", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name, enabled })
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || "无法设置实验功能");
  }
}

export async function refreshMcpServer(serverName: string): Promise<void> {
  const response = await fetch(`/api/codex/mcp/servers/${encodeURIComponent(serverName)}/refresh`, { method: "POST" });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || "无法刷新 MCP 服务");
  }
}

export async function loginMcpServer(serverName: string): Promise<MobileMcpLoginView> {
  const response = await fetch(`/api/codex/mcp/servers/${encodeURIComponent(serverName)}/login`, { method: "POST" });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || "无法启动 MCP 登录");
  }

  const payload = (await response.json()) as { login: MobileMcpLoginView };
  return payload.login;
}

export async function readMcpResource(input: {
  server: string;
  uri: string;
  threadId?: string | null;
}): Promise<MobileMcpResourceReadView> {
  const response = await fetch("/api/codex/mcp/resources/read", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ server: input.server, uri: input.uri, threadId: input.threadId ?? null })
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || "无法读取 MCP 资源");
  }

  const payload = (await response.json()) as { resource: MobileMcpResourceReadView };
  return payload.resource;
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

export async function writeFile(path: string, text: string): Promise<void> {
  const response = await fetch("/api/codex/fs/file", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ path, text })
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || "无法写入文件");
  }
}

export async function createDirectory(path: string): Promise<void> {
  const response = await fetch("/api/codex/fs/directory", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ path })
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || "无法创建目录");
  }
}

export async function copyPath(sourcePath: string, destinationPath: string): Promise<void> {
  const response = await fetch("/api/codex/fs/copy", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ sourcePath, destinationPath })
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || "无法复制路径");
  }
}

export async function removePath(path: string): Promise<void> {
  const response = await fetch("/api/codex/fs/remove", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ path })
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || "无法删除路径");
  }
}

export async function getMetadata(path: string): Promise<MobileFileMetadata> {
  const response = await fetch(`/api/codex/fs/metadata?path=${encodeURIComponent(path)}`, { cache: "no-store" });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || "无法读取元数据");
  }

  const payload = (await response.json()) as { metadata: MobileFileMetadata };
  return payload.metadata;
}

export async function watchPath(path: string): Promise<{ watchId: string; path: string }> {
  const response = await fetch("/api/codex/fs/watch", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ path })
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || "无法监听文件变化");
  }

  const payload = (await response.json()) as { watch: { watchId: string; path: string } };
  return payload.watch;
}

export async function unwatchPath(watchId: string): Promise<void> {
  const response = await fetch("/api/codex/fs/unwatch", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ watchId })
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || "无法停止监听文件变化");
  }
}

export async function searchFiles(input: { query: string; roots: string[] }): Promise<MobileFileSearchResult[]> {
  const response = await fetch("/api/codex/fs/search", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input)
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || "无法搜索文件");
  }

  const payload = (await response.json()) as { results: MobileFileSearchResult[] };
  return payload.results;
}

export async function startFileSearchSession(roots: string[]): Promise<MobileFileSearchSessionView> {
  const response = await fetch("/api/codex/fs/search-session", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ roots })
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || "无法开始会话式文件搜索");
  }

  const payload = (await response.json()) as { session: MobileFileSearchSessionView };
  return payload.session;
}

export async function updateFileSearchSession(sessionId: string, query: string): Promise<void> {
  const response = await fetch("/api/codex/fs/search-session", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ sessionId, query })
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || "无法更新会话式文件搜索");
  }
}

export async function stopFileSearchSession(sessionId: string): Promise<void> {
  const response = await fetch("/api/codex/fs/search-session", {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ sessionId })
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || "无法停止会话式文件搜索");
  }
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

export async function startCommandExecSession(input: { command: string[]; cwd: string }): Promise<MobileTerminalSession> {
  const response = await fetch("/api/codex/command-exec/spawn", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input)
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || "无法启动 command exec 会话");
  }

  const payload = (await response.json()) as { session: MobileTerminalSession };
  return payload.session;
}

export async function writeCommandExecStdin(processId: string, text: string): Promise<void> {
  const response = await fetch(`/api/codex/command-exec/${encodeURIComponent(processId)}/stdin`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text })
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || "无法写入 command exec 输入");
  }
}

export async function resizeCommandExecSession(processId: string, cols: number, rows: number): Promise<void> {
  const response = await fetch(`/api/codex/command-exec/${encodeURIComponent(processId)}/resize`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ cols, rows })
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || "无法调整 command exec 尺寸");
  }
}

export async function readCommandExecSession(processId: string): Promise<MobileTerminalSession> {
  const response = await fetch(`/api/codex/command-exec/${encodeURIComponent(processId)}`, { cache: "no-store" });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || "无法读取 command exec 会话");
  }

  const payload = (await response.json()) as { session: MobileTerminalSession };
  return payload.session;
}

export async function terminateCommandExecSession(processId: string): Promise<void> {
  const response = await fetch(`/api/codex/command-exec/${encodeURIComponent(processId)}/terminate`, { method: "POST" });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || "无法终止 command exec 会话");
  }
}

export async function startProcessSession(input: { command: string[]; cwd: string }): Promise<MobileTerminalSession> {
  const response = await fetch("/api/codex/process/spawn", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input)
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || "无法启动终端会话");
  }

  const payload = (await response.json()) as { session: MobileTerminalSession };
  return payload.session;
}

export async function writeProcessStdin(processHandle: string, text: string): Promise<void> {
  const response = await fetch(`/api/codex/process/${encodeURIComponent(processHandle)}/stdin`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text })
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || "无法写入终端输入");
  }
}

export async function resizeProcessSession(processHandle: string, cols: number, rows: number): Promise<void> {
  const response = await fetch(`/api/codex/process/${encodeURIComponent(processHandle)}/resize`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ cols, rows })
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || "无法调整终端尺寸");
  }
}

export async function readProcessSession(processHandle: string): Promise<MobileTerminalSession> {
  const response = await fetch(`/api/codex/process/${encodeURIComponent(processHandle)}`, { cache: "no-store" });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || "无法读取终端会话");
  }

  const payload = (await response.json()) as { session: MobileTerminalSession };
  return payload.session;
}

export async function killProcessSession(processHandle: string): Promise<void> {
  const response = await fetch(`/api/codex/process/${encodeURIComponent(processHandle)}/kill`, { method: "POST" });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || "无法终止终端会话");
  }
}

export async function listThreadBackgroundTerminals(threadId: string): Promise<MobileBackgroundTerminalPage> {
  const response = await fetch(`/api/codex/threads/${encodeURIComponent(threadId)}/background-terminals`, {
    cache: "no-store"
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || "无法读取后台终端");
  }

  return response.json() as Promise<MobileBackgroundTerminalPage>;
}

export async function terminateThreadBackgroundTerminal(
  threadId: string,
  processId: string
): Promise<MobileBackgroundTerminalTerminateResult> {
  const response = await fetch(
    `/api/codex/threads/${encodeURIComponent(threadId)}/background-terminals/${encodeURIComponent(processId)}/terminate`,
    { method: "POST" }
  );
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || "无法终止后台终端");
  }

  const payload = (await response.json()) as { result: MobileBackgroundTerminalTerminateResult };
  return payload.result;
}

export async function cleanThreadBackgroundTerminals(threadId: string): Promise<void> {
  const response = await fetch(`/api/codex/threads/${encodeURIComponent(threadId)}/background-terminals/clean`, {
    method: "POST"
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || "无法清理后台终端");
  }
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
