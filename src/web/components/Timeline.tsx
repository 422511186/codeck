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
  onResolveApproval?: (req: PendingServerRequest, value: string) => Promise<void>;
  onResendUser?: (text: string) => void;
};

export function Timeline({ entries, approvals, onResolveApproval, onResendUser }: Props): JSX.Element {
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {entries.map((entry) => (
          <TimelineRow
            key={entry.id}
            entry={entry}
            onResendUser={onResendUser}
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
  onResendUser,
  onPreviewImage
}: {
  entry: TimelineEntry;
  onResendUser?: (text: string) => void;
  onPreviewImage: (src: string) => void;
}): JSX.Element {
  const body = entry.body;
  switch (body.kind) {
    case "user-message":
      return (
        <UserMessage
          entry={entry}
          onResend={() => onResendUser?.(body.text)}
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
  onResend,
  onPreviewImage
}: {
  entry: TimelineEntry;
  onResend: () => void;
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
          onClick={() => setMenuOpen(false)}
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(0,0,0,0.05)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--cw-card)",
              border: "1px solid var(--cw-border)",
              borderRadius: 10,
              padding: 6,
              display: "flex",
              gap: 4
            }}
          >
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(body.text);
                setMenuOpen(false);
              }}
              style={menuBtn}
            >
              复制
            </button>
            <button type="button" onClick={() => setMenuOpen(false)} style={menuBtn}>
              取消
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const menuBtn: React.CSSProperties = {
  padding: "6px 12px",
  fontSize: 13,
  border: "none",
  background: "transparent",
  color: "var(--cw-fg)"
};
