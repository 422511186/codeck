"use client";

import { CircleAlert } from "lucide-react";

export function ErrorCard({ text }: { text: string }): JSX.Element {
  return (
    <div
      role="alert"
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 8,
        minWidth: 0,
        margin: "4px 0",
        padding: "9px 10px",
        borderLeft: "3px solid var(--cw-danger)",
        borderRadius: 6,
        background: "var(--cw-danger-bg)",
        color: "var(--cw-fg)",
        fontSize: 13,
        lineHeight: 1.45
      }}
    >
      <CircleAlert
        aria-hidden="true"
        size={16}
        strokeWidth={1.8}
        style={{ flex: "0 0 auto", marginTop: 1, color: "var(--cw-danger)" }}
      />
      <div style={{ minWidth: 0 }}>
        <div style={{ marginBottom: 2, color: "var(--cw-danger)", fontWeight: 600 }}>
          操作失败
        </div>
        <div style={{ overflowWrap: "anywhere", whiteSpace: "pre-wrap" }}>{text}</div>
      </div>
    </div>
  );
}
