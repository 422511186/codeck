"use client";

import { create } from "zustand";
import type { ApprovalPolicy, AppServerStatus, ApprovalsReviewer, ChatMode, PendingServerRequest, TimelineItem } from "../api/types";
import {
  clearContextUsage as clearContextUsageSnapshot,
  setContextUsage as saveContextUsageSnapshot,
  type ContextUsageSnapshot
} from "../storage/contextUsage";
import { loadJson, saveJson, threadNoticeDismissalsKey } from "../storage/localStore";
import { diffEntryFromText, timelineItemToEntry, type TimelineEntry, type ToolEntry } from "./timeline";
import {
  appServerWarningNotice,
  extractLegacyWarningNotices,
  isLegacyAppServerWarningText
} from "./timeline-adapter";
import {
  applyTimelineInput,
  createTimelineEngineState,
  isContextCompactionCompletionEntry,
  isVisibleTurnOutputEntry,
  selectOrderedDistinctTurnsForNormalizedEntries,
  selectTimelineEntries,
  type OrderedDistinctTurn,
  type SnapshotDeltaSuppression,
  type TimelineEngineState,
  type TimelineInput
} from "./timeline-engine";
import type { TimelineCompleteness } from "../../shared/timeline-content";
import {
  historyStampFrom,
  timelineEmptyWindowAnchor,
  timelineGapScopeFrom,
  type AuthoritativeTurnManifest,
  type HistoryStamp,
  type TimelineRepairWindow
} from "../../shared/timeline-protocol";
import type { WsCodexEvent, WsEvent, WsConnectionState } from "../ws/client";
import type {
  ModelInputModality,
  ModelSelection,
  ThreadModelStateView
} from "../../shared/custom-models";

export type { WsConnectionState };

const CONTEXT_COMPACTION_DONE_TEXT = "压缩上下文已完成";

export type SnapshotRepairReason =
  | "manual"
  | "mutation-retry"
  | "timeline-gap"
  | "turn-completed"
  | "summary-idle"
  | "stream-disconnected"
  | "baseline-required";

export type SnapshotRepairRequest = {
  key: string;
  reason: SnapshotRepairReason;
  requestedAt: number;
  turnId?: string;
  eventId?: string;
  generation?: number;
};

export type SnapshotRepairRequestInput = {
  reason?: SnapshotRepairReason;
  turnId?: string | null;
  eventId?: string | null;
  generation?: number | null;
};

type TimelineEntryIndexes = {
  byId: Map<string, number>;
  byTurnId: Map<string, number[]>;
  visibleOutputTurnIds: Set<string>;
  compactCompletionSeen: boolean;
  orderedDistinctTurns: OrderedDistinctTurn[];
};

export type ThreadNotice = {
  id: string;
  kind: "warning";
  source: string;
  text: string;
  createdAt: number;
};

export type ThreadNoticeInput = Omit<ThreadNotice, "createdAt"> & {
  createdAt?: number;
};

type TimelineDiagnostics = {
  normalizeRuns: number;
  entryIndexBuildEntries: number;
  linearEntryScans: number;
  equivalentOutputCandidateChecks: number;
  engineInputCommits: number;
  fastPathCommits: number;
  structuralNormalizations: number;
  indexRebuildEntries: number;
  batchFlushes: number;
  barrierRevalidations: number;
  droppedDeliveryEpochEvents: number;
  agentAliasReconciliations: number;
  agentAliasAmbiguities: number;
};

const timelineDiagnostics: TimelineDiagnostics = {
  normalizeRuns: 0,
  entryIndexBuildEntries: 0,
  linearEntryScans: 0,
  equivalentOutputCandidateChecks: 0,
  engineInputCommits: 0,
  fastPathCommits: 0,
  structuralNormalizations: 0,
  indexRebuildEntries: 0,
  batchFlushes: 0,
  barrierRevalidations: 0,
  droppedDeliveryEpochEvents: 0,
  agentAliasReconciliations: 0,
  agentAliasAmbiguities: 0
};

export type ThreadState = {
  timelineEngine: TimelineEngineState;
  entries: TimelineEntry[];
  entryIndexes: TimelineEntryIndexes;
  notices: ThreadNotice[];
  pendingApprovals: PendingServerRequest[];
  resolvedApprovals: Set<string>;
  interruptedTurnIds: Set<string>;
  deletedTurnIds: Set<string>;
  processedEventIds: Set<string>;
  itemRevisions: Map<string, number>;
  snapshotDeltaSuppressions: Map<string, SnapshotDeltaSuppression>;
  deliveryEpoch: number;
  timelineGeneration: number;
  turnManifest: AuthoritativeTurnManifest | null;
  localUserMessageIdsByTurn: Map<string, string>;
  repairRequest: SnapshotRepairRequest | null;
  repairRequestedAt: number | null;
  status: string;
  running: boolean;
  cursor: string | null;
  reachedBeginning: boolean;
  plan: Array<{ text: string; completed: boolean }>;
  mode: ChatMode;
  model: string | null;
  modelEffort: string | null;
  modelSelection: ModelSelection | null;
  modelBindingVersion: string | null;
  modelSourceUpdatedAt: string | null;
  modelContextWindow: number | null;
  modelInputModalities: ModelInputModality[];
  modelSwitchStatus: "idle" | "pending" | "recovery_failed";
  modelSwitchOperationId: string | null;
  modelSwitchTarget: ModelSelection | null;
  permissionProfileId?: string | null;
  approvalPolicy?: ApprovalPolicy | null;
  approvalsReviewer?: ApprovalsReviewer | null;
  activeTurnId: string | null;
  lastSeenItemId: string | null;
  contextUsage: ContextUsageSnapshot | null;
};

type State = {
  wsState: WsConnectionState | "idle";
  reconnectAttempt: number;
  appServer: AppServerStatus | null;
  threads: Record<string, ThreadState>;
  activeThreadId: string | null;
  skillsCacheVersion: number;
};

type Actions = {
  setWsState: (s: WsConnectionState) => void;
  setReconnectAttempt: (attempt: number) => void;
  setAppServer: (s: AppServerStatus) => void;
  setActiveThread: (threadId: string | null) => void;
  ensureThread: (threadId: string, init?: Partial<ThreadState>) => void;
  setThreadEntries: (
    threadId: string,
    entries: TimelineEntry[],
    cursor: string | null,
    detailEntries?: TimelineEntry[]
  ) => void;
  mergeThreadEntries: (threadId: string, entries: TimelineEntry[], cursor: string | null) => void;
  replaceLatestWindow: (
    threadId: string,
    entries: TimelineEntry[],
    cursor: string | null,
    window: TimelineRepairWindow
  ) => boolean;
  prependEntries: (
    threadId: string,
    entries: TimelineEntry[],
    cursor: string | null,
    reachedBeginning: boolean
  ) => void;
  appendEntries: (threadId: string, entries: TimelineEntry[]) => void;
  upsertThreadNotice: (threadId: string, notice: ThreadNoticeInput) => void;
  dismissThreadNotice: (threadId: string, noticeId: string) => void;
  replaceOrAddEntry: (threadId: string, entry: TimelineEntry, revision?: number, eventId?: string) => void;
  removeEntry: (threadId: string, entryId: string) => void;
  appendTextToEntry: (threadId: string, entry: TimelineEntry) => void;
  startReasoningEntry: (
    threadId: string,
    turnId: string | null,
    itemId: string,
    eventId?: string,
    generation?: number
  ) => void;
  appendReasoningDelta: (threadId: string, turnId: string | null, itemId: string, delta: string) => void;
  removeEmptyPendingReasoningEntry: (threadId: string, turnId: string | null) => void;
  finishLiveTurnEntries: (threadId: string, turnId: string, status: string) => void;
  setRunning: (threadId: string, running: boolean) => void;
  setThreadStatus: (threadId: string, status: string, activeTurnId?: string | null) => void;
  setActiveTurnId: (threadId: string, turnId: string | null) => void;
  bindLocalUserMessageTurn: (threadId: string, clientUserMessageId: string, turnId: string) => void;
  setTimelineGeneration: (threadId: string, generation: number) => void;
  setAuthoritativeTurnManifest: (threadId: string, manifest: AuthoritativeTurnManifest) => void;
  registerAuthoritativeTurn: (threadId: string, turnId: string) => void;
  invalidateTimelineDelivery: (threadId: string, deliveryEpoch?: number) => void;
  markTurnInterrupted: (threadId: string, turnId: string) => void;
  markTurnDeleted: (threadId: string, turnId: string) => void;
  requestSnapshotRepair: (threadId: string, input?: SnapshotRepairRequestInput) => void;
  clearSnapshotRepair: (threadId: string) => void;
  setMode: (threadId: string, mode: ChatMode) => void;
  setModel: (threadId: string, model: string | null, effort?: string | null) => void;
  setModelState: (threadId: string, modelState: ThreadModelStateView) => void;
  beginModelSwitch: (threadId: string, target: ModelSelection) => void;
  applyModelSwitchResult: (
    threadId: string,
    result: {
      outcome: "switched" | "recovered" | "recovery_failed";
      operationId: string;
      latestState: ThreadModelStateView;
    }
  ) => void;
  clearModelSwitchPending: (threadId: string) => void;
  setPermissionProfile: (
    threadId: string,
    profileId: string | null | undefined,
    approvalPolicy?: ApprovalPolicy | null,
    approvalsReviewer?: ApprovalsReviewer | null
  ) => void;
  setContextUsage: (threadId: string, usage: ContextUsageSnapshot) => void;
  setPlan: (threadId: string, plan: Array<{ text: string; completed: boolean }>) => void;
  addApproval: (threadId: string, req: PendingServerRequest) => void;
  setPendingRequests: (reqs: PendingServerRequest[]) => void;
  resolvePendingRequest: (requestId: string) => void;
  dispatchEvent: (event: WsEvent) => void;
  reset: (threadId: string) => void;
  __getTimelineDiagnostics?: () => TimelineDiagnostics;
  __resetTimelineDiagnostics?: () => void;
};

export const emptyThread = (init?: Partial<ThreadState>): ThreadState => {
  const timelineEngine =
    init?.timelineEngine ??
    createTimelineEngineState({
      entries: init?.entries ?? [],
      generation: init?.timelineGeneration ?? 0,
      turnManifest: init?.turnManifest,
      deletedTurnIds: init?.deletedTurnIds,
      interruptedTurnIds: init?.interruptedTurnIds,
      processedEventIds: init?.processedEventIds,
      itemRevisions: init?.itemRevisions,
      snapshotDeltaSuppressions: init?.snapshotDeltaSuppressions,
      deliveryEpoch: init?.deliveryEpoch
    });
  const entries = timelineEngine.entries;
  const entryIndexes = init?.entryIndexes ?? buildTimelineEntryIndexes(entries);
  return {
    notices: [],
    pendingApprovals: [],
    resolvedApprovals: new Set<string>(),
    localUserMessageIdsByTurn: new Map<string, string>(),
    repairRequest: null,
    repairRequestedAt: null,
    status: "idle",
    running: false,
    cursor: null,
    reachedBeginning: false,
    plan: [],
    mode: "build",
    model: null,
    modelEffort: null,
    modelSelection: null,
    modelBindingVersion: null,
    modelSourceUpdatedAt: null,
    modelContextWindow: null,
    modelInputModalities: ["text"],
    modelSwitchStatus: "idle",
    modelSwitchOperationId: null,
    modelSwitchTarget: null,
    permissionProfileId: undefined,
    approvalPolicy: undefined,
    approvalsReviewer: undefined,
    activeTurnId: null,
    lastSeenItemId: null,
    contextUsage: null,
    ...init,
    timelineEngine,
    entries,
    entryIndexes,
    deletedTurnIds: timelineEngine.deletedTurnIds,
    interruptedTurnIds: timelineEngine.interruptedTurnIds,
    processedEventIds: timelineEngine.processedEventIds,
    itemRevisions: timelineEngine.itemRevisions,
    timelineGeneration: timelineEngine.generation,
    turnManifest: timelineEngine.turnManifest,
    snapshotDeltaSuppressions: timelineEngine.snapshotDeltaSuppressions,
    deliveryEpoch: timelineEngine.deliveryEpoch
  };
};

function snapshotRepairRequest(
  thread: ThreadState,
  input?: SnapshotRepairRequestInput
): SnapshotRepairRequest {
  const requestedAt = Date.now();
  const reason = input?.reason ?? "manual";
  const generation = finiteNumberOrNull(input?.generation) ?? thread.timelineGeneration;
  const turnId = typeof input?.turnId === "string" && input.turnId ? input.turnId : undefined;
  const eventId = typeof input?.eventId === "string" && input.eventId ? input.eventId : undefined;
  const key = snapshotRepairKey({ reason, turnId, eventId, generation, requestedAt });
  return {
    key,
    reason,
    requestedAt,
    ...(turnId ? { turnId } : {}),
    ...(eventId ? { eventId } : {}),
    ...(typeof generation === "number" ? { generation } : {})
  };
}

function threadWithModelState(
  thread: ThreadState,
  modelState: ThreadModelStateView
): ThreadState {
  return {
    ...thread,
    model: modelState.model,
    modelEffort: modelState.reasoningEffort,
    modelSelection: structuredClone(modelState.selection),
    modelBindingVersion: modelState.bindingVersion,
    modelSourceUpdatedAt: modelState.sourceUpdatedAt,
    modelContextWindow: modelState.contextWindow,
    modelInputModalities: [...modelState.inputModalities],
    modelSwitchStatus: modelState.blocked ? "recovery_failed" : "idle",
    modelSwitchOperationId: modelState.operationId,
    modelSwitchTarget: null
  };
}

function snapshotRepairKey(input: {
  reason: SnapshotRepairReason;
  turnId?: string;
  eventId?: string;
  generation?: number;
  requestedAt: number;
}): string {
  const generation = typeof input.generation === "number" ? String(input.generation) : "legacy";
  if ((input.reason === "turn-completed" || input.reason === "summary-idle") && input.turnId) {
    return `turn-completed:${input.turnId}:${generation}`;
  }
  if (input.reason === "stream-disconnected") {
    return `stream-disconnected:${input.turnId ?? "thread"}:${generation}`;
  }
  if (input.reason === "timeline-gap") {
    return `timeline-gap:${input.eventId ?? input.turnId ?? "unknown"}:${generation}`;
  }
  if (input.reason === "baseline-required") {
    return `baseline-required:${input.eventId ?? "stream"}:${generation}`;
  }
  return `${input.reason}:${input.turnId ?? "thread"}:${generation}:${input.requestedAt}`;
}

export const useStore = create<State & Actions>((set, get) => ({
  wsState: "idle",
  reconnectAttempt: 0,
  appServer: null,
  threads: {},
  activeThreadId: null,
  skillsCacheVersion: 0,
  setWsState: (s) => set({ wsState: s }),
  setReconnectAttempt: (attempt) => set({ reconnectAttempt: Math.max(0, Math.min(5, attempt)) }),
  setAppServer: (s) => set({ appServer: s }),
  setActiveThread: (id) => set({ activeThreadId: id }),
  ensureThread: (threadId, init) =>
    set((state) => {
      if (state.threads[threadId]) return state;
      return { threads: { ...state.threads, [threadId]: emptyThread(init) } };
    }),
  setThreadEntries: (threadId, entries, cursor, detailEntries = []) =>
    set((state) => {
      const prev = state.threads[threadId] ?? emptyThread();
      const snapshotIngress = migrateTimelineIngress(threadId, prev.notices, entries);
      const detailIngress = migrateTimelineIngress(threadId, snapshotIngress.notices, detailEntries);
      const snapshotEngine = reduceThreadTimelineState(prev, {
        kind: "snapshot-window",
        entries: snapshotIngress.entries,
        cursor
      });
      const reducedEngine = detailIngress.entries.length
        ? applyTimelineInput(snapshotEngine, {
            kind: "live-event-batch",
            inputs: detailIngress.entries.map((entry) => ({ kind: "turn-item-detail" as const, entry }))
          })
        : snapshotEngine;
      const nextEntries = reducedEngine.entries;
      const timelineEngine = reducedEngine;
      return {
        threads: {
          ...state.threads,
          [threadId]: indexedThreadState(
            {
              ...prev,
              timelineEngine,
              notices: detailIngress.notices,
              cursor,
              reachedBeginning: cursor === null,
              timelineGeneration: timelineEngine.generation,
              processedEventIds: timelineEngine.processedEventIds,
              itemRevisions: timelineEngine.itemRevisions,
              snapshotDeltaSuppressions: timelineEngine.snapshotDeltaSuppressions,
              localUserMessageIdsByTurn: localUserMessageIdsByTurnFromEntries(nextEntries),
              lastSeenItemId: nextEntries.length ? nextEntries[nextEntries.length - 1].id : prev.lastSeenItemId
            },
            nextEntries
          )
        }
      };
    }),
  mergeThreadEntries: (threadId, entries, cursor) =>
    set((state) => {
      const prev = state.threads[threadId] ?? emptyThread();
      const ingress = migrateTimelineIngress(threadId, prev.notices, entries);
      const timelineEngine = reduceThreadTimelineState(prev, {
        kind: "snapshot-merge",
        entries: ingress.entries,
        cursor
      });
      const nextEntries = timelineEngine.entries;
      return {
        threads: {
          ...state.threads,
          [threadId]: indexedThreadState(
            {
              ...prev,
              timelineEngine,
              notices: ingress.notices,
              cursor,
              reachedBeginning: cursor === null,
              timelineGeneration: timelineEngine.generation,
              localUserMessageIdsByTurn: localUserMessageIdsByTurnFromEntries(nextEntries, prev.localUserMessageIdsByTurn),
              lastSeenItemId: nextEntries.length ? nextEntries[nextEntries.length - 1].id : prev.lastSeenItemId
            },
            nextEntries
          )
        }
      };
    }),
  replaceLatestWindow: (threadId, entries, cursor, window) => {
    let applied = false;
    set((state) => {
      const prev = state.threads[threadId] ?? emptyThread();
      const replacement = replaceLatestTimelineWindow(prev.entries, entries, window);
      if (!replacement) return state;
      const ingress = migrateTimelineIngress(threadId, prev.notices, replacement);
      const timelineEngine = applyTimelineInput(currentTimelineEngine(prev), {
        kind: "snapshot-window",
        entries: ingress.entries,
        cursor,
        generation: window.historyStamp.generation
      });
      applied = true;
      return {
        threads: {
          ...state.threads,
          [threadId]: indexedThreadState({
            ...prev,
            timelineEngine,
            notices: ingress.notices,
            cursor,
            reachedBeginning: cursor === null,
            timelineGeneration: window.historyStamp.generation,
            processedEventIds: timelineEngine.processedEventIds,
            itemRevisions: timelineEngine.itemRevisions,
            snapshotDeltaSuppressions: timelineEngine.snapshotDeltaSuppressions
          }, timelineEngine.entries)
        }
      };
    });
    return applied;
  },
  prependEntries: (threadId, entries, cursor, reachedBeginning) =>
    set((state) => {
      const prev = state.threads[threadId] ?? emptyThread();
      const ingress = migrateTimelineIngress(threadId, prev.notices, entries);
      const timelineEngine = reduceThreadTimelineState(prev, {
        kind: "pagination-page",
        entries: ingress.entries,
        cursor,
        reachedBeginning
      });
      const nextEntries = timelineEngine.entries;
      return {
        threads: {
          ...state.threads,
          [threadId]: indexedThreadState({
            ...prev,
            timelineEngine,
            notices: ingress.notices,
            cursor,
            reachedBeginning
          }, nextEntries)
        }
      };
    }),
  appendEntries: (threadId, entries) =>
    set((state) => {
      const prev = state.threads[threadId] ?? emptyThread();
      const ingress = migrateTimelineIngress(threadId, prev.notices, entries);
      const timelineEngine = reduceThreadTimelineState(prev, {
        kind: "live-event-batch",
        inputs: ingress.entries.map((entry) => ({
          kind: entry.body.kind === "user-message" && entry.body.status === "sending"
            ? "optimistic-user" as const
            : "overlay-item" as const,
          entry
        }))
      });
      const nextEntries = timelineEngine.entries;
      const last = nextEntries.length ? nextEntries[nextEntries.length - 1].id : prev.lastSeenItemId;
      return {
        threads: {
          ...state.threads,
          [threadId]: indexedThreadState({
            ...prev,
            timelineEngine,
            notices: ingress.notices,
            lastSeenItemId: last
          }, nextEntries)
        }
      };
    }),
  upsertThreadNotice: (threadId, notice) =>
    set((state) => {
      const prev = state.threads[threadId] ?? emptyThread();
      if (loadDismissedThreadNoticeIds(threadId).has(notice.id)) return state;
      const nextNotice: ThreadNotice = {
        ...notice,
        createdAt: notice.createdAt ?? Date.now()
      };
      const existingIndex = prev.notices.findIndex((item) => item.id === nextNotice.id);
      const notices = existingIndex < 0
        ? [...prev.notices, nextNotice]
        : prev.notices.map((item, index) => index === existingIndex ? nextNotice : item);
      return {
        threads: {
          ...state.threads,
          [threadId]: { ...prev, notices }
        }
      };
    }),
  dismissThreadNotice: (threadId, noticeId) => {
    const dismissed = loadDismissedThreadNoticeIds(threadId);
    dismissed.add(noticeId);
    saveJson(threadNoticeDismissalsKey(threadId), [...dismissed].slice(-100));
    set((state) => {
      const prev = state.threads[threadId];
      if (!prev || !prev.notices.some((notice) => notice.id === noticeId)) return state;
      return {
        threads: {
          ...state.threads,
          [threadId]: { ...prev, notices: prev.notices.filter((notice) => notice.id !== noticeId) }
        }
      };
    });
  },
  replaceOrAddEntry: (threadId, entry, revision, eventId) =>
    set((state) => {
      const prev = state.threads[threadId] ?? emptyThread();
      const ingress = migrateTimelineIngress(threadId, prev.notices, [entry]);
      const migratedEntry = ingress.entries[0];
      if (!migratedEntry) {
        if (ingress.notices === prev.notices) return state;
        return {
          threads: {
            ...state.threads,
            [threadId]: { ...prev, notices: ingress.notices }
          }
        };
      }
      const timelineEngine = reduceThreadTimelineState(prev, {
        kind: "completed-item",
        entry: migratedEntry,
        ...(eventId ? { eventId } : {}),
        ...(typeof revision === "number" ? { revision } : {})
      });
      const normalizedEntries = timelineEngine.entries;
      return {
        threads: {
          ...state.threads,
          [threadId]: indexedThreadState(
            {
              ...prev,
              timelineEngine,
              notices: ingress.notices,
              timelineGeneration: timelineEngine.generation,
              localUserMessageIdsByTurn: localUserMessageIdsByTurnFromEntries(
                normalizedEntries,
                prev.localUserMessageIdsByTurn
              ),
              lastSeenItemId: migratedEntry.id
            },
            normalizedEntries
          )
        }
      };
    }),
  removeEntry: (threadId, entryId) =>
    set((state) => {
      const prev = state.threads[threadId];
      if (!prev) return state;
      const timelineEngine = reduceThreadTimelineState(prev, { kind: "remove-entry", entryId });
      if (timelineEngine === prev.timelineEngine) return state;
      return {
        threads: {
          ...state.threads,
          [threadId]: indexedThreadState({ ...prev, timelineEngine }, timelineEngine.entries)
        }
      };
    }),
  appendTextToEntry: (threadId, entry) =>
    set((state) => {
      const prev = state.threads[threadId] ?? emptyThread();
      const currentEngine = currentTimelineEngine(prev);
      timelineDiagnostics.engineInputCommits += 1;
      const timelineEngine = applyTimelineInput(currentEngine, {
        kind: "live-delta",
        entry,
        deliveryEpoch: prev.deliveryEpoch
      });
      const nextThread = {
        ...prev,
        timelineEngine,
        entries: timelineEngine.entries,
        timelineGeneration: timelineEngine.generation,
        deletedTurnIds: timelineEngine.deletedTurnIds,
        processedEventIds: timelineEngine.processedEventIds,
        itemRevisions: timelineEngine.itemRevisions,
        lastSeenItemId: entry.id
      };
      return {
        threads: {
          ...state.threads,
          [threadId]:
            timelineEngine.indexes === currentEngine.indexes
              ? { ...nextThread, entryIndexes: prev.entryIndexes }
              : indexedThreadState(nextThread, timelineEngine.entries)
        }
      };
    }),
  startReasoningEntry: (threadId, turnId, itemId, eventId, generation) =>
    set((state) => {
      const prev = state.threads[threadId] ?? emptyThread();
      const pendingId = pendingReasoningId(threadId, turnId);
      const entry: TimelineEntry = {
        id: itemId,
        ...(turnId ? { turnId } : {}),
        ...(typeof generation === "number" ? { generation } : {}),
        createdAt: Date.now(),
        body: { kind: "reasoning", text: "", done: false }
      };
      const timelineEngine = reduceThreadTimelineState(prev, {
        kind: "start-reasoning",
        entry,
        pendingId,
        ...(eventId ? { eventId } : {})
      });

      return {
        threads: {
          ...state.threads,
          [threadId]: indexedThreadState({ ...prev, timelineEngine, lastSeenItemId: itemId }, timelineEngine.entries)
        }
      };
    }),
  appendReasoningDelta: (threadId, turnId, itemId, delta) =>
    set((state) => {
      const prev = state.threads[threadId] ?? emptyThread();
      const currentEngine = currentTimelineEngine(prev);
      const deltaEntry: TimelineEntry = {
        id: itemId,
        ...(turnId ? { turnId } : {}),
        createdAt: Date.now(),
        body: { kind: "reasoning", text: delta, done: false }
      };

      timelineDiagnostics.engineInputCommits += 1;
      const timelineEngine = applyTimelineInput(currentEngine, {
        kind: "live-delta",
        entry: deltaEntry,
        deliveryEpoch: prev.deliveryEpoch
      });
      const nextThread = {
        ...prev,
        timelineEngine,
        entries: timelineEngine.entries,
        timelineGeneration: timelineEngine.generation,
        deletedTurnIds: timelineEngine.deletedTurnIds,
        processedEventIds: timelineEngine.processedEventIds,
        itemRevisions: timelineEngine.itemRevisions,
        lastSeenItemId: itemId
      };

      return {
        threads: {
          ...state.threads,
          [threadId]:
            timelineEngine.indexes === currentEngine.indexes
              ? { ...nextThread, entryIndexes: prev.entryIndexes }
              : indexedThreadState(nextThread, timelineEngine.entries)
        }
      };
    }),
  removeEmptyPendingReasoningEntry: (threadId, turnId) =>
    set((state) => {
      const prev = state.threads[threadId] ?? emptyThread();
      const pendingId = pendingReasoningId(threadId, turnId);
      const timelineEngine = reduceThreadTimelineState(prev, { kind: "remove-empty-reasoning", turnId, pendingId });
      if (timelineEngine === prev.timelineEngine) {
        return state;
      }
      return {
        threads: {
          ...state.threads,
          [threadId]: indexedThreadState({ ...prev, timelineEngine }, timelineEngine.entries)
        }
      };
    }),
  finishLiveTurnEntries: (threadId, turnId, status) =>
    set((state) => {
      const prev = state.threads[threadId] ?? emptyThread();
      const timelineEngine = reduceThreadTimelineState(prev, { kind: "finish-turn", turnId, status });
      if (timelineEngine === prev.timelineEngine) {
        return state;
      }
      return {
        threads: {
          ...state.threads,
          [threadId]: indexedThreadState({ ...prev, timelineEngine }, timelineEngine.entries)
        }
      };
    }),
  setRunning: (threadId, running) =>
    set((state) => {
      const prev = state.threads[threadId] ?? emptyThread();
      return {
        threads: {
          ...state.threads,
          [threadId]: {
            ...prev,
            status: running ? "active" : "idle",
            running,
            activeTurnId: running ? prev.activeTurnId : null
          }
        }
      };
    }),
  setThreadStatus: (threadId, status, activeTurnId) =>
    set((state) => {
      const prev = state.threads[threadId] ?? emptyThread();
      const running = isRunningThreadStatus(status);
      return {
        threads: {
          ...state.threads,
          [threadId]: {
            ...prev,
            status,
            running,
            activeTurnId: running ? (activeTurnId !== undefined ? activeTurnId : prev.activeTurnId) : null
          }
        }
      };
    }),
  setActiveTurnId: (threadId, turnId) =>
    set((state) => {
      const prev = state.threads[threadId] ?? emptyThread();
      return { threads: { ...state.threads, [threadId]: { ...prev, activeTurnId: turnId } } };
    }),
  bindLocalUserMessageTurn: (threadId, clientUserMessageId, turnId) =>
    set((state) => {
      const prev = state.threads[threadId] ?? emptyThread();
      const localUserMessageIdsByTurn = new Map(prev.localUserMessageIdsByTurn);
      localUserMessageIdsByTurn.set(turnId, clientUserMessageId);
      const timelineEngine = reduceThreadTimelineState(prev, { kind: "bind-user-turn", clientUserMessageId, turnId });
      return {
        threads: {
          ...state.threads,
          [threadId]: indexedThreadState({ ...prev, timelineEngine, localUserMessageIdsByTurn }, timelineEngine.entries)
        }
      };
    }),
  setTimelineGeneration: (threadId, generation) =>
    set((state) => {
      const prev = state.threads[threadId] ?? emptyThread();
      if (generation <= prev.timelineGeneration) {
        return state;
      }
      const timelineEngine = reduceThreadTimelineState(prev, { kind: "set-generation", generation });
      return {
        threads: {
          ...state.threads,
          [threadId]: indexedThreadState({ ...prev, timelineEngine }, timelineEngine.entries)
        }
      };
    }),
  setAuthoritativeTurnManifest: (threadId, manifest) =>
    set((state) => {
      const prev = state.threads[threadId] ?? emptyThread();
      const timelineEngine = reduceThreadTimelineState(prev, {
        kind: "authoritative-turn-manifest",
        manifest
      });
      return {
        threads: {
          ...state.threads,
          [threadId]: indexedThreadState({ ...prev, timelineEngine }, timelineEngine.entries)
        }
      };
    }),
  registerAuthoritativeTurn: (threadId, turnId) =>
    set((state) => {
      const prev = state.threads[threadId] ?? emptyThread();
      const current = currentTimelineEngine(prev).turnManifest;
      if (!current || current.turnIds.includes(turnId)) {
        return state;
      }
      const timelineEngine = reduceThreadTimelineState(prev, {
        kind: "authoritative-turn-manifest",
        manifest: { ...current, turnIds: [...current.turnIds, turnId] }
      });
      return {
        threads: {
          ...state.threads,
          [threadId]: indexedThreadState({ ...prev, timelineEngine }, timelineEngine.entries)
        }
      };
    }),
  invalidateTimelineDelivery: (threadId, deliveryEpoch) =>
    set((state) => {
      const prev = state.threads[threadId] ?? emptyThread();
      const nextEpoch = Math.max(prev.deliveryEpoch + 1, deliveryEpoch ?? 0);
      return {
        threads: {
          ...state.threads,
          [threadId]: {
            ...prev,
            timelineEngine: { ...currentTimelineEngine(prev), deliveryEpoch: nextEpoch },
            deliveryEpoch: nextEpoch
          }
        }
      };
    }),
  markTurnInterrupted: (threadId, turnId) =>
    set((state) => {
      const prev = state.threads[threadId] ?? emptyThread();
      const timelineEngine = reduceThreadTimelineState(prev, { kind: "mark-turn-interrupted", turnId });
      return {
        threads: {
          ...state.threads,
          [threadId]: indexedThreadState({ ...prev, timelineEngine }, timelineEngine.entries)
        }
      };
    }),
  markTurnDeleted: (threadId, turnId) =>
    set((state) => {
      const prev = state.threads[threadId] ?? emptyThread();
      const timelineEngine = reduceThreadTimelineState(prev, { kind: "mark-turn-deleted", turnId });
      return {
        threads: {
          ...state.threads,
          [threadId]: indexedThreadState({ ...prev, timelineEngine }, timelineEngine.entries)
        }
      };
    }),
  requestSnapshotRepair: (threadId, input) =>
    set((state) => {
      const prev = state.threads[threadId] ?? emptyThread();
      const request = snapshotRepairRequest(prev, input);
      if (prev.repairRequest?.key === request.key) {
        return state;
      }
      return {
        threads: {
          ...state.threads,
          [threadId]: { ...prev, repairRequest: request, repairRequestedAt: request.requestedAt }
        }
      };
    }),
  clearSnapshotRepair: (threadId) =>
    set((state) => {
      const prev = state.threads[threadId] ?? emptyThread();
      if (!prev.repairRequestedAt && !prev.repairRequest) {
        return state;
      }
      return {
        threads: {
          ...state.threads,
          [threadId]: { ...prev, repairRequest: null, repairRequestedAt: null }
        }
      };
    }),
  setMode: (threadId, mode) =>
    set((state) => {
      const prev = state.threads[threadId] ?? emptyThread();
      return { threads: { ...state.threads, [threadId]: { ...prev, mode } } };
    }),
  setModel: (threadId, model, effort) =>
    set((state) => {
      const prev = state.threads[threadId] ?? emptyThread();
      return {
        threads: {
          ...state.threads,
          [threadId]: { ...prev, model, modelEffort: effort === undefined ? prev.modelEffort : effort }
        }
      };
    }),
  setModelState: (threadId, modelState) =>
    set((state) => {
      const prev = state.threads[threadId] ?? emptyThread();
      return {
        threads: {
          ...state.threads,
          [threadId]: threadWithModelState(prev, modelState)
        }
      };
    }),
  beginModelSwitch: (threadId, target) =>
    set((state) => {
      const prev = state.threads[threadId] ?? emptyThread();
      return {
        threads: {
          ...state.threads,
          [threadId]: {
            ...prev,
            modelSwitchStatus: "pending",
            modelSwitchOperationId: null,
            modelSwitchTarget: structuredClone(target)
          }
        }
      };
    }),
  applyModelSwitchResult: (threadId, result) => {
    clearContextUsageSnapshot(threadId);
    set((state) => {
      const prev = state.threads[threadId] ?? emptyThread();
      if (result.outcome === "recovery_failed") {
        return {
          threads: {
            ...state.threads,
            [threadId]: {
              ...prev,
              contextUsage: null,
              modelSwitchStatus: "recovery_failed",
              modelSwitchOperationId: result.operationId,
              modelSwitchTarget: null
            }
          }
        };
      }
      return {
        threads: {
          ...state.threads,
          [threadId]: {
            ...threadWithModelState(prev, result.latestState),
            contextUsage: null,
            modelSwitchStatus: "idle",
            modelSwitchOperationId: null,
            modelSwitchTarget: null
          }
        }
      };
    });
  },
  clearModelSwitchPending: (threadId) =>
    set((state) => {
      const prev = state.threads[threadId] ?? emptyThread();
      return {
        threads: {
          ...state.threads,
          [threadId]: {
            ...prev,
            modelSwitchStatus: "idle",
            modelSwitchOperationId: null,
            modelSwitchTarget: null
          }
        }
      };
    }),
  setPermissionProfile: (threadId, profileId, approvalPolicy, approvalsReviewer) =>
    set((state) => {
      const prev = state.threads[threadId] ?? emptyThread();
      return {
        threads: {
          ...state.threads,
          [threadId]: {
            ...prev,
            permissionProfileId: profileId,
            approvalPolicy: approvalPolicy === undefined ? prev.approvalPolicy : approvalPolicy,
            approvalsReviewer: approvalsReviewer === undefined ? prev.approvalsReviewer : approvalsReviewer
          }
        }
      };
    }),
  setContextUsage: (threadId, usage) => {
    saveContextUsageSnapshot(threadId, usage);
    set((state) => {
      const prev = state.threads[threadId] ?? emptyThread();
      return { threads: { ...state.threads, [threadId]: { ...prev, contextUsage: usage } } };
    });
  },
  setPlan: (threadId, plan) =>
    set((state) => {
      const prev = state.threads[threadId] ?? emptyThread();
      return { threads: { ...state.threads, [threadId]: { ...prev, plan } } };
    }),
  addApproval: (threadId, req) =>
    set((state) => {
      const normalizedReq = normalizePendingRequest(req);
      const prev = state.threads[threadId] ?? emptyThread();
      if (prev.pendingApprovals.some((r) => r.requestId === normalizedReq.requestId)) return state;
      return {
        threads: {
          ...state.threads,
          [threadId]: { ...prev, pendingApprovals: [...prev.pendingApprovals, normalizedReq] }
        }
      };
    }),
  setPendingRequests: (reqs) =>
    set((state) => {
      const byThread = new Map<string, PendingServerRequest[]>();
      for (const raw of reqs) {
        const r = normalizePendingRequest(raw);
        const tid = r.threadId ?? "_global";
        const list = byThread.get(tid) ?? [];
        list.push(r);
        byThread.set(tid, list);
      }
      const nextThreads = { ...state.threads };
      for (const [tid, list] of byThread) {
        const prev = nextThreads[tid] ?? emptyThread();
        nextThreads[tid] = { ...prev, pendingApprovals: list };
      }
      return { threads: nextThreads };
    }),
  resolvePendingRequest: (requestId) =>
    set((state) => {
      const nextThreads = { ...state.threads };
      for (const [tid, prev] of Object.entries(state.threads)) {
        if (!prev.pendingApprovals.some((r) => r.requestId === requestId)) continue;
        const resolved = new Set(prev.resolvedApprovals);
        resolved.add(requestId);
        nextThreads[tid] = {
          ...prev,
          resolvedApprovals: resolved,
          pendingApprovals: prev.pendingApprovals.filter((r) => r.requestId !== requestId)
        };
      }
      return { threads: nextThreads };
    }),
  dispatchEvent: (event) => {
    if (event.type === "timeline-baseline-required") {
      const threadIds = event.scope === "all-tracked"
        ? Object.keys(get().threads)
        : event.affectedThreadIds ?? [];
      for (const threadId of threadIds) {
        get().ensureThread(threadId);
        get().invalidateTimelineDelivery(threadId);
        get().requestSnapshotRepair(threadId, {
          reason: "baseline-required",
          eventId: `${event.bootId}:${event.streamCursor}`
        });
      }
      return;
    }
    if (event.type === "timeline-gap") {
      const gapScope = timelineGapScopeFrom(event);
      const threadIds = gapScope?.scope === "all-tracked"
        ? Object.keys(get().threads)
        : gapScope?.scope === "threads"
          ? gapScope.affectedThreadIds
          : [];
      for (const threadId of threadIds) {
        get().ensureThread(threadId);
        get().invalidateTimelineDelivery(threadId);
        get().requestSnapshotRepair(threadId, {
          reason: "timeline-gap",
          eventId: typeof event.lastEventId === "string" ? event.lastEventId : undefined
        });
      }
      return;
    }
    if (event.type === "codex-event-batch") {
      const batchEvents = event.events;
      if (batchEvents.every(isBatchableTimelineDeltaEvent)) {
        set((state) => applyCodexDeltaInputs(state, batchEvents as BatchableTimelineDeltaEvent[], event.deliveryEpoch));
        return;
      }
      for (const raw of event.events) {
        get().dispatchEvent({ type: "codex-event", event: raw });
      }
      return;
    }
    if (event.type === "codex-event") {
      const ev = event.event as { kind: string; threadId?: string; [k: string]: unknown };
      if (ev.kind === "skills_changed") {
        set((state) => ({ skillsCacheVersion: state.skillsCacheVersion + 1 }));
        return;
      }
      const threadId = ev.threadId;
      if (!threadId) return;
      if (isBatchableTimelineDeltaEvent(event.event)) {
        set((state) =>
          applyCodexDeltaInputs(state, [event.event as BatchableTimelineDeltaEvent], event.deliveryEpoch)
        );
        return;
      }
      get().ensureThread(threadId);
      const generation = typeof ev.generation === "number" ? ev.generation : null;
      const visibleTimelineEvent = isVisibleTimelineEvent(ev.kind);
      if (
        !visibleTimelineEvent &&
        generation !== null &&
        generation > (get().threads[threadId]?.timelineGeneration ?? 0)
      ) {
        get().setTimelineGeneration(threadId, generation);
      }
      const eventId = typeof ev.eventId === "string" ? ev.eventId : null;
      switch (ev.kind) {
        case "timeline_generation_changed":
          get().invalidateTimelineDelivery(threadId);
          get().requestSnapshotRepair(threadId, {
            reason: "mutation-retry",
            eventId,
            generation
          });
          break;
        case "turn.started":
        case "turn_started":
          if (typeof ev.turnId === "string") {
            get().registerAuthoritativeTurn(threadId, ev.turnId);
          }
          get().setThreadStatus(threadId, "active", typeof ev.turnId === "string" ? ev.turnId : null);
          get().startReasoningEntry(
            threadId,
            typeof ev.turnId === "string" ? ev.turnId : null,
            pendingReasoningId(threadId, typeof ev.turnId === "string" ? ev.turnId : null),
            eventId ?? undefined,
            generation ?? undefined
          );
          break;
        case "thread_status_changed": {
          if (typeof ev.status !== "string") {
            break;
          }
          const eventActiveTurnId = typeof ev.activeTurnId === "string" ? ev.activeTurnId : undefined;
          const activeTurnId = eventActiveTurnId ?? get().threads[threadId]?.activeTurnId ?? null;
          if (ev.status === "idle" && activeTurnId) {
            get().finishLiveTurnEntries(threadId, activeTurnId, "completed");
            get().removeEmptyPendingReasoningEntry(threadId, activeTurnId);
          }
          get().setThreadStatus(
            threadId,
            ev.status,
            eventActiveTurnId
          );
          break;
        }
        case "turn.completed":
        case "turn.failed":
        case "turn.canceled":
        case "turn_completed":
        case "turn_failed":
        case "turn_interrupted": {
          const eventTurnId = typeof ev.turnId === "string" ? ev.turnId : null;
          const threadBeforeCompletion = get().threads[threadId];
          const currentActiveTurnId = threadBeforeCompletion?.activeTurnId ?? null;
          const isCompleted =
            ev.kind === "turn.completed" || ev.kind === "turn_completed" || ev.status === "completed";
          const completedActiveTurn = Boolean(
            eventTurnId &&
            isCompleted &&
            (!currentActiveTurnId || currentActiveTurnId === eventTurnId)
          );
          const hasVisibleOutput = threadHasVisibleOutput(threadBeforeCompletion, eventTurnId);
          if (!eventTurnId || !currentActiveTurnId || eventTurnId === currentActiveTurnId) {
            if (eventTurnId) {
              get().finishLiveTurnEntries(threadId, eventTurnId, typeof ev.status === "string" ? ev.status : ev.kind);
            }
            get().setRunning(threadId, false);
          }
          get().removeEmptyPendingReasoningEntry(threadId, eventTurnId);
          if (completedActiveTurn && !hasVisibleOutput) {
            get().requestSnapshotRepair(threadId, {
              reason: "turn-completed",
              turnId: eventTurnId,
              generation
            });
          }
          break;
        }
        case "plan.delta": {
          const plan = (ev.plan as Array<{ text: string; completed: boolean }>) ?? [];
          get().setPlan(threadId, plan);
          break;
        }
        case "reasoning_started": {
          const identity = liveItemIdentity(ev, threadId, generation, "reasoning");
          if (!identity) {
            get().requestSnapshotRepair(threadId, { reason: "timeline-gap", eventId });
            break;
          }
          get().startReasoningEntry(
            threadId,
            typeof ev.turnId === "string" ? ev.turnId : null,
            identity.id,
            eventId ?? undefined,
            generation ?? undefined
          );
          break;
        }
        case "turn_diff_updated": {
          const diff = typeof ev.diff === "string" ? ev.diff : "";
          const entry = diffEntryFromText(`${ev.turnId ?? threadId}-diff`, diff, Date.now());
          get().replaceOrAddEntry(threadId, {
            ...entry,
            ...(typeof ev.turnId === "string" ? { turnId: ev.turnId } : {}),
            ...(generation !== null ? { generation } : {})
          }, undefined, eventId ?? undefined);
          break;
        }
        case "context_compacted": {
          const turnId = typeof ev.turnId === "string" ? ev.turnId : threadId;
          get().replaceOrAddEntry(threadId, {
            id: `${turnId}-context-compacted`,
            ...(typeof ev.turnId === "string" ? { turnId: ev.turnId } : {}),
            ...(generation !== null ? { generation } : {}),
            createdAt: Date.now(),
            body: { kind: "system", text: CONTEXT_COMPACTION_DONE_TEXT }
          }, undefined, eventId ?? undefined);
          break;
        }
        case "token_usage_updated": {
          get().setContextUsage(threadId, {
            totalTokens: finiteNumberOrZero(ev.totalTokens),
            inputTokens: finiteNumberOrZero(ev.inputTokens),
            outputTokens: finiteNumberOrZero(ev.outputTokens),
            reasoningOutputTokens: finiteNumberOrZero(ev.reasoningOutputTokens),
            modelContextWindow: finiteNumberOrNull(ev.modelContextWindow),
            updatedAt: Date.now()
          });
          break;
        }
        case "warning": {
          const message = typeof ev.message === "string" ? ev.message : "收到配置提示";
          get().upsertThreadNotice(threadId, appServerWarningNotice(message));
          break;
        }
        case "turn_error": {
          const turnId = typeof ev.turnId === "string" ? ev.turnId : threadId;
          const message = typeof ev.message === "string" ? ev.message : "运行失败";
          if (isLegacyAppServerWarningText(message)) {
            get().upsertThreadNotice(threadId, appServerWarningNotice(message));
            break;
          }
          if (ev.willRetry === true) {
            break;
          }
          get().replaceOrAddEntry(threadId, {
            id: `${turnId}-error`,
            ...(typeof ev.turnId === "string" ? { turnId: ev.turnId } : {}),
            ...(generation !== null ? { generation } : {}),
            createdAt: Date.now(),
            body: { kind: "error", text: message }
          }, undefined, eventId ?? undefined);
          if (ev.willRetry !== true) {
            get().finishLiveTurnEntries(threadId, turnId, "failed");
            get().setRunning(threadId, false);
          }
          break;
        }
        case "thread_settings_updated": {
          const mode = ev.collaborationMode === "plan" ? "plan" : ev.collaborationMode === "default" ? "build" : null;
          if (mode) {
            get().setMode(threadId, mode);
          }
          if (typeof ev.model === "string") {
            get().setModel(
              threadId,
              ev.model,
              typeof ev.reasoningEffort === "string" ? ev.reasoningEffort : null
            );
          }
          if ("activePermissionProfile" in ev) {
            const activeProfile = ev.activePermissionProfile as { id?: unknown } | null;
            const profileId = activeProfile && typeof activeProfile.id === "string" ? activeProfile.id : null;
            const approvalPolicy = "approvalPolicy" in ev ? approvalPolicyOrUndefined(ev.approvalPolicy) : undefined;
            const reviewer = "approvalsReviewer" in ev ? approvalsReviewerOrUndefined(ev.approvalsReviewer) : undefined;
            const current = get().threads[threadId];
            const complete = approvalPolicy !== undefined && reviewer !== undefined;
            const currentComplete =
              current?.permissionProfileId !== undefined &&
              current.approvalPolicy !== undefined &&
              current.approvalsReviewer !== undefined;
            if (complete || !currentComplete) {
              get().setPermissionProfile(threadId, profileId, approvalPolicy, reviewer);
            }
          }
          break;
        }
        case "item.appended":
        case "item.updated":
        case "item_updated": {
          const entry = (ev.entry as TimelineEntry | undefined) ?? null;
          if (entry) {
            get().replaceOrAddEntry(
              threadId,
              withCodexEventMetadata({
                ...entry,
                ...(typeof ev.turnId === "string" && !entry.turnId ? { turnId: ev.turnId } : {}),
                ...(generation !== null && typeof entry.generation !== "number" ? { generation } : {})
              }, ev),
              typeof ev.revision === "number" ? ev.revision : undefined,
              eventId ?? undefined
            );
            break;
          }
          const item = (ev.item as TimelineItem | undefined) ?? null;
          if (item) {
            const createdAt = typeof ev.completedAtMs === "number" ? ev.completedAtMs : Date.now();
            const revision = typeof ev.revision === "number" ? ev.revision : null;
            get().replaceOrAddEntry(
              threadId,
              timelineItemToEntry(
                withCodexEventMetadata({
                  ...item,
                  ...(typeof ev.turnId === "string" && !item.turnId ? { turnId: ev.turnId } : {}),
                  ...(generation !== null && typeof item.generation !== "number" ? { generation } : {})
                }, ev),
                createdAt
              ),
              revision ?? undefined,
              eventId ?? undefined
            );
          }
          break;
        }
        case "timeline_content_reference": {
          const entry = timelineContentReferenceEntry(ev, threadId, generation);
          if (!entry) {
            get().requestSnapshotRepair(threadId, { reason: "timeline-gap", eventId });
            break;
          }
          get().replaceOrAddEntry(
            threadId,
            entry,
            typeof ev.revision === "number" ? ev.revision : undefined,
            eventId ?? undefined
          );
          break;
        }
        default:
          break;
      }
      return;
    }
    if (event.type === "server-request") {
      const req = normalizePendingRequest(event.request as PendingServerRequest);
      const tid = req.threadId ?? "_global";
      get().ensureThread(tid);
      get().addApproval(tid, req);
      return;
    }
    if (event.type === "server-request-resolved") {
      get().resolvePendingRequest(String(event.requestId));
      return;
    }
  },
  reset: (threadId) =>
    set((state) => {
      const next = { ...state.threads };
      delete next[threadId];
      return { threads: next };
    }),
  __getTimelineDiagnostics: () => {
    let fastPathCommits = 0;
    let structuralNormalizations = 0;
    let indexRebuildEntries = 0;
    let agentAliasReconciliations = 0;
    let agentAliasAmbiguities = 0;
    for (const thread of Object.values(get().threads)) {
      fastPathCommits += thread.timelineEngine.diagnostics.fastPathCommits;
      structuralNormalizations += thread.timelineEngine.diagnostics.structuralNormalizations;
      indexRebuildEntries += thread.timelineEngine.diagnostics.indexRebuildEntries;
      agentAliasReconciliations += thread.timelineEngine.diagnostics.agentAliasReconciliations;
      agentAliasAmbiguities += thread.timelineEngine.diagnostics.agentAliasAmbiguities;
    }
    return {
      ...timelineDiagnostics,
      fastPathCommits,
      structuralNormalizations,
      indexRebuildEntries,
      agentAliasReconciliations,
      agentAliasAmbiguities
    };
  },
  __resetTimelineDiagnostics: () => {
    timelineDiagnostics.normalizeRuns = 0;
    timelineDiagnostics.entryIndexBuildEntries = 0;
    timelineDiagnostics.linearEntryScans = 0;
    timelineDiagnostics.equivalentOutputCandidateChecks = 0;
    timelineDiagnostics.engineInputCommits = 0;
    timelineDiagnostics.batchFlushes = 0;
    timelineDiagnostics.barrierRevalidations = 0;
    timelineDiagnostics.droppedDeliveryEpochEvents = 0;
    timelineDiagnostics.agentAliasReconciliations = 0;
    timelineDiagnostics.agentAliasAmbiguities = 0;
  }
}));

function reduceTimelineInput(
  init: {
    entries?: TimelineEntry[];
    generation?: number;
    deletedTurnIds?: Set<string>;
    processedEventIds?: Set<string>;
    itemRevisions?: Map<string, number>;
  },
  input: TimelineInput
): TimelineEntry[] {
  timelineDiagnostics.engineInputCommits += 1;
  return selectTimelineEntries(applyTimelineInput(createTimelineEngineState(init), input));
}

function reduceThreadTimelineState(prev: ThreadState, input: TimelineInput): TimelineEngineState {
  timelineDiagnostics.engineInputCommits += 1;
  return applyTimelineInput(currentTimelineEngine(prev), input);
}

function currentTimelineEngine(prev: ThreadState): TimelineEngineState {
  if (
    prev.timelineEngine.entries === prev.entries &&
    prev.timelineEngine.generation === prev.timelineGeneration &&
    prev.timelineEngine.turnManifest === prev.turnManifest &&
    prev.timelineEngine.deletedTurnIds === prev.deletedTurnIds &&
    prev.timelineEngine.interruptedTurnIds === prev.interruptedTurnIds &&
    prev.timelineEngine.processedEventIds === prev.processedEventIds &&
    prev.timelineEngine.itemRevisions === prev.itemRevisions &&
    prev.timelineEngine.snapshotDeltaSuppressions === prev.snapshotDeltaSuppressions &&
    prev.timelineEngine.deliveryEpoch === prev.deliveryEpoch
  ) {
    return prev.timelineEngine;
  }
  return createTimelineEngineState({
    entries: prev.entries,
    generation: prev.timelineGeneration,
    turnManifest: prev.turnManifest,
    deletedTurnIds: prev.deletedTurnIds,
    interruptedTurnIds: prev.interruptedTurnIds,
    processedEventIds: prev.processedEventIds,
    itemRevisions: prev.itemRevisions,
    snapshotDeltaSuppressions: prev.snapshotDeltaSuppressions,
    provisionalAgentLedger: prev.timelineEngine.provisionalAgentLedger,
    agentMessageAliases: prev.timelineEngine.agentMessageAliases,
    deliveryEpoch: prev.deliveryEpoch,
    diagnostics: prev.timelineEngine.diagnostics
  });
}

function buildTimelineEntryIndexes(entries: TimelineEntry[]): TimelineEntryIndexes {
  timelineDiagnostics.entryIndexBuildEntries += entries.length;
  const byId = new Map<string, number>();
  const byTurnId = new Map<string, number[]>();
  const visibleOutputTurnIds = new Set<string>();
  let compactCompletionSeen = false;
  entries.forEach((entry, index) => {
    byId.set(entry.id, index);
    if (entry.turnId) {
      const turnIndexes = byTurnId.get(entry.turnId) ?? [];
      turnIndexes.push(index);
      byTurnId.set(entry.turnId, turnIndexes);
      if (isVisibleTurnOutputEntry(entry)) {
        visibleOutputTurnIds.add(entry.turnId);
      }
    }
    if (isContextCompactionCompletionEntry(entry)) {
      compactCompletionSeen = true;
    }
  });
  return {
    byId,
    byTurnId,
    visibleOutputTurnIds,
    compactCompletionSeen,
    orderedDistinctTurns: selectOrderedDistinctTurnsForNormalizedEntries(entries)
  };
}

function indexedThreadState(prev: ThreadState, entries: TimelineEntry[]): ThreadState {
  const timelineEngine =
    prev.timelineEngine.entries === entries
      ? prev.timelineEngine
      : createTimelineEngineState({
          entries,
          generation: prev.timelineGeneration,
          turnManifest: prev.turnManifest,
          deletedTurnIds: prev.deletedTurnIds,
          interruptedTurnIds: prev.interruptedTurnIds,
          processedEventIds: prev.processedEventIds,
          itemRevisions: prev.itemRevisions,
          snapshotDeltaSuppressions: prev.snapshotDeltaSuppressions,
          provisionalAgentLedger: prev.timelineEngine.provisionalAgentLedger,
          agentMessageAliases: prev.timelineEngine.agentMessageAliases,
          deliveryEpoch: prev.deliveryEpoch,
          diagnostics: prev.timelineEngine.diagnostics
        });
  return {
    ...prev,
    timelineEngine,
    entries: timelineEngine.entries,
    entryIndexes: buildTimelineEntryIndexes(timelineEngine.entries),
    timelineGeneration: timelineEngine.generation,
    turnManifest: timelineEngine.turnManifest,
    deletedTurnIds: timelineEngine.deletedTurnIds,
    interruptedTurnIds: timelineEngine.interruptedTurnIds,
    processedEventIds: timelineEngine.processedEventIds,
    itemRevisions: timelineEngine.itemRevisions,
    snapshotDeltaSuppressions: timelineEngine.snapshotDeltaSuppressions,
    deliveryEpoch: timelineEngine.deliveryEpoch
  };
}

function mergeThreadNotices(existing: ThreadNotice[], incoming: ThreadNoticeInput[]): ThreadNotice[] {
  if (!incoming.length) return existing;
  const merged = new Map(existing.map((notice) => [notice.id, notice]));
  for (const notice of incoming) {
    merged.set(notice.id, {
      ...notice,
      createdAt: notice.createdAt ?? Date.now()
    });
  }
  return [...merged.values()];
}

function migrateTimelineIngress(
  threadId: string,
  existingNotices: ThreadNotice[],
  entries: TimelineEntry[]
): { entries: TimelineEntry[]; notices: ThreadNotice[] } {
  const extracted = extractLegacyWarningNotices(entries);
  if (!extracted.notices.length) {
    return { entries: extracted.entries, notices: existingNotices };
  }
  const dismissed = loadDismissedThreadNoticeIds(threadId);
  return {
    entries: extracted.entries,
    notices: mergeThreadNotices(
      existingNotices,
      extracted.notices.filter((notice) => !dismissed.has(notice.id))
    )
  };
}

function loadDismissedThreadNoticeIds(threadId: string): Set<string> {
  const stored = loadJson<unknown>(threadNoticeDismissalsKey(threadId), []);
  if (!Array.isArray(stored)) return new Set();
  return new Set(stored.filter((value): value is string => typeof value === "string"));
}

function threadHasVisibleOutput(thread: ThreadState | undefined, turnId: string | null): boolean {
  if (!thread || !turnId) {
    return false;
  }
  return thread.entryIndexes.visibleOutputTurnIds.has(turnId);
}

function findEntryIndexById(state: ThreadState, id: string): number {
  const indexed = state.entryIndexes.byId.get(id);
  if (typeof indexed === "number" && state.entries[indexed]?.id === id) {
    return indexed;
  }
  timelineDiagnostics.linearEntryScans += state.entries.length;
  return state.entries.findIndex((entry) => entry.id === id);
}

function localUserMessageIdsByTurnFromEntries(
  entries: TimelineEntry[],
  previous = new Map<string, string>()
): Map<string, string> {
  const next = new Map(previous);
  for (const entry of entries) {
    if (entry.turnId && entry.body.kind === "user-message" && entry.id.startsWith("local-user-")) {
      next.set(entry.turnId, entry.id);
    }
  }
  for (const [turnId, id] of next) {
    const stillPresent = entries.some((entry) => entry.id === id && entry.turnId === turnId);
    const confirmed = entries.some(
      (entry) => entry.turnId === turnId && entry.body.kind === "user-message" && !entry.id.startsWith("local-user-")
    );
    if (!stillPresent || confirmed) {
      next.delete(turnId);
    }
  }
  return next;
}

function pendingReasoningId(threadId: string, turnId: string | null): string {
  return `${turnId ?? threadId}-reasoning-pending`;
}

function isVisibleTimelineEvent(kind: string): boolean {
  return new Set([
    "agent_message_delta",
    "reasoning_delta",
    "reasoning_started",
    "plan_delta",
    "command_output_delta",
    "file_output_delta",
    "tool_output_delta",
    "turn_diff_updated",
    "context_compacted",
    "turn_error",
    "item.appended",
    "item.updated",
    "item_updated",
    "timeline_content_reference"
  ]).has(kind);
}

type BatchableTimelineDeltaEvent = WsCodexEvent["event"] & {
  kind:
    | "agent_message_delta"
    | "reasoning_delta"
    | "plan_delta"
    | "command_output_delta"
    | "file_output_delta"
    | "tool_output_delta";
};

function isBatchableTimelineDeltaEvent(event: WsCodexEvent["event"]): event is BatchableTimelineDeltaEvent {
  return (
    event.kind === "agent_message_delta" ||
    event.kind === "reasoning_delta" ||
    event.kind === "plan_delta" ||
    event.kind === "command_output_delta" ||
    event.kind === "file_output_delta" ||
    event.kind === "tool_output_delta"
  );
}

function applyCodexDeltaInputs(
  state: State & Actions,
  events: BatchableTimelineDeltaEvent[],
  deliveryEpoch?: number
): State & Actions {
  const eventsByThread = new Map<string, BatchableTimelineDeltaEvent[]>();
  for (const event of events) {
    if (!event.threadId) {
      continue;
    }
    const threadEvents = eventsByThread.get(event.threadId) ?? [];
    threadEvents.push(event);
    eventsByThread.set(event.threadId, threadEvents);
  }

  if (!eventsByThread.size) {
    return state;
  }

  timelineDiagnostics.batchFlushes += eventsByThread.size;

  const threads = { ...state.threads };
  let changed = false;
  for (const [threadId, threadEvents] of eventsByThread) {
    const prev = threads[threadId] ?? emptyThread();
    if (typeof deliveryEpoch === "number") {
      timelineDiagnostics.barrierRevalidations += 1;
      if (deliveryEpoch !== prev.deliveryEpoch) {
        timelineDiagnostics.droppedDeliveryEpochEvents += threadEvents.length;
        continue;
      }
    }
    const currentEngine = currentTimelineEngine(prev);
    const inputs = threadEvents.flatMap((event, index) => {
      const entry = timelineDeltaEntry(event, threadId, prev.timelineGeneration, index);
      if (!entry) {
        return [];
      }
      return [
        {
          kind: "live-delta" as const,
          entry,
          ...(typeof event.eventId === "string" ? { eventId: event.eventId } : {}),
          ...(typeof event.revision === "number" ? { revision: event.revision } : {}),
          ...(typeof event.streamSequence === "number"
            ? { streamSequence: event.streamSequence }
            : typeof event.sequence === "number"
              ? { sequence: event.sequence }
              : {}),
          ...(typeof event.fragmentSequence === "number" ? { fragmentSequence: event.fragmentSequence } : {}),
          deliveryEpoch: deliveryEpoch ?? prev.deliveryEpoch
        }
      ];
    });
    timelineDiagnostics.engineInputCommits += 1;
    const timelineEngine = applyTimelineInput(currentEngine, { kind: "live-event-batch", inputs });
    const requestedRepair = timelineEngine.diagnostics.repairRequests > currentEngine.diagnostics.repairRequests;
    if (
      timelineEngine.entries === prev.entries &&
      !requestedRepair &&
      timelineEngine.generation === prev.timelineGeneration &&
      timelineEngine.deliveryEpoch === prev.deliveryEpoch
    ) {
      replaceSetContents(prev.processedEventIds, timelineEngine.processedEventIds);
      replaceMapContents(prev.itemRevisions, timelineEngine.itemRevisions);
      replaceMapContents(prev.snapshotDeltaSuppressions, timelineEngine.snapshotDeltaSuppressions);
      Object.assign(prev.timelineEngine, {
        processedEventIds: prev.processedEventIds,
        itemRevisions: prev.itemRevisions,
        itemSequences: timelineEngine.itemSequences,
        snapshotDeltaSuppressions: prev.snapshotDeltaSuppressions,
        diagnostics: timelineEngine.diagnostics
      });
      continue;
    }
    const request = requestedRepair
      ? snapshotRepairRequest(prev, {
          reason: "timeline-gap",
          eventId: lastTimelineEventId(threadEvents),
          generation: timelineEngine.generation
        })
      : prev.repairRequest;
    const nextThread = {
      ...prev,
      timelineEngine,
      entries: timelineEngine.entries,
      timelineGeneration: timelineEngine.generation,
      deletedTurnIds: timelineEngine.deletedTurnIds,
      processedEventIds: timelineEngine.processedEventIds,
      itemRevisions: timelineEngine.itemRevisions,
      snapshotDeltaSuppressions: timelineEngine.snapshotDeltaSuppressions,
      deliveryEpoch: timelineEngine.deliveryEpoch,
      repairRequest: request,
      repairRequestedAt: requestedRepair ? request?.requestedAt ?? prev.repairRequestedAt : prev.repairRequestedAt,
      lastSeenItemId: inputs.at(-1)?.entry.id ?? prev.lastSeenItemId
    };
    threads[threadId] =
      timelineEngine.indexes === currentEngine.indexes
        ? { ...nextThread, entryIndexes: prev.entryIndexes }
        : indexedThreadState(nextThread, timelineEngine.entries);
    changed = true;
  }

  return changed ? { ...state, threads } : state;
}

function replaceSetContents<T>(target: Set<T>, source: Set<T>): void {
  target.clear();
  for (const value of source) {
    target.add(value);
  }
}

function replaceMapContents<K, V>(target: Map<K, V>, source: Map<K, V>): void {
  target.clear();
  for (const [key, value] of source) {
    target.set(key, value);
  }
}

function replaceLatestTimelineWindow(
  current: TimelineEntry[],
  authoritative: TimelineEntry[],
  window: TimelineRepairWindow
): TimelineEntry[] | null {
  if (!authoritative.length) {
    const emptyAnchor = timelineEmptyWindowAnchor(window.historyStamp);
    if (
      window.windowStartAnchor !== emptyAnchor ||
      window.windowEndAnchor !== emptyAnchor ||
      window.preservedThrough
    ) {
      return null;
    }
    return current.filter((entry) =>
      (entryHasHistoryStamp(entry, window.historyStamp) &&
        typeof entry.streamSequence === "number" &&
        entry.streamSequence > window.pageWatermark) ||
      (entry.body.kind === "user-message" && Boolean(entry.clientUserMessageId) && entry.body.status !== "sent")
    );
  }
  const firstAnchor = timelineEntryWindowAnchor(window.historyStamp, authoritative[0]!);
  const lastAnchor = timelineEntryWindowAnchor(window.historyStamp, authoritative.at(-1)!);
  if (firstAnchor !== window.windowStartAnchor || lastAnchor !== window.windowEndAnchor) return null;
  if (authoritative.some((entry) => !entryHasHistoryStamp(entry, window.historyStamp))) return null;

  const currentStamp = lastEntryHistoryStamp(current);
  let prefix: TimelineEntry[] = [];
  if (current.length && currentStamp && sameTimelineHistoryStamp(currentStamp, window.historyStamp)) {
    const startIndexes = matchingAnchorIndexes(current, window.windowStartAnchor);
    if (startIndexes.length !== 1) return null;
    prefix = current.slice(0, startIndexes[0]);
  } else if (current.length && window.preservedThrough) {
    const preservedIndexes = matchingAnchorIndexes(current, window.preservedThrough);
    if (preservedIndexes.length !== 1) return null;
    prefix = current.slice(0, preservedIndexes[0]! + 1).map((entry) => ({
      ...entry,
      bootId: window.historyStamp.bootId,
      generation: window.historyStamp.generation,
      historyStamp: window.historyStamp
    }));
  }

  const postWatermark = current.filter((entry) =>
    (entryHasHistoryStamp(entry, window.historyStamp) &&
      typeof entry.streamSequence === "number" &&
      entry.streamSequence > window.pageWatermark) ||
    (entry.body.kind === "user-message" && Boolean(entry.clientUserMessageId) && entry.body.status !== "sent")
  );
  return dedupeTimelineWindowEntries([...prefix, ...authoritative, ...postWatermark]);
}

function timelineEntryWindowAnchor(stamp: HistoryStamp, entry: TimelineEntry): string {
  return JSON.stringify([stamp.bootId, stamp.generation, entry.turnId ?? null, entry.id]);
}

function matchingAnchorIndexes(entries: TimelineEntry[], anchor: string): number[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(anchor);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed) || parsed.length !== 4) return [];
  const [bootId, generation, turnId, itemId] = parsed;
  return entries.flatMap((entry, index) =>
    entry.id === itemId &&
    (entry.turnId ?? null) === turnId &&
    (entry.historyStamp?.bootId ?? entry.bootId) === bootId &&
    (entry.historyStamp?.generation ?? entry.generation) === generation
      ? [index]
      : []
  );
}

function entryHasHistoryStamp(entry: TimelineEntry, stamp: HistoryStamp): boolean {
  return (
    (entry.historyStamp?.bootId ?? entry.bootId) === stamp.bootId &&
    (entry.historyStamp?.generation ?? entry.generation) === stamp.generation
  );
}

function lastEntryHistoryStamp(entries: TimelineEntry[]): HistoryStamp | null {
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index]!;
    if (entry.historyStamp) return entry.historyStamp;
    if (entry.bootId && typeof entry.generation === "number") {
      return { bootId: entry.bootId, generation: entry.generation };
    }
  }
  return null;
}

function sameTimelineHistoryStamp(left: HistoryStamp, right: HistoryStamp): boolean {
  return left.bootId === right.bootId && left.generation === right.generation;
}

function dedupeTimelineWindowEntries(entries: TimelineEntry[]): TimelineEntry[] {
  const result: TimelineEntry[] = [];
  const indexes = new Map<string, number>();
  for (const entry of entries) {
    const key = entry.clientUserMessageId
      ? `client:${entry.clientUserMessageId}`
      : `${entry.historyStamp?.bootId ?? entry.bootId ?? "legacy"}\u0000${entry.historyStamp?.generation ?? entry.generation ?? "legacy"}\u0000${entry.turnId ?? "none"}\u0000${entry.id}`;
    const existingIndex = indexes.get(key);
    if (typeof existingIndex === "number") {
      result[existingIndex] = entry;
    } else {
      indexes.set(key, result.length);
      result.push(entry);
    }
  }
  return result;
}

function withCodexEventMetadata<T extends {
  bootId?: string;
  generation?: number;
  historyStamp?: HistoryStamp;
  streamSequence?: number;
  fragmentSequence?: number;
}>(value: T, event: Record<string, unknown>): T {
  const eventBootId = typeof event.bootId === "string" && event.bootId ? event.bootId : undefined;
  const eventGeneration = typeof event.generation === "number" ? event.generation : undefined;
  const bootId = value.bootId || eventBootId;
  const generation = typeof value.generation === "number" ? value.generation : eventGeneration;
  const eventHistoryStamp = historyStampFrom(event.historyStamp);
  const compatibleEventHistoryStamp = eventHistoryStamp &&
    (!value.bootId || value.bootId === eventHistoryStamp.bootId) &&
    (typeof value.generation !== "number" || value.generation === eventHistoryStamp.generation)
    ? eventHistoryStamp
    : undefined;
  const historyStamp = value.historyStamp ?? compatibleEventHistoryStamp ?? (
    bootId && typeof generation === "number" ? { bootId, generation } : undefined
  );
  const streamSequence =
    typeof value.streamSequence === "number"
      ? value.streamSequence
      : typeof event.streamSequence === "number"
        ? event.streamSequence
        : undefined;
  const fragmentSequence =
    typeof value.fragmentSequence === "number"
      ? value.fragmentSequence
      : typeof event.fragmentSequence === "number"
        ? event.fragmentSequence
        : undefined;

  return {
    ...value,
    ...(value.bootId || !bootId ? {} : { bootId }),
    ...(typeof value.generation === "number" || typeof generation !== "number" ? {} : { generation }),
    ...(value.historyStamp || !historyStamp ? {} : { historyStamp }),
    ...(typeof value.streamSequence === "number" || typeof streamSequence !== "number" ? {} : { streamSequence }),
    ...(typeof value.fragmentSequence === "number" || typeof fragmentSequence !== "number" ? {} : { fragmentSequence })
  } as T;
}

function lastTimelineEventId(events: BatchableTimelineDeltaEvent[]): string | null {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const eventId = events[index]?.eventId;
    if (typeof eventId === "string") {
      return eventId;
    }
  }
  return null;
}

let unresolvedLiveItemSequence = 0;

function liveItemIdentity(
  event: { [key: string]: unknown },
  threadId: string,
  generation: number | null,
  kind: string
): { id: string; sourceLocator?: TimelineEntry["sourceLocator"]; repairRequired?: true } | null {
  if (typeof event.itemId === "string" && event.itemId) {
    return { id: event.itemId };
  }
  const turnId = typeof event.turnId === "string" && event.turnId ? event.turnId : null;
  if (!turnId) {
    return null;
  }
  if (
    typeof event.bootId === "string" &&
    event.bootId &&
    typeof event.eventId === "string" &&
    event.eventId
  ) {
    const sourceLocator = {
      sourceKind: "event" as const,
      bootId: event.bootId,
      eventId: event.eventId,
      field: kind
    };
    return {
      id: `synthetic:${encodeURIComponent(event.bootId)}:${encodeURIComponent(event.eventId)}:${kind}`,
      sourceLocator
    };
  }
  unresolvedLiveItemSequence += 1;
  return {
    id: `unresolved:${threadId}:${generation ?? "legacy"}:${turnId}:${kind}:${unresolvedLiveItemSequence}`,
    repairRequired: true
  };
}

function timelineDeltaEntry(
  event: BatchableTimelineDeltaEvent,
  threadId: string,
  fallbackGeneration: number,
  sourceOrder: number
): TimelineEntry | null {
  const generation = typeof event.generation === "number" ? event.generation : fallbackGeneration;
  const identity = liveItemIdentity(event, threadId, generation, event.kind);
  const turnId = typeof event.turnId === "string" && event.turnId ? event.turnId : null;
  const delta = typeof event.delta === "string" ? event.delta : "";
  if (!identity || !turnId || !delta) {
    return null;
  }
  const base = {
    id: identity.id,
    turnId,
    generation,
    ...(typeof event.bootId === "string" ? { bootId: event.bootId } : {}),
    ...(typeof event.bootId === "string" ? { historyStamp: { bootId: event.bootId, generation } } : {}),
    ...(typeof event.streamSequence === "number" ? { streamSequence: event.streamSequence } : {}),
    ...(typeof event.fragmentSequence === "number" ? { fragmentSequence: event.fragmentSequence } : {}),
    ...(typeof event.revision === "number" ? { revision: event.revision } : {}),
    ...(identity.sourceLocator ? { sourceLocator: identity.sourceLocator } : {}),
    ...(identity.repairRequired
      ? { completeness: { status: "repair-required" as const, reason: "source-gap" as const } }
      : event.capReached === true
        ? { completeness: { status: "truncated" as const, reason: "event-budget" as const } }
      : {}),
    sourceOrder: {
      sourceKind: "live" as const,
      ordinal: sourceOrder,
      ...(typeof event.sequence === "number" ? { sequence: event.sequence } : {})
    },
    createdAt: Date.now() + sourceOrder
  };
  if (event.kind === "agent_message_delta") {
    return { ...base, body: { kind: "agent-message", text: delta } };
  }
  if (event.kind === "reasoning_delta") {
    return { ...base, body: { kind: "reasoning", text: delta, done: false } };
  }
  if (event.kind === "plan_delta") {
    return { ...base, body: { kind: "system", text: delta } };
  }
  const defaultServer =
    event.kind === "command_output_delta" ? "command" : event.kind === "file_output_delta" ? "file" : "tool";
  const toolKind: ToolEntry["toolKind"] =
    event.kind === "command_output_delta"
      ? "command"
      : event.kind === "file_output_delta"
        ? "file"
        : typeof event.toolKind === "string"
          ? (event.toolKind as ToolEntry["toolKind"])
          : undefined;
  return {
    ...base,
    body: {
      kind: "tool",
      ...(toolKind ? { toolKind } : {}),
      server: typeof event.server === "string" ? event.server : defaultServer,
      tool: typeof event.tool === "string" ? event.tool : defaultServer,
      status: "running",
      result: delta
    }
  };
}

function timelineContentReferenceEntry(
  event: { [key: string]: unknown },
  threadId: string,
  generation: number | null
): TimelineEntry | null {
  const itemId = typeof event.itemId === "string" && event.itemId ? event.itemId : null;
  const preview = typeof event.preview === "string" ? event.preview : "";
  const turnId = typeof event.turnId === "string" && event.turnId ? event.turnId : null;
  if (!itemId || !turnId) {
    return null;
  }
  const completeness = event.completeness as TimelineCompleteness | undefined;
  const base = {
    id: itemId,
    turnId,
    ...(generation !== null ? { generation } : {}),
    ...(typeof event.bootId === "string" ? { bootId: event.bootId } : {}),
    ...(typeof event.bootId === "string" && generation !== null
      ? { historyStamp: { bootId: event.bootId, generation } }
      : {}),
    ...(typeof event.streamSequence === "number" ? { streamSequence: event.streamSequence } : {}),
    ...(event.sourceLocator ? { sourceLocator: event.sourceLocator as TimelineEntry["sourceLocator"] } : {}),
    ...(completeness ? { completeness } : {}),
    sourceOrder: {
      sourceKind: "live" as const,
      ordinal: typeof event.sequence === "number" ? event.sequence : 0,
      ...(typeof event.sequence === "number" ? { sequence: event.sequence } : {})
    },
    createdAt: Date.now()
  };
  const itemRole = typeof event.itemRole === "string" ? event.itemRole : null;
  const originalKind = typeof event.originalKind === "string" ? event.originalKind : "";
  if (itemRole === "agent" || originalKind === "agent_message_delta") {
    return { ...base, body: { kind: "agent-message", text: preview } };
  }
  if (itemRole === "reasoning" || originalKind === "reasoning_delta") {
    return { ...base, body: { kind: "reasoning", text: preview, done: false } };
  }
  if (itemRole === "diff" || originalKind === "turn_diff_updated") {
    return {
      ...base,
      body: { kind: "diff", path: "工作区变更", added: 0, removed: 0, diff: preview }
    };
  }
  return {
    ...base,
    body: {
      kind: "tool",
      toolKind: typeof event.toolKind === "string" ? (event.toolKind as ToolEntry["toolKind"]) : undefined,
      server: typeof event.server === "string" ? event.server : "tool",
      tool: typeof event.tool === "string" ? event.tool : "tool",
      status:
        event.status === "running" || event.status === "failed" || event.status === "success"
          ? event.status
          : "success",
      result: preview
    }
  };
}

function isRunningThreadStatus(status: string): boolean {
  return status === "active";
}

function finiteNumberOrZero(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function finiteNumberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function uniqueTimelineId(prefix: string): string {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${random}`;
}

export const useAppStore = useStore;

function normalizePendingRequest(req: PendingServerRequest): PendingServerRequest {
  return {
    ...req,
    requestId: String(req.requestId),
    request: req.request ?? (typeof req.params === "object" && req.params !== null ? (req.params as Record<string, unknown>) : {})
  };
}

function approvalsReviewerOrNull(value: unknown): ApprovalsReviewer | null {
  return value === "user" || value === "auto_review" || value === "guardian_subagent" ? value : null;
}

function approvalsReviewerOrUndefined(value: unknown): ApprovalsReviewer | null | undefined {
  if (value === null) return null;
  return value === "user" || value === "auto_review" || value === "guardian_subagent" ? value : undefined;
}

function approvalPolicyOrUndefined(value: unknown): ApprovalPolicy | null | undefined {
  if (value === null) return null;
  return value === "untrusted" || value === "on-request" || value === "never" ? value : undefined;
}
