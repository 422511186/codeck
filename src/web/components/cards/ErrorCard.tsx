"use client";

import { BaseCard } from "./BaseCard";

export function ErrorCard({ text }: { text: string }): JSX.Element {
  return (
    <BaseCard
      title="出错了"
      summary={text.slice(0, 80)}
      icon="⚠️"
      tone="danger"
    >
      <pre
        style={{
          margin: 0,
          padding: 10,
          background: "var(--cw-danger-bg)",
          color: "var(--cw-danger)",
          borderRadius: 8,
          fontFamily: "var(--font-mono)",
          fontSize: 12,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word"
        }}
      >
        {text}
      </pre>
    </BaseCard>
  );
}
