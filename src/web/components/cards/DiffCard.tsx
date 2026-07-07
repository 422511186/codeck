"use client";

import type { DiffEntry } from "../../state/timeline";
import { BaseCard } from "./BaseCard";
import { createTextPreview, TruncationFooter } from "./LongTextPreview";

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
      maxBodyHeight={520}
    >
      <DiffView diff={entry.diff || ""} />
    </BaseCard>
  );
}

export function DiffView({
  diff,
  copyLabel = "复制完整 diff",
  maxLines = 120,
  maxChars = 20_000
}: {
  diff: string;
  copyLabel?: string;
  maxLines?: number;
  maxChars?: number;
}): JSX.Element {
  const preview = createTextPreview(diff, { maxLines, maxChars });
  const rows = parseUnifiedDiff(preview.preview);
  const gutterWidth = lineNumberGutterWidth(rows);
  const gridTemplateColumns = `${gutterWidth}px ${gutterWidth}px 18px minmax(0, 1fr)`;

  return (
    <>
      <div
        style={{
          marginTop: 10,
          border: "1px solid var(--cw-border)",
          borderRadius: 8,
          overflowX: "auto",
          background: "var(--cw-bg-elevated)"
        }}
      >
        <div style={{ minWidth: 520, fontFamily: "var(--font-mono)", fontSize: 12, lineHeight: 1.65 }}>
          {rows.map((row, idx) => (
            <DiffRow key={`${idx}-${row.text}`} row={row} gridTemplateColumns={gridTemplateColumns} />
          ))}
        </div>
      </div>
      {preview.truncated ? <TruncationFooter text={diff} copyLabel={copyLabel} omittedLines={preview.omittedLines} /> : null}
    </>
  );
}

type DiffRow =
  | { kind: "file"; text: string }
  | { kind: "hunk"; text: string }
  | { kind: "context" | "add" | "remove"; oldLine: number | null; newLine: number | null; marker: string; text: string };

function DiffRow({ row, gridTemplateColumns }: { row: DiffRow; gridTemplateColumns: string }): JSX.Element {
  if (row.kind === "file" || row.kind === "hunk") {
    return (
      <div
        style={{
          display: "grid",
          gridTemplateColumns,
          borderBottom: "1px solid var(--cw-border)",
          background: row.kind === "hunk" ? "rgba(59,130,246,0.10)" : "var(--cw-card)",
          color: row.kind === "hunk" ? "var(--cw-accent)" : "var(--cw-fg-muted)"
        }}
      >
        <span style={gutterStyle} />
        <span style={gutterStyle} />
        <span style={markerStyle}>{row.kind === "hunk" ? "@" : ""}</span>
        <span style={codeStyle}>{row.text || " "}</span>
      </div>
    );
  }

  const isAdd = row.kind === "add";
  const isRemove = row.kind === "remove";
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns,
        background: isAdd ? "rgba(34,197,94,0.12)" : isRemove ? "rgba(239,68,68,0.12)" : "transparent"
      }}
    >
      <span style={gutterStyle}>{row.oldLine ?? ""}</span>
      <span style={gutterStyle}>{row.newLine ?? ""}</span>
      <span style={{ ...markerStyle, color: isAdd ? "var(--cw-success)" : isRemove ? "var(--cw-danger)" : "var(--cw-fg-muted)" }}>
        {row.marker}
      </span>
      <span style={{ ...codeStyle, color: isAdd ? "var(--cw-success)" : isRemove ? "var(--cw-danger)" : "var(--cw-fg)" }}>
        {row.text || " "}
      </span>
    </div>
  );
}

function lineNumberGutterWidth(rows: DiffRow[]): number {
  const maxLine = rows.reduce((max, row) => {
    if (row.kind === "file" || row.kind === "hunk") {
      return max;
    }
    return Math.max(max, row.oldLine ?? 0, row.newLine ?? 0);
  }, 0);
  const digits = Math.max(2, String(maxLine || 0).length);
  return Math.max(28, Math.min(44, digits * 8 + 12));
}

function parseUnifiedDiff(diff: string): DiffRow[] {
  const rows: DiffRow[] = [];
  let oldLine: number | null = null;
  let newLine: number | null = null;

  for (const line of diff.split("\n")) {
    const hunk = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line);
    if (hunk) {
      oldLine = Number(hunk[1]);
      newLine = Number(hunk[2]);
      rows.push({ kind: "hunk", text: line });
      continue;
    }

    if (line.startsWith("--- ") || line.startsWith("+++ ") || line.startsWith("diff --git ") || line.startsWith("index ")) {
      rows.push({ kind: "file", text: line });
      continue;
    }

    if (line.startsWith("+") && oldLine !== null && newLine !== null) {
      rows.push({ kind: "add", oldLine: null, newLine, marker: "+", text: line.slice(1) });
      newLine += 1;
      continue;
    }

    if (line.startsWith("-") && oldLine !== null && newLine !== null) {
      rows.push({ kind: "remove", oldLine, newLine: null, marker: "-", text: line.slice(1) });
      oldLine += 1;
      continue;
    }

    if (oldLine !== null && newLine !== null) {
      rows.push({ kind: "context", oldLine, newLine, marker: " ", text: line.startsWith(" ") ? line.slice(1) : line });
      oldLine += 1;
      newLine += 1;
      continue;
    }

    rows.push({ kind: "file", text: line });
  }

  return rows.length ? rows : [{ kind: "file", text: "" }];
}

const gutterStyle: React.CSSProperties = {
  boxSizing: "border-box",
  padding: "0 6px",
  borderRight: "1px solid var(--cw-border)",
  color: "var(--cw-fg-subtle)",
  textAlign: "right",
  userSelect: "none",
  background: "rgba(0,0,0,0.08)"
};

const markerStyle: React.CSSProperties = {
  boxSizing: "border-box",
  padding: "0 4px",
  textAlign: "center",
  userSelect: "none"
};

const codeStyle: React.CSSProperties = {
  padding: "0 10px",
  whiteSpace: "pre",
  overflow: "hidden"
};
