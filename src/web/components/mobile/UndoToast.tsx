"use client";

type UndoToastProps = {
  message: string;
  undoLabel?: string;
  onUndo: () => void;
  onDismiss?: () => void;
};

export function UndoToast({
  message,
  undoLabel = "撤销",
  onUndo,
  onDismiss
}: UndoToastProps): JSX.Element {
  return (
    <div
      role="status"
      data-undo-toast="true"
      style={{
        position: "fixed",
        left: 12,
        right: 12,
        bottom: "calc(16px + var(--safe-bottom, 0px))",
        zIndex: 60,
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 14px",
        borderRadius: 12,
        background: "var(--cw-bg-elevated, #1e1e1e)",
        color: "var(--cw-fg)",
        border: "1px solid var(--cw-border)",
        boxShadow: "0 8px 24px rgba(0,0,0,0.28)"
      }}
    >
      <span style={{ flex: 1, fontSize: 14 }}>{message}</span>
      <button
        type="button"
        data-undo-toast-action="true"
        onClick={onUndo}
        style={{
          border: "none",
          background: "transparent",
          color: "var(--cw-accent)",
          fontSize: 14,
          fontWeight: 600,
          padding: "4px 6px"
        }}
      >
        {undoLabel}
      </button>
      {onDismiss ? (
        <button
          type="button"
          aria-label="关闭"
          onClick={onDismiss}
          style={{
            border: "none",
            background: "transparent",
            color: "var(--cw-fg-muted)",
            fontSize: 16,
            lineHeight: 1,
            padding: "2px 4px"
          }}
        >
          ×
        </button>
      ) : null}
    </div>
  );
}
