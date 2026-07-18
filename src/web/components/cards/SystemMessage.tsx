"use client";

import { Check, RefreshCw } from "lucide-react";
import type { SystemEntry } from "../../state/timeline";

export function SystemMessage({ entry }: { entry: SystemEntry }): JSX.Element {
  if (entry.systemKind === "context-compaction") {
    const running = entry.status === "running";
    return (
      <div
        role="status"
        data-context-compaction-status={running ? "running" : "success"}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 7,
          minWidth: 0,
          margin: "4px 0",
          padding: "2px 14px",
          color: "var(--cw-fg-muted)",
          fontSize: 13,
          lineHeight: 1.4
        }}
      >
        {running ? (
          <RefreshCw aria-hidden="true" size={14} strokeWidth={1.7} />
        ) : (
          <Check aria-hidden="true" size={14} strokeWidth={1.8} />
        )}
        <span>{entry.text}</span>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        color: "var(--cw-fg-muted)",
        fontSize: 12,
        margin: "8px 0"
      }}
    >
      <div style={{ flex: 1, height: 1, background: "var(--cw-border)" }} />
      <span>{entry.text}</span>
      <div style={{ flex: 1, height: 1, background: "var(--cw-border)" }} />
    </div>
  );
}
