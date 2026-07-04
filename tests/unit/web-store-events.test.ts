import { beforeEach, describe, expect, it } from "vitest";
import { useStore } from "../../src/web/state/store";

describe("web store codex events", () => {
  beforeEach(() => {
    useStore.setState({
      wsState: "idle",
      appServer: null,
      threads: {},
      activeThreadId: null
    });
  });

  it("updates running state from app-server turn lifecycle events", () => {
    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: { kind: "turn_started", threadId: "thread-1", turnId: "turn-1" }
    });

    expect(useStore.getState().threads["thread-1"]?.running).toBe(true);
    expect(useStore.getState().threads["thread-1"]?.activeTurnId).toBe("turn-1");

    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: { kind: "turn_completed", threadId: "thread-1", turnId: "turn-1" }
    });

    expect(useStore.getState().threads["thread-1"]?.running).toBe(false);
    expect(useStore.getState().threads["thread-1"]?.activeTurnId).toBeNull();
  });

  it("does not stop a newer active turn when an older completion arrives late", () => {
    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: { kind: "turn_started", threadId: "thread-1", turnId: "turn-old" }
    });
    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: { kind: "turn_started", threadId: "thread-1", turnId: "turn-new" }
    });
    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: { kind: "turn_completed", threadId: "thread-1", turnId: "turn-old" }
    });

    expect(useStore.getState().threads["thread-1"]?.running).toBe(true);
    expect(useStore.getState().threads["thread-1"]?.activeTurnId).toBe("turn-new");
  });

  it("ignores late visible output events after a turn is interrupted locally", () => {
    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: { kind: "turn_started", threadId: "thread-1", turnId: "turn-1" }
    });
    useStore.getState().markTurnInterrupted("thread-1", "turn-1");
    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: {
        kind: "agent_message_delta",
        threadId: "thread-1",
        turnId: "turn-1",
        itemId: "agent-1",
        delta: "不应继续出现"
      }
    });
    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: { kind: "turn_completed", threadId: "thread-1", turnId: "turn-1" }
    });

    expect(useStore.getState().threads["thread-1"]?.entries).toEqual([]);
    expect(useStore.getState().threads["thread-1"]?.running).toBe(false);
  });

  it("streams agent deltas into timeline entries", () => {
    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: {
        kind: "agent_message_delta",
        threadId: "thread-1",
        turnId: "turn-1",
        itemId: "agent-1",
        delta: "第一段"
      }
    });
    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: {
        kind: "agent_message_delta",
        threadId: "thread-1",
        turnId: "turn-1",
        itemId: "agent-1",
        delta: "第二段"
      }
    });

    expect(useStore.getState().threads["thread-1"]?.entries).toEqual([
      expect.objectContaining({
        id: "agent-1",
        turnId: "turn-1",
        body: { kind: "agent-message", text: "第一段第二段" }
      })
    ]);
  });

  it("preserves turn metadata on all live timeline entries", () => {
    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: {
        kind: "agent_message_delta",
        threadId: "thread-1",
        turnId: "turn-1",
        itemId: "agent-1",
        delta: "回答"
      }
    });
    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: {
        kind: "reasoning_delta",
        threadId: "thread-1",
        turnId: "turn-1",
        itemId: "reasoning-1",
        delta: "思考"
      }
    });
    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: {
        kind: "command_output_delta",
        threadId: "thread-1",
        turnId: "turn-1",
        itemId: "cmd-1",
        delta: "输出"
      }
    });
    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: {
        kind: "turn_diff_updated",
        threadId: "thread-1",
        turnId: "turn-1",
        diff: "diff --git a/a b/a\n+new"
      }
    });

    expect(useStore.getState().threads["thread-1"]?.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "agent-1", turnId: "turn-1" }),
        expect.objectContaining({ id: "reasoning-1", turnId: "turn-1" }),
        expect.objectContaining({ id: "cmd-1", turnId: "turn-1" }),
        expect.objectContaining({ id: "turn-1-diff", turnId: "turn-1" })
      ])
    );
  });

  it("ignores duplicate event ids when streaming deltas", () => {
    const event = {
      type: "codex-event" as const,
      event: {
        eventId: "evt-1",
        kind: "agent_message_delta",
        threadId: "thread-1",
        turnId: "turn-1",
        itemId: "agent-1",
        delta: "只出现一次"
      }
    };

    useStore.getState().dispatchEvent(event);
    useStore.getState().dispatchEvent(event);

    expect(useStore.getState().threads["thread-1"]?.entries).toEqual([
      expect.objectContaining({
        id: "agent-1",
        body: { kind: "agent-message", text: "只出现一次" }
      })
    ]);
  });

  it("records event ids without an extra visible store update for streamed deltas", () => {
    useStore.getState().ensureThread("thread-1");
    let notifications = 0;
    const unsubscribe = useStore.subscribe(() => {
      notifications += 1;
    });

    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: {
        eventId: "evt-visible-delta",
        kind: "agent_message_delta",
        threadId: "thread-1",
        turnId: "turn-1",
        itemId: "agent-1",
        delta: "只渲染一次"
      }
    });

    unsubscribe();
    expect(notifications).toBe(1);
    expect(useStore.getState().threads["thread-1"]?.processedEventIds.has("evt-visible-delta")).toBe(true);
    expect(useStore.getState().threads["thread-1"]?.entries).toEqual([
      expect.objectContaining({
        id: "agent-1",
        body: { kind: "agent-message", text: "只渲染一次" }
      })
    ]);
  });

  it("ignores duplicate event ids after a snapshot repair replace", () => {
    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: {
        eventId: "evt-before-repair",
        kind: "agent_message_delta",
        threadId: "thread-1",
        turnId: "turn-1",
        itemId: "agent-1",
        delta: "已处理"
      }
    });
    useStore.getState().setThreadEntries(
      "thread-1",
      [
        {
          id: "agent-1",
          turnId: "turn-1",
          createdAt: 1,
          body: { kind: "agent-message", text: "已处理" }
        }
      ],
      null
    );
    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: {
        eventId: "evt-before-repair",
        kind: "agent_message_delta",
        threadId: "thread-1",
        turnId: "turn-1",
        itemId: "agent-1",
        delta: "已处理"
      }
    });

    expect(useStore.getState().threads["thread-1"]?.entries).toEqual([
      expect.objectContaining({
        id: "agent-1",
        body: { kind: "agent-message", text: "已处理" }
      })
    ]);
  });

  it("ignores older item revisions after a completion has been applied", () => {
    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: {
        eventId: "complete-5",
        revision: 5,
        kind: "item_updated",
        threadId: "thread-1",
        turnId: "turn-1",
        completedAtMs: 1234,
        item: { id: "agent-1", role: "agent", text: "完整回复" }
      }
    });
    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: {
        eventId: "delta-4",
        revision: 4,
        kind: "agent_message_delta",
        threadId: "thread-1",
        turnId: "turn-1",
        itemId: "agent-1",
        delta: "旧增量"
      }
    });

    expect(useStore.getState().threads["thread-1"]?.entries).toEqual([
      expect.objectContaining({
        id: "agent-1",
        body: { kind: "agent-message", text: "完整回复" }
      })
    ]);
  });

  it("keeps item revision protection after generation advances", () => {
    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: {
        eventId: "complete-before-generation",
        revision: 5,
        kind: "item_updated",
        threadId: "thread-1",
        turnId: "turn-1",
        completedAtMs: 1234,
        item: { id: "agent-1", role: "agent", text: "完整回复" }
      }
    });
    useStore.getState().setTimelineGeneration("thread-1", 1);
    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: {
        eventId: "delta-after-generation",
        revision: 4,
        kind: "agent_message_delta",
        threadId: "thread-1",
        turnId: "turn-1",
        itemId: "agent-1",
        delta: "旧增量"
      }
    });

    expect(useStore.getState().threads["thread-1"]?.entries).toEqual([
      expect.objectContaining({
        id: "agent-1",
        body: { kind: "agent-message", text: "完整回复" }
      })
    ]);
  });

  it("does not treat lower revisions in a newer generation as stale for reused item ids", () => {
    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: {
        eventId: "complete-before-generation",
        generation: 0,
        revision: 5,
        kind: "item_updated",
        threadId: "thread-1",
        turnId: "turn-old",
        completedAtMs: 1234,
        item: { id: "agent-1", role: "agent", text: "旧回复" }
      }
    });
    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: {
        eventId: "reasoning-complete-before-generation",
        generation: 0,
        revision: 5,
        kind: "item_updated",
        threadId: "thread-1",
        turnId: "turn-old",
        completedAtMs: 1235,
        item: { id: "reasoning-1", role: "reasoning", text: "旧思考", done: true }
      }
    });
    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: {
        eventId: "tool-complete-before-generation",
        generation: 0,
        revision: 5,
        kind: "item_updated",
        threadId: "thread-1",
        turnId: "turn-old",
        completedAtMs: 1236,
        item: { id: "tool-1", role: "tool", text: "旧工具输出\n", toolKind: "command", server: "command", tool: "command", status: "success" }
      }
    });
    useStore.getState().setTimelineGeneration("thread-1", 1);
    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: {
        eventId: "agent-new-generation",
        generation: 1,
        revision: 1,
        kind: "agent_message_delta",
        threadId: "thread-1",
        turnId: "turn-new",
        itemId: "agent-1",
        delta: "新回复"
      }
    });
    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: {
        eventId: "reasoning-new-generation",
        generation: 1,
        revision: 1,
        kind: "reasoning_delta",
        threadId: "thread-1",
        turnId: "turn-new",
        itemId: "reasoning-1",
        delta: "新思考"
      }
    });
    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: {
        eventId: "tool-new-generation",
        generation: 1,
        revision: 1,
        kind: "command_output_delta",
        threadId: "thread-1",
        turnId: "turn-new",
        itemId: "tool-1",
        delta: "新工具输出\n"
      }
    });

    expect(useStore.getState().threads["thread-1"]?.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "agent-1", body: { kind: "agent-message", text: "旧回复新回复" } }),
        expect.objectContaining({ id: "reasoning-1", body: { kind: "reasoning", text: "旧思考新思考", done: true } }),
        expect.objectContaining({
          id: "tool-1",
          body: expect.objectContaining({ kind: "tool", result: "旧工具输出\n新工具输出\n" })
        })
      ])
    );
  });

  it("merges equivalent live and completed agent/reasoning entries in the same turn even when item ids differ", () => {
    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: {
        eventId: "reasoning-live",
        kind: "reasoning_delta",
        threadId: "thread-1",
        turnId: "turn-1",
        itemId: "reasoning-live-id",
        delta: "Checking working directory in Chinese"
      }
    });
    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: {
        eventId: "reasoning-complete",
        kind: "item_updated",
        threadId: "thread-1",
        turnId: "turn-1",
        completedAtMs: 2,
        item: {
          id: "reasoning-complete-id",
          role: "reasoning",
          text: "Checking working directory in Chinese",
          done: true
        }
      }
    });
    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: {
        eventId: "agent-live",
        kind: "agent_message_delta",
        threadId: "thread-1",
        turnId: "turn-1",
        itemId: "agent-live-id",
        delta: "1 + 1 = 2"
      }
    });
    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: {
        eventId: "agent-complete",
        kind: "item_updated",
        threadId: "thread-1",
        turnId: "turn-1",
        completedAtMs: 3,
        item: { id: "agent-complete-id", role: "agent", text: "1 + 1 = 2" }
      }
    });

    const entries = useStore.getState().threads["thread-1"]?.entries ?? [];
    expect(entries.filter((entry) => entry.body.kind === "reasoning")).toHaveLength(1);
    expect(entries.filter((entry) => entry.body.kind === "agent-message")).toHaveLength(1);
    expect(entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "reasoning-complete-id",
          body: { kind: "reasoning", text: "Checking working directory in Chinese", done: true }
        }),
        expect.objectContaining({
          id: "agent-complete-id",
          body: { kind: "agent-message", text: "1 + 1 = 2" }
        })
      ])
    );
  });

  it("keeps identical agent replies from different turns distinct", () => {
    useStore.getState().appendEntries("thread-1", [
      {
        id: "agent-turn-1",
        turnId: "turn-1",
        createdAt: 1,
        body: { kind: "agent-message", text: "1 + 1 = 2" }
      },
      {
        id: "agent-turn-2",
        turnId: "turn-2",
        createdAt: 2,
        body: { kind: "agent-message", text: "1 + 1 = 2" }
      }
    ]);

    expect(useStore.getState().threads["thread-1"]?.entries.filter((entry) => entry.body.kind === "agent-message")).toHaveLength(2);
  });

  it("does not append replayed deltas already covered by a snapshot repair", () => {
    useStore.getState().setThreadEntries(
      "thread-1",
      [
        {
          id: "agent-1",
          turnId: "turn-1",
          createdAt: 1,
          body: { kind: "agent-message", text: "hello world" }
        }
      ],
      null
    );

    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: {
        eventId: "delta-1",
        kind: "agent_message_delta",
        threadId: "thread-1",
        turnId: "turn-1",
        itemId: "agent-1",
        delta: "hello "
      }
    });
    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: {
        eventId: "delta-2",
        kind: "agent_message_delta",
        threadId: "thread-1",
        turnId: "turn-1",
        itemId: "agent-1",
        delta: "world"
      }
    });
    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: {
        eventId: "delta-3",
        kind: "agent_message_delta",
        threadId: "thread-1",
        turnId: "turn-1",
        itemId: "agent-1",
        delta: "!"
      }
    });

    expect(useStore.getState().threads["thread-1"]?.entries).toEqual([
      expect.objectContaining({
        id: "agent-1",
        body: { kind: "agent-message", text: "hello world!" }
      })
    ]);
  });

  it("suppresses replayed snapshot deltas without a visible store update", () => {
    useStore.getState().setThreadEntries(
      "thread-1",
      [
        {
          id: "agent-1",
          turnId: "turn-1",
          createdAt: 1,
          body: { kind: "agent-message", text: "hello world" }
        }
      ],
      null
    );
    let notifications = 0;
    const unsubscribe = useStore.subscribe(() => {
      notifications += 1;
    });
    const entriesBeforeReplay = useStore.getState().threads["thread-1"]?.entries;

    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: {
        eventId: "replay-covered-delta",
        kind: "agent_message_delta",
        threadId: "thread-1",
        turnId: "turn-1",
        itemId: "agent-1",
        delta: "hello "
      }
    });

    unsubscribe();
    expect(notifications).toBe(0);
    expect(useStore.getState().threads["thread-1"]?.processedEventIds.has("replay-covered-delta")).toBe(true);
    expect(useStore.getState().threads["thread-1"]?.entries).toBe(entriesBeforeReplay);
    expect(useStore.getState().threads["thread-1"]?.entries).toEqual([
      expect.objectContaining({
        id: "agent-1",
        body: { kind: "agent-message", text: "hello world" }
      })
    ]);
  });

  it("does not append replayed middle deltas already covered by a snapshot repair", () => {
    useStore.getState().setThreadEntries(
      "thread-1",
      [
        {
          id: "agent-1",
          turnId: "turn-1",
          snapshotSequence: 10,
          createdAt: 1,
          body: { kind: "agent-message", text: "hello world" }
        },
        {
          id: "reasoning-1",
          turnId: "turn-1",
          snapshotSequence: 10,
          createdAt: 2,
          body: { kind: "reasoning", text: "one two", done: true }
        },
        {
          id: "tool-1",
          turnId: "turn-1",
          snapshotSequence: 10,
          createdAt: 3,
          body: { kind: "tool", server: "command", tool: "command", status: "success", result: "alpha\nbeta\n" }
        }
      ],
      null
    );

    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: {
        eventId: "agent-middle",
        kind: "agent_message_delta",
        threadId: "thread-1",
        turnId: "turn-1",
        itemId: "agent-1",
        sequence: 9,
        delta: "world"
      }
    });
    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: {
        eventId: "reasoning-middle",
        kind: "reasoning_delta",
        threadId: "thread-1",
        turnId: "turn-1",
        itemId: "reasoning-1",
        sequence: 9,
        delta: "two"
      }
    });
    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: {
        eventId: "tool-middle",
        kind: "command_output_delta",
        threadId: "thread-1",
        turnId: "turn-1",
        itemId: "tool-1",
        sequence: 9,
        delta: "beta\n"
      }
    });

    expect(useStore.getState().threads["thread-1"]?.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "agent-1", body: { kind: "agent-message", text: "hello world" } }),
        expect.objectContaining({ id: "reasoning-1", body: { kind: "reasoning", text: "one two", done: true } }),
        expect.objectContaining({
          id: "tool-1",
          body: expect.objectContaining({ kind: "tool", result: "alpha\nbeta\n" })
        })
      ])
    );
  });

  it("applies batch events with the same duplicate and snapshot suppression rules as individual events", () => {
    useStore.getState().setThreadEntries(
      "thread-1",
      [
        {
          id: "agent-1",
          turnId: "turn-1",
          snapshotSequence: 10,
          createdAt: 1,
          body: { kind: "agent-message", text: "hello world" }
        }
      ],
      null
    );

    useStore.getState().dispatchEvent({
      type: "codex-event-batch",
      events: [
        {
          eventId: "covered-delta",
          kind: "agent_message_delta",
          threadId: "thread-1",
          turnId: "turn-1",
          itemId: "agent-1",
          sequence: 9,
          delta: "hello "
        },
        {
          eventId: "tail-delta",
          kind: "agent_message_delta",
          threadId: "thread-1",
          turnId: "turn-1",
          itemId: "agent-1",
          sequence: 11,
          delta: "!"
        },
        {
          eventId: "tail-delta",
          kind: "agent_message_delta",
          threadId: "thread-1",
          turnId: "turn-1",
          itemId: "agent-1",
          sequence: 11,
          delta: "!"
        }
      ]
    });

    expect(useStore.getState().threads["thread-1"]?.processedEventIds.has("covered-delta")).toBe(true);
    expect(useStore.getState().threads["thread-1"]?.processedEventIds.has("tail-delta")).toBe(true);
    expect(useStore.getState().threads["thread-1"]?.entries).toEqual([
      expect.objectContaining({
        id: "agent-1",
        body: { kind: "agent-message", text: "hello world!" }
      })
    ]);
  });

  it("keeps deleted turns and generations isolated when dispatching a delta batch", () => {
    useStore.getState().markTurnDeleted("thread-1", "turn-deleted");
    useStore.getState().dispatchEvent({
      type: "codex-event-batch",
      events: [
        {
          eventId: "deleted-delta",
          kind: "agent_message_delta",
          threadId: "thread-1",
          turnId: "turn-deleted",
          itemId: "agent-deleted",
          generation: 0,
          delta: "不应出现"
        },
        {
          eventId: "generation-0",
          kind: "agent_message_delta",
          threadId: "thread-1",
          turnId: "turn-old",
          itemId: "agent-1",
          generation: 0,
          delta: "旧"
        },
        {
          eventId: "generation-1",
          kind: "agent_message_delta",
          threadId: "thread-1",
          turnId: "turn-new",
          itemId: "agent-1",
          generation: 1,
          delta: "新"
        }
      ]
    });

    expect(useStore.getState().threads["thread-1"]?.entries).toEqual([
      expect.objectContaining({
        id: "agent-1",
        body: { kind: "agent-message", text: "旧新" }
      })
    ]);
    expect(useStore.getState().threads["thread-1"]?.entries.some((entry) => entry.id === "agent-deleted")).toBe(false);
  });

  it("does not suppress a new tail delta that happens to match snapshot text", () => {
    useStore.getState().setThreadEntries(
      "thread-1",
      [
        {
          id: "agent-1",
          turnId: "turn-1",
          snapshotSequence: 10,
          createdAt: 1,
          body: { kind: "agent-message", text: "hello world" }
        }
      ],
      null
    );

    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: {
        eventId: "agent-new-tail",
        kind: "agent_message_delta",
        threadId: "thread-1",
        turnId: "turn-1",
        itemId: "agent-1",
        sequence: 11,
        delta: "world"
      }
    });

    expect(useStore.getState().threads["thread-1"]?.entries).toEqual([
      expect.objectContaining({
        id: "agent-1",
        body: { kind: "agent-message", text: "hello worldworld" }
      })
    ]);
  });

  it("does not suppress a delta from a newer generation even when it matches snapshot text", () => {
    useStore.getState().setThreadEntries(
      "thread-1",
      [
        {
          id: "agent-1",
          turnId: "turn-old",
          generation: 0,
          snapshotSequence: 10,
          createdAt: 1,
          body: { kind: "agent-message", text: "repeat" }
        }
      ],
      null
    );

    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: {
        eventId: "agent-new-generation-repeat",
        kind: "agent_message_delta",
        threadId: "thread-1",
        turnId: "turn-new",
        itemId: "agent-1",
        generation: 1,
        sequence: 9,
        delta: "repeat"
      }
    });

    expect(useStore.getState().threads["thread-1"]?.entries).toEqual([
      expect.objectContaining({
        id: "agent-1",
        body: { kind: "agent-message", text: "repeatrepeat" }
      })
    ]);
  });

  it("marks the owning thread for snapshot repair when the event stream reports a thread gap", () => {
    useStore.getState().setActiveThread("thread-1");

    useStore.getState().dispatchEvent({ type: "timeline-gap", threadId: "thread-2", lastEventId: "missing" });

    expect(useStore.getState().threads["thread-1"]?.repairRequestedAt).toBeUndefined();
    expect(useStore.getState().threads["thread-2"]?.repairRequestedAt).toEqual(expect.any(Number));
  });

  it("does not repair the active thread when a timeline gap has no reliable owner", () => {
    useStore.getState().setActiveThread("thread-1");

    useStore.getState().dispatchEvent({ type: "timeline-gap", lastEventId: "missing" });

    expect(useStore.getState().threads["thread-1"]?.repairRequestedAt).toBeUndefined();
  });

  it("streams plan deltas into visible timeline entries", () => {
    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: {
        kind: "plan_delta",
        threadId: "thread-1",
        turnId: "turn-1",
        itemId: "plan-1",
        delta: "1. 检查事件\n"
      }
    });
    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: {
        kind: "plan_delta",
        threadId: "thread-1",
        turnId: "turn-1",
        itemId: "plan-1",
        delta: "2. 修复渲染\n"
      }
    });

    expect(useStore.getState().threads["thread-1"]?.entries).toEqual([
      expect.objectContaining({
        id: "plan-1",
        body: { kind: "system", text: "1. 检查事件\n2. 修复渲染\n" }
      })
    ]);
  });

  it("streams reasoning deltas and replaces them with completed reasoning item", () => {
    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: {
        kind: "reasoning_delta",
        threadId: "thread-1",
        turnId: "turn-1",
        itemId: "reasoning-1",
        delta: "第一段"
      }
    });
    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: {
        kind: "reasoning_delta",
        threadId: "thread-1",
        turnId: "turn-1",
        itemId: "reasoning-1",
        delta: "第二段"
      }
    });

    expect(useStore.getState().threads["thread-1"]?.entries).toEqual([
      expect.objectContaining({
        id: "reasoning-1",
        body: { kind: "reasoning", text: "第一段第二段", done: false }
      })
    ]);

    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: {
        kind: "item_updated",
        threadId: "thread-1",
        turnId: "turn-1",
        completedAtMs: 1234,
        item: { id: "reasoning-1", role: "reasoning", text: "完整推理" }
      }
    });

    expect(useStore.getState().threads["thread-1"]?.entries).toEqual([
      expect.objectContaining({
        id: "reasoning-1",
        createdAt: 1234,
        body: { kind: "reasoning", text: "完整推理", done: true }
      })
    ]);
  });

  it("creates a running reasoning entry before text deltas arrive", () => {
    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: {
        kind: "reasoning_started",
        threadId: "thread-1",
        turnId: "turn-1",
        itemId: "reasoning-1"
      }
    });

    expect(useStore.getState().threads["thread-1"]?.entries).toEqual([
      expect.objectContaining({
        id: "reasoning-1",
        body: { kind: "reasoning", text: "", done: false }
      })
    ]);
  });

  it("does not clear reasoning text when start arrives after deltas", () => {
    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: {
        kind: "reasoning_delta",
        threadId: "thread-1",
        turnId: "turn-1",
        itemId: "reasoning-1",
        delta: "已经收到的推理"
      }
    });
    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: {
        kind: "reasoning_started",
        threadId: "thread-1",
        turnId: "turn-1",
        itemId: "reasoning-1"
      }
    });

    expect(useStore.getState().threads["thread-1"]?.entries).toEqual([
      expect.objectContaining({
        id: "reasoning-1",
        body: { kind: "reasoning", text: "已经收到的推理", done: false }
      })
    ]);
  });

  it("does not clear reasoning text when a completed item has empty text", () => {
    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: {
        kind: "reasoning_delta",
        threadId: "thread-1",
        turnId: "turn-1",
        itemId: "reasoning-1",
        delta: "流式推理摘要"
      }
    });
    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: {
        kind: "item_updated",
        threadId: "thread-1",
        turnId: "turn-1",
        completedAtMs: 1234,
        item: { id: "reasoning-1", role: "reasoning", text: "" }
      }
    });

    expect(useStore.getState().threads["thread-1"]?.entries).toEqual([
      expect.objectContaining({
        id: "reasoning-1",
        createdAt: 1234,
        body: { kind: "reasoning", text: "流式推理摘要", done: true }
      })
    ]);
  });

  it("creates a pending reasoning placeholder when a turn starts", () => {
    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: { kind: "turn_started", threadId: "thread-1", turnId: "turn-1" }
    });

    expect(useStore.getState().threads["thread-1"]?.entries).toEqual([
      expect.objectContaining({
        id: "turn-1-reasoning-pending",
        body: { kind: "reasoning", text: "", done: false }
      })
    ]);
  });

  it("replaces the pending reasoning placeholder with real reasoning deltas", () => {
    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: { kind: "turn_started", threadId: "thread-1", turnId: "turn-1" }
    });
    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: {
        kind: "reasoning_delta",
        threadId: "thread-1",
        turnId: "turn-1",
        itemId: "reasoning-1",
        delta: "公开推理摘要"
      }
    });

    expect(useStore.getState().threads["thread-1"]?.entries).toEqual([
      expect.objectContaining({
        id: "reasoning-1",
        body: { kind: "reasoning", text: "公开推理摘要", done: false }
      })
    ]);
  });

  it("removes an empty pending reasoning placeholder when a turn completes", () => {
    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: { kind: "turn_started", threadId: "thread-1", turnId: "turn-1" }
    });
    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: { kind: "turn_completed", threadId: "thread-1", turnId: "turn-1", status: "completed" }
    });

    expect(useStore.getState().threads["thread-1"]?.entries).toEqual([]);
  });

  it("streams command output deltas into the same running tool entry", () => {
    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: {
        kind: "command_output_delta",
        threadId: "thread-1",
        turnId: "turn-1",
        itemId: "cmd-1",
        delta: "one\n"
      }
    });
    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: {
        kind: "command_output_delta",
        threadId: "thread-1",
        turnId: "turn-1",
        itemId: "cmd-1",
        delta: "two\n"
      }
    });

    expect(useStore.getState().threads["thread-1"]?.entries).toEqual([
      expect.objectContaining({
        id: "cmd-1",
        body: expect.objectContaining({
          kind: "tool",
          toolKind: "command",
          server: "command",
          tool: "command",
          result: "one\ntwo\n",
          status: "running"
        })
      })
    ]);
  });

  it("does not lose streamed tool output when completion has empty result", () => {
    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: {
        kind: "command_output_delta",
        threadId: "thread-1",
        turnId: "turn-1",
        itemId: "cmd-1",
        delta: "already streamed\n"
      }
    });
    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: {
        kind: "item_updated",
        threadId: "thread-1",
        turnId: "turn-1",
        completedAtMs: 1234,
        item: {
          id: "cmd-1",
          role: "tool",
          text: "",
          toolKind: "command",
          server: "command",
          tool: "command",
          status: "success"
        }
      }
    });

    expect(useStore.getState().threads["thread-1"]?.entries).toEqual([
      expect.objectContaining({
        id: "cmd-1",
        body: expect.objectContaining({
          kind: "tool",
          result: "already streamed\n",
          status: "success"
        })
      })
    ]);
  });

  it("preserves non-file tool progress kind instead of rendering it as file output", () => {
    const cases = [
      { id: "mcp-1", server: "mcp", tool: "progress", toolKind: "mcp" as const },
      { id: "dynamic-1", server: "dynamic", tool: "browser.search", toolKind: "dynamic" as const },
      { id: "sub-agent-1", server: "sub-agent", tool: "activity", toolKind: "dynamic" as const },
      { id: "collab-1", server: "collab", tool: "agent", toolKind: "dynamic" as const }
    ];

    for (const item of cases) {
      useStore.getState().dispatchEvent({
        type: "codex-event",
        event: {
          kind: "tool_output_delta",
          threadId: "thread-1",
          turnId: "turn-1",
          itemId: item.id,
          delta: `${item.server} 正在执行\n`,
          server: item.server,
          tool: item.tool,
          toolKind: item.toolKind
        }
      });
    }

    expect(useStore.getState().threads["thread-1"]?.entries).toEqual(
      cases.map((item) =>
        expect.objectContaining({
          id: item.id,
          body: expect.objectContaining({
            kind: "tool",
            toolKind: item.toolKind,
            server: item.server,
            tool: item.tool,
            result: `${item.server} 正在执行\n`,
            status: "running"
          })
        })
      )
    );

    for (const entry of useStore.getState().threads["thread-1"]?.entries ?? []) {
      expect(entry.body).toEqual(expect.objectContaining({ kind: "tool" }));
      if (entry.body.kind === "tool") {
        expect(entry.body.server).not.toBe("file");
        expect(entry.body.tool).not.toBe("file");
      }
    }
  });

  it("keeps real file-change output on the file tool card", () => {
    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: {
        kind: "file_output_delta",
        threadId: "thread-1",
        turnId: "turn-1",
        itemId: "file-1",
        delta: "写入 src/app.ts\n"
      }
    });

    expect(useStore.getState().threads["thread-1"]?.entries).toEqual([
      expect.objectContaining({
        id: "file-1",
        body: expect.objectContaining({
          kind: "tool",
          server: "file",
          tool: "file",
          result: "写入 src/app.ts\n",
          status: "running"
        })
      })
    ]);
  });

  it("merges running snapshots without deleting live deltas", () => {
    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: {
        kind: "agent_message_delta",
        threadId: "thread-1",
        turnId: "turn-1",
        itemId: "agent-live",
        delta: "直播输出"
      }
    });

    useStore.getState().mergeThreadEntries(
      "thread-1",
      [
        {
          id: "user-1",
          createdAt: 10,
          body: { kind: "user-message", text: "问题", status: "sent" }
        }
      ],
      null
    );

    expect(useStore.getState().threads["thread-1"]?.entries.map((entry) => entry.id)).toEqual([
      "agent-live",
      "user-1"
    ]);

    useStore.getState().mergeThreadEntries(
      "thread-1",
      [
        {
          id: "agent-live",
          createdAt: 20,
          body: { kind: "agent-message", text: "直播输出完成" }
        }
      ],
      null
    );

    expect(useStore.getState().threads["thread-1"]?.entries[0]).toEqual(
      expect.objectContaining({
        id: "agent-live",
        body: { kind: "agent-message", text: "直播输出完成" }
      })
    );
  });

  it("replaces local optimistic user messages in place once a later snapshot confirms them", () => {
    useStore.getState().appendEntries("thread-1", [
      {
        id: "local-user-1",
        createdAt: 100,
        body: { kind: "user-message", text: "帮我看一下母乳结构", status: "sending" }
      },
      {
        id: "agent-live",
        createdAt: 101,
        body: { kind: "agent-message", text: "正在看" }
      }
    ]);

    useStore.getState().mergeThreadEntries(
      "thread-1",
      [
        {
          id: "server-user-1",
          createdAt: 102,
          body: { kind: "user-message", text: "帮我看一下母乳结构", status: "sent" }
        }
      ],
      null
    );

    expect(useStore.getState().threads["thread-1"]?.entries).toEqual([
      expect.objectContaining({ id: "server-user-1" }),
      expect.objectContaining({ id: "agent-live" })
    ]);
  });

  it("keeps paginated timeline pages in stable order when page-local turnIndex values repeat", () => {
    const turnEntries = (turnId: string, turnIndex: number, createdAt: number) => [
      {
        id: `${turnId}-user`,
        turnId,
        turnIndex,
        createdAt,
        body: { kind: "user-message" as const, text: `问题 ${turnId}`, status: "sent" as const }
      },
      {
        id: `${turnId}-agent`,
        turnId,
        turnIndex,
        createdAt: createdAt + 1,
        body: { kind: "agent-message" as const, text: `回答 ${turnId}` }
      }
    ];

    useStore.getState().setThreadEntries(
      "thread-1",
      [...turnEntries("turn-3", 0, 30), ...turnEntries("turn-4", 1, 40)],
      "older-cursor"
    );
    useStore.getState().prependEntries(
      "thread-1",
      [...turnEntries("turn-1", 0, 10), ...turnEntries("turn-2", 1, 20)],
      null,
      true
    );

    expect(useStore.getState().threads["thread-1"]?.entries.map((entry) => entry.id)).toEqual([
      "turn-1-user",
      "turn-1-agent",
      "turn-2-user",
      "turn-2-agent",
      "turn-3-user",
      "turn-3-agent",
      "turn-4-user",
      "turn-4-agent"
    ]);
  });

  it("dedupes duplicate local user messages before the server confirms them", () => {
    useStore.getState().appendEntries("thread-1", [
      {
        id: "local-user-1",
        createdAt: 100,
        body: { kind: "user-message", text: "只发送一次", status: "sending" }
      }
    ]);
    useStore.getState().appendEntries("thread-1", [
      {
        id: "local-user-2",
        createdAt: 101,
        body: { kind: "user-message", text: "只发送一次", status: "sending" }
      }
    ]);

    expect(useStore.getState().threads["thread-1"]?.entries).toEqual([
      expect.objectContaining({ id: "local-user-1" })
    ]);
  });

  it("keeps same-text local user messages distinct after they are bound to different turns", () => {
    useStore.getState().appendEntries("thread-1", [
      {
        id: "local-user-1",
        turnId: "turn-1",
        clientUserMessageId: "local-user-1",
        createdAt: 100,
        body: { kind: "user-message", text: "继续", status: "sent" }
      },
      {
        id: "local-user-2",
        turnId: "turn-2",
        clientUserMessageId: "local-user-2",
        createdAt: 101,
        body: { kind: "user-message", text: "继续", status: "sent" }
      }
    ]);

    expect(useStore.getState().threads["thread-1"]?.entries.map((entry) => entry.id)).toEqual([
      "local-user-1",
      "local-user-2"
    ]);

    useStore.getState().replaceOrAddEntry("thread-1", {
      id: "server-user-2",
      turnId: "turn-2",
      createdAt: 102,
      body: { kind: "user-message", text: "继续", status: "sent" }
    });

    expect(useStore.getState().threads["thread-1"]?.entries).toEqual([
      expect.objectContaining({ id: "local-user-1", turnId: "turn-1" }),
      expect.objectContaining({ id: "server-user-2", turnId: "turn-2" })
    ]);
  });

  it("replaces the local user message in place when a websocket item confirms the same prompt", () => {
    useStore.getState().appendEntries("thread-1", [
      {
        id: "local-user-1",
        createdAt: 100,
        body: { kind: "user-message", text: "确认我", status: "sending" }
      },
      {
        id: "agent-live",
        createdAt: 101,
        body: { kind: "agent-message", text: "处理中" }
      }
    ]);

    useStore.getState().replaceOrAddEntry("thread-1", {
      id: "server-user-1",
      createdAt: 102,
      body: { kind: "user-message", text: "确认我", status: "sent" }
    });

    expect(useStore.getState().threads["thread-1"]?.entries).toEqual([
      expect.objectContaining({ id: "server-user-1" }),
      expect.objectContaining({ id: "agent-live" })
    ]);
  });

  it("keeps adjacent same-text confirmed user messages distinct without shared turn metadata", () => {
    useStore.getState().setThreadEntries(
      "thread-1",
      [
        {
          id: "server-user-1",
          createdAt: 100,
          body: { kind: "user-message", text: "相同内容", status: "sent" }
        },
        {
          id: "server-user-2",
          createdAt: 101,
          body: { kind: "user-message", text: "相同内容", status: "sent" }
        },
        {
          id: "agent-1",
          createdAt: 102,
          body: { kind: "agent-message", text: "回复" }
        }
      ],
      null
    );

    expect(useStore.getState().threads["thread-1"]?.entries.map((entry) => entry.id)).toEqual([
      "server-user-1",
      "server-user-2",
      "agent-1"
    ]);
  });

  it("shows context compaction completion as a system timeline entry", () => {
    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: { kind: "context_compacted", threadId: "thread-1", turnId: "turn-1" }
    });

    expect(useStore.getState().threads["thread-1"]?.entries).toEqual([
      expect.objectContaining({
        id: "turn-1-context-compacted",
        body: { kind: "system", text: "压缩上下文已完成" }
      })
    ]);
  });

  it("renders turn diff updates with computed line stats", () => {
    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: {
        kind: "turn_diff_updated",
        threadId: "thread-1",
        turnId: "turn-1",
        diff: [
          "diff --git a/src/app.ts b/src/app.ts",
          "--- a/src/app.ts",
          "+++ b/src/app.ts",
          "@@ -1,2 +1,3 @@",
          " unchanged",
          "-old",
          "+new",
          "+added"
        ].join("\n")
      }
    });

    expect(useStore.getState().threads["thread-1"]?.entries).toEqual([
      expect.objectContaining({
        id: "turn-1-diff",
        body: expect.objectContaining({
          kind: "diff",
          path: "工作区变更",
          added: 2,
          removed: 1
        })
      })
    ]);
  });

  it("syncs thread mode, model, and reasoning effort from settings update events", () => {
    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: {
        kind: "thread_settings_updated",
        threadId: "thread-1",
        model: "gpt-5-codex",
        reasoningEffort: "high",
        collaborationMode: "plan"
      }
    });

    expect(useStore.getState().threads["thread-1"]).toEqual(
      expect.objectContaining({
        mode: "plan",
        model: "gpt-5-codex",
        modelEffort: "high"
      })
    );
  });

  it("renders app-server warnings and turn errors as timeline error cards", () => {
    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: { kind: "warning", threadId: "thread-1", message: "配置警告" }
    });
    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: {
        kind: "turn_error",
        threadId: "thread-1",
        turnId: "turn-1",
        message: "API 调用失败：502 Bad Gateway",
        willRetry: false
      }
    });

    expect(useStore.getState().threads["thread-1"]?.entries).toEqual([
      expect.objectContaining({
        id: expect.stringMatching(/warning/),
        body: { kind: "error", text: "配置警告" }
      }),
      expect.objectContaining({
        id: "turn-1-error",
        body: { kind: "error", text: "API 调用失败：502 Bad Gateway" }
      })
    ]);
  });

  it("upserts completed timeline items from websocket events", () => {
    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: {
        kind: "item_updated",
        threadId: "thread-1",
        turnId: "turn-1",
        completedAtMs: 1234,
        item: { id: "agent-1", role: "agent", text: "完整回复" }
      }
    });

    expect(useStore.getState().threads["thread-1"]?.entries).toEqual([
      expect.objectContaining({
        id: "agent-1",
        createdAt: 1234,
        body: { kind: "agent-message", text: "完整回复" }
      })
    ]);
  });

  it("normalizes pending server requests restored from the HTTP API", () => {
    useStore.getState().setPendingRequests([
      {
        requestId: "req-question",
        threadId: "thread-1",
        kind: "question",
        title: "需要你回答",
        description: "请选择模式",
        options: [{ value: "fast", label: "快速" }],
        params: {
          questions: [{ id: "mode", question: "请选择模式" }]
        }
      }
    ]);

    expect(useStore.getState().threads["thread-1"]?.pendingApprovals).toEqual([
      expect.objectContaining({
        requestId: "req-question",
        request: {
          questions: [{ id: "mode", question: "请选择模式" }]
        }
      })
    ]);
  });

  it("keeps long-thread timeline updates within a linear complexity budget", () => {
    const makeAgentEntry = (index: number) => ({
      id: `agent-${index}`,
      turnId: `turn-${index}`,
      turnIndex: index,
      createdAt: index,
      body: { kind: "agent-message" as const, text: `回复 ${index}` }
    });
    const initialEntries = Array.from({ length: 1200 }, (_value, index) => makeAgentEntry(index));

    useStore.getState().setThreadEntries("thread-long", initialEntries, "cursor-older");
    useStore.getState().__resetTimelineDiagnostics?.();

    for (let index = 0; index < 200; index += 1) {
      useStore.getState().appendTextToEntry("thread-long", {
        id: "agent-1199",
        turnId: "turn-1199",
        turnIndex: 1199,
        createdAt: 2000 + index,
        body: { kind: "agent-message", text: "x" }
      });
    }

    useStore.getState().mergeThreadEntries(
      "thread-long",
      Array.from({ length: 40 }, (_value, index) => makeAgentEntry(1200 + index)),
      "cursor-even-older"
    );

    const diagnostics = useStore.getState().__getTimelineDiagnostics?.();
    expect(diagnostics).toEqual(
      expect.objectContaining({
        normalizeRuns: expect.any(Number),
        entryIndexBuildEntries: expect.any(Number),
        linearEntryScans: expect.any(Number),
        equivalentOutputCandidateChecks: expect.any(Number)
      })
    );
    expect(diagnostics!.normalizeRuns).toBeLessThanOrEqual(2);
    expect(diagnostics!.entryIndexBuildEntries).toBeLessThanOrEqual(1400);
    expect(diagnostics!.linearEntryScans).toBeLessThanOrEqual(3000);
    expect(diagnostics!.equivalentOutputCandidateChecks).toBeLessThanOrEqual(2000);
    expect(useStore.getState().threads["thread-long"]?.entries).toHaveLength(1240);
    expect(useStore.getState().threads["thread-long"]?.entries.at(-41)).toEqual(
      expect.objectContaining({
        id: "agent-1199",
        body: { kind: "agent-message", text: `回复 1199${"x".repeat(200)}` }
      })
    );
  });
});
