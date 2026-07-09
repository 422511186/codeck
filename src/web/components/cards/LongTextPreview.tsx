"use client";

import { useMemo } from "react";

export const DEFAULT_PREVIEW_LINES = 120;
export const DEFAULT_PREVIEW_CHARS = 12_000;
const TEXT_PREVIEW_CACHE_LIMIT = 160;

export type TextPreview = {
  preview: string;
  truncated: boolean;
  omittedLines: number;
};

type TextPreviewOptions = {
  maxLines?: number;
  maxChars?: number;
  cacheKey?: string;
};

type TextPreviewDiagnostics = {
  previewRuns: number;
};

const textPreviewDiagnostics: TextPreviewDiagnostics = {
  previewRuns: 0
};
const textPreviewCache = new Map<string, TextPreview>();

export function __getTextPreviewDiagnostics(): TextPreviewDiagnostics {
  return { ...textPreviewDiagnostics };
}

export function __resetTextPreviewDiagnostics(): void {
  textPreviewDiagnostics.previewRuns = 0;
}

export function createTextPreview(
  text: string,
  options: TextPreviewOptions = {}
): TextPreview {
  const maxLines = options.maxLines ?? DEFAULT_PREVIEW_LINES;
  const maxChars = options.maxChars ?? DEFAULT_PREVIEW_CHARS;
  const cacheKey = textPreviewCacheKey(text, maxLines, maxChars, options.cacheKey);
  const cached = textPreviewCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  textPreviewDiagnostics.previewRuns += 1;
  const preview = deriveTextPreview(text, maxLines, maxChars);
  rememberTextPreview(cacheKey, preview);
  return preview;
}

function deriveTextPreview(text: string, maxLines: number, maxChars: number): TextPreview {
  if (!text) {
    return { preview: "", truncated: false, omittedLines: 0 };
  }

  const lineLimit = Math.max(1, maxLines);
  const charLimit = Math.max(1, maxChars);
  let linesSeen = 1;
  let previewEnd = Math.min(text.length, charLimit);
  let lineLimitEnd: number | null = null;

  for (let index = 0; index < text.length; index += 1) {
    if (text.charCodeAt(index) !== 10) {
      continue;
    }
    linesSeen += 1;
    if (lineLimitEnd === null && linesSeen > lineLimit) {
      lineLimitEnd = text.charCodeAt(index - 1) === 13 ? index - 1 : index;
    }
  }

  if (lineLimitEnd !== null) {
    previewEnd = Math.min(previewEnd, lineLimitEnd);
  }

  const preview = text.slice(0, previewEnd);
  const truncated = previewEnd < text.length;
  const omittedLines = Math.max(0, linesSeen - lineLimit);
  return { preview, truncated, omittedLines };
}

export function textDerivationSignature(text: string): string {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${text.length}:${hash >>> 0}`;
}

function textPreviewCacheKey(text: string, maxLines: number, maxChars: number, cacheKey?: string): string {
  return `${cacheKey ?? "text"}\u0000${maxLines}\u0000${maxChars}\u0000${textDerivationSignature(text)}`;
}

function rememberTextPreview(key: string, preview: TextPreview): void {
  textPreviewCache.set(key, preview);
  if (textPreviewCache.size <= TEXT_PREVIEW_CACHE_LIMIT) {
    return;
  }
  const oldestKey = textPreviewCache.keys().next().value;
  if (oldestKey) {
    textPreviewCache.delete(oldestKey);
  }
}

export function LongTextPreview({
  text,
  emptyText = "（无内容）",
  copyLabel,
  maxLines,
  maxChars,
  cacheKey
}: {
  text: string;
  emptyText?: string;
  copyLabel: string;
  maxLines?: number;
  maxChars?: number;
  cacheKey?: string;
}): JSX.Element {
  const preview = useMemo(
    () => createTextPreview(text, { maxLines, maxChars, cacheKey }),
    [cacheKey, maxChars, maxLines, text]
  );
  return (
    <>
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
        {preview.preview || emptyText}
      </pre>
      {preview.truncated ? <TruncationFooter text={text} copyLabel={copyLabel} omittedLines={preview.omittedLines} /> : null}
    </>
  );
}

export function TruncationFooter({
  text,
  copyLabel,
  omittedLines
}: {
  text: string;
  copyLabel: string;
  omittedLines: number;
}): JSX.Element {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, paddingTop: 8 }}>
      <span style={{ color: "var(--cw-fg-subtle)", fontSize: 12 }}>
        已截断{omittedLines > 0 ? `，还有 ${omittedLines} 行` : ""}
      </span>
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard?.writeText(text);
        }}
        style={{
          border: "1px solid var(--cw-border)",
          borderRadius: 8,
          background: "transparent",
          color: "var(--cw-fg)",
          padding: "5px 8px",
          fontSize: 12
        }}
      >
        {copyLabel}
      </button>
    </div>
  );
}
