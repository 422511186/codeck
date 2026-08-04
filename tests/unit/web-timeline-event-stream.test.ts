import { describe, expect, it } from "vitest";
import type { TimelineEntry } from "../../src/web/state/timeline";
import {
  applyTimelineStreamInput,
  createTimelineEventStreamState,
  orderTimelineEntriesByEventStream,
  timelineEntriesForEventStream,
  timelineEventStreamFromEntries
} from "../../src/web/state/timeline-event-stream";

describe("timeline event stream", () => {
  it("uses item identity as the lifecycle key and ignores duplicate source events", () => {
    const initial = createTimelineEventStreamState();
    const running = applyTimelineStreamInput(initial, {
      kind: "delta",
      threadId: "thread-1",
      turnId: "turn-1",
      itemId: "cmd-1",
      eventKind: "command_output_delta",
      delta: "npm test\n",
      eventId: "event-1",
      sequence: 2
    });
    const completed = applyTimelineStreamInput(running, {
      kind: "entry",
      entry: commandEntry("cmd-1", "success", "npm test\npass"),
      eventId: "event-2",
      sequence: 4
    });
    const duplicate = applyTimelineStreamInput(completed, {
      kind: "delta",
      threadId: "thread-1",
      turnId: "turn-1",
      itemId: "cmd-1",
      eventKind: "command_output_delta",
      delta: "duplicate",
      eventId: "event-1",
      sequence: 5
    });

    expect(duplicate).toBe(completed);
    expect(completed.events).toHaveLength(1);
    expect(completed.events[0]).toMatchObject({
      id: "cmd-1",
      kind: "command",
      status: "success",
      entryId: "cmd-1",
      firstSequence: 2,
      lastSequence: 4,
      sourceEventIds: ["event-1", "event-2"]
    });
  });

  it("keeps stream order independent from completion order and preserves explicit nesting", () => {
    let state = createTimelineEventStreamState();
    state = applyTimelineStreamInput(state, {
      kind: "entry",
      entry: toolEntry("tool-2", "turn-1", 30),
      sequence: 30,
      parentId: "cmd-1"
    });
    state = applyTimelineStreamInput(state, {
      kind: "entry",
      entry: commandEntry("cmd-1", "running", ""),
      sequence: 10
    });
    state = applyTimelineStreamInput(state, {
      kind: "entry",
      entry: toolEntry("tool-1", "turn-1", 20),
      sequence: 20,
      parentId: "cmd-1"
    });

    expect(state.events.map((event) => event.id)).toEqual(["cmd-1", "tool-1", "tool-2"]);
    expect(state.events.filter((event) => event.parentId === "cmd-1").map((event) => event.id)).toEqual([
      "tool-1",
      "tool-2"
    ]);
  });

  it("links a command delta to a completed command-shaped tool entry", () => {
    let state = createTimelineEventStreamState();
    state = applyTimelineStreamInput(state, {
      kind: "delta",
      threadId: "thread-1",
      turnId: "turn-1",
      itemId: "cmd-1",
      eventKind: "command_output_delta",
      delta: "out",
      eventId: "event-1",
      sequence: 2
    });
    state = applyTimelineStreamInput(state, {
      kind: "entry",
      entry: {
        id: "cmd-1",
        turnId: "turn-1",
        streamSequence: 4,
        createdAt: 4,
        body: {
          kind: "tool",
          toolKind: "command",
          server: "command",
          tool: "npm test",
          status: "success",
          result: "done"
        }
      },
      eventId: "event-2",
      sequence: 4
    });

    expect(state.events).toHaveLength(1);
    expect(state.events[0]?.sourceEventIds).toEqual(["event-1", "event-2"]);
  });

  it("classifies legacy exec_command records as command events", () => {
    const state = timelineEventStreamFromEntries([{
      id: "legacy-exec",
      turnId: "turn-legacy",
      createdAt: 1,
      body: {
        kind: "tool",
        server: "command",
        tool: "exec_command",
        arguments: JSON.stringify({ cmd: "npm test" }),
        status: "success",
        result: "passed"
      }
    }]);

    expect(state.events[0]).toMatchObject({ id: "legacy-exec", kind: "command", status: "success" });
  });

  it("hydrates historical entries while retaining event-stream metadata for later updates", () => {
    const entries = [
      commandEntry("cmd-1", "success", "done", "turn-1", 10),
      {
        id: "assistant-1",
        turnId: "turn-1",
        createdAt: 20,
        body: { kind: "agent-message", text: "完成" }
      } satisfies TimelineEntry
    ];

    const state = timelineEventStreamFromEntries(entries);
    expect(state.events.map((event) => event.id)).toEqual(["cmd-1", "assistant-1"]);
    expect(state.events.map((event) => event.status)).toEqual(["success", "success"]);
    expect(state.events[0]?.entryId).toBe("cmd-1");
  });

  it("reconciles a newly loaded older page before the existing live tail", () => {
    const newest = {
      id: "assistant-newest",
      turnId: "turn-newest",
      createdAt: 20,
      body: { kind: "agent-message", text: "最新" }
    } satisfies TimelineEntry;
    const older = {
      id: "assistant-older",
      turnId: "turn-older",
      createdAt: 10,
      body: { kind: "agent-message", text: "更早" }
    } satisfies TimelineEntry;

    const liveTail = timelineEventStreamFromEntries([newest]);
    const reconciled = timelineEventStreamFromEntries([older, newest], liveTail);

    expect(orderTimelineEntriesByEventStream([older, newest], reconciled).map((entry) => entry.id)).toEqual([
      "assistant-older",
      "assistant-newest"
    ]);
  });

  it("projects entries in event sequence order while retaining entries missing from a partial stream", () => {
    const entries = [
      commandEntry("cmd-1", "success", "one", "turn-1", 1),
      commandEntry("cmd-2", "success", "two", "turn-1", 2),
      commandEntry("cmd-3", "success", "three", "turn-1", 3)
    ];
    let stream = createTimelineEventStreamState();
    stream = applyTimelineStreamInput(stream, { kind: "entry", entry: entries[2]!, sequence: 30 });
    stream = applyTimelineStreamInput(stream, { kind: "entry", entry: entries[0]!, sequence: 10 });

    expect(orderTimelineEntriesByEventStream(entries, stream).map((entry) => entry.id)).toEqual([
      "cmd-1",
      "cmd-3",
      "cmd-2"
    ]);
  });

  it("keeps a visible retry lifecycle on one identity and rejects stale regressions", () => {
    let state = createTimelineEventStreamState();
    state = applyTimelineStreamInput(state, {
      kind: "lifecycle",
      threadId: "thread-1",
      turnId: "turn-1",
      itemId: "turn-1-lifecycle",
      eventKind: "turn_error",
      status: "retrying",
      label: "连接暂时断开，正在重试",
      visible: true,
      sequence: 10
    });
    state = applyTimelineStreamInput(state, {
      kind: "lifecycle",
      threadId: "thread-1",
      turnId: "turn-1",
      itemId: "turn-1-lifecycle",
      eventKind: "turn_completed",
      status: "success",
      label: "重试成功",
      sequence: 20
    });
    state = applyTimelineStreamInput(state, {
      kind: "lifecycle",
      threadId: "thread-1",
      turnId: "turn-1",
      itemId: "turn-1-lifecycle",
      eventKind: "turn_error",
      status: "retrying",
      label: "迟到的旧重试",
      visible: true,
      sequence: 9
    });

    expect(state.events[0]).toMatchObject({ status: "success", label: "重试成功", visible: true });
    expect(timelineEntriesForEventStream([], state)).toEqual([
      expect.objectContaining({
        id: "turn-1-lifecycle",
        body: expect.objectContaining({ kind: "error", status: "success", text: "重试成功" })
      })
    ]);
  });

  it("retains lifecycle-only events when entries are rehydrated", () => {
    let state = createTimelineEventStreamState();
    state = applyTimelineStreamInput(state, {
      kind: "lifecycle",
      threadId: "thread-1",
      turnId: "turn-1",
      itemId: "turn-1-lifecycle",
      eventKind: "turn_interrupted",
      status: "interrupted",
      label: "执行已中断",
      visible: true
    });

    const rehydrated = timelineEventStreamFromEntries([], state);
    expect(rehydrated.events).toHaveLength(1);
    expect(rehydrated.events[0]).toMatchObject({ source: "lifecycle", status: "interrupted" });
  });

  it("scopes source-event deduplication and sequence ordering by history generation", () => {
    let state = createTimelineEventStreamState();
    state = applyTimelineStreamInput(state, {
      kind: "delta",
      threadId: "thread-1",
      turnId: "turn-1",
      itemId: "item-1",
      eventKind: "command_output_delta",
      delta: "old",
      eventId: "reused-event-id",
      bootId: "boot-1",
      generation: 1,
      sequence: 100
    });
    state = applyTimelineStreamInput(state, {
      kind: "delta",
      threadId: "thread-1",
      turnId: "turn-2",
      itemId: "item-2",
      eventKind: "command_output_delta",
      delta: "new",
      eventId: "reused-event-id",
      bootId: "boot-1",
      generation: 2,
      sequence: 1
    });

    expect(state.events).toHaveLength(2);
    expect(state.events.map((event) => event.generation)).toEqual([1, 2]);
    expect(state.events.map((event) => event.sourceEventIds)).toEqual([
      ["reused-event-id"],
      ["reused-event-id"]
    ]);
  });

  it("does not fork an item when a stamped delta is completed by an unstamped entry", () => {
    let state = createTimelineEventStreamState();
    state = applyTimelineStreamInput(state, {
      kind: "delta",
      threadId: "thread-1",
      turnId: "turn-1",
      itemId: "cmd-1",
      eventKind: "command_output_delta",
      delta: "partial",
      bootId: "boot-1",
      generation: 4,
      sequence: 10
    });
    const completedEntry = commandEntry("cmd-1", "success", "complete");
    state = applyTimelineStreamInput(state, {
      kind: "entry",
      entry: completedEntry,
      sequence: 11
    });

    expect(state.events).toHaveLength(1);
    expect(state.events[0]).toMatchObject({ status: "success", generation: 4 });
    expect(timelineEventStreamFromEntries([completedEntry], state).events).toHaveLength(1);
  });
});

function commandEntry(
  id: string,
  status: "running" | "success" | "failed",
  output: string,
  turnId = "turn-1",
  createdAt = 1
): TimelineEntry {
  return {
    id,
    turnId,
    createdAt,
    body: { kind: "command", status, command: "npm test", output }
  };
}

function toolEntry(id: string, turnId: string, createdAt: number): TimelineEntry {
  return {
    id,
    turnId,
    createdAt,
    body: {
      kind: "tool",
      toolKind: "mcp",
      server: "server",
      tool: "tool",
      status: "success",
      result: "ok"
    }
  };
}
