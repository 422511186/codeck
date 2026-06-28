"use client";

import { useState } from "react";
import type { ToolEntry } from "../../state/timeline";
import { ImagePreviewDialog, ImageThumb } from "../ImagePreview";
import { BaseCard } from "./BaseCard";

export function ToolCard({ entry }: { entry: ToolEntry }): JSX.Element {
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const accent =
    entry.status === "failed" ? "var(--cw-danger)" : entry.status === "running" ? "var(--cw-accent)" : undefined;
  return (
    <>
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
        {entry.imagePaths?.length ? (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
            {entry.imagePaths.map((src) => (
              <ImageThumb key={src} src={src} label="工具图片预览" onPreview={setPreviewSrc} />
            ))}
          </div>
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
      {previewSrc ? <ImagePreviewDialog src={previewSrc} onClose={() => setPreviewSrc(null)} /> : null}
    </>
  );
}
