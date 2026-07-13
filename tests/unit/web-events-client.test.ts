import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TimelineEventStreamClient } from "../../src/web/events/client";
import type { WsEvent } from "../../src/web/ws/client";
import { useStore } from "../../src/web/state/store";
import { threadDetailEntriesWithTurnItems } from "../../src/web/state/timeline-adapter";

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
    useStore.getState().reset("thread-live-differential");
    useStore.getState().reset("thread-refresh-differential");
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

  it("keeps different item identities inside one thread delta batch", () => {
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
      {
        type: "codex-event-batch",
        events: [
          expect.objectContaining({ eventId: "agent-1-g1", itemId: "agent-1", generation: 1 }),
          expect.objectContaining({ eventId: "agent-2-g1", itemId: "agent-2", generation: 1 }),
          expect.objectContaining({ eventId: "agent-1-g2", itemId: "agent-1", generation: 2 })
        ]
      }
    ]);
  });

  it("preserves interleaved item arrival order inside one thread batch", () => {
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

    for (const event of [
      { eventId: "a-1", itemId: "agent-a", delta: "A1" },
      { eventId: "b-1", itemId: "agent-b", delta: "B1" },
      { eventId: "a-2", itemId: "agent-a", delta: "A2" }
    ]) {
      source.emit("message", {
        type: "codex-event",
        event: {
          ...event,
          kind: "agent_message_delta",
          threadId: "thread-1",
          turnId: "turn-1",
          generation: 1
        }
      });
    }

    vi.advanceTimersByTime(10);

    expect(received).toEqual([
      {
        type: "codex-event-batch",
        events: [
          expect.objectContaining({ eventId: "a-1" }),
          expect.objectContaining({ eventId: "b-1" }),
          expect.objectContaining({ eventId: "a-2" })
        ]
      }
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

  it("converges the real client-store-repair path with a refreshed snapshot fixture", async () => {
    vi.useFakeTimers();
    const client = new TimelineEventStreamClient({
      url: "/events",
      autoConnect: false,
      batchWindowMs: 10,
      createSource: (url) => new FakeEventSource(url) as unknown as EventSource
    });
    client.onEvent((event) => useStore.getState().dispatchEvent(event));
    client.connect();

    useStore.getState().appendEntries("thread-live-differential", [
      {
        id: "user-1",
        turnId: "turn-1",
        createdAt: 1,
        body: { kind: "user-message", text: "start", status: "sent" }
      }
    ]);

    const source = FakeEventSource.instances[0]!;
    for (const event of [
      { kind: "agent_message_delta", itemId: "agent-1", delta: "first draft", eventId: "agent-1-delta" },
      { kind: "tool_output_delta", itemId: "tool-1", delta: "running", eventId: "tool-1-delta" },
      { kind: "agent_message_delta", itemId: "agent-2", delta: "final draft", eventId: "agent-2-delta" }
    ]) {
      source.emit("message", {
        type: "codex-event",
        event: { ...event, threadId: "thread-live-differential", turnId: "turn-1" }
      });
    }
    vi.advanceTimersByTime(10);
    source.emit("message", {
      type: "codex-event",
      event: {
        kind: "turn_diff_updated",
        threadId: "thread-live-differential",
        turnId: "turn-1",
        diff: "+fixed"
      }
    });

    const detail = {
      id: "thread-live-differential",
      cwd: "/repo",
      title: "Timeline",
      preview: "start",
      modelProvider: "openai",
      status: "idle",
      timeline: [
        { id: "user-1", turnId: "turn-1", role: "user" as const, text: "start" },
        { id: "agent-1", turnId: "turn-1", role: "agent" as const, text: "first answer" },
        { id: "agent-2", turnId: "turn-1", role: "agent" as const, text: "final answer" },
        { id: "turn-1-diff", turnId: "turn-1", role: "diff" as const, text: "+fixed" }
      ],
      lastTurnId: "turn-1",
      nextCursor: null,
      updatedAt: 100
    };
    const detailItems = [
      { id: "user-1", turnId: "turn-1", role: "user" as const, text: "start" },
      { id: "agent-1", turnId: "turn-1", role: "agent" as const, text: "first answer" },
      {
        id: "tool-1",
        turnId: "turn-1",
        role: "tool" as const,
        text: "tests passed",
        toolKind: "command" as const,
        server: "command",
        tool: "npm test",
        status: "success" as const
      },
      { id: "agent-2", turnId: "turn-1", role: "agent" as const, text: "final answer" },
      { id: "turn-1-diff", turnId: "turn-1", role: "diff" as const, text: "+fixed" }
    ];
    const listTurnItems = async () => ({ items: detailItems, nextCursor: null });

    const liveSources = await threadDetailEntriesWithTurnItems(detail, "thread-live-differential", listTurnItems);
    useStore.getState().setThreadEntries(
      "thread-live-differential",
      liveSources.snapshotEntries,
      null,
      liveSources.detailEntries
    );

    const refreshSources = await threadDetailEntriesWithTurnItems(
      { ...detail, id: "thread-refresh-differential" },
      "thread-refresh-differential",
      listTurnItems
    );
    useStore.getState().setThreadEntries(
      "thread-refresh-differential",
      refreshSources.snapshotEntries,
      null,
      refreshSources.detailEntries
    );

    const visible = (threadId: string) =>
      useStore.getState().threads[threadId]!.entries.map((entry) => ({
        id: entry.id,
        text:
          entry.body.kind === "user-message" || entry.body.kind === "agent-message"
            ? entry.body.text
            : entry.body.kind === "tool"
              ? entry.body.result
              : entry.body.kind === "diff"
                ? entry.body.diff
                : undefined
      }));

    expect(visible("thread-live-differential")).toEqual(visible("thread-refresh-differential"));
    expect(visible("thread-live-differential")).toEqual([
      { id: "user-1", text: "start" },
      { id: "agent-1", text: "first answer" },
      { id: "tool-1", text: "tests passed" },
      { id: "agent-2", text: "final answer" },
      { id: "turn-1-diff", text: "+fixed" }
    ]);
    client.close();
  });
});
