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
