import type { TimelineEntry } from "./timeline";
import type { TimelineCompleteness } from "../../shared/timeline-content";

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
  | {
      kind: "snapshot-merge";
      entries: TimelineEntry[];
      cursor?: string | null;
      generation?: number;
    }
  | TimelineEntryInput
  | TimelineDeltaInput
  | {
      kind: "live-event-batch";
      inputs: TimelineInput[];
    }
  | {
      kind: "rollback-fork-replace";
      entries: TimelineEntry[];
      generation?: number;
      deletedTurnIds?: string[];
    }
  | {
      kind: "remove-empty-reasoning";
      turnId: string | null;
      pendingId: string;
    }
  | {
      kind: "finish-turn";
      turnId: string;
      status: string;
    }
  | {
      kind: "bind-user-turn";
      clientUserMessageId: string;
      turnId: string;
    }
  | {
      kind: "start-reasoning";
      entry: TimelineEntry;
      pendingId: string;
      eventId?: string;
      revision?: number;
    }
  | {
      kind: "set-generation";
      generation: number;
    };

export type TimelineEntryInput = {
  kind:
    | "live-event"
    | "completed-item"
    | "overlay-item"
    | "turn-item-detail"
    | "rollout-supplement-item"
    | "optimistic-user";
  entry: TimelineEntry;
  eventId?: string;
  revision?: number;
};

export type TimelineDeltaInput = {
  kind: "live-delta";
  entry: TimelineEntry;
  eventId?: string;
  revision?: number;
  sequence?: number;
  deliveryEpoch?: number;
};

export type TimelineEngineDiagnostics = {
  fallbackIdentityMerges: number;
  identityConflicts: number;
  missingIdentityInputs: number;
  repairRequests: number;
  droppedStaleGenerationEvents: number;
  droppedDuplicateEvents: number;
  droppedStaleRevisions: number;
  normalizationRuns: number;
  normalizedEntryVisits: number;
  fastPathCommits: number;
  structuralNormalizations: number;
  indexRebuildEntries: number;
  droppedDeliveryEpochEvents: number;
  droppedStaleSequences: number;
  sequenceGaps: number;
  itemTruncations: number;
  repairRequiredInputs: number;
  fullContentCompletions: number;
  pageContinuations: number;
  eventTruncations: number;
};

export type OrderedDistinctTurn = {
  turnId: string;
  firstEntryId: string;
  order: number;
};

export type SnapshotDeltaSuppression = {
  text: string;
  offset: number;
  maxSequence?: number;
  generation?: number;
};

export type TimelineEngineIndexes = {
  byEntryId: Map<string, number>;
  byTurnId: Map<string, number[]>;
  byIdentity: Map<string, number>;
};

export type TimelineEngineState = {
  entries: TimelineEntry[];
  indexes: TimelineEngineIndexes;
  cursor: string | null;
  reachedBeginning: boolean;
  generation: number;
  deletedTurnIds: Set<string>;
  interruptedTurnIds: Set<string>;
  processedEventIds: Set<string>;
  itemRevisions: Map<string, number>;
  itemSequences: Map<string, number>;
  snapshotDeltaSuppressions: Map<string, SnapshotDeltaSuppression>;
  deliveryEpoch: number;
  diagnostics: TimelineEngineDiagnostics;
};

export function createTimelineEngineState(init?: Partial<TimelineEngineState>): TimelineEngineState {
  const generation = init?.generation ?? 0;
  const entries = init?.entries ? normalizeEntries(init.entries) : [];
  return {
    entries,
    indexes: init?.indexes ?? buildTimelineIndexes(entries, generation),
    cursor: init?.cursor ?? null,
    reachedBeginning: init?.reachedBeginning ?? false,
    generation,
    deletedTurnIds: new Set(init?.deletedTurnIds ?? []),
    interruptedTurnIds: new Set(init?.interruptedTurnIds ?? []),
    processedEventIds: new Set(init?.processedEventIds ?? []),
    itemRevisions: new Map(init?.itemRevisions ?? []),
    itemSequences: new Map(init?.itemSequences ?? []),
    snapshotDeltaSuppressions: new Map(init?.snapshotDeltaSuppressions ?? []),
    deliveryEpoch: init?.deliveryEpoch ?? 0,
    diagnostics: {
      fallbackIdentityMerges: 0,
      identityConflicts: 0,
      missingIdentityInputs: 0,
      repairRequests: 0,
      droppedStaleGenerationEvents: 0,
      droppedDuplicateEvents: 0,
      droppedStaleRevisions: 0,
      normalizationRuns: 0,
      normalizedEntryVisits: 0,
      fastPathCommits: 0,
      structuralNormalizations: 0,
      indexRebuildEntries: 0,
      droppedDeliveryEpochEvents: 0,
      droppedStaleSequences: 0,
      sequenceGaps: 0,
      itemTruncations: 0,
      repairRequiredInputs: 0,
      fullContentCompletions: 0,
      pageContinuations: 0,
      eventTruncations: 0,
      ...init?.diagnostics
    }
  };
}

export function applyTimelineInput(state: TimelineEngineState, input: TimelineInput): TimelineEngineState {
  switch (input.kind) {
    case "snapshot-window": {
      const generation = nextGeneration(state, input.generation, input.entries);
      const entries = mergeSnapshotEntriesWithExistingContent(state.entries, input.entries, generation);
      const diagnostics = input.cursor
        ? incrementDiagnostic(
            recordEntryCompletenessDiagnostics(state.diagnostics, state.entries, input.entries, generation),
            "pageContinuations"
          )
        : recordEntryCompletenessDiagnostics(state.diagnostics, state.entries, input.entries, generation);
      const nextState = withEntries(
        {
          ...state,
          generation,
          cursor: input.cursor ?? state.cursor,
          reachedBeginning: input.cursor === null,
          diagnostics
        },
        entries
      );
      return {
        ...nextState,
        processedEventIds: snapshotProcessedEventIds(nextState.processedEventIds, nextState.generation),
        itemRevisions: snapshotItemRevisions(nextState.entries, nextState.itemRevisions),
        snapshotDeltaSuppressions: createSnapshotDeltaSuppressions(nextState.entries),
        itemSequences: snapshotItemSequences(nextState.entries, nextState.generation, nextState.itemSequences)
      };
    }
    case "pagination-page": {
      const generation = nextGeneration(state, input.generation, input.entries);
      return withEntries(
        {
          ...state,
          generation,
          cursor: input.cursor ?? state.cursor,
          reachedBeginning: input.reachedBeginning ?? input.cursor === null,
          diagnostics: input.cursor
            ? incrementDiagnostic(state.diagnostics, "pageContinuations")
            : state.diagnostics
        },
        [...input.entries, ...state.entries]
      );
    }
    case "snapshot-merge": {
      const generation = nextGeneration(state, input.generation, input.entries);
      return applyEntryInputBatch(
        {
          ...state,
          generation,
          cursor: input.cursor ?? state.cursor,
          reachedBeginning: input.cursor === null
        },
        input.entries.map((entry) => ({ kind: "overlay-item", entry }))
      );
    }
    case "live-event-batch":
      return input.inputs.every(isTimelineEntryInput)
        ? applyEntryInputBatch(state, input.inputs)
        : input.inputs.reduce(applyTimelineInput, state);
    case "rollback-fork-replace": {
      const generation = Math.max(state.generation, input.generation ?? state.generation);
      return withEntries(
        {
          ...state,
          generation,
          deletedTurnIds: new Set([...(state.deletedTurnIds ?? []), ...(input.deletedTurnIds ?? [])]),
          processedEventIds: new Set(state.processedEventIds),
          itemRevisions: new Map(state.itemRevisions)
        },
        input.entries
      );
    }
    case "live-delta":
      return applyLiveDeltaInput(state, input);
    case "remove-empty-reasoning":
      return removeEmptyReasoning(state, input.turnId, input.pendingId);
    case "finish-turn":
      return finishTurnEntries(state, input.turnId, input.status);
    case "bind-user-turn":
      return bindUserTurn(state, input.clientUserMessageId, input.turnId);
    case "start-reasoning":
      return applyStartReasoningInput(state, input);
    case "set-generation": {
      if (input.generation <= state.generation) return state;
      return {
        ...state,
        generation: input.generation,
        processedEventIds: snapshotProcessedEventIds(state.processedEventIds, input.generation),
        snapshotDeltaSuppressions: createSnapshotDeltaSuppressions(state.entries)
      };
    }
    default:
      return applyEntryInput(state, input);
  }
}

function applyLiveDeltaInput(state: TimelineEngineState, input: TimelineDeltaInput): TimelineEngineState {
  if (typeof input.deliveryEpoch === "number" && input.deliveryEpoch !== state.deliveryEpoch) {
    return withDiagnostic(state, "droppedDeliveryEpochEvents");
  }
  const entryGeneration = entryGenerationOrState(input.entry, state);
  if (entryGeneration < state.generation && isVisibleEntry(input.entry)) {
    return withDiagnostic(state, "droppedStaleGenerationEvents");
  }
  if (
    input.entry.turnId &&
    (state.deletedTurnIds.has(input.entry.turnId) || state.interruptedTurnIds.has(input.entry.turnId))
  ) {
    return withDiagnostic(state, "droppedStaleGenerationEvents");
  }

  const eventKey = input.eventId ? eventLedgerKey(entryGeneration, input.eventId) : null;
  if (eventKey && state.processedEventIds.has(eventKey)) {
    return withDiagnostic(state, "droppedDuplicateEvents");
  }
  const identity = identityKey(input.entry, state.generation);
  if (!identity) {
    return withDiagnostic(withDiagnostic(state, "missingIdentityInputs"), "repairRequests");
  }

  const revisionKey = revisionLedgerKey(entryGeneration, identity);
  if (typeof input.revision === "number") {
    const itemRevisionKey = timelineItemRevisionKey(
      input.entry.id,
      typeof input.entry.generation === "number" ? input.entry.generation : null
    );
    const sameHistoricalEntry = state.entries.some(
      (entry) => entry.id === input.entry.id && entry.turnId === input.entry.turnId
    );
    const currentRevision = Math.max(
      state.itemRevisions.get(revisionKey) ?? Number.NEGATIVE_INFINITY,
      state.itemRevisions.get(itemRevisionKey) ?? Number.NEGATIVE_INFINITY,
      sameHistoricalEntry
        ? state.itemRevisions.get(timelineItemRevisionKey(input.entry.id, null)) ?? Number.NEGATIVE_INFINITY
        : Number.NEGATIVE_INFINITY
    );
    if (typeof currentRevision === "number") {
      if (input.revision < currentRevision) {
        return withDiagnostic(state, "droppedStaleRevisions");
      }
      if (input.revision === currentRevision) {
        return withDiagnostic(withDiagnostic(state, "identityConflicts"), "repairRequests");
      }
    }
  }

  const sequenceKey = revisionLedgerKey(entryGeneration, identity);
  const snapshotDeltaSuppressions = new Map(state.snapshotDeltaSuppressions);
  const suppressed = shouldSuppressSnapshotDeltaReplay(
    snapshotDeltaSuppressions,
    input.entry.id,
    deltaComparableText(input.entry),
    input.sequence,
    entryGeneration
  );
  if (typeof input.sequence === "number") {
    const currentSequence = state.itemSequences.get(sequenceKey);
    if (typeof currentSequence === "number") {
      if (input.sequence <= currentSequence) {
        if (suppressed) {
          return acceptedDeltaMetadataState(state, input, entryGeneration, identity, snapshotDeltaSuppressions);
        }
        return withDiagnostic(state, "droppedStaleSequences");
      }
      if (input.sequence > currentSequence + 1) {
        return withDiagnostic(withDiagnostic(state, "sequenceGaps"), "repairRequests");
      }
    }
  }

  const acceptedState = acceptedDeltaMetadataState(
    state,
    input,
    entryGeneration,
    identity,
    snapshotDeltaSuppressions
  );
  if (suppressed) {
    return acceptedState;
  }

  const currentIndex = state.indexes.byIdentity.get(identity);
  if (typeof currentIndex === "number") {
    const current = state.entries[currentIndex];
    const appended = current ? appendDeltaEntry(current, input.entry) : null;
    if (!appended) {
      return withDiagnostic(withDiagnostic(acceptedState, "identityConflicts"), "repairRequests");
    }
    const entries = state.entries.slice();
    entries[currentIndex] = appended;
    return {
      ...acceptedState,
      entries,
      diagnostics: incrementDiagnostic(acceptedState.diagnostics, "fastPathCommits")
    };
  }

  const pendingReplacement = replacePendingReasoningEntry(acceptedState, input.entry, identity);
  if (pendingReplacement) {
    return pendingReplacement;
  }

  const entries = [...state.entries, input.entry];
  const byEntryId = new Map(state.indexes.byEntryId);
  const byIdentity = new Map(state.indexes.byIdentity);
  const byTurnId = new Map(state.indexes.byTurnId);
  const index = entries.length - 1;
  byEntryId.set(input.entry.id, index);
  byIdentity.set(identity, index);
  if (input.entry.turnId) {
    byTurnId.set(input.entry.turnId, [...(byTurnId.get(input.entry.turnId) ?? []), index]);
  }
  return {
    ...acceptedState,
    entries,
    indexes: { byEntryId, byIdentity, byTurnId },
    diagnostics: incrementDiagnostic(acceptedState.diagnostics, "fastPathCommits")
  };
}

function acceptedDeltaMetadataState(
  state: TimelineEngineState,
  input: TimelineDeltaInput,
  entryGeneration: number,
  identity: string,
  snapshotDeltaSuppressions: Map<string, SnapshotDeltaSuppression>
): TimelineEngineState {
  const revisionKey = revisionLedgerKey(entryGeneration, identity);
  const sequenceKey = revisionLedgerKey(entryGeneration, identity);
  const eventKey = input.eventId ? eventLedgerKey(entryGeneration, input.eventId) : null;
  const processedEventIds = new Set(state.processedEventIds);
  if (eventKey) {
    processedEventIds.add(eventKey);
    if (input.eventId) {
      processedEventIds.add(input.eventId);
    }
    trimEventLedgerInPlace(processedEventIds, MAX_PROCESSED_EVENT_IDS, entryGeneration);
  }
  const itemRevisions = new Map(state.itemRevisions);
  if (typeof input.revision === "number") {
    itemRevisions.set(revisionKey, Math.max(itemRevisions.get(revisionKey) ?? 0, input.revision));
    const itemRevisionKey = timelineItemRevisionKey(
      input.entry.id,
      typeof input.entry.generation === "number" ? input.entry.generation : null
    );
    itemRevisions.set(itemRevisionKey, Math.max(itemRevisions.get(itemRevisionKey) ?? 0, input.revision));
  }
  const itemSequences = new Map(state.itemSequences);
  if (typeof input.sequence === "number") {
    itemSequences.set(sequenceKey, Math.max(itemSequences.get(sequenceKey) ?? 0, input.sequence));
  }
  return {
    ...state,
    generation: Math.max(state.generation, entryGeneration),
    processedEventIds,
    itemRevisions,
    itemSequences,
    snapshotDeltaSuppressions
  };
}

function snapshotItemSequences(
  entries: TimelineEntry[],
  generation: number,
  previous: Map<string, number>
): Map<string, number> {
  const itemSequences = new Map(previous);
  for (const entry of entries) {
    if (typeof entry.snapshotSequence !== "number") {
      continue;
    }
    const identity = identityKey(entry, generation);
    if (identity) {
      itemSequences.set(revisionLedgerKey(entry.generation ?? generation, identity), entry.snapshotSequence);
    }
  }
  return itemSequences;
}

function snapshotProcessedEventIds(values: Set<string>, generation: number): Set<string> {
  const processedEventIds = new Set(values);
  trimEventLedgerInPlace(processedEventIds, MAX_PROCESSED_EVENT_IDS, generation);
  return processedEventIds;
}

function snapshotItemRevisions(
  entries: TimelineEntry[],
  previous: Map<string, number>
): Map<string, number> {
  const itemRevisions = new Map(previous);
  for (const entry of entries) {
    const key = timelineItemRevisionKey(
      entry.id,
      typeof entry.generation === "number" ? entry.generation : null
    );
    if (!itemRevisions.has(key)) itemRevisions.set(key, 0);
  }
  return itemRevisions;
}

function replacePendingReasoningEntry(
  state: TimelineEngineState,
  entry: TimelineEntry,
  identity: string
): TimelineEngineState | null {
  if (entry.body.kind !== "reasoning" || !entry.turnId) {
    return null;
  }
  const pendingIndex = state.entries.findIndex(
    (candidate) =>
      candidate.turnId === entry.turnId &&
      candidate.body.kind === "reasoning" &&
      !candidate.body.text.trim() &&
      candidate.id.endsWith("-reasoning-pending")
  );
  if (pendingIndex < 0) {
    return null;
  }
  const pending = state.entries[pendingIndex]!;
  const entries = state.entries.slice();
  entries[pendingIndex] = { ...entry, createdAt: pending.createdAt };
  const byEntryId = new Map(state.indexes.byEntryId);
  byEntryId.delete(pending.id);
  byEntryId.set(entry.id, pendingIndex);
  const byIdentity = new Map(state.indexes.byIdentity);
  const pendingIdentity = identityKey(pending, state.generation);
  if (pendingIdentity) {
    byIdentity.delete(pendingIdentity);
  }
  byIdentity.set(identity, pendingIndex);
  return {
    ...state,
    entries,
    indexes: { ...state.indexes, byEntryId, byIdentity },
    diagnostics: incrementDiagnostic(state.diagnostics, "fastPathCommits")
  };
}

function deltaComparableText(entry: TimelineEntry): string {
  if (entry.body.kind === "agent-message" || entry.body.kind === "reasoning" || entry.body.kind === "system") {
    return entry.body.text;
  }
  if (entry.body.kind === "tool") {
    return entry.body.result ?? "";
  }
  return "";
}

function appendDeltaEntry(current: TimelineEntry, delta: TimelineEntry): TimelineEntry | null {
  if (current.body.kind === "agent-message" && delta.body.kind === "agent-message") {
    return { ...current, body: { ...current.body, text: `${current.body.text}${delta.body.text}` } };
  }
  if (current.body.kind === "reasoning" && delta.body.kind === "reasoning") {
    return {
      ...current,
      body: { ...current.body, text: `${current.body.text}${delta.body.text}`, done: current.body.done && delta.body.done }
    };
  }
  if (current.body.kind === "system" && delta.body.kind === "system") {
    return { ...current, body: { ...current.body, text: `${current.body.text}${delta.body.text}` } };
  }
  if (current.body.kind === "tool" && delta.body.kind === "tool") {
    return {
      ...current,
      body: {
        ...current.body,
        toolKind: delta.body.toolKind ?? current.body.toolKind,
        actionKind: delta.body.actionKind ?? current.body.actionKind,
        server: delta.body.server || current.body.server,
        tool: delta.body.tool || current.body.tool,
        status: delta.body.status,
        result: `${current.body.result ?? ""}${delta.body.result ?? ""}`
      }
    };
  }
  return null;
}

export function selectTimelineEntries(state: TimelineEngineState): TimelineEntry[] {
  return state.entries;
}

export function selectOrderedDistinctTurns(state: TimelineEngineState): OrderedDistinctTurn[] {
  return selectOrderedDistinctTurnsForNormalizedEntries(state.entries);
}

export function selectOrderedDistinctTurnsForNormalizedEntries(entries: TimelineEntry[]): OrderedDistinctTurn[] {
  const turns: OrderedDistinctTurn[] = [];
  const seen = new Set<string>();
  for (const entry of entries) {
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

export function selectTurnHasVisibleOutput(state: TimelineEngineState, turnId: string): boolean {
  const turnIndexes = state.indexes.byTurnId.get(turnId) ?? [];
  return turnIndexes.some((index) => {
    const entry = state.entries[index];
    return entry ? isVisibleTurnOutputEntry(entry) : false;
  });
}

export function selectHasContextCompactionCompletion(state: TimelineEngineState): boolean {
  for (const identity of state.indexes.byIdentity.keys()) {
    if (identity.startsWith("system:compact:")) {
      return true;
    }
  }
  return false;
}

export function selectRollbackMetadataForEntry(
  state: TimelineEngineState,
  target: TimelineEntry
): { numTurns: number; expectedDeletedTurnIds: string[] } | null {
  if (!target.turnId) {
    return null;
  }

  const turnIds = selectOrderedDistinctTurns(state).map((turn) => turn.turnId);
  const targetIndex = turnIds.indexOf(target.turnId);
  if (targetIndex < 0) {
    return null;
  }
  if (targetIndex === 0 && state.cursor) {
    return null;
  }

  const expectedDeletedTurnIds = turnIds.slice(targetIndex);
  return expectedDeletedTurnIds.length
    ? { numTurns: expectedDeletedTurnIds.length, expectedDeletedTurnIds }
    : null;
}

export function isVisibleTurnOutputEntry(entry: TimelineEntry): boolean {
  switch (entry.body.kind) {
    case "agent-message":
    case "reasoning":
    case "system":
    case "error":
      return entry.body.text.trim().length > 0;
    case "tool":
    case "command":
    case "diff":
      return true;
    case "user-message":
      return false;
  }
}

export function isContextCompactionCompletionEntry(entry: TimelineEntry): boolean {
  return isContextCompactionEntry(entry);
}

export function createSnapshotDeltaSuppressions(entries: TimelineEntry[]): Map<string, SnapshotDeltaSuppression> {
  const suppressions = new Map<string, SnapshotDeltaSuppression>();
  for (const entry of entries) {
    const text = snapshotDeltaComparableText(entry);
    if (text) {
      suppressions.set(entry.id, {
        text,
        offset: 0,
        ...(typeof entry.snapshotSequence === "number" ? { maxSequence: entry.snapshotSequence } : {}),
        ...(typeof entry.generation === "number" ? { generation: entry.generation } : {})
      });
    }
  }
  return suppressions;
}

export function shouldSuppressSnapshotDeltaReplay(
  suppressions: Map<string, SnapshotDeltaSuppression>,
  itemId: string,
  delta: string,
  sequence: unknown,
  generation: number | null
): boolean {
  const suppression = suppressions.get(itemId);
  if (!suppression) {
    return false;
  }

  if (
    typeof suppression.generation === "number" &&
    generation !== null &&
    generation !== suppression.generation
  ) {
    suppressions.delete(itemId);
    return false;
  }

  const eventSequence = typeof sequence === "number" ? sequence : null;
  if (
    typeof suppression.maxSequence === "number" &&
    eventSequence !== null &&
    eventSequence > suppression.maxSequence
  ) {
    suppressions.delete(itemId);
    return false;
  }

  const remaining = suppression.text.slice(suppression.offset);
  const coveredIndex =
    typeof suppression.maxSequence === "number" && eventSequence !== null
      ? suppression.text.indexOf(delta, suppression.offset)
      : remaining.startsWith(delta)
        ? suppression.offset
        : -1;
  if (coveredIndex < 0) {
    suppressions.delete(itemId);
    return false;
  }

  const nextOffset = coveredIndex + delta.length;
  if (nextOffset >= suppression.text.length) {
    suppressions.delete(itemId);
  } else {
    suppressions.set(itemId, { ...suppression, offset: nextOffset });
  }
  return true;
}

export function timelineItemRevisionKey(itemId: string, generation: number | null): string {
  return `${generation ?? "legacy"}\u0000${itemId}`;
}

function applyEntryInput(state: TimelineEngineState, input: TimelineEntryInput): TimelineEngineState {
  const entryGeneration = entryGenerationOrState(input.entry, state);
  if (entryGeneration < state.generation && isVisibleEntry(input.entry)) {
    return withDiagnostic(state, "droppedStaleGenerationEvents");
  }
  if (
    input.entry.turnId &&
    (state.deletedTurnIds.has(input.entry.turnId) || state.interruptedTurnIds.has(input.entry.turnId))
  ) {
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

  const processedEventIds = new Set(state.processedEventIds);
  if (eventKey) {
    processedEventIds.add(eventKey);
    if (input.eventId) processedEventIds.add(input.eventId);
    trimEventLedgerInPlace(processedEventIds, MAX_PROCESSED_EVENT_IDS, entryGeneration);
  }
  const itemRevisions = new Map(state.itemRevisions);
  if (typeof input.revision === "number") {
    itemRevisions.set(revisionKey, Math.max(itemRevisions.get(revisionKey) ?? 0, input.revision));
    const itemRevisionKey = timelineItemRevisionKey(
      input.entry.id,
      typeof input.entry.generation === "number" ? input.entry.generation : null
    );
    itemRevisions.set(itemRevisionKey, Math.max(itemRevisions.get(itemRevisionKey) ?? 0, input.revision));
  }

  const nextState = {
    ...state,
    generation: Math.max(state.generation, entryGeneration),
    processedEventIds,
    itemRevisions,
    diagnostics: recordEntryCompletenessDiagnostic(state.diagnostics, state.entries[state.indexes.byIdentity.get(identity) ?? -1], input.entry)
  };
  const authoritative = isAuthoritativeEntryInput(input);
  const fastPath = applyIndexedEntryUpdate(nextState, input.entry, identity, authoritative);
  return fastPath ?? withEntries(
    nextState,
    upsertEntryByIdentity(state.entries, input.entry, identity, state.generation, authoritative)
  );
}

function isTimelineEntryInput(input: TimelineInput): input is TimelineEntryInput {
  return (
    input.kind === "live-event" ||
    input.kind === "completed-item" ||
    input.kind === "overlay-item" ||
    input.kind === "turn-item-detail" ||
    input.kind === "rollout-supplement-item" ||
    input.kind === "optimistic-user"
  );
}

function applyEntryInputBatch(state: TimelineEngineState, inputs: TimelineEntryInput[]): TimelineEngineState {
  let workingState = state;
  const structuralInputs: Array<{ entry: TimelineEntry; identity: string; authoritative: boolean }> = [];

  for (const input of inputs) {
    const entryGeneration = entryGenerationOrState(input.entry, workingState);
    if (entryGeneration < workingState.generation && isVisibleEntry(input.entry)) {
      workingState = withDiagnostic(workingState, "droppedStaleGenerationEvents");
      continue;
    }
    if (
      input.entry.turnId &&
      (workingState.deletedTurnIds.has(input.entry.turnId) || workingState.interruptedTurnIds.has(input.entry.turnId))
    ) {
      workingState = withDiagnostic(workingState, "droppedStaleGenerationEvents");
      continue;
    }

    const eventKey = input.eventId ? eventLedgerKey(entryGeneration, input.eventId) : null;
    if (eventKey && workingState.processedEventIds.has(eventKey)) {
      workingState = withDiagnostic(workingState, "droppedDuplicateEvents");
      continue;
    }

    const identity = identityKey(input.entry, workingState.generation);
    if (!identity) {
      workingState = withDiagnostic(workingState, "missingIdentityInputs");
      continue;
    }

    const revisionKey = revisionLedgerKey(entryGeneration, identity);
    if (typeof input.revision === "number") {
      const currentRevision = workingState.itemRevisions.get(revisionKey);
      if (typeof currentRevision === "number" && input.revision <= currentRevision) {
        workingState = withDiagnostic(workingState, "droppedStaleRevisions");
        continue;
      }
    }

    const processedEventIds = new Set(workingState.processedEventIds);
    if (eventKey) {
      processedEventIds.add(eventKey);
      trimEventLedgerInPlace(processedEventIds, MAX_PROCESSED_EVENT_IDS, entryGeneration);
    }
    const itemRevisions = new Map(workingState.itemRevisions);
    if (typeof input.revision === "number") {
      itemRevisions.set(revisionKey, Math.max(itemRevisions.get(revisionKey) ?? 0, input.revision));
      const itemRevisionKey = timelineItemRevisionKey(
        input.entry.id,
        typeof input.entry.generation === "number" ? input.entry.generation : null
      );
      itemRevisions.set(itemRevisionKey, Math.max(itemRevisions.get(itemRevisionKey) ?? 0, input.revision));
    }
    const nextState = {
      ...workingState,
      generation: Math.max(workingState.generation, entryGeneration),
      processedEventIds,
      itemRevisions
    };
    const authoritative = isAuthoritativeEntryInput(input);
    const fastPath = applyIndexedEntryUpdate(nextState, input.entry, identity, authoritative);
    if (fastPath) {
      workingState = fastPath;
    } else {
      workingState = nextState;
      structuralInputs.push({ entry: input.entry, identity, authoritative });
    }
  }

  if (!structuralInputs.length) {
    return workingState;
  }

  let entries = workingState.entries;
  for (const input of structuralInputs) {
    entries = upsertEntryByIdentity(
      entries,
      input.entry,
      input.identity,
      workingState.generation,
      input.authoritative
    );
  }
  return withEntries(workingState, entries);
}

function applyIndexedEntryUpdate(
  state: TimelineEngineState,
  entry: TimelineEntry,
  identity: string,
  authoritative = false
): TimelineEngineState | null {
  const currentIndex = state.indexes.byIdentity.get(identity);
  if (typeof currentIndex !== "number") {
    return null;
  }
  const current = state.entries[currentIndex];
  if (!current) {
    return null;
  }
  const merged = mergeEntry(current, entry, authoritative);
  if (
    merged.id !== current.id ||
    merged.turnId !== current.turnId ||
    merged.turnIndex !== current.turnIndex ||
    merged.createdAt !== current.createdAt ||
    identityKey(merged, state.generation) !== identity
  ) {
    return null;
  }

  const entries = state.entries.slice();
  entries[currentIndex] = merged;
  return {
    ...state,
    entries,
    diagnostics: incrementDiagnostic(state.diagnostics, "fastPathCommits")
  };
}

function withEntries(state: TimelineEngineState, entries: TimelineEntry[]): TimelineEngineState {
  const normalizedEntries = normalizeEntries(entries);
  return {
    ...state,
    entries: normalizedEntries,
    indexes: buildTimelineIndexes(normalizedEntries, state.generation),
    diagnostics: {
      ...state.diagnostics,
      normalizationRuns: state.diagnostics.normalizationRuns + 1,
      normalizedEntryVisits: state.diagnostics.normalizedEntryVisits + entries.length,
      structuralNormalizations: state.diagnostics.structuralNormalizations + 1,
      indexRebuildEntries: state.diagnostics.indexRebuildEntries + normalizedEntries.length
    }
  };
}

function withDiagnostic(
  state: TimelineEngineState,
  key: keyof TimelineEngineDiagnostics
): TimelineEngineState {
  return {
    ...state,
    diagnostics: incrementDiagnostic(state.diagnostics, key)
  };
}

function incrementDiagnostic(
  diagnostics: TimelineEngineDiagnostics,
  key: keyof TimelineEngineDiagnostics
): TimelineEngineDiagnostics {
  return {
    ...diagnostics,
    [key]: diagnostics[key] + 1
  };
}

function normalizeEntries(entries: TimelineEntry[]): TimelineEntry[] {
  const generation = maxEntryGeneration(entries);
  const merged: TimelineEntry[] = [];
  const identityIndexes = new Map<string, number>();
  const fallbackBuckets = new Map<string, number[]>();

  for (const entry of entries) {
    const identity = identityKey(entry, generation);
    const identityIndex = identity ? identityIndexes.get(identity) : undefined;
    if (typeof identityIndex === "number") {
      merged[identityIndex] = mergeEntry(merged[identityIndex]!, entry);
      continue;
    }

    const bucketKeys = fallbackBucketKeys(entry);
    const fallbackIndexes = Array.from(
      new Set(bucketKeys.flatMap((bucketKey) => fallbackBuckets.get(bucketKey) ?? []))
    ).filter((index) => fallbackEquivalent(merged[index]!, entry));
    if (fallbackIndexes.length === 1) {
      const fallbackIndex = fallbackIndexes[0]!;
      merged[fallbackIndex] = mergeEntry(merged[fallbackIndex]!, entry);
      if (identity) {
        identityIndexes.set(identity, fallbackIndex);
      }
      continue;
    }

    const nextIndex = merged.length;
    merged.push(entry);
    if (identity) {
      identityIndexes.set(identity, nextIndex);
    }
    for (const bucketKey of bucketKeys) {
      const bucket = fallbackBuckets.get(bucketKey) ?? [];
      bucket.push(nextIndex);
      fallbackBuckets.set(bucketKey, bucket);
    }
  }
  return orderEntries(merged);
}

function fallbackBucketKeys(entry: TimelineEntry): string[] {
  const keys = [`id:${entry.body.kind}:${entry.id}`];
  if (entry.body.kind === "user-message") {
    keys.push(`user:${entry.body.text.trim()}`);
    return keys;
  }
  if (isContextCompactionEntry(entry)) {
    keys.push(`compact:${entry.turnId ?? "none"}`);
    return keys;
  }
  keys.push(`${entry.body.kind}:${entry.turnId ?? "none"}`);
  return keys;
}

function buildTimelineIndexes(entries: TimelineEntry[], generation: number): TimelineEngineIndexes {
  const byEntryId = new Map<string, number>();
  const byTurnId = new Map<string, number[]>();
  const byIdentity = new Map<string, number>();

  entries.forEach((entry, index) => {
    byEntryId.set(entry.id, index);
    if (entry.turnId) {
      const turnIndexes = byTurnId.get(entry.turnId) ?? [];
      turnIndexes.push(index);
      byTurnId.set(entry.turnId, turnIndexes);
    }
    const identity = identityKey(entry, generation);
    if (identity) {
      byIdentity.set(identity, index);
    }
  });

  return { byEntryId, byTurnId, byIdentity };
}

function upsertEntryByIdentity(
  entries: TimelineEntry[],
  entry: TimelineEntry,
  key: string,
  stateGeneration: number,
  authoritative = false
): TimelineEntry[] {
  const currentIndex = entries.findIndex((candidate) => identityKey(candidate, stateGeneration) === key);
  if (currentIndex >= 0) {
    return entries.map((candidate, index) =>
      index === currentIndex ? mergeEntry(candidate, entry, authoritative) : candidate
    );
  }

  const fallbackIndexes = entries
    .map((candidate, index) => ({ candidate, index }))
    .filter(({ candidate }) =>
      fallbackEquivalent(candidate, entry) || (authoritative && fallbackLiveEquivalent(candidate, entry))
    )
    .map(({ index }) => index);
  if (fallbackIndexes.length === 1) {
    const fallbackIndex = fallbackIndexes[0]!;
    return entries.map((candidate, index) =>
      index === fallbackIndex ? mergeEntry(candidate, entry, authoritative) : candidate
    );
  }

  return insertEntryBySourceOrder(entries, entry);
}

function mergeEntry(current: TimelineEntry, next: TimelineEntry, authoritative = false): TimelineEntry {
  const keepCurrentContent = shouldKeepCurrentTimelineContent(current.completeness, next.completeness);
  const completeness = mergeTimelineCompleteness(current.completeness, next.completeness);
  if (current.body.kind === "user-message" && next.body.kind === "user-message") {
    const keepCurrentLocal =
      isLocalUserEntry(current) &&
      isLocalUserEntry(next) &&
      !current.turnId &&
      !next.turnId;
    const base = keepCurrentLocal ? current : next;
    const other = keepCurrentLocal ? next : current;
    const baseBody = keepCurrentLocal ? current.body : next.body;
    const otherBody = keepCurrentLocal ? next.body : current.body;
    return {
      ...base,
      createdAt: current.createdAt,
      turnId: base.turnId ?? other.turnId,
      turnIndex: base.turnIndex ?? other.turnIndex,
      clientUserMessageId: base.clientUserMessageId ?? other.clientUserMessageId ?? current.id,
      generation: base.generation ?? other.generation,
      snapshotSequence: base.snapshotSequence ?? other.snapshotSequence,
      ...(completeness ? { completeness } : {}),
      body: {
        ...baseBody,
        imagePaths: baseBody.imagePaths ?? otherBody.imagePaths,
        skillReferences: baseBody.skillReferences ?? otherBody.skillReferences,
        status: baseBody.status ?? otherBody.status ?? "sent"
      }
    };
  }

  if (current.body.kind === "agent-message" && next.body.kind === "agent-message") {
    const text = keepCurrentContent
      ? current.body.text
      : authoritative && next.body.text.trim()
        ? next.body.text
        : longerText(current.body.text, next.body.text);
    return mergeTextEntry(current, next, text, completeness);
  }

  if (current.body.kind === "reasoning" && next.body.kind === "reasoning") {
    const text = keepCurrentContent
      ? current.body.text
      : authoritative && next.body.text.trim()
        ? next.body.text
        : next.body.done
          ? next.body.text || current.body.text
          : longerText(current.body.text, next.body.text);
    return {
      ...mergeTextEntry(current, next, text, completeness),
      body: {
        ...next.body,
        text,
        done: current.body.done || next.body.done
      }
    };
  }

  if (current.body.kind === "system" && next.body.kind === "system") {
    return mergeTextEntry(
      current,
      next,
      keepCurrentContent ? current.body.text : longerText(current.body.text, next.body.text),
      completeness
    );
  }

  if (current.body.kind === "tool" && next.body.kind === "tool") {
    const useNext =
      !keepCurrentContent &&
      (isFinalStatus(next.body.status) && !isFinalStatus(current.body.status) ||
        (next.body.result ?? "").length >= (current.body.result ?? "").length);
    const base = useNext ? next : current;
    const other = useNext ? current : next;
    const baseBody = useNext ? next.body : current.body;
    const otherBody = useNext ? current.body : next.body;
    return {
      ...base,
      createdAt: current.createdAt,
      turnId: base.turnId ?? other.turnId,
      turnIndex: base.turnIndex ?? other.turnIndex,
      clientUserMessageId: base.clientUserMessageId ?? other.clientUserMessageId,
      generation: base.generation ?? other.generation,
      snapshotSequence: base.snapshotSequence ?? other.snapshotSequence,
      ...(completeness ? { completeness } : {}),
      body: {
        ...baseBody,
        actionKind: baseBody.actionKind ?? otherBody.actionKind,
        arguments: baseBody.arguments ?? otherBody.arguments,
        imagePaths: baseBody.imagePaths ?? otherBody.imagePaths,
        result:
          keepCurrentContent
            ? current.body.result
            : authoritative && (next.body.result ?? "").trim()
            ? next.body.result
            : longerText(current.body.result ?? "", next.body.result ?? "") || undefined
      }
    };
  }

  return {
    ...next,
    createdAt: current.createdAt,
    turnId: next.turnId ?? current.turnId,
    turnIndex: next.turnIndex ?? current.turnIndex,
    clientUserMessageId: next.clientUserMessageId ?? current.clientUserMessageId,
    generation: next.generation ?? current.generation,
    snapshotSequence: next.snapshotSequence ?? current.snapshotSequence,
    ...(completeness ? { completeness } : {})
  };
}

function isAuthoritativeEntryInput(input: TimelineEntryInput): boolean {
  return input.kind === "completed-item" || input.kind === "turn-item-detail" || input.kind === "rollout-supplement-item";
}

function fallbackLiveEquivalent(current: TimelineEntry, next: TimelineEntry): boolean {
  if (!current.turnId || current.turnId !== next.turnId || current.body.kind !== next.body.kind) {
    return false;
  }
  if (current.generation !== undefined && next.generation !== undefined && current.generation !== next.generation) {
    return false;
  }
  return current.id.endsWith(":live");
}

function insertEntryBySourceOrder(entries: TimelineEntry[], entry: TimelineEntry): TimelineEntry[] {
  const beforeEntryId = entry.sourceOrder?.beforeEntryId;
  if (beforeEntryId) {
    const beforeIndex = entries.findIndex((candidate) => candidate.id === beforeEntryId);
    if (beforeIndex >= 0) {
      return [...entries.slice(0, beforeIndex), entry, ...entries.slice(beforeIndex)];
    }
  }
  const afterEntryId = entry.sourceOrder?.afterEntryId;
  if (afterEntryId) {
    const afterIndex = entries.findIndex((candidate) => candidate.id === afterEntryId);
    if (afterIndex >= 0) {
      return [...entries.slice(0, afterIndex + 1), entry, ...entries.slice(afterIndex + 1)];
    }
  }
  return [...entries, entry];
}

function removeEmptyReasoning(state: TimelineEngineState, turnId: string | null, pendingId: string): TimelineEngineState {
  const entries = state.entries.filter((entry) =>
    !(entry.id === pendingId && (!turnId || entry.turnId === turnId) && entry.body.kind === "reasoning" && !entry.body.text.trim())
  );
  return entries.length === state.entries.length ? state : withEntries(state, entries);
}

function finishTurnEntries(state: TimelineEngineState, turnId: string, status: string): TimelineEngineState {
  const failed = /fail|error|cancel|interrupt/i.test(status);
  const userFailed = /fail|error/i.test(status);
  const completedStatus: "failed" | "success" = failed ? "failed" : "success";
  let changed = false;
  const entries: TimelineEntry[] = state.entries.flatMap<TimelineEntry>((entry) => {
    if (entry.turnId !== turnId) return [entry];
    if (entry.body.kind === "reasoning" && entry.body.done === false) {
      changed = true;
      return entry.body.text.trim() ? [{ ...entry, body: { ...entry.body, done: true } }] : [];
    }
    if (userFailed && entry.body.kind === "user-message" && entry.body.status !== "failed") {
      changed = true;
      return [{ ...entry, body: { ...entry.body, status: "failed" as const } }];
    }
    if (entry.body.kind === "tool" && entry.body.status === "running") {
      changed = true;
      return [{ ...entry, body: { ...entry.body, status: completedStatus } }];
    }
    if (entry.body.kind === "command" && entry.body.status === "running") {
      changed = true;
      return [{ ...entry, body: { ...entry.body, status: completedStatus } }];
    }
    return [entry];
  });
  return changed ? withEntries(state, entries) : state;
}

function bindUserTurn(state: TimelineEngineState, clientUserMessageId: string, turnId: string): TimelineEngineState {
  const index = state.entries.findIndex(
    (entry) => entry.id === clientUserMessageId && entry.body.kind === "user-message"
  );
  if (index < 0) return state;
  const current = state.entries[index]!;
  const entries = state.entries.slice();
  entries[index] = {
    ...current,
    turnId,
    clientUserMessageId,
    body: current.body.kind === "user-message" ? { ...current.body, status: "sent" } : current.body
  };
  return withEntries(state, entries);
}

function startReasoning(state: TimelineEngineState, entry: TimelineEntry, pendingId: string): TimelineEngineState {
  const existingIndex = state.entries.findIndex(
    (candidate) => candidate.id === entry.id && candidate.body.kind === "reasoning"
  );
  const pendingIndex = state.entries.findIndex((candidate) => candidate.id === pendingId && candidate.id !== entry.id);
  if (existingIndex >= 0) {
    const current = state.entries[existingIndex]!;
    if (current.body.kind !== "reasoning") return state;
    const nextEntry = {
      ...current,
      ...(!current.turnId && entry.turnId ? { turnId: entry.turnId } : {}),
      body: { ...current.body, done: false }
    };
    const entries = state.entries
      .map((candidate, index) => (index === existingIndex ? nextEntry : candidate))
      .filter((_candidate, index) => index !== pendingIndex);
    return withEntries(state, entries);
  }
  if (pendingIndex >= 0) {
    const entries = state.entries.slice();
    entries[pendingIndex] = entry;
    return withEntries(state, entries);
  }
  return withEntries(state, [...state.entries, entry]);
}

function applyStartReasoningInput(
  state: TimelineEngineState,
  input: Extract<TimelineInput, { kind: "start-reasoning" }>
): TimelineEngineState {
  const accepted = applyEntryInput(state, {
    kind: "live-event",
    entry: input.entry,
    ...(input.eventId ? { eventId: input.eventId } : {}),
    ...(typeof input.revision === "number" ? { revision: input.revision } : {})
  });
  return accepted.entries === state.entries ? accepted : startReasoning(accepted, input.entry, input.pendingId);
}

function mergeTextEntry(
  current: TimelineEntry,
  next: TimelineEntry,
  text: string,
  completeness = mergeTimelineCompleteness(current.completeness, next.completeness)
): TimelineEntry {
  return {
    ...next,
    createdAt: current.createdAt,
    turnId: next.turnId ?? current.turnId,
    turnIndex: next.turnIndex ?? current.turnIndex,
    clientUserMessageId: next.clientUserMessageId ?? current.clientUserMessageId,
    generation: next.generation ?? current.generation,
    snapshotSequence: next.snapshotSequence ?? current.snapshotSequence,
    ...(completeness ? { completeness } : {}),
    body: { ...next.body, text } as TimelineEntry["body"]
  };
}

function shouldKeepCurrentTimelineContent(
  current: TimelineCompleteness | undefined,
  next: TimelineCompleteness | undefined
): boolean {
  return completenessPreference(current, next) > 0;
}

function mergeTimelineCompleteness(
  current: TimelineCompleteness | undefined,
  next: TimelineCompleteness | undefined
): TimelineCompleteness | undefined {
  if (shouldKeepCurrentTimelineContent(current, next)) {
    return mergePreferredTimelineCompleteness(current!, next);
  }
  if (next?.status === "complete") {
    return next;
  }
  if (current?.status === "repair-required") {
    return current;
  }
  if (next && current) {
    return mergePreferredTimelineCompleteness(next, current);
  }
  return next ?? current;
}

function completenessPreference(
  current: TimelineCompleteness | undefined,
  next: TimelineCompleteness | undefined
): number {
  if (!current) return next ? -1 : 0;
  if (!next) return 1;
  if (current.status === "complete") return next.status === "complete" ? 0 : 1;
  if (next.status === "complete") return -1;
  if (current.status === "repair-required") return next.status === "repair-required" ? 0 : 1;
  if (next.status === "repair-required") return -1;
  const currentScore = (current.contentRef ? 1_000_000_000 : 0) + (current.includedBytes ?? 0);
  const nextScore = (next.contentRef ? 1_000_000_000 : 0) + (next.includedBytes ?? 0);
  return currentScore === nextScore ? 0 : currentScore > nextScore ? 1 : -1;
}

function mergePreferredTimelineCompleteness(
  preferred: TimelineCompleteness,
  other: TimelineCompleteness | undefined
): TimelineCompleteness {
  if (!other) return preferred;
  const originalBytes = Math.max(preferred.originalBytes ?? 0, other.originalBytes ?? 0);
  const includedBytes = Math.max(preferred.includedBytes ?? 0, other.includedBytes ?? 0);
  return {
    ...other,
    ...preferred,
    nextCursor: other.nextCursor ?? preferred.nextCursor,
    contentRef: preferred.contentRef ?? other.contentRef,
    contentCursor: preferred.contentCursor ?? other.contentCursor,
    ...(originalBytes ? { originalBytes } : {}),
    ...(includedBytes ? { includedBytes } : {})
  };
}

function mergeSnapshotEntriesWithExistingContent(
  currentEntries: TimelineEntry[],
  snapshotEntries: TimelineEntry[],
  generation: number
): TimelineEntry[] {
  const currentByIdentity = new Map<string, TimelineEntry>();
  for (const entry of currentEntries) {
    const identity = identityKey(entry, generation);
    if (identity) {
      currentByIdentity.set(identity, entry);
    }
  }
  return snapshotEntries.map((entry) => {
    const identity = identityKey(entry, generation);
    const current = identity ? currentByIdentity.get(identity) : undefined;
    return current ? mergeEntry(current, entry, true) : entry;
  });
}

function recordEntryCompletenessDiagnostics(
  diagnostics: TimelineEngineDiagnostics,
  currentEntries: TimelineEntry[],
  nextEntries: TimelineEntry[],
  generation: number
): TimelineEngineDiagnostics {
  const currentByIdentity = new Map<string, TimelineEntry>();
  for (const entry of currentEntries) {
    const identity = identityKey(entry, generation);
    if (identity) {
      currentByIdentity.set(identity, entry);
    }
  }
  return nextEntries.reduce((currentDiagnostics, entry) => {
    const identity = identityKey(entry, generation);
    return recordEntryCompletenessDiagnostic(
      currentDiagnostics,
      identity ? currentByIdentity.get(identity) : undefined,
      entry
    );
  }, diagnostics);
}

function recordEntryCompletenessDiagnostic(
  diagnostics: TimelineEngineDiagnostics,
  current: TimelineEntry | undefined,
  next: TimelineEntry
): TimelineEngineDiagnostics {
  let result = diagnostics;
  if (next.completeness?.status === "truncated") {
    result = incrementDiagnostic(result, "itemTruncations");
    if (next.completeness.reason === "event-budget") {
      result = incrementDiagnostic(result, "eventTruncations");
    }
  }
  if (next.completeness?.status === "repair-required") {
    result = incrementDiagnostic(result, "repairRequiredInputs");
  }
  if (
    next.completeness?.status === "complete" &&
    current?.completeness &&
    current.completeness.status !== "complete"
  ) {
    result = incrementDiagnostic(result, "fullContentCompletions");
  }
  return result;
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
      return `user:event:${entry.id}`;
    case "agent-message":
    case "reasoning":
    case "diff":
      return entry.turnId
        ? `${entry.body.kind}:${generation}:${entry.turnId}:${entry.id}`
        : `${entry.body.kind}:event:${entry.id}`;
    case "tool":
      if (entry.turnId) {
        const toolIdentity = [entry.body.toolKind ?? "", entry.body.server, entry.body.tool, entry.id].join(":");
        return `tool:${generation}:${entry.turnId}:${toolIdentity}`;
      }
      return `tool:event:${entry.id}`;
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
  if (left.id === right.id) {
    return true;
  }
  if (left.body.kind === "user-message" && right.body.kind === "user-message") {
    if (left.clientUserMessageId && right.clientUserMessageId) {
      return left.clientUserMessageId === right.clientUserMessageId;
    }
    if (isLocalUserEntry(left) && isLocalUserEntry(right) && !left.turnId && !right.turnId) {
      return left.body.text.trim() === right.body.text.trim();
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
        left.entry.turnId === right.entry.turnId
      ) {
        const leftOrder = left.entry.sourceOrder;
        const rightOrder = right.entry.sourceOrder;
        if (
          leftOrder &&
          rightOrder &&
          leftOrder.sourceKind === rightOrder.sourceKind &&
          leftOrder.ordinal !== rightOrder.ordinal
        ) {
          return leftOrder.ordinal - rightOrder.ordinal;
        }
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

function snapshotDeltaComparableText(entry: TimelineEntry): string {
  if (entry.body.kind === "agent-message" || entry.body.kind === "reasoning" || entry.body.kind === "system") {
    return entry.body.text;
  }
  if (entry.body.kind === "tool") {
    return entry.body.result ?? "";
  }
  return "";
}

function longerText(left: string, right: string): string {
  return right.length > left.length ? right : left;
}

function eventLedgerKey(generation: number, eventId: string): string {
  return `${generation}\u0000${eventId}`;
}

export function timelineEventLedgerKey(generation: number, eventId: string): string {
  return eventLedgerKey(generation, eventId);
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

function trimEventLedgerInPlace(values: Set<string>, maxSize: number, currentGeneration: number): void {
  if (values.size <= maxSize) {
    return;
  }
  for (const value of values) {
    const separator = value.indexOf("\u0000");
    const generation = separator >= 0 ? Number(value.slice(0, separator)) : Number.NaN;
    if (Number.isFinite(generation) && generation < currentGeneration - 1) {
      values.delete(value);
      if (values.size <= maxSize) {
        return;
      }
    }
  }
  trimStringSetInPlace(values, maxSize);
}
