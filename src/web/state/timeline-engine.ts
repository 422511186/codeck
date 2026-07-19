import type { TimelineEntry } from "./timeline";
import type { TimelineCompleteness } from "../../shared/timeline-content";
import {
  resolveAgentMessageAlias,
  type AuthoritativeTurnManifest,
  type AgentMessageAliasCandidate,
  type AgentMessageAliasResolution
} from "../../shared/timeline-protocol";

const CONTEXT_COMPACTION_DONE_TEXT = "压缩上下文已完成";
const MAX_PROCESSED_EVENT_IDS = 2_000;
const MAX_PROVISIONAL_AGENT_ITEMS_PER_TURN = 8;
const MAX_AGENT_MESSAGE_ALIASES = 128;

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
    }
  | {
      kind: "authoritative-turn-manifest";
      manifest: AuthoritativeTurnManifest;
    }
  | {
      kind: "mark-turn-deleted" | "mark-turn-interrupted";
      turnId: string;
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
  streamSequence?: number;
  fragmentSequence?: number;
  /** Legacy transport cursor. Treated as streamSequence, never as a fragment offset. */
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
  agentAliasReconciliations: number;
  agentAliasAmbiguities: number;
};

export type ProvisionalAgentRecord = AgentMessageAliasCandidate;

export type AgentMessageAliasRecord = {
  canonicalId: string;
  provisionalId: string;
  turnId: string;
  generation: number;
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

export type ContentCandidate = {
  text: string;
  integrity: TimelineCompleteness["status"] | "unknown";
  includedBytes: number;
  authority: number;
  revision: number;
  completeness?: TimelineCompleteness;
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
  turnManifest: AuthoritativeTurnManifest | null;
  deletedTurnIds: Set<string>;
  interruptedTurnIds: Set<string>;
  processedEventIds: Set<string>;
  itemRevisions: Map<string, number>;
  itemSequences: Map<string, number>;
  snapshotDeltaSuppressions: Map<string, SnapshotDeltaSuppression>;
  provisionalAgentLedger: Map<string, ProvisionalAgentRecord>;
  agentMessageAliases: Map<string, AgentMessageAliasRecord>;
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
    turnManifest: init?.turnManifest
      ? { ...init.turnManifest, turnIds: [...init.turnManifest.turnIds] }
      : null,
    deletedTurnIds: new Set(init?.deletedTurnIds ?? []),
    interruptedTurnIds: new Set(init?.interruptedTurnIds ?? []),
    processedEventIds: new Set(init?.processedEventIds ?? []),
    itemRevisions: new Map(init?.itemRevisions ?? []),
    itemSequences: new Map(init?.itemSequences ?? []),
    snapshotDeltaSuppressions: new Map(init?.snapshotDeltaSuppressions ?? []),
    provisionalAgentLedger: new Map(init?.provisionalAgentLedger ?? []),
    agentMessageAliases: new Map(init?.agentMessageAliases ?? []),
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
      agentAliasReconciliations: 0,
      agentAliasAmbiguities: 0,
      ...init?.diagnostics
    }
  };
}

export function applyTimelineInput(state: TimelineEngineState, input: TimelineInput): TimelineEngineState {
  switch (input.kind) {
    case "snapshot-window": {
      const generation = nextGeneration(state, input.generation, input.entries);
      const generationState = advanceAgentAliasGeneration(state, generation);
      const incomingEntries = entriesOutsideTurnBarrier(input.entries, generationState.deletedTurnIds);
      const entries = mergeSnapshotEntriesWithExistingContent(generationState.entries, incomingEntries, generation);
      const diagnostics = input.cursor
        ? incrementDiagnostic(
            recordEntryCompletenessDiagnostics(
              generationState.diagnostics,
              generationState.entries,
              incomingEntries,
              generation
            ),
            "pageContinuations"
          )
        : recordEntryCompletenessDiagnostics(
            generationState.diagnostics,
            generationState.entries,
            incomingEntries,
            generation
          );
      const nextState = withEntries(
        {
          ...generationState,
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
        snapshotDeltaSuppressions: createSnapshotDeltaSuppressions(nextState.entries, nextState.generation),
        itemSequences: snapshotItemSequences(nextState.entries, nextState.generation, nextState.itemSequences)
      };
    }
    case "pagination-page": {
      const generation = nextGeneration(state, input.generation, input.entries);
      state = advanceAgentAliasGeneration(state, generation);
      const currentIdentities = new Set(
        state.entries
          .map((entry) => identityKey(entry, generation))
          .filter((identity): identity is string => Boolean(identity))
      );
      const prependEntries = input.entries.filter((entry) => {
        if (entry.turnId && state.deletedTurnIds.has(entry.turnId)) {
          return false;
        }
        const identity = identityKey(entry, generation);
        return !identity || !currentIdentities.has(identity);
      });
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
        [...prependEntries, ...state.entries]
      );
    }
    case "snapshot-merge": {
      const generation = nextGeneration(state, input.generation, input.entries);
      state = advanceAgentAliasGeneration(state, generation);
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
      state = advanceAgentAliasGeneration(state, generation);
      const deletedTurnIds = new Set([...(state.deletedTurnIds ?? []), ...(input.deletedTurnIds ?? [])]);
      return withEntries(
        pruneAgentAliasState({
          ...state,
          generation,
          deletedTurnIds,
          processedEventIds: new Set(state.processedEventIds),
          itemRevisions: new Map(state.itemRevisions)
        }, deletedTurnIds),
        entriesOutsideTurnBarrier(input.entries, deletedTurnIds)
      );
    }
    case "live-delta":
      return applyLiveDeltaInput(state, input);
    case "remove-empty-reasoning":
      return removeEmptyReasoning(state, input.turnId, input.pendingId);
    case "finish-turn":
      return pruneAgentAliasState(finishTurnEntries(state, input.turnId, input.status), new Set([input.turnId]));
    case "bind-user-turn":
      return bindUserTurn(state, input.clientUserMessageId, input.turnId);
    case "start-reasoning":
      return applyStartReasoningInput(state, input);
    case "set-generation": {
      if (input.generation <= state.generation) return state;
      const next = advanceAgentAliasGeneration(state, input.generation);
      return {
        ...next,
        processedEventIds: snapshotProcessedEventIds(next.processedEventIds, input.generation),
        snapshotDeltaSuppressions: createSnapshotDeltaSuppressions(next.entries, input.generation)
      };
    }
    case "authoritative-turn-manifest": {
      const manifestGeneration = input.manifest.historyStamp?.generation;
      if (typeof manifestGeneration === "number" && manifestGeneration < state.generation) {
        return state;
      }
      return {
        ...state,
        turnManifest: {
          ...input.manifest,
          turnIds: input.manifest.turnIds.filter((turnId) => !state.deletedTurnIds.has(turnId))
        }
      };
    }
    case "mark-turn-deleted": {
      const deletedTurnIds = new Set(state.deletedTurnIds);
      deletedTurnIds.add(input.turnId);
      return pruneAgentAliasState({ ...state, deletedTurnIds }, new Set([input.turnId]));
    }
    case "mark-turn-interrupted": {
      const interruptedTurnIds = new Set(state.interruptedTurnIds);
      interruptedTurnIds.add(input.turnId);
      return pruneAgentAliasState({ ...state, interruptedTurnIds }, new Set([input.turnId]));
    }
    default:
      return applyEntryInput(state, input);
  }
}

function agentLedgerKey(candidate: Pick<AgentMessageAliasCandidate, "generation" | "turnId" | "id">): string {
  return `${candidate.generation}\u0000${candidate.turnId}\u0000${candidate.id}`;
}

function advanceAgentAliasGeneration(state: TimelineEngineState, generation: number): TimelineEngineState {
  return generation > state.generation
    ? {
        ...state,
        generation,
        provisionalAgentLedger: new Map(),
        agentMessageAliases: new Map()
      }
    : state;
}

function isRawResponseAgentEntry(entry: TimelineEntry): boolean {
  return entry.body.kind === "agent-message" && entry.sourceLocator?.sourceKind === "response";
}

function agentAliasCandidateForEntry(
  state: TimelineEngineState,
  entry: TimelineEntry
): AgentMessageAliasCandidate | null {
  if (entry.body.kind !== "agent-message" || !entry.turnId) {
    return null;
  }
  const generation = entryGenerationOrState(entry, state);
  const key = agentLedgerKey({ generation, turnId: entry.turnId, id: entry.id });
  return {
    id: entry.id,
    turnId: entry.turnId,
    generation,
    text: entry.body.text,
    provisional: isRawResponseAgentEntry(entry) || state.provisionalAgentLedger.has(key)
  };
}

function sameAgentAliasResolution(
  left: AgentMessageAliasResolution,
  right: AgentMessageAliasResolution
): left is Extract<AgentMessageAliasResolution, { kind: "alias" }> {
  return left.kind === "alias" &&
    right.kind === "alias" &&
    left.canonicalId === right.canonicalId &&
    left.provisionalId === right.provisionalId;
}

function reciprocalAgentAlias(
  incoming: AgentMessageAliasCandidate,
  existing: AgentMessageAliasCandidate[]
): { resolution: Extract<AgentMessageAliasResolution, { kind: "alias" }> | null; ambiguous: boolean } {
  const resolution = resolveAgentMessageAlias(incoming, existing);
  if (resolution.kind !== "alias") {
    return { resolution: null, ambiguous: resolution.reason === "ambiguous" };
  }
  const counterpartId = incoming.id === resolution.canonicalId
    ? resolution.provisionalId
    : resolution.canonicalId;
  const counterpart = existing.find((candidate) => candidate.id === counterpartId);
  if (!counterpart) {
    return { resolution: null, ambiguous: true };
  }
  const reverse = resolveAgentMessageAlias(
    counterpart,
    [incoming, ...existing.filter((candidate) => candidate.id !== counterpart.id)]
  );
  return sameAgentAliasResolution(resolution, reverse)
    ? { resolution, ambiguous: false }
    : { resolution: null, ambiguous: reverse.kind === "none" && reverse.reason === "ambiguous" };
}

function recordProvisionalAgent(
  state: TimelineEngineState,
  entry: TimelineEntry,
  append: boolean
): TimelineEngineState {
  if (entry.body.kind !== "agent-message" || !entry.turnId) {
    return state;
  }
  const generation = entryGenerationOrState(entry, state);
  const candidate: ProvisionalAgentRecord = {
    id: entry.id,
    turnId: entry.turnId,
    generation,
    text: entry.body.text,
    provisional: true
  };
  const key = agentLedgerKey(candidate);
  const provisionalAgentLedger = new Map(state.provisionalAgentLedger);
  const current = provisionalAgentLedger.get(key);
  provisionalAgentLedger.delete(key);
  provisionalAgentLedger.set(key, {
    ...candidate,
    text: append && current ? `${current.text}${entry.body.text}` : entry.body.text
  });

  const turnKeys = [...provisionalAgentLedger]
    .filter(([, record]) => record.turnId === entry.turnId && record.generation === generation)
    .map(([recordKey]) => recordKey);
  const agentMessageAliases = new Map(state.agentMessageAliases);
  while (turnKeys.length > MAX_PROVISIONAL_AGENT_ITEMS_PER_TURN) {
    const oldestKey = turnKeys.shift();
    if (!oldestKey) break;
    provisionalAgentLedger.delete(oldestKey);
    agentMessageAliases.delete(oldestKey);
  }
  return { ...state, provisionalAgentLedger, agentMessageAliases };
}

function pruneAgentAliasState(state: TimelineEngineState, turnIds: ReadonlySet<string>): TimelineEngineState {
  if (!turnIds.size) return state;
  const provisionalAgentLedger = new Map(
    [...state.provisionalAgentLedger].filter(([, record]) => !turnIds.has(record.turnId))
  );
  const agentMessageAliases = new Map(
    [...state.agentMessageAliases].filter(([, record]) => !turnIds.has(record.turnId))
  );
  return { ...state, provisionalAgentLedger, agentMessageAliases };
}

function mergeAgentAliasEntry(provisional: TimelineEntry, canonical: TimelineEntry): TimelineEntry {
  const { sourceLocator: _provisionalSourceLocator, ...provisionalFields } = provisional;
  return {
    ...provisionalFields,
    ...canonical,
    id: canonical.id,
    createdAt: Math.min(provisional.createdAt, canonical.createdAt),
    body: canonical.body.kind === "agent-message"
      ? { ...canonical.body, text: canonical.body.text }
      : canonical.body
  };
}

function moveMaxLedgerValue(map: Map<string, number>, from: string, to: string): void {
  const fromValue = map.get(from);
  if (typeof fromValue !== "number") return;
  map.set(to, Math.max(map.get(to) ?? Number.NEGATIVE_INFINITY, fromValue));
  map.delete(from);
}

function migrateSnapshotSuppressionItemId(
  suppressions: Map<string, SnapshotDeltaSuppression>,
  provisionalId: string,
  canonicalId: string
): void {
  const suffix = `\u0000${provisionalId}`;
  for (const [key, value] of [...suppressions]) {
    if (!key.endsWith(suffix)) continue;
    suppressions.delete(key);
    suppressions.set(`${key.slice(0, -provisionalId.length)}${canonicalId}`, value);
  }
}

function migrateAgentAliasMetadata(
  state: TimelineEngineState,
  provisional: TimelineEntry,
  canonical: TimelineEntry,
  resolution: Extract<AgentMessageAliasResolution, { kind: "alias" }>
): TimelineEngineState {
  const generation = entryGenerationOrState(canonical, state);
  const provisionalIdentity = identityKey(provisional, state.generation);
  const canonicalIdentity = identityKey(canonical, state.generation);
  const itemRevisions = new Map(state.itemRevisions);
  const itemSequences = new Map(state.itemSequences);
  if (provisionalIdentity && canonicalIdentity) {
    moveMaxLedgerValue(
      itemRevisions,
      revisionLedgerKey(generation, provisionalIdentity),
      revisionLedgerKey(generation, canonicalIdentity)
    );
    moveMaxLedgerValue(
      itemSequences,
      revisionLedgerKey(generation, provisionalIdentity),
      revisionLedgerKey(generation, canonicalIdentity)
    );
  }
  moveMaxLedgerValue(
    itemRevisions,
    timelineItemRevisionKey(provisional.id, provisional.generation ?? null),
    timelineItemRevisionKey(canonical.id, canonical.generation ?? null)
  );
  const snapshotDeltaSuppressions = new Map(state.snapshotDeltaSuppressions);
  migrateSnapshotSuppressionItemId(snapshotDeltaSuppressions, provisional.id, canonical.id);
  const agentMessageAliases = new Map(state.agentMessageAliases);
  const aliasKey = agentLedgerKey({ generation, turnId: resolution.provisionalId === provisional.id
    ? provisional.turnId!
    : canonical.turnId!, id: resolution.provisionalId });
  agentMessageAliases.delete(aliasKey);
  agentMessageAliases.set(aliasKey, {
    canonicalId: resolution.canonicalId,
    provisionalId: resolution.provisionalId,
    turnId: canonical.turnId ?? provisional.turnId!,
    generation
  });
  while (agentMessageAliases.size > MAX_AGENT_MESSAGE_ALIASES) {
    const oldest = agentMessageAliases.keys().next().value;
    if (typeof oldest !== "string") break;
    agentMessageAliases.delete(oldest);
  }
  return {
    ...state,
    itemRevisions,
    itemSequences,
    snapshotDeltaSuppressions,
    agentMessageAliases
  };
}

function reconcileAgentAliasEntry(
  state: TimelineEngineState,
  incomingEntry: TimelineEntry
): { state: TimelineEngineState; handled: boolean } {
  let workingState = isRawResponseAgentEntry(incomingEntry)
    ? recordProvisionalAgent(state, incomingEntry, false)
    : state;
  const incoming = agentAliasCandidateForEntry(workingState, incomingEntry);
  if (!incoming) {
    return { state: workingState, handled: false };
  }
  const existingEntries = workingState.entries.filter((entry) => entry.id !== incoming.id);
  const existingCandidates = existingEntries
    .map((entry) => agentAliasCandidateForEntry(workingState, entry))
    .filter((candidate): candidate is AgentMessageAliasCandidate => Boolean(candidate));
  const alias = reciprocalAgentAlias(incoming, existingCandidates);
  if (!alias.resolution) {
    if (alias.ambiguous) {
      workingState = withDiagnostic(workingState, "agentAliasAmbiguities");
    }
    return { state: workingState, handled: false };
  }

  const canonicalEntry = alias.resolution.canonicalId === incoming.id
    ? incomingEntry
    : existingEntries.find((entry) => entry.id === alias.resolution!.canonicalId);
  const provisionalEntry = alias.resolution.provisionalId === incoming.id
    ? incomingEntry
    : existingEntries.find((entry) => entry.id === alias.resolution!.provisionalId);
  if (!canonicalEntry || !provisionalEntry) {
    return { state: withDiagnostic(workingState, "agentAliasAmbiguities"), handled: false };
  }

  const provisionalIndex = workingState.entries.findIndex((entry) => entry.id === provisionalEntry.id);
  const canonicalIndex = workingState.entries.findIndex((entry) => entry.id === canonicalEntry.id);
  let entries = workingState.entries.slice();
  if (provisionalIndex >= 0) {
    entries[provisionalIndex] = mergeAgentAliasEntry(provisionalEntry, canonicalEntry);
    if (canonicalIndex >= 0 && canonicalIndex !== provisionalIndex) {
      entries = entries.filter((_entry, index) => index !== canonicalIndex);
    }
  }
  workingState = migrateAgentAliasMetadata(workingState, provisionalEntry, canonicalEntry, alias.resolution);
  workingState = withEntries(
    {
      ...workingState,
      diagnostics: incrementDiagnostic(workingState.diagnostics, "agentAliasReconciliations")
    },
    entries
  );
  return { state: workingState, handled: true };
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
  const streamSequence = input.streamSequence ?? input.sequence;
  const suppressed = shouldSuppressSnapshotDeltaReplay(
    snapshotDeltaSuppressions,
    input.entry.id,
    deltaComparableText(input.entry),
    streamSequence,
    entryGeneration,
    input.entry.turnId,
    input.entry.historyStamp?.bootId ?? input.entry.bootId
  );
  if (typeof streamSequence !== "number" && suppressed) {
    return withDiagnostic(
      acceptedDeltaMetadataState(state, input, entryGeneration, identity, snapshotDeltaSuppressions),
      "repairRequests"
    );
  }
  if (typeof input.fragmentSequence === "number") {
    const currentSequence = state.itemSequences.get(sequenceKey);
    if (typeof currentSequence === "number") {
      if (input.fragmentSequence <= currentSequence) {
        if (suppressed) {
          return acceptedDeltaMetadataState(state, input, entryGeneration, identity, snapshotDeltaSuppressions);
        }
        return withDiagnostic(state, "droppedStaleSequences");
      }
      if (input.fragmentSequence > currentSequence + 1) {
        return withDiagnostic(withDiagnostic(state, "sequenceGaps"), "repairRequests");
      }
    }
  }

  let stateWithProvisional = input.entry.body.kind === "agent-message"
    ? recordProvisionalAgent(state, input.entry, true)
    : state;
  if (input.entry.body.kind === "agent-message" && input.entry.turnId) {
    const provisionalKey = agentLedgerKey({
      generation: entryGeneration,
      turnId: input.entry.turnId,
      id: input.entry.id
    });
    const alias = stateWithProvisional.agentMessageAliases.get(provisionalKey);
    const provisional = stateWithProvisional.provisionalAgentLedger.get(provisionalKey);
    const canonicalIndex = alias
      ? stateWithProvisional.entries.findIndex(
          (entry) =>
            entry.id === alias.canonicalId &&
            entry.turnId === alias.turnId &&
            entryGenerationOrState(entry, stateWithProvisional) === alias.generation
        )
      : -1;
    const canonical = canonicalIndex >= 0 ? stateWithProvisional.entries[canonicalIndex] : undefined;
    if (
      alias &&
      provisional &&
      canonical?.body.kind === "agent-message" &&
      canonical.body.text.trim() &&
      canonical.body.text.startsWith(provisional.text)
    ) {
      const routedEntry = { ...input.entry, id: alias.canonicalId };
      const routedIdentity = identityKey(routedEntry, stateWithProvisional.generation);
      return routedIdentity
        ? acceptedDeltaMetadataState(
            stateWithProvisional,
            { ...input, entry: routedEntry },
            entryGeneration,
            routedIdentity,
            snapshotDeltaSuppressions
          )
        : withDiagnostic(stateWithProvisional, "missingIdentityInputs");
    }
    if (alias) {
      const agentMessageAliases = new Map(stateWithProvisional.agentMessageAliases);
      agentMessageAliases.delete(provisionalKey);
      stateWithProvisional = { ...stateWithProvisional, agentMessageAliases };
    }
  }

  const acceptedState = acceptedDeltaMetadataState(
    stateWithProvisional,
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
  if (typeof input.fragmentSequence === "number") {
    itemSequences.set(sequenceKey, Math.max(itemSequences.get(sequenceKey) ?? 0, input.fragmentSequence));
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
  if (state.turnManifest?.turnIds.length) {
    return state.turnManifest.turnIds.map((turnId, order) => ({
      turnId,
      firstEntryId: state.entries.find((entry) => entry.turnId === turnId)?.id ?? `turn:${turnId}`,
      order
    }));
  }
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
  return state.entries.some(isContextCompactionEntry);
}

export function selectRollbackMetadataForEntry(
  state: TimelineEngineState,
  target: TimelineEntry
): {
  targetTurnId: string;
  historyStamp: NonNullable<AuthoritativeTurnManifest["historyStamp"]>;
  expectedTailTurnIds: string[];
} | null {
  const manifest = state.turnManifest;
  if (!target.turnId || !manifest?.historyStamp) {
    return null;
  }

  const turnIds = manifest.turnIds;
  const targetIndex = turnIds.indexOf(target.turnId);
  if (targetIndex < 0) {
    return null;
  }

  const expectedTailTurnIds = turnIds.slice(targetIndex);
  return expectedTailTurnIds.length
    ? {
        targetTurnId: target.turnId,
        historyStamp: manifest.historyStamp,
        expectedTailTurnIds
      }
    : null;
}

function entriesOutsideTurnBarrier(entries: TimelineEntry[], deletedTurnIds: Set<string>): TimelineEntry[] {
  return entries.filter((entry) => !entry.turnId || !deletedTurnIds.has(entry.turnId));
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

export function createSnapshotDeltaSuppressions(
  entries: TimelineEntry[],
  fallbackGeneration = 0
): Map<string, SnapshotDeltaSuppression> {
  const suppressions = new Map<string, SnapshotDeltaSuppression>();
  for (const entry of entries) {
    const text = snapshotDeltaComparableText(entry);
    if (text) {
      suppressions.set(snapshotSuppressionKey(
        entry.id,
        entry.turnId,
        entry.historyStamp?.bootId ?? entry.bootId,
        entry.generation ?? fallbackGeneration
      ), {
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
  generation: number | null,
  turnId?: string,
  bootId?: string
): boolean {
  const key = snapshotSuppressionKey(itemId, turnId, bootId, generation);
  const suppression = suppressions.get(key);
  if (!suppression) {
    return false;
  }

  if (
    typeof suppression.generation === "number" &&
    generation !== null &&
    generation !== suppression.generation
  ) {
    suppressions.delete(key);
    return false;
  }

  const eventSequence = typeof sequence === "number" ? sequence : null;
  if (
    typeof suppression.maxSequence === "number" &&
    eventSequence !== null &&
    eventSequence > suppression.maxSequence
  ) {
    suppressions.delete(key);
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
    suppressions.delete(key);
    return false;
  }

  const nextOffset = coveredIndex + delta.length;
  if (nextOffset >= suppression.text.length) {
    suppressions.delete(key);
  } else {
    suppressions.set(key, { ...suppression, offset: nextOffset });
  }
  return true;
}

function snapshotSuppressionKey(
  itemId: string,
  turnId: string | undefined,
  bootId: string | undefined,
  generation: number | null
): string {
  return `${bootId ?? "legacy"}\u0000${generation ?? "legacy"}\u0000${turnId ?? "none"}\u0000${itemId}`;
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

  let nextState = {
    ...state,
    generation: Math.max(state.generation, entryGeneration),
    processedEventIds,
    itemRevisions,
    diagnostics: recordEntryCompletenessDiagnostic(state.diagnostics, state.entries[state.indexes.byIdentity.get(identity) ?? -1], input.entry)
  };
  const reconciliation = reconcileAgentAliasEntry(nextState, input.entry);
  nextState = reconciliation.state;
  if (reconciliation.handled) {
    return nextState;
  }
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
    let nextState = {
      ...workingState,
      generation: Math.max(workingState.generation, entryGeneration),
      processedEventIds,
      itemRevisions
    };
    const reconciliation = reconcileAgentAliasEntry(nextState, input.entry);
    nextState = reconciliation.state;
    if (reconciliation.handled) {
      workingState = nextState;
      continue;
    }
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

  for (const entry of entries) {
    const identity = identityKey(entry, generation);
    const identityIndex = identity ? identityIndexes.get(identity) : undefined;
    if (typeof identityIndex === "number") {
      merged[identityIndex] = mergeEntry(merged[identityIndex]!, entry);
      continue;
    }

    const nextIndex = merged.length;
    merged.push(entry);
    if (identity) {
      identityIndexes.set(identity, nextIndex);
    }
  }
  return orderEntries(merged);
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

  return insertEntryBySourceOrder(entries, entry);
}

function mergeEntry(current: TimelineEntry, next: TimelineEntry, authoritative = false): TimelineEntry {
  const currentCandidate = contentCandidateForEntry(current, 1);
  const nextCandidate = contentCandidateForEntry(next, authoritative ? 2 : 1);
  const selection = selectContentCandidate(currentCandidate, nextCandidate);
  const statusOnlyEmpty = selection.reason === "empty-status-only";
  const conflictingCompleteContent = selection.reason === "conflict";
  const keepCurrentContent = selection.preferred === currentCandidate;
  const completeness = statusOnlyEmpty
    ? current.completeness
    : conflictingCompleteContent
      ? { ...current.completeness, status: "repair-required" as const, reason: "source-gap" as const }
      : mergeTimelineCompleteness(current.completeness, next.completeness);
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
      clientUserMessageId: base.clientUserMessageId ?? other.clientUserMessageId,
      generation: base.generation ?? other.generation,
      snapshotSequence: base.snapshotSequence ?? other.snapshotSequence,
      ...(completeness ? { completeness } : {}),
      body: {
        ...baseBody,
        text: keepCurrentContent ? current.body.text : next.body.text || current.body.text,
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
    if (isContextCompactionEntry(current) || isContextCompactionEntry(next)) {
      const completed = current.body.status === "success" ? current : next.body.status === "success" ? next : null;
      const preferred = completed ?? next;
      return mergeTextEntry(
        current,
        preferred,
        completed ? CONTEXT_COMPACTION_DONE_TEXT : next.body.text,
        completeness
      );
    }
    return mergeTextEntry(
      current,
      next,
      keepCurrentContent ? current.body.text : longerText(current.body.text, next.body.text),
      completeness
    );
  }

  if (current.body.kind === "error" && next.body.kind === "error") {
    return mergeTextEntry(
      current,
      next,
      keepCurrentContent ? current.body.text : longerText(current.body.text, next.body.text),
      completeness
    );
  }

  if (current.body.kind === "diff" && next.body.kind === "diff") {
    return {
      ...next,
      createdAt: current.createdAt,
      turnId: next.turnId ?? current.turnId,
      turnIndex: next.turnIndex ?? current.turnIndex,
      ...(completeness ? { completeness } : {}),
      body: {
        ...next.body,
        diff: keepCurrentContent ? current.body.diff : next.body.diff || current.body.diff,
        path: next.body.path || current.body.path,
        added: next.body.added ?? current.body.added,
        removed: next.body.removed ?? current.body.removed
      }
    };
  }

  if (current.body.kind === "command" && next.body.kind === "command") {
    return {
      ...next,
      createdAt: current.createdAt,
      turnId: next.turnId ?? current.turnId,
      turnIndex: next.turnIndex ?? current.turnIndex,
      ...(completeness ? { completeness } : {}),
      body: {
        ...next.body,
        status: isFinalStatus(next.body.status) ? next.body.status : current.body.status,
        output: keepCurrentContent ? current.body.output : next.body.output || current.body.output
      }
    };
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
        status: isFinalStatus(next.body.status) ? next.body.status : baseBody.status,
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

function contentCandidateForEntry(entry: TimelineEntry, authority: number): ContentCandidate {
  const text = entryContentText(entry);
  return {
    text,
    integrity: entry.completeness?.status ?? "unknown",
    includedBytes: entry.completeness?.includedBytes ?? new TextEncoder().encode(text).byteLength,
    authority,
    revision: entry.revision ?? 0,
    ...(entry.completeness ? { completeness: entry.completeness } : {})
  };
}

function selectContentCandidate(
  current: ContentCandidate,
  next: ContentCandidate
): { preferred: ContentCandidate; reason: "ranked" | "empty-status-only" | "conflict" } {
  if (current.text.trim() && !next.text.trim()) {
    return { preferred: current, reason: "empty-status-only" };
  }
  if (
    current.integrity === "complete" &&
    next.integrity === "complete" &&
    current.text.trim() &&
    next.text.trim() &&
    !prefixCompatible(current.text, next.text)
  ) {
    return { preferred: current, reason: "conflict" };
  }
  const completenessOrder = completenessPreference(current.completeness, next.completeness);
  if (completenessOrder !== 0) {
    return { preferred: completenessOrder > 0 ? current : next, reason: "ranked" };
  }
  if (current.authority !== next.authority) {
    return { preferred: current.authority > next.authority ? current : next, reason: "ranked" };
  }
  if (current.revision !== next.revision) {
    return { preferred: current.revision > next.revision ? current : next, reason: "ranked" };
  }
  if (current.includedBytes !== next.includedBytes) {
    return { preferred: current.includedBytes > next.includedBytes ? current : next, reason: "ranked" };
  }
  return {
    preferred: next.text.length > current.text.length && prefixCompatible(current.text, next.text) ? next : current,
    reason: "ranked"
  };
}

function entryContentText(entry: TimelineEntry): string {
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

function prefixCompatible(left: string, right: string): boolean {
  return left.startsWith(right) || right.startsWith(left);
}

function isAuthoritativeEntryInput(input: TimelineEntryInput): boolean {
  return input.kind === "completed-item" || input.kind === "turn-item-detail" || input.kind === "rollout-supplement-item";
}

function insertEntryBySourceOrder(entries: TimelineEntry[], entry: TimelineEntry): TimelineEntry[] {
  const beforeEntryId = entry.sourceOrder?.beforeEntryId;
  if (beforeEntryId) {
    const beforeIndex = uniqueScopedAnchorIndex(
      entries,
      entry,
      beforeEntryId,
      entry.sourceOrder?.beforeTurnId
    );
    if (beforeIndex >= 0) {
      return [...entries.slice(0, beforeIndex), entry, ...entries.slice(beforeIndex)];
    }
  }
  const afterEntryId = entry.sourceOrder?.afterEntryId;
  if (afterEntryId) {
    const afterIndex = uniqueScopedAnchorIndex(
      entries,
      entry,
      afterEntryId,
      entry.sourceOrder?.afterTurnId
    );
    if (afterIndex >= 0) {
      return [...entries.slice(0, afterIndex + 1), entry, ...entries.slice(afterIndex + 1)];
    }
  }
  const unresolvedAnchor = beforeEntryId || afterEntryId;
  return [
    ...entries,
    unresolvedAnchor
      ? { ...entry, completeness: { status: "repair-required", reason: "source-gap" } }
      : entry
  ];
}

function uniqueScopedAnchorIndex(
  entries: TimelineEntry[],
  entry: TimelineEntry,
  anchorId: string,
  anchorTurnId?: string
): number {
  const entryBootId = entry.historyStamp?.bootId ?? entry.bootId;
  const entryGeneration = entry.historyStamp?.generation ?? entry.generation;
  const indexes = entries.flatMap((candidate, index) => {
    if (candidate.id !== anchorId) return [];
    if (anchorTurnId && candidate.turnId !== anchorTurnId) return [];
    const candidateBootId = candidate.historyStamp?.bootId ?? candidate.bootId;
    const candidateGeneration = candidate.historyStamp?.generation ?? candidate.generation;
    if (entryBootId && candidateBootId !== entryBootId) return [];
    if (typeof entryGeneration === "number" && candidateGeneration !== entryGeneration) return [];
    return [index];
  });
  return indexes.length === 1 ? indexes[0]! : -1;
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
      const hasContinuationOrDiagnostic = Boolean(
        entry.completeness?.contentRef ||
        entry.completeness?.status === "truncated" ||
        entry.completeness?.status === "partial" ||
        entry.completeness?.status === "repair-required"
      );
      return entry.body.text.trim() || hasContinuationOrDiagnostic
        ? [{ ...entry, body: { ...entry.body, done: true } }]
        : [];
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
  const bootId = entry.historyStamp?.bootId ?? entry.bootId ?? "legacy";
  const stamp = `${bootId}:${generation}`;
  switch (entry.body.kind) {
    case "user-message":
      if (entry.clientUserMessageId) {
        return `user:client:${entry.clientUserMessageId}`;
      }
      if (entry.turnId) {
        return `user:${stamp}:${entry.turnId}:${entry.id}`;
      }
      if (entry.id.startsWith("local-user-")) {
        return `user:local:${entry.id}`;
      }
      return `user:event:${entry.id}`;
    case "agent-message":
    case "reasoning":
    case "diff":
      return entry.turnId
        ? `${entry.body.kind}:${stamp}:${entry.turnId}:${entry.id}`
        : `${entry.body.kind}:event:${entry.id}`;
    case "tool":
      if (entry.turnId) {
        return `tool:${stamp}:${entry.turnId}:${entry.id}`;
      }
      return `tool:event:${entry.id}`;
    case "system":
      return entry.turnId ? `system:${stamp}:${entry.turnId}:${entry.id}` : `system:event:${entry.id}`;
    case "error":
    case "command":
      return entry.turnId ? `${entry.body.kind}:${stamp}:${entry.turnId}:${entry.id}` : `${entry.body.kind}:event:${entry.id}`;
    default:
      return null;
  }
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
  return (
    entry.body.kind === "system" &&
    (entry.body.systemKind === "context-compaction" || entry.body.text.trim() === CONTEXT_COMPACTION_DONE_TEXT)
  );
}

function isFinalStatus(status: string): boolean {
  return status === "success" || status === "failed";
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
