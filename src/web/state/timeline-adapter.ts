import type { ThreadDetail, TimelineItem } from "../api/types";
import {
  TIMELINE_RESPONSE_BYTE_BUDGET,
  utf8ByteLength,
  type TimelineCompleteness
} from "../../shared/timeline-content";
import { timelineItemToEntry, type TimelineEntry } from "./timeline";
import type { ThreadNoticeInput } from "./store";

const TURN_ITEM_DETAIL_PAGE_LIMIT = 100;

export type ListTurnItems = (
  threadId: string,
  turnId: string,
  cursor?: string | null,
  limit?: number
) => Promise<{
  items: TimelineItem[];
  nextCursor?: string | null;
  completeness?: TimelineCompleteness;
  includedBytes?: number;
}>;

export type ThreadDetailTimelineSources = {
  snapshotEntries: TimelineEntry[];
  detailEntries: TimelineEntry[];
  detailCompleteness: TimelineCompleteness;
  detailBytes: number;
};

const legacyModelResumeWarningPattern = /^This session was recorded with model `[^`]+` but is resuming with `[^`]+`\. Consider switching back to `[^`]+` as it may affect Codex performance\.$/;
const legacyModelMetadataWarningPattern = /^Model metadata for `[^`]+` not found\. Defaulting to fallback metadata; this can degrade performance and cause issues\.$/;
const legacyLongThreadWarningPattern = /^Heads up: Long threads and multiple compactions can cause the model to be less accurate\. Start a new thread when possible to keep threads small and targeted\.$/;

export function extractLegacyWarningNotices(entries: TimelineEntry[]): {
  entries: TimelineEntry[];
  notices: ThreadNoticeInput[];
} {
  const notices = new Map<string, ThreadNoticeInput>();
  const keptEntries = entries.filter((entry) => {
    if (entry.body.kind !== "error" || !isLegacyAppServerWarningText(entry.body.text)) return true;
    const text = normalizedLegacyAppServerWarningText(entry.body.text) ?? entry.body.text;
    notices.set(`app-server-warning:${text}`, {
      id: `app-server-warning:${text}`,
      kind: "warning",
      source: "app-server",
      text,
      createdAt: entry.createdAt
    });
    return false;
  });
  return { entries: keptEntries, notices: [...notices.values()] };
}

export function isLegacyAppServerWarningText(text: string): boolean {
  return normalizedLegacyAppServerWarningText(text) !== null;
}

export function normalizedLegacyAppServerWarningText(text: string): string | null {
  const normalized = text.replace(/\s+/g, " ").trim();
  return legacyModelResumeWarningPattern.test(normalized) ||
    legacyModelMetadataWarningPattern.test(normalized) ||
    legacyLongThreadWarningPattern.test(normalized)
    ? normalized
    : null;
}

export function threadDetailEntries(td: ThreadDetail): TimelineEntry[] {
  return repairReconstructedTimelineEntries(
    td.timeline.map((item, idx) =>
      timelineItemToEntry(
        {
          ...item,
          ...(typeof item.generation !== "number" && typeof td.generation === "number" ? { generation: td.generation } : {}),
          ...(typeof item.snapshotSequence !== "number" && typeof td.snapshotSequence === "number"
            ? { snapshotSequence: td.snapshotSequence }
            : {})
        },
        td.updatedAt - (td.timeline.length - idx)
      )
    )
  );
}

export async function threadDetailEntriesWithTurnItems(
  td: ThreadDetail,
  threadId: string,
  listTurnItems: ListTurnItems,
  options: { cursor?: string | null } = {}
): Promise<ThreadDetailTimelineSources> {
  const baseEntries = threadDetailEntries(td);
  const turnId = td.lastTurnId ?? lastTurnIdFromEntries(baseEntries);
  if (!turnId) {
    return {
      snapshotEntries: baseEntries,
      detailEntries: [],
      detailCompleteness: { status: "complete", nextCursor: null },
      detailBytes: 0
    };
  }

  const itemEntries: TimelineEntry[] = [];
  const seenCursors = new Set<string>();
  const itemIndexes = new Map<string, number>();
  let cursor: string | null | undefined = options.cursor;
  let detailBytes = 0;
  try {
    while (true) {
      if (cursor) {
        if (seenCursors.has(cursor)) {
          return detailTimelineSources(baseEntries, itemEntries, detailBytes, {
            status: "repair-required",
            reason: "cursor-loop",
            nextCursor: cursor
          });
        }
        seenCursors.add(cursor);
      }
      const page = await listTurnItems(threadId, turnId, cursor, TURN_ITEM_DETAIL_PAGE_LIMIT);
      const pageBytes = page.includedBytes ?? utf8ByteLength(JSON.stringify(page));
      if (itemEntries.length > 0 && detailBytes + pageBytes > TIMELINE_RESPONSE_BYTE_BUDGET) {
        return detailTimelineSources(baseEntries, itemEntries, detailBytes, {
          status: "partial",
          reason: "response-budget",
          nextCursor: cursor ?? null,
          includedBytes: detailBytes
        });
      }
      let addedItems = 0;
      const nextEntries: TimelineEntry[] = [];
      page.items.forEach((item, idx) => {
        const entry = timelineItemToEntry(
            {
              ...item,
              turnId: item.turnId ?? turnId,
              ...(typeof item.generation !== "number" && typeof td.generation === "number"
                ? { generation: td.generation }
                : {}),
              ...(typeof item.snapshotSequence !== "number" && typeof td.snapshotSequence === "number"
                ? { snapshotSequence: td.snapshotSequence }
                : {})
            },
            td.updatedAt - itemEntries.length - page.items.length + idx
          );
        const identity = detailEntryIdentity(entry);
        const existingIndex = itemIndexes.get(identity);
        if (typeof existingIndex === "number") {
          const pendingIndex = existingIndex - itemEntries.length;
          const existing = itemEntries[existingIndex] ?? nextEntries[pendingIndex];
          if (!existing) return;
          if (preferDetailEntry(entry, existing)) {
            if (existingIndex < itemEntries.length) itemEntries[existingIndex] = entry;
            else nextEntries[pendingIndex] = entry;
            addedItems += 1;
          }
          return;
        }
        itemIndexes.set(identity, itemEntries.length + nextEntries.length);
        addedItems += 1;
        nextEntries.push(entry);
      });
      itemEntries.push(...nextEntries);
      detailBytes += pageBytes;
      const nextCursor = page.nextCursor ?? page.completeness?.nextCursor ?? null;
      if (!nextCursor) {
        return detailTimelineSources(baseEntries, itemEntries, detailBytes, {
          status: page.completeness?.status ?? "complete",
          ...(page.completeness?.reason ? { reason: page.completeness.reason } : {}),
          nextCursor: null,
          includedBytes: detailBytes
        });
      }
      if (seenCursors.has(nextCursor)) {
        return detailTimelineSources(baseEntries, itemEntries, detailBytes, {
          status: "repair-required",
          reason: "cursor-loop",
          nextCursor,
          includedBytes: detailBytes
        });
      }
      if (addedItems === 0) {
        return detailTimelineSources(baseEntries, itemEntries, detailBytes, {
          status: "repair-required",
          reason: "zero-progress",
          nextCursor,
          includedBytes: detailBytes
        });
      }
      if (page.completeness?.status === "repair-required") {
        return detailTimelineSources(baseEntries, itemEntries, detailBytes, page.completeness);
      }
      cursor = nextCursor;
    }
  } catch {
    return detailTimelineSources(baseEntries, itemEntries, detailBytes, {
      status: "repair-required",
      reason: "source-gap",
      ...(cursor ? { nextCursor: cursor } : {})
    });
  }
}

function detailEntryIdentity(entry: TimelineEntry): string {
  return [
    entry.historyStamp?.bootId ?? entry.bootId ?? "legacy",
    entry.generation ?? entry.historyStamp?.generation ?? "legacy",
    entry.turnId ?? "none",
    entry.id
  ].join("\u0000");
}

function preferDetailEntry(candidate: TimelineEntry, current: TimelineEntry): boolean {
  const completenessRank = (entry: TimelineEntry): number => {
    switch (entry.completeness?.status) {
      case "complete": return 4;
      case "truncated": return 3;
      case "partial": return 2;
      case "repair-required": return 1;
      default: return 0;
    }
  };
  const candidateRank = completenessRank(candidate);
  const currentRank = completenessRank(current);
  if (candidateRank !== currentRank) return candidateRank > currentRank;
  return visibleEntryText(candidate).length > visibleEntryText(current).length;
}

function visibleEntryText(entry: TimelineEntry): string {
  switch (entry.body.kind) {
    case "user-message":
    case "agent-message":
    case "reasoning":
    case "system":
    case "error":
      return entry.body.text;
    case "tool":
      return entry.body.result ?? "";
    case "command":
      return entry.body.output ?? "";
    case "diff":
      return entry.body.diff;
  }
}

function detailTimelineSources(
  snapshotEntries: TimelineEntry[],
  detailEntries: TimelineEntry[],
  detailBytes: number,
  detailCompleteness: TimelineCompleteness
): ThreadDetailTimelineSources {
  return {
    snapshotEntries,
    detailEntries: repairReconstructedTimelineEntries(detailEntries, "turn-detail"),
    detailCompleteness,
    detailBytes
  };
}

export function repairReconstructedTimelineEntries(
  entries: TimelineEntry[],
  sourceKind: NonNullable<TimelineEntry["sourceOrder"]>["sourceKind"] = "snapshot"
): TimelineEntry[] {
  return entries.map((entry, ordinal) => ({
    ...entry,
    sourceOrder: entry.sourceOrder ?? {
      sourceKind,
      ordinal,
      ...(entries[ordinal - 1]?.id
        ? {
            afterEntryId: entries[ordinal - 1]!.id,
            ...(entries[ordinal - 1]!.turnId ? { afterTurnId: entries[ordinal - 1]!.turnId } : {})
          }
        : {}),
      ...(entries[ordinal + 1]?.id
        ? {
            beforeEntryId: entries[ordinal + 1]!.id,
            ...(entries[ordinal + 1]!.turnId ? { beforeTurnId: entries[ordinal + 1]!.turnId } : {})
          }
        : {})
    }
  }));
}

function lastTurnIdFromEntries(entries: TimelineEntry[]): string | null {
  for (let idx = entries.length - 1; idx >= 0; idx -= 1) {
    const turnId = entries[idx]?.turnId;
    if (turnId) {
      return turnId;
    }
  }
  return null;
}
