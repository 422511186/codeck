export type HistoryStamp = {
  bootId: string;
  generation: number;
};

export type AuthoritativeTurnManifest = {
  turnIds: string[];
  historyStamp?: HistoryStamp;
  pageWatermark?: number;
};

export type TimelineSequences = {
  streamSequence?: number;
  fragmentSequence?: number;
};

export type TimelineGapScope =
  | { scope: "threads"; affectedThreadIds: string[] }
  | { scope: "all-tracked" };

export type TimelineRepairWindow = {
  historyStamp: HistoryStamp;
  pageWatermark: number;
  windowStartAnchor: string;
  windowEndAnchor: string;
  preservedThrough?: string;
};

const EMPTY_TIMELINE_WINDOW_ITEM_ID = "$empty";

export function timelineEmptyWindowAnchor(historyStamp: HistoryStamp): string {
  return JSON.stringify([
    historyStamp.bootId,
    historyStamp.generation,
    null,
    EMPTY_TIMELINE_WINDOW_ITEM_ID
  ]);
}

export type TimelineProtocolMetadata = {
  bootId?: string;
  generation?: number;
  historyStamp?: HistoryStamp;
  streamSequence?: number;
  fragmentSequence?: number;
  pageWatermark?: number;
  windowStartAnchor?: string;
  windowEndAnchor?: string;
  preservedThrough?: string;
};

export type CanonicalSourceLocator =
  | { sourceKind: "event"; bootId: string; eventId: string; field: string }
  | { sourceKind: "response" | "rollout"; sourceId: string; absoluteOutputIndex: number };

export type AgentMessageAliasCandidate = {
  id: string;
  turnId: string;
  generation: number;
  text: string;
  provisional: boolean;
};

export type AgentMessageAliasResolution =
  | { kind: "alias"; canonicalId: string; provisionalId: string }
  | { kind: "none"; reason: "no-match" | "conflict" | "ambiguous" };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function nonNegativeInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function historyStampFrom(value: unknown): HistoryStamp | null {
  if (!isRecord(value)) {
    return null;
  }
  const bootId = nonEmptyString(value.bootId);
  const generation = nonNegativeInteger(value.generation);
  return bootId && generation !== null ? { bootId, generation } : null;
}

export function timelineSequencesFrom(value: unknown): TimelineSequences {
  if (!isRecord(value)) {
    return {};
  }
  const streamSequence = nonNegativeInteger(value.streamSequence) ?? nonNegativeInteger(value.sequence);
  const fragmentSequence = nonNegativeInteger(value.fragmentSequence);
  return {
    ...(streamSequence !== null ? { streamSequence } : {}),
    ...(fragmentSequence !== null ? { fragmentSequence } : {})
  };
}

export function timelineGapScopeFrom(value: unknown): TimelineGapScope | null {
  if (!isRecord(value)) {
    return null;
  }
  if (value.scope === "all-tracked") {
    return { scope: "all-tracked" };
  }
  const rawIds = Array.isArray(value.affectedThreadIds)
    ? value.affectedThreadIds
    : typeof value.threadId === "string"
      ? [value.threadId]
      : [];
  const affectedThreadIds = [...new Set(rawIds.filter((threadId): threadId is string => Boolean(nonEmptyString(threadId))))];
  return affectedThreadIds.length ? { scope: "threads", affectedThreadIds } : null;
}

export function repairWindowFrom(value: unknown): TimelineRepairWindow | null {
  if (!isRecord(value)) {
    return null;
  }
  const historyStamp = historyStampFrom(value);
  const pageWatermark = nonNegativeInteger(value.pageWatermark);
  const windowStartAnchor = nonEmptyString(value.windowStartAnchor);
  const windowEndAnchor = nonEmptyString(value.windowEndAnchor);
  const preservedThrough = nonEmptyString(value.preservedThrough);
  if (!historyStamp || pageWatermark === null || !windowStartAnchor || !windowEndAnchor) {
    return null;
  }
  return {
    historyStamp,
    pageWatermark,
    windowStartAnchor,
    windowEndAnchor,
    ...(preservedThrough ? { preservedThrough } : {})
  };
}

export function resolveAgentMessageAlias(
  incoming: AgentMessageAliasCandidate,
  existing: AgentMessageAliasCandidate[]
): AgentMessageAliasResolution {
  const oppositeSourceCandidates = existing.filter(
    (candidate) =>
      candidate.id !== incoming.id &&
      candidate.turnId === incoming.turnId &&
      candidate.generation === incoming.generation &&
      candidate.provisional !== incoming.provisional
  );
  if (!oppositeSourceCandidates.length) {
    return { kind: "none", reason: "no-match" };
  }

  const compatible = oppositeSourceCandidates.filter((candidate) => {
    const provisional = incoming.provisional ? incoming : candidate;
    const canonical = incoming.provisional ? candidate : incoming;
    const provisionalText = provisional.text.trim();
    const canonicalText = canonical.text.trim();
    return Boolean(
      provisionalText &&
      canonicalText &&
      (provisionalText === canonicalText || canonicalText.startsWith(provisionalText))
    );
  });
  if (compatible.length > 1) {
    return { kind: "none", reason: "ambiguous" };
  }
  if (!compatible.length) {
    return { kind: "none", reason: "conflict" };
  }

  const match = compatible[0]!;
  const canonical = incoming.provisional ? match : incoming;
  const provisional = incoming.provisional ? incoming : match;
  return {
    kind: "alias",
    canonicalId: canonical.id,
    provisionalId: provisional.id
  };
}
