"use client";

import type { WsCodexEvent, WsConnectionState, WsEvent } from "../ws/client";

type Listener<T> = (event: T) => void;

export interface TimelineEventStreamOptions {
  url?: string;
  createSource?: (url: string) => EventSource;
  autoConnect?: boolean;
  maxPendingEvents?: number;
  batchWindowMs?: number;
}

const DEFAULT_MAX_PENDING_EVENTS = 200;
const DEFAULT_DELTA_BATCH_WINDOW_MS = 16;

export class TimelineEventStreamClient {
  private source: EventSource | null = null;
  private state: WsConnectionState = "closed";
  private closedByCaller = false;
  private readonly eventListeners = new Set<Listener<WsEvent>>();
  private readonly stateListeners = new Set<Listener<WsConnectionState>>();
  private pendingEvents: WsEvent[] = [];
  private readonly createSource: (url: string) => EventSource;
  private readonly maxPendingEvents: number;
  private readonly batchWindowMs: number;
  private readonly url: string;
  private readonly pendingDeltaBatches = new Map<string, { events: WsCodexEvent["event"][]; eventIds: Set<string> }>();
  private deltaBatchTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(options: TimelineEventStreamOptions = {}) {
    this.url = options.url ?? "/api/codex/events";
    this.createSource = options.createSource ?? ((url) => new EventSource(url));
    this.maxPendingEvents = options.maxPendingEvents ?? DEFAULT_MAX_PENDING_EVENTS;
    this.batchWindowMs = options.batchWindowMs ?? DEFAULT_DELTA_BATCH_WINDOW_MS;
    if (options.autoConnect !== false && typeof window !== "undefined") {
      this.connect();
    }
  }

  get connectionState(): WsConnectionState {
    return this.state;
  }

  connect(): void {
    if (this.source || this.state === "connecting") return;
    this.closedByCaller = false;
    this.setState("connecting");
    const source = this.createSource(this.url);
    this.source = source;
    source.addEventListener("open", this.handleOpen);
    source.addEventListener("message", this.handleMessage);
    source.addEventListener("error", this.handleError);
  }

  close(): void {
    this.closedByCaller = true;
    if (this.deltaBatchTimer) {
      clearTimeout(this.deltaBatchTimer);
      this.deltaBatchTimer = null;
    }
    this.pendingDeltaBatches.clear();
    if (this.source) {
      this.source.removeEventListener("open", this.handleOpen);
      this.source.removeEventListener("message", this.handleMessage);
      this.source.removeEventListener("error", this.handleError);
      this.source.close();
      this.source = null;
    }
    this.setState("closed");
  }

  onEvent(listener: Listener<WsEvent>): () => void {
    this.eventListeners.add(listener);
    this.flushDeltaBatches();
    this.flushPendingEvents();
    return () => this.eventListeners.delete(listener);
  }

  onState(listener: Listener<WsConnectionState>): () => void {
    this.stateListeners.add(listener);
    listener(this.state);
    return () => this.stateListeners.delete(listener);
  }

  private setState(next: WsConnectionState): void {
    if (this.state === next) return;
    this.state = next;
    for (const listener of this.stateListeners) {
      listener(next);
    }
  }

  private handleOpen = (): void => {
    this.setState("open");
  };

  private handleMessage = (message: MessageEvent): void => {
    let event: WsEvent;
    try {
      event = JSON.parse(typeof message.data === "string" ? message.data : "") as WsEvent;
    } catch {
      return;
    }
    if (this.bufferTextDeltaEvent(event)) {
      return;
    }
    if (isRepairBarrierEvent(event)) {
      this.dropPendingDeltaBatchesForThread(event.threadId);
    } else {
      this.flushDeltaBatches();
    }
    this.emitEvent(event);
  };

  private handleError = (): void => {
    if (this.closedByCaller) {
      this.setState("closed");
      return;
    }
    this.setState("reconnecting");
  };

  private emitEvent(event: WsEvent): void {
    if (!this.eventListeners.size) {
      this.bufferPendingEvent(event);
      return;
    }
    for (const listener of this.eventListeners) {
      listener(event);
    }
  }

  private bufferTextDeltaEvent(event: WsEvent): boolean {
    if (event.type !== "codex-event" || !isBatchableTextDelta(event.event)) {
      return false;
    }

    const key = deltaBatchKey(event.event);
    if (!key) {
      return false;
    }

    if (!this.eventListeners.size && this.pendingDeltaEventCount() >= this.maxPendingEvents) {
      this.clearPendingDeltaBatches();
      const gap = timelineGapForBufferedEvent(event);
      this.pendingEvents = gap ? [gap] : [event];
      return true;
    }

    const batch = this.pendingDeltaBatches.get(key) ?? { events: [], eventIds: new Set<string>() };
    if (typeof event.event.eventId === "string") {
      if (batch.eventIds.has(event.event.eventId)) {
        this.pendingDeltaBatches.set(key, batch);
        this.scheduleDeltaBatchFlush();
        return true;
      }
      batch.eventIds.add(event.event.eventId);
    }
    batch.events.push(event.event);
    this.pendingDeltaBatches.set(key, batch);
    this.scheduleDeltaBatchFlush();
    return true;
  }

  private scheduleDeltaBatchFlush(): void {
    if (this.deltaBatchTimer) {
      return;
    }
    this.deltaBatchTimer = setTimeout(() => this.flushDeltaBatches(), this.batchWindowMs);
  }

  private pendingDeltaEventCount(): number {
    let count = 0;
    for (const batch of this.pendingDeltaBatches.values()) {
      count += batch.events.length;
    }
    return count;
  }

  private clearPendingDeltaBatches(): void {
    if (this.deltaBatchTimer) {
      clearTimeout(this.deltaBatchTimer);
      this.deltaBatchTimer = null;
    }
    this.pendingDeltaBatches.clear();
  }

  private dropPendingDeltaBatchesForThread(threadId: string | null | undefined): void {
    if (!threadId) {
      return;
    }
    for (const [key, batch] of this.pendingDeltaBatches) {
      if (batch.events.some((event) => event.threadId === threadId)) {
        this.pendingDeltaBatches.delete(key);
      }
    }
    if (!this.pendingDeltaBatches.size && this.deltaBatchTimer) {
      clearTimeout(this.deltaBatchTimer);
      this.deltaBatchTimer = null;
    }
  }

  private flushDeltaBatches(): void {
    if (this.deltaBatchTimer) {
      clearTimeout(this.deltaBatchTimer);
      this.deltaBatchTimer = null;
    }
    if (!this.pendingDeltaBatches.size) {
      return;
    }

    const batches = [...this.pendingDeltaBatches.values()];
    this.pendingDeltaBatches.clear();
    for (const batch of batches) {
      if (batch.events.length === 1) {
        this.emitEvent({ type: "codex-event", event: batch.events[0]! });
      } else if (batch.events.length > 1) {
        this.emitEvent({ type: "codex-event-batch", events: batch.events });
      }
    }
  }

  private bufferPendingEvent(event: WsEvent): void {
    if (this.pendingEvents.length < this.maxPendingEvents) {
      this.pendingEvents.push(event);
      return;
    }

    const gap = timelineGapForBufferedEvent(event);
    this.pendingEvents = gap ? [gap] : [event];
  }

  private flushPendingEvents(): void {
    if (!this.pendingEvents.length || !this.eventListeners.size) {
      return;
    }

    const pending = this.pendingEvents;
    this.pendingEvents = [];
    for (const event of pending) {
      for (const listener of this.eventListeners) {
        listener(event);
      }
    }
  }
}

function isBatchableTextDelta(event: WsCodexEvent["event"]): boolean {
  if (
    event.kind !== "agent_message_delta" &&
    event.kind !== "reasoning_delta" &&
    event.kind !== "plan_delta" &&
    event.kind !== "command_output_delta" &&
    event.kind !== "file_output_delta" &&
    event.kind !== "tool_output_delta"
  ) {
    return false;
  }
  return typeof event.delta === "string" && event.delta.length > 0;
}

function deltaBatchKey(event: WsCodexEvent["event"]): string | null {
  const threadId = typeof event.threadId === "string" ? event.threadId : null;
  const turnId = typeof event.turnId === "string" ? event.turnId : "";
  const itemId = typeof event.itemId === "string" ? event.itemId : null;
  const generation = typeof event.generation === "number" ? String(event.generation) : "legacy";
  if (!threadId || !itemId) {
    return null;
  }
  return [threadId, turnId, itemId, event.kind, generation].join("\u0001");
}

function isRepairBarrierEvent(event: WsEvent): event is Extract<WsEvent, { type: "timeline-gap" }> {
  return event.type === "timeline-gap";
}

function timelineGapForBufferedEvent(event: WsEvent): WsEvent | null {
  if (event.type === "codex-event") {
    const threadId = typeof event.event.threadId === "string" ? event.event.threadId : null;
    if (!threadId) {
      return null;
    }
    const lastEventId = typeof event.event.eventId === "string" ? event.event.eventId : undefined;
    return {
      type: "timeline-gap",
      threadId,
      ...(lastEventId ? { lastEventId } : {})
    };
  }

  return null;
}

let singleton: TimelineEventStreamClient | null = null;

export function getTimelineEventStreamClient(): TimelineEventStreamClient {
  if (singleton) return singleton;
  if (typeof window === "undefined") {
    throw new Error("getTimelineEventStreamClient must be called in browser environment");
  }
  singleton = new TimelineEventStreamClient();
  return singleton;
}

export function resetTimelineEventStreamClient(): void {
  if (singleton) singleton.close();
  singleton = null;
}

export type BrowserEventStreamConnectOptions = {
  onState: (state: WsConnectionState) => void;
  onMessage: (event: WsEvent) => void;
};

export function connectBrowserEventStream(options: BrowserEventStreamConnectOptions): { close: () => void } {
  const client = getTimelineEventStreamClient();
  const unsubState = client.onState(options.onState);
  const unsubEvent = client.onEvent(options.onMessage);
  if (client.connectionState === "closed") {
    client.connect();
  }
  return {
    close: () => {
      unsubState();
      unsubEvent();
    }
  };
}
