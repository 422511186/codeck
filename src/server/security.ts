import { lstat, realpath } from "node:fs/promises";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { appendAuditEvent } from "./audit-log";
import { getRuntimeConfig } from "./runtime";
import { assertPathAllowed, assertWorkspaceRootsAllowed, normalizeWorkspaceRoots, type WorkspaceRoot } from "./workspace-policy";

export function getAllowedWorkspaceRoots(extraRoots: string[] = []): WorkspaceRoot[] {
  const config = getRuntimeConfig();
  return normalizeWorkspaceRoots([...config.workspaceRoots, ...extraRoots]);
}

export function assertRuntimePathAllowed(candidatePath: string, extraRoots: string[] = []): string {
  return assertPathAllowed(candidatePath, getAllowedWorkspaceRoots(extraRoots));
}

export function assertRuntimeSessionRolloutPathAllowed(candidatePath: string): string {
  const configuredCodexHome = process.env.CODEX_HOME?.trim();
  const codexHome = configuredCodexHome || resolve(homedir(), ".codex");
  const allowedPath = assertRuntimePathAllowed(candidatePath, [resolve(codexHome, "sessions")]);
  if (!/\.jsonl$/i.test(allowedPath)) {
    throw new Error("会话历史路径必须是 JSONL 文件");
  }
  return allowedPath;
}

export async function assertRuntimeSessionRolloutFileAllowed(candidatePath: string): Promise<string> {
  const configuredCodexHome = process.env.CODEX_HOME?.trim();
  const sessionsRoot = resolve(configuredCodexHome || resolve(homedir(), ".codex"), "sessions");
  const lexicalPath = assertRuntimeSessionRolloutPathAllowed(candidatePath);
  const [canonicalRoot, candidateInfo] = await Promise.all([realpath(sessionsRoot), lstat(lexicalPath)]);
  if (candidateInfo.isSymbolicLink()) {
    throw new Error("会话历史路径不在允许的 sessions 目录内");
  }

  const canonicalPath = await realpath(lexicalPath);
  let allowedPath: string;
  try {
    allowedPath = assertPathAllowed(canonicalPath, normalizeWorkspaceRoots([canonicalRoot]));
  } catch {
    throw new Error("会话历史路径不在允许的 sessions 目录内");
  }
  const canonicalInfo = await lstat(allowedPath);
  if (!canonicalInfo.isFile()) {
    throw new Error("会话历史路径必须是普通 JSONL 文件");
  }
  return allowedPath;
}

export function assertRuntimeWorkspaceRootsAllowed(candidateRoots: string[] | undefined): string[] | undefined {
  return assertWorkspaceRootsAllowed(candidateRoots, getAllowedWorkspaceRoots());
}

export async function audit(action: string, detail?: unknown): Promise<void> {
  await appendAuditEvent(getRuntimeConfig().auditLogPath, {
    action,
    actor: "mobile-web",
    detail
  });
}
