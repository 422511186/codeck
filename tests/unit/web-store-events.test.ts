import { beforeEach, describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getContextUsage } from "../../src/web/storage/contextUsage";
import { useStore } from "../../src/web/state/store";
import { timelineEventLedgerKey } from "../../src/web/state/timeline-engine";

describe("web store codex events", () => {
  beforeEach(() => {
    useStore.setState({
      wsState: "idle",
      appServer: null,
      threads: {},
      activeThreadId: null,
      skillsCacheVersion: 0
    });
    window.localStorage.clear();
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

  it("updates thread status from app-server status events without appending timeline content", () => {
    useStore.getState().setThreadStatus("thread-1", "active", "turn-live");

    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: {
        kind: "thread_status_changed",
        threadId: "thread-1",
        status: "idle",
        eventId: "status-idle-1"
      }
    });

    const idleThread = useStore.getState().threads["thread-1"] as { status?: string; running?: boolean; activeTurnId?: string | null; entries?: unknown[] };
    expect(idleThread.status).toBe("idle");
    expect(idleThread.running).toBe(false);
    expect(idleThread.activeTurnId).toBeNull();
    expect(idleThread.entries).toEqual([]);

    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: {
        kind: "thread_status_changed",
        threadId: "thread-1",
        status: "notLoaded",
        eventId: "status-not-loaded-1"
      }
    });

    const notLoadedThread = useStore.getState().threads["thread-1"] as { status?: string; running?: boolean };
    expect(notLoadedThread.status).toBe("notLoaded");
    expect(notLoadedThread.running).toBe(false);

    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: {
        kind: "thread_status_changed",
        threadId: "thread-1",
        status: "active",
        activeFlags: [],
        eventId: "status-active-1"
      }
    });

    const activeThread = useStore.getState().threads["thread-1"] as { status?: string; running?: boolean; activeTurnId?: string | null; entries?: unknown[] };
    expect(activeThread.status).toBe("active");
    expect(activeThread.running).toBe(true);
    expect(activeThread.entries).toEqual([]);
  });

  it("finishes empty pending reasoning when an idle status arrives for the active turn", () => {
    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: { kind: "turn_started", threadId: "thread-1", turnId: "turn-1" }
    });

    expect(useStore.getState().threads["thread-1"]?.entries).toEqual([
      expect.objectContaining({
        id: "turn-1-reasoning-pending",
        turnId: "turn-1",
        body: { kind: "reasoning", text: "", done: false }
      })
    ]);

    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: {
        kind: "thread_status_changed",
        threadId: "thread-1",
        status: "idle",
        eventId: "status-idle-finish-reasoning"
      }
    });

    const thread = useStore.getState().threads["thread-1"];
    expect(thread?.status).toBe("idle");
    expect(thread?.running).toBe(false);
    expect(thread?.activeTurnId).toBeNull();
    expect(thread?.entries).toEqual([]);
    expect(thread?.repairRequestedAt).toBeNull();
    expect(thread?.repairRequest).toBeNull();
  });

  it("finishes running activity entries when an idle status arrives for the active turn", () => {
    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: { kind: "turn_started", threadId: "thread-1", turnId: "turn-1" }
    });
    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: {
        kind: "command_output_delta",
        threadId: "thread-1",
        turnId: "turn-1",
        itemId: "cmd-tool-1",
        delta: "npm test\n"
      }
    });
    useStore.getState().mergeThreadEntries(
      "thread-1",
      [
        {
          id: "legacy-command-1",
          turnId: "turn-1",
          createdAt: 10,
          body: { kind: "command", status: "running", command: "npm test", output: "pending" }
        }
      ],
      null
    );

    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: {
        kind: "thread_status_changed",
        threadId: "thread-1",
        status: "idle",
        eventId: "status-idle-finish-activity"
      }
    });

    const thread = useStore.getState().threads["thread-1"];
    expect(thread?.running).toBe(false);
    expect(thread?.activeTurnId).toBeNull();
    expect(thread?.repairRequestedAt).toBeNull();
    expect(thread?.repairRequest).toBeNull();
    expect(thread?.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "cmd-tool-1",
          turnId: "turn-1",
          body: expect.objectContaining({ kind: "tool", status: "success", result: "npm test\n" })
        }),
        expect.objectContaining({
          id: "legacy-command-1",
          turnId: "turn-1",
          body: expect.objectContaining({ kind: "command", status: "success", command: "npm test" })
        })
      ])
    );
    expect(thread?.entries.some((entry) => entry.body.kind === "reasoning" && entry.body.done === false)).toBe(false);
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
    expect(
      useStore.getState().threads["thread-1"]?.timelineEngine.diagnostics.droppedStaleGenerationEvents
    ).toBeGreaterThanOrEqual(1);
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

  it("keeps item_updated completion on the same stamped identity as its live deltas", () => {
    const bootId = "boot-live-item-update";
    const threadId = "thread-live-item-update";
    const turnId = "turn-live-item-update";

    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: {
        kind: "item_updated",
        eventId: "item-created",
        threadId,
        turnId,
        bootId,
        generation: 0,
        revision: 1,
        item: { id: "msg-live", role: "agent", text: "" }
      }
    });
    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: {
        kind: "agent_message_delta",
        eventId: "delta-live",
        threadId,
        turnId,
        itemId: "msg-live",
        bootId,
        generation: 0,
        revision: 2,
        fragmentSequence: 1,
        delta: "实时回复"
      }
    });
    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: {
        kind: "item_updated",
        eventId: "item-completed",
        threadId,
        turnId,
        bootId,
        generation: 0,
        revision: 3,
        item: { id: "msg-live", role: "agent", text: "实时回复" }
      }
    });

    expect(useStore.getState().threads[threadId]?.entries).toEqual([
      expect.objectContaining({
        id: "msg-live",
        bootId,
        historyStamp: { bootId, generation: 0 },
        body: { kind: "agent-message", text: "实时回复" }
      })
    ]);
  });

  it("preserves interleaved activity order inside a turn instead of hoisting activity before agent messages", () => {
    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: {
        kind: "item_updated",
        threadId: "thread-1",
        turnId: "turn-1",
        item: { id: "agent-1", role: "agent", text: "先说明第一段" }
      }
    });
    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: {
        kind: "command_output_delta",
        threadId: "thread-1",
        turnId: "turn-1",
        itemId: "cmd-1",
        delta: "npm test\npassed\n"
      }
    });
    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: {
        kind: "item_updated",
        threadId: "thread-1",
        turnId: "turn-1",
        item: { id: "agent-2", role: "agent", text: "再说明第二段" }
      }
    });

    expect(useStore.getState().threads["thread-1"]?.entries.map((entry) => entry.id)).toEqual([
      "agent-1",
      "cmd-1",
      "agent-2"
    ]);
  });

  it("keeps an existing activity entry in place when its completion arrives after the final assistant message", () => {
    useStore.getState().setThreadEntries(
      "thread-1",
      [
        {
          id: "user-1",
          turnId: "turn-1",
          createdAt: 1,
          body: { kind: "user-message", text: "review", status: "sent" }
        },
        {
          id: "read-files",
          turnId: "turn-1",
          createdAt: 2,
          body: {
            kind: "tool",
            toolKind: "file",
            server: "file",
            tool: "read",
            status: "running",
            result: "reading"
          }
        },
        {
          id: "agent-final",
          turnId: "turn-1",
          createdAt: 3,
          body: { kind: "agent-message", text: "final answer" }
        }
      ],
      null
    );

    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: {
        kind: "item_updated",
        threadId: "thread-1",
        turnId: "turn-1",
        completedAtMs: 100,
        item: {
          id: "read-files",
          role: "tool",
          text: "read src/web/state/store.ts",
          toolKind: "file",
          server: "file",
          tool: "read",
          status: "success"
        }
      }
    });

    expect(useStore.getState().threads["thread-1"]?.entries.map((entry) => entry.id)).toEqual([
      "user-1",
      "read-files",
      "agent-final"
    ]);
  });

  it("merges timeline content reference preview with later complete item", () => {
    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: {
        kind: "timeline_content_reference",
        threadId: "thread-1",
        turnId: "turn-1",
        itemId: "tool-reference",
        originalKind: "item_updated",
        itemRole: "tool",
        toolKind: "command",
        server: "command",
        tool: "npm test",
        status: "success",
        preview: "preview output",
        contentRef: "tlc-reference",
        completeness: {
          status: "truncated",
          reason: "event-budget",
          originalBytes: 500_000,
          includedBytes: 14,
          contentRef: "tlc-reference"
        },
        eventId: "thread-1:7:9:item_updated",
        revision: 7,
        sequence: 9,
        generation: 1
      }
    });

    expect(useStore.getState().threads["thread-1"]?.entries).toEqual([
      expect.objectContaining({
        id: "tool-reference",
        completeness: expect.objectContaining({ status: "truncated", contentRef: "tlc-reference" }),
        body: expect.objectContaining({ kind: "tool", result: "preview output" })
      })
    ]);

    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: {
        kind: "item_updated",
        threadId: "thread-1",
        turnId: "turn-1",
        completedAtMs: 10,
        item: {
          id: "tool-reference",
          role: "tool",
          text: "preview output + complete",
          toolKind: "command",
          server: "command",
          tool: "npm test",
          status: "success",
          completeness: { status: "complete", originalBytes: 25, includedBytes: 25 }
        },
        eventId: "thread-1:8:10:item_updated",
        revision: 8,
        sequence: 10,
        generation: 1
      }
    });

    expect(useStore.getState().threads["thread-1"]?.entries).toEqual([
      expect.objectContaining({
        id: "tool-reference",
        completeness: expect.objectContaining({ status: "complete" }),
        body: expect.objectContaining({ kind: "tool", result: "preview output + complete" })
      })
    ]);
  });

  it("keeps a late completed activity at its source delivery position when no anchor is provided", () => {
    useStore.getState().setThreadEntries(
      "thread-1",
      [
        {
          id: "user-1",
          turnId: "turn-1",
          createdAt: 1,
          body: { kind: "user-message", text: "review", status: "sent" }
        },
        {
          id: "agent-final",
          turnId: "turn-1",
          createdAt: 3,
          body: { kind: "agent-message", text: "final answer" }
        }
      ],
      null
    );

    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: {
        kind: "item_updated",
        threadId: "thread-1",
        turnId: "turn-1",
        completedAtMs: 100,
        item: {
          id: "read-files",
          role: "tool",
          text: "read src/web/state/store.ts",
          toolKind: "file",
          server: "file",
          tool: "read",
          status: "success"
        }
      }
    });

    expect(useStore.getState().threads["thread-1"]?.entries.map((entry) => entry.id)).toEqual([
      "user-1",
      "agent-final",
      "read-files"
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

  it("records accepted single-event revisions and rejects older replay", () => {
    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: {
        eventId: "revision-2",
        revision: 2,
        kind: "agent_message_delta",
        threadId: "thread-revision",
        turnId: "turn-1",
        itemId: "agent-1",
        delta: "new"
      }
    });
    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: {
        eventId: "revision-1",
        revision: 1,
        kind: "agent_message_delta",
        threadId: "thread-revision",
        turnId: "turn-1",
        itemId: "agent-1",
        delta: "old"
      }
    });

    expect(useStore.getState().threads["thread-revision"]?.entries).toEqual([
      expect.objectContaining({ body: { kind: "agent-message", text: "new" } })
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
    expect(useStore.getState().threads["thread-1"]?.processedEventIds.has(timelineEventLedgerKey(0, "evt-visible-delta"))).toBe(true);
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
          snapshotSequence: 10,
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

    const entries = useStore.getState().threads["thread-1"]?.entries ?? [];
    expect(entries.filter((entry) => entry.body.kind === "agent-message")).toEqual([
      expect.objectContaining({ id: "agent-1", turnId: "turn-old", body: { kind: "agent-message", text: "旧回复" } }),
      expect.objectContaining({ id: "agent-1", turnId: "turn-new", body: { kind: "agent-message", text: "新回复" } })
    ]);
    expect(entries.filter((entry) => entry.body.kind === "reasoning")).toEqual([
      expect.objectContaining({ id: "reasoning-1", turnId: "turn-old", body: { kind: "reasoning", text: "旧思考", done: true } }),
      expect.objectContaining({ id: "reasoning-1", turnId: "turn-new", body: { kind: "reasoning", text: "新思考", done: false } })
    ]);
    expect(entries.filter((entry) => entry.body.kind === "tool")).toEqual([
      expect.objectContaining({
        id: "tool-1",
        turnId: "turn-old",
        body: expect.objectContaining({ kind: "tool", result: "旧工具输出\n" })
      }),
      expect.objectContaining({
        id: "tool-1",
        turnId: "turn-new",
        body: expect.objectContaining({ kind: "tool", result: "新工具输出\n" })
      })
    ]);
  });

  it("does not dedupe reused event ids across newer generations", () => {
    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: {
        eventId: "reused-event-id",
        generation: 0,
        kind: "agent_message_delta",
        threadId: "thread-1",
        turnId: "turn-old",
        itemId: "agent-1",
        delta: "旧 generation"
      }
    });
    useStore.getState().setTimelineGeneration("thread-1", 1);
    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: {
        eventId: "reused-event-id",
        generation: 1,
        kind: "agent_message_delta",
        threadId: "thread-1",
        turnId: "turn-new",
        itemId: "agent-1",
        delta: "新 generation"
      }
    });

    expect(useStore.getState().threads["thread-1"]?.entries).toEqual([
      expect.objectContaining({
        id: "agent-1",
        turnId: "turn-old",
        body: { kind: "agent-message", text: "旧 generation" }
      }),
      expect.objectContaining({
        id: "agent-1",
        turnId: "turn-new",
        body: { kind: "agent-message", text: "新 generation" }
      })
    ]);
  });

  it("只将不同 ID 的 live agent provisional 收敛到 canonical，并保持 reasoning 独立", () => {
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
    expect(entries.filter((entry) => entry.body.kind === "reasoning")).toHaveLength(2);
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
    expect(entries.some((entry) => entry.id === "agent-live-id")).toBe(false);
    expect(useStore.getState().__getTimelineDiagnostics?.()?.agentAliasReconciliations).toBe(1);
  });

  it("双向收敛 raw response item 与 canonical item 的不同 ID", () => {
    const dispatchItem = (
      turnId: string,
      id: string,
      text: string,
      raw: boolean,
      eventId: string
    ) => useStore.getState().dispatchEvent({
      type: "codex-event",
      event: {
        eventId,
        kind: "item_updated",
        threadId: "thread-1",
        turnId,
        item: {
          id,
          role: "agent",
          text,
          ...(raw
            ? {
                sourceLocator: {
                  sourceKind: "response" as const,
                  sourceId: `response-${turnId}`,
                  absoluteOutputIndex: 0
                }
              }
            : {})
        }
      }
    });

    dispatchItem("turn-raw-first", "agent-raw-1", "raw 先到", true, "raw-first");
    dispatchItem("turn-raw-first", "agent-canonical-1", "raw 先到", false, "canonical-second");
    dispatchItem("turn-canonical-first", "agent-canonical-2", "canonical 先到", false, "canonical-first");
    dispatchItem("turn-canonical-first", "agent-raw-2", "canonical 先到", true, "raw-second");

    expect(
      useStore.getState().threads["thread-1"]?.entries
        .filter((entry) => entry.body.kind === "agent-message")
        .map((entry) => entry.id)
    ).toEqual(["agent-canonical-1", "agent-canonical-2"]);
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

  it("keeps two canonical agent replies with identical text in the same turn distinct", () => {
    for (const id of ["agent-canonical-1", "agent-canonical-2"]) {
      useStore.getState().dispatchEvent({
        type: "codex-event",
        event: {
          eventId: `complete-${id}`,
          kind: "item_updated",
          threadId: "thread-1",
          turnId: "turn-1",
          item: { id, role: "agent", text: "允许重复的正式消息" }
        }
      });
    }

    expect(
      useStore.getState().threads["thread-1"]?.entries
        .filter((entry) => entry.body.kind === "agent-message")
        .map((entry) => entry.id)
    ).toEqual(["agent-canonical-1", "agent-canonical-2"]);
  });

  it("keeps ambiguous live agent aliases fail closed", () => {
    for (const id of ["agent-live-1", "agent-live-2"]) {
      useStore.getState().dispatchEvent({
        type: "codex-event",
        event: {
          eventId: `delta-${id}`,
          kind: "agent_message_delta",
          threadId: "thread-1",
          turnId: "turn-1",
          itemId: id,
          delta: "无法唯一归属"
        }
      });
    }
    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: {
        eventId: "complete-agent-canonical",
        kind: "item_updated",
        threadId: "thread-1",
        turnId: "turn-1",
        item: { id: "agent-canonical", role: "agent", text: "无法唯一归属" }
      }
    });

    expect(
      useStore.getState().threads["thread-1"]?.entries
        .filter((entry) => entry.body.kind === "agent-message")
        .map((entry) => entry.id)
    ).toEqual(["agent-live-1", "agent-live-2", "agent-canonical"]);
    expect(useStore.getState().__getTimelineDiagnostics?.()?.agentAliasAmbiguities).toBe(1);
    expect(useStore.getState().threads["thread-1"]?.repairRequest).toBeNull();
  });

  it("keeps conflicting live and canonical agent text fail closed without generic text repair", () => {
    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: {
        eventId: "delta-agent-conflict",
        kind: "agent_message_delta",
        threadId: "thread-1",
        turnId: "turn-1",
        itemId: "agent-live",
        delta: "第一条正文"
      }
    });
    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: {
        eventId: "complete-agent-conflict",
        kind: "item_updated",
        threadId: "thread-1",
        turnId: "turn-1",
        item: { id: "agent-canonical", role: "agent", text: "完全不同的正文" }
      }
    });

    const thread = useStore.getState().threads["thread-1"]!;
    expect(thread.entries.filter((entry) => entry.body.kind === "agent-message")).toHaveLength(2);
    expect(thread.timelineEngine.diagnostics.agentAliasReconciliations).toBe(0);
    expect(thread.timelineEngine.diagnostics.agentAliasAmbiguities).toBe(0);
    expect(thread.repairRequest).toBeNull();
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
        sequence: 8,
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
        sequence: 9,
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
        sequence: 11,
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
          snapshotSequence: 10,
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
        sequence: 9,
        delta: "hello "
      }
    });

    unsubscribe();
    expect(notifications).toBe(0);
    expect(useStore.getState().threads["thread-1"]?.processedEventIds.has(timelineEventLedgerKey(0, "replay-covered-delta"))).toBe(true);
    expect(useStore.getState().threads["thread-1"]?.entries).toBe(entriesBeforeReplay);
    expect(useStore.getState().threads["thread-1"]?.entries).toEqual([
      expect.objectContaining({
        id: "agent-1",
        body: { kind: "agent-message", text: "hello world" }
      })
    ]);
  });

  it("requests repair instead of using text-prefix suppression for a sequence-less delta", () => {
    useStore.getState().setThreadEntries(
      "thread-1",
      [
        {
          id: "agent-1",
          turnId: "turn-1",
          createdAt: 1,
          body: { kind: "agent-message", text: "hello" }
        }
      ],
      null
    );

    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: {
        eventId: "sequence-less-h",
        kind: "agent_message_delta",
        threadId: "thread-1",
        turnId: "turn-1",
        itemId: "agent-1",
        delta: "h"
      }
    });

    expect(useStore.getState().threads["thread-1"]?.entries).toEqual([
      expect.objectContaining({ id: "agent-1", body: { kind: "agent-message", text: "hello" } })
    ]);
    expect(useStore.getState().threads["thread-1"]?.repairRequest).toEqual(
      expect.objectContaining({ reason: "timeline-gap" })
    );
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

    expect(useStore.getState().threads["thread-1"]?.processedEventIds.has(timelineEventLedgerKey(0, "covered-delta"))).toBe(true);
    expect(useStore.getState().threads["thread-1"]?.processedEventIds.has(timelineEventLedgerKey(0, "tail-delta"))).toBe(true);
    expect(useStore.getState().threads["thread-1"]?.entries).toEqual([
      expect.objectContaining({
        id: "agent-1",
        body: { kind: "agent-message", text: "hello world!" }
      })
    ]);
  });

  it("commits one visible thread update for one protocol event batch", () => {
    useStore.getState().ensureThread("thread-batch");
    useStore.getState().__resetTimelineDiagnostics?.();
    let threadUpdates = 0;
    let previousThread = useStore.getState().threads["thread-batch"];
    const unsubscribe = useStore.subscribe((state) => {
      const nextThread = state.threads["thread-batch"];
      if (nextThread !== previousThread) {
        previousThread = nextThread;
        threadUpdates += 1;
      }
    });

    useStore.getState().dispatchEvent({
      type: "codex-event-batch",
      events: [
        {
          eventId: "batch-agent-1",
          kind: "agent_message_delta",
          threadId: "thread-batch",
          turnId: "turn-1",
          itemId: "agent-1",
          revision: 1,
          delta: "hello "
        },
        {
          eventId: "batch-agent-2",
          kind: "agent_message_delta",
          threadId: "thread-batch",
          turnId: "turn-1",
          itemId: "agent-1",
          revision: 2,
          delta: "world"
        },
        {
          eventId: "batch-tool-1",
          kind: "tool_output_delta",
          threadId: "thread-batch",
          turnId: "turn-1",
          itemId: "tool-1",
          revision: 1,
          delta: "done"
        }
      ]
    });
    unsubscribe();

    expect(threadUpdates).toBe(1);
    expect(useStore.getState().__getTimelineDiagnostics?.()?.batchFlushes).toBe(1);
    expect(useStore.getState().threads["thread-batch"]?.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "agent-1", body: { kind: "agent-message", text: "hello world" } }),
        expect.objectContaining({
          id: "tool-1",
          body: expect.objectContaining({ kind: "tool", result: "done" })
        })
      ])
    );
  });

  it("rejects a stale delivery epoch batch after timeline invalidation", () => {
    useStore.getState().ensureThread("thread-stale-batch");
    useStore.getState().invalidateTimelineDelivery("thread-stale-batch", 2);
    useStore.getState().__resetTimelineDiagnostics?.();

    useStore.getState().dispatchEvent({
      type: "codex-event-batch",
      deliveryEpoch: 1,
      events: [
        {
          eventId: "stale-agent-delta",
          kind: "agent_message_delta",
          threadId: "thread-stale-batch",
          turnId: "turn-old",
          itemId: "agent-old",
          delta: "stale"
        }
      ]
    });

    const thread = useStore.getState().threads["thread-stale-batch"]!;
    expect(thread.deliveryEpoch).toBe(2);
    expect(thread.entries).toEqual([]);
    expect(thread.processedEventIds.has("stale-agent-delta")).toBe(false);
    expect(useStore.getState().__getTimelineDiagnostics?.()).toEqual(
      expect.objectContaining({ barrierRevalidations: 1, droppedDeliveryEpochEvents: 1 })
    );
  });

  it("routes a real delta batch through engine fast paths without snapshot normalization", () => {
    useStore.getState().setThreadEntries(
      "thread-real-batch",
      Array.from({ length: 1200 }, (_value, index) => ({
        id: `agent-${index}`,
        turnId: `turn-${index}`,
        createdAt: index,
        body: { kind: "agent-message" as const, text: `reply ${index}` }
      })),
      "older"
    );
    const before = useStore.getState().threads["thread-real-batch"]!.timelineEngine.diagnostics;

    useStore.getState().dispatchEvent({
      type: "codex-event-batch",
      events: Array.from({ length: 200 }, (_value, index) => ({
        eventId: `real-delta-${index}`,
        kind: "agent_message_delta",
        threadId: "thread-real-batch",
        turnId: "turn-1199",
        itemId: "agent-1199",
        revision: index + 1,
        sequence: index + 1,
        delta: "x"
      }))
    });

    const thread = useStore.getState().threads["thread-real-batch"]!;
    expect(thread.timelineEngine.diagnostics.structuralNormalizations).toBe(before.structuralNormalizations);
    expect(thread.timelineEngine.diagnostics.fastPathCommits - before.fastPathCommits).toBe(200);
    expect(thread.entries[1199]).toEqual(
      expect.objectContaining({ body: { kind: "agent-message", text: `reply 1199${"x".repeat(200)}` } })
    );
  });

  it("scopes fallback live identities to their turns", () => {
    useStore.getState().dispatchEvent({
      type: "codex-event-batch",
      events: [
        {
          eventId: "turn-1-agent",
          kind: "agent_message_delta",
          threadId: "thread-fallback",
          turnId: "turn-1",
          generation: 1,
          delta: "first"
        },
        {
          eventId: "turn-2-agent",
          kind: "agent_message_delta",
          threadId: "thread-fallback",
          turnId: "turn-2",
          generation: 1,
          delta: "second"
        }
      ]
    });

    expect(useStore.getState().threads["thread-fallback"]?.entries).toEqual([
      expect.objectContaining({ turnId: "turn-1", body: { kind: "agent-message", text: "first" } }),
      expect.objectContaining({ turnId: "turn-2", body: { kind: "agent-message", text: "second" } })
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
        turnId: "turn-old",
        body: { kind: "agent-message", text: "旧" }
      }),
      expect.objectContaining({
        id: "agent-1",
        turnId: "turn-new",
        body: { kind: "agent-message", text: "新" }
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
        turnId: "turn-old",
        body: { kind: "agent-message", text: "repeat" }
      }),
      expect.objectContaining({
        id: "agent-1",
        turnId: "turn-new",
        body: { kind: "agent-message", text: "repeat" }
      })
    ]);
  });

  it("marks the owning thread for snapshot repair when the event stream reports a thread gap", () => {
    useStore.getState().setActiveThread("thread-1");

    useStore.getState().dispatchEvent({ type: "timeline-gap", threadId: "thread-2", lastEventId: "missing" });

    expect(useStore.getState().threads["thread-1"]?.repairRequestedAt).toBeUndefined();
    expect(useStore.getState().threads["thread-2"]?.repairRequestedAt).toEqual(expect.any(Number));
  });

  it("marks every affected thread for repair from a multi-owner gap", () => {
    useStore.getState().ensureThread("thread-a");
    useStore.getState().ensureThread("thread-b");

    useStore.getState().dispatchEvent({
      type: "timeline-gap",
      scope: "threads",
      affectedThreadIds: ["thread-a", "thread-b"],
      lastEventId: "missing"
    });

    expect(useStore.getState().threads["thread-a"]?.repairRequestedAt).toEqual(expect.any(Number));
    expect(useStore.getState().threads["thread-b"]?.repairRequestedAt).toEqual(expect.any(Number));
  });

  it("repairs every cached thread for an all-tracked barrier", () => {
    useStore.getState().ensureThread("thread-a");
    useStore.getState().ensureThread("thread-b");

    useStore.getState().dispatchEvent({
      type: "timeline-gap",
      scope: "all-tracked",
      bootId: "boot-new",
      lastEventId: "old-boot"
    });

    expect(useStore.getState().threads["thread-a"]?.repairRequestedAt).toEqual(expect.any(Number));
    expect(useStore.getState().threads["thread-b"]?.repairRequestedAt).toEqual(expect.any(Number));
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

    const liveReasoningCreatedAt = useStore.getState().threads["thread-1"]?.entries[0]?.createdAt;
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
        createdAt: liveReasoningCreatedAt,
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
    const liveReasoningCreatedAt = useStore.getState().threads["thread-1"]?.entries[0]?.createdAt;
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
        createdAt: liveReasoningCreatedAt,
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

  it("removes an empty live reasoning entry when a turn completes after assistant output", () => {
    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: { kind: "turn_started", threadId: "thread-1", turnId: "turn-1" }
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
    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: {
        kind: "agent_message_delta",
        threadId: "thread-1",
        turnId: "turn-1",
        itemId: "agent-1",
        delta: "最终回答"
      }
    });

    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: { kind: "turn_completed", threadId: "thread-1", turnId: "turn-1", status: "completed" }
    });

    const thread = useStore.getState().threads["thread-1"];
    expect(thread?.running).toBe(false);
    expect(thread?.repairRequest).toBeNull();
    expect(thread?.entries).toEqual([
      expect.objectContaining({
        id: "agent-1",
        turnId: "turn-1",
        body: { kind: "agent-message", text: "最终回答" }
      })
    ]);
  });

  it("requests snapshot repair when a completed active turn has no visible server output", () => {
    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: { kind: "turn_started", threadId: "thread-1", turnId: "turn-1" }
    });

    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: { kind: "turn_completed", threadId: "thread-1", turnId: "turn-1", status: "completed" }
    });

    expect(useStore.getState().threads["thread-1"]?.repairRequestedAt).toEqual(expect.any(Number));
    expect(useStore.getState().threads["thread-1"]?.entries).toEqual([]);
  });

  it("deduplicates equivalent snapshot repair requests for the same completed turn", () => {
    let now = 10_000;
    const originalNow = Date.now;
    Date.now = () => {
      now += 1;
      return now;
    };
    try {
      useStore.getState().dispatchEvent({
        type: "codex-event",
        event: {
          kind: "turn_started",
          threadId: "thread-1",
          turnId: "turn-1",
          generation: 2
        }
      });
      useStore.getState().dispatchEvent({
        type: "codex-event",
        event: {
          kind: "turn_completed",
          threadId: "thread-1",
          turnId: "turn-1",
          status: "completed",
          generation: 2
        }
      });

      const firstRequest = useStore.getState().threads["thread-1"]?.repairRequest;
      expect(firstRequest).toEqual(
        expect.objectContaining({
          key: "turn-completed:turn-1:2",
          reason: "turn-completed",
          turnId: "turn-1",
          generation: 2
        })
      );

      useStore.getState().requestSnapshotRepair("thread-1", {
        reason: "summary-idle",
        turnId: "turn-1",
        generation: 2
      });
      useStore.getState().dispatchEvent({
        type: "codex-event",
        event: {
          kind: "turn_completed",
          threadId: "thread-1",
          turnId: "turn-1",
          status: "completed",
          generation: 2
        }
      });

      expect(useStore.getState().threads["thread-1"]?.repairRequest).toEqual(firstRequest);
    } finally {
      Date.now = originalNow;
    }
  });

  it("deduplicates stream disconnected repair requests for the same active turn", () => {
    let now = 20_000;
    const originalNow = Date.now;
    Date.now = () => {
      now += 1;
      return now;
    };
    try {
      useStore.getState().dispatchEvent({
        type: "codex-event",
        event: {
          kind: "turn_started",
          threadId: "thread-1",
          turnId: "turn-1",
          generation: 3
        }
      });
      useStore.getState().requestSnapshotRepair("thread-1", {
        reason: "stream-disconnected",
        turnId: "turn-1",
        generation: 3
      });

      const firstRequest = useStore.getState().threads["thread-1"]?.repairRequest;
      expect(firstRequest).toEqual(
        expect.objectContaining({
          key: "stream-disconnected:turn-1:3",
          reason: "stream-disconnected",
          turnId: "turn-1",
          generation: 3
        })
      );

      useStore.getState().requestSnapshotRepair("thread-1", {
        reason: "stream-disconnected",
        turnId: "turn-1",
        generation: 3
      });

      expect(useStore.getState().threads["thread-1"]?.repairRequest).toEqual(firstRequest);
    } finally {
      Date.now = originalNow;
    }
  });

  it("does not request repair when the completed active turn already has visible server output", () => {
    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: { kind: "turn_started", threadId: "thread-1", turnId: "turn-1" }
    });
    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: {
        kind: "agent_message_delta",
        threadId: "thread-1",
        turnId: "turn-1",
        itemId: "agent-1",
        delta: "实时回复"
      }
    });

    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: { kind: "turn_completed", threadId: "thread-1", turnId: "turn-1", status: "completed" }
    });

    const thread = useStore.getState().threads["thread-1"];
    expect(thread?.repairRequestedAt).toBeNull();
    expect(thread?.repairRequest).toBeNull();
    expect(thread?.running).toBe(false);
    expect(thread?.activeTurnId).toBeNull();
    expect(thread?.entries).toEqual([
      expect.objectContaining({
        id: "agent-1",
        turnId: "turn-1",
        body: { kind: "agent-message", text: "实时回复" }
      })
    ]);
  });

  it("does not request repair when a completed active turn only has tool output", () => {
    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: { kind: "turn_started", threadId: "thread-1", turnId: "turn-1" }
    });
    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: {
        kind: "command_output_delta",
        threadId: "thread-1",
        turnId: "turn-1",
        itemId: "cmd-1",
        delta: "npm test\n"
      }
    });

    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: { kind: "turn_completed", threadId: "thread-1", turnId: "turn-1", status: "completed" }
    });

    const thread = useStore.getState().threads["thread-1"];
    expect(thread?.repairRequestedAt).toBeNull();
    expect(thread?.repairRequest).toBeNull();
    expect(thread?.entries).toEqual([
      expect.objectContaining({
        id: "cmd-1",
        turnId: "turn-1",
        body: expect.objectContaining({ kind: "tool", status: "success", result: "npm test\n" })
      })
    ]);
  });

  it("does not request repair when a completed active turn only has reasoning output", () => {
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

    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: { kind: "turn_completed", threadId: "thread-1", turnId: "turn-1", status: "completed" }
    });

    const thread = useStore.getState().threads["thread-1"];
    expect(thread?.repairRequestedAt).toBeNull();
    expect(thread?.repairRequest).toBeNull();
    expect(thread?.entries).toEqual([
      expect.objectContaining({
        id: "reasoning-1",
        turnId: "turn-1",
        body: { kind: "reasoning", text: "公开推理摘要", done: true }
      })
    ]);
  });

  it("does not request repair when a completed active turn only has command activity output", () => {
    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: { kind: "turn_started", threadId: "thread-1", turnId: "turn-1" }
    });
    useStore.getState().mergeThreadEntries(
      "thread-1",
      [
        {
          id: "activity-1",
          turnId: "turn-1",
          createdAt: 100,
          body: { kind: "command", status: "running", command: "npm test", output: "running tests" }
        }
      ],
      null
    );

    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: { kind: "turn_completed", threadId: "thread-1", turnId: "turn-1", status: "completed" }
    });

    const thread = useStore.getState().threads["thread-1"];
    expect(thread?.repairRequestedAt).toBeNull();
    expect(thread?.repairRequest).toBeNull();
    expect(thread?.entries).toEqual([
      expect.objectContaining({
        id: "activity-1",
        turnId: "turn-1",
        body: expect.objectContaining({ kind: "command", status: "success", command: "npm test" })
      })
    ]);
  });

  it("invalidates the Skills cache from an ownerless skills_changed event", () => {
    expect(useStore.getState().skillsCacheVersion).toBe(0);

    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: { kind: "skills_changed" }
    });

    expect(useStore.getState().skillsCacheVersion).toBe(1);
    expect(useStore.getState().threads["thread-1"]).toBeUndefined();
  });

  it("treats thread-scoped skills_changed as cache invalidation unless it is runtime activity", () => {
    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: {
        eventId: "skills-evt-1",
        kind: "skills_changed",
        threadId: "thread-1",
        turnId: "turn-1",
        skills: ["openspec-explore", "systematic-debugging"],
        count: 2
      }
    });

    expect(useStore.getState().skillsCacheVersion).toBe(1);
    expect(useStore.getState().threads["thread-1"]).toBeUndefined();

    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: {
        eventId: "skills-evt-1",
        kind: "skills_changed",
        threadId: "thread-1",
        turnId: "turn-1",
        skills: ["openspec-explore", "systematic-debugging"],
        count: 2
      }
    });

    expect(useStore.getState().skillsCacheVersion).toBe(2);
    expect(useStore.getState().threads["thread-1"]).toBeUndefined();
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
          turnId: "turn-1",
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

  it("preserves structured tool action kind when merging live output deltas", () => {
    useStore.getState().appendTextToEntry("thread-1", {
      id: "tool-1",
      turnId: "turn-1",
      createdAt: 1,
      body: {
        kind: "tool",
        toolKind: "command",
        server: "/repo",
        tool: "ls src",
        status: "running",
        result: "app"
      }
    });

    useStore.getState().appendTextToEntry("thread-1", {
      id: "tool-1",
      turnId: "turn-1",
      createdAt: 2,
      body: {
        kind: "tool",
        toolKind: "command",
        actionKind: "list",
        server: "/repo",
        tool: "ls src",
        status: "success",
        result: ".ts"
      }
    });

    expect(useStore.getState().threads["thread-1"]?.entries[0]?.body).toEqual(
      expect.objectContaining({
        kind: "tool",
        actionKind: "list",
        result: "app.ts"
      })
    );
  });

  it("preserves structured tool action kind when merging equivalent snapshot output", () => {
    useStore.getState().setThreadEntries(
      "thread-1",
      [
        {
          id: "tool-live",
          turnId: "turn-1",
          createdAt: 1,
          body: {
            kind: "tool",
            toolKind: "command",
            server: "/repo",
            tool: "rg timeline src",
            status: "success",
            result: "src/app.ts\nsrc/test.ts"
          }
        }
      ],
      null
    );

    useStore.getState().mergeThreadEntries(
      "thread-1",
      [
        {
          id: "tool-live",
          turnId: "turn-1",
          createdAt: 2,
          body: {
            kind: "tool",
            toolKind: "command",
            actionKind: "search",
            server: "/repo",
            tool: "rg timeline src",
            status: "success",
            result: "src/app.ts"
          }
        }
      ],
      null
    );

    expect(useStore.getState().threads["thread-1"]?.entries[0]?.body).toEqual(
      expect.objectContaining({
        kind: "tool",
        actionKind: "search",
        result: "src/app.ts\nsrc/test.ts"
      })
    );
  });

  it("replaces local optimistic user messages in place once a later snapshot confirms them", () => {
    useStore.getState().appendEntries("thread-1", [
      {
        id: "local-user-1",
        clientUserMessageId: "send-1",
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
          clientUserMessageId: "send-1",
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

  it("keeps same-text local user messages distinct when operation ids differ", () => {
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

    expect(useStore.getState().threads["thread-1"]?.entries.map((entry) => entry.id)).toEqual([
      "local-user-1",
      "local-user-2"
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
      clientUserMessageId: "local-user-2",
      createdAt: 102,
      body: { kind: "user-message", text: "继续", status: "sent" }
    });

    expect(useStore.getState().threads["thread-1"]?.entries).toEqual([
      expect.objectContaining({ id: "local-user-1", turnId: "turn-1" }),
      expect.objectContaining({ id: "server-user-2", turnId: "turn-2" })
    ]);
  });

  it("confirms a bound local user message when the server omits local Skill and image attachments", () => {
    useStore.getState().appendEntries("thread-1", [
      {
        id: "local-user-skill",
        turnId: "turn-1",
        clientUserMessageId: "local-user-skill",
        createdAt: 100,
        body: {
          kind: "user-message",
          text: "分析 bug",
          imagePaths: ["/tmp/uploads/bug.png"],
          skillReferences: [{ name: "systematic-debugging", path: "/skills/systematic-debugging/SKILL.md" }],
          status: "sent"
        }
      }
    ]);

    useStore.getState().replaceOrAddEntry("thread-1", {
      id: "server-user-skill",
      turnId: "turn-1",
      clientUserMessageId: "local-user-skill",
      createdAt: 101,
      body: { kind: "user-message", text: "分析 bug", status: "sent" }
    });

    expect(useStore.getState().threads["thread-1"]?.entries).toEqual([
      expect.objectContaining({
        id: "server-user-skill",
        turnId: "turn-1",
        clientUserMessageId: "local-user-skill",
        body: expect.objectContaining({
          kind: "user-message",
          text: "分析 bug",
          imagePaths: ["/tmp/uploads/bug.png"],
          skillReferences: [{ name: "systematic-debugging", path: "/skills/systematic-debugging/SKILL.md" }],
          status: "sent"
        })
      })
    ]);
  });

  it("merges non-adjacent local and server user entries for the same turn while preserving activity", () => {
    useStore.getState().appendEntries("thread-1", [
      {
        id: "local-user-activity",
        turnId: "turn-1",
        clientUserMessageId: "local-user-activity",
        createdAt: 100,
        body: {
          kind: "user-message",
          text: "看截图",
          imagePaths: ["/tmp/uploads/timeline.png"],
          skillReferences: [{ name: "openspec-explore", path: "/skills/openspec-explore/SKILL.md" }],
          status: "sent"
        }
      },
      {
        id: "reasoning-1",
        turnId: "turn-1",
        createdAt: 101,
        body: { kind: "reasoning", text: "先定位 timeline", done: false }
      },
      {
        id: "tool-1",
        turnId: "turn-1",
        createdAt: 102,
        body: {
          kind: "tool",
          toolKind: "command",
          server: "/repo",
          tool: "rg timeline src",
          status: "success",
          result: "src/web/state/store.ts"
        }
      }
    ]);

    useStore.getState().mergeThreadEntries(
      "thread-1",
      [
        {
          id: "server-user-activity",
          turnId: "turn-1",
          clientUserMessageId: "local-user-activity",
          createdAt: 103,
          body: { kind: "user-message", text: "看截图", status: "sent" }
        }
      ],
      null
    );

    const entries = useStore.getState().threads["thread-1"]?.entries ?? [];
    expect(entries.filter((entry) => entry.body.kind === "user-message")).toHaveLength(1);
    expect(entries).toEqual([
      expect.objectContaining({
        id: "server-user-activity",
        body: expect.objectContaining({
          kind: "user-message",
          imagePaths: ["/tmp/uploads/timeline.png"],
          skillReferences: [{ name: "openspec-explore", path: "/skills/openspec-explore/SKILL.md" }]
        })
      }),
      expect.objectContaining({ id: "reasoning-1", turnId: "turn-1" }),
      expect.objectContaining({ id: "tool-1", turnId: "turn-1" })
    ]);
  });

  it("keeps identical image and Skill user messages from different turns distinct", () => {
    useStore.getState().appendEntries("thread-1", [
      {
        id: "local-user-same-1",
        turnId: "turn-1",
        clientUserMessageId: "local-user-same-1",
        createdAt: 100,
        body: {
          kind: "user-message",
          text: "继续",
          imagePaths: ["/tmp/uploads/same.png"],
          skillReferences: [{ name: "systematic-debugging", path: "/skills/systematic-debugging/SKILL.md" }],
          status: "sent"
        }
      },
      {
        id: "local-user-same-2",
        turnId: "turn-2",
        clientUserMessageId: "local-user-same-2",
        createdAt: 101,
        body: {
          kind: "user-message",
          text: "继续",
          imagePaths: ["/tmp/uploads/same.png"],
          skillReferences: [{ name: "systematic-debugging", path: "/skills/systematic-debugging/SKILL.md" }],
          status: "sent"
        }
      }
    ]);

    useStore.getState().replaceOrAddEntry("thread-1", {
      id: "server-user-same-2",
      turnId: "turn-2",
      clientUserMessageId: "local-user-same-2",
      createdAt: 102,
      body: { kind: "user-message", text: "继续", status: "sent" }
    });

    const entries = useStore.getState().threads["thread-1"]?.entries ?? [];
    expect(entries.filter((entry) => entry.body.kind === "user-message")).toHaveLength(2);
    expect(entries).toEqual([
      expect.objectContaining({ id: "local-user-same-1", turnId: "turn-1" }),
      expect.objectContaining({ id: "server-user-same-2", turnId: "turn-2" })
    ]);
  });

  it("replaces the local user message in place when a websocket item confirms the same prompt", () => {
    useStore.getState().appendEntries("thread-1", [
      {
        id: "local-user-1",
        clientUserMessageId: "send-confirm-1",
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
      clientUserMessageId: "send-confirm-1",
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

  it("shows deprecated context compaction completion without stopping the active turn or repairing", () => {
    useStore.getState().setRunning("thread-1", true);
    useStore.getState().setActiveTurnId("thread-1", "turn-1");

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
    expect(useStore.getState().threads["thread-1"]?.running).toBe(true);
    expect(useStore.getState().threads["thread-1"]?.activeTurnId).toBe("turn-1");
    expect(useStore.getState().threads["thread-1"]?.repairRequestedAt).toBeNull();
    expect(useStore.getState().threads["thread-1"]?.repairRequest).toBeNull();
  });

  it("ignores a late deprecated context compaction event for a deleted turn", () => {
    useStore.getState().markTurnDeleted("thread-1", "turn-deleted");

    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: { kind: "context_compacted", threadId: "thread-1", turnId: "turn-deleted" }
    });

    expect(useStore.getState().threads["thread-1"]?.entries).toEqual([]);
  });

  it("keeps automatic context compaction item updates on the live event path", () => {
    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: { kind: "turn_started", threadId: "thread-1", turnId: "turn-1" }
    });

    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: {
        kind: "item_updated",
        threadId: "thread-1",
        turnId: "turn-1",
        item: {
          id: "context-compaction-item",
          role: "system",
          text: "压缩上下文已完成",
          toolKind: "system"
        }
      }
    });

    const thread = useStore.getState().threads["thread-1"];
    expect(thread?.entries).toEqual([
      expect.objectContaining({
        id: "turn-1-reasoning-pending",
        turnId: "turn-1",
        body: { kind: "reasoning", text: "", done: false }
      }),
      expect.objectContaining({
        id: "context-compaction-item",
        turnId: "turn-1",
        body: { kind: "system", text: "压缩上下文已完成" }
      })
    ]);
    expect(thread?.running).toBe(true);
    expect(thread?.activeTurnId).toBe("turn-1");
    expect(thread?.repairRequestedAt).toBeNull();
    expect(thread?.repairRequest).toBeNull();
  });

  it("shows context compaction while running, completes in place, and never regresses", () => {
    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: { kind: "turn_started", threadId: "thread-1", turnId: "turn-1" }
    });

    const runningItem = {
      id: "context-compaction-item",
      role: "system" as const,
      text: "正在自动压缩上下文",
      toolKind: "system" as const,
      systemKind: "context-compaction" as const,
      status: "running" as const
    };
    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: {
        kind: "item_updated",
        eventId: "compact-started",
        revision: 1,
        threadId: "thread-1",
        turnId: "turn-1",
        completedAtMs: 100,
        item: runningItem
      }
    });

    expect(useStore.getState().threads["thread-1"]?.entries).toEqual([
      expect.objectContaining({ id: "turn-1-reasoning-pending" }),
      expect.objectContaining({
        id: "context-compaction-item",
        body: {
          kind: "system",
          text: "正在自动压缩上下文",
          systemKind: "context-compaction",
          status: "running"
        }
      })
    ]);

    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: {
        kind: "item_updated",
        eventId: "compact-completed",
        revision: 2,
        threadId: "thread-1",
        turnId: "turn-1",
        completedAtMs: 200,
        item: { ...runningItem, text: "压缩上下文已完成", status: "success" as const }
      }
    });

    const completedEntries = useStore.getState().threads["thread-1"]?.entries ?? [];
    expect(completedEntries.filter((entry) => entry.id === "context-compaction-item")).toEqual([
      expect.objectContaining({
        body: {
          kind: "system",
          text: "压缩上下文已完成",
          systemKind: "context-compaction",
          status: "success"
        }
      })
    ]);

    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: {
        kind: "item_updated",
        eventId: "compact-started-late",
        revision: 3,
        threadId: "thread-1",
        turnId: "turn-1",
        completedAtMs: 300,
        item: runningItem
      }
    });

    expect(
      useStore.getState().threads["thread-1"]?.entries.find((entry) => entry.id === "context-compaction-item")?.body
    ).toEqual({
      kind: "system",
      text: "压缩上下文已完成",
      systemKind: "context-compaction",
      status: "success"
    });
  });

  it("keeps streamed output after turn completion without requesting snapshot repair", () => {
    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: { kind: "turn_started", threadId: "thread-1", turnId: "turn-1" }
    });
    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: {
        kind: "agent_message_delta",
        threadId: "thread-1",
        turnId: "turn-1",
        itemId: "agent-1",
        delta: "流式内容"
      }
    });
    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: { kind: "turn_completed", threadId: "thread-1", turnId: "turn-1" }
    });

    expect(useStore.getState().threads["thread-1"]?.running).toBe(false);
    expect(useStore.getState().threads["thread-1"]?.repairRequestedAt).toBeNull();
    expect(useStore.getState().threads["thread-1"]?.entries).toEqual([
      expect.objectContaining({
        id: "agent-1",
        turnId: "turn-1",
        body: { kind: "agent-message", text: "流式内容" }
      })
    ]);
  });

  it("keeps compaction sources distinct without a shared operation identity", () => {
    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: { kind: "context_compacted", threadId: "thread-1", turnId: "turn-1" }
    });

    useStore.getState().mergeThreadEntries(
      "thread-1",
      [
        {
          id: "snapshot-context-compaction",
          turnId: "turn-1",
          createdAt: 200,
          body: { kind: "system", text: "压缩上下文已完成" }
        }
      ],
      null
    );

    const compactionEntries = useStore
      .getState()
      .threads["thread-1"]?.entries.filter(
        (entry) => entry.body.kind === "system" && entry.body.text === "压缩上下文已完成"
      );

    expect(compactionEntries).toHaveLength(2);
  });

  it("stores context usage updates and caches them by thread id", () => {
    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: {
        kind: "token_usage_updated",
        threadId: "thread-1",
        turnId: "turn-1",
        totalTokens: 128000,
        inputTokens: 96000,
        outputTokens: 24000,
        reasoningOutputTokens: 8000,
        modelContextWindow: 200000
      }
    });

    const expected = expect.objectContaining({
      totalTokens: 128000,
      inputTokens: 96000,
      outputTokens: 24000,
      reasoningOutputTokens: 8000,
      modelContextWindow: 200000,
      updatedAt: expect.any(Number)
    });
    expect(useStore.getState().threads["thread-1"]?.contextUsage).toEqual(expected);
    expect(getContextUsage("thread-1")).toEqual(expected);
  });

  it("stores token usage updates without a usable context window as non-renderable usage", () => {
    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: {
        kind: "token_usage_updated",
        threadId: "thread-1",
        turnId: "turn-1",
        totalTokens: 128000,
        inputTokens: 96000,
        outputTokens: 24000,
        reasoningOutputTokens: 8000,
        modelContextWindow: null
      }
    });

    expect(useStore.getState().threads["thread-1"]?.contextUsage).toEqual(
      expect.objectContaining({
        totalTokens: 128000,
        modelContextWindow: null
      })
    );
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

  it("syncs thread mode, model, reasoning effort, and permission profile from settings update events", () => {
    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: {
        kind: "thread_settings_updated",
        threadId: "thread-1",
        model: "gpt-5-codex",
        reasoningEffort: "high",
        activePermissionProfile: { id: ":workspace", extends: null },
        approvalsReviewer: "auto_review",
        collaborationMode: "plan"
      }
    });

    expect(useStore.getState().threads["thread-1"]).toEqual(
      expect.objectContaining({
        mode: "plan",
        model: "gpt-5-codex",
        modelEffort: "high",
        permissionProfileId: ":workspace",
        approvalsReviewer: "auto_review"
      })
    );
  });

  it("does not overwrite a complete local permission mode with an incomplete settings event", () => {
    useStore.getState().setPermissionProfile("thread-1", ":workspace", "auto_review");

    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: {
        kind: "thread_settings_updated",
        threadId: "thread-1",
        model: null,
        reasoningEffort: null,
        activePermissionProfile: { id: ":workspace", extends: null },
        collaborationMode: null
      }
    });

    expect(useStore.getState().threads["thread-1"]).toEqual(
      expect.objectContaining({
        permissionProfileId: ":workspace",
        approvalsReviewer: "auto_review"
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

  it("marks the bound user message failed after a final asynchronous turn error", () => {
    useStore.getState().setThreadEntries(
      "thread-1",
      [
        {
          id: "local-user-1",
          clientUserMessageId: "local-user-1",
          turnId: "turn-1",
          createdAt: 1000,
          body: { kind: "user-message", text: "会失败的请求", status: "sent" }
        }
      ],
      null
    );

    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: {
        kind: "turn_error",
        threadId: "thread-1",
        turnId: "turn-1",
        message: "stream disconnected before completion",
        willRetry: false
      }
    });

    expect(useStore.getState().threads["thread-1"]?.entries).toEqual([
      expect.objectContaining({
        id: "local-user-1",
        body: expect.objectContaining({ kind: "user-message", status: "failed" })
      }),
      expect.objectContaining({
        id: "turn-1-error",
        body: { kind: "error", text: "stream disconnected before completion" }
      })
    ]);
  });

  it("keeps the bound user message sent while app-server will retry", () => {
    useStore.getState().setThreadEntries(
      "thread-1",
      [
        {
          id: "local-user-1",
          clientUserMessageId: "local-user-1",
          turnId: "turn-1",
          createdAt: 1000,
          body: { kind: "user-message", text: "等待重试", status: "sent" }
        }
      ],
      null
    );

    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: {
        kind: "turn_error",
        threadId: "thread-1",
        turnId: "turn-1",
        message: "temporary disconnect",
        willRetry: true
      }
    });

    expect(useStore.getState().threads["thread-1"]?.entries[0]?.body).toEqual(
      expect.objectContaining({ kind: "user-message", status: "sent" })
    );
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

  it("keeps unresolved live partial separate from a differently identified completed item", () => {
    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: {
        eventId: "fallback-live",
        kind: "agent_message_delta",
        threadId: "thread-fallback-completed",
        turnId: "turn-1",
        delta: "partial text that diverges"
      }
    });

    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: {
        kind: "item_updated",
        threadId: "thread-fallback-completed",
        turnId: "turn-1",
        completedAtMs: 1234,
        item: { id: "agent-server", turnId: "turn-1", role: "agent", text: "authoritative final" }
      }
    });

    expect(useStore.getState().threads["thread-fallback-completed"]?.entries).toEqual([
      expect.objectContaining({
        id: expect.stringContaining("unresolved:"),
        completeness: expect.objectContaining({ status: "repair-required" })
      }),
      expect.objectContaining({
        id: "agent-server",
        body: { kind: "agent-message", text: "authoritative final" }
      })
    ]);
  });

  it("lets the engine reject duplicate stale deleted and interrupted completed items", () => {
    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: {
        eventId: "completed-once",
        revision: 1,
        kind: "item_updated",
        threadId: "thread-engine-barriers",
        turnId: "turn-live",
        generation: 2,
        item: { id: "agent-live", role: "agent", text: "accepted" }
      }
    });
    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: {
        eventId: "completed-once",
        revision: 2,
        kind: "item_updated",
        threadId: "thread-engine-barriers",
        turnId: "turn-live",
        generation: 2,
        item: { id: "agent-live", role: "agent", text: "duplicate must not replace" }
      }
    });
    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: {
        eventId: "completed-old-generation",
        kind: "item_updated",
        threadId: "thread-engine-barriers",
        turnId: "turn-old",
        generation: 1,
        item: { id: "agent-old", role: "agent", text: "stale" }
      }
    });
    useStore.getState().markTurnDeleted("thread-engine-barriers", "turn-deleted");
    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: {
        eventId: "completed-deleted",
        kind: "item_updated",
        threadId: "thread-engine-barriers",
        turnId: "turn-deleted",
        generation: 2,
        item: { id: "agent-deleted", role: "agent", text: "deleted" }
      }
    });
    useStore.getState().markTurnInterrupted("thread-engine-barriers", "turn-interrupted");
    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: {
        eventId: "completed-interrupted",
        kind: "item_updated",
        threadId: "thread-engine-barriers",
        turnId: "turn-interrupted",
        generation: 2,
        item: { id: "agent-interrupted", role: "agent", text: "interrupted" }
      }
    });

    const thread = useStore.getState().threads["thread-engine-barriers"]!;
    expect(thread.entries).toEqual([
      expect.objectContaining({ id: "agent-live", body: { kind: "agent-message", text: "accepted" } })
    ]);
    expect(thread.timelineEngine.diagnostics.droppedDuplicateEvents).toBeGreaterThanOrEqual(1);
    expect(thread.timelineEngine.diagnostics.droppedStaleGenerationEvents).toBeGreaterThanOrEqual(3);
  });

  it("does not rewrite completed activity timestamps to move them before an assistant message", () => {
    useStore.getState().setThreadEntries(
      "thread-activity-order",
      [
        {
          id: "agent-final",
          turnId: "turn-1",
          createdAt: 100,
          body: { kind: "agent-message", text: "final" }
        }
      ],
      null
    );

    useStore.getState().replaceOrAddEntry("thread-activity-order", {
      id: "tool-completed",
      turnId: "turn-1",
      createdAt: 200,
      body: {
        kind: "tool",
        toolKind: "command",
        server: "command",
        tool: "npm test",
        status: "success",
        result: "passed"
      }
    });

    const thread = useStore.getState().threads["thread-activity-order"]!;
    expect(thread.entries.find((entry) => entry.id === "tool-completed")?.createdAt).toBe(200);
    expect(thread.entries.map((entry) => entry.id)).toEqual(["agent-final", "tool-completed"]);
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
        equivalentOutputCandidateChecks: expect.any(Number),
        fastPathCommits: expect.any(Number),
        structuralNormalizations: expect.any(Number),
        indexRebuildEntries: expect.any(Number)
      })
    );
    expect(diagnostics!.normalizeRuns).toBeLessThanOrEqual(2);
    expect(diagnostics!.entryIndexBuildEntries).toBeLessThanOrEqual(1400);
    expect(diagnostics!.linearEntryScans).toBeLessThanOrEqual(3000);
    expect(diagnostics!.equivalentOutputCandidateChecks).toBeLessThanOrEqual(2000);
    expect(diagnostics!.fastPathCommits).toBeGreaterThanOrEqual(200);
    expect(diagnostics!.structuralNormalizations).toBeLessThanOrEqual(2);
    expect(diagnostics!.indexRebuildEntries).toBeLessThanOrEqual(2500);
    expect(useStore.getState().threads["thread-long"]?.entries).toHaveLength(1240);
    expect(useStore.getState().threads["thread-long"]?.entries.at(-41)).toEqual(
      expect.objectContaining({
        id: "agent-1199",
        body: { kind: "agent-message", text: `回复 1199${"x".repeat(200)}` }
      })
    );
  });

  it("keeps persisted engine entries indexes and ledgers aligned with thread state", () => {
    useStore.getState().setThreadEntries(
      "thread-engine-state",
      [
        {
          id: "agent-1",
          turnId: "turn-1",
          createdAt: 1,
          body: { kind: "agent-message", text: "hello" }
        }
      ],
      "older"
    );
    useStore.getState().appendTextToEntry("thread-engine-state", {
      id: "agent-1",
      turnId: "turn-1",
      createdAt: 2,
      body: { kind: "agent-message", text: " world" }
    });
    useStore.getState().prependEntries(
      "thread-engine-state",
      [
        {
          id: "user-0",
          turnId: "turn-0",
          createdAt: 0,
          body: { kind: "user-message", text: "older", status: "sent" }
        }
      ],
      null,
      true
    );

    const thread = useStore.getState().threads["thread-engine-state"]!;
    expect(thread.timelineEngine.entries).toBe(thread.entries);
    expect(thread.timelineEngine.deletedTurnIds).toBe(thread.deletedTurnIds);
    expect(thread.timelineEngine.processedEventIds).toBe(thread.processedEventIds);
    expect(thread.timelineEngine.itemRevisions).toBe(thread.itemRevisions);
    expect(thread.timelineEngine.indexes.byEntryId.get("user-0")).toBe(0);
    expect(thread.timelineEngine.indexes.byEntryId.get("agent-1")).toBe(1);
    expect(thread.entries[1]).toEqual(
      expect.objectContaining({ body: { kind: "agent-message", text: "hello world" } })
    );
  });

  it("replaces only the authoritative latest window and preserves post-watermark live state", () => {
    const stamp = { bootId: "boot-a", generation: 2 };
    const entry = (id: string, turnId: string, text: string, extra: Record<string, unknown> = {}) => ({
      id,
      turnId,
      bootId: stamp.bootId,
      generation: stamp.generation,
      historyStamp: stamp,
      createdAt: Date.now(),
      ...extra,
      body: { kind: "agent-message" as const, text }
    });
    useStore.getState().setThreadEntries("thread-window", [
      entry("older", "turn-0", "older", { baselineWatermark: 5 }),
      entry("window-start", "turn-1", "old start", { baselineWatermark: 5 }),
      entry("stale-tail", "turn-1", "stale", { streamSequence: 8 }),
      entry("late-live", "turn-2", "late", { streamSequence: 15 })
    ], "older-cursor");
    useStore.getState().appendEntries("thread-window", [{
      id: "local-user-pending",
      clientUserMessageId: "local-user-pending",
      createdAt: Date.now(),
      body: { kind: "user-message", text: "pending", status: "sending" }
    }]);
    const authoritative = [
      entry("window-start", "turn-1", "new start", { baselineWatermark: 10 }),
      entry("window-end", "turn-1", "new end", { baselineWatermark: 10 })
    ];

    const applied = useStore.getState().replaceLatestWindow("thread-window", authoritative, null, {
      historyStamp: stamp,
      pageWatermark: 10,
      windowStartAnchor: JSON.stringify(["boot-a", 2, "turn-1", "window-start"]),
      windowEndAnchor: JSON.stringify(["boot-a", 2, "turn-1", "window-end"])
    });

    expect(applied).toBe(true);
    expect(useStore.getState().threads["thread-window"]?.entries.map((item) => item.id)).toEqual([
      "older",
      "window-start",
      "window-end",
      "late-live",
      "local-user-pending"
    ]);
  });

  it("跨 generation repair 只迁移 preservedThrough 证明的旧页前缀", () => {
    const oldStamp = { bootId: "boot-a", generation: 1 };
    const nextStamp = { bootId: "boot-a", generation: 2 };
    const oldEntry = (id: string, turnId: string, text: string, extra: Record<string, unknown> = {}) => ({
      id,
      turnId,
      historyStamp: oldStamp,
      bootId: oldStamp.bootId,
      generation: oldStamp.generation,
      createdAt: Date.now(),
      ...extra,
      body: { kind: "agent-message" as const, text }
    });
    useStore.getState().setThreadEntries("thread-generation-rebase", [
      oldEntry("older-page", "turn-0", "older page"),
      oldEntry("preserved", "turn-1", "preserved"),
      oldEntry("old-window", "turn-2", "old window"),
      oldEntry("old-live-tail", "turn-3", "must disappear", { streamSequence: 99 })
    ], "older-cursor");
    const authoritative = [{
      id: "new-window",
      turnId: "turn-2",
      historyStamp: nextStamp,
      bootId: nextStamp.bootId,
      generation: nextStamp.generation,
      baselineWatermark: 10,
      createdAt: Date.now(),
      body: { kind: "agent-message" as const, text: "new window" }
    }];

    const applied = useStore.getState().replaceLatestWindow(
      "thread-generation-rebase",
      authoritative,
      null,
      {
        historyStamp: nextStamp,
        pageWatermark: 10,
        preservedThrough: JSON.stringify(["boot-a", 1, "turn-1", "preserved"]),
        windowStartAnchor: JSON.stringify(["boot-a", 2, "turn-2", "new-window"]),
        windowEndAnchor: JSON.stringify(["boot-a", 2, "turn-2", "new-window"])
      }
    );

    expect(applied).toBe(true);
    const entries = useStore.getState().threads["thread-generation-rebase"]!.entries;
    expect(entries.map((entry) => entry.id)).toEqual(["older-page", "preserved", "new-window"]);
    expect(entries.every((entry) => entry.historyStamp?.generation === 2)).toBe(true);
  });

  it("routes thread entry actions through timeline engine inputs", () => {
    useStore.getState().__resetTimelineDiagnostics?.();

    useStore.getState().setThreadEntries(
      "thread-engine",
      [
        {
          id: "snapshot-user",
          turnId: "turn-1",
          createdAt: 1,
          body: { kind: "user-message", text: "snapshot", status: "sent" }
        }
      ],
      "older"
    );
    useStore.getState().mergeThreadEntries(
      "thread-engine",
      [
        {
          id: "snapshot-agent",
          turnId: "turn-1",
          createdAt: 2,
          body: { kind: "agent-message", text: "agent" }
        }
      ],
      null
    );
    useStore.getState().prependEntries(
      "thread-engine",
      [
        {
          id: "older-user",
          turnId: "turn-0",
          createdAt: 0,
          body: { kind: "user-message", text: "older", status: "sent" }
        }
      ],
      null,
      true
    );
    useStore.getState().appendEntries("thread-engine", [
      {
        id: "local-user-next",
        createdAt: 3,
        body: { kind: "user-message", text: "next", status: "sending" }
      }
    ]);
    useStore.getState().replaceOrAddEntry("thread-engine", {
      id: "server-user-next",
      createdAt: 4,
      body: { kind: "user-message", text: "next", status: "sent" }
    });
    useStore.getState().appendTextToEntry("thread-engine", {
      id: "agent-new",
      turnId: "turn-2",
      createdAt: 5,
      body: { kind: "agent-message", text: "delta" }
    });

    expect(useStore.getState().__getTimelineDiagnostics?.().engineInputCommits).toBeGreaterThanOrEqual(6);
  });

  it("caches visible output compact completion and ordered turns in timeline indexes", () => {
    useStore.getState().setThreadEntries(
      "thread-indexes",
      [
        {
          id: "user-1",
          turnId: "turn-1",
          createdAt: 1,
          body: { kind: "user-message", text: "first", status: "sent" }
        },
        {
          id: "agent-1",
          turnId: "turn-1",
          createdAt: 2,
          body: { kind: "agent-message", text: "reply" }
        },
        {
          id: "user-2",
          turnId: "turn-2",
          createdAt: 3,
          body: { kind: "user-message", text: "compact", status: "sent" }
        },
        {
          id: "compact-1",
          turnId: "turn-2",
          createdAt: 4,
          body: { kind: "system", text: "压缩上下文已完成" }
        }
      ],
      null
    );

    const indexes = useStore.getState().threads["thread-indexes"]?.entryIndexes;
    expect(indexes?.byTurnId.get("turn-1")).toEqual([0, 1]);
    expect(indexes?.visibleOutputTurnIds.has("turn-1")).toBe(true);
    expect(indexes?.visibleOutputTurnIds.has("turn-2")).toBe(true);
    expect(indexes?.compactCompletionSeen).toBe(true);
    expect(indexes?.orderedDistinctTurns.map((turn) => turn.turnId)).toEqual(["turn-1", "turn-2"]);
  });

  it("does not retain obsolete store-level bulk normalization helpers", async () => {
    const source = await readFile(join(process.cwd(), "src/web/state/store.ts"), "utf8");

    expect(source).not.toMatch(/\bfunction normalizeTimelineEntries\b/);
    expect(source).not.toMatch(/\bfunction mergeEquivalentOutputEntries\b/);
    expect(source).not.toMatch(/\bfunction orderTimelineEntries\b/);
    expect(source).not.toMatch(/\bfunction replaceConfirmedLocalUserMessagesInPlace\b/);
    expect(source).not.toMatch(/\bfunction removeDuplicateConfirmedUserMessages\b/);
    expect(source).not.toMatch(/\bfunction removeConfirmedLocalUserMessages\b/);
    expect(source).not.toMatch(/\bfunction removeDuplicateLocalUserMessages\b/);
    expect(source).not.toMatch(/\bfunction removeAdjacentDuplicateUserMessages\b/);
    expect(source).not.toMatch(/\bfunction findEquivalentOutputIndex\b/);
    expect(source).not.toMatch(/\bfunction mergeEquivalentOutputEntry\b/);
    expect(source).not.toMatch(/\bfunction completedActivityEntryBeforeFinalAssistant\b/);
    expect(source).not.toMatch(/createdAt:\s*current\.createdAt\s*-\s*0\.001/);
    expect(source).not.toMatch(/\bfunction itemRevisionsFromEntries\b/);
    expect(source).not.toMatch(/\bfunction trimProcessedEventIds\b/);
    expect(source).not.toMatch(/\bfunction hasProcessedEventId\b/);
    expect(source).not.toMatch(/\bfunction recordProcessedEventId\b/);
    expect(source).not.toMatch(/prev\.interruptedTurnIds\.has\(entry\.turnId\)/);
  });

  it("keeps timeline ledger and snapshot suppression helpers in the engine", async () => {
    const storeSource = await readFile(join(process.cwd(), "src/web/state/store.ts"), "utf8");
    const engineSource = await readFile(join(process.cwd(), "src/web/state/timeline-engine.ts"), "utf8");

    expect(storeSource).not.toMatch(/\bfunction snapshotDeltaSuppressions\b/);
    expect(storeSource).not.toMatch(/\bfunction itemRevisionKey\b/);
    expect(engineSource).toMatch(/\bexport function createSnapshotDeltaSuppressions\b/);
    expect(engineSource).toMatch(/\bexport function shouldSuppressSnapshotDeltaReplay\b/);
    expect(engineSource).toMatch(/\bexport function timelineItemRevisionKey\b/);
  });
});
