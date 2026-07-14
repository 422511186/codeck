"use client";

import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { TimelineEntry } from "../state/timeline";
import type { PendingServerRequest, SkillReference } from "../api/types";
import { Markdown } from "./Markdown";
import { CommandCard } from "./cards/CommandCard";
import { DiffCard, DiffView } from "./cards/DiffCard";
import { ReasoningCard } from "./cards/ReasoningCard";
import { ToolCard } from "./cards/ToolCard";
import { SystemMessage } from "./cards/SystemMessage";
import { ErrorCard } from "./cards/ErrorCard";
import { ApprovalCard } from "./cards/ApprovalCard";
import { ImagePreviewDialog, ImageThumb } from "./ImagePreview";
import { LongTextPreview } from "./cards/LongTextPreview";
import { codex } from "../api/endpoints";
import { useStore } from "../state/store";

const EAGER_MARKDOWN_TEXT_LIMIT = 1_500;
const LAZY_MARKDOWN_TEXT_LIMIT = 24_000;
const LAZY_MARKDOWN_ROOT_MARGIN = "720px 0px";
const MAX_INITIAL_TIMELINE_ROWS = 80;
const TIMELINE_WINDOW_BUFFER_ROWS = 20;
const EAGER_MARKDOWN_TAIL_ROWS = 2;
const ESTIMATED_TIMELINE_ROW_HEIGHT = 72;
const MIN_MEASURED_TIMELINE_ROW_HEIGHT = 24;
const TIMELINE_BLOCK_GAP = 10;
const MIN_REAL_TIMELINE_TIMESTAMP_MS = Date.UTC(2000, 0, 1);

type TimelineDerivationDiagnostics = {
  derivationRuns: number;
  rowEntryScans: number;
  inlineActivitySectionRuns: number;
  timelineRowRenderRuns: number;
  inlineActivityRenderRuns: number;
};

type TimelineWindowRange = {
  start: number;
  end: number;
};

type TimelineLayoutIndex = {
  offsets: number[];
  totalHeight: number;
};

type TimelineScrollAnchor = {
  blockId: string;
  entryId: string;
  beforeEntryId: string | null;
  afterEntryId: string | null;
  intraBlockOffset: number;
  absoluteOffset: number;
  followTail: boolean;
};

const timelineDerivationDiagnostics: TimelineDerivationDiagnostics = {
  derivationRuns: 0,
  rowEntryScans: 0,
  inlineActivitySectionRuns: 0,
  timelineRowRenderRuns: 0,
  inlineActivityRenderRuns: 0
};

type Props = {
  threadId?: string;
  entries: TimelineEntry[];
  followTail?: boolean;
  approvals?: PendingServerRequest[];
  running?: boolean;
  activeTurnId?: string | null;
  onResolveApproval?: (req: PendingServerRequest, value: string) => Promise<void>;
  onResendUser?: (text: string, imagePaths: string[], skillReferences: SkillReference[]) => void;
  onRewindToMessage?: (entry: TimelineEntry) => void | Promise<void>;
  onForkFromMessage?: (entry: TimelineEntry) => void | Promise<void>;
};

export function Timeline({
  threadId,
  entries,
  followTail = false,
  approvals,
  running = false,
  activeTurnId = null,
  onResolveApproval,
  onResendUser,
  onRewindToMessage,
  onForkFromMessage
}: Props): JSX.Element {
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const rowHeightCacheRef = useRef<Map<string, number>>(new Map());
  const [rowHeightVersion, setRowHeightVersion] = useState(0);
  const allBlocks = useMemo(() => deriveTimelineRenderBlocks(entries), [entries]);
  const layoutIndex = useMemo(
    () => createTimelineLayoutIndex(allBlocks, rowHeightCacheRef.current),
    [allBlocks, rowHeightVersion]
  );
  const previousLayoutRef = useRef<{ blocks: TimelineRenderBlock[]; layoutIndex: TimelineLayoutIndex }>({
    blocks: allBlocks,
    layoutIndex
  });
  const scrollAnchorRef = useRef<TimelineScrollAnchor | null>(null);
  const [windowRange, setWindowRange] = useState<TimelineWindowRange>(() =>
    initialTimelineWindowRange(allBlocks.length)
  );
  const previousBlocksRef = useRef<{ length: number; firstId: string | null; lastId: string | null }>({
    length: allBlocks.length,
    firstId: allBlocks[0]?.id ?? null,
    lastId: allBlocks[allBlocks.length - 1]?.id ?? null
  });
  const visibleBlocks = useMemo(
    () => allBlocks.slice(windowRange.start, windowRange.end),
    [allBlocks, windowRange.start, windowRange.end]
  );
  const visibleEntries = useMemo(() => timelineRenderBlockEntries(visibleBlocks), [visibleBlocks]);
  const topSpacerHeight = layoutIndex.offsets[windowRange.start] ?? 0;
  const bottomSpacerHeight = Math.max(
    0,
    layoutIndex.totalHeight - (layoutIndex.offsets[windowRange.end] ?? layoutIndex.totalHeight)
  );
  const longTimeline = allBlocks.length > MAX_INITIAL_TIMELINE_ROWS;
  const rowState = useMemo(
    () => deriveTimelineRowState(visibleEntries, running, activeTurnId),
    [visibleEntries, running, activeTurnId]
  );

  useLayoutEffect(() => {
    const root = rootRef.current;
    const scroller = root ? findTimelineScrollContainer(root) : null;
    const previous = previousLayoutRef.current;
    if (scroller && followTail) {
      const tailRange = initialTimelineWindowRange(allBlocks.length);
      if (windowRange.start !== tailRange.start || windowRange.end !== tailRange.end) {
        setWindowRange(tailRange);
        return;
      }
      scroller.scrollTop = scroller.scrollHeight;
    }
    if (
      scroller &&
      scrollAnchorRef.current &&
      !followTail &&
      !scrollAnchorRef.current.followTail &&
      (previous.blocks !== allBlocks || previous.layoutIndex !== layoutIndex)
    ) {
      const restoredOffset = timelineScrollOffsetForAnchor(scrollAnchorRef.current, allBlocks, layoutIndex);
      if (restoredOffset !== null && Math.abs(scroller.scrollTop - restoredOffset) >= 1) {
        scroller.scrollTop = restoredOffset;
      }
    }
    previousLayoutRef.current = { blocks: allBlocks, layoutIndex };
    if (scroller) {
      scrollAnchorRef.current = captureTimelineScrollAnchor(
        allBlocks,
        layoutIndex,
        scroller.scrollTop,
        scroller.clientHeight
      );
    }
  }, [allBlocks, layoutIndex, followTail, windowRange.start, windowRange.end]);

  useEffect(() => {
    const previous = previousBlocksRef.current;
    const nextFirstId = allBlocks[0]?.id ?? null;
    const nextLastId = allBlocks[allBlocks.length - 1]?.id ?? null;
    const prependedAtHead =
      previous.length > 0 &&
      allBlocks.length > previous.length &&
      previous.lastId !== null &&
      nextLastId === previous.lastId &&
      nextFirstId !== previous.firstId;
    const appendedAtTail =
      previous.length > 0 &&
      allBlocks.length > previous.length &&
      previous.firstId !== null &&
      nextFirstId === previous.firstId &&
      nextLastId !== previous.lastId;

    setWindowRange((current) => {
      if (followTail) {
        return initialTimelineWindowRange(allBlocks.length);
      }
      if (allBlocks.length <= MAX_INITIAL_TIMELINE_ROWS) {
        return { start: 0, end: allBlocks.length };
      }
      if (previous.length === 0 || allBlocks.length < previous.length) {
        return initialTimelineWindowRange(allBlocks.length);
      }
      if (prependedAtHead) {
        if (current.start === 0) {
          return clampTimelineWindowRange({ start: 0, end: current.end }, allBlocks.length);
        }
        const offset = allBlocks.length - previous.length;
        return clampTimelineWindowRange(
          { start: current.start + offset, end: current.end + offset },
          allBlocks.length
        );
      }
      if (appendedAtTail && current.end >= previous.length) {
        return initialTimelineWindowRange(allBlocks.length);
      }
      return clampTimelineWindowRange(current, allBlocks.length);
    });

    previousBlocksRef.current = {
      length: allBlocks.length,
      firstId: nextFirstId,
      lastId: nextLastId
    };
  }, [allBlocks.length, allBlocks[0]?.id, allBlocks[allBlocks.length - 1]?.id, followTail]);

  useEffect(() => {
    const visibleIds = new Set(allBlocks.map(timelineBlockHeightCacheKey));
    let changed = false;
    for (const key of rowHeightCacheRef.current.keys()) {
      if (!visibleIds.has(key)) {
        rowHeightCacheRef.current.delete(key);
        changed = true;
      }
    }
    if (changed) {
      setRowHeightVersion((version) => version + 1);
    }
  }, [allBlocks]);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || allBlocks.length === 0) {
      return;
    }
    if (measureVisibleTimelineRows(root, rowHeightCacheRef.current)) {
      setRowHeightVersion((version) => version + 1);
    }
  }, [allBlocks, visibleBlocks]);

  useEffect(() => {
    const root = rootRef.current;
    if (
      !root ||
      allBlocks.length === 0 ||
      typeof ResizeObserver === "undefined"
    ) {
      return;
    }
    const observer = new ResizeObserver(() => {
      const scroller = findTimelineScrollContainer(root);
      if (scroller) {
        scrollAnchorRef.current = captureTimelineScrollAnchor(
          allBlocks,
          layoutIndex,
          scroller.scrollTop,
          scroller.clientHeight
        );
      }
      if (measureVisibleTimelineRows(root, rowHeightCacheRef.current)) {
        setRowHeightVersion((version) => version + 1);
      }
    });
    root.querySelectorAll<HTMLElement>("[data-timeline-row='true']").forEach((row) => observer.observe(row));
    return () => {
      observer.disconnect();
    };
  }, [allBlocks, layoutIndex, visibleBlocks]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) {
      return;
    }

    const scroller = findTimelineScrollContainer(root);
    if (!scroller) {
      return;
    }

    const virtualized = allBlocks.length > MAX_INITIAL_TIMELINE_ROWS;
    if (virtualized) {
      scroller.dataset.timelineAnchorManaged = "true";
    }

    const updateVisibleWindow = () => {
      scrollAnchorRef.current = captureTimelineScrollAnchor(
        allBlocks,
        layoutIndex,
        scroller.scrollTop,
        scroller.clientHeight
      );
      if (virtualized) {
        setWindowRange(timelineWindowRangeForScroll(scroller.scrollTop, scroller.clientHeight, layoutIndex));
      }
    };

    scroller.addEventListener("scroll", updateVisibleWindow, { passive: true });
    return () => {
      scroller.removeEventListener("scroll", updateVisibleWindow);
      if (virtualized && scroller.dataset.timelineAnchorManaged === "true") {
        delete scroller.dataset.timelineAnchorManaged;
      }
    };
  }, [allBlocks.length, layoutIndex]);

  return (
    <>
      <div ref={rootRef} style={{ display: "flex", flexDirection: "column" }}>
        {topSpacerHeight > 0 ? (
          <div aria-hidden="true" data-timeline-spacer="top" style={{ minHeight: topSpacerHeight }} />
        ) : null}
        {visibleBlocks.map((block, visibleIndex) => (
          <div
            key={block.id}
            data-timeline-row="true"
            data-timeline-block-id={block.id}
            data-timeline-block-version={block.version}
            data-timeline-entry-id={timelineRenderBlockEntryId(block)}
            style={timelineRowStyle}
          >
            {block.kind === "inline-activity-log" ? (
              <InlineActivityLog entries={block.entries} />
            ) : (
              <TimelineRow
                entry={block.entry}
                threadId={threadId}
                live={rowState.liveAgentEntryIds.has(block.entry.id)}
                actionAvailable={rowState.messageActionAvailableById.get(block.entry.id) ?? false}
                running={running}
                eagerMarkdown={!longTimeline || visibleIndex >= visibleBlocks.length - EAGER_MARKDOWN_TAIL_ROWS}
                onResendUser={onResendUser}
                onRewindToMessage={onRewindToMessage}
                onForkFromMessage={onForkFromMessage}
                onPreviewImage={setPreviewSrc}
              />
            )}
          </div>
        ))}
        {bottomSpacerHeight > 0 ? (
          <div aria-hidden="true" data-timeline-spacer="bottom" style={{ minHeight: bottomSpacerHeight }} />
        ) : null}
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

export type TimelineRenderBlock =
  | { kind: "entry"; id: string; version: string; entry: TimelineEntry }
  | { kind: "inline-activity-log"; id: string; version: string; turnId?: string; entries: TimelineEntry[] };

function timelineRenderBlockEntryId(block: TimelineRenderBlock): string {
  return block.kind === "entry" ? block.entry.id : block.entries[0]?.id ?? block.id;
}

export function deriveTimelineRenderBlocks(entries: TimelineEntry[]): TimelineRenderBlock[] {
  const blocks: TimelineRenderBlock[] = [];
  let index = 0;
  while (index < entries.length) {
    const entry = entries[index]!;
    if (!isActivityEntry(entry)) {
      blocks.push({ kind: "entry", id: entry.id, version: timelineEntryDerivationKey(entry), entry });
      index += 1;
      continue;
    }

    const turnId = entry.turnId;
    const activityEntries: TimelineEntry[] = [entry];
    index += 1;
    while (index < entries.length) {
      const next = entries[index]!;
      if (!isActivityEntry(next) || next.turnId !== turnId) {
        break;
      }
      activityEntries.push(next);
      index += 1;
    }

    blocks.push({
      kind: "inline-activity-log",
      id: `inline-activity-${turnId ?? "no-turn"}-${activityEntries[0]!.id}`,
      version: inlineActivitySectionsCacheKey(activityEntries),
      ...(turnId ? { turnId } : {}),
      entries: activityEntries
    });
  }
  return blocks;
}

function timelineRenderBlockEntries(blocks: TimelineRenderBlock[]): TimelineEntry[] {
  return blocks.flatMap((block) => (block.kind === "entry" ? [block.entry] : block.entries));
}

function isActivityEntry(entry: TimelineEntry): boolean {
  return (
    entry.body.kind === "reasoning" ||
    entry.body.kind === "tool" ||
    entry.body.kind === "command" ||
    entry.body.kind === "diff"
  );
}

function initialTimelineWindowRange(entryCount: number): TimelineWindowRange {
  return {
    start: Math.max(0, entryCount - MAX_INITIAL_TIMELINE_ROWS),
    end: entryCount
  };
}

function createTimelineLayoutIndex(
  blocks: TimelineRenderBlock[],
  rowHeightCache: ReadonlyMap<string, number>
): TimelineLayoutIndex {
  const offsets = new Array<number>(blocks.length + 1);
  offsets[0] = 0;
  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index]!;
    const height = rowHeightCache.get(timelineBlockHeightCacheKey(block)) ?? estimatedTimelineBlockHeight(block);
    offsets[index + 1] = offsets[index]! + height + TIMELINE_BLOCK_GAP;
  }
  return {
    offsets,
    totalHeight: offsets[blocks.length] ?? 0
  };
}

function estimatedTimelineBlockHeight(block: TimelineRenderBlock): number {
  if (block.kind === "inline-activity-log") {
    return 64;
  }
  switch (block.entry.body.kind) {
    case "user-message":
      return block.entry.body.imagePaths?.length ? 144 : 88;
    case "agent-message":
      return block.entry.body.text.length > LAZY_MARKDOWN_TEXT_LIMIT ? 160 : ESTIMATED_TIMELINE_ROW_HEIGHT;
    case "system":
    case "error":
      return 56;
    default:
      return 88;
  }
}

function measureTimelineRowHeight(row: HTMLElement): number | null {
  const rectHeight = row.getBoundingClientRect().height;
  const height = rectHeight || row.offsetHeight;
  if (!Number.isFinite(height) || height < MIN_MEASURED_TIMELINE_ROW_HEIGHT) {
    return null;
  }
  return Math.ceil(height);
}

function measureVisibleTimelineRows(root: HTMLElement, rowHeightCache: Map<string, number>): boolean {
  let changed = false;
  root.querySelectorAll<HTMLElement>("[data-timeline-row='true']").forEach((row) => {
    const blockId = row.dataset.timelineBlockId;
    const blockVersion = row.dataset.timelineBlockVersion;
    if (!blockId || !blockVersion) {
      return;
    }
    const cacheKey = `${blockId}\u0000${blockVersion}`;
    const measuredHeight = measureTimelineRowHeight(row);
    if (measuredHeight === null) {
      return;
    }
    const previousHeight = rowHeightCache.get(cacheKey);
    if (previousHeight === undefined || Math.abs(previousHeight - measuredHeight) >= 1) {
      rowHeightCache.set(cacheKey, measuredHeight);
      changed = true;
    }
  });
  return changed;
}

function timelineBlockHeightCacheKey(block: TimelineRenderBlock): string {
  return `${block.id}\u0000${block.version}`;
}

function timelineWindowRangeForScroll(
  scrollTop: number,
  clientHeight: number,
  layoutIndex: TimelineLayoutIndex
): TimelineWindowRange {
  const blockCount = layoutIndex.offsets.length - 1;
  if (blockCount <= MAX_INITIAL_TIMELINE_ROWS) {
    return { start: 0, end: blockCount };
  }
  const viewportStart = timelineBlockIndexForOffset(layoutIndex, Math.max(0, scrollTop));
  const viewportEnd = Math.min(
    blockCount,
    timelineBlockIndexForOffset(layoutIndex, Math.max(0, scrollTop) + Math.max(1, clientHeight)) + 1
  );
  let start = Math.max(0, viewportStart - TIMELINE_WINDOW_BUFFER_ROWS);
  let end = Math.min(
    blockCount,
    Math.max(viewportEnd + TIMELINE_WINDOW_BUFFER_ROWS, start + MAX_INITIAL_TIMELINE_ROWS)
  );
  if (end === blockCount && end - start < MAX_INITIAL_TIMELINE_ROWS) {
    start = Math.max(0, end - MAX_INITIAL_TIMELINE_ROWS);
  }
  return { start, end };
}

function timelineBlockIndexForOffset(layoutIndex: TimelineLayoutIndex, offset: number): number {
  const blockCount = layoutIndex.offsets.length - 1;
  if (blockCount <= 1) {
    return 0;
  }
  const target = Math.max(0, Math.min(offset, Math.max(0, layoutIndex.totalHeight - 1)));
  let low = 0;
  let high = blockCount - 1;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if ((layoutIndex.offsets[middle + 1] ?? layoutIndex.totalHeight) <= target) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }
  return low;
}

function captureTimelineScrollAnchor(
  blocks: TimelineRenderBlock[],
  layoutIndex: TimelineLayoutIndex,
  scrollTop: number,
  clientHeight: number
): TimelineScrollAnchor | null {
  if (blocks.length === 0) {
    return null;
  }
  const blockIndex = timelineBlockIndexForOffset(layoutIndex, scrollTop);
  const block = blocks[blockIndex];
  if (!block) {
    return null;
  }
  return {
    blockId: block.id,
    entryId: timelineRenderBlockEntryId(block),
    beforeEntryId: blockIndex > 0 ? timelineRenderBlockLastEntryId(blocks[blockIndex - 1]!) : null,
    afterEntryId: blockIndex + 1 < blocks.length ? timelineRenderBlockEntryId(blocks[blockIndex + 1]!) : null,
    intraBlockOffset: Math.max(0, scrollTop - (layoutIndex.offsets[blockIndex] ?? 0)),
    absoluteOffset: Math.max(0, scrollTop),
    followTail: layoutIndex.totalHeight - scrollTop - Math.max(0, clientHeight) < 64
  };
}

function timelineScrollOffsetForAnchor(
  anchor: TimelineScrollAnchor,
  blocks: TimelineRenderBlock[],
  layoutIndex: TimelineLayoutIndex
): number | null {
  if (blocks.length === 0) {
    return null;
  }
  let blockIndex = blocks.findIndex((block) => block.id === anchor.blockId);
  let preserveIntraBlockOffset = blockIndex >= 0;
  if (blockIndex < 0) {
    blockIndex = blocks.findIndex((block) => timelineRenderBlockContainsEntryId(block, anchor.entryId));
    preserveIntraBlockOffset = blockIndex >= 0;
  }
  if (blockIndex < 0 && anchor.beforeEntryId) {
    blockIndex = blocks.findIndex((block) => timelineRenderBlockContainsEntryId(block, anchor.beforeEntryId!));
  }
  if (blockIndex < 0 && anchor.afterEntryId) {
    blockIndex = blocks.findIndex((block) => timelineRenderBlockContainsEntryId(block, anchor.afterEntryId!));
  }
  if (blockIndex < 0) {
    blockIndex = timelineBlockIndexForOffset(layoutIndex, anchor.absoluteOffset);
  }
  const blockStart = layoutIndex.offsets[blockIndex] ?? 0;
  const blockEnd = layoutIndex.offsets[blockIndex + 1] ?? blockStart;
  const maxIntraBlockOffset = Math.max(0, blockEnd - blockStart - 1);
  return blockStart + (preserveIntraBlockOffset ? Math.min(anchor.intraBlockOffset, maxIntraBlockOffset) : 0);
}

function timelineRenderBlockContainsEntryId(block: TimelineRenderBlock, entryId: string): boolean {
  return block.kind === "entry" ? block.entry.id === entryId : block.entries.some((entry) => entry.id === entryId);
}

function timelineRenderBlockLastEntryId(block: TimelineRenderBlock): string {
  return block.kind === "entry" ? block.entry.id : block.entries.at(-1)?.id ?? block.id;
}

function clampTimelineWindowRange(range: TimelineWindowRange, entryCount: number): TimelineWindowRange {
  if (entryCount <= MAX_INITIAL_TIMELINE_ROWS) {
    return { start: 0, end: entryCount };
  }
  const size = Math.max(1, Math.min(entryCount, range.end - range.start || MAX_INITIAL_TIMELINE_ROWS));
  const start = Math.max(0, Math.min(range.start, Math.max(0, entryCount - size)));
  return {
    start,
    end: Math.min(entryCount, start + size)
  };
}

function findTimelineScrollContainer(root: HTMLElement): HTMLElement | null {
  const explicit = root.closest(".cw-thread-scroller");
  if (explicit instanceof HTMLElement) {
    return explicit;
  }

  let current: HTMLElement | null = root.parentElement;
  while (current) {
    const overflowY = window.getComputedStyle(current).overflowY;
    if (overflowY === "auto" || overflowY === "scroll") {
      return current;
    }
    current = current.parentElement;
  }
  return null;
}

type TimelineRowProps = {
  entry: TimelineEntry;
  threadId?: string;
  live: boolean;
  actionAvailable: boolean;
  running: boolean;
  eagerMarkdown: boolean;
  onResendUser?: (text: string, imagePaths: string[], skillReferences: SkillReference[]) => void;
  onRewindToMessage?: (entry: TimelineEntry) => void | Promise<void>;
  onForkFromMessage?: (entry: TimelineEntry) => void | Promise<void>;
  onPreviewImage: (src: string) => void;
};

const TimelineRow = memo(function TimelineRow({
  entry,
  threadId,
  live,
  actionAvailable,
  running,
  eagerMarkdown,
  onResendUser,
  onRewindToMessage,
  onForkFromMessage,
  onPreviewImage
}: TimelineRowProps): JSX.Element {
  timelineDerivationDiagnostics.timelineRowRenderRuns += 1;
  const [fullContent, setFullContent] = useState<{ contentRef: string; text: string } | null>(null);
  const [contentLoadState, setContentLoadState] = useState<"idle" | "loading" | "error">("idle");
  const contentRef = entry.completeness?.contentRef;
  const renderedEntry =
    fullContent && fullContent.contentRef === contentRef
      ? timelineEntryWithFullText(entry, fullContent.text)
      : entry;
  const body = renderedEntry.body;
  const derivationKey = timelineEntryDerivationKey(renderedEntry);

  useEffect(() => {
    setFullContent((current) => (current?.contentRef === contentRef ? current : null));
    setContentLoadState("idle");
  }, [contentRef]);

  const loadFullContent = async () => {
    if (!threadId || !contentRef || contentLoadState === "loading") {
      return;
    }
    setContentLoadState("loading");
    try {
      const chunks: string[] = [];
      const seenCursors = new Set<string>();
      let cursor: string | null = null;
      do {
        if (cursor) {
          if (seenCursors.has(cursor)) {
            throw new Error("content cursor loop");
          }
          seenCursors.add(cursor);
        }
        const chunk = await codex.readTimelineContent(threadId, contentRef, cursor);
        if (chunk.completeness.status === "repair-required") {
          throw new Error(chunk.completeness.reason ?? "repair-required");
        }
        chunks.push(chunk.text);
        cursor = chunk.nextCursor;
      } while (cursor);
      const text = chunks.join("");
      setFullContent({ contentRef, text });
      const store = useStore.getState();
      store.ensureThread(threadId);
      store.replaceOrAddEntry(threadId, timelineEntryWithFullText(entry, text));
      setContentLoadState("idle");
    } catch {
      setContentLoadState("error");
    }
  };
  const content = (() => {
  switch (body.kind) {
    case "user-message":
      return (
        <UserMessage
          entry={entry}
          actionAvailable={!running && actionAvailable}
          running={running}
          onResend={() => onResendUser?.(body.text, body.imagePaths ?? [], body.skillReferences ?? [])}
          onRewind={() => onRewindToMessage?.(entry)}
          onFork={() => onForkFromMessage?.(entry)}
          onPreviewImage={onPreviewImage}
        />
      );
    case "agent-message":
      return <AgentMessage text={body.text} live={live} eagerMarkdown={eagerMarkdown} cacheKey={derivationKey} />;
    case "reasoning":
      return <ReasoningCard entry={body} />;
    case "command":
      return <CommandCard entry={body} cacheKey={derivationKey} />;
    case "diff":
      return <DiffCard entry={body} cacheKey={derivationKey} />;
    case "tool":
      return <ToolCard entry={body} cacheKey={derivationKey} />;
    case "system":
      return <SystemMessage entry={body} />;
    case "error":
      return <ErrorCard text={body.text} />;
    default:
      return <></>;
  }
  })();

  return (
    <>
      <TimelineRelativeTime createdAt={entry.createdAt} />
      {content}
      {entry.completeness && entry.completeness.status !== "complete" ? (
        <TimelineCompletenessFooter
          completeness={entry.completeness}
          contentLoaded={Boolean(fullContent && fullContent.contentRef === contentRef)}
          fullText={fullContent?.text ?? null}
          loadState={contentLoadState}
          canLoad={Boolean(threadId && contentRef)}
          onLoad={loadFullContent}
        />
      ) : null}
    </>
  );
}, timelineRowPropsEqual);

function timelineRowPropsEqual(previous: TimelineRowProps, next: TimelineRowProps): boolean {
  const userMessage = previous.entry.body.kind === "user-message" || next.entry.body.kind === "user-message";
  return (
    previous.entry === next.entry &&
    previous.threadId === next.threadId &&
    previous.live === next.live &&
    previous.actionAvailable === next.actionAvailable &&
    (!userMessage || previous.running === next.running) &&
    previous.eagerMarkdown === next.eagerMarkdown &&
    previous.onResendUser === next.onResendUser &&
    previous.onRewindToMessage === next.onRewindToMessage &&
    previous.onForkFromMessage === next.onForkFromMessage &&
    previous.onPreviewImage === next.onPreviewImage
  );
}

function timelineEntryWithFullText(entry: TimelineEntry, text: string): TimelineEntry {
  switch (entry.body.kind) {
    case "user-message":
    case "agent-message":
    case "reasoning":
    case "system":
    case "error":
      return { ...entry, completeness: { status: "complete" }, body: { ...entry.body, text } };
    case "tool":
      return { ...entry, completeness: { status: "complete" }, body: { ...entry.body, result: text } };
    case "command":
      return { ...entry, completeness: { status: "complete" }, body: { ...entry.body, output: text } };
    case "diff":
      return { ...entry, completeness: { status: "complete" }, body: { ...entry.body, diff: text } };
  }
}

function TimelineCompletenessFooter({
  completeness,
  contentLoaded,
  fullText,
  loadState,
  canLoad,
  onLoad
}: {
  completeness: NonNullable<TimelineEntry["completeness"]>;
  contentLoaded: boolean;
  fullText: string | null;
  loadState: "idle" | "loading" | "error";
  canLoad: boolean;
  onLoad: () => void | Promise<void>;
}): JSX.Element {
  const label =
    completeness.status === "repair-required"
      ? "内容需要修复"
      : completeness.status === "partial"
        ? "内容不完整"
        : "内容已截断";
  return (
    <div style={timelineCompletenessFooterStyle}>
      <span>{contentLoaded ? "完整内容已加载" : label}</span>
      {contentLoaded && fullText !== null ? (
        <button
          type="button"
          onClick={() => navigator.clipboard.writeText(fullText)}
          style={timelineCompletenessButtonStyle}
        >
          复制完整内容
        </button>
      ) : canLoad ? (
        <button
          type="button"
          disabled={loadState === "loading"}
          onClick={() => void onLoad()}
          style={timelineCompletenessButtonStyle}
        >
          {loadState === "loading" ? "正在读取" : loadState === "error" ? "重试" : "读取完整内容"}
        </button>
      ) : null}
    </div>
  );
}

const InlineActivityLog = memo(function InlineActivityLog({ entries }: { entries: TimelineEntry[] }): JSX.Element {
  timelineDerivationDiagnostics.inlineActivityRenderRuns += 1;
  const [openKeys, setOpenKeys] = useState<Set<string>>(() => new Set());
  const [openActionKeys, setOpenActionKeys] = useState<Set<string>>(() => new Set());
  const sectionsCacheKey = inlineActivitySectionsCacheKey(entries);
  const sections = useMemo(() => inlineActivitySections(entries), [sectionsCacheKey]);

  function toggleSection(key: string): void {
    setOpenKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  function toggleAction(actionKey: string): void {
    setOpenActionKeys((current) => {
      const next = new Set(current);
      if (next.has(actionKey)) {
        next.delete(actionKey);
      } else {
        next.add(actionKey);
      }
      return next;
    });
  }

  return (
    <div style={inlineActivityLogStyle}>
      <TimelineRelativeTime createdAt={entries[0]?.createdAt} compact />
      {sections.map((section) => {
        const canExpand = section.entries.length > 0;
        const open = canExpand && openKeys.has(section.key);
        return (
          <div key={section.key} style={inlineActivitySectionStyle}>
            <button
              type="button"
              {...(canExpand ? { "aria-expanded": open } : {})}
              onClick={() => {
                if (canExpand) {
                  toggleSection(section.key);
                }
              }}
              style={inlineActivityButtonStyle}
            >
              <span aria-hidden="true" style={inlineActivityIconStyle}>
                ▣
              </span>
              <span style={inlineActivityTitleStyle}>{section.title}</span>
              {section.failed ? <span style={inlineActivityFailedStyle}>失败</span> : null}
              {canExpand ? (
                <span aria-hidden="true" style={inlineActivityChevronStyle}>
                  {open ? "⌄" : "›"}
                </span>
              ) : null}
            </button>
            {open ? (
              shouldRenderDirectActivityDetails(section) ? (
                <DirectActivityDetails section={section} />
              ) : (
                <div style={activityDetailsStyle}>
                  {inlineActivityActionRows(section).map((row) => {
                    const entryOpen = openActionKeys.has(row.key);
                    return (
                      <div key={row.key} style={activityDetailItemStyle}>
                        <button
                          type="button"
                          aria-expanded={entryOpen}
                          onClick={() => toggleAction(row.key)}
                          style={inlineActivityEntryButtonStyle}
                        >
                          <span style={inlineActivityEntryTitleStyle}>{row.label}</span>
                          <span aria-hidden="true" style={inlineActivityChevronStyle}>
                            {entryOpen ? "⌄" : "›"}
                          </span>
                        </button>
                        {entryOpen ? <ActivityDetail entry={row.entry} /> : null}
                      </div>
                    );
                  })}
                </div>
              )
            ) : null}
          </div>
        );
      })}
    </div>
  );
}, (previous, next) => inlineActivitySectionsCacheKey(previous.entries) === inlineActivitySectionsCacheKey(next.entries));

function TimelineRelativeTime({
  createdAt,
  compact = false
}: {
  createdAt?: number;
  compact?: boolean;
}): JSX.Element | null {
  if (
    typeof createdAt !== "number" ||
    !Number.isFinite(createdAt) ||
    createdAt < MIN_REAL_TIMELINE_TIMESTAMP_MS
  ) {
    return null;
  }
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return (
    <time dateTime={date.toISOString()} style={compact ? timelineTimeCompactStyle : timelineTimeStyle}>
      {formatRelativeTimelineTime(createdAt)}
    </time>
  );
}

function formatRelativeTimelineTime(createdAt: number, now = Date.now()): string {
  const diffMs = Math.max(0, now - createdAt);
  const minuteMs = 60 * 1000;
  const hourMs = 60 * minuteMs;
  const dayMs = 24 * hourMs;
  const monthMs = 30 * dayMs;
  const yearMs = 365 * dayMs;

  if (diffMs < minuteMs) {
    return "刚刚";
  }
  if (diffMs < hourMs) {
    return `${Math.floor(diffMs / minuteMs)} 分钟前`;
  }
  if (diffMs < dayMs) {
    return `${Math.floor(diffMs / hourMs)} 小时前`;
  }
  if (diffMs < monthMs) {
    return `${Math.floor(diffMs / dayMs)} 天前`;
  }
  if (diffMs < yearMs) {
    return `${Math.floor(diffMs / monthMs)} 个月前`;
  }
  return `${Math.floor(diffMs / yearMs)} 年前`;
}

type InlineActivitySection = {
  key: string;
  kind: InlineActivitySectionKind;
  title: string;
  details: string[];
  entries: TimelineEntry[];
  failed: boolean;
};

type InlineActivityActionRow = {
  key: string;
  label: string;
  entry: TimelineEntry;
};

type InlineActivitySectionKind = "thinking" | "skills" | "commands" | "tools" | "files" | "fallback";

function inlineActivitySectionsCacheKey(entries: TimelineEntry[]): string {
  return entries.map(activityEntryCacheSignature).join("|");
}

function activityEntryCacheSignature(entry: TimelineEntry): string {
  return timelineEntryDerivationKey(entry);
}

function timelineEntryDerivationKey(entry: TimelineEntry): string {
  const body = entry.body;
  const base = [
    entry.id,
    entry.turnId ?? "",
    entry.generation ?? "",
    entry.snapshotSequence ?? "",
    body.kind,
    entry.completeness?.status ?? "",
    entry.completeness?.includedBytes ?? "",
    entry.completeness?.contentRef ?? ""
  ];
  switch (body.kind) {
    case "user-message":
      return [
        ...base,
        body.status ?? "",
        textCacheSignature(body.text),
        ...(body.imagePaths ?? []),
        ...(body.skillReferences ?? []).map((skill) => `${skill.name}:${skill.path}`)
      ].join(":");
    case "agent-message":
    case "system":
    case "error":
      return [...base, textCacheSignature(body.text)].join(":");
    case "reasoning":
      return [...base, body.done ? "done" : "running", textCacheSignature(body.text)].join(":");
    case "tool":
      return [
        ...base,
        body.status,
        body.toolKind,
        body.server,
        body.tool,
        textCacheSignature(body.arguments ?? ""),
        textCacheSignature(body.result ?? "")
      ].join(":");
    case "command":
      return [...base, body.status, body.command, textCacheSignature(body.output ?? "")].join(":");
    case "diff":
      return [...base, body.path, body.added, body.removed, textCacheSignature(body.diff)].join(":");
    default:
      return base.join(":");
  }
}

function textCacheSignature(text: string): string {
  if (!text) {
    return "0:0:0:0";
  }
  const middle = Math.floor(text.length / 2);
  const hash =
    (text.charCodeAt(0) * 31 + text.charCodeAt(middle) * 17 + text.charCodeAt(text.length - 1)) >>> 0;
  return `${text.length}:${hash}`;
}

function inlineActivitySections(entries: TimelineEntry[]): InlineActivitySection[] {
  timelineDerivationDiagnostics.inlineActivitySectionRuns += 1;
  const sections: InlineActivitySection[] = [];
  let currentKind: InlineActivitySectionKind | null = null;
  let currentEntries: TimelineEntry[] = [];

  const flush = () => {
    if (!currentKind || !currentEntries.length) {
      return;
    }
    sections.push(inlineActivitySection(currentKind, currentEntries, sections.length));
    currentKind = null;
    currentEntries = [];
  };

  for (const entry of entries) {
    const kind = inlineActivitySectionKind(entry);
    if (currentKind && kind !== currentKind) {
      flush();
    }
    currentKind = kind;
    currentEntries.push(entry);
  }
  flush();

  return sections.length
    ? sections
    : [
        {
          key: "fallback-0",
          kind: "fallback",
          title: `Used ${entries.length} tools`,
          details: entries.map(genericToolDetail),
          entries,
          failed: entries.some((entry) => activityEntryFailed(entry))
        }
      ];
}

function inlineActivitySectionKind(entry: TimelineEntry): InlineActivitySectionKind {
  if (entry.body.kind === "reasoning") {
    return "thinking";
  }
  if (isSkillsLoadedActivity(entry)) {
    return "skills";
  }
  if (isCommandActivity(entry) || isReadActivity(entry) || isListActivity(entry) || isSearchActivity(entry)) {
    return "commands";
  }
  if (entry.body.kind === "diff" || isFileChangeActivity(entry)) {
    return "files";
  }
  if (entry.body.kind === "tool") {
    return "tools";
  }
  return "fallback";
}

function inlineActivitySection(
  kind: InlineActivitySectionKind,
  entries: TimelineEntry[],
  index: number
): InlineActivitySection {
  if (kind === "thinking") {
    const running = entries.some((entry) => entry.body.kind === "reasoning" && !entry.body.done);
    return {
      key: `thinking-${index}`,
      kind,
      title: running ? "Thinking..." : "Thinking",
      details: [],
      entries,
      failed: entries.some((entry) => activityEntryFailed(entry))
    };
  }

  if (kind === "skills") {
    const names = entries.flatMap((entry) => skillNamesFromActivity(entry));
    const count = names.length || entries.length;
    return {
      key: `skills-${index}`,
      kind,
      title: count === 1 ? "Loaded a tool" : `Loaded ${count} tools`,
      details: names.length ? names.map((name) => `读取 ${name} 技能`) : [`${count} tools`],
      entries,
      failed: entries.some((entry) => activityEntryFailed(entry))
    };
  }

  if (kind === "commands") {
    const commandActions = entries.filter(
      (entry) => isCommandActivity(entry) && !isReadActivity(entry) && !isListActivity(entry) && !isSearchActivity(entry)
    );
    const readActions = entries.filter((entry) => isReadActivity(entry));
    const listActions = entries.filter((entry) => isListActivity(entry));
    const searchActions = entries.filter((entry) => isSearchActivity(entry));
    return {
      key: `commands-${index}`,
      kind,
      title: commandActivityTitle({
        read: readActions.length,
        list: listActions.length,
        search: searchActions.length,
        command: commandActions.length
      }),
      details: entries.map(commandActivityDetail),
      entries,
      failed: entries.some((entry) => activityEntryFailed(entry))
    };
  }

  if (kind === "tools") {
    return {
      key: `tools-${index}`,
      kind,
      title: `Used ${entries.length} tools`,
      details: entries.map(genericToolDetail),
      entries,
      failed: entries.some((entry) => activityEntryFailed(entry))
    };
  }

  if (kind === "files") {
    const stats = entries.reduce(
      (sum, entry) => {
        if (entry.body.kind === "diff") {
          return { added: sum.added + entry.body.added, removed: sum.removed + entry.body.removed };
        }
        if (entry.body.kind === "tool") {
          return { added: sum.added + (entry.body.added ?? 0), removed: sum.removed + (entry.body.removed ?? 0) };
        }
        return sum;
      },
      { added: 0, removed: 0 }
    );
    return {
      key: `files-${index}`,
      kind,
      title: `Files changed · ${entries.length} · +${stats.added} -${stats.removed}`,
      details: entries.map(fileChangeDetail),
      entries,
      failed: entries.some((entry) => activityEntryFailed(entry))
    };
  }

  return {
    key: `fallback-${index}`,
    kind,
    title: `Used ${entries.length} tools`,
    details: entries.map(genericToolDetail),
    entries,
    failed: entries.some((entry) => activityEntryFailed(entry))
  };
}

function inlineActivityActionRows(section: InlineActivitySection): InlineActivityActionRow[] {
  return section.entries.flatMap((entry, entryIndex) => {
    if (isSkillsLoadedActivity(entry)) {
      const names = skillNamesFromActivity(entry);
      if (names.length) {
        return names.map((name, nameIndex) => ({
          key: `${entry.id}-skill-${nameIndex}`,
          label: `读取 ${name} 技能`,
          entry
        }));
      }
    }

    return [
      {
        key: entry.id,
        label: section.details[entryIndex] ?? genericToolDetail(entry),
        entry
      }
    ];
  });
}

function commandActivityTitle(counts: { read: number; list: number; search: number; command: number }): string {
  const parts: string[] = [];
  if (counts.read) {
    parts.push(`已读取 ${counts.read} 个文件`);
  }
  if (counts.list) {
    parts.push(`已浏览 ${counts.list} 个目录`);
  }
  if (counts.search) {
    parts.push(`已搜索 ${counts.search} 次`);
  }
  if (counts.command) {
    parts.push(`已运行 ${counts.command} 条命令`);
  }
  return parts.join("") || "已运行命令";
}

function commandActivityDetail(entry: TimelineEntry): string {
  const command = activityCommandText(entry);
  if (isReadActivity(entry)) {
    return `Read ${commandTarget(command, "read")}`;
  }
  if (isListActivity(entry)) {
    return `List ${commandTarget(command, "list")}`;
  }
  if (isSearchActivity(entry)) {
    return `Searched ${commandTarget(command, "search")}`;
  }
  return `已运行 ${shortInlineText(command || "command")}`;
}

function fileChangeDetail(entry: TimelineEntry): string {
  if (entry.body.kind === "diff") {
    return `${shortInlineText(entry.body.path)} · +${entry.body.added} -${entry.body.removed}`;
  }
  if (entry.body.kind === "tool") {
    return `${shortInlineText(entry.body.diffPath ?? entry.body.tool)} · +${entry.body.added ?? 0} -${entry.body.removed ?? 0}`;
  }
  return genericToolDetail(entry);
}

function genericToolDetail(entry: TimelineEntry): string {
  const body = entry.body;
  if (body.kind === "tool") {
    return shortInlineText([body.server, body.tool].filter(Boolean).join(" · "));
  }
  if (body.kind === "command") {
    return `已运行 ${shortInlineText(body.command)}`;
  }
  if (body.kind === "reasoning") {
    return body.done ? "Thinking" : "Thinking...";
  }
  if (body.kind === "diff") {
    return fileChangeDetail(entry);
  }
  return shortInlineText(entry.id);
}

function activityCommandText(entry: TimelineEntry): string {
  if (entry.body.kind === "command") {
    return entry.body.command;
  }
  if (entry.body.kind === "tool") {
    return entry.body.tool;
  }
  return "";
}

function commandTarget(command: string, kind: "read" | "list" | "search"): string {
  const words = shellWords(command);
  if (!words.length) {
    return kind === "search" ? "search" : "target";
  }
  if (kind === "search") {
    const query = words.slice(1).find((word) => !word.startsWith("-"));
    return shortInlineText(query ?? words.at(-1) ?? "search");
  }
  const target = [...words].reverse().find((word) => !word.startsWith("-") && !/^\d+(,\d+)?p$/.test(word));
  return shortInlineText(target ?? words.at(-1) ?? "target");
}

function shellWords(command: string): string[] {
  const words: string[] = [];
  const pattern = /"([^"]*)"|'([^']*)'|(\S+)/g;
  for (const match of command.matchAll(pattern)) {
    const word = match[1] ?? match[2] ?? match[3] ?? "";
    if (word) {
      words.push(word);
    }
  }
  return words;
}

function shortInlineText(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > 88 ? `${clean.slice(0, 85)}...` : clean;
}

function isCommandActivity(entry: TimelineEntry): boolean {
  return entry.body.kind === "command" || (entry.body.kind === "tool" && entry.body.toolKind === "command");
}

function isFileChangeActivity(entry: TimelineEntry): boolean {
  return entry.body.kind === "tool" && entry.body.toolKind === "file";
}

function isSkillsLoadedActivity(entry: TimelineEntry): boolean {
  return entry.body.kind === "tool" && entry.body.server === "skills" && entry.body.tool === "loaded";
}

function skillNamesFromActivity(entry: TimelineEntry): string[] {
  if (!isSkillsLoadedActivity(entry) || entry.body.kind !== "tool") {
    return [];
  }
  return (entry.body.result ?? "")
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
}

function isToolNamed(entry: TimelineEntry, pattern: RegExp): boolean {
  if (entry.body.kind === "command") {
    return pattern.test(entry.body.command.split(/\s+/)[0] ?? "");
  }
  if (entry.body.kind !== "tool") {
    return false;
  }
  return pattern.test(entry.body.tool.split(/\s+/)[0] ?? "");
}

function isReadActivity(entry: TimelineEntry): boolean {
  if (entry.body.kind === "tool" && entry.body.actionKind === "read") {
    return true;
  }
  return isToolNamed(entry, /^(read|cat|sed|head|tail|less|nl)$/i);
}

function isListActivity(entry: TimelineEntry): boolean {
  if (entry.body.kind === "tool" && entry.body.actionKind === "list") {
    return true;
  }
  return isToolNamed(entry, /^(list|ls|dir|tree)$/i);
}

function isSearchActivity(entry: TimelineEntry): boolean {
  if (entry.body.kind === "tool" && entry.body.actionKind === "search") {
    return true;
  }
  return isToolNamed(entry, /^(search|rg|grep|find)$/i);
}

function activityEntryFailed(entry: TimelineEntry): boolean {
  return (
    (entry.body.kind === "tool" && entry.body.status === "failed") ||
    (entry.body.kind === "command" && entry.body.status === "failed")
  );
}

function shouldRenderDirectActivityDetails(section: InlineActivitySection): boolean {
  return section.failed || section.kind === "thinking" || section.kind === "files";
}

function DirectActivityDetails({ section }: { section: InlineActivitySection }): JSX.Element {
  return (
    <div style={activityDetailsStyle}>
      {section.entries.map((entry, index) => (
        <DirectActivityDetail
          key={entry.id}
          entry={entry}
          label={section.details[index] ?? genericToolDetail(entry)}
          showTitle={section.kind !== "thinking"}
        />
      ))}
    </div>
  );
}

function DirectActivityDetail({
  entry,
  label,
  showTitle
}: {
  entry: TimelineEntry;
  label: string;
  showTitle: boolean;
}): JSX.Element {
  const body = entry.body;
  const cacheKey = timelineEntryDerivationKey(entry);
  if (body.kind === "reasoning") {
    return (
      <ActivityDetailText
        text={body.text.trim() || (body.done ? "" : "Thinking...")}
        showTitle={false}
        cacheKey={cacheKey}
      />
    );
  }
  if (body.kind === "tool") {
    if (body.toolKind === "file") {
      return (
        <InlineDiffActivityDetail
          path={body.diffPath ?? body.tool}
          added={body.added ?? 0}
          removed={body.removed ?? 0}
          diff={fileActivityDiffText(body)}
          cacheKey={cacheKey}
        />
      );
    }
    return (
      <ActivityDetailText
        title={body.toolKind === "command" ? body.tool : `${body.diffPath ?? body.tool}`}
        text={[body.arguments, body.result].filter(Boolean).join("\n") || body.tool}
        showTitle={showTitle}
        cacheKey={cacheKey}
      />
    );
  }
  if (body.kind === "command") {
    return <ActivityDetailText title={body.command} text={body.output ?? body.command} showTitle={showTitle} cacheKey={cacheKey} />;
  }
  if (body.kind === "diff") {
    return (
      <InlineDiffActivityDetail
        path={body.path}
        added={body.added}
        removed={body.removed}
        diff={body.diff}
        showTitle={showTitle}
        cacheKey={cacheKey}
      />
    );
  }
  return <ActivityDetailText title={label} text={label} showTitle={showTitle} cacheKey={cacheKey} />;
}

function ActivityDetail({ entry }: { entry: TimelineEntry }): JSX.Element {
  const body = entry.body;
  const cacheKey = timelineEntryDerivationKey(entry);
  if (body.kind === "reasoning") {
    return (
      <ActivityDetailText
        title={body.done ? "Thinking" : "Thinking..."}
        text={body.text.trim() || (body.done ? "" : "Thinking...")}
        cacheKey={cacheKey}
      />
    );
  }
  if (body.kind === "tool") {
    return (
      <ActivityDetailText
        title={body.toolKind === "command" ? body.tool : `${body.server} · ${body.diffPath ?? body.tool}`}
        text={[body.arguments, body.result].filter(Boolean).join("\n") || body.tool}
        cacheKey={cacheKey}
      />
    );
  }
  if (body.kind === "command") {
    return <ActivityDetailText title={body.command} text={body.output ?? body.command} cacheKey={cacheKey} />;
  }
  if (body.kind === "diff") {
    return <ActivityDetailText title={body.path} text={body.diff} cacheKey={cacheKey} />;
  }
  return <></>;
}

function InlineDiffActivityDetail({
  path,
  added,
  removed,
  diff,
  showTitle = true,
  cacheKey
}: {
  path: string;
  added: number;
  removed: number;
  diff: string;
  showTitle?: boolean;
  cacheKey?: string;
}): JSX.Element {
  return (
    <div style={activityDetailItemStyle}>
      {showTitle ? (
        <div style={inlineDiffHeaderStyle}>
          <span style={inlineDiffPathStyle}>{path}</span>
          <span style={inlineDiffAddedStyle}>+{added}</span>
          <span style={inlineDiffRemovedStyle}>-{removed}</span>
        </div>
      ) : null}
      <DiffView diff={diff} cacheKey={cacheKey ? `${cacheKey}:inline-diff` : undefined} />
    </div>
  );
}

function fileActivityDiffText(body: Extract<TimelineEntry["body"], { kind: "tool" }>): string {
  const args = body.arguments?.trim() ?? "";
  const result = body.result?.trim() ?? "";
  if (args && result && args !== result) {
    return `${args}\n${result}`;
  }
  return result || args || body.tool;
}

function ActivityDetailText({
  title,
  text,
  showTitle = true,
  cacheKey
}: {
  title?: string;
  text: string;
  showTitle?: boolean;
  cacheKey?: string;
}): JSX.Element {
  return (
    <div style={activityDetailItemStyle}>
      {showTitle && title ? <div style={activityDetailTitleStyle}>{title}</div> : null}
      {text.trim() ? (
        <div style={activityDetailPreviewStyle}>
          <LongTextPreview text={text} emptyText="（无内容）" copyLabel="复制完整详情" maxLines={80} cacheKey={cacheKey} />
        </div>
      ) : null}
    </div>
  );
}

function AgentMessage({
  text,
  live,
  eagerMarkdown,
  cacheKey
}: {
  text: string;
  live: boolean;
  eagerMarkdown: boolean;
  cacheKey: string;
}): JSX.Element {
  if (live) {
    return (
      <div style={agentMessageStyle}>
        <PlainAgentText text={text} />
      </div>
    );
  }
  return <LazyAgentMarkdown text={text} eagerMarkdown={eagerMarkdown} cacheKey={cacheKey} />;
}

function LazyAgentMarkdown({
  text,
  eagerMarkdown,
  cacheKey
}: {
  text: string;
  eagerMarkdown: boolean;
  cacheKey: string;
}): JSX.Element {
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
      {renderMarkdown ? <Markdown text={text} cacheKey={cacheKey} /> : <PlainAgentText text={text} />}
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
  const userMessageCountByTurn = new Map<string, number>();
  const userMessageEntries: TimelineEntry[] = [];
  let latestAgentAfterLastUser: string | null = null;

  for (const entry of entries) {
    if (entry.body.kind === "user-message") {
      if (entry.turnId) {
        userMessageEntries.push(entry);
        userMessageCountByTurn.set(entry.turnId, (userMessageCountByTurn.get(entry.turnId) ?? 0) + 1);
      }
      latestAgentAfterLastUser = null;
      continue;
    }

    if (running && entry.body.kind === "agent-message") {
      if (activeTurnId && entry.turnId === activeTurnId) {
        liveAgentEntryIds.add(entry.id);
      } else if (!activeTurnId) {
        latestAgentAfterLastUser = entry.id;
      }
    }
  }

  for (const entry of userMessageEntries) {
    if (entry.turnId && userMessageCountByTurn.get(entry.turnId) === 1) {
      messageActionAvailableById.set(entry.id, true);
    }
  }

  if (running && !activeTurnId && latestAgentAfterLastUser) {
    liveAgentEntryIds.add(latestAgentAfterLastUser);
  }

  return { liveAgentEntryIds, messageActionAvailableById };
}

const agentMessageStyle: React.CSSProperties = {
  padding: "4px 14px",
  maxWidth: "100%",
  minWidth: 0,
  overflowX: "hidden"
};

const plainAgentTextStyle: React.CSSProperties = {
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
  overflowWrap: "anywhere"
};

const timelineTimeStyle: React.CSSProperties = {
  display: "block",
  padding: "0 14px",
  margin: "0 0 2px",
  color: "var(--cw-fg-muted)",
  fontSize: 11,
  lineHeight: 1.3
};

const timelineRowStyle: React.CSSProperties = {
  maxWidth: "100%",
  minWidth: 0,
  overflowX: "hidden",
  marginBottom: TIMELINE_BLOCK_GAP
};

const timelineCompletenessFooterStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  margin: "4px 14px 0",
  color: "var(--cw-fg-muted)",
  fontSize: 12
};

const timelineCompletenessButtonStyle: React.CSSProperties = {
  border: "1px solid var(--cw-border)",
  background: "var(--cw-surface)",
  color: "var(--cw-fg)",
  padding: "5px 8px",
  borderRadius: 6,
  fontSize: 12,
  cursor: "pointer"
};

const timelineTimeCompactStyle: React.CSSProperties = {
  display: "block",
  margin: "0 0 1px 20px",
  color: "var(--cw-fg-muted)",
  fontSize: 11,
  lineHeight: 1.3
};

const inlineActivityLogStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
  padding: "2px 14px 4px",
  color: "var(--cw-fg-muted)"
};

const inlineActivitySectionStyle: React.CSSProperties = {
  minWidth: 0
};

const inlineActivityButtonStyle: React.CSSProperties = {
  width: "100%",
  display: "flex",
  alignItems: "center",
  gap: 6,
  padding: "2px 0",
  background: "transparent",
  border: "none",
  minWidth: 0,
  color: "var(--cw-fg-muted)",
  textAlign: "left"
};

const inlineActivityIconStyle: React.CSSProperties = {
  flex: "0 0 auto",
  width: 14,
  color: "var(--cw-fg-muted)",
  fontSize: 12,
  lineHeight: 1
};

const inlineActivityTitleStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  fontSize: 13,
  fontWeight: 500,
  lineHeight: 1.35
};

const inlineActivityFailedStyle: React.CSSProperties = {
  flex: "0 0 auto",
  color: "var(--cw-danger)",
  fontSize: 12
};

const inlineActivityChevronStyle: React.CSSProperties = {
  flex: "0 0 auto",
  width: 12,
  color: "var(--cw-fg-muted)"
};

const inlineActivityEntryButtonStyle: React.CSSProperties = {
  width: "100%",
  display: "flex",
  alignItems: "center",
  gap: 6,
  padding: "1px 0",
  background: "transparent",
  border: "none",
  color: "var(--cw-fg-muted)",
  textAlign: "left",
  minWidth: 0
};

const inlineActivityEntryTitleStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  color: "var(--cw-fg-muted)",
  fontSize: 13,
  lineHeight: 1.45
};

const activityDetailsStyle: React.CSSProperties = {
  margin: "4px 0 2px 20px",
  padding: "6px 0 0",
  display: "flex",
  flexDirection: "column",
  gap: 8,
  maxHeight: 520,
  overflowY: "auto"
};

const activityDetailItemStyle: React.CSSProperties = {
  minWidth: 0
};

const activityDetailTitleStyle: React.CSSProperties = {
  fontSize: 12,
  color: "var(--cw-fg-muted)",
  fontFamily: "var(--font-mono)",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap"
};

const inlineDiffHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  minWidth: 0,
  fontFamily: "var(--font-mono)",
  fontSize: 12
};

const inlineDiffPathStyle: React.CSSProperties = {
  minWidth: 0,
  flex: 1,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  color: "var(--cw-fg-muted)"
};

const inlineDiffAddedStyle: React.CSSProperties = {
  flex: "0 0 auto",
  color: "var(--cw-success)"
};

const inlineDiffRemovedStyle: React.CSSProperties = {
  flex: "0 0 auto",
  color: "var(--cw-danger)"
};

const activityDetailPreviewStyle: React.CSSProperties = {
  margin: "4px 0 0",
  padding: 8,
  borderRadius: 8,
  background: "var(--cw-bg-elevated)",
  color: "var(--cw-fg)"
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
  timelineDerivationDiagnostics.inlineActivitySectionRuns = 0;
  timelineDerivationDiagnostics.timelineRowRenderRuns = 0;
  timelineDerivationDiagnostics.inlineActivityRenderRuns = 0;
}
