import type { ThreadDetail, TimelineItem } from "../api/types";
import { timelineItemToEntry, type TimelineEntry } from "./timeline";

const TURN_ITEM_DETAIL_PAGE_LIMIT = 100;
const TURN_ITEM_DETAIL_MAX_PAGES = 5;

export type ListTurnItems = (
  threadId: string,
  turnId: string,
  cursor?: string | null,
  limit?: number
) => Promise<{ items: TimelineItem[]; nextCursor?: string | null }>;

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
  listTurnItems: ListTurnItems
): Promise<TimelineEntry[]> {
  const baseEntries = threadDetailEntries(td);
  const turnId = td.lastTurnId ?? lastTurnIdFromEntries(baseEntries);
  if (!turnId) {
    return baseEntries;
  }

  try {
    const itemEntries: TimelineEntry[] = [];
    let cursor: string | null | undefined;
    for (let pageIndex = 0; pageIndex < TURN_ITEM_DETAIL_MAX_PAGES; pageIndex += 1) {
      const page = await listTurnItems(threadId, turnId, cursor, TURN_ITEM_DETAIL_PAGE_LIMIT);
      itemEntries.push(
        ...page.items.map((item, idx) =>
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
        )
      );
      cursor = page.nextCursor ?? null;
      if (!cursor) {
        break;
      }
    }

    return mergeTurnItemDetailsIntoTimeline(baseEntries, itemEntries, turnId);
  } catch {
    return baseEntries;
  }
}

export function mergeTurnItemDetailsIntoTimeline(
  baseEntries: TimelineEntry[],
  itemEntries: TimelineEntry[],
  turnId: string
): TimelineEntry[] {
  if (!itemEntries.length) {
    return baseEntries;
  }
  const turnItemEntries = itemEntries.filter((entry) => entry.turnId === turnId);
  if (!turnItemEntries.length) {
    return baseEntries;
  }

  const baseEntriesById = new Map(baseEntries.map((entry) => [entry.id, entry]));
  const turnItemIds = new Set(turnItemEntries.map((entry) => entry.id));
  const orderedTurnEntries = turnItemEntries.map((entry) =>
    mergeTurnDetailEntry(baseEntriesById.get(entry.id), entry)
  );
  const baseOnlyTurnEntries = baseEntries.filter((entry) => entry.turnId === turnId && !turnItemIds.has(entry.id));
  const mergedTurnEntries = mergeBaseOnlyTurnEntries(orderedTurnEntries, baseOnlyTurnEntries);
  const firstTurnIndex = baseEntries.findIndex((entry) => entry.turnId === turnId);
  if (firstTurnIndex < 0) {
    return [...baseEntries, ...mergedTurnEntries];
  }

  const beforeTurn = baseEntries.slice(0, firstTurnIndex);
  const afterTurn = baseEntries.slice(firstTurnIndex).filter((entry) => entry.turnId !== turnId);
  return [
    ...beforeTurn,
    ...mergedTurnEntries,
    ...afterTurn
  ];
}

export function repairReconstructedTimelineEntries(entries: TimelineEntry[]): TimelineEntry[] {
  const repaired: TimelineEntry[] = [];
  let index = 0;
  while (index < entries.length) {
    const entry = entries[index]!;
    if (!entry.turnId) {
      repaired.push(entry);
      index += 1;
      continue;
    }

    const turnId = entry.turnId;
    const turnEntries: TimelineEntry[] = [];
    while (index < entries.length && entries[index]?.turnId === turnId) {
      turnEntries.push(entries[index]!);
      index += 1;
    }
    repaired.push(...repairReconstructedTurnEntries(turnEntries));
  }
  return repaired;
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

function mergeBaseOnlyTurnEntries(
  orderedTurnEntries: TimelineEntry[],
  baseOnlyTurnEntries: TimelineEntry[]
): TimelineEntry[] {
  if (!baseOnlyTurnEntries.length) {
    return repairReconstructedTurnEntries(orderedTurnEntries);
  }

  const detailHasUser = orderedTurnEntries.some((entry) => entry.body.kind === "user-message");
  const baseOnlyUsers = baseOnlyTurnEntries.filter((entry) => entry.body.kind === "user-message");
  const baseOnlyOtherEntries = baseOnlyTurnEntries.filter((entry) => entry.body.kind !== "user-message");
  if (!detailHasUser && baseOnlyUsers.length) {
    return repairReconstructedTurnEntries([
      ...baseOnlyUsers,
      ...orderedTurnEntries,
      ...baseOnlyOtherEntries
    ]);
  }

  return repairReconstructedTurnEntries([...orderedTurnEntries, ...baseOnlyTurnEntries]);
}

function repairReconstructedTurnEntries(entries: TimelineEntry[]): TimelineEntry[] {
  return withCreatedAtFollowingEntryOrder(moveTrailingActivityBeforeFinalAssistant(entries));
}

function moveTrailingActivityBeforeFinalAssistant(entries: TimelineEntry[]): TimelineEntry[] {
  const finalAssistantIndex = findLastAgentMessageIndex(entries);
  if (finalAssistantIndex < 0 || finalAssistantIndex === entries.length - 1) {
    return entries;
  }

  const beforeFinalAssistant = entries.slice(0, finalAssistantIndex);
  const finalAssistant = entries[finalAssistantIndex]!;
  const afterFinalAssistant = entries.slice(finalAssistantIndex + 1);
  const trailingActivity = afterFinalAssistant.filter(isInlineActivityEntry);
  if (!trailingActivity.length) {
    return entries;
  }
  const trailingOtherEntries = afterFinalAssistant.filter((entry) => !isInlineActivityEntry(entry));
  return [...beforeFinalAssistant, ...trailingActivity, finalAssistant, ...trailingOtherEntries];
}

function withCreatedAtFollowingEntryOrder(entries: TimelineEntry[]): TimelineEntry[] {
  if (entries.length < 2 || hasMonotonicCreatedAt(entries)) {
    return entries;
  }

  const baseCreatedAt = Math.min(...entries.map((entry) => entry.createdAt));
  return entries.map((entry, index) => ({
    ...entry,
    createdAt: baseCreatedAt + index * 0.001
  }));
}

function hasMonotonicCreatedAt(entries: TimelineEntry[]): boolean {
  for (let index = 1; index < entries.length; index += 1) {
    if (entries[index]!.createdAt < entries[index - 1]!.createdAt) {
      return false;
    }
  }
  return true;
}

function findLastAgentMessageIndex(entries: TimelineEntry[]): number {
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    if (entries[index]?.body.kind === "agent-message") {
      return index;
    }
  }
  return -1;
}

function isInlineActivityEntry(entry: TimelineEntry): boolean {
  return (
    entry.body.kind === "reasoning" ||
    entry.body.kind === "tool" ||
    entry.body.kind === "command" ||
    entry.body.kind === "diff"
  );
}

function mergeTurnDetailEntry(baseEntry: TimelineEntry | undefined, detailEntry: TimelineEntry): TimelineEntry {
  if (!baseEntry) {
    return detailEntry;
  }
  return {
    ...detailEntry,
    createdAt: baseEntry.createdAt,
    turnIndex: detailEntry.turnIndex ?? baseEntry.turnIndex,
    generation: detailEntry.generation ?? baseEntry.generation,
    snapshotSequence: detailEntry.snapshotSequence ?? baseEntry.snapshotSequence,
    clientUserMessageId: detailEntry.clientUserMessageId ?? baseEntry.clientUserMessageId
  };
}
