"use client";

import { create } from "zustand";
import type { AppServerStatus, ChatMode, PendingServerRequest, TimelineItem } from "../api/types";
import { timelineItemToEntry, type TimelineEntry } from "./timeline";
import type { WsEvent, WsConnectionState } from "../ws/client";

export type { WsConnectionState };

export type ThreadState = {
  entries: TimelineEntry[];
  pendingApprovals: PendingServerRequest[];
  resolvedApprovals: Set<string>;
  running: boolean;
  cursor: string | null;
  reachedBeginning: boolean;
  plan: Array<{ text: string; completed: boolean }>;
  mode: ChatMode;
  model: string | null;
  modelEffort: string | null;
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
  prependEntries: (
    threadId: string,
    entries: TimelineEntry[],
    cursor: string | null,
    reachedBeginning: boolean
  ) => void;
  appendEntries: (threadId: string, entries: TimelineEntry[]) => void;
  replaceOrAddEntry: (threadId: string, entry: TimelineEntry) => void;
  appendTextToEntry: (threadId: string, entry: TimelineEntry) => void;
  setRunning: (threadId: string, running: boolean) => void;
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
  running: false,
  cursor: null,
  reachedBeginning: false,
  plan: [],
  mode: "build",
  model: null,
  modelEffort: null,
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
      return {
        threads: {
          ...state.threads,
          [threadId]: {
            ...prev,
            entries,
            cursor,
            reachedBeginning: cursor === null,
            lastSeenItemId: entries.length ? entries[entries.length - 1].id : prev.lastSeenItemId
          }
        }
      };
    }),
  prependEntries: (threadId, entries, cursor, reachedBeginning) =>
    set((state) => {
      const prev = state.threads[threadId] ?? emptyThread();
      return {
        threads: {
          ...state.threads,
          [threadId]: { ...prev, entries: [...entries, ...prev.entries], cursor, reachedBeginning }
        }
      };
    }),
  appendEntries: (threadId, entries) =>
    set((state) => {
      const prev = state.threads[threadId] ?? emptyThread();
      const last = entries.length ? entries[entries.length - 1].id : prev.lastSeenItemId;
      return {
        threads: {
          ...state.threads,
          [threadId]: { ...prev, entries: [...prev.entries, ...entries], lastSeenItemId: last }
        }
      };
    }),
  replaceOrAddEntry: (threadId, entry) =>
    set((state) => {
      const prev = state.threads[threadId] ?? emptyThread();
      const idx = prev.entries.findIndex((e) => e.id === entry.id);
      const nextEntries =
        idx >= 0
          ? prev.entries.map((e, i) => (i === idx ? entry : e))
          : [...prev.entries, entry];
      return {
        threads: { ...state.threads, [threadId]: { ...prev, entries: nextEntries, lastSeenItemId: entry.id } }
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
                  body: { ...current.body, text: `${current.body.text}${entry.body.text}` }
                };
              }
              if (current.body.kind === "tool" && entry.body.kind === "tool") {
                return {
                  ...current,
                  body: {
                    ...current.body,
                    result: `${current.body.result ?? ""}${entry.body.result ?? ""}`,
                    status: entry.body.status
                  }
                };
              }
              return entry;
            })
          : [...prev.entries, entry];
      return {
        threads: { ...state.threads, [threadId]: { ...prev, entries: nextEntries, lastSeenItemId: entry.id } }
      };
    }),
  setRunning: (threadId, running) =>
    set((state) => {
      const prev = state.threads[threadId] ?? emptyThread();
      return { threads: { ...state.threads, [threadId]: { ...prev, running } } };
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
      const prev = state.threads[threadId] ?? emptyThread();
      if (prev.pendingApprovals.some((r) => r.requestId === req.requestId)) return state;
      return {
        threads: {
          ...state.threads,
          [threadId]: { ...prev, pendingApprovals: [...prev.pendingApprovals, req] }
        }
      };
    }),
  setPendingRequests: (reqs) =>
    set((state) => {
      const byThread = new Map<string, PendingServerRequest[]>();
      for (const r of reqs) {
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
    if (event.type === "codex-event") {
      const ev = event.event as { kind: string; threadId?: string; [k: string]: unknown };
      const threadId = ev.threadId;
      if (!threadId) return;
      get().ensureThread(threadId);
      switch (ev.kind) {
        case "turn.started":
        case "turn_started":
          get().setRunning(threadId, true);
          break;
        case "turn.completed":
        case "turn.failed":
        case "turn.canceled":
        case "turn_completed":
        case "turn_failed":
        case "turn_interrupted":
          get().setRunning(threadId, false);
          break;
        case "plan.delta": {
          const plan = (ev.plan as Array<{ text: string; completed: boolean }>) ?? [];
          get().setPlan(threadId, plan);
          break;
        }
        case "agent_message_delta": {
          const itemId = typeof ev.itemId === "string" ? ev.itemId : `${threadId}-agent-live`;
          const delta = typeof ev.delta === "string" ? ev.delta : "";
          if (delta) {
            get().appendTextToEntry(threadId, {
              id: itemId,
              createdAt: Date.now(),
              body: { kind: "agent-message", text: delta }
            });
          }
          break;
        }
        case "reasoning_delta": {
          const itemId = typeof ev.itemId === "string" ? ev.itemId : `${threadId}-reasoning-live`;
          const delta = typeof ev.delta === "string" ? ev.delta : "";
          if (delta) {
            get().appendTextToEntry(threadId, {
              id: itemId,
              createdAt: Date.now(),
              body: { kind: "reasoning", text: delta, done: false }
            });
          }
          break;
        }
        case "command_output_delta":
        case "file_output_delta": {
          const itemId = typeof ev.itemId === "string" ? ev.itemId : `${threadId}-${ev.kind}`;
          const delta = typeof ev.delta === "string" ? ev.delta : "";
          if (delta) {
            get().appendTextToEntry(threadId, {
              id: itemId,
              createdAt: Date.now(),
              body: {
                kind: "tool",
                server: ev.kind === "command_output_delta" ? "command" : "file",
                tool: ev.kind === "command_output_delta" ? "command" : "file",
                status: "running",
                result: delta
              }
            });
          }
          break;
        }
        case "turn_diff_updated": {
          const diff = typeof ev.diff === "string" ? ev.diff : "";
          get().replaceOrAddEntry(threadId, {
            id: `${ev.turnId ?? threadId}-diff`,
            createdAt: Date.now(),
            body: {
              kind: "diff",
              path: "工作区变更",
              added: 0,
              removed: 0,
              diff
            }
          });
          break;
        }
        case "context_compacted": {
          const turnId = typeof ev.turnId === "string" ? ev.turnId : threadId;
          get().replaceOrAddEntry(threadId, {
            id: `${turnId}-context-compacted`,
            createdAt: Date.now(),
            body: { kind: "system", text: "压缩上下文已完成" }
          });
          break;
        }
        case "warning": {
          const message = typeof ev.message === "string" ? ev.message : "发生错误";
          get().replaceOrAddEntry(threadId, {
            id: `${threadId}-warning-${Date.now()}`,
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
            get().replaceOrAddEntry(threadId, timelineItemToEntry(item, createdAt));
          }
          break;
        }
        default:
          break;
      }
      return;
    }
    if (event.type === "server-request") {
      const req = event.request as PendingServerRequest;
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

export const useAppStore = useStore;
