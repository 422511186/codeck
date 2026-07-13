import type { ThreadDetail, TimelineItem } from "../api/types";
import {
  TIMELINE_RESPONSE_BYTE_BUDGET,
  utf8ByteLength,
  type TimelineCompleteness
} from "../../shared/timeline-content";
import { timelineItemToEntry, type TimelineEntry } from "./timeline";

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

  try {
    const itemEntries: TimelineEntry[] = [];
    const seenCursors = new Set<string>();
    const seenItemIds = new Set<string>();
    let cursor: string | null | undefined = options.cursor;
    let detailBytes = 0;
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
      const nextEntries = page.items.flatMap((item, idx) => {
        if (seenItemIds.has(item.id)) {
          return [];
        }
        seenItemIds.add(item.id);
        addedItems += 1;
        return [
          timelineItemToEntry(
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
          )
        ];
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
    return {
      snapshotEntries: baseEntries,
      detailEntries: [],
      detailCompleteness: { status: "repair-required", reason: "source-gap" },
      detailBytes: 0
    };
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
      ...(entries[ordinal - 1]?.id ? { afterEntryId: entries[ordinal - 1]!.id } : {}),
      ...(entries[ordinal + 1]?.id ? { beforeEntryId: entries[ordinal + 1]!.id } : {})
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
