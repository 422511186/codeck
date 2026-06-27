"use client";

import type { SystemEntry } from "../../state/timeline";

export function SystemMessage({ entry }: { entry: SystemEntry }): JSX.Element {
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
