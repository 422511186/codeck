"use client";

import { useState, type ReactNode } from "react";

export type BaseCardProps = {
  icon?: ReactNode;
  title: ReactNode;
  summary?: string;
  status?: "running" | "success" | "failed";
  tone?: "danger" | "warning" | "info";
  accentColor?: string;
  right?: ReactNode;
  defaultOpen?: boolean;
  collapsible?: boolean;
  children: ReactNode;
  maxBodyHeight?: number;
};

export function BaseCard({
  icon,
  title,
  summary,
  status,
  tone,
  accentColor,
  right,
  defaultOpen = false,
  collapsible = true,
  children,
  maxBodyHeight = 360
}: BaseCardProps): JSX.Element {
  const [open, setOpen] = useState(defaultOpen);
  const stripColor =
    accentColor ||
    (status === "failed" ? "var(--cw-danger)" : status === "running" ? "var(--cw-accent)" : tone === "danger" ? "var(--cw-danger)" : "transparent");

  return (
    <div
      style={{
        background: "var(--cw-card)",
        border: "1px solid var(--cw-border)",
        borderLeft: `3px solid ${stripColor}`,
        borderRadius: 12,
        marginBlock: 6,
        overflow: "hidden"
      }}
    >
      <button
        type="button"
        onClick={() => collapsible && setOpen((o) => !o)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 12px",
          background: "transparent",
          border: "none",
          textAlign: "left",
          color: "var(--cw-fg)",
          minHeight: 44
        }}
      >
        {icon ? <span style={{ fontSize: 16 }}>{icon}</span> : null}
        <span style={{ flex: 1, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {title}
        </span>
        {right}
        {status === "running" ? <Spinner /> : null}
        {collapsible ? (
          <span style={{ color: "var(--cw-fg-muted)", fontSize: 12 }}>{open ? "▾" : "▸"}</span>
        ) : null}
      </button>
      {open ? (
        <div
          style={{
            maxHeight: maxBodyHeight,
            overflow: "auto",
            padding: "0 12px 10px",
            borderTop: "1px solid var(--cw-border)"
          }}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

export function Spinner(): JSX.Element {
  return (
    <span
      aria-label="加载中"
      style={{
        display: "inline-block",
        width: 12,
        height: 12,
        borderRadius: "50%",
        border: "2px solid var(--cw-border)",
        borderTopColor: "var(--cw-accent)",
        animation: "cw-spin 0.7s linear infinite"
      }}
    >
      <style>{`@keyframes cw-spin { to { transform: rotate(360deg); } }`}</style>
    </span>
  );
}
