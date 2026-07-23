"use client";

import type { ReactNode } from "react";

type ActionSheetProps = {
  title?: string;
  onClose: () => void;
  children: ReactNode;
  align?: "bottom" | "center";
  "aria-label"?: string;
};

export function ActionSheet({
  title,
  onClose,
  children,
  align = "bottom",
  "aria-label": ariaLabel
}: ActionSheetProps): JSX.Element {
  return (
    <div
      role="presentation"
      data-action-sheet-backdrop="true"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
        display: "flex",
        alignItems: align === "bottom" ? "flex-end" : "center",
        justifyContent: "center",
        zIndex: 50
      }}
    >
      <div
        role="dialog"
        aria-label={ariaLabel ?? title ?? "操作"}
        data-action-sheet="true"
        onClick={(event) => event.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 420,
          background: "var(--cw-card)",
          border: "1px solid var(--cw-border)",
          borderRadius: align === "bottom" ? "16px 16px 0 0" : 16,
          padding: "12px 12px calc(12px + var(--safe-bottom, 0px))",
          margin: align === "bottom" ? 0 : 16,
          display: "flex",
          flexDirection: "column",
          gap: 4,
          boxShadow: "0 -12px 32px rgba(0,0,0,0.28)"
        }}
      >
        {align === "bottom" ? (
          <div
            aria-hidden="true"
            style={{
              alignSelf: "center",
              width: 36,
              height: 4,
              borderRadius: 999,
              background: "var(--cw-border)",
              marginBottom: 4
            }}
          />
        ) : null}
        {title ? (
          <div
            style={{
              fontSize: 13,
              color: "var(--cw-fg-muted)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              padding: "4px 8px 8px"
            }}
          >
            {title}
          </div>
        ) : null}
        {children}
      </div>
    </div>
  );
}

type ActionSheetItemProps = {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: "default" | "danger";
  divided?: boolean;
};

export function ActionSheetItem({
  label,
  onClick,
  disabled = false,
  tone = "default",
  divided = false
}: ActionSheetItemProps): JSX.Element {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      style={{
        padding: "14px 12px",
        fontSize: 16,
        border: "none",
        borderTop: divided ? "1px solid var(--cw-border)" : "none",
        background: "transparent",
        color: tone === "danger" ? "var(--cw-danger)" : "var(--cw-fg)",
        textAlign: "left",
        width: "100%",
        opacity: disabled ? 0.55 : 1
      }}
    >
      {label}
    </button>
  );
}
