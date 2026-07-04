"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

const EAGER_MARKDOWN_TEXT_LIMIT = 1_500;
const LAZY_MARKDOWN_TEXT_LIMIT = 24_000;
const LAZY_MARKDOWN_ROOT_MARGIN = "720px 0px";
const MAX_INITIAL_TIMELINE_ROWS = 80;
const EAGER_MARKDOWN_TAIL_ROWS = 2;
const ESTIMATED_TIMELINE_ROW_HEIGHT = 72;

type TimelineDerivationDiagnostics = {
  derivationRuns: number;
  rowEntryScans: number;
};

const timelineDerivationDiagnostics: TimelineDerivationDiagnostics = {
  derivationRuns: 0,
  rowEntryScans: 0
};

type Props = {
  entries: TimelineEntry[];
  approvals?: PendingServerRequest[];
  running?: boolean;
  activeTurnId?: string | null;
  onResolveApproval?: (req: PendingServerRequest, value: string) => Promise<void>;
  onResendUser?: (text: string) => void;
  onRewindToMessage?: (entry: TimelineEntry) => void | Promise<void>;
  onForkFromMessage?: (entry: TimelineEntry) => void | Promise<void>;
};

export function Timeline({
  entries,
  approvals,
  running = false,
  activeTurnId = null,
  onResolveApproval,
  onResendUser,
  onRewindToMessage,
  onForkFromMessage
}: Props): JSX.Element {
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const windowStartIndex = Math.max(0, entries.length - MAX_INITIAL_TIMELINE_ROWS);
  const visibleEntries = windowStartIndex > 0 ? entries.slice(windowStartIndex) : entries;
  const topSpacerHeight = windowStartIndex * ESTIMATED_TIMELINE_ROW_HEIGHT;
  const longTimeline = entries.length > MAX_INITIAL_TIMELINE_ROWS;
  const rowState = useMemo(
    () => deriveTimelineRowState(entries, running, activeTurnId),
    [entries, running, activeTurnId]
  );
  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {topSpacerHeight > 0 ? (
          <div aria-hidden="true" data-timeline-spacer="top" style={{ minHeight: topSpacerHeight }} />
        ) : null}
        {visibleEntries.map((entry, visibleIndex) => (
          <div key={entry.id} data-timeline-row="true">
            <TimelineRow
              entry={entry}
              live={rowState.liveAgentEntryIds.has(entry.id)}
              actionAvailable={rowState.messageActionAvailableById.get(entry.id) ?? false}
              running={running}
              eagerMarkdown={!longTimeline || visibleIndex >= visibleEntries.length - EAGER_MARKDOWN_TAIL_ROWS}
              onResendUser={onResendUser}
              onRewindToMessage={onRewindToMessage}
              onForkFromMessage={onForkFromMessage}
              onPreviewImage={setPreviewSrc}
            />
          </div>
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
  live,
  actionAvailable,
  running,
  eagerMarkdown,
  onResendUser,
  onRewindToMessage,
  onForkFromMessage,
  onPreviewImage
}: {
  entry: TimelineEntry;
  live: boolean;
  actionAvailable: boolean;
  running: boolean;
  eagerMarkdown: boolean;
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
          actionAvailable={!running && actionAvailable}
          running={running}
          onResend={() => onResendUser?.(body.text)}
          onRewind={() => onRewindToMessage?.(entry)}
          onFork={() => onForkFromMessage?.(entry)}
          onPreviewImage={onPreviewImage}
        />
      );
    case "agent-message":
      return <AgentMessage text={body.text} live={live} eagerMarkdown={eagerMarkdown} />;
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

function AgentMessage({ text, live, eagerMarkdown }: { text: string; live: boolean; eagerMarkdown: boolean }): JSX.Element {
  if (live) {
    return (
      <div style={agentMessageStyle}>
        <PlainAgentText text={text} />
      </div>
    );
  }
  return <LazyAgentMarkdown text={text} eagerMarkdown={eagerMarkdown} />;
}

function LazyAgentMarkdown({ text, eagerMarkdown }: { text: string; eagerMarkdown: boolean }): JSX.Element {
  const ref = useRef<HTMLDivElement | null>(null);
  const [renderMarkdown, setRenderMarkdown] = useState(() => eagerMarkdown && text.length <= EAGER_MARKDOWN_TEXT_LIMIT);

  useEffect(() => {
    setRenderMarkdown(eagerMarkdown && text.length <= EAGER_MARKDOWN_TEXT_LIMIT);
  }, [eagerMarkdown, text]);

  useEffect(() => {
    if (renderMarkdown || text.length > LAZY_MARKDOWN_TEXT_LIMIT) {
      return;
    }

    const node = ref.current;
    if (!node) {
      return;
    }

    let cancelled = false;
    let cleanupScheduledRender: (() => void) | null = null;

    const scheduleRender = () => {
      const win = node.ownerDocument.defaultView;
      const requestIdle = win && "requestIdleCallback" in win ? win.requestIdleCallback : null;
      const cancelIdle = win && "cancelIdleCallback" in win ? win.cancelIdleCallback : null;
      if (typeof requestIdle === "function") {
        const handle = requestIdle(
          () => {
            if (!cancelled) {
              setRenderMarkdown(true);
            }
          },
          { timeout: 1_200 }
        );
        cleanupScheduledRender = () => {
          if (typeof cancelIdle === "function") {
            cancelIdle(handle);
          }
        };
        return;
      }

      const timeout = window.setTimeout(() => {
        if (!cancelled) {
          setRenderMarkdown(true);
        }
      }, 80);
      cleanupScheduledRender = () => window.clearTimeout(timeout);
    };

    if (!("IntersectionObserver" in window)) {
      scheduleRender();
      return () => {
        cancelled = true;
        cleanupScheduledRender?.();
      };
    }

    const observer = new IntersectionObserver(
      (records) => {
        if (records.some((record) => record.isIntersecting || record.intersectionRatio > 0)) {
          observer.disconnect();
          scheduleRender();
        }
      },
      { root: null, rootMargin: LAZY_MARKDOWN_ROOT_MARGIN }
    );
    observer.observe(node);

    return () => {
      cancelled = true;
      observer.disconnect();
      cleanupScheduledRender?.();
    };
  }, [renderMarkdown, text]);

  return (
    <div ref={ref} style={agentMessageStyle}>
      {renderMarkdown ? <Markdown text={text} /> : <PlainAgentText text={text} />}
    </div>
  );
}

function PlainAgentText({ text }: { text: string }): JSX.Element {
  return <div style={plainAgentTextStyle}>{text}</div>;
}

type TimelineRowState = {
  liveAgentEntryIds: Set<string>;
  messageActionAvailableById: Map<string, boolean>;
};

function deriveTimelineRowState(
  entries: TimelineEntry[],
  running: boolean,
  activeTurnId: string | null
): TimelineRowState {
  timelineDerivationDiagnostics.derivationRuns += 1;
  const liveAgentEntryIds = new Set<string>();
  const messageActionAvailableById = new Map<string, boolean>();
  const turnIds = new Set<string>();
  const userMessageCountByTurn = new Map<string, number>();

  for (const entry of entries) {
    if (entry.turnId) {
      turnIds.add(entry.turnId);
      if (entry.body.kind === "user-message") {
        userMessageCountByTurn.set(entry.turnId, (userMessageCountByTurn.get(entry.turnId) ?? 0) + 1);
      }
    }
  }

  for (const entry of entries) {
    if (
      entry.body.kind === "user-message" &&
      entry.turnId &&
      turnIds.has(entry.turnId) &&
      userMessageCountByTurn.get(entry.turnId) === 1
    ) {
      messageActionAvailableById.set(entry.id, true);
    }
  }

  if (!running) {
    return { liveAgentEntryIds, messageActionAvailableById };
  }

  if (activeTurnId) {
    for (const entry of entries) {
      if (entry.body.kind === "agent-message" && entry.turnId === activeTurnId) {
        liveAgentEntryIds.add(entry.id);
      }
    }
    return { liveAgentEntryIds, messageActionAvailableById };
  }

  let lastUserIndex = -1;
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    if (entries[index]?.body.kind === "user-message") {
      lastUserIndex = index;
      break;
    }
  }
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    if (index <= lastUserIndex) {
      break;
    }
    const candidate = entries[index];
    if (candidate?.body.kind === "agent-message") {
      liveAgentEntryIds.add(candidate.id);
      break;
    }
  }
  return { liveAgentEntryIds, messageActionAvailableById };
}

const agentMessageStyle: React.CSSProperties = {
  padding: "4px 14px"
};

const plainAgentTextStyle: React.CSSProperties = {
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
  overflowWrap: "anywhere"
};

function UserMessage({
  entry,
  running,
  actionAvailable,
  onResend,
  onRewind,
  onFork,
  onPreviewImage
}: {
  entry: TimelineEntry;
  running: boolean;
  actionAvailable: boolean;
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
      {body.skillReferences?.length ? (
        <div style={skillReferenceRowStyle}>
          {body.skillReferences.map((skill) => (
            <span key={`${skill.name}\u0001${skill.path}`} style={skillReferenceChipStyle}>
              {skill.name}
            </span>
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
            {!running && actionAvailable ? (
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

const skillReferenceRowStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 6,
  marginBottom: 8,
  whiteSpace: "normal"
};

const skillReferenceChipStyle: React.CSSProperties = {
  maxWidth: "100%",
  minWidth: 0,
  padding: "3px 8px",
  borderRadius: 8,
  border: "1px solid var(--cw-border)",
  background: "var(--cw-card)",
  color: "var(--cw-fg-muted)",
  fontSize: 12,
  lineHeight: 1.4,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap"
};

export function __getTimelineDerivationDiagnostics(): TimelineDerivationDiagnostics {
  return { ...timelineDerivationDiagnostics };
}

export function __resetTimelineDerivationDiagnostics(): void {
  timelineDerivationDiagnostics.derivationRuns = 0;
  timelineDerivationDiagnostics.rowEntryScans = 0;
}
