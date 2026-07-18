"use client";

import { Wifi } from "lucide-react";

const MAX_RECONNECT_ATTEMPTS = 5;

export function ReconnectStatus({
  attempt,
  floating = false
}: {
  attempt: number;
  floating?: boolean;
}): JSX.Element {
  const visibleAttempt = Math.min(MAX_RECONNECT_ATTEMPTS, Math.max(1, attempt));
  return (
    <div
      role="status"
      aria-live="polite"
      data-reconnect-status="true"
      style={{
        ...reconnectStatusStyle,
        ...(floating ? floatingReconnectStatusStyle : null)
      }}
    >
      <Wifi aria-hidden="true" size={18} strokeWidth={1.7} />
      <span>{`正在重新连接 ${visibleAttempt}/${MAX_RECONNECT_ATTEMPTS}`}</span>
    </div>
  );
}

const reconnectStatusStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  minHeight: 28,
  padding: "4px 0",
  color: "var(--cw-fg-muted)",
  fontSize: 14,
  lineHeight: 1.4
};

const floatingReconnectStatusStyle: React.CSSProperties = {
  position: "fixed",
  top: 12,
  left: 16,
  zIndex: 50,
  padding: "6px 10px",
  background: "var(--cw-bg)"
};
