import type { AppServerStatusView, MobileModelOption, MobileThreadDetail, MobileThreadPage } from "../shared/codex";
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

export async function listThreads(): Promise<MobileThreadPage> {
  const response = await fetch("/api/codex/threads", { cache: "no-store" });
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
