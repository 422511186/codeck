"use client";

import type { ReasoningEntry } from "../../state/timeline";
import { BaseCard } from "./BaseCard";

export function ReasoningCard({ entry }: { entry: ReasoningEntry }): JSX.Element {
  if (!entry.done) {
    return (
      <div
        role="status"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 12px",
          color: "var(--cw-fg-muted)",
          fontSize: 13,
          fontStyle: "italic"
        }}
      >
        <span className="cw-pulse">●</span>
        <span>思考中…</span>
      </div>
    );
  }
  const preview = entry.text.split("\n")[0]?.slice(0, 60) || "推理过程";
  return (
    <BaseCard icon="🧠" title={<span>{preview}</span>}>
      <div style={{ whiteSpace: "pre-wrap", color: "var(--cw-fg-muted)", fontSize: 13, paddingTop: 6 }}>
        {entry.text}
      </div>
    </BaseCard>
  );
}
