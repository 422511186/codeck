"use client";

import type { WsConnectionState, WsEvent } from "../ws/client";

type Listener<T> = (event: T) => void;

export interface TimelineEventStreamOptions {
  url?: string;
  createSource?: (url: string) => EventSource;
  autoConnect?: boolean;
  maxPendingEvents?: number;
}

const DEFAULT_MAX_PENDING_EVENTS = 200;

export class TimelineEventStreamClient {
  private source: EventSource | null = null;
  private state: WsConnectionState = "closed";
  private closedByCaller = false;
  private readonly eventListeners = new Set<Listener<WsEvent>>();
  private readonly stateListeners = new Set<Listener<WsConnectionState>>();
  private pendingEvents: WsEvent[] = [];
  private readonly createSource: (url: string) => EventSource;
  private readonly maxPendingEvents: number;
  private readonly url: string;

  constructor(options: TimelineEventStreamOptions = {}) {
    this.url = options.url ?? "/api/codex/events";
    this.createSource = options.createSource ?? ((url) => new EventSource(url));
    this.maxPendingEvents = options.maxPendingEvents ?? DEFAULT_MAX_PENDING_EVENTS;
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

  private bufferPendingEvent(event: WsEvent): void {
    if (this.pendingEvents.length < this.maxPendingEvents) {
      this.pendingEvents.push(event);
      return;
    }

    this.pendingEvents = [timelineGapForBufferedEvent(event)];
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

function timelineGapForBufferedEvent(event: WsEvent): WsEvent {
  if (event.type === "codex-event") {
    const threadId = typeof event.event.threadId === "string" ? event.event.threadId : null;
    const lastEventId = typeof event.event.eventId === "string" ? event.event.eventId : undefined;
    return {
      type: "timeline-gap",
      ...(threadId ? { threadId } : {}),
      ...(lastEventId ? { lastEventId } : {})
    };
  }

  return { type: "timeline-gap" };
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
