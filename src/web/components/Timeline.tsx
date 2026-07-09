"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

const EAGER_MARKDOWN_TEXT_LIMIT = 1_500;
const LAZY_MARKDOWN_TEXT_LIMIT = 24_000;
const LAZY_MARKDOWN_ROOT_MARGIN = "720px 0px";
const MAX_INITIAL_TIMELINE_ROWS = 80;
const TIMELINE_WINDOW_EXPAND_ROWS = 80;
const EAGER_MARKDOWN_TAIL_ROWS = 2;
const ESTIMATED_TIMELINE_ROW_HEIGHT = 72;
const MIN_REAL_TIMELINE_TIMESTAMP_MS = Date.UTC(2000, 0, 1);

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
  onResendUser?: (text: string, imagePaths: string[], skillReferences: SkillReference[]) => void;
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
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [windowStartIndex, setWindowStartIndex] = useState(() => initialTimelineWindowStart(entries.length));
  const previousEntriesRef = useRef<{ length: number; firstId: string | null; lastId: string | null }>({
    length: entries.length,
    firstId: entries[0]?.id ?? null,
    lastId: entries[entries.length - 1]?.id ?? null
  });
  const visibleEntries = windowStartIndex > 0 ? entries.slice(windowStartIndex) : entries;
  const visibleBlocks = useMemo(() => deriveTimelineRenderBlocks(visibleEntries), [visibleEntries]);
  const topSpacerHeight = windowStartIndex * ESTIMATED_TIMELINE_ROW_HEIGHT;
  const longTimeline = entries.length > MAX_INITIAL_TIMELINE_ROWS;
  const rowState = useMemo(
    () => deriveTimelineRowState(entries, running, activeTurnId),
    [entries, running, activeTurnId]
  );

  useEffect(() => {
    const previous = previousEntriesRef.current;
    const nextFirstId = entries[0]?.id ?? null;
    const nextLastId = entries[entries.length - 1]?.id ?? null;
    const maxWindowStart = initialTimelineWindowStart(entries.length);
    const previousMaxWindowStart = initialTimelineWindowStart(previous.length);
    const prependedAtHead =
      previous.length > 0 &&
      entries.length > previous.length &&
      previous.lastId !== null &&
      nextLastId === previous.lastId &&
      nextFirstId !== previous.firstId;
    const appendedAtTail =
      previous.length > 0 &&
      entries.length > previous.length &&
      previous.firstId !== null &&
      nextFirstId === previous.firstId &&
      nextLastId !== previous.lastId;

    setWindowStartIndex((current) => {
      if (entries.length <= MAX_INITIAL_TIMELINE_ROWS) {
        return 0;
      }
      if (previous.length === 0 || entries.length < previous.length) {
        return maxWindowStart;
      }
      if (prependedAtHead) {
        return current === 0 ? 0 : Math.min(current + (entries.length - previous.length), maxWindowStart);
      }
      if (appendedAtTail && current >= previousMaxWindowStart) {
        return maxWindowStart;
      }
      return Math.min(current, maxWindowStart);
    });

    previousEntriesRef.current = {
      length: entries.length,
      firstId: nextFirstId,
      lastId: nextLastId
    };
  }, [entries]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || entries.length <= MAX_INITIAL_TIMELINE_ROWS) {
      return;
    }

    const scroller = findTimelineScrollContainer(root);
    if (!scroller) {
      return;
    }

    const expandVisibleWindow = () => {
      const preloadDistance = Math.max(scroller.clientHeight * 1.5, ESTIMATED_TIMELINE_ROW_HEIGHT * 10);
      setWindowStartIndex((current) => {
        if (current <= 0) {
          return current;
        }
        const targetSpacerHeight = Math.max(0, scroller.scrollTop - preloadDistance);
        const targetStartIndex = Math.floor(targetSpacerHeight / ESTIMATED_TIMELINE_ROW_HEIGHT);
        if (targetStartIndex >= current) {
          return current;
        }
        return Math.max(0, Math.min(current - TIMELINE_WINDOW_EXPAND_ROWS, targetStartIndex));
      });
    };

    scroller.addEventListener("scroll", expandVisibleWindow, { passive: true });
    return () => {
      scroller.removeEventListener("scroll", expandVisibleWindow);
    };
  }, [entries.length]);

  return (
    <>
      <div ref={rootRef} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {topSpacerHeight > 0 ? (
          <div aria-hidden="true" data-timeline-spacer="top" style={{ minHeight: topSpacerHeight }} />
        ) : null}
        {visibleBlocks.map((block, visibleIndex) => (
          <div key={block.id} data-timeline-row="true" style={timelineRowStyle}>
            {block.kind === "inline-activity-log" ? (
              <InlineActivityLog entries={block.entries} />
            ) : (
              <TimelineRow
                entry={block.entry}
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
  | { kind: "entry"; id: string; entry: TimelineEntry }
  | { kind: "inline-activity-log"; id: string; turnId?: string; entries: TimelineEntry[] };

export function deriveTimelineRenderBlocks(entries: TimelineEntry[]): TimelineRenderBlock[] {
  const blocks: TimelineRenderBlock[] = [];
  let index = 0;
  while (index < entries.length) {
    const entry = entries[index]!;
    if (!isActivityEntry(entry)) {
      blocks.push({ kind: "entry", id: entry.id, entry });
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
      id: `inline-activity-${turnId ?? activityEntries[0]!.id}-${activityEntries.at(-1)!.id}`,
      ...(turnId ? { turnId } : {}),
      entries: activityEntries
    });
  }
  return blocks;
}

function isActivityEntry(entry: TimelineEntry): boolean {
  return (
    entry.body.kind === "reasoning" ||
    entry.body.kind === "tool" ||
    entry.body.kind === "command" ||
    entry.body.kind === "diff"
  );
}

function initialTimelineWindowStart(entryCount: number): number {
  return Math.max(0, entryCount - MAX_INITIAL_TIMELINE_ROWS);
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
  onResendUser?: (text: string, imagePaths: string[], skillReferences: SkillReference[]) => void;
  onRewindToMessage?: (entry: TimelineEntry) => void | Promise<void>;
  onForkFromMessage?: (entry: TimelineEntry) => void | Promise<void>;
  onPreviewImage: (src: string) => void;
}): JSX.Element {
  const body = entry.body;
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
  })();

  return (
    <>
      <TimelineRelativeTime createdAt={entry.createdAt} />
      {content}
    </>
  );
}

function InlineActivityLog({ entries }: { entries: TimelineEntry[] }): JSX.Element {
  const [openKeys, setOpenKeys] = useState<Set<string>>(() => new Set());
  const [openActionKeys, setOpenActionKeys] = useState<Set<string>>(() => new Set());
  const sections = inlineActivitySections(entries);

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
}

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

function inlineActivitySections(entries: TimelineEntry[]): InlineActivitySection[] {
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
  if (body.kind === "reasoning") {
    return (
      <ActivityDetailText
        text={body.text.trim() || (body.done ? "" : "Thinking...")}
        showTitle={false}
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
        />
      );
    }
    return (
      <ActivityDetailText
        title={body.toolKind === "command" ? body.tool : `${body.diffPath ?? body.tool}`}
        text={[body.arguments, body.result].filter(Boolean).join("\n") || body.tool}
        showTitle={showTitle}
      />
    );
  }
  if (body.kind === "command") {
    return <ActivityDetailText title={body.command} text={body.output ?? body.command} showTitle={showTitle} />;
  }
  if (body.kind === "diff") {
    return (
      <InlineDiffActivityDetail
        path={body.path}
        added={body.added}
        removed={body.removed}
        diff={body.diff}
        showTitle={showTitle}
      />
    );
  }
  return <ActivityDetailText title={label} text={label} showTitle={showTitle} />;
}

function ActivityDetail({ entry }: { entry: TimelineEntry }): JSX.Element {
  const body = entry.body;
  if (body.kind === "reasoning") {
    return (
      <ActivityDetailText
        title={body.done ? "Thinking" : "Thinking..."}
        text={body.text.trim() || (body.done ? "" : "Thinking...")}
      />
    );
  }
  if (body.kind === "tool") {
    return (
      <ActivityDetailText
        title={body.toolKind === "command" ? body.tool : `${body.server} · ${body.diffPath ?? body.tool}`}
        text={[body.arguments, body.result].filter(Boolean).join("\n") || body.tool}
      />
    );
  }
  if (body.kind === "command") {
    return <ActivityDetailText title={body.command} text={body.output ?? body.command} />;
  }
  if (body.kind === "diff") {
    return <ActivityDetailText title={body.path} text={body.diff} />;
  }
  return <></>;
}

function InlineDiffActivityDetail({
  path,
  added,
  removed,
  diff,
  showTitle = true
}: {
  path: string;
  added: number;
  removed: number;
  diff: string;
  showTitle?: boolean;
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
      <DiffView diff={diff} />
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
  showTitle = true
}: {
  title?: string;
  text: string;
  showTitle?: boolean;
}): JSX.Element {
  return (
    <div style={activityDetailItemStyle}>
      {showTitle && title ? <div style={activityDetailTitleStyle}>{title}</div> : null}
      {text.trim() ? (
        <div style={activityDetailPreviewStyle}>
          <LongTextPreview text={text} emptyText="（无内容）" copyLabel="复制完整详情" maxLines={80} />
        </div>
      ) : null}
    </div>
  );
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
  overflowX: "hidden"
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
}
