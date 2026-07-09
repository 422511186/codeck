import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TimelineEventStreamClient } from "../../src/web/events/client";
import type { WsEvent } from "../../src/web/ws/client";

class FakeEventSource {
  static instances: FakeEventSource[] = [];
  listeners: Record<string, ((event: MessageEvent) => void)[]> = {};
  closeCount = 0;

  constructor(public url: string) {
    FakeEventSource.instances.push(this);
  }

  addEventListener(name: string, listener: (event: MessageEvent) => void): void {
    (this.listeners[name] ??= []).push(listener);
  }

  removeEventListener(name: string, listener: (event: MessageEvent) => void): void {
    this.listeners[name] = (this.listeners[name] ?? []).filter((current) => current !== listener);
  }

  close(): void {
    this.closeCount += 1;
  }

  emit(name: string, data?: unknown): void {
    const event = { data: typeof data === "string" ? data : JSON.stringify(data) } as MessageEvent;
    for (const listener of this.listeners[name] ?? []) {
      listener(event);
    }
  }
}

describe("TimelineEventStreamClient", () => {
  beforeEach(() => {
    FakeEventSource.instances = [];
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("dispatches parsed SSE messages", () => {
    const client = new TimelineEventStreamClient({
      url: "/events",
      autoConnect: false,
      createSource: (url) => new FakeEventSource(url) as unknown as EventSource
    });
    const received: WsEvent[] = [];
    client.onEvent((event) => received.push(event));
    client.connect();

    FakeEventSource.instances[0]!.emit("open");
    FakeEventSource.instances[0]!.emit("message", { type: "hello", status: "connected" });

    expect(client.connectionState).toBe("open");
    expect(received).toEqual([{ type: "hello", status: "connected" }]);
  });

  it("marks reconnecting on EventSource error without requesting snapshot repair", () => {
    const client = new TimelineEventStreamClient({
      url: "/events",
      autoConnect: false,
      createSource: (url) => new FakeEventSource(url) as unknown as EventSource
    });
    const received: WsEvent[] = [];
    client.onEvent((event) => received.push(event));
    client.connect();

    FakeEventSource.instances[0]!.emit("error");

    expect(client.connectionState).toBe("reconnecting");
    expect(received).toEqual([]);
  });

  it("dispatches explicit timeline-gap messages from the server", () => {
    const client = new TimelineEventStreamClient({
      url: "/events",
      autoConnect: false,
      createSource: (url) => new FakeEventSource(url) as unknown as EventSource
    });
    const received: WsEvent[] = [];
    client.onEvent((event) => received.push(event));
    client.connect();

    FakeEventSource.instances[0]!.emit("message", { type: "timeline-gap", lastEventId: "old-event" });

    expect(received).toEqual([{ type: "timeline-gap", lastEventId: "old-event" }]);
  });

  it("buffers events received while no listener is registered and flushes them to the next listener", () => {
    const client = new TimelineEventStreamClient({
      url: "/events",
      autoConnect: false,
      createSource: (url) => new FakeEventSource(url) as unknown as EventSource
    });
    client.connect();

    FakeEventSource.instances[0]!.emit("message", {
      type: "codex-event",
      event: {
        kind: "reasoning_delta",
        threadId: "thread-1",
        turnId: "turn-1",
        itemId: "reasoning-1",
        delta: "thinking"
      }
    });

    const received: WsEvent[] = [];
    client.onEvent((event) => received.push(event));

    expect(received).toEqual([
      {
        type: "codex-event",
        event: {
          kind: "reasoning_delta",
          threadId: "thread-1",
          turnId: "turn-1",
          itemId: "reasoning-1",
          delta: "thinking"
        }
      }
    ]);
  });

  it("emits a timeline-gap when the no-listener event buffer overflows", () => {
    const client = new TimelineEventStreamClient({
      url: "/events",
      autoConnect: false,
      maxPendingEvents: 1,
      createSource: (url) => new FakeEventSource(url) as unknown as EventSource
    });
    client.connect();

    FakeEventSource.instances[0]!.emit("message", {
      type: "codex-event",
      event: {
        kind: "agent_message_delta",
        threadId: "thread-1",
        turnId: "turn-1",
        itemId: "agent-1",
        delta: "one"
      }
    });
    FakeEventSource.instances[0]!.emit("message", {
      type: "codex-event",
      event: {
        kind: "agent_message_delta",
        threadId: "thread-1",
        turnId: "turn-1",
        itemId: "agent-1",
        delta: "two"
      }
    });

    const received: WsEvent[] = [];
    client.onEvent((event) => received.push(event));

    expect(received).toEqual([{ type: "timeline-gap", threadId: "thread-1" }]);
  });

  it("does not emit an ownerless repair gap when no-listener overflow cannot identify a thread", () => {
    const client = new TimelineEventStreamClient({
      url: "/events",
      autoConnect: false,
      maxPendingEvents: 1,
      createSource: (url) => new FakeEventSource(url) as unknown as EventSource
    });
    client.connect();

    FakeEventSource.instances[0]!.emit("message", {
      type: "health",
      appServer: "ready",
      detail: "first"
    });
    FakeEventSource.instances[0]!.emit("message", {
      type: "health",
      appServer: "ready",
      detail: "second"
    });

    const received: WsEvent[] = [];
    client.onEvent((event) => received.push(event));

    expect(received).toEqual([{ type: "health", appServer: "ready", detail: "second" }]);
  });

  it("batches same item text deltas before notifying listeners and drops duplicate event ids inside the batch", () => {
    vi.useFakeTimers();
    const client = new TimelineEventStreamClient({
      url: "/events",
      autoConnect: false,
      batchWindowMs: 10,
      createSource: (url) => new FakeEventSource(url) as unknown as EventSource
    });
    const received: WsEvent[] = [];
    client.onEvent((event) => received.push(event));
    client.connect();

    const source = FakeEventSource.instances[0]!;
    source.emit("message", {
      type: "codex-event",
      event: {
        eventId: "delta-1",
        kind: "agent_message_delta",
        threadId: "thread-1",
        turnId: "turn-1",
        itemId: "agent-1",
        generation: 1,
        delta: "one"
      }
    });
    source.emit("message", {
      type: "codex-event",
      event: {
        eventId: "delta-2",
        kind: "agent_message_delta",
        threadId: "thread-1",
        turnId: "turn-1",
        itemId: "agent-1",
        generation: 1,
        delta: "two"
      }
    });
    source.emit("message", {
      type: "codex-event",
      event: {
        eventId: "delta-2",
        kind: "agent_message_delta",
        threadId: "thread-1",
        turnId: "turn-1",
        itemId: "agent-1",
        generation: 1,
        delta: "two"
      }
    });

    expect(received).toEqual([]);

    vi.advanceTimersByTime(10);

    expect(received).toEqual([
      {
        type: "codex-event-batch",
        events: [
          expect.objectContaining({ eventId: "delta-1", delta: "one" }),
          expect.objectContaining({ eventId: "delta-2", delta: "two" })
        ]
      }
    ]);
  });

  it("keeps different items and generations in separate delta batches", () => {
    vi.useFakeTimers();
    const client = new TimelineEventStreamClient({
      url: "/events",
      autoConnect: false,
      batchWindowMs: 10,
      createSource: (url) => new FakeEventSource(url) as unknown as EventSource
    });
    const received: WsEvent[] = [];
    client.onEvent((event) => received.push(event));
    client.connect();

    const source = FakeEventSource.instances[0]!;
    source.emit("message", {
      type: "codex-event",
      event: {
        eventId: "agent-1-g1",
        kind: "agent_message_delta",
        threadId: "thread-1",
        turnId: "turn-1",
        itemId: "agent-1",
        generation: 1,
        delta: "one"
      }
    });
    source.emit("message", {
      type: "codex-event",
      event: {
        eventId: "agent-2-g1",
        kind: "agent_message_delta",
        threadId: "thread-1",
        turnId: "turn-1",
        itemId: "agent-2",
        generation: 1,
        delta: "two"
      }
    });
    source.emit("message", {
      type: "codex-event",
      event: {
        eventId: "agent-1-g2",
        kind: "agent_message_delta",
        threadId: "thread-1",
        turnId: "turn-1",
        itemId: "agent-1",
        generation: 2,
        delta: "three"
      }
    });

    vi.advanceTimersByTime(10);

    expect(received).toEqual([
      { type: "codex-event", event: expect.objectContaining({ eventId: "agent-1-g1" }) },
      { type: "codex-event", event: expect.objectContaining({ eventId: "agent-2-g1" }) },
      { type: "codex-event", event: expect.objectContaining({ eventId: "agent-1-g2" }) }
    ]);
  });

  it("flushes pending text delta batches before interactive control events", () => {
    vi.useFakeTimers();
    const client = new TimelineEventStreamClient({
      url: "/events",
      autoConnect: false,
      batchWindowMs: 10,
      createSource: (url) => new FakeEventSource(url) as unknown as EventSource
    });
    const received: WsEvent[] = [];
    client.onEvent((event) => received.push(event));
    client.connect();

    const source = FakeEventSource.instances[0]!;
    source.emit("message", {
      type: "codex-event",
      event: {
        eventId: "delta-1",
        kind: "agent_message_delta",
        threadId: "thread-1",
        turnId: "turn-1",
        itemId: "agent-1",
        delta: "one"
      }
    });
    source.emit("message", {
      type: "server-request",
      request: { requestId: "approval-1", kind: "approval", threadId: "thread-1" }
    });

    expect(received).toEqual([
      { type: "codex-event", event: expect.objectContaining({ eventId: "delta-1" }) },
      {
        type: "server-request",
        request: { requestId: "approval-1", kind: "approval", threadId: "thread-1" }
      }
    ]);
  });

  it("drops pending text deltas for a thread when a repair barrier arrives before flush", () => {
    vi.useFakeTimers();
    const client = new TimelineEventStreamClient({
      url: "/events",
      autoConnect: false,
      batchWindowMs: 10,
      createSource: (url) => new FakeEventSource(url) as unknown as EventSource
    });
    const received: WsEvent[] = [];
    client.onEvent((event) => received.push(event));
    client.connect();

    const source = FakeEventSource.instances[0]!;
    source.emit("message", {
      type: "codex-event",
      event: {
        eventId: "stale-delta",
        kind: "agent_message_delta",
        threadId: "thread-1",
        turnId: "turn-1",
        itemId: "agent-1",
        delta: "stale"
      }
    });
    source.emit("message", { type: "timeline-gap", threadId: "thread-1", lastEventId: "missing" });

    vi.advanceTimersByTime(10);

    expect(received).toEqual([{ type: "timeline-gap", threadId: "thread-1", lastEventId: "missing" }]);
  });
});
