"use client";

import { useState } from "react";
import { AlertTriangle, ChevronDown, ChevronUp, X } from "lucide-react";
import type { ThreadNotice } from "../state/store";

export function ThreadNotices({
  notices,
  onDismiss
}: {
  notices: ThreadNotice[];
  onDismiss: (noticeId: string) => void;
}): JSX.Element | null {
  const [expanded, setExpanded] = useState(false);
  if (!notices.length) return null;

  if (notices.length > 1) {
    return (
      <section aria-label="会话提示" style={noticeListStyle}>
        <div role="status" data-thread-notice="warning" style={noticeStyle}>
          <AlertTriangle aria-hidden="true" size={16} strokeWidth={1.8} style={noticeIconStyle} />
          <span style={noticeTextStyle}>{notices.length} 条模型与配置提示</span>
          <button
            type="button"
            aria-label={expanded ? "收起提示" : "展开提示"}
            title={expanded ? "收起提示" : "展开提示"}
            aria-expanded={expanded}
            onClick={() => setExpanded((value) => !value)}
            style={dismissButtonStyle}
          >
            {expanded ? (
              <ChevronUp aria-hidden="true" size={16} strokeWidth={1.8} />
            ) : (
              <ChevronDown aria-hidden="true" size={16} strokeWidth={1.8} />
            )}
          </button>
        </div>
        {expanded ? notices.map((notice) => (
          <NoticeDetail key={notice.id} notice={notice} onDismiss={onDismiss} />
        )) : null}
      </section>
    );
  }

  return (
    <section aria-label="会话提示" style={noticeListStyle}>
      <NoticeDetail notice={notices[0]!} onDismiss={onDismiss} announce />
    </section>
  );
}

function NoticeDetail({
  notice,
  onDismiss,
  announce = false
}: {
  notice: ThreadNotice;
  onDismiss: (noticeId: string) => void;
  announce?: boolean;
}): JSX.Element {
  return (
    <div
      {...(announce ? { role: "status" } : {})}
      data-thread-notice={notice.kind}
      style={noticeStyle}
    >
      <AlertTriangle aria-hidden="true" size={16} strokeWidth={1.8} style={noticeIconStyle} />
      <span style={noticeTextStyle}>{displayNoticeText(notice.text)}</span>
      <button
        type="button"
        aria-label="关闭提示"
        title="关闭提示"
        onClick={() => onDismiss(notice.id)}
        style={dismissButtonStyle}
      >
        <X aria-hidden="true" size={16} strokeWidth={1.8} />
      </button>
    </div>
  );
}

function displayNoticeText(text: string): string {
  const resumeMatch = /^This session was recorded with model `([^`]+)` but is resuming with `([^`]+)`\. Consider switching back to `[^`]+` as it may affect Codex performance\.$/.exec(text);
  if (resumeMatch) {
    return `会话原使用 ${resumeMatch[1]}，当前以 ${resumeMatch[2]} 恢复，可能影响模型表现。`;
  }
  const metadataMatch = /^Model metadata for `([^`]+)` not found\. Defaulting to fallback metadata; this can degrade performance and cause issues\.$/.exec(text);
  if (metadataMatch) {
    return `未找到 ${metadataMatch[1]} 的模型元数据，当前使用回退配置，可能影响模型表现。`;
  }
  return text;
}

const noticeListStyle: React.CSSProperties = {
  flex: "0 0 auto",
  display: "grid",
  gap: 6,
  maxHeight: "28dvh",
  padding: "6px 12px",
  overflowY: "auto",
  borderBottom: "1px solid var(--cw-border)"
};

const noticeStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: 8,
  minWidth: 0,
  padding: "8px 9px",
  borderLeft: "3px solid var(--cw-warning)",
  borderRadius: 6,
  background: "var(--cw-warning-bg)",
  color: "var(--cw-fg)",
  fontSize: 13,
  lineHeight: 1.45
};

const noticeIconStyle: React.CSSProperties = {
  flex: "0 0 auto",
  marginTop: 1,
  color: "var(--cw-warning)"
};

const noticeTextStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  overflowWrap: "anywhere",
  whiteSpace: "pre-wrap"
};

const dismissButtonStyle: React.CSSProperties = {
  width: 24,
  height: 24,
  flex: "0 0 24px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  margin: "-3px -3px -3px 0",
  padding: 0,
  border: "none",
  borderRadius: 4,
  background: "transparent",
  color: "var(--cw-fg-muted)",
  touchAction: "manipulation"
};
