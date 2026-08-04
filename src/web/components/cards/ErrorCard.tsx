"use client";

import { CircleAlert, CircleCheck, RefreshCw } from "lucide-react";

type ErrorStatus = "failed" | "success" | "retrying" | "cancelled" | "interrupted";

export function ErrorCard({ text, status = "failed" }: { text: string; status?: ErrorStatus }): JSX.Element {
  const isRetrying = status === "retrying";
  const isRecovered = status === "success";
  const isStopped = status === "cancelled" || status === "interrupted";
  const color = isRecovered ? "var(--cw-success)" : isRetrying ? "var(--cw-warning)" : isStopped ? "var(--cw-fg-muted)" : "var(--cw-danger)";
  const title = isRecovered ? "已恢复" : isRetrying ? "正在重试" : status === "cancelled" ? "已取消" : status === "interrupted" ? "已中断" : "操作失败";
  const Icon = isRecovered ? CircleCheck : isRetrying ? RefreshCw : CircleAlert;
  return (
    <div
      role={status === "failed" ? "alert" : "status"}
      data-error-status={status}
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 8,
        minWidth: 0,
        margin: "4px 0",
        padding: "9px 10px",
        borderLeft: `3px solid ${color}`,
        borderRadius: 6,
        background: isRetrying ? "var(--cw-warning-bg)" : isRecovered || isStopped ? "var(--cw-bg-elevated)" : "var(--cw-danger-bg)",
        color: "var(--cw-fg)",
        fontSize: 13,
        lineHeight: 1.45
      }}
    >
      <Icon
        aria-hidden="true"
        size={16}
        strokeWidth={1.8}
        style={{ flex: "0 0 auto", marginTop: 1, color }}
      />
      <div style={{ minWidth: 0 }}>
        <div style={{ marginBottom: 2, color, fontWeight: 600 }}>
          {title}
        </div>
        <div style={{ overflowWrap: "anywhere", whiteSpace: "pre-wrap" }}>{text}</div>
      </div>
    </div>
  );
}
