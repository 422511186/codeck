import type { TimelineEntry } from "./timeline";

const CONTEXT_COMPACTION_DONE_TEXT = "压缩上下文已完成";
const MAX_PROCESSED_EVENT_IDS = 2_000;

export type TimelineInput =
  | {
      kind: "snapshot-window";
      entries: TimelineEntry[];
      cursor?: string | null;
      generation?: number;
    }
  | {
      kind: "pagination-page";
      entries: TimelineEntry[];
      cursor?: string | null;
      reachedBeginning?: boolean;
      generation?: number;
    }
  | TimelineEntryInput
  | {
      kind: "live-event-batch";
      inputs: TimelineInput[];
    }
  | {
      kind: "rollback-fork-replace";
      entries: TimelineEntry[];
      generation?: number;
      deletedTurnIds?: string[];
    };

export type TimelineEntryInput = {
  kind: "live-event" | "overlay-item" | "turn-item-detail" | "rollout-supplement-item" | "optimistic-user";
  entry: TimelineEntry;
  eventId?: string;
  revision?: number;
};

export type TimelineEngineDiagnostics = {
  fallbackIdentityMerges: number;
  identityConflicts: number;
  missingIdentityInputs: number;
  repairRequests: number;
  droppedStaleGenerationEvents: number;
  droppedDuplicateEvents: number;
  droppedStaleRevisions: number;
};

export type OrderedDistinctTurn = {
  turnId: string;
  firstEntryId: string;
  order: number;
};

export type TimelineEngineState = {
  entries: TimelineEntry[];
  cursor: string | null;
  reachedBeginning: boolean;
  generation: number;
  deletedTurnIds: Set<string>;
  processedEventIds: Set<string>;
  itemRevisions: Map<string, number>;
  diagnostics: TimelineEngineDiagnostics;
};

export function createTimelineEngineState(init?: Partial<TimelineEngineState>): TimelineEngineState {
  return {
    entries: init?.entries ? normalizeEntries(init.entries) : [],
    cursor: init?.cursor ?? null,
    reachedBeginning: init?.reachedBeginning ?? false,
    generation: init?.generation ?? 0,
    deletedTurnIds: new Set(init?.deletedTurnIds ?? []),
    processedEventIds: new Set(init?.processedEventIds ?? []),
    itemRevisions: new Map(init?.itemRevisions ?? []),
    diagnostics: {
      fallbackIdentityMerges: 0,
      identityConflicts: 0,
      missingIdentityInputs: 0,
      repairRequests: 0,
      droppedStaleGenerationEvents: 0,
      droppedDuplicateEvents: 0,
      droppedStaleRevisions: 0,
      ...init?.diagnostics
    }
  };
}

export function applyTimelineInput(state: TimelineEngineState, input: TimelineInput): TimelineEngineState {
  switch (input.kind) {
    case "snapshot-window": {
      const generation = nextGeneration(state, input.generation, input.entries);
      return withEntries(
        {
          ...state,
          generation,
          cursor: input.cursor ?? state.cursor,
          reachedBeginning: input.cursor === null
        },
        input.entries
      );
    }
    case "pagination-page": {
      const generation = nextGeneration(state, input.generation, input.entries);
      return withEntries(
        {
          ...state,
          generation,
          cursor: input.cursor ?? state.cursor,
          reachedBeginning: input.reachedBeginning ?? input.cursor === null
        },
        [...input.entries, ...state.entries]
      );
    }
    case "live-event-batch":
      return input.inputs.reduce(applyTimelineInput, state);
    case "rollback-fork-replace": {
      const generation = Math.max(state.generation, input.generation ?? state.generation);
      return withEntries(
        {
          ...state,
          generation,
          deletedTurnIds: new Set([...(state.deletedTurnIds ?? []), ...(input.deletedTurnIds ?? [])]),
          processedEventIds: new Set(),
          itemRevisions: new Map()
        },
        input.entries
      );
    }
    default:
      return applyEntryInput(state, input);
  }
}

export function selectTimelineEntries(state: TimelineEngineState): TimelineEntry[] {
  return state.entries;
}

export function selectOrderedDistinctTurns(state: TimelineEngineState): OrderedDistinctTurn[] {
  const turns: OrderedDistinctTurn[] = [];
  const seen = new Set<string>();
  for (const entry of state.entries) {
    if (!entry.turnId || seen.has(entry.turnId)) {
      continue;
    }
    seen.add(entry.turnId);
    turns.push({ turnId: entry.turnId, firstEntryId: entry.id, order: turns.length });
  }
  return turns;
}

export function selectOrderedDistinctTurnsForEntries(entries: TimelineEntry[]): OrderedDistinctTurn[] {
  return selectOrderedDistinctTurns(createTimelineEngineState({ entries }));
}

function applyEntryInput(state: TimelineEngineState, input: TimelineEntryInput): TimelineEngineState {
  const entryGeneration = entryGenerationOrState(input.entry, state);
  if (entryGeneration < state.generation && isVisibleEntry(input.entry)) {
    return withDiagnostic(state, "droppedStaleGenerationEvents");
  }
  if (input.entry.turnId && state.deletedTurnIds.has(input.entry.turnId)) {
    return withDiagnostic(state, "droppedStaleGenerationEvents");
  }

  const eventKey = input.eventId ? eventLedgerKey(entryGeneration, input.eventId) : null;
  if (eventKey && state.processedEventIds.has(eventKey)) {
    return withDiagnostic(state, "droppedDuplicateEvents");
  }

  const identity = identityKey(input.entry, state.generation);
  if (!identity) {
    return withDiagnostic(state, "missingIdentityInputs");
  }

  const revisionKey = revisionLedgerKey(entryGeneration, identity);
  if (typeof input.revision === "number") {
    const currentRevision = state.itemRevisions.get(revisionKey);
    if (typeof currentRevision === "number" && input.revision <= currentRevision) {
      return withDiagnostic(state, "droppedStaleRevisions");
    }
  }

  const entries = upsertEntryByIdentity(state.entries, input.entry, identity, state.generation);
  const processedEventIds = new Set(state.processedEventIds);
  if (eventKey) {
    processedEventIds.add(eventKey);
    trimStringSetInPlace(processedEventIds, MAX_PROCESSED_EVENT_IDS);
  }
  const itemRevisions = new Map(state.itemRevisions);
  if (typeof input.revision === "number") {
    itemRevisions.set(revisionKey, Math.max(itemRevisions.get(revisionKey) ?? 0, input.revision));
  }

  return withEntries(
    {
      ...state,
      generation: Math.max(state.generation, entryGeneration),
      processedEventIds,
      itemRevisions
    },
    entries
  );
}

function withEntries(state: TimelineEngineState, entries: TimelineEntry[]): TimelineEngineState {
  return {
    ...state,
    entries: normalizeEntries(entries)
  };
}

function withDiagnostic(
  state: TimelineEngineState,
  key: keyof TimelineEngineDiagnostics
): TimelineEngineState {
  return {
    ...state,
    diagnostics: {
      ...state.diagnostics,
      [key]: state.diagnostics[key] + 1
    }
  };
}

function normalizeEntries(entries: TimelineEntry[]): TimelineEntry[] {
  const merged: TimelineEntry[] = [];
  for (const entry of entries) {
    const identity = identityKey(entry, maxEntryGeneration(entries));
    if (!identity) {
      const fallbackIndexes = merged
        .map((candidate, index) => ({ candidate, index }))
        .filter(({ candidate }) => fallbackEquivalent(candidate, entry))
        .map(({ index }) => index);
      if (fallbackIndexes.length === 1) {
        const fallbackIndex = fallbackIndexes[0]!;
        merged[fallbackIndex] = mergeEntry(merged[fallbackIndex]!, entry);
      } else {
        merged.push(entry);
      }
      continue;
    }
    merged.splice(0, merged.length, ...upsertEntryByIdentity(merged, entry, identity, maxEntryGeneration(merged)));
  }
  return orderEntries(merged);
}

function upsertEntryByIdentity(
  entries: TimelineEntry[],
  entry: TimelineEntry,
  key: string,
  stateGeneration: number
): TimelineEntry[] {
  const currentIndex = entries.findIndex((candidate) => identityKey(candidate, stateGeneration) === key);
  if (currentIndex >= 0) {
    return entries.map((candidate, index) => (index === currentIndex ? mergeEntry(candidate, entry) : candidate));
  }

  const fallbackIndexes = entries
    .map((candidate, index) => ({ candidate, index }))
    .filter(({ candidate }) => fallbackEquivalent(candidate, entry))
    .map(({ index }) => index);
  if (fallbackIndexes.length === 1) {
    const fallbackIndex = fallbackIndexes[0]!;
    return entries.map((candidate, index) => (index === fallbackIndex ? mergeEntry(candidate, entry) : candidate));
  }

  return [...entries, entry];
}

function mergeEntry(current: TimelineEntry, next: TimelineEntry): TimelineEntry {
  if (current.body.kind === "user-message" && next.body.kind === "user-message") {
    return {
      ...next,
      createdAt: Math.min(current.createdAt, next.createdAt),
      turnId: next.turnId ?? current.turnId,
      turnIndex: next.turnIndex ?? current.turnIndex,
      clientUserMessageId: next.clientUserMessageId ?? current.clientUserMessageId ?? current.id,
      generation: next.generation ?? current.generation,
      snapshotSequence: next.snapshotSequence ?? current.snapshotSequence,
      body: {
        ...next.body,
        imagePaths: next.body.imagePaths ?? current.body.imagePaths,
        skillReferences: next.body.skillReferences ?? current.body.skillReferences,
        status: next.body.status ?? current.body.status ?? "sent"
      }
    };
  }

  if (current.body.kind === "agent-message" && next.body.kind === "agent-message") {
    return mergeTextEntry(current, next, longerText(current.body.text, next.body.text));
  }

  if (current.body.kind === "reasoning" && next.body.kind === "reasoning") {
    return {
      ...mergeTextEntry(current, next, longerText(current.body.text, next.body.text)),
      body: {
        ...next.body,
        text: longerText(current.body.text, next.body.text),
        done: current.body.done || next.body.done
      }
    };
  }

  if (current.body.kind === "system" && next.body.kind === "system") {
    return mergeTextEntry(current, next, longerText(current.body.text, next.body.text));
  }

  if (current.body.kind === "tool" && next.body.kind === "tool") {
    const useNext =
      isFinalStatus(next.body.status) && !isFinalStatus(current.body.status) ||
      (next.body.result ?? "").length >= (current.body.result ?? "").length;
    const base = useNext ? next : current;
    const other = useNext ? current : next;
    const baseBody = useNext ? next.body : current.body;
    const otherBody = useNext ? current.body : next.body;
    return {
      ...base,
      createdAt: Math.min(current.createdAt, next.createdAt),
      turnId: base.turnId ?? other.turnId,
      turnIndex: base.turnIndex ?? other.turnIndex,
      clientUserMessageId: base.clientUserMessageId ?? other.clientUserMessageId,
      generation: base.generation ?? other.generation,
      snapshotSequence: base.snapshotSequence ?? other.snapshotSequence,
      body: {
        ...baseBody,
        actionKind: baseBody.actionKind ?? otherBody.actionKind,
        arguments: baseBody.arguments ?? otherBody.arguments,
        imagePaths: baseBody.imagePaths ?? otherBody.imagePaths,
        result: longerText(current.body.result ?? "", next.body.result ?? "") || undefined
      }
    };
  }

  return {
    ...next,
    createdAt: Math.min(current.createdAt, next.createdAt),
    turnId: next.turnId ?? current.turnId,
    turnIndex: next.turnIndex ?? current.turnIndex,
    clientUserMessageId: next.clientUserMessageId ?? current.clientUserMessageId,
    generation: next.generation ?? current.generation,
    snapshotSequence: next.snapshotSequence ?? current.snapshotSequence
  };
}

function mergeTextEntry(current: TimelineEntry, next: TimelineEntry, text: string): TimelineEntry {
  return {
    ...next,
    createdAt: Math.min(current.createdAt, next.createdAt),
    turnId: next.turnId ?? current.turnId,
    turnIndex: next.turnIndex ?? current.turnIndex,
    clientUserMessageId: next.clientUserMessageId ?? current.clientUserMessageId,
    generation: next.generation ?? current.generation,
    snapshotSequence: next.snapshotSequence ?? current.snapshotSequence,
    body: { ...next.body, text } as TimelineEntry["body"]
  };
}

function identityKey(entry: TimelineEntry, stateGeneration: number): string | null {
  const generation = entry.generation ?? stateGeneration;
  switch (entry.body.kind) {
    case "user-message":
      if (entry.clientUserMessageId) {
        return `user:client:${entry.clientUserMessageId}`;
      }
      if (entry.turnId) {
        return `user:${generation}:${entry.turnId}:${entry.id}`;
      }
      if (entry.id.startsWith("local-user-")) {
        return `user:local:${entry.id}`;
      }
      return null;
    case "agent-message":
    case "reasoning":
    case "diff":
      return entry.turnId ? `${entry.body.kind}:${generation}:${entry.turnId}:${entry.id}` : null;
    case "tool":
      if (entry.turnId) {
        const toolIdentity = [entry.body.toolKind ?? "", entry.body.server, entry.body.tool, entry.id].join(":");
        return `tool:${generation}:${entry.turnId}:${toolIdentity}`;
      }
      return null;
    case "system":
      if (isContextCompactionEntry(entry)) {
        return entry.turnId
          ? `system:compact:${generation}:${entry.turnId}`
          : `system:compact:${generation}:${entry.id}`;
      }
      return entry.turnId ? `system:${generation}:${entry.turnId}:${entry.id}` : `system:event:${entry.id}`;
    case "error":
    case "command":
      return entry.turnId ? `${entry.body.kind}:${generation}:${entry.turnId}:${entry.id}` : `${entry.body.kind}:event:${entry.id}`;
    default:
      return null;
  }
}

function fallbackEquivalent(left: TimelineEntry, right: TimelineEntry): boolean {
  if (left.turnId && right.turnId && left.turnId !== right.turnId) {
    return false;
  }
  if (left.body.kind !== right.body.kind) {
    return false;
  }
  if (left.body.kind === "user-message" && right.body.kind === "user-message") {
    if (left.clientUserMessageId && right.clientUserMessageId) {
      return left.clientUserMessageId === right.clientUserMessageId;
    }
    const oneLocal = isLocalUserEntry(left) !== isLocalUserEntry(right);
    return oneLocal && left.body.text.trim() === right.body.text.trim();
  }
  if (!left.turnId || !right.turnId) {
    return false;
  }
  if (left.generation !== undefined && right.generation !== undefined && left.generation !== right.generation) {
    return false;
  }
  if (left.body.kind === "agent-message" && right.body.kind === "agent-message") {
    return equivalentText(left.body.text, right.body.text);
  }
  if (left.body.kind === "reasoning" && right.body.kind === "reasoning") {
    return equivalentText(left.body.text, right.body.text);
  }
  if (left.body.kind === "tool" && right.body.kind === "tool") {
    return (
      left.body.toolKind === right.body.toolKind &&
      left.body.server === right.body.server &&
      left.body.tool === right.body.tool &&
      equivalentText(left.body.result ?? "", right.body.result ?? "")
    );
  }
  if (isContextCompactionEntry(left) && isContextCompactionEntry(right)) {
    return true;
  }
  return false;
}

function isLocalUserEntry(entry: TimelineEntry): boolean {
  return entry.body.kind === "user-message" && entry.id.startsWith("local-user-");
}

function orderEntries(entries: TimelineEntry[]): TimelineEntry[] {
  const turnOrder = new Map<string, number>();
  let nextTurnOrder = 0;
  for (const entry of entries) {
    if (!entry.turnId || turnOrder.has(entry.turnId)) {
      continue;
    }
    turnOrder.set(entry.turnId, nextTurnOrder);
    nextTurnOrder += 1;
  }

  return entries
    .map((entry, index) => ({ entry, index }))
    .sort((left, right) => {
      const leftTurnOrder = left.entry.turnId ? turnOrder.get(left.entry.turnId) : undefined;
      const rightTurnOrder = right.entry.turnId ? turnOrder.get(right.entry.turnId) : undefined;
      if (typeof leftTurnOrder === "number" && typeof rightTurnOrder === "number" && leftTurnOrder !== rightTurnOrder) {
        return leftTurnOrder - rightTurnOrder;
      }
      if (
        left.entry.turnId &&
        right.entry.turnId &&
        left.entry.turnId === right.entry.turnId &&
        left.entry.createdAt !== right.entry.createdAt
      ) {
        return left.entry.createdAt - right.entry.createdAt;
      }
      return left.index - right.index;
    })
    .map(({ entry }) => entry);
}

function nextGeneration(state: TimelineEngineState, explicit: number | undefined, entries: TimelineEntry[]): number {
  return Math.max(state.generation, explicit ?? 0, maxEntryGeneration(entries));
}

function maxEntryGeneration(entries: TimelineEntry[]): number {
  let generation = 0;
  for (const entry of entries) {
    if (typeof entry.generation === "number" && entry.generation > generation) {
      generation = entry.generation;
    }
  }
  return generation;
}

function entryGenerationOrState(entry: TimelineEntry, state: TimelineEngineState): number {
  return typeof entry.generation === "number" ? entry.generation : state.generation;
}

function isVisibleEntry(entry: TimelineEntry): boolean {
  return Boolean(entry.body.kind);
}

function isContextCompactionEntry(entry: TimelineEntry): boolean {
  return entry.body.kind === "system" && entry.body.text.trim() === CONTEXT_COMPACTION_DONE_TEXT;
}

function isFinalStatus(status: string): boolean {
  return status === "success" || status === "failed";
}

function equivalentText(left: string, right: string): boolean {
  const a = left.trim();
  const b = right.trim();
  return Boolean(a && b && (a === b || a.includes(b) || b.includes(a)));
}

function longerText(left: string, right: string): string {
  return right.length > left.length ? right : left;
}

function eventLedgerKey(generation: number, eventId: string): string {
  return `${generation}\u0000${eventId}`;
}

function revisionLedgerKey(generation: number, identity: string): string {
  return `${generation}\u0000${identity}`;
}

function trimStringSetInPlace(values: Set<string>, maxSize: number): void {
  while (values.size > maxSize) {
    const first = values.values().next().value;
    if (typeof first !== "string") {
      return;
    }
    values.delete(first);
  }
}
