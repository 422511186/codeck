"use client";

import { useState } from "react";
import type { TimelineEntry } from "../state/timeline";
import type { PendingServerRequest } from "../api/types";
import { Markdown } from "./Markdown";
import { CommandCard } from "./cards/CommandCard";
import { DiffCard } from "./cards/DiffCard";
import { ReasoningCard } from "./cards/ReasoningCard";
import { ToolCard } from "./cards/ToolCard";
import { SystemMessage } from "./cards/SystemMessage";
import { ErrorCard } from "./cards/ErrorCard";
import { ApprovalCard } from "./cards/ApprovalCard";
import { ImagePreviewDialog, ImageThumb } from "./ImagePreview";

type Props = {
  entries: TimelineEntry[];
  approvals?: PendingServerRequest[];
  running?: boolean;
  onResolveApproval?: (req: PendingServerRequest, value: string) => Promise<void>;
  onResendUser?: (text: string) => void;
  onRewindToMessage?: (entry: TimelineEntry) => void | Promise<void>;
  onForkFromMessage?: (entry: TimelineEntry) => void | Promise<void>;
};

export function Timeline({
  entries,
  approvals,
  running = false,
  onResolveApproval,
  onResendUser,
  onRewindToMessage,
  onForkFromMessage
}: Props): JSX.Element {
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {entries.map((entry) => (
          <TimelineRow
            key={entry.id}
            entry={entry}
            running={running}
            onResendUser={onResendUser}
            onRewindToMessage={onRewindToMessage}
            onForkFromMessage={onForkFromMessage}
            onPreviewImage={setPreviewSrc}
          />
        ))}
        {approvals?.map((approval) => (
          <ApprovalCard
            key={approval.requestId}
            approval={approval}
            onResolved={async (value) => {
              if (onResolveApproval) await onResolveApproval(approval, value);
            }}
          />
        ))}
      </div>
      {previewSrc ? <ImagePreviewDialog src={previewSrc} onClose={() => setPreviewSrc(null)} /> : null}
    </>
  );
}

function TimelineRow({
  entry,
  running,
  onResendUser,
  onRewindToMessage,
  onForkFromMessage,
  onPreviewImage
}: {
  entry: TimelineEntry;
  running: boolean;
  onResendUser?: (text: string) => void;
  onRewindToMessage?: (entry: TimelineEntry) => void | Promise<void>;
  onForkFromMessage?: (entry: TimelineEntry) => void | Promise<void>;
  onPreviewImage: (src: string) => void;
}): JSX.Element {
  const body = entry.body;
  switch (body.kind) {
    case "user-message":
      return (
        <UserMessage
          entry={entry}
          running={running}
          onResend={() => onResendUser?.(body.text)}
          onRewind={() => onRewindToMessage?.(entry)}
          onFork={() => onForkFromMessage?.(entry)}
          onPreviewImage={onPreviewImage}
        />
      );
    case "agent-message":
      return (
        <div style={{ padding: "4px 14px" }}>
          <Markdown text={body.text} />
        </div>
      );
    case "reasoning":
      return <ReasoningCard entry={body} />;
    case "command":
      return <CommandCard entry={body} />;
    case "diff":
      return <DiffCard entry={body} />;
    case "tool":
      return <ToolCard entry={body} />;
    case "system":
      return <SystemMessage entry={body} />;
    case "error":
      return <ErrorCard text={body.text} />;
    default:
      return <></>;
  }
}

function UserMessage({
  entry,
  running,
  onResend,
  onRewind,
  onFork,
  onPreviewImage
}: {
  entry: TimelineEntry;
  running: boolean;
  onResend: () => void;
  onRewind: () => void | Promise<void>;
  onFork: () => void | Promise<void>;
  onPreviewImage: (src: string) => void;
}): JSX.Element {
  const body = entry.body as Extract<TimelineEntry["body"], { kind: "user-message" }>;
  const [menuOpen, setMenuOpen] = useState(false);
  const failed = body.status === "failed";

  function pressHandler(e: React.PointerEvent): void {
    const timer = window.setTimeout(() => setMenuOpen(true), 450);
    const cancel = () => window.clearTimeout(timer);
    e.currentTarget.addEventListener("pointerup", cancel, { once: true });
    e.currentTarget.addEventListener("pointermove", cancel, { once: true });
    e.currentTarget.addEventListener("pointercancel", cancel, { once: true });
  }

  return (
    <div
      onPointerDown={pressHandler}
      style={{
        padding: "10px 14px",
        borderLeft: "3px solid var(--cw-user-strip)",
        background: failed ? "var(--cw-danger-bg)" : "var(--cw-bg-elevated)",
        margin: "2px 0",
        whiteSpace: "pre-wrap",
        userSelect: "text",
        position: "relative"
      }}
    >
      {body.imagePaths?.length ? (
        <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
          {body.imagePaths.map((src) => (
            <ImageThumb key={src} src={src} onPreview={onPreviewImage} />
          ))}
        </div>
      ) : null}
      <div style={{ color: failed ? "var(--cw-danger)" : "var(--cw-fg)" }}>{body.text}</div>
      {failed ? (
        <button
          type="button"
          onClick={onResend}
          style={{
            marginTop: 8,
            padding: "4px 10px",
            fontSize: 12,
            borderRadius: 8,
            border: "1px solid var(--cw-danger)",
            background: "transparent",
            color: "var(--cw-danger)"
          }}
        >
          重试
        </button>
      ) : null}
      {menuOpen ? (
        <div
          role="presentation"
          onClick={() => setMenuOpen(false)}
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            zIndex: 80
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            style={messageSheetStyle}
          >
            <div style={sheetHandleStyle} aria-hidden="true" />
            <MessageSheetItem
              label="复制"
              onClick={() => {
                navigator.clipboard?.writeText(body.text);
                setMenuOpen(false);
              }}
            />
            {!running ? (
              <>
                <MessageSheetItem
                  label="回滚到这里"
                  divided
                  onClick={() => {
                    void onRewind();
                    setMenuOpen(false);
                  }}
                />
                <MessageSheetItem
                  label="从这里 Fork"
                  divided
                  onClick={() => {
                    void onFork();
                    setMenuOpen(false);
                  }}
                />
              </>
            ) : null}
            <MessageSheetItem label="取消" divided onClick={() => setMenuOpen(false)} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MessageSheetItem({
  label,
  divided = false,
  onClick
}: {
  label: string;
  divided?: boolean;
  onClick: () => void;
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        ...menuBtn,
        ...(divided ? { borderTop: "1px solid var(--cw-border)" } : {})
      }}
    >
      {label}
    </button>
  );
}

const menuBtn: React.CSSProperties = {
  padding: "14px 12px",
  fontSize: 16,
  border: "none",
  background: "transparent",
  color: "var(--cw-fg)",
  textAlign: "left",
  width: "100%"
};

const messageSheetStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: 480,
  maxHeight: "50dvh",
  background: "var(--cw-card)",
  borderTop: "1px solid var(--cw-border)",
  borderTopLeftRadius: 18,
  borderTopRightRadius: 18,
  padding: "8px 8px calc(8px + var(--safe-bottom))",
  display: "flex",
  flexDirection: "column",
  overflowY: "auto",
  boxShadow: "0 -12px 32px rgba(0,0,0,0.28)"
};

const sheetHandleStyle: React.CSSProperties = {
  alignSelf: "center",
  width: 38,
  height: 4,
  borderRadius: 999,
  background: "var(--cw-border)",
  margin: "2px 0 8px"
};
