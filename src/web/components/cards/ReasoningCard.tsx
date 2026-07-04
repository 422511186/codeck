"use client";

import type { ReasoningEntry } from "../../state/timeline";

export function ReasoningCard({ entry }: { entry: ReasoningEntry }): JSX.Element {
  return (
    <div
      role={entry.done ? undefined : "status"}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 12px",
        color: "var(--cw-fg-muted)",
        fontSize: 13,
        fontStyle: entry.done ? "normal" : "italic"
      }}
    >
      <span className={entry.done ? undefined : "cw-pulse"}>T</span>
      <span>{entry.done ? "Thinking" : "Thinking..."}</span>
    </div>
  );
}
