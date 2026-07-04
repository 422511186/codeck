"use client";

import type { ReasoningEntry } from "../../state/timeline";
import { BaseCard } from "./BaseCard";
import { LongTextPreview } from "./LongTextPreview";

export function ReasoningCard({ entry }: { entry: ReasoningEntry }): JSX.Element {
  if (!entry.done) {
    if (entry.text.trim()) {
      const preview = entry.text.split("\n")[0]?.slice(0, 60) || "思考中…";
      return (
        <BaseCard
          icon={<span className="cw-pulse">●</span>}
          title={<span>思考中… {preview}</span>}
          status="running"
        >
          <LongTextPreview text={entry.text} copyLabel="复制完整推理" maxLines={80} />
        </BaseCard>
      );
    }

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
    <BaseCard
      icon="🧠"
      title={<span>推理过程</span>}
      right={
        preview !== "推理过程" ? (
          <span
            style={{
              maxWidth: "56%",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              color: "var(--cw-fg-muted)",
              fontSize: 12
            }}
          >
            {preview}
          </span>
        ) : null
      }
    >
      <LongTextPreview text={entry.text} copyLabel="复制完整推理" maxLines={80} />
    </BaseCard>
  );
}
