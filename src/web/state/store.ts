"use client";

import { create } from "zustand";
import type { AppServerStatus, ChatMode, PendingServerRequest, TimelineItem } from "../api/types";
import { diffEntryFromText, timelineItemToEntry, type TimelineEntry, type ToolEntry } from "./timeline";
import type { WsEvent, WsConnectionState } from "../ws/client";

export type { WsConnectionState };

const MAX_PROCESSED_EVENT_IDS = 2_000;

export type ThreadState = {
  entries: TimelineEntry[];
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
  activeTurnId: string | null;
  lastSeenItemId: string | null;
};

type State = {
  wsState: WsConnectionState | "idle";
  appServer: AppServerStatus | null;
  threads: Record<string, ThreadState>;
  activeThreadId: string | null;
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
  setPlan: (threadId: string, plan: Array<{ text: string; completed: boolean }>) => void;
  addApproval: (threadId: string, req: PendingServerRequest) => void;
  setPendingRequests: (reqs: PendingServerRequest[]) => void;
  resolvePendingRequest: (requestId: string) => void;
  dispatchEvent: (event: WsEvent) => void;
  reset: (threadId: string) => void;
};

export const emptyThread = (init?: Partial<ThreadState>): ThreadState => ({
  entries: [],
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
  activeTurnId: null,
  lastSeenItemId: null,
  ...init
});

export const useStore = create<State & Actions>((set, get) => ({
  wsState: "idle",
  appServer: null,
  threads: {},
  activeThreadId: null,
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
          [threadId]: {
            ...prev,
            entries: nextEntries,
            cursor,
            reachedBeginning: cursor === null,
            timelineGeneration,
            processedEventIds: trimStringSet(prev.processedEventIds, MAX_PROCESSED_EVENT_IDS),
            itemRevisions: itemRevisionsFromEntries(nextEntries, prev.itemRevisions),
            snapshotDeltaSuppressions: snapshotDeltaSuppressions(nextEntries),
            localUserMessageIdsByTurn: localUserMessageIdsByTurnFromEntries(nextEntries),
            lastSeenItemId: nextEntries.length ? nextEntries[nextEntries.length - 1].id : prev.lastSeenItemId
          }
        }
      };
    }),
  mergeThreadEntries: (threadId, entries, cursor) =>
    set((state) => {
      const prev = state.threads[threadId] ?? emptyThread();
      const nextEntries = mergeTimelineEntries(prev.entries, entries);
      const timelineGeneration = Math.max(prev.timelineGeneration, maxEntryGeneration(entries));
      return {
        threads: {
          ...state.threads,
          [threadId]: {
            ...prev,
            entries: nextEntries,
            cursor,
            reachedBeginning: cursor === null,
            timelineGeneration,
            localUserMessageIdsByTurn: localUserMessageIdsByTurnFromEntries(nextEntries, prev.localUserMessageIdsByTurn),
            lastSeenItemId: nextEntries.length ? nextEntries[nextEntries.length - 1].id : prev.lastSeenItemId
          }
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
          [threadId]: { ...prev, entries: nextEntries, cursor, reachedBeginning }
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
          [threadId]: { ...prev, entries: nextEntries, lastSeenItemId: last }
        }
      };
    }),
  replaceOrAddEntry: (threadId, entry) =>
    set((state) => {
      const prev = state.threads[threadId] ?? emptyThread();
      const idx = prev.entries.findIndex((e) => e.id === entry.id);
      const equivalentOutputIndex = idx >= 0 ? -1 : findEquivalentOutputIndex(prev.entries, entry);
      const confirmedLocalIndex = idx >= 0 || equivalentOutputIndex >= 0 ? -1 : findConfirmableLocalUserIndex(prev, entry);
      const nextEntries =
        idx >= 0
          ? prev.entries.map((current, i) => (i === idx ? mergeReplacementEntry(current, entry) : current))
          : equivalentOutputIndex >= 0
            ? prev.entries.map((current, i) => (i === equivalentOutputIndex ? mergeEquivalentOutputEntry(current, entry) : current))
          : confirmedLocalIndex >= 0
            ? prev.entries.map((current, i) => (i === confirmedLocalIndex ? mergeReplacementEntry(current, entry) : current))
          : [...prev.entries, entry];
      const normalizedEntries = normalizeTimelineEntries(nextEntries);
      return {
        threads: {
          ...state.threads,
          [threadId]: {
            ...prev,
            entries: normalizedEntries,
            timelineGeneration: Math.max(prev.timelineGeneration, entry.generation ?? 0),
            localUserMessageIdsByTurn: localUserMessageIdsByTurnFromEntries(
              normalizedEntries,
              prev.localUserMessageIdsByTurn
            ),
            lastSeenItemId: entry.id
          }
        }
      };
    }),
  appendTextToEntry: (threadId, entry) =>
    set((state) => {
      const prev = state.threads[threadId] ?? emptyThread();
      const idx = prev.entries.findIndex((e) => e.id === entry.id);
      const nextEntries =
        idx >= 0
          ? prev.entries.map((current, i) => {
              if (i !== idx || current.body.kind !== entry.body.kind) {
                return current;
              }
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
              return entry;
            })
          : [...prev.entries, entry];
      const normalizedEntries = normalizeTimelineEntries(nextEntries);
      return {
        threads: {
          ...state.threads,
          [threadId]: {
            ...prev,
            entries: normalizedEntries,
            timelineGeneration: Math.max(prev.timelineGeneration, entry.generation ?? 0),
            lastSeenItemId: entry.id
          }
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
      const existingIndex = prev.entries.findIndex((current) => current.id === itemId);
      const pendingIndex = prev.entries.findIndex((current) => current.id === pendingId);
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
          [threadId]: {
            ...prev,
            entries: normalizeTimelineEntries(nextEntries),
            lastSeenItemId: itemId
          }
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
      const existingIndex = prev.entries.findIndex((current) => current.id === itemId);
      const pendingIndex = prev.entries.findIndex((current) => current.id === pendingId);
      const nextEntries =
        existingIndex >= 0
          ? prev.entries.map((current, index) => {
              if (index !== existingIndex || current.body.kind !== "reasoning") {
                return current;
              }
              return {
                ...current,
                ...(turnId && !current.turnId ? { turnId } : {}),
                body: { ...current.body, text: `${current.body.text}${delta}` }
              };
            })
          : pendingIndex >= 0
            ? prev.entries.map((current, index) => (index === pendingIndex ? deltaEntry : current))
            : [...prev.entries, deltaEntry];

      return {
        threads: {
          ...state.threads,
          [threadId]: {
            ...prev,
            entries: normalizeTimelineEntries(nextEntries),
            lastSeenItemId: itemId
          }
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
          [threadId]: { ...prev, entries: normalizeTimelineEntries(nextEntries) }
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
          [threadId]: {
            ...prev,
            entries: normalizeTimelineEntries(entries),
            localUserMessageIdsByTurn
          }
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
    if (event.type === "codex-event") {
      const ev = event.event as { kind: string; threadId?: string; [k: string]: unknown };
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
        set((state) => {
          const prev = state.threads[threadId] ?? emptyThread();
          const processedEventIds = new Set(prev.processedEventIds);
          processedEventIds.add(eventId);
          trimStringSetInPlace(processedEventIds, MAX_PROCESSED_EVENT_IDS);
          return {
            threads: {
              ...state.threads,
              [threadId]: { ...prev, processedEventIds }
            }
          };
        });
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
  },
  reset: (threadId) =>
    set((state) => {
      const next = { ...state.threads };
      delete next[threadId];
      return { threads: next };
    })
}));

function mergeTimelineEntries(current: TimelineEntry[], snapshot: TimelineEntry[]): TimelineEntry[] {
  if (!current.length) {
    return normalizeTimelineEntries(snapshot);
  }

  const snapshotById = new Map(snapshot.map((entry) => [entry.id, entry]));
  const usedSnapshotIds = new Set<string>();
  const merged: TimelineEntry[] = [];
  for (const entry of current) {
    const snapshotEntry = snapshotById.get(entry.id);
    if (!snapshotEntry) {
      merged.push(entry);
      continue;
    }
    usedSnapshotIds.add(entry.id);
    merged.push(shouldReplaceLiveEntry(entry, snapshotEntry) ? snapshotEntry : entry);
  }

  for (const entry of snapshot) {
    if (!usedSnapshotIds.has(entry.id)) {
      merged.push(entry);
    }
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
  useStore.setState((current) => {
    const prev = current.threads[threadId] ?? emptyThread();
    const snapshotDeltaSuppressions = new Map(prev.snapshotDeltaSuppressions);
    if (nextOffset >= suppression.text.length) {
      snapshotDeltaSuppressions.delete(itemId);
    } else {
      snapshotDeltaSuppressions.set(itemId, { ...suppression, offset: nextOffset });
    }
    return {
      threads: {
        ...current.threads,
        [threadId]: { ...prev, snapshotDeltaSuppressions }
      }
    };
  });
  return true;
}

function removeSnapshotDeltaSuppression(threadId: string, itemId: string): void {
  useStore.setState((state) => {
    const prev = state.threads[threadId] ?? emptyThread();
    if (!prev.snapshotDeltaSuppressions.has(itemId)) {
      return state;
    }
    const snapshotDeltaSuppressions = new Map(prev.snapshotDeltaSuppressions);
    snapshotDeltaSuppressions.delete(itemId);
    return {
      threads: {
        ...state.threads,
        [threadId]: { ...prev, snapshotDeltaSuppressions }
      }
    };
  });
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
      body: { ...next.body, status: next.body.status ?? "sent" }
    };
  }

  if (
    current.body.kind === "reasoning" &&
    next.body.kind === "reasoning" &&
    current.body.text.trim() &&
    !next.body.text.trim()
  ) {
    return {
      ...next,
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
      ...next,
      body: { ...next.body, result: current.body.result }
    };
  }

  return next;
}

function findEquivalentOutputIndex(entries: TimelineEntry[], entry: TimelineEntry): number {
  if (!isMergeableOutputEntry(entry)) {
    return -1;
  }
  return entries.findIndex((candidate) => areEquivalentOutputEntries(candidate, entry));
}

function mergeEquivalentOutputEntries(entries: TimelineEntry[]): TimelineEntry[] {
  const merged: TimelineEntry[] = [];
  for (const entry of entries) {
    const existingIndex = findEquivalentOutputIndex(merged, entry);
    if (existingIndex < 0) {
      merged.push(entry);
      continue;
    }
    merged[existingIndex] = mergeEquivalentOutputEntry(merged[existingIndex]!, entry);
  }
  return merged;
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

    const byTurn = state.entries.findIndex(
      (candidate) =>
        isLocalPendingUserMessage(candidate) &&
        candidate.turnId === entry.turnId &&
        userMessageKey(candidate) === userMessageKey(entry)
    );
    if (byTurn >= 0) {
      return byTurn;
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
        return userMessageKey(candidate) === userMessageKey(entry);
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
    if (!entry.turnId) {
      return true;
    }
    const key = `${entry.turnId}\u0002${userMessageKey(entry) ?? ""}`;
    if (!key.trim()) {
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
    turnOrder.set(entry.turnId, typeof entry.turnIndex === "number" ? entry.turnIndex : nextTurnOrder);
    nextTurnOrder += 1;
  });

  return entries
    .map((entry, index) => ({ entry, index }))
    .sort((left, right) => {
      if (left.entry.turnId && right.entry.turnId && left.entry.turnId === right.entry.turnId) {
        const rank = roleRank(left.entry) - roleRank(right.entry);
        if (rank !== 0) {
          return rank;
        }
      }

      const leftTurn = left.entry.turnId ? turnOrder.get(left.entry.turnId) : undefined;
      const rightTurn = right.entry.turnId ? turnOrder.get(right.entry.turnId) : undefined;
      if (typeof leftTurn === "number" && typeof rightTurn === "number" && leftTurn !== rightTurn) {
        return leftTurn - rightTurn;
      }

      return left.index - right.index;
    })
    .map(({ entry }) => entry);
}

function roleRank(entry: TimelineEntry): number {
  switch (entry.body.kind) {
    case "user-message":
      return 0;
    case "reasoning":
      return 1;
    case "tool":
    case "command":
      return 2;
    case "diff":
      return 3;
    case "agent-message":
      return 4;
    default:
      return 5;
  }
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
  return `${entry.body.text.trim()}\u0001${imagePaths}`;
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
