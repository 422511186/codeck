"use client";

import type { DiffEntry } from "../../state/timeline";
import { BaseCard } from "./BaseCard";

export function DiffCard({ entry }: { entry: DiffEntry }): JSX.Element {
  return (
    <BaseCard
      icon="±"
      title={
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 13 }}>{entry.path}</span>
          <span style={{ color: "var(--cw-success)" }}>+{entry.added}</span>
          <span style={{ color: "var(--cw-danger)" }}>-{entry.removed}</span>
        </span>
      }
    >
      <pre
        style={{
          margin: 0,
          fontFamily: "var(--font-mono)",
          fontSize: 12,
          whiteSpace: "pre",
          overflowX: "auto",
          paddingTop: 8
        }}
      >
        {(entry.diff || "").split("\n").map((line, idx) => (
          <div
            key={idx}
            style={{
              color: line.startsWith("+")
                ? "var(--cw-success)"
                : line.startsWith("-")
                  ? "var(--cw-danger)"
                  : "var(--cw-fg-muted)",
              background: line.startsWith("+")
                ? "rgba(34,197,94,0.08)"
                : line.startsWith("-")
                  ? "rgba(239,68,68,0.08)"
                  : "transparent"
            }}
          >
            {line || " "}
          </div>
        ))}
      </pre>
    </BaseCard>
  );
}
