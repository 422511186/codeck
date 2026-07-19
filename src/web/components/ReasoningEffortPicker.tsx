"use client";

import { useMemo, useState } from "react";
import { Check, X } from "lucide-react";
import type { ThreadModelStateView } from "../../shared/custom-models";

export function ReasoningEffortPicker({
  current,
  onSelect,
  onClose
}: {
  current: ThreadModelStateView;
  onSelect: (effort: string) => void | Promise<void>;
  onClose: () => void;
}): JSX.Element {
  const [pending, setPending] = useState(false);
  const efforts = useMemo(
    () => Array.from(new Set([
      ...current.supportedReasoningEfforts,
      ...(current.reasoningEffort ? [current.reasoningEffort] : [])
    ])),
    [current.supportedReasoningEfforts, current.reasoningEffort]
  );

  async function select(effort: string): Promise<void> {
    if (pending || effort === current.reasoningEffort) return;
    setPending(true);
    try {
      await onSelect(effort);
      onClose();
    } finally {
      setPending(false);
    }
  }

  return (
    <div style={overlayStyle} role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section role="dialog" aria-label="选择推理强度" aria-modal="true" style={sheetStyle}>
        <header style={headerStyle}>
          <div>
            <div style={titleStyle}>推理强度</div>
            <div style={subtitleStyle}>{current.label || current.model}</div>
          </div>
          <button type="button" aria-label="关闭推理强度选择器" onClick={onClose} style={iconButtonStyle}>
            <X size={20} />
          </button>
        </header>
        <div style={contentStyle}>
          {efforts.length === 0 ? (
            <div role="status" style={emptyStyle}>当前模型不支持独立推理强度</div>
          ) : efforts.map((effort) => {
            const active = effort === current.reasoningEffort;
            return (
              <button
                key={effort}
                type="button"
                aria-label={reasoningEffortLabel(effort)}
                aria-pressed={active}
                disabled={pending || active}
                onClick={() => void select(effort)}
                style={optionStyle(active)}
              >
                <span>{reasoningEffortLabel(effort)}</span>
                <span style={rawValueStyle}>{effort}</span>
                {active ? <Check size={18} aria-hidden="true" /> : null}
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function reasoningEffortLabel(value: string): string {
  const known: Record<string, string> = {
    minimal: "Minimal",
    low: "Low",
    medium: "Medium",
    high: "High",
    xhigh: "Xhigh"
  };
  return known[value] ?? value;
}

const overlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 100,
  display: "flex",
  alignItems: "flex-end",
  justifyContent: "center",
  background: "rgba(0, 0, 0, 0.46)"
};
const sheetStyle: React.CSSProperties = {
  width: "100%",
  maxHeight: "70dvh",
  display: "flex",
  flexDirection: "column",
  background: "var(--cw-bg)",
  border: "1px solid var(--cw-border)",
  borderBottom: "none",
  borderRadius: "16px 16px 0 0",
  paddingBottom: "var(--safe-bottom)"
};
const headerStyle: React.CSSProperties = { minHeight: 58, padding: "8px 12px 6px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" };
const titleStyle: React.CSSProperties = { fontSize: 17, fontWeight: 650 };
const subtitleStyle: React.CSSProperties = { marginTop: 3, color: "var(--cw-fg-muted)", fontSize: 12 };
const iconButtonStyle: React.CSSProperties = { width: 40, height: 40, border: "none", background: "transparent", color: "var(--cw-fg)", display: "grid", placeItems: "center" };
const contentStyle: React.CSSProperties = { overflowY: "auto", padding: "4px 12px 16px" };
const optionStyle = (active: boolean): React.CSSProperties => ({ minHeight: 52, width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", border: "1px solid var(--cw-border)", borderRadius: 8, marginTop: 8, background: active ? "color-mix(in srgb, var(--cw-accent) 12%, var(--cw-bg))" : "transparent", color: "var(--cw-fg)", textAlign: "left", fontSize: 15 });
const rawValueStyle: React.CSSProperties = { flex: 1, color: "var(--cw-fg-muted)", fontSize: 12 };
const emptyStyle: React.CSSProperties = { padding: "28px 12px", color: "var(--cw-fg-muted)", textAlign: "center", fontSize: 14 };
