"use client";

import { create } from "zustand";
import type { AppServerStatus, ApprovalsReviewer, ChatMode, PendingServerRequest, TimelineItem } from "../api/types";
import { diffEntryFromText, timelineItemToEntry, type TimelineEntry, type ToolEntry } from "./timeline";
import type { WsEvent, WsConnectionState } from "../ws/client";

export type { WsConnectionState };

const MAX_PROCESSED_EVENT_IDS = 2_000;

type TimelineEntryIndexes = {
  byId: Map<string, number>;
};

type TimelineDiagnostics = {
  normalizeRuns: number;
  entryIndexBuildEntries: number;
  linearEntryScans: number;
  equivalentOutputCandidateChecks: number;
};

const timelineDiagnostics: TimelineDiagnostics = {
  normalizeRuns: 0,
  entryIndexBuildEntries: 0,
  linearEntryScans: 0,
  equivalentOutputCandidateChecks: 0
};

export type ThreadState = {
  entries: TimelineEntry[];
  entryIndexes: TimelineEntryIndexes;
  pendingApprovals: PendingServerRequest[];
  resolvedApprovals: Set<string>;
  interruptedTurnIds: Set<string>;
  deletedTurnIds: Set<string>;
  processedEventIds: Set<string>;
  itemRevisions: Map<string, number>;
  snapshotDeltaSuppressions: Map<string, { text: string; offset: number; maxSequence?: number; generation?: number }>;
  timelineGeneration: number;
  localUserMessageIdsByTurn: Map<string, string>;
  repairRequestedAt: number | null;
  running: boolean;
  cursor: string | null;
  reachedBeginning: boolean;
  plan: Array<{ text: string; completed: boolean }>;
  mode: ChatMode;
  model: string | null;
  modelEffort: string | null;
  permissionProfileId?: string | null;
  approvalsReviewer?: ApprovalsReviewer | null;
  activeTurnId: string | null;
  lastSeenItemId: string | null;
};

type State = {
  wsState: WsConnectionState | "idle";
  appServer: AppServerStatus | null;
  threads: Record<string, ThreadState>;
  activeThreadId: string | null;
  skillsCacheVersion: number;
};

type Actions = {
  setWsState: (s: WsConnectionState) => void;
  setAppServer: (s: AppServerStatus) => void;
  setActiveThread: (threadId: string | null) => void;
  ensureThread: (threadId: string, init?: Partial<ThreadState>) => void;
  setThreadEntries: (threadId: string, entries: TimelineEntry[], cursor: string | null) => void;
  mergeThreadEntries: (threadId: string, entries: TimelineEntry[], cursor: string | null) => void;
  prependEntries: (
    threadId: string,
    entries: TimelineEntry[],
    cursor: string | null,
    reachedBeginning: boolean
  ) => void;
  appendEntries: (threadId: string, entries: TimelineEntry[]) => void;
  replaceOrAddEntry: (threadId: string, entry: TimelineEntry) => void;
  appendTextToEntry: (threadId: string, entry: TimelineEntry) => void;
  startReasoningEntry: (threadId: string, turnId: string | null, itemId: string) => void;
  appendReasoningDelta: (threadId: string, turnId: string | null, itemId: string, delta: string) => void;
  removeEmptyPendingReasoningEntry: (threadId: string, turnId: string | null) => void;
  setRunning: (threadId: string, running: boolean) => void;
  setActiveTurnId: (threadId: string, turnId: string | null) => void;
  bindLocalUserMessageTurn: (threadId: string, clientUserMessageId: string, turnId: string) => void;
  setTimelineGeneration: (threadId: string, generation: number) => void;
  markTurnInterrupted: (threadId: string, turnId: string) => void;
  markTurnDeleted: (threadId: string, turnId: string) => void;
  requestSnapshotRepair: (threadId: string) => void;
  clearSnapshotRepair: (threadId: string) => void;
  setMode: (threadId: string, mode: ChatMode) => void;
  setModel: (threadId: string, model: string | null, effort?: string | null) => void;
  setPermissionProfile: (threadId: string, profileId: string | null, approvalsReviewer?: ApprovalsReviewer | null) => void;
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
  const entries = init?.entries ?? [];
  const entryIndexes = init?.entryIndexes ?? buildTimelineEntryIndexes(entries);
  return {
    pendingApprovals: [],
    resolvedApprovals: new Set<string>(),
    interruptedTurnIds: new Set<string>(),
    deletedTurnIds: new Set<string>(),
    processedEventIds: new Set<string>(),
    itemRevisions: new Map<string, number>(),
    snapshotDeltaSuppressions: new Map<string, { text: string; offset: number; maxSequence?: number; generation?: number }>(),
    timelineGeneration: 0,
    localUserMessageIdsByTurn: new Map<string, string>(),
    repairRequestedAt: null,
    running: false,
    cursor: null,
    reachedBeginning: false,
    plan: [],
    mode: "build",
    model: null,
    modelEffort: null,
    permissionProfileId: undefined,
    approvalsReviewer: undefined,
    activeTurnId: null,
    lastSeenItemId: null,
    ...init,
    entries,
    entryIndexes
  };
};

export const useStore = create<State & Actions>((set, get) => ({
  wsState: "idle",
  appServer: null,
  threads: {},
  activeThreadId: null,
  skillsCacheVersion: 0,
  setWsState: (s) => set({ wsState: s }),
  setAppServer: (s) => set({ appServer: s }),
  setActiveThread: (id) => set({ activeThreadId: id }),
  ensureThread: (threadId, init) =>
    set((state) => {
      if (state.threads[threadId]) return state;
      return { threads: { ...state.threads, [threadId]: emptyThread(init) } };
    }),
  setThreadEntries: (threadId, entries, cursor) =>
    set((state) => {
      const prev = state.threads[threadId] ?? emptyThread();
      const nextEntries = normalizeTimelineEntries(entries);
      const timelineGeneration = Math.max(prev.timelineGeneration, maxEntryGeneration(nextEntries));
      return {
        threads: {
          ...state.threads,
          [threadId]: indexedThreadState(
            {
            ...prev,
            cursor,
            reachedBeginning: cursor === null,
            timelineGeneration,
            processedEventIds: trimStringSet(prev.processedEventIds, MAX_PROCESSED_EVENT_IDS),
            itemRevisions: itemRevisionsFromEntries(nextEntries, prev.itemRevisions),
            snapshotDeltaSuppressions: snapshotDeltaSuppressions(nextEntries),
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
      const nextEntries = mergeTimelineEntries(prev.entries, entries, prev.entryIndexes);
      const timelineGeneration = Math.max(prev.timelineGeneration, maxEntryGeneration(entries));
      return {
        threads: {
          ...state.threads,
          [threadId]: indexedThreadState(
            {
            ...prev,
            cursor,
            reachedBeginning: cursor === null,
            timelineGeneration,
            localUserMessageIdsByTurn: localUserMessageIdsByTurnFromEntries(nextEntries, prev.localUserMessageIdsByTurn),
            lastSeenItemId: nextEntries.length ? nextEntries[nextEntries.length - 1].id : prev.lastSeenItemId
            },
            nextEntries
          )
        }
      };
    }),
  prependEntries: (threadId, entries, cursor, reachedBeginning) =>
    set((state) => {
      const prev = state.threads[threadId] ?? emptyThread();
      const nextEntries = normalizeTimelineEntries([...entries, ...prev.entries]);
      return {
        threads: {
          ...state.threads,
          [threadId]: indexedThreadState({ ...prev, cursor, reachedBeginning }, nextEntries)
        }
      };
    }),
  appendEntries: (threadId, entries) =>
    set((state) => {
      const prev = state.threads[threadId] ?? emptyThread();
      const nextEntries = normalizeTimelineEntries([...prev.entries, ...entries]);
      const last = nextEntries.length ? nextEntries[nextEntries.length - 1].id : prev.lastSeenItemId;
      return {
        threads: {
          ...state.threads,
          [threadId]: indexedThreadState({ ...prev, lastSeenItemId: last }, nextEntries)
        }
      };
    }),
  replaceOrAddEntry: (threadId, entry) =>
    set((state) => {
      const prev = state.threads[threadId] ?? emptyThread();
      const idx = findEntryIndexById(prev, entry.id);
      const equivalentOutputIndex = idx >= 0 ? -1 : findEquivalentOutputIndex(prev.entries, entry);
      const confirmedLocalIndex = idx >= 0 || equivalentOutputIndex >= 0 ? -1 : findConfirmableLocalUserIndex(prev, entry);
      const entryToAdd =
        idx >= 0 || equivalentOutputIndex >= 0 || confirmedLocalIndex >= 0
          ? entry
          : completedActivityEntryBeforeFinalAssistant(prev.entries, entry);
      const nextEntries =
        idx >= 0
          ? prev.entries.map((current, i) => (i === idx ? mergeReplacementEntry(current, entry) : current))
          : equivalentOutputIndex >= 0
            ? prev.entries.map((current, i) => (i === equivalentOutputIndex ? mergeEquivalentOutputEntry(current, entry) : current))
          : confirmedLocalIndex >= 0
            ? prev.entries.map((current, i) => (i === confirmedLocalIndex ? mergeReplacementEntry(current, entry) : current))
            : [...prev.entries, entryToAdd];
      const normalizedEntries = normalizeTimelineEntries(nextEntries);
      return {
        threads: {
          ...state.threads,
          [threadId]: indexedThreadState(
            {
            ...prev,
            timelineGeneration: Math.max(prev.timelineGeneration, entry.generation ?? 0),
            localUserMessageIdsByTurn: localUserMessageIdsByTurnFromEntries(
              normalizedEntries,
              prev.localUserMessageIdsByTurn
            ),
            lastSeenItemId: entry.id
            },
            normalizedEntries
          )
        }
      };
    }),
  appendTextToEntry: (threadId, entry) =>
    set((state) => {
      const prev = state.threads[threadId] ?? emptyThread();
      const idx = findEntryIndexById(prev, entry.id);
      let appendedExisting = false;
      let normalizeAfterAppend = false;
      const nextEntries = idx >= 0 ? prev.entries.slice() : [...prev.entries, entry];
      if (idx >= 0) {
        const current = prev.entries[idx];
        if (current) {
          const appended = appendDeltaToExistingEntry(current, entry);
          if (appended) {
            appendedExisting = true;
            normalizeAfterAppend =
              current.turnId !== appended.turnId ||
              current.turnIndex !== appended.turnIndex;
            nextEntries[idx] = appended;
          }
        }
      }
      if (idx >= 0 && !appendedExisting) {
        return state;
      }
      const normalizedEntries =
        appendedExisting && !normalizeAfterAppend ? nextEntries : normalizeTimelineEntries(nextEntries);
      const nextThread = {
        ...prev,
        timelineGeneration: Math.max(prev.timelineGeneration, entry.generation ?? 0),
        lastSeenItemId: entry.id
      };
      return {
        threads: {
          ...state.threads,
          [threadId]:
            appendedExisting && !normalizeAfterAppend
              ? { ...nextThread, entries: normalizedEntries, entryIndexes: prev.entryIndexes }
              : indexedThreadState(nextThread, normalizedEntries)
        }
      };
    }),
  startReasoningEntry: (threadId, turnId, itemId) =>
    set((state) => {
      const prev = state.threads[threadId] ?? emptyThread();
      const pendingId = pendingReasoningId(threadId, turnId);
      const entry: TimelineEntry = {
        id: itemId,
        ...(turnId ? { turnId } : {}),
        createdAt: Date.now(),
        body: { kind: "reasoning", text: "", done: false }
      };
      const existingIndex = findEntryIndexById(prev, itemId);
      const pendingIndex = existingIndex >= 0 ? -1 : findEntryIndexById(prev, pendingId);
      const nextEntries =
        existingIndex >= 0
          ? prev.entries.map((current, index) => {
              if (index !== existingIndex || current.body.kind !== "reasoning") {
                return current;
              }
              return {
                ...current,
                ...(turnId && !current.turnId ? { turnId } : {}),
                body: { ...current.body, done: false }
              };
            })
          : pendingIndex >= 0
            ? prev.entries.map((current, index) => (index === pendingIndex ? entry : current))
            : [...prev.entries, entry];

      return {
        threads: {
          ...state.threads,
          [threadId]: indexedThreadState({ ...prev, lastSeenItemId: itemId }, normalizeTimelineEntries(nextEntries))
        }
      };
    }),
  appendReasoningDelta: (threadId, turnId, itemId, delta) =>
    set((state) => {
      const prev = state.threads[threadId] ?? emptyThread();
      const pendingId = pendingReasoningId(threadId, turnId);
      const deltaEntry: TimelineEntry = {
        id: itemId,
        ...(turnId ? { turnId } : {}),
        createdAt: Date.now(),
        body: { kind: "reasoning", text: delta, done: false }
      };
      const existingIndex = findEntryIndexById(prev, itemId);
      const pendingIndex = existingIndex >= 0 ? -1 : findEntryIndexById(prev, pendingId);
      const appendedExisting = existingIndex >= 0 && prev.entries[existingIndex]?.body.kind === "reasoning";
      const replacedPending = !appendedExisting && pendingIndex >= 0;
      let normalizeAfterAppend = false;
      const nextEntries = appendedExisting || replacedPending ? prev.entries.slice() : [...prev.entries, deltaEntry];
      if (appendedExisting) {
        const current = prev.entries[existingIndex];
        if (current?.body.kind === "reasoning") {
          normalizeAfterAppend = Boolean(turnId) && current.turnId !== turnId;
          nextEntries[existingIndex] = {
            ...current,
            ...(turnId && !current.turnId ? { turnId } : {}),
            body: { ...current.body, text: `${current.body.text}${delta}` }
          };
        }
      } else if (replacedPending) {
        nextEntries[pendingIndex] = deltaEntry;
      }

      const normalizedEntries =
        (appendedExisting && !normalizeAfterAppend) || replacedPending ? nextEntries : normalizeTimelineEntries(nextEntries);
      const nextThread = { ...prev, lastSeenItemId: itemId };

      return {
        threads: {
          ...state.threads,
          [threadId]:
            appendedExisting && !normalizeAfterAppend
              ? { ...nextThread, entries: normalizedEntries, entryIndexes: prev.entryIndexes }
              : indexedThreadState(nextThread, normalizedEntries)
        }
      };
    }),
  removeEmptyPendingReasoningEntry: (threadId, turnId) =>
    set((state) => {
      const prev = state.threads[threadId] ?? emptyThread();
      const pendingId = pendingReasoningId(threadId, turnId);
      const nextEntries = prev.entries.filter((entry) => {
        return !(
          entry.id === pendingId &&
          entry.body.kind === "reasoning" &&
          !entry.body.text.trim()
        );
      });
      if (nextEntries.length === prev.entries.length) {
        return state;
      }
      return {
        threads: {
          ...state.threads,
          [threadId]: indexedThreadState(prev, normalizeTimelineEntries(nextEntries))
        }
      };
    }),
  setRunning: (threadId, running) =>
    set((state) => {
      const prev = state.threads[threadId] ?? emptyThread();
      return { threads: { ...state.threads, [threadId]: { ...prev, running, activeTurnId: running ? prev.activeTurnId : null } } };
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
      const entries = prev.entries.map((entry) => {
        if (entry.id !== clientUserMessageId) {
          return entry;
        }
        if (entry.body.kind !== "user-message") {
          return entry;
        }
        return {
          ...entry,
          turnId,
          clientUserMessageId,
          body: { ...entry.body, status: "sent" as const }
        };
      });
      return {
        threads: {
          ...state.threads,
          [threadId]: indexedThreadState({ ...prev, localUserMessageIdsByTurn }, normalizeTimelineEntries(entries))
        }
      };
    }),
  setTimelineGeneration: (threadId, generation) =>
    set((state) => {
      const prev = state.threads[threadId] ?? emptyThread();
      if (generation <= prev.timelineGeneration) {
        return state;
      }
      return {
        threads: {
          ...state.threads,
          [threadId]: {
            ...prev,
            timelineGeneration: generation,
            processedEventIds: trimStringSet(prev.processedEventIds, MAX_PROCESSED_EVENT_IDS),
            itemRevisions: new Map(prev.itemRevisions),
            snapshotDeltaSuppressions: snapshotDeltaSuppressions(prev.entries)
          }
        }
      };
    }),
  markTurnInterrupted: (threadId, turnId) =>
    set((state) => {
      const prev = state.threads[threadId] ?? emptyThread();
      const interruptedTurnIds = new Set(prev.interruptedTurnIds);
      interruptedTurnIds.add(turnId);
      return { threads: { ...state.threads, [threadId]: { ...prev, interruptedTurnIds } } };
    }),
  markTurnDeleted: (threadId, turnId) =>
    set((state) => {
      const prev = state.threads[threadId] ?? emptyThread();
      const deletedTurnIds = new Set(prev.deletedTurnIds);
      deletedTurnIds.add(turnId);
      return { threads: { ...state.threads, [threadId]: { ...prev, deletedTurnIds } } };
    }),
  requestSnapshotRepair: (threadId) =>
    set((state) => {
      const prev = state.threads[threadId] ?? emptyThread();
      return {
        threads: {
          ...state.threads,
          [threadId]: { ...prev, repairRequestedAt: Date.now() }
        }
      };
    }),
  clearSnapshotRepair: (threadId) =>
    set((state) => {
      const prev = state.threads[threadId] ?? emptyThread();
      if (!prev.repairRequestedAt) {
        return state;
      }
      return {
        threads: {
          ...state.threads,
          [threadId]: { ...prev, repairRequestedAt: null }
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
  setPermissionProfile: (threadId, profileId, approvalsReviewer) =>
    set((state) => {
      const prev = state.threads[threadId] ?? emptyThread();
      return {
        threads: {
          ...state.threads,
          [threadId]: {
            ...prev,
            permissionProfileId: profileId,
            approvalsReviewer: approvalsReviewer === undefined ? prev.approvalsReviewer : approvalsReviewer
          }
        }
      };
    }),
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
    if (event.type === "timeline-gap") {
      const threadId = typeof event.threadId === "string" && event.threadId ? event.threadId : null;
      if (threadId) {
        get().ensureThread(threadId);
        get().requestSnapshotRepair(threadId);
      }
      return;
    }
    if (event.type === "codex-event-batch") {
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
      get().ensureThread(threadId);
      const generation = typeof ev.generation === "number" ? ev.generation : null;
      const thread = get().threads[threadId];
      if (generation !== null && generation < (thread?.timelineGeneration ?? 0) && isVisibleTimelineEvent(ev.kind)) {
        return;
      }
      if (generation !== null && generation > (thread?.timelineGeneration ?? 0)) {
        get().setTimelineGeneration(threadId, generation);
      }
      const eventId = typeof ev.eventId === "string" ? ev.eventId : null;
      if (eventId && get().threads[threadId]?.processedEventIds.has(eventId)) {
        return;
      }
      if (eventId) {
        recordProcessedEventId(threadId, eventId);
      }
      if (shouldIgnoreDeletedOrInterruptedTurnEvent(get().threads[threadId], ev)) {
        return;
      }
      switch (ev.kind) {
        case "turn.started":
        case "turn_started":
          get().setRunning(threadId, true);
          get().setActiveTurnId(threadId, typeof ev.turnId === "string" ? ev.turnId : null);
          get().startReasoningEntry(
            threadId,
            typeof ev.turnId === "string" ? ev.turnId : null,
            pendingReasoningId(threadId, typeof ev.turnId === "string" ? ev.turnId : null)
          );
          break;
        case "turn.completed":
        case "turn.failed":
        case "turn.canceled":
        case "turn_completed":
        case "turn_failed":
        case "turn_interrupted": {
          const eventTurnId = typeof ev.turnId === "string" ? ev.turnId : null;
          const currentActiveTurnId = get().threads[threadId]?.activeTurnId ?? null;
          if (!eventTurnId || !currentActiveTurnId || eventTurnId === currentActiveTurnId) {
            get().setRunning(threadId, false);
          }
          get().removeEmptyPendingReasoningEntry(threadId, eventTurnId);
          if (
            eventTurnId &&
            currentActiveTurnId === eventTurnId &&
            (ev.kind === "turn.completed" || ev.kind === "turn_completed" || ev.status === "completed") &&
            !hasVisibleServerOutputForTurn(get().threads[threadId]?.entries ?? [], eventTurnId)
          ) {
            get().requestSnapshotRepair(threadId);
          }
          break;
        }
        case "plan.delta": {
          const plan = (ev.plan as Array<{ text: string; completed: boolean }>) ?? [];
          get().setPlan(threadId, plan);
          break;
        }
        case "plan_delta": {
          const itemId = typeof ev.itemId === "string" ? ev.itemId : `${threadId}-plan-live`;
          const delta = typeof ev.delta === "string" ? ev.delta : "";
          if (delta && !shouldSuppressSnapshotDelta(threadId, itemId, delta, ev.sequence, generation)) {
            get().appendTextToEntry(threadId, {
              id: itemId,
              ...(typeof ev.turnId === "string" ? { turnId: ev.turnId } : {}),
              createdAt: Date.now(),
              body: { kind: "system", text: delta }
            });
          }
          break;
        }
        case "agent_message_delta": {
          const itemId = typeof ev.itemId === "string" ? ev.itemId : `${threadId}-agent-live`;
          if (shouldIgnoreStaleItemRevision(get().threads[threadId], itemId, generation, ev.revision)) {
            break;
          }
          const delta = typeof ev.delta === "string" ? ev.delta : "";
          if (delta && !shouldSuppressSnapshotDelta(threadId, itemId, delta, ev.sequence, generation)) {
            get().appendTextToEntry(threadId, {
              id: itemId,
              ...(typeof ev.turnId === "string" ? { turnId: ev.turnId } : {}),
              createdAt: Date.now(),
              body: { kind: "agent-message", text: delta }
            });
          }
          break;
        }
        case "reasoning_delta": {
          const itemId = typeof ev.itemId === "string" ? ev.itemId : `${threadId}-reasoning-live`;
          if (shouldIgnoreStaleItemRevision(get().threads[threadId], itemId, generation, ev.revision)) {
            break;
          }
          const delta = typeof ev.delta === "string" ? ev.delta : "";
          if (delta && !shouldSuppressSnapshotDelta(threadId, itemId, delta, ev.sequence, generation)) {
            get().appendReasoningDelta(threadId, typeof ev.turnId === "string" ? ev.turnId : null, itemId, delta);
          }
          break;
        }
        case "reasoning_started": {
          const itemId = typeof ev.itemId === "string" ? ev.itemId : `${threadId}-reasoning-live`;
          get().startReasoningEntry(threadId, typeof ev.turnId === "string" ? ev.turnId : null, itemId);
          break;
        }
        case "command_output_delta":
        case "file_output_delta":
        case "tool_output_delta": {
          const itemId = typeof ev.itemId === "string" ? ev.itemId : `${threadId}-${ev.kind}`;
          if (shouldIgnoreStaleItemRevision(get().threads[threadId], itemId, generation, ev.revision)) {
            break;
          }
          const delta = typeof ev.delta === "string" ? ev.delta : "";
          if (delta && !shouldSuppressSnapshotDelta(threadId, itemId, delta, ev.sequence, generation)) {
            const defaultServer =
              ev.kind === "command_output_delta" ? "command" : ev.kind === "file_output_delta" ? "file" : "tool";
            const server = typeof ev.server === "string" ? ev.server : defaultServer;
            const tool = typeof ev.tool === "string" ? ev.tool : defaultServer;
            const toolKind: ToolEntry["toolKind"] =
              ev.kind === "command_output_delta"
                ? "command"
                : ev.kind === "file_output_delta"
                  ? "file"
                  : typeof ev.toolKind === "string"
                    ? (ev.toolKind as ToolEntry["toolKind"])
                    : undefined;
            get().appendTextToEntry(threadId, {
              id: itemId,
              ...(typeof ev.turnId === "string" ? { turnId: ev.turnId } : {}),
              createdAt: Date.now(),
              body: {
                kind: "tool",
                ...(toolKind ? { toolKind } : {}),
                server,
                tool,
                status: "running",
                result: delta
              }
            });
          }
          break;
        }
        case "turn_diff_updated": {
          const diff = typeof ev.diff === "string" ? ev.diff : "";
          const entry = diffEntryFromText(`${ev.turnId ?? threadId}-diff`, diff, Date.now());
          get().replaceOrAddEntry(threadId, {
            ...entry,
            ...(typeof ev.turnId === "string" ? { turnId: ev.turnId } : {})
          });
          break;
        }
        case "context_compacted": {
          const turnId = typeof ev.turnId === "string" ? ev.turnId : threadId;
          get().replaceOrAddEntry(threadId, {
            id: `${turnId}-context-compacted`,
            ...(typeof ev.turnId === "string" ? { turnId: ev.turnId } : {}),
            createdAt: Date.now(),
            body: { kind: "system", text: "压缩上下文已完成" }
          });
          break;
        }
        case "warning": {
          const message = typeof ev.message === "string" ? ev.message : "发生错误";
          get().replaceOrAddEntry(threadId, {
            id: uniqueTimelineId(`${threadId}-warning`),
            createdAt: Date.now(),
            body: { kind: "error", text: message }
          });
          break;
        }
        case "turn_error": {
          const turnId = typeof ev.turnId === "string" ? ev.turnId : threadId;
          const message = typeof ev.message === "string" ? ev.message : "运行失败";
          get().replaceOrAddEntry(threadId, {
            id: `${turnId}-error`,
            ...(typeof ev.turnId === "string" ? { turnId: ev.turnId } : {}),
            createdAt: Date.now(),
            body: { kind: "error", text: message }
          });
          if (ev.willRetry !== true) {
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
            const reviewer = "approvalsReviewer" in ev ? approvalsReviewerOrNull(ev.approvalsReviewer) : undefined;
            const current = get().threads[threadId];
            const preserveReviewer =
              reviewer === undefined &&
              current?.permissionProfileId === profileId &&
              current.approvalsReviewer !== undefined;
            get().setPermissionProfile(threadId, profileId, preserveReviewer ? undefined : reviewer ?? null);
          }
          break;
        }
        case "item.appended":
        case "item.updated":
        case "item_updated": {
          const entry = (ev.entry as TimelineEntry | undefined) ?? null;
          if (entry) {
            get().replaceOrAddEntry(threadId, entry);
            break;
          }
          const item = (ev.item as TimelineItem | undefined) ?? null;
          if (item) {
            const createdAt = typeof ev.completedAtMs === "number" ? ev.completedAtMs : Date.now();
            const revision = typeof ev.revision === "number" ? ev.revision : null;
            if (revision !== null) {
              set((state) => {
                const prev = state.threads[threadId] ?? emptyThread();
                const itemRevisions = new Map(prev.itemRevisions);
                const revisionKey = itemRevisionKey(item.id, generation);
                itemRevisions.set(revisionKey, Math.max(itemRevisions.get(revisionKey) ?? 0, revision));
                return {
                  threads: {
                    ...state.threads,
                    [threadId]: { ...prev, itemRevisions }
                  }
                };
              });
            }
            get().replaceOrAddEntry(
              threadId,
              timelineItemToEntry(
                {
                  ...item,
                  ...(typeof ev.turnId === "string" && !item.turnId ? { turnId: ev.turnId } : {}),
                  ...(generation !== null && typeof item.generation !== "number" ? { generation } : {})
                },
                createdAt
              )
            );
          }
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
  __getTimelineDiagnostics: () => ({ ...timelineDiagnostics }),
  __resetTimelineDiagnostics: () => {
    timelineDiagnostics.normalizeRuns = 0;
    timelineDiagnostics.entryIndexBuildEntries = 0;
    timelineDiagnostics.linearEntryScans = 0;
    timelineDiagnostics.equivalentOutputCandidateChecks = 0;
  }
}));

function mergeTimelineEntries(
  current: TimelineEntry[],
  snapshot: TimelineEntry[],
  currentIndexes = buildTimelineEntryIndexes(current)
): TimelineEntry[] {
  if (!current.length) {
    return normalizeTimelineEntries(snapshot);
  }

  const merged = current.slice();
  for (const snapshotEntry of snapshot) {
    const currentIndex = currentIndexes.byId.get(snapshotEntry.id);
    if (typeof currentIndex !== "number") {
      merged.push(snapshotEntry);
      continue;
    }
    const currentEntry = merged[currentIndex];
    if (!currentEntry) {
      merged.push(snapshotEntry);
      continue;
    }
    merged[currentIndex] = shouldReplaceLiveEntry(currentEntry, snapshotEntry) ? snapshotEntry : currentEntry;
  }

  return normalizeTimelineEntries(merged);
}

function shouldReplaceLiveEntry(current: TimelineEntry, snapshot: TimelineEntry): boolean {
  if (snapshot.body.kind === "reasoning" && current.body.kind === "reasoning") {
    return snapshot.body.done || !current.body.text;
  }
  if (snapshot.body.kind === "tool" && current.body.kind === "tool") {
    return snapshot.body.status !== "running" || !current.body.result;
  }
  if (snapshot.body.kind === "agent-message" && current.body.kind === "agent-message") {
    return snapshot.body.text.length >= current.body.text.length;
  }
  return true;
}

function normalizeTimelineEntries(entries: TimelineEntry[]): TimelineEntry[] {
  timelineDiagnostics.normalizeRuns += 1;
  return orderTimelineEntries(
    mergeEquivalentOutputEntries(
      removeAdjacentDuplicateUserMessages(
        removeDuplicateConfirmedUserMessages(
          replaceConfirmedLocalUserMessagesInPlace(removeDuplicateLocalUserMessages(entries))
        )
      )
    )
  );
}

function buildTimelineEntryIndexes(entries: TimelineEntry[]): TimelineEntryIndexes {
  timelineDiagnostics.entryIndexBuildEntries += entries.length;
  const byId = new Map<string, number>();
  entries.forEach((entry, index) => {
    byId.set(entry.id, index);
  });
  return { byId };
}

function indexedThreadState(prev: ThreadState, entries: TimelineEntry[]): ThreadState {
  return {
    ...prev,
    entries,
    entryIndexes: buildTimelineEntryIndexes(entries)
  };
}

function findEntryIndexById(state: ThreadState, id: string): number {
  const indexed = state.entryIndexes.byId.get(id);
  if (typeof indexed === "number" && state.entries[indexed]?.id === id) {
    return indexed;
  }
  timelineDiagnostics.linearEntryScans += state.entries.length;
  return state.entries.findIndex((entry) => entry.id === id);
}

function snapshotDeltaSuppressions(entries: TimelineEntry[]): Map<string, { text: string; offset: number; maxSequence?: number; generation?: number }> {
  const suppressions = new Map<string, { text: string; offset: number; maxSequence?: number; generation?: number }>();
  for (const entry of entries) {
    const text = deltaComparableText(entry);
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

function itemRevisionsFromEntries(entries: TimelineEntry[], previous = new Map<string, number>()): Map<string, number> {
  const revisions = new Map(previous);
  for (const entry of entries) {
    const key = itemRevisionKey(entry.id, typeof entry.generation === "number" ? entry.generation : null);
    if (!revisions.has(key)) {
      revisions.set(key, 0);
    }
  }
  return revisions;
}

function trimStringSet(values: Set<string>, maxSize: number): Set<string> {
  const next = new Set(values);
  trimStringSetInPlace(next, maxSize);
  return next;
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

function recordProcessedEventId(threadId: string, eventId: string): void {
  const processedEventIds = useStore.getState().threads[threadId]?.processedEventIds;
  if (!processedEventIds) {
    return;
  }
  processedEventIds.add(eventId);
  trimStringSetInPlace(processedEventIds, MAX_PROCESSED_EVENT_IDS);
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

function deltaComparableText(entry: TimelineEntry): string {
  if (entry.body.kind === "agent-message" || entry.body.kind === "reasoning" || entry.body.kind === "system") {
    return entry.body.text;
  }
  if (entry.body.kind === "tool") {
    return entry.body.result ?? "";
  }
  return "";
}

function shouldSuppressSnapshotDelta(
  threadId: string,
  itemId: string,
  delta: string,
  sequence: unknown,
  generation: number | null
): boolean {
  const state = useStore.getState().threads[threadId];
  const suppression = state?.snapshotDeltaSuppressions.get(itemId);
  if (!suppression) {
    return false;
  }

  if (
    typeof suppression.generation === "number" &&
    generation !== null &&
    generation !== suppression.generation
  ) {
    removeSnapshotDeltaSuppression(threadId, itemId);
    return false;
  }

  const eventSequence = typeof sequence === "number" ? sequence : null;
  if (
    typeof suppression.maxSequence === "number" &&
    eventSequence !== null &&
    eventSequence > suppression.maxSequence
  ) {
    removeSnapshotDeltaSuppression(threadId, itemId);
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
    removeSnapshotDeltaSuppression(threadId, itemId);
    return false;
  }

  const nextOffset = coveredIndex + delta.length;
  // Internal replay bookkeeping should not make React rerender for deltas that stay hidden.
  const suppressions = useStore.getState().threads[threadId]?.snapshotDeltaSuppressions;
  if (nextOffset >= suppression.text.length) {
    suppressions?.delete(itemId);
  } else {
    suppressions?.set(itemId, { ...suppression, offset: nextOffset });
  }
  return true;
}

function removeSnapshotDeltaSuppression(threadId: string, itemId: string): void {
  useStore.getState().threads[threadId]?.snapshotDeltaSuppressions.delete(itemId);
}

function pendingReasoningId(threadId: string, turnId: string | null): string {
  return `${turnId ?? threadId}-reasoning-pending`;
}

function timelineEntryTurnMeta(
  current: TimelineEntry,
  next: TimelineEntry
): Pick<TimelineEntry, "turnId" | "turnIndex"> {
  return {
    ...(next.turnId || current.turnId ? { turnId: next.turnId ?? current.turnId } : {}),
    ...(typeof next.turnIndex === "number" || typeof current.turnIndex === "number"
      ? { turnIndex: next.turnIndex ?? current.turnIndex }
      : {})
  };
}

function appendDeltaToExistingEntry(current: TimelineEntry, entry: TimelineEntry): TimelineEntry | null {
  if (
    (current.body.kind === "agent-message" && entry.body.kind === "agent-message") ||
    (current.body.kind === "reasoning" && entry.body.kind === "reasoning")
  ) {
    return {
      ...current,
      ...timelineEntryTurnMeta(current, entry),
      body: { ...current.body, text: `${current.body.text}${entry.body.text}` }
    };
  }

  if (current.body.kind === "tool" && entry.body.kind === "tool") {
    return {
      ...current,
      ...timelineEntryTurnMeta(current, entry),
      body: {
        ...current.body,
        toolKind: entry.body.toolKind ?? current.body.toolKind,
        actionKind: entry.body.actionKind ?? current.body.actionKind,
        server: entry.body.server || current.body.server,
        tool: entry.body.tool || current.body.tool,
        result: `${current.body.result ?? ""}${entry.body.result ?? ""}`,
        status: entry.body.status
      }
    };
  }

  if (current.body.kind === "system" && entry.body.kind === "system") {
    return {
      ...current,
      ...timelineEntryTurnMeta(current, entry),
      body: { ...current.body, text: `${current.body.text}${entry.body.text}` }
    };
  }

  return null;
}

function shouldIgnoreDeletedOrInterruptedTurnEvent(
  state: ThreadState | undefined,
  event: { kind: string; turnId?: unknown }
): boolean {
  const turnId = typeof event.turnId === "string" ? event.turnId : null;
  if (
    !turnId ||
    (!state?.interruptedTurnIds.has(turnId) && !state?.deletedTurnIds.has(turnId))
  ) {
    return false;
  }

  return isVisibleTimelineEvent(event.kind);
}

function isVisibleTimelineEvent(kind: string): boolean {
  return new Set([
    "agent_message_delta",
    "reasoning_delta",
    "reasoning_started",
    "plan_delta",
    "plan.delta",
    "command_output_delta",
    "file_output_delta",
    "tool_output_delta",
    "turn_diff_updated",
    "item.appended",
    "item.updated",
    "item_updated"
  ]).has(kind);
}

function hasVisibleServerOutputForTurn(entries: TimelineEntry[], turnId: string): boolean {
  return entries.some((entry) => {
    if (entry.turnId !== turnId) {
      return false;
    }
    switch (entry.body.kind) {
      case "agent-message":
        return entry.body.text.trim().length > 0;
      case "reasoning":
        return entry.body.text.trim().length > 0;
      case "tool":
        return Boolean((entry.body.result ?? entry.body.arguments ?? entry.body.tool).trim());
      case "command":
        return Boolean((entry.body.output ?? entry.body.command).trim());
      case "diff":
      case "error":
        return true;
      default:
        return false;
    }
  });
}

function shouldIgnoreStaleItemRevision(
  state: ThreadState | undefined,
  itemId: string,
  generation: number | null,
  revision: unknown
): boolean {
  if (typeof revision !== "number") {
    return false;
  }
  const currentRevision = state?.itemRevisions.get(itemRevisionKey(itemId, generation));
  return typeof currentRevision === "number" && revision <= currentRevision;
}

function itemRevisionKey(itemId: string, generation: number | null): string {
  return `${generation ?? "legacy"}\u0000${itemId}`;
}

function mergeReplacementEntry(current: TimelineEntry, next: TimelineEntry): TimelineEntry {
  if (current.body.kind === "user-message" && next.body.kind === "user-message") {
    return {
      ...next,
      createdAt: current.createdAt,
      turnId: next.turnId ?? current.turnId,
      turnIndex: next.turnIndex ?? current.turnIndex,
      clientUserMessageId: next.clientUserMessageId ?? current.clientUserMessageId ?? current.id,
      generation: next.generation ?? current.generation,
      body: {
        ...next.body,
        imagePaths: next.body.imagePaths ?? current.body.imagePaths,
        skillReferences: next.body.skillReferences ?? current.body.skillReferences,
        status: next.body.status ?? "sent"
      }
    };
  }

  if (
    current.body.kind === "reasoning" &&
    next.body.kind === "reasoning" &&
    current.body.text.trim() &&
    !next.body.text.trim()
  ) {
    return {
      ...replacementEntryWithStablePosition(current, next),
      body: { ...next.body, text: current.body.text }
    };
  }

  if (
    current.body.kind === "tool" &&
    next.body.kind === "tool" &&
    (current.body.result ?? "").trim() &&
    !(next.body.result ?? "").trim()
  ) {
    return {
      ...replacementEntryWithStablePosition(current, next),
      body: { ...next.body, result: current.body.result }
    };
  }

  return replacementEntryWithStablePosition(current, next);
}

function replacementEntryWithStablePosition(current: TimelineEntry, next: TimelineEntry): TimelineEntry {
  return {
    ...next,
    createdAt: current.createdAt,
    ...(!next.turnId && current.turnId ? { turnId: current.turnId } : {}),
    ...(typeof next.turnIndex !== "number" && typeof current.turnIndex === "number" ? { turnIndex: current.turnIndex } : {}),
    ...(!next.clientUserMessageId && current.clientUserMessageId
      ? { clientUserMessageId: current.clientUserMessageId }
      : {}),
    ...(typeof next.generation !== "number" && typeof current.generation === "number" ? { generation: current.generation } : {}),
    ...(typeof next.snapshotSequence !== "number" && typeof current.snapshotSequence === "number"
      ? { snapshotSequence: current.snapshotSequence }
      : {})
  };
}

function completedActivityEntryBeforeFinalAssistant(entries: TimelineEntry[], entry: TimelineEntry): TimelineEntry {
  if (!entry.turnId || !isCompletedInlineActivityEntry(entry)) {
    return entry;
  }

  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const current = entries[index];
    if (!current || current.turnId !== entry.turnId) {
      continue;
    }
    if (current.body.kind !== "agent-message") {
      continue;
    }
    if (entry.createdAt < current.createdAt) {
      return entry;
    }
    return {
      ...entry,
      createdAt: current.createdAt - 0.001
    };
  }
  return entry;
}

function isCompletedInlineActivityEntry(entry: TimelineEntry): boolean {
  switch (entry.body.kind) {
    case "reasoning":
      return entry.body.done !== false;
    case "tool":
      return entry.body.status !== "running";
    case "command":
      return entry.body.status !== "running";
    case "diff":
      return true;
    default:
      return false;
  }
}

function findEquivalentOutputIndex(entries: TimelineEntry[], entry: TimelineEntry): number {
  if (!isMergeableOutputEntry(entry)) {
    return -1;
  }
  timelineDiagnostics.equivalentOutputCandidateChecks += entries.length;
  return entries.findIndex((candidate) => areEquivalentOutputEntries(candidate, entry));
}

function mergeEquivalentOutputEntries(entries: TimelineEntry[]): TimelineEntry[] {
  const merged: TimelineEntry[] = [];
  const mergeableIndexesByBucket = new Map<string, number[]>();
  for (const entry of entries) {
    const bucketKey = equivalentOutputBucketKey(entry);
    const candidateIndexes = bucketKey ? (mergeableIndexesByBucket.get(bucketKey) ?? []) : [];
    timelineDiagnostics.equivalentOutputCandidateChecks += candidateIndexes.length;
    const existingIndex = candidateIndexes.find((index) => {
      const candidate = merged[index];
      return candidate ? areEquivalentOutputEntries(candidate, entry) : false;
    }) ?? -1;
    if (existingIndex < 0) {
      merged.push(entry);
      if (bucketKey) {
        candidateIndexes.push(merged.length - 1);
        mergeableIndexesByBucket.set(bucketKey, candidateIndexes);
      }
      continue;
    }
    merged[existingIndex] = mergeEquivalentOutputEntry(merged[existingIndex]!, entry);
  }
  return merged;
}

function equivalentOutputBucketKey(entry: TimelineEntry): string | null {
  if (!isMergeableOutputEntry(entry) || !entry.turnId) {
    return null;
  }
  if (entry.body.kind === "tool") {
    return [
      entry.turnId,
      entry.body.kind,
      entry.body.toolKind ?? "",
      entry.body.server,
      entry.body.tool
    ].join("\u0001");
  }
  return `${entry.turnId}\u0001${entry.body.kind}`;
}

function mergeEquivalentOutputEntry(current: TimelineEntry, next: TimelineEntry): TimelineEntry {
  if (!areEquivalentOutputEntries(current, next)) {
    return next;
  }

  if (current.body.kind === "reasoning" && next.body.kind === "reasoning") {
    const useNext = next.body.done || next.body.text.length >= current.body.text.length;
    const base = useNext ? next : current;
    const other = useNext ? current : next;
    const baseBody = useNext ? next.body : current.body;
    return {
      ...base,
      createdAt: Math.min(current.createdAt, next.createdAt),
      turnId: base.turnId ?? other.turnId,
      turnIndex: base.turnIndex ?? other.turnIndex,
      generation: base.generation ?? other.generation,
      snapshotSequence: base.snapshotSequence ?? other.snapshotSequence,
      body: {
        ...baseBody,
        text: longerText(current.body.text, next.body.text),
        done: current.body.done || next.body.done
      }
    };
  }

  if (current.body.kind === "agent-message" && next.body.kind === "agent-message") {
    const useNext = next.body.text.length >= current.body.text.length;
    const base = useNext ? next : current;
    const other = useNext ? current : next;
    const baseBody = useNext ? next.body : current.body;
    return {
      ...base,
      createdAt: Math.min(current.createdAt, next.createdAt),
      turnId: base.turnId ?? other.turnId,
      turnIndex: base.turnIndex ?? other.turnIndex,
      generation: base.generation ?? other.generation,
      snapshotSequence: base.snapshotSequence ?? other.snapshotSequence,
      body: { ...baseBody, text: longerText(current.body.text, next.body.text) }
    };
  }

  if (current.body.kind === "tool" && next.body.kind === "tool") {
    const currentFinal = current.body.status === "success" || current.body.status === "failed";
    const nextFinal = next.body.status === "success" || next.body.status === "failed";
    const useNext = (nextFinal && !currentFinal) || (next.body.result ?? "").length >= (current.body.result ?? "").length;
    const base = useNext ? next : current;
    const other = useNext ? current : next;
    const baseBody = useNext ? next.body : current.body;
    const otherBody = useNext ? current.body : next.body;
    return {
      ...base,
      createdAt: Math.min(current.createdAt, next.createdAt),
      turnId: base.turnId ?? other.turnId,
      turnIndex: base.turnIndex ?? other.turnIndex,
      generation: base.generation ?? other.generation,
      snapshotSequence: base.snapshotSequence ?? other.snapshotSequence,
      body: {
        ...baseBody,
        actionKind: baseBody.actionKind ?? otherBody.actionKind,
        arguments: baseBody.arguments ?? otherBody.arguments,
        result: longerText(current.body.result ?? "", next.body.result ?? "") || undefined,
        imagePaths: baseBody.imagePaths ?? otherBody.imagePaths
      }
    };
  }

  return next;
}

function areEquivalentOutputEntries(left: TimelineEntry, right: TimelineEntry): boolean {
  if (!isMergeableOutputEntry(left) || !isMergeableOutputEntry(right)) {
    return false;
  }
  if (!left.turnId || !right.turnId || left.turnId !== right.turnId) {
    return false;
  }
  if (left.body.kind !== right.body.kind) {
    return false;
  }

  if (left.body.kind === "tool" && right.body.kind === "tool") {
    return (
      left.body.toolKind === right.body.toolKind &&
      left.body.server === right.body.server &&
      left.body.tool === right.body.tool &&
      equivalentText(left.body.result ?? "", right.body.result ?? "")
    );
  }

  return equivalentText(deltaComparableText(left), deltaComparableText(right));
}

function isMergeableOutputEntry(entry: TimelineEntry): boolean {
  return Boolean(
    entry.turnId &&
      (entry.body.kind === "agent-message" || entry.body.kind === "reasoning" || entry.body.kind === "tool") &&
      deltaComparableText(entry).trim()
  );
}

function equivalentText(left: string, right: string): boolean {
  const a = left.trim();
  const b = right.trim();
  return Boolean(a && b && (a === b || a.includes(b) || b.includes(a)));
}

function longerText(left: string, right: string): string {
  return right.length > left.length ? right : left;
}

function findConfirmableLocalUserIndex(state: ThreadState, entry: TimelineEntry): number {
  if (entry.body.kind !== "user-message") {
    return -1;
  }

  if (entry.clientUserMessageId) {
    const byClientId = state.entries.findIndex(
      (candidate) => candidate.id === entry.clientUserMessageId && isLocalPendingUserMessage(candidate)
    );
    if (byClientId >= 0) {
      return byClientId;
    }
  }

  if (entry.turnId) {
    const localId = state.localUserMessageIdsByTurn.get(entry.turnId);
    if (localId) {
      const byTurnMap = state.entries.findIndex(
        (candidate) => candidate.id === localId && isLocalPendingUserMessage(candidate)
      );
      if (byTurnMap >= 0) {
        return byTurnMap;
      }
    }

    const sameTurnCandidates = state.entries
      .map((candidate, index) => ({ candidate, index }))
      .filter(({ candidate }) => isLocalPendingUserMessage(candidate) && candidate.turnId === entry.turnId);
    if (sameTurnCandidates.length === 1) {
      return sameTurnCandidates[0]!.index;
    }
  }

  const key = userMessageKey(entry);
  if (!key) {
    return -1;
  }
  const fallbackCandidates = state.entries
    .map((candidate, index) => ({ candidate, index }))
    .filter(({ candidate }) => isUnboundSendingLocalUserMessage(candidate) && userMessageKey(candidate) === key);
  return fallbackCandidates.length === 1 ? fallbackCandidates[0]!.index : -1;
}

function replaceConfirmedLocalUserMessagesInPlace(entries: TimelineEntry[]): TimelineEntry[] {
  const usedServerIndexes = new Set<number>();
  const next = entries.map((entry, index) => {
    if (!isLocalPendingUserMessage(entry)) {
      return entry;
    }

    const serverIndex = entries.findIndex((candidate, candidateIndex) => {
      if (candidateIndex <= index || usedServerIndexes.has(candidateIndex)) {
        return false;
      }
      if (candidate.id.startsWith("local-user-") || candidate.body.kind !== "user-message") {
        return false;
      }
      if (candidate.clientUserMessageId && candidate.clientUserMessageId === entry.id) {
        return true;
      }
      if (candidate.turnId && entry.turnId && candidate.turnId === entry.turnId) {
        return true;
      }
      const key = userMessageKey(entry);
      if (!key || !isUnboundSendingLocalUserMessage(entry)) {
        return false;
      }
      const fallbackCandidateCount = entries.filter(
        (local) => isUnboundSendingLocalUserMessage(local) && userMessageKey(local) === key
      ).length;
      return fallbackCandidateCount === 1 && userMessageKey(candidate) === key;
    });

    if (serverIndex < 0) {
      return entry;
    }

    usedServerIndexes.add(serverIndex);
    return mergeReplacementEntry(entry, entries[serverIndex]);
  });

  return next.filter((_entry, index) => !usedServerIndexes.has(index));
}

function removeDuplicateConfirmedUserMessages(entries: TimelineEntry[]): TimelineEntry[] {
  const seen = new Set<string>();
  return entries.filter((entry) => {
    if (entry.body.kind !== "user-message" || entry.id.startsWith("local-user-")) {
      return true;
    }
    const key = userMessageIdentityKey(entry);
    if (!key) {
      return true;
    }
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function orderTimelineEntries(entries: TimelineEntry[]): TimelineEntry[] {
  const turnOrder = new Map<string, number>();
  let nextTurnOrder = 0;
  entries.forEach((entry) => {
    if (!entry.turnId || turnOrder.has(entry.turnId)) {
      return;
    }
    turnOrder.set(entry.turnId, nextTurnOrder);
    nextTurnOrder += 1;
  });

  return entries
    .map((entry, index) => ({ entry, index }))
    .sort((left, right) => {
      const leftTurn = left.entry.turnId ? turnOrder.get(left.entry.turnId) : undefined;
      const rightTurn = right.entry.turnId ? turnOrder.get(right.entry.turnId) : undefined;
      if (typeof leftTurn === "number" && typeof rightTurn === "number" && leftTurn !== rightTurn) {
        return leftTurn - rightTurn;
      }
      if (left.entry.turnId && right.entry.turnId && left.entry.turnId === right.entry.turnId) {
        const leftPhase = timelineEntryOrderPhase(left.entry);
        const rightPhase = timelineEntryOrderPhase(right.entry);
        if (leftPhase !== rightPhase) {
          return leftPhase - rightPhase;
        }
        if (left.entry.createdAt !== right.entry.createdAt) {
          return left.entry.createdAt - right.entry.createdAt;
        }
      }

      return left.index - right.index;
    })
    .map(({ entry }) => entry);
}

function timelineEntryOrderPhase(entry: TimelineEntry): number {
  if (entry.body.kind === "user-message") {
    return 0;
  }
  return 1;
}

function removeConfirmedLocalUserMessages(entries: TimelineEntry[]): TimelineEntry[] {
  return entries.filter((entry, index) => {
    if (!isLocalPendingUserMessage(entry)) {
      return true;
    }

    const key = userMessageKey(entry);
    return !entries.slice(index + 1).some((candidate) => {
      return !candidate.id.startsWith("local-user-") && userMessageKey(candidate) === key;
    });
  });
}

function removeDuplicateLocalUserMessages(entries: TimelineEntry[]): TimelineEntry[] {
  const seen = new Set<string>();
  return entries.filter((entry) => {
    if (!isLocalPendingUserMessage(entry)) {
      return true;
    }
    if (entry.body.kind !== "user-message" || entry.turnId || entry.body.status === "sent") {
      return true;
    }

    const key = userMessageKey(entry);
    if (!key) {
      return true;
    }
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function removeAdjacentDuplicateUserMessages(entries: TimelineEntry[]): TimelineEntry[] {
  const next: TimelineEntry[] = [];
  let previousUserKey: string | null = null;

  for (const entry of entries) {
    const key = isNonFailedUserMessage(entry) ? userMessageIdentityKey(entry) : null;
    if (key && previousUserKey === key) {
      const previous = next[next.length - 1];
      if (previous && isLocalPendingUserMessage(previous) && !entry.id.startsWith("local-user-")) {
        next[next.length - 1] = entry;
      }
      continue;
    }

    next.push(entry);
    previousUserKey = key;
  }

  return next;
}

function isLocalPendingUserMessage(entry: TimelineEntry): boolean {
  return (
    entry.id.startsWith("local-user-") &&
    entry.body.kind === "user-message" &&
    entry.body.status !== "failed"
  );
}

function isUnboundSendingLocalUserMessage(entry: TimelineEntry): boolean {
  return (
    entry.id.startsWith("local-user-") &&
    !entry.turnId &&
    entry.body.kind === "user-message" &&
    entry.body.status === "sending"
  );
}

function isNonFailedUserMessage(entry: TimelineEntry): boolean {
  return entry.body.kind === "user-message" && entry.body.status !== "failed";
}

function userMessageKey(entry: TimelineEntry): string | null {
  if (entry.body.kind !== "user-message") {
    return null;
  }

  const imagePaths = [...(entry.body.imagePaths ?? [])].sort().join("\u0000");
  const skills = [...(entry.body.skillReferences ?? [])]
    .map((skill) => `${skill.name}\u0000${skill.path}`)
    .sort()
    .join("\u0000");
  return `${entry.body.text.trim()}\u0001${imagePaths}\u0001${skills}`;
}

function userMessageIdentityKey(entry: TimelineEntry): string | null {
  if (entry.body.kind !== "user-message") {
    return null;
  }
  if (entry.turnId) {
    return `turn:${entry.turnId}`;
  }
  if (entry.clientUserMessageId) {
    return `client:${entry.clientUserMessageId}`;
  }
  return null;
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
