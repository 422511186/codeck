import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";

export type AuditEventInput = {
  action: string;
  actor: string;
  detail?: unknown;
};

const sensitiveKeyPattern = /(token|secret|password|url)/i;

function redact(value: unknown, key = ""): unknown {
  if (sensitiveKeyPattern.test(key)) {
    return "[redacted]";
  }

  if (Array.isArray(value)) {
    return value.map((item) => redact(item));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([entryKey, entryValue]) => [entryKey, redact(entryValue, entryKey)]));
  }

  return value;
}

export async function appendAuditEvent(auditLogPath: string, event: AuditEventInput): Promise<void> {
  await mkdir(path.dirname(auditLogPath), { recursive: true });
  const record = {
    at: new Date().toISOString(),
    action: event.action,
    actor: event.actor,
    detail: redact(event.detail)
  };

  await appendFile(auditLogPath, `${JSON.stringify(record)}\n`, "utf8");
}
