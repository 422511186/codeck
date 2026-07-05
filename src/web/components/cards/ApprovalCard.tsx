"use client";

import { useState } from "react";
import type { PendingServerRequest, PendingServerRequestOption } from "../../api/types";
import { codex } from "../../api/endpoints";

type Props = {
  approval: PendingServerRequest;
  disabled?: boolean;
  onResolved?: (value: string) => Promise<void>;
};

export function ApprovalCard({ approval, disabled, onResolved }: Props): JSX.Element {
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function resolve(value: string): Promise<void> {
    if (submitting) return;
    setSubmitting(value);
    setError(null);
    try {
      await codex.resolveRequest(approval.requestId, { value });
      if (onResolved) await onResolved(value);
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
            wordBreak: "break-word"
          }}
        >
          {summary.details}
        </pre>
      ) : null}
      {error ? <span style={{ color: "var(--cw-danger)", fontSize: 12 }}>{error}</span> : null}
      {approval.kind === "question" || approval.kind === "dynamic_tool" ? (
        <QuestionActions approval={approval} submitting={submitting} disabled={disabled} onSelect={resolve} />
      ) : (
        <ApprovalActions approval={approval} submitting={submitting} disabled={disabled} onSelect={resolve} />
      )}
    </div>
  );
}

function ApprovalActions({
  approval,
  submitting,
  disabled,
  onSelect
}: {
  approval: PendingServerRequest;
  submitting: string | null;
  disabled?: boolean;
  onSelect: (value: string) => void;
}): JSX.Element {
  const options = normalizedOptions(approval);
  const acceptValue = findOptionValue(options, ["accept", "acceptForSession"]) ?? "accept";
  const declineValue = findOptionValue(options, ["decline", "cancel"]) ?? "decline";

  return (
    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
      <button
        type="button"
        onClick={() => onSelect(declineValue)}
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
        {submitting === declineValue ? "处理中…" : "拒绝"}
      </button>
      <button
        type="button"
        onClick={() => onSelect(acceptValue)}
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
        {submitting === acceptValue ? "处理中…" : "同意"}
      </button>
    </div>
  );
}

function QuestionActions({
  approval,
  submitting,
  disabled,
  onSelect
}: {
  approval: PendingServerRequest;
  submitting: string | null;
  disabled?: boolean;
  onSelect: (value: string) => void;
}): JSX.Element {
  const options = normalizedOptions(approval);

  if (options.length === 0) {
    return (
      <div
        style={{
          padding: 10,
          border: "1px solid var(--cw-border)",
          borderRadius: 8,
          color: "var(--cw-fg-muted)",
          fontSize: 13,
          lineHeight: 1.5
        }}
      >
        当前问题没有可用选项，无法在移动端回答
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {options.map((option) => (
        <button
          key={`${option.value}:${option.label}`}
          type="button"
          onClick={() => onSelect(option.value)}
          disabled={!!submitting || disabled}
          style={{
            width: "100%",
            minHeight: 48,
            padding: "10px 12px",
            borderRadius: 8,
            border: "1px solid var(--cw-border)",
            background: "var(--cw-bg-elevated)",
            color: "var(--cw-fg)",
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            gap: 4,
            textAlign: "left",
            fontSize: 14,
            lineHeight: 1.35
          }}
        >
          <span style={{ fontWeight: 600 }}>{submitting === option.value ? "处理中…" : option.label}</span>
          {option.description ? (
            <span style={{ color: "var(--cw-fg-muted)", fontSize: 12 }}>{option.description}</span>
          ) : null}
        </button>
      ))}
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
        details: fileApprovalDetails(req)
      };
    case "permissions_approval":
      return {
        title: "提升权限",
        details: typeof req.reason === "string" ? req.reason : JSON.stringify(req)
      };
    case "question":
      return {
        title: a.title || "需要你回答",
        details: questionText(a, req)
      };
    case "mcp_elicitation":
      return { title: "MCP 工具请求确认", details: a.description || JSON.stringify(req, null, 2) };
    case "dynamic_tool":
      return { title: "动态工具请求确认", details: a.description || JSON.stringify(req, null, 2) };
    default:
      return { title: "请求授权", details: a.description || JSON.stringify(req, null, 2) };
  }
}

function fileApprovalDetails(req: Record<string, unknown>): string {
  const path = typeof req.path === "string" ? req.path : null;
  const diff = firstStringField(req, ["diff", "patch", "changes", "fileChanges"]);
  if (path && diff) {
    return `${path}\n\n${diff}`;
  }
  if (path) {
    return path;
  }
  if (diff) {
    return diff;
  }
  return JSON.stringify(req);
}

function firstStringField(req: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = req[key];
    if (typeof value === "string" && value) {
      return value;
    }
  }
  return null;
}

function questionText(a: PendingServerRequest, req: Record<string, unknown>): string {
  if (typeof a.description === "string" && a.description) return a.description;
  if (typeof req.question === "string" && req.question) return req.question;
  const questions = Array.isArray(req.questions) ? req.questions : [];
  const firstQuestion = questions[0];
  if (typeof firstQuestion === "object" && firstQuestion !== null) {
    const text = (firstQuestion as Record<string, unknown>).question;
    if (typeof text === "string" && text) return text;
  }
  return "Codex 需要你提供更多信息";
}

function normalizedOptions(approval: PendingServerRequest): PendingServerRequestOption[] {
  const rawOptions =
    approval.options ??
    (Array.isArray(approval.request?.options) ? approval.request.options : []);

  return rawOptions
    .map((option) => {
      if (typeof option !== "object" || option === null) return null;
      const record = option as Record<string, unknown>;
      const label = typeof record.label === "string" ? record.label : "";
      const value = typeof record.value === "string" ? record.value : label;
      if (!value || !label) return null;
      const description = typeof record.description === "string" ? record.description : undefined;
      return { value, label, ...(description ? { description } : {}) };
    })
    .filter((option): option is PendingServerRequestOption => option !== null);
}

function findOptionValue(options: PendingServerRequestOption[], values: string[]): string | null {
  return options.find((option) => values.includes(option.value))?.value ?? null;
}
