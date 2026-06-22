import type { AppServerStatusView, MobileModelOption, MobileThreadPage } from "../shared/codex";

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
