"use client";

import type { WsCodexEvent, WsConnectionState, WsEvent } from "../ws/client";

type Listener<T> = (event: T) => void;
type ConnectionStateListener = (state: WsConnectionState, reconnectAttempt: number) => void;

const MAX_RECONNECT_ATTEMPTS = 5;

export interface TimelineEventStreamOptions {
  url?: string;
  createSource?: (url: string) => EventSource;
  autoConnect?: boolean;
  maxPendingEvents?: number;
  batchWindowMs?: number;
}

const DEFAULT_MAX_PENDING_EVENTS = 200;
const DEFAULT_DELTA_BATCH_WINDOW_MS = 16;

type PendingDelta = {
  threadId: string;
  event: WsCodexEvent["event"];
  eventId?: string;
  deliveryEpoch: number;
};

type PendingDelivery =
  | { kind: "event"; event: WsEvent }
  | { kind: "delta"; delta: PendingDelta };

export class TimelineEventStreamClient {
  private source: EventSource | null = null;
  private state: WsConnectionState = "closed";
  private closedByCaller = false;
  private readonly eventListeners = new Set<Listener<WsEvent>>();
  private readonly stateListeners = new Set<ConnectionStateListener>();
  private reconnectAttempt = 0;
  private pendingDeliveries: PendingDelivery[] = [];
  private readonly createSource: (url: string) => EventSource;
  private readonly maxPendingEvents: number;
  private readonly batchWindowMs: number;
  private readonly url: string;
  private readonly pendingDeltaEventIds = new Set<string>();
  private readonly deliveryEpochs = new Map<string, number>();
  private deltaBatchTimer: ReturnType<typeof setTimeout> | null = null;
  private drainingPendingEvents = false;
  private currentBootId: string | null = null;

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
    this.reconnectAttempt = 0;
    if (this.deltaBatchTimer) {
      clearTimeout(this.deltaBatchTimer);
      this.deltaBatchTimer = null;
    }
    this.pendingDeliveries = [];
    this.pendingDeltaEventIds.clear();
    this.currentBootId = null;
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
    return () => this.eventListeners.delete(listener);
  }

  onState(listener: ConnectionStateListener): () => void {
    this.stateListeners.add(listener);
    listener(this.state, this.reconnectAttempt);
    return () => this.stateListeners.delete(listener);
  }

  invalidateThread(threadId: string): number {
    const nextEpoch = (this.deliveryEpochs.get(threadId) ?? 0) + 1;
    this.deliveryEpochs.set(threadId, nextEpoch);
    this.pendingDeliveries = this.pendingDeliveries.flatMap((delivery) =>
      invalidatePendingDeliveryForThread(delivery, threadId)
    );
    this.rebuildPendingDeltaEventIds();
    if (!this.pendingDeliveries.some((delivery) => delivery.kind === "delta") && this.deltaBatchTimer) {
      clearTimeout(this.deltaBatchTimer);
      this.deltaBatchTimer = null;
    }
    return nextEpoch;
  }

  private setState(next: WsConnectionState, forceNotify = false): void {
    if (this.state === next && !forceNotify) return;
    this.state = next;
    for (const listener of this.stateListeners) {
      listener(next, this.reconnectAttempt);
    }
  }

  private handleOpen = (): void => {
    this.reconnectAttempt = 0;
    this.setState("open");
  };

  private handleMessage = (message: MessageEvent): void => {
    let event: WsEvent;
    try {
      event = JSON.parse(typeof message.data === "string" ? message.data : "") as WsEvent;
    } catch {
      return;
    }
    const bootId = timelineEventBootId(event);
    if (bootId) {
      if (this.currentBootId && this.currentBootId !== bootId) {
        this.currentBootId = bootId;
        this.clearPendingDeltaBatches();
        this.pendingDeliveries = this.pendingDeliveries.filter(
          (pending) => pending.kind === "event" && pending.event.type !== "codex-event" && pending.event.type !== "codex-event-batch"
        );
        if (event.type !== "timeline-gap") {
          this.emitEvent({ type: "timeline-gap", scope: "all-tracked", bootId });
          return;
        }
      } else {
        this.currentBootId = bootId;
      }
    }
    if (this.bufferTextDeltaEvent(event)) {
      return;
    }
    if (isRepairBarrierEvent(event)) {
      this.applyRepairBarrier(event);
    } else if (isTimelineGenerationBarrier(event)) {
      this.invalidateThread(event.event.threadId!);
    } else {
      this.flushDeltaBatches();
    }
    this.emitEvent(event);
  };

  private handleError = (): void => {
    if (this.closedByCaller) {
      this.reconnectAttempt = 0;
      this.setState("closed");
      return;
    }
    this.reconnectAttempt = Math.min(MAX_RECONNECT_ATTEMPTS, this.reconnectAttempt + 1);
    this.setState("reconnecting", true);
  };

  private emitEvent(event: WsEvent): void {
    if (!this.eventListeners.size || this.drainingPendingEvents) {
      this.bufferPendingDelivery({ kind: "event", event });
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

    const threadId = typeof event.event.threadId === "string" ? event.event.threadId : null;
    if (!threadId) {
      return false;
    }

    if (!this.eventListeners.size && this.pendingEventCount() >= this.maxPendingEvents) {
      const affectedThreadIds = [...new Set([...pendingDeliveryThreadIds(this.pendingDeliveries), threadId])];
      this.clearPendingDeliveries();
      this.pendingDeliveries = [{
        kind: "event",
        event: timelineGapForThreads(affectedThreadIds, event.event.eventId)
      }];
      return true;
    }

    const eventId = typeof event.event.eventId === "string" ? event.event.eventId : undefined;
    if (eventId) {
      if (this.pendingDeltaEventIds.has(eventId)) {
        this.scheduleDeltaBatchFlush();
        return true;
      }
      this.pendingDeltaEventIds.add(eventId);
    }
    this.pendingDeliveries.push({
      kind: "delta",
      delta: {
        threadId,
        event: event.event,
        ...(eventId ? { eventId } : {}),
        deliveryEpoch: this.deliveryEpochs.get(threadId) ?? 0
      }
    });
    this.scheduleDeltaBatchFlush();
    return true;
  }

  private scheduleDeltaBatchFlush(): void {
    if (this.deltaBatchTimer) {
      return;
    }
    this.deltaBatchTimer = setTimeout(() => this.flushDeltaBatches(), this.batchWindowMs);
  }

  private pendingEventCount(): number {
    return this.pendingDeliveries.reduce((count, delivery) => {
      if (delivery.kind === "delta") return count + 1;
      return count + (delivery.event.type === "codex-event-batch" ? delivery.event.events.length : 1);
    }, 0);
  }

  private clearPendingDeltaBatches(): void {
    if (this.deltaBatchTimer) {
      clearTimeout(this.deltaBatchTimer);
      this.deltaBatchTimer = null;
    }
    this.pendingDeliveries = this.pendingDeliveries.filter((delivery) => delivery.kind !== "delta");
    this.pendingDeltaEventIds.clear();
  }

  private clearPendingDeliveries(): void {
    if (this.deltaBatchTimer) {
      clearTimeout(this.deltaBatchTimer);
      this.deltaBatchTimer = null;
    }
    this.pendingDeliveries = [];
    this.pendingDeltaEventIds.clear();
  }

  private dropPendingDeltaBatchesForThread(threadId: string | null | undefined): void {
    if (!threadId) {
      return;
    }
    this.invalidateThread(threadId);
  }

  private applyRepairBarrier(event: Extract<WsEvent, { type: "timeline-gap" }>): void {
    const affectedThreadIds = event.scope === "all-tracked"
      ? [...new Set([...this.deliveryEpochs.keys(), ...pendingDeliveryThreadIds(this.pendingDeliveries)])]
      : event.affectedThreadIds?.length
        ? event.affectedThreadIds
        : event.threadId
          ? [event.threadId]
          : [];
    for (const threadId of affectedThreadIds) {
      this.dropPendingDeltaBatchesForThread(threadId);
    }
  }

  private flushDeltaBatches(): void {
    if (this.deltaBatchTimer) {
      clearTimeout(this.deltaBatchTimer);
      this.deltaBatchTimer = null;
    }
    const pending = this.pendingDeliveries;
    this.pendingDeliveries = [];
    this.pendingDeltaEventIds.clear();
    for (let index = 0; index < pending.length; ) {
      const first = pending[index]!;
      if (first.kind === "event") {
        this.pendingDeliveries.push(first);
        index += 1;
        continue;
      }
      const events = [first.delta.event];
      let nextIndex = index + 1;
      while (nextIndex < pending.length) {
        const next = pending[nextIndex]!;
        if (
          next.kind !== "delta" ||
          next.delta.threadId !== first.delta.threadId ||
          next.delta.deliveryEpoch !== first.delta.deliveryEpoch
        ) {
          break;
        }
        events.push(next.delta.event);
        nextIndex += 1;
      }
      const epochMeta = first.delta.deliveryEpoch > 0 ? { deliveryEpoch: first.delta.deliveryEpoch } : {};
      this.pendingDeliveries.push({
        kind: "event",
        event: events.length === 1
          ? { type: "codex-event", event: events[0]!, ...epochMeta }
          : { type: "codex-event-batch", events, ...epochMeta }
      });
      index = nextIndex;
    }
    this.flushPendingEvents();
  }

  private rebuildPendingDeltaEventIds(): void {
    this.pendingDeltaEventIds.clear();
    for (const pending of this.pendingDeliveries) {
      if (pending.kind === "delta" && pending.delta.eventId) {
        this.pendingDeltaEventIds.add(pending.delta.eventId);
      }
    }
  }

  private bufferPendingDelivery(delivery: PendingDelivery): void {
    if (this.pendingEventCount() < this.maxPendingEvents) {
      this.pendingDeliveries.push(delivery);
      return;
    }

    const event = delivery.kind === "event" ? delivery.event : { type: "codex-event", event: delivery.delta.event } as WsEvent;
    const affectedThreadIds = [...new Set([...pendingDeliveryThreadIds(this.pendingDeliveries), ...pendingDeliveryThreadIds([delivery])])];
    const gap = affectedThreadIds.length ? timelineGapForThreads(affectedThreadIds) : timelineGapForBufferedEvent(event);
    this.clearPendingDeliveries();
    this.pendingDeliveries = [{ kind: "event", event: gap ?? event }];
  }

  private flushPendingEvents(): void {
    if (!this.pendingDeliveries.length || !this.eventListeners.size || this.drainingPendingEvents) {
      return;
    }

    this.drainingPendingEvents = true;
    try {
      while (this.pendingDeliveries.length && this.eventListeners.size) {
        const delivery = this.pendingDeliveries.shift();
        if (!delivery) {
          continue;
        }
        if (delivery.kind === "delta") {
          this.pendingDeliveries.unshift(delivery);
          break;
        }
        for (const listener of this.eventListeners) {
          listener(delivery.event);
        }
      }
    } finally {
      this.drainingPendingEvents = false;
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

function isRepairBarrierEvent(event: WsEvent): event is Extract<WsEvent, { type: "timeline-gap" }> {
  return event.type === "timeline-gap";
}

function isTimelineGenerationBarrier(
  event: WsEvent
): event is WsCodexEvent & { event: WsCodexEvent["event"] & { threadId: string } } {
  return (
    event.type === "codex-event" &&
    event.event.kind === "timeline_generation_changed" &&
    typeof event.event.threadId === "string" &&
    Boolean(event.event.threadId)
  );
}

function timelineEventBootId(event: WsEvent): string | null {
  if (event.type === "codex-event") {
    return typeof event.event.bootId === "string" && event.event.bootId ? event.event.bootId : null;
  }
  if (event.type === "timeline-gap") {
    return typeof event.bootId === "string" && event.bootId ? event.bootId : null;
  }
  return null;
}

function pendingDeliveryThreadIds(deliveries: PendingDelivery[]): string[] {
  const threadIds: string[] = [];
  for (const delivery of deliveries) {
    if (delivery.kind === "delta") {
      threadIds.push(delivery.delta.threadId);
      continue;
    }
    if (delivery.event.type === "codex-event") {
      if (delivery.event.event.threadId) threadIds.push(delivery.event.event.threadId);
      continue;
    }
    if (delivery.event.type === "codex-event-batch") {
      for (const event of delivery.event.events) {
        if (event.threadId) threadIds.push(event.threadId);
      }
    }
  }
  return threadIds;
}

function invalidatePendingDeliveryForThread(delivery: PendingDelivery, threadId: string): PendingDelivery[] {
  if (delivery.kind === "delta") {
    return delivery.delta.threadId === threadId ? [] : [delivery];
  }
  if (delivery.event.type === "codex-event") {
    return delivery.event.event.threadId === threadId ? [] : [delivery];
  }
  if (delivery.event.type !== "codex-event-batch") {
    return [delivery];
  }
  const events = delivery.event.events.filter((event) => event.threadId !== threadId);
  if (!events.length) return [];
  return [{
    kind: "event",
    event: events.length === 1
      ? { type: "codex-event", event: events[0]!, ...(delivery.event.deliveryEpoch ? { deliveryEpoch: delivery.event.deliveryEpoch } : {}) }
      : { ...delivery.event, events }
  }];
}

function timelineGapForBufferedEvent(event: WsEvent): WsEvent | null {
  if (event.type === "codex-event") {
    const threadId = typeof event.event.threadId === "string" ? event.event.threadId : null;
    if (!threadId) {
      return null;
    }
    const lastEventId = typeof event.event.eventId === "string" ? event.event.eventId : undefined;
    return timelineGapForThreads([threadId], lastEventId);
  }

  return null;
}

function timelineGapForThreads(threadIds: string[], lastEventId?: string): Extract<WsEvent, { type: "timeline-gap" }> {
  const affectedThreadIds = [...new Set(threadIds.filter(Boolean))];
  if (affectedThreadIds.length === 1) {
    return {
      type: "timeline-gap",
      threadId: affectedThreadIds[0],
      ...(lastEventId ? { lastEventId } : {})
    };
  }
  return {
    type: "timeline-gap",
    scope: "threads",
    affectedThreadIds,
    ...(lastEventId ? { lastEventId } : {})
  };
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

export function invalidateTimelineEventThread(threadId: string): number {
  return singleton?.invalidateThread(threadId) ?? 0;
}

export type BrowserEventStreamConnectOptions = {
  onState: (state: WsConnectionState, reconnectAttempt: number) => void;
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
