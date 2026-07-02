"use client";

import { useState } from "react";
import type { ToolEntry } from "../../state/timeline";
import { ImagePreviewDialog, ImageThumb } from "../ImagePreview";
import { BaseCard } from "./BaseCard";

export function ToolCard({ entry }: { entry: ToolEntry }): JSX.Element {
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const accent =
    entry.status === "failed" ? "var(--cw-danger)" : entry.status === "running" ? "var(--cw-accent)" : undefined;
  const titleText = entry.toolKind === "command" ? entry.tool : `${entry.server} · ${entry.diffPath ?? entry.tool}`;
  const showCommandCwd = entry.toolKind === "command" && isLikelyPath(entry.server);
  return (
    <>
      <BaseCard
        icon="🛠️"
        accentColor={accent}
        title={
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8, minWidth: 0, maxWidth: "100%" }}>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 13,
                minWidth: 0,
                maxWidth: "100%",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap"
              }}
            >
              {titleText}
            </span>
            {typeof entry.added === "number" ? <span style={{ color: "var(--cw-success)" }}>+{entry.added}</span> : null}
            {typeof entry.removed === "number" ? <span style={{ color: "var(--cw-danger)" }}>-{entry.removed}</span> : null}
          </span>
        }
        right={entry.status === "running" ? <span style={{ color: "var(--cw-fg-muted)" }}>运行中</span> : null}
      >
        {showCommandCwd ? (
          <div
            style={{
              color: "var(--cw-fg-muted)",
              fontSize: 12,
              paddingTop: 8,
              wordBreak: "break-word"
            }}
          >
            工作目录：<code style={{ fontFamily: "var(--font-mono)" }}>{entry.server}</code>
          </div>
        ) : null}
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

function isLikelyPath(value: string): boolean {
  return value.startsWith("/") || value.startsWith("\\\\") || /^[A-Za-z]:[\\/]/.test(value);
}
