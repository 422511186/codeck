"use client";

export const DEFAULT_PREVIEW_LINES = 120;
export const DEFAULT_PREVIEW_CHARS = 12_000;

export type TextPreview = {
  preview: string;
  truncated: boolean;
  omittedLines: number;
};

export function createTextPreview(
  text: string,
  options: { maxLines?: number; maxChars?: number } = {}
): TextPreview {
  const maxLines = options.maxLines ?? DEFAULT_PREVIEW_LINES;
  const maxChars = options.maxChars ?? DEFAULT_PREVIEW_CHARS;
  const lines = text.split(/\r?\n/);
  const omittedLines = Math.max(0, lines.length - maxLines);
  let preview = omittedLines > 0 ? lines.slice(0, maxLines).join("\n") : text;
  let truncated = omittedLines > 0;

  if (preview.length > maxChars) {
    preview = preview.slice(0, maxChars);
    truncated = true;
  }

  return { preview, truncated, omittedLines };
}

export function LongTextPreview({
  text,
  emptyText = "（无内容）",
  copyLabel,
  maxLines,
  maxChars
}: {
  text: string;
  emptyText?: string;
  copyLabel: string;
  maxLines?: number;
  maxChars?: number;
}): JSX.Element {
  const preview = createTextPreview(text, { maxLines, maxChars });
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
