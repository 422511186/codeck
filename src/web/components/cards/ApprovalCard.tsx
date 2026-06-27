"use client";

import { useState } from "react";
import type { PendingServerRequest } from "../../api/types";
import { codex } from "../../api/endpoints";

type Props = {
  approval: PendingServerRequest;
  disabled?: boolean;
  onResolved?: (decision: string) => Promise<void>;
};

export function ApprovalCard({ approval, disabled, onResolved }: Props): JSX.Element {
  const [submitting, setSubmitting] = useState<"approve" | "deny" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function resolve(decision: "approve" | "deny"): Promise<void> {
    if (submitting) return;
    setSubmitting(decision);
    setError(null);
    try {
      await codex.resolveRequest(approval.requestId, { decision });
      if (onResolved) await onResolved(decision);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(null);
    }
  }

  const summary = describeApproval(approval);

  return (
    <div
      style={{
        border: "1px solid var(--cw-border)",
        borderRadius: 12,
        padding: 12,
        background: "var(--cw-card)",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        opacity: disabled ? 0.5 : 1,
        pointerEvents: disabled ? "none" : "auto"
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span aria-hidden>⚠️</span>
        <span style={{ fontWeight: 600, fontSize: 14 }}>{summary.title}</span>
      </div>
      {summary.details ? (
        <pre
          style={{
            margin: 0,
            padding: 8,
            background: "var(--cw-bg-elevated)",
            borderRadius: 8,
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            whiteSpace: "pre-wrap",
            wordBreak: "break-all"
          }}
        >
          {summary.details}
        </pre>
      ) : null}
      {error ? <span style={{ color: "var(--cw-danger)", fontSize: 12 }}>{error}</span> : null}
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button
          type="button"
          onClick={() => resolve("deny")}
          disabled={!!submitting || disabled}
          style={{
            padding: "8px 14px",
            borderRadius: 10,
            border: "1px solid var(--cw-border)",
            background: "transparent",
            color: "var(--cw-fg)",
            fontSize: 14
          }}
        >
          {submitting === "deny" ? "处理中…" : "拒绝"}
        </button>
        <button
          type="button"
          onClick={() => resolve("approve")}
          disabled={!!submitting || disabled}
          style={{
            padding: "8px 14px",
            borderRadius: 10,
            border: "none",
            background: "var(--cw-accent)",
            color: "var(--cw-accent-fg)",
            fontSize: 14
          }}
        >
          {submitting === "approve" ? "处理中…" : "同意"}
        </button>
      </div>
    </div>
  );
}

function describeApproval(a: PendingServerRequest): { title: string; details?: string } {
  const req = (a.request ?? {}) as Record<string, unknown>;
  switch (a.kind) {
    case "command_approval":
      return {
        title: "执行命令需要授权",
        details: typeof req.command === "string" ? req.command : JSON.stringify(req.command ?? req)
      };
    case "file_approval":
      return {
        title: "写入文件需要授权",
        details: typeof req.path === "string" ? req.path : JSON.stringify(req)
      };
    case "permissions_approval":
      return {
        title: "提升权限",
        details: typeof req.reason === "string" ? req.reason : JSON.stringify(req)
      };
    case "question":
      return {
        title: typeof req.question === "string" ? req.question : "需要回答",
        details: undefined
      };
    case "mcp_elicitation":
      return { title: "MCP 工具请求确认", details: JSON.stringify(req, null, 2) };
    case "dynamic_tool":
      return { title: "动态工具请求确认", details: JSON.stringify(req, null, 2) };
    default:
      return { title: "请求授权", details: JSON.stringify(req, null, 2) };
  }
}
