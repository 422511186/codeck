"use client";

import { useState } from "react";

export type PlanStep = { text: string; completed: boolean };

export function PlanBar({ steps }: { steps: PlanStep[] }): JSX.Element | null {
  const [collapsed, setCollapsed] = useState(false);
  if (!steps || steps.length === 0) return null;
  const doneCount = steps.filter((s) => s.completed).length;

  return (
    <div
      style={{
        position: "sticky",
        top: "var(--header-height)",
        zIndex: 5,
        background: "var(--cw-bg-elevated)",
        borderBottom: "1px solid var(--cw-border)",
        padding: "8px 14px"
      }}
    >
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        style={{
          width: "100%",
          background: "transparent",
          border: "none",
          padding: 0,
          color: "var(--cw-fg)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: 13
        }}
      >
        <span style={{ fontWeight: 600 }}>
          计划 ({doneCount}/{steps.length})
        </span>
        <span aria-hidden style={{ color: "var(--cw-fg-muted)" }}>{collapsed ? "▾" : "▴"}</span>
      </button>
      {collapsed ? null : (
        <ol style={{ margin: "6px 0 0", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 4 }}>
          {steps.map((s, i) => (
            <li
              key={i}
              style={{
                fontSize: 13,
                color: s.completed ? "var(--cw-fg-subtle)" : "var(--cw-fg)",
                textDecoration: s.completed ? "line-through" : "none",
                display: "flex",
                alignItems: "flex-start",
                gap: 6
              }}
            >
              <span aria-hidden>{s.completed ? "✓" : "•"}</span>
              <span style={{ flex: 1 }}>{s.text}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
