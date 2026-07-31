"use client";

import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen,
  Bot,
  Box,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  FileText,
  FolderOpen,
  Globe2,
  Image as ImageIcon,
  Pencil,
  Search,
  Terminal as TerminalIcon,
  Wrench
} from "lucide-react";
import { skillDisplayName, type TimelineEntry } from "../state/timeline";
import type { PendingServerRequest, SkillReference } from "../api/types";
import { Markdown } from "./Markdown";
import { splitStreamingMarkdown } from "../streaming-markdown";
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
import {
  createActivityPresentation,
  timelineEntriesForPresentation,
  type ActivityPresentationItem
} from "../state/timeline-presentation";

const EAGER_MARKDOWN_TEXT_LIMIT = 1_500;
const LAZY_MARKDOWN_TEXT_LIMIT = 24_000;
const LAZY_MARKDOWN_ROOT_MARGIN = "720px 0px";
const MAX_INITIAL_TIMELINE_ROWS = 80;
const TIMELINE_WINDOW_BUFFER_ROWS = 20;
const EAGER_MARKDOWN_TAIL_ROWS = 2;
const ESTIMATED_TIMELINE_ROW_HEIGHT = 72;
const MIN_MEASURED_TIMELINE_ROW_HEIGHT = 24;
const TIMELINE_BLOCK_GAP = 10;

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
  onResendUser?: (entry: TimelineEntry) => void;
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
  const presentationEntries = useMemo(
    () => timelineEntriesForPresentation(entries, { running, activeTurnId }),
    [entries, running, activeTurnId]
  );
  const allBlocks = useMemo(() => deriveTimelineRenderBlocks(presentationEntries), [presentationEntries]);
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
    firstId: allBlocks[0]?.identity ?? null,
    lastId: allBlocks[allBlocks.length - 1]?.identity ?? null
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
  const virtualized = allBlocks.length > MAX_INITIAL_TIMELINE_ROWS;
  const rowState = useMemo(
    () => deriveTimelineRowState(visibleEntries, running, activeTurnId),
    [visibleEntries, running, activeTurnId]
  );

  useLayoutEffect(() => {
    const previous = previousBlocksRef.current;
    const nextFirstId = allBlocks[0]?.identity ?? null;
    const nextLastId = allBlocks[allBlocks.length - 1]?.identity ?? null;
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
  }, [allBlocks.length, allBlocks[0]?.identity, allBlocks[allBlocks.length - 1]?.identity, followTail]);

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
      virtualized &&
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
    if (scroller && virtualized) {
      scrollAnchorRef.current = captureTimelineScrollAnchor(
        allBlocks,
        layoutIndex,
        scroller.scrollTop,
        scroller.clientHeight
      );
    } else if (!virtualized) {
      scrollAnchorRef.current = null;
    }
  }, [allBlocks, layoutIndex, followTail, virtualized, windowRange.start, windowRange.end]);

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
      if (scroller && virtualized) {
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
  }, [allBlocks, layoutIndex, virtualized, visibleBlocks]);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) {
      return;
    }

    const scroller = findTimelineScrollContainer(root);
    if (!scroller) {
      return;
    }

    if (virtualized) {
      scroller.dataset.timelineAnchorManaged = "true";
    }

    const updateVisibleWindow = () => {
      if (virtualized) {
        scrollAnchorRef.current = captureTimelineScrollAnchor(
          allBlocks,
          layoutIndex,
          scroller.scrollTop,
          scroller.clientHeight
        );
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
            key={block.identity}
            data-timeline-row="true"
            data-timeline-block-id={block.id}
            data-timeline-block-identity={block.identity}
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
                live={rowState.liveAgentEntryIds.has(timelineEntryRenderIdentity(block.entry))}
                actionAvailable={
                  rowState.messageActionAvailableById.get(timelineEntryRenderIdentity(block.entry)) ?? false
                }
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
  | { kind: "entry"; id: string; identity: string; version: string; entry: TimelineEntry }
  | {
      kind: "inline-activity-log";
      id: string;
      identity: string;
      version: string;
      turnId?: string;
      entries: TimelineEntry[];
    };

function timelineRenderBlockEntryId(block: TimelineRenderBlock): string {
  return block.kind === "entry" ? block.entry.id : block.entries.at(-1)?.id ?? block.id;
}

function timelineRenderBlockEntryIdentity(block: TimelineRenderBlock): string {
  return block.kind === "entry"
    ? timelineEntryRenderIdentity(block.entry)
    : block.entries.at(-1)
      ? timelineEntryRenderIdentity(block.entries.at(-1)!)
      : block.identity;
}

export function deriveTimelineRenderBlocks(entries: TimelineEntry[]): TimelineRenderBlock[] {
  const blocks: TimelineRenderBlock[] = [];
  const usedBlockIdentities = new Set<string>();
  const renderEntries = dedupeTimelineEntriesForRender(entries);
  let index = 0;
  while (index < renderEntries.length) {
    const entry = renderEntries[index]!;
    if (!isActivityEntry(entry)) {
      const entryIdentity = timelineEntryRenderIdentity(entry);
      blocks.push({
        kind: "entry",
        id: entry.id,
        identity: claimTimelineBlockIdentity(usedBlockIdentities, entryIdentity, entryIdentity),
        version: timelineEntryDerivationKey(entry),
        entry
      });
      index += 1;
      continue;
    }

    const turnId = entry.turnId;
    const activityEntries: TimelineEntry[] = [entry];
    index += 1;
    while (index < renderEntries.length) {
      const next = renderEntries[index]!;
      if (!isActivityEntry(next) || next.turnId !== turnId) {
        break;
      }
      activityEntries.push(next);
      index += 1;
    }

    const blockId = `inline-activity-${turnId ?? "no-turn"}-${activityEntries[0]!.id}`;
    blocks.push({
      kind: "inline-activity-log",
      id: blockId,
      identity: claimTimelineBlockIdentity(
        usedBlockIdentities,
        blockId,
        timelineEntryRenderIdentity(activityEntries[0]!)
      ),
      version: inlineActivitySectionsCacheKey(activityEntries),
      ...(turnId ? { turnId } : {}),
      entries: activityEntries
    });
  }
  return blocks;
}

function claimTimelineBlockIdentity(used: Set<string>, preferred: string, collisionIdentity: string): string {
  let identity = preferred;
  let collisionIndex = 1;
  while (used.has(identity)) {
    identity = JSON.stringify([preferred, collisionIdentity, collisionIndex]);
    collisionIndex += 1;
  }
  used.add(identity);
  return identity;
}

function dedupeTimelineEntriesForRender(entries: TimelineEntry[]): TimelineEntry[] {
  const result: TimelineEntry[] = [];
  const indexes = new Map<string, number>();
  for (const entry of entries) {
    const identity = timelineEntryRenderIdentity(entry);
    const existingIndex = indexes.get(identity);
    if (existingIndex === undefined) {
      indexes.set(identity, result.length);
      result.push(entry);
    } else {
      result[existingIndex] = entry;
    }
  }
  return result;
}

function timelineEntryRenderIdentity(entry: TimelineEntry): string {
  if (entry.body.kind === "user-message" && entry.clientUserMessageId) {
    return JSON.stringify(["user", "client", entry.clientUserMessageId]);
  }
  return JSON.stringify([
    entry.historyStamp?.bootId ?? entry.bootId ?? "legacy",
    entry.historyStamp?.generation ?? entry.generation ?? "legacy",
    entry.turnId ?? "none",
    entry.body.kind,
    entry.id
  ]);
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
    const blockIdentity = row.dataset.timelineBlockIdentity;
    const blockVersion = row.dataset.timelineBlockVersion;
    if (!blockIdentity || !blockVersion) {
      return;
    }
    const cacheKey = `${blockIdentity}\u0000${blockVersion}`;
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
  return `${block.identity}\u0000${block.version}`;
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
    blockId: block.identity,
    entryId: timelineRenderBlockEntryIdentity(block),
    beforeEntryId: blockIndex > 0 ? timelineRenderBlockLastEntryId(blocks[blockIndex - 1]!) : null,
    afterEntryId: blockIndex + 1 < blocks.length ? timelineRenderBlockEntryIdentity(blocks[blockIndex + 1]!) : null,
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
  let blockIndex = blocks.findIndex((block) => block.identity === anchor.blockId);
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
  return block.kind === "entry"
    ? timelineEntryRenderIdentity(block.entry) === entryId
    : block.entries.some((entry) => timelineEntryRenderIdentity(entry) === entryId);
}

function timelineRenderBlockLastEntryId(block: TimelineRenderBlock): string {
  return block.kind === "entry"
    ? timelineEntryRenderIdentity(block.entry)
    : block.entries.at(-1)
      ? timelineEntryRenderIdentity(block.entries.at(-1)!)
      : block.identity;
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
  onResendUser?: (entry: TimelineEntry) => void;
  onRewindToMessage?: (entry: TimelineEntry) => void | Promise<void>;
  onForkFromMessage?: (entry: TimelineEntry) => void | Promise<void>;
  onPreviewImage: (src: string) => void;
};

type FullContentIdentity = {
  threadId: string;
  entryId: string;
  turnId?: string;
  contentRef: string;
};

type FullContentState = FullContentIdentity & {
  text: string;
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
  const [fullContent, setFullContent] = useState<FullContentState | null>(null);
  const [contentLoadState, setContentLoadState] = useState<"idle" | "loading" | "error">("idle");
  const contentRef = entry.completeness?.contentRef;
  const currentFullContentIdentity =
    threadId && contentRef
      ? {
          threadId,
          entryId: entry.id,
          turnId: entry.turnId,
          contentRef
        }
      : null;
  const currentFullContentIdentityRef = useRef<FullContentIdentity | null>(currentFullContentIdentity);
  currentFullContentIdentityRef.current = currentFullContentIdentity;
  const contentLoaded = sameFullContentIdentity(fullContent, currentFullContentIdentity);
  const renderedEntry =
    fullContent && contentLoaded
      ? timelineEntryWithFullText(entry, fullContent.text)
      : entry;
  const body = renderedEntry.body;
  const derivationKey = timelineEntryDerivationKey(renderedEntry);

  useEffect(() => {
    setFullContent((current) =>
      sameFullContentIdentity(current, currentFullContentIdentity) ? current : null
    );
    setContentLoadState("idle");
  }, [threadId, entry.id, entry.turnId, contentRef]);

  useEffect(() => {
    return () => {
      currentFullContentIdentityRef.current = null;
    };
  }, []);

  const loadFullContent = async () => {
    const requestIdentity = currentFullContentIdentityRef.current;
    if (!requestIdentity || contentLoadState === "loading") {
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
        const chunk = await codex.readTimelineContent(requestIdentity.threadId, requestIdentity.contentRef, cursor);
        if (!sameFullContentIdentity(currentFullContentIdentityRef.current, requestIdentity)) {
          return;
        }
        if (chunk.completeness.status === "repair-required") {
          throw new Error(chunk.completeness.reason ?? "repair-required");
        }
        chunks.push(chunk.text);
        cursor = chunk.nextCursor;
      } while (cursor);
      const text = chunks.join("");
      if (!sameFullContentIdentity(currentFullContentIdentityRef.current, requestIdentity)) {
        return;
      }
      const storeEntry = findFullContentStoreEntry(requestIdentity);
      if (!storeEntry) {
        setContentLoadState("idle");
        return;
      }
      setFullContent({ ...requestIdentity, text });
      useStore.getState().replaceOrAddEntry(
        requestIdentity.threadId,
        timelineEntryWithFullText(storeEntry, text)
      );
      setContentLoadState("idle");
    } catch {
      if (sameFullContentIdentity(currentFullContentIdentityRef.current, requestIdentity)) {
        setContentLoadState("error");
      }
    }
  };
  const content = (() => {
  switch (body.kind) {
    case "user-message":
      return (
        <UserMessage
          entry={renderedEntry}
          actionAvailable={!running && actionAvailable}
          running={running}
          onResend={() => onResendUser?.(renderedEntry)}
          onRewind={() => onRewindToMessage?.(renderedEntry)}
          onFork={() => onForkFromMessage?.(renderedEntry)}
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
      {content}
      {entry.completeness && entry.completeness.status !== "complete" ? (
        <TimelineCompletenessFooter
          completeness={entry.completeness}
          contentLoaded={contentLoaded}
          fullText={contentLoaded ? fullContent?.text ?? null : null}
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

function sameFullContentIdentity(
  left: FullContentIdentity | null | undefined,
  right: FullContentIdentity | null | undefined
): boolean {
  return Boolean(
    left &&
    right &&
    left.threadId === right.threadId &&
    left.entryId === right.entryId &&
    left.turnId === right.turnId &&
    left.contentRef === right.contentRef
  );
}

function findFullContentStoreEntry(identity: FullContentIdentity): TimelineEntry | null {
  return useStore.getState().threads[identity.threadId]?.entries.find((candidate) =>
    candidate.id === identity.entryId &&
    candidate.turnId === identity.turnId &&
    candidate.completeness?.contentRef === identity.contentRef
  ) ?? null;
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
  const [open, setOpen] = useState(false);
  const [openActionKeys, setOpenActionKeys] = useState<Set<string>>(() => new Set());
  const presentationCacheKey = inlineActivitySectionsCacheKey(entries);
  const presentation = useMemo(() => {
    timelineDerivationDiagnostics.inlineActivitySectionRuns += 1;
    return createActivityPresentation(entries);
  }, [presentationCacheKey]);
  const thinkingOnly = presentation.items.length === 1 && presentation.items[0]?.kind === "thinking";

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
      {thinkingOnly ? (
        <div style={inlineActivityButtonStyle} role="status">
          <span style={inlineActivityTitleStyle}>{presentation.summary}</span>
        </div>
      ) : (
        <>
          <button
            type="button"
            aria-expanded={open}
            aria-label={presentation.summary}
            onClick={() => setOpen((current) => !current)}
            style={inlineActivityButtonStyle}
          >
            <span
              aria-hidden="true"
              data-activity-summary-icon={presentation.summaryKind}
              style={activityActionIconStyle}
            >
              <ActivityKindIcon kind={presentation.summaryKind} />
            </span>
            <span style={inlineActivityTitleStyle}>{presentation.summary}</span>
            {open ? (
              <ChevronDown aria-hidden="true" size={15} strokeWidth={1.8} />
            ) : (
              <ChevronRight aria-hidden="true" size={15} strokeWidth={1.8} />
            )}
          </button>
          {open ? (
            <div data-activity-action-list="true" style={activityActionListStyle}>
              {presentation.items.map((item) => (
                <ActivityPresentationRow
                  key={item.key}
                  item={item}
                  open={openActionKeys.has(item.key)}
                  onToggle={() => toggleAction(item.key)}
                />
              ))}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}, (previous, next) => inlineActivitySectionsCacheKey(previous.entries) === inlineActivitySectionsCacheKey(next.entries));

function ActivityPresentationRow({
  item,
  open,
  onToggle
}: {
  item: ActivityPresentationItem;
  open: boolean;
  onToggle: () => void;
}): JSX.Element {
  return (
    <div data-activity-action-kind={item.kind} style={activityActionItemStyle}>
      <button
        type="button"
        aria-expanded={open}
        aria-label={item.label}
        onClick={onToggle}
        style={inlineActivityEntryButtonStyle}
      >
        <span aria-hidden="true" style={activityActionIconStyle}>
          <ActivityKindIcon kind={item.kind} />
        </span>
        <span style={inlineActivityEntryTitleStyle}>{item.label}</span>
        {activityEntryFailed(item.entry) ? (
          <CircleAlert aria-label="失败" size={14} strokeWidth={1.8} style={{ color: "var(--cw-danger)" }} />
        ) : null}
        {open ? (
          <ChevronDown aria-hidden="true" size={15} strokeWidth={1.8} />
        ) : (
          <ChevronRight aria-hidden="true" size={15} strokeWidth={1.8} />
        )}
      </button>
      {open ? <ActivityDetail entry={item.entry} /> : null}
    </div>
  );
}

function ActivityKindIcon({ kind }: { kind: ActivityPresentationItem["kind"] }): JSX.Element {
  const props = { size: 15, strokeWidth: 1.8 };
  switch (kind) {
    case "skill":
      return <BookOpen {...props} />;
    case "subagent":
      return <Bot {...props} />;
    case "file":
      return <Pencil {...props} />;
    case "read":
      return <FileText {...props} />;
    case "list":
      return <FolderOpen {...props} />;
    case "search":
      return <Search {...props} />;
    case "command":
      return <TerminalIcon {...props} />;
    case "web":
      return <Globe2 {...props} />;
    case "image":
      return <ImageIcon {...props} />;
    default:
      return <Wrench {...props} />;
  }
}

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
        ...(body.skillReferences ?? []).map(
          (skill) => `${textCacheSignature(skill.name)}:${textCacheSignature(skill.path)}`
        )
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

function activityEntryFailed(entry: TimelineEntry): boolean {
  return (
    (entry.body.kind === "tool" && entry.body.status === "failed") ||
    (entry.body.kind === "command" && entry.body.status === "failed")
  );
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
    if (body.toolKind === "command") {
      return (
        <CommandOutputDetail
          command={body.tool}
          output={commandOutputText(body.tool, body.result)}
          status={body.status}
          cwd={looksLikeWorkingDirectory(body.server) ? body.server : undefined}
          cacheKey={cacheKey}
        />
      );
    }
    return <ToolActivityDetail argumentsText={body.arguments} result={body.result} cacheKey={cacheKey} />;
  }
  if (body.kind === "command") {
    return (
      <CommandOutputDetail
        command={body.command}
        output={commandOutputText(body.command, body.output)}
        status={body.status}
        cacheKey={cacheKey}
      />
    );
  }
  if (body.kind === "diff") {
    return (
      <InlineDiffActivityDetail
        path={body.path}
        added={body.added}
        removed={body.removed}
        diff={body.diff}
        cacheKey={cacheKey}
      />
    );
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
    <div data-activity-detail="diff" style={{ ...activityDetailPanelStyle, ...activityDetailItemStyle }}>
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

function CommandOutputDetail({
  command,
  output,
  status,
  cwd,
  cacheKey
}: {
  command: string;
  output: string;
  status: "running" | "success" | "failed";
  cwd?: string;
  cacheKey?: string;
}): JSX.Element {
  return (
    <div data-activity-detail="stdout" style={activityDetailPanelStyle}>
      <div style={commandDetailHeaderStyle}>
        <code style={commandDetailTextStyle}>{command}</code>
        <span style={{ ...commandStatusStyle, ...commandStatusTone(status) }}>{commandStatusLabel(status)}</span>
      </div>
      {cwd ? <div style={commandCwdStyle}>{cwd}</div> : null}
      <div style={activityDetailSectionLabelStyle}>输出</div>
      <LongTextPreview
        text={output}
        emptyText={status === "running" ? "等待输出..." : "（无输出）"}
        copyLabel="复制完整输出"
        maxLines={80}
        cacheKey={cacheKey ? `${cacheKey}:stdout` : undefined}
        variant="terminal"
      />
    </div>
  );
}

function ToolActivityDetail({
  argumentsText,
  result,
  cacheKey
}: {
  argumentsText?: string;
  result?: string;
  cacheKey?: string;
}): JSX.Element {
  const hasArguments = Boolean(argumentsText?.trim());
  const hasResult = Boolean(result?.trim());
  return (
    <div data-activity-detail="tool" style={activityDetailPanelStyle}>
      {hasArguments ? (
        <ActivityDetailSection label="参数">
          <LongTextPreview
            text={argumentsText ?? ""}
            emptyText="（无参数）"
            copyLabel="复制完整参数"
            maxLines={48}
            cacheKey={cacheKey ? `${cacheKey}:arguments` : undefined}
          />
        </ActivityDetailSection>
      ) : null}
      <ActivityDetailSection label="结果">
        <LongTextPreview
          text={result ?? ""}
          emptyText={hasResult ? "" : "（无结果）"}
          copyLabel="复制完整结果"
          maxLines={80}
          cacheKey={cacheKey ? `${cacheKey}:result` : undefined}
        />
      </ActivityDetailSection>
    </div>
  );
}

function ActivityDetailSection({ label, children }: { label: string; children: React.ReactNode }): JSX.Element {
  return (
    <div style={activityDetailSectionStyle}>
      <div style={activityDetailSectionLabelStyle}>{label}</div>
      {children}
    </div>
  );
}

function commandOutputText(command: string, output?: string): string {
  const text = output?.trimEnd() ?? "";
  if (text === command) {
    return "";
  }
  return text.startsWith(`${command}\n`) ? text.slice(command.length + 1) : text;
}

function looksLikeWorkingDirectory(value: string): boolean {
  return value.startsWith("/") || /^[A-Za-z]:[\\/]/.test(value);
}

function commandStatusLabel(status: "running" | "success" | "failed"): string {
  if (status === "running") {
    return "运行中";
  }
  return status === "success" ? "已完成" : "失败";
}

function commandStatusTone(status: "running" | "success" | "failed"): React.CSSProperties {
  if (status === "success") {
    return { color: "var(--cw-success)", borderColor: "color-mix(in srgb, var(--cw-success) 36%, transparent)" };
  }
  if (status === "failed") {
    return { color: "var(--cw-danger)", borderColor: "color-mix(in srgb, var(--cw-danger) 36%, transparent)" };
  }
  return { color: "var(--cw-accent)", borderColor: "color-mix(in srgb, var(--cw-accent) 36%, transparent)" };
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
    const { stableMarkdown, pendingPlain } = splitStreamingMarkdown(text);
    return (
      <div style={agentMessageStyle}>
        {stableMarkdown ? <Markdown text={stableMarkdown} cacheKey={`${cacheKey}:live-stable`} /> : null}
        {pendingPlain ? <PlainAgentText text={pendingPlain} /> : null}
        {!stableMarkdown && !pendingPlain ? <PlainAgentText text="" /> : null}
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
        liveAgentEntryIds.add(timelineEntryRenderIdentity(entry));
      } else if (!activeTurnId) {
        latestAgentAfterLastUser = timelineEntryRenderIdentity(entry);
      }
    }
  }

  for (const entry of userMessageEntries) {
    if (entry.turnId && userMessageCountByTurn.get(entry.turnId) === 1) {
      messageActionAvailableById.set(timelineEntryRenderIdentity(entry), true);
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

const inlineActivityLogStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
  padding: "2px 14px 4px",
  color: "var(--cw-fg-muted)"
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
  textAlign: "left",
  cursor: "pointer"
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

const activityActionListStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 2,
  maxHeight: "320px",
  overflowY: "auto",
  padding: "2px 0 2px 18px",
  scrollbarGutter: "stable",
  minWidth: 0
};

const activityActionItemStyle: React.CSSProperties = {
  minWidth: 0
};

const activityActionIconStyle: React.CSSProperties = {
  width: 18,
  height: 18,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flex: "0 0 auto",
  color: "var(--cw-fg-subtle)"
};

const inlineActivityEntryButtonStyle: React.CSSProperties = {
  width: "100%",
  display: "flex",
  alignItems: "center",
  gap: 6,
  padding: "4px 0",
  background: "transparent",
  border: "none",
  color: "var(--cw-fg-muted)",
  textAlign: "left",
  minWidth: 0,
  cursor: "pointer"
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

const activityDetailItemStyle: React.CSSProperties = {
  minWidth: 0,
  maxWidth: "100%"
};

const activityDetailPanelStyle: React.CSSProperties = {
  margin: "4px 0 6px 22px",
  padding: "6px 0 4px 10px",
  maxWidth: "calc(100% - 22px)",
  minWidth: 0,
  borderLeft: "1px solid var(--cw-border)",
  overflow: "hidden"
};

const commandDetailHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  minWidth: 0,
  paddingBottom: 4
};

const commandDetailTextStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  color: "var(--cw-fg)",
  fontFamily: "var(--font-mono)",
  fontSize: 12
};

const commandStatusStyle: React.CSSProperties = {
  flex: "0 0 auto",
  padding: "1px 5px",
  border: "1px solid",
  borderRadius: 4,
  fontSize: 11,
  lineHeight: 1.4
};

const commandCwdStyle: React.CSSProperties = {
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  color: "var(--cw-fg-subtle)",
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  paddingBottom: 5
};

const activityDetailSectionStyle: React.CSSProperties = {
  minWidth: 0
};

const activityDetailSectionLabelStyle: React.CSSProperties = {
  color: "var(--cw-fg-subtle)",
  fontSize: 11,
  fontWeight: 600,
  lineHeight: 1.4,
  paddingTop: 3
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
  padding: "0 8px",
  borderTop: "1px solid var(--cw-border)",
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
  const hasMessageBubble = Boolean(body.text || body.imagePaths?.length || body.skillReferences?.length || body.fileReferences?.length || failed);

  function openMenu(): void {
    setMenuOpen(true);
  }

  return (
    <div data-user-message-row="true" style={userMessageRowStyle}>
      {hasMessageBubble ? (
        <div
          data-user-message-bubble="true"
          onClick={openMenu}
          style={{
            ...userMessageBubbleStyle,
            background: failed ? "var(--cw-danger-bg)" : "var(--cw-bg-elevated)"
          }}
        >
        {body.skillReferences?.length ? (
          <div data-skill-reference-group="true" style={skillReferenceRowStyle}>
            {body.skillReferences.map((skill) => (
              <span
                key={`${skill.name}\u0001${skill.path}`}
                data-skill-reference-chip="true"
                style={skillReferenceChipStyle}
              >
                <Box aria-hidden="true" size={15} strokeWidth={1.8} style={{ flex: "0 0 auto" }} />
                <span style={skillReferenceLabelStyle}>{skillDisplayName(skill.name)}</span>
              </span>
            ))}
          </div>
        ) : null}
        {body.imagePaths?.length ? (
          <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
            {body.imagePaths.map((src) => (
              <ImageThumb key={src} src={src} onPreview={onPreviewImage} />
            ))}
          </div>
        ) : null}
        {body.fileReferences?.length ? (
          <div data-file-reference-group="true" style={fileReferenceRowStyle}>
            {body.fileReferences.map((file) => (
              <span key={`${file.id}\u0001${file.path}`} data-file-reference-chip="true" style={fileReferenceChipStyle}>
                <span aria-hidden="true">▤</span>
                <span style={skillReferenceLabelStyle}>{file.name}</span>
              </span>
            ))}
          </div>
        ) : null}
        {body.text ? <div data-user-message-text="true" style={{ color: failed ? "var(--cw-danger)" : "var(--cw-fg)" }}>{body.text}</div> : null}
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
      ) : null}
    </div>
  );
}

const userMessageRowStyle: React.CSSProperties = {
  width: "100%",
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-end",
  justifyContent: "flex-end",
  minWidth: 0,
  margin: "2px 0"
};

const userMessageBubbleStyle: React.CSSProperties = {
  width: "fit-content",
  maxWidth: "min(82%, 760px)",
  minWidth: 0,
  boxSizing: "border-box",
  padding: "10px 14px",
  borderRadius: 16,
  color: "var(--cw-fg)",
  textAlign: "left",
  whiteSpace: "pre-wrap",
  overflowWrap: "anywhere",
  userSelect: "text",
  position: "relative"
};

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
  justifyContent: "flex-start",
  gap: 6,
  width: "100%",
  minWidth: 0,
  marginBottom: 8,
  whiteSpace: "normal"
};

const skillReferenceChipStyle: React.CSSProperties = {
  maxWidth: "100%",
  minWidth: 0,
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "6px 10px",
  borderRadius: 10,
  border: "1px solid var(--cw-border)",
  background: "var(--cw-surface)",
  color: "var(--cw-accent)",
  fontSize: 12,
  lineHeight: 1.4,
  boxSizing: "border-box"
};

const fileReferenceRowStyle: React.CSSProperties = { ...skillReferenceRowStyle, marginBottom: 8 };
const fileReferenceChipStyle: React.CSSProperties = { ...skillReferenceChipStyle, maxWidth: "100%" };

const skillReferenceLabelStyle: React.CSSProperties = {
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  color: "var(--cw-fg)"
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
