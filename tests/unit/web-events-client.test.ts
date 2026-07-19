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

  it("reports consecutive reconnect attempts and resets them after open", () => {
    const client = new TimelineEventStreamClient({
      url: "/events",
      autoConnect: false,
      createSource: (url) => new FakeEventSource(url) as unknown as EventSource
    });
    const snapshots: Array<{ state: string; attempt: number | undefined }> = [];
    client.onState(((state: string, attempt?: number) => {
      snapshots.push({ state, attempt });
    }) as (state: Parameters<Parameters<typeof client.onState>[0]>[0]) => void);
    client.connect();

    FakeEventSource.instances[0]!.emit("error");
    FakeEventSource.instances[0]!.emit("error");
    FakeEventSource.instances[0]!.emit("open");

    expect(snapshots).toEqual([
      { state: "closed", attempt: 0 },
      { state: "connecting", attempt: 0 },
      { state: "reconnecting", attempt: 1 },
      { state: "reconnecting", attempt: 2 },
      { state: "open", attempt: 0 }
    ]);
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

  it("dispatches baseline-required messages and drops pending deltas", () => {
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
        kind: "agent_message_delta",
        threadId: "thread-1",
        turnId: "turn-1",
        itemId: "agent-1",
        delta: "stale"
      }
    });
    source.emit("message", {
      type: "timeline-baseline-required",
      bootId: "boot-a",
      streamCursor: 9,
      scope: "all-tracked"
    });

    vi.advanceTimersByTime(10);
    expect(received).toEqual([{
      type: "timeline-baseline-required",
      bootId: "boot-a",
      streamCursor: 9,
      scope: "all-tracked"
    }]);
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

  it("drains older pending events before a newer unflushed delta batch", async () => {
    vi.useFakeTimers();
    const client = new TimelineEventStreamClient({
      url: "/events",
      autoConnect: false,
      batchWindowMs: 10,
      createSource: (url) => new FakeEventSource(url) as unknown as EventSource
    });
    client.connect();

    FakeEventSource.instances[0]!.emit("message", {
      type: "codex-event",
      event: {
        kind: "agent_message_delta",
        threadId: "thread-1",
        turnId: "turn-1",
        itemId: "agent-a",
        delta: "A",
        streamSequence: 1
      }
    });
    await vi.advanceTimersByTimeAsync(10);
    FakeEventSource.instances[0]!.emit("message", {
      type: "codex-event",
      event: {
        kind: "agent_message_delta",
        threadId: "thread-1",
        turnId: "turn-1",
        itemId: "agent-b",
        delta: "B",
        streamSequence: 2
      }
    });

    const received: string[] = [];
    client.onEvent((event) => {
      if (event.type === "codex-event") {
        received.push(String(event.event.delta));
      }
    });

    expect(received).toEqual(["A", "B"]);
  });

  it("keeps events arriving during listener drain behind older pending delivery", () => {
    const client = new TimelineEventStreamClient({
      url: "/events",
      autoConnect: false,
      createSource: (url) => new FakeEventSource(url) as unknown as EventSource
    });
    client.connect();
    FakeEventSource.instances[0]!.emit("message", { type: "health", appServer: "ready", detail: "A" });
    FakeEventSource.instances[0]!.emit("message", { type: "health", appServer: "ready", detail: "B" });

    const received: string[] = [];
    client.onEvent((event) => {
      if (event.type !== "health") return;
      received.push(String(event.detail));
      if (event.detail === "A") {
        FakeEventSource.instances[0]!.emit("message", { type: "health", appServer: "ready", detail: "C" });
      }
    });

    expect(received).toEqual(["A", "B", "C"]);
  });

  it("reports every thread whose buffered deltas are lost on overflow", () => {
    const client = new TimelineEventStreamClient({
      url: "/events",
      autoConnect: false,
      maxPendingEvents: 2,
      createSource: (url) => new FakeEventSource(url) as unknown as EventSource
    });
    client.connect();

    for (const [threadId, delta] of [["thread-a", "A"], ["thread-b", "B"], ["thread-b", "C"]] as const) {
      FakeEventSource.instances[0]!.emit("message", {
        type: "codex-event",
        event: {
          kind: "agent_message_delta",
          threadId,
          turnId: `turn-${threadId}`,
          itemId: `agent-${threadId}`,
          delta
        }
      });
    }

    const received: WsEvent[] = [];
    client.onEvent((event) => received.push(event));

    expect(received).toEqual([
      {
        type: "timeline-gap",
        scope: "threads",
        affectedThreadIds: ["thread-a", "thread-b"]
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

  it("preserves global stream order across interleaved thread batches", () => {
    vi.useFakeTimers();
    const client = new TimelineEventStreamClient({
      url: "/events",
      autoConnect: false,
      batchWindowMs: 10,
      createSource: (url) => new FakeEventSource(url) as unknown as EventSource
    });
    const received: number[] = [];
    client.onEvent((event) => {
      if (event.type === "codex-event") {
        received.push(Number(event.event.streamSequence));
      } else if (event.type === "codex-event-batch") {
        received.push(...event.events.map((item) => Number(item.streamSequence)));
      }
    });
    client.connect();
    const source = FakeEventSource.instances[0]!;

    for (const event of [
      { threadId: "thread-a", itemId: "agent-a", delta: "A1", streamSequence: 1 },
      { threadId: "thread-b", itemId: "agent-b", delta: "B1", streamSequence: 2 },
      { threadId: "thread-a", itemId: "agent-a", delta: "A2", streamSequence: 3 }
    ]) {
      source.emit("message", {
        type: "codex-event",
        event: { ...event, kind: "agent_message_delta", turnId: "turn-1", generation: 1 }
      });
    }
    vi.advanceTimersByTime(10);

    expect(received).toEqual([1, 2, 3]);
  });

  it("converges interleaved gateway sequence fields through client store and engine", () => {
    vi.useFakeTimers();
    const threadId = "thread-interleaved-sequences";
    useStore.getState().reset(threadId);
    const client = new TimelineEventStreamClient({
      url: "/events",
      autoConnect: false,
      batchWindowMs: 10,
      createSource: (url) => new FakeEventSource(url) as unknown as EventSource
    });
    client.onEvent((event) => useStore.getState().dispatchEvent(event));
    client.connect();
    const source = FakeEventSource.instances[0]!;

    for (const event of [
      { itemId: "agent-a", delta: "A1", streamSequence: 1, fragmentSequence: 1 },
      { itemId: "agent-b", delta: "B1", streamSequence: 2, fragmentSequence: 1 },
      { itemId: "agent-a", delta: "A2", streamSequence: 3, fragmentSequence: 2 }
    ]) {
      source.emit("message", {
        type: "codex-event",
        event: {
          ...event,
          eventId: `boot-a:${threadId}:1:${event.streamSequence}:agent_message_delta`,
          bootId: "boot-a",
          kind: "agent_message_delta",
          threadId,
          turnId: "turn-1",
          generation: 0,
          revision: event.streamSequence
        }
      });
    }
    vi.advanceTimersByTime(10);

    expect(useStore.getState().threads[threadId]?.entries).toEqual([
      expect.objectContaining({ id: "agent-a", body: { kind: "agent-message", text: "A1A2" } }),
      expect.objectContaining({ id: "agent-b", body: { kind: "agent-message", text: "B1" } })
    ]);
    expect(useStore.getState().threads[threadId]?.repairRequest).toBeNull();
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

  it("drops pending text deltas before a timeline generation barrier", () => {
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
        turnId: "turn-old",
        itemId: "agent-old",
        generation: 1,
        delta: "stale"
      }
    });
    source.emit("message", {
      type: "codex-event",
      event: {
        eventId: "generation-2",
        kind: "timeline_generation_changed",
        threadId: "thread-1",
        generation: 2,
        bootId: "boot-a",
        streamSequence: 2
      }
    });
    vi.advanceTimersByTime(10);

    expect(received).toEqual([
      {
        type: "codex-event",
        event: expect.objectContaining({ kind: "timeline_generation_changed", generation: 2 })
      }
    ]);
  });

  it("turns a boot change into an all-tracked barrier before accepting new deltas", () => {
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
        eventId: "boot-a:thread-1:1:1:agent_message_delta",
        bootId: "boot-a",
        streamSequence: 1,
        kind: "agent_message_delta",
        threadId: "thread-1",
        turnId: "turn-old",
        itemId: "agent-old",
        delta: "old"
      }
    });
    source.emit("message", {
      type: "codex-event",
      event: {
        eventId: "boot-b:thread-1:1:1:agent_message_delta",
        bootId: "boot-b",
        streamSequence: 1,
        kind: "agent_message_delta",
        threadId: "thread-1",
        turnId: "turn-new",
        itemId: "agent-new",
        delta: "new"
      }
    });
    vi.advanceTimersByTime(10);

    expect(received).toEqual([{ type: "timeline-gap", scope: "all-tracked", bootId: "boot-b" }]);
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
