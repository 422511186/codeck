import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { appendAuditEvent } from "../../src/server/audit-log";

describe("audit-log", () => {
  it("以 JSONL 追加审计事件并脱敏敏感字段", async () => {
    const dir = await mkdtemp(join(tmpdir(), "codex-web-audit-"));
    const auditLogPath = join(dir, "audit.jsonl");

    await appendAuditEvent(auditLogPath, {
      action: "terminal.exec",
      actor: "mobile-web",
      detail: {
        command: ["npm", "test"],
        token: "sk-secret",
        appServerUrl: "ws://127.0.0.1:31317"
      }
    });
    await appendAuditEvent(auditLogPath, {
      action: "request.resolve",
      actor: "mobile-web",
      detail: { requestId: 1, decision: "accept" }
    });

    const lines = (await readFile(auditLogPath, "utf8")).trim().split("\n");
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0])).toMatchObject({
      action: "terminal.exec",
      actor: "mobile-web",
      detail: {
        command: ["npm", "test"],
        token: "[redacted]",
        appServerUrl: "[redacted]"
      }
    });
    expect(JSON.parse(lines[0]).at).toEqual(expect.any(String));
    expect(lines.join("\n")).not.toContain("sk-secret");
    expect(lines.join("\n")).not.toContain("ws://127.0.0.1:31317");
  });
});
