"use client";

import type { CommandEntry } from "../../state/timeline";
import { BaseCard } from "./BaseCard";

export function CommandCard({ entry }: { entry: CommandEntry }): JSX.Element {
  return (
    <BaseCard
      icon="$"
      title={<code style={{ fontFamily: "var(--font-mono)" }}>{entry.command}</code>}
      status={entry.status}
    >
      <pre
        style={{
          margin: 0,
          padding: "10px 0",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          fontFamily: "var(--font-mono)",
          fontSize: 12,
          color: "var(--cw-fg-muted)"
        }}
      >
        {entry.output || "（无输出）"}
      </pre>
    </BaseCard>
  );
}
