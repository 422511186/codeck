"use client";

import type { ToolEntry } from "../../state/timeline";
import { BaseCard } from "./BaseCard";

export function ToolCard({ entry }: { entry: ToolEntry }): JSX.Element {
  const accent =
    entry.status === "failed" ? "var(--cw-danger)" : entry.status === "running" ? "var(--cw-accent)" : undefined;
  return (
    <BaseCard
      icon="🛠️"
      accentColor={accent}
      title={
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 13 }}>
          {entry.server} · {entry.tool}
        </span>
      }
      right={entry.status === "running" ? <span style={{ color: "var(--cw-fg-muted)" }}>运行中</span> : null}
    >
      {entry.arguments ? (
        <pre
          style={{
            background: "var(--cw-bg-elevated)",
            padding: 8,
            borderRadius: 8,
            fontSize: 12,
            overflowX: "auto",
            maxHeight: 200,
            margin: 0
          }}
        >
          {entry.arguments}
        </pre>
      ) : null}
      {entry.result ? (
        <pre
          style={{
            background: "var(--cw-bg-elevated)",
            padding: 8,
            borderRadius: 8,
            fontSize: 12,
            overflowX: "auto",
            maxHeight: 240,
            margin: "8px 0 0"
          }}
        >
          {entry.result}
        </pre>
      ) : null}
    </BaseCard>
  );
}
