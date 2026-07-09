import { describe, expect, it } from "vitest";
import {
  applyTimelineInput,
  createTimelineEngineState,
  selectHasContextCompactionCompletion,
  selectOrderedDistinctTurns,
  selectRollbackMetadataForEntry,
  selectTimelineEntries,
  selectTurnHasVisibleOutput,
  type TimelineInput
} from "../../src/web/state/timeline-engine";
import type { TimelineEntry } from "../../src/web/state/timeline";

function userEntry(id: string, turnId: string, text: string, createdAt: number): TimelineEntry {
  return {
    id,
    turnId,
    createdAt,
    body: { kind: "user-message", text, status: "sent" }
  };
}

function agentEntry(id: string, turnId: string, text: string, createdAt: number): TimelineEntry {
  return {
    id,
    turnId,
    createdAt,
    body: { kind: "agent-message", text }
  };
}

function reasoningEntry(id: string, turnId: string, text: string, createdAt: number): TimelineEntry {
  return {
    id,
    turnId,
    createdAt,
    body: { kind: "reasoning", text, done: true }
  };
}

function toolEntry(id: string, turnId: string, result: string, createdAt: number): TimelineEntry {
  return {
    id,
    turnId,
    createdAt,
    body: { kind: "tool", toolKind: "command", server: "command", tool: "npm test", status: "success", result }
  };
}

function systemEntry(id: string, turnId: string, text: string, createdAt: number): TimelineEntry {
  return {
    id,
    turnId,
    createdAt,
    body: { kind: "system", text }
  };
}

describe("timeline engine", () => {
  it("accepts every timeline input source through one reducer", () => {
    const inputs: TimelineInput[] = [
      { kind: "snapshot-window", entries: [userEntry("snapshot-user", "turn-1", "hi", 1)], cursor: "older" },
      { kind: "pagination-page", entries: [userEntry("page-user", "turn-0", "older", 0)], cursor: null },
      { kind: "live-event", entry: agentEntry("live-agent", "turn-1", "live", 2), eventId: "event-live" },
      { kind: "live-event-batch", inputs: [{ kind: "live-event", entry: reasoningEntry("reasoning-1", "turn-1", "thinking", 3) }] },
      { kind: "overlay-item", entry: toolEntry("tool-1", "turn-1", "tool", 4) },
      { kind: "turn-item-detail", entry: agentEntry("turn-item-agent", "turn-1", "complete", 5) },
      { kind: "rollout-supplement-item", entry: systemEntry("rollout-compact", "turn-1", "压缩上下文已完成", 6) },
      {
        kind: "optimistic-user",
        entry: {
          id: "local-user-1",
          clientUserMessageId: "local-user-1",
          createdAt: 7,
          body: { kind: "user-message", text: "next", status: "sending" }
        }
      },
      { kind: "rollback-fork-replace", entries: [userEntry("after-rollback", "turn-r", "redo", 8)], generation: 1 }
    ];

    const state = inputs.reduce(applyTimelineInput, createTimelineEngineState());

    expect(selectTimelineEntries(state).map((entry) => entry.id)).toEqual(["after-rollback"]);
    expect(state.generation).toBe(1);
  });

  it("keeps multi-source batch merging within a bounded normalization budget", () => {
    let state = createTimelineEngineState();
    state = applyTimelineInput(state, {
      kind: "snapshot-window",
      entries: Array.from({ length: 1200 }, (_value, index) =>
        agentEntry(`snapshot-agent-${index}`, `turn-${index}`, `reply ${index}`, index)
      ),
      cursor: "older"
    });

    state = applyTimelineInput(state, {
      kind: "live-event-batch",
      inputs: [
        {
          kind: "live-event",
          entry: agentEntry("snapshot-agent-1199", "turn-1199", "reply 1199 live", 2000),
          eventId: "event-live"
        },
        {
          kind: "turn-item-detail",
          entry: agentEntry("snapshot-agent-1199", "turn-1199", "reply 1199 live final", 2001)
        },
        {
          kind: "overlay-item",
          entry: toolEntry("tool-overlay", "turn-1199", "npm test", 2002)
        },
        {
          kind: "rollout-supplement-item",
          entry: systemEntry("rollout-compact", "turn-1199", "压缩上下文已完成", 2003)
        },
        {
          kind: "optimistic-user",
          entry: {
            id: "local-user-next",
            clientUserMessageId: "local-user-next",
            createdAt: 2004,
            body: { kind: "user-message", text: "next prompt", status: "sending" }
          }
        }
      ]
    });

    expect(selectTimelineEntries(state)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "snapshot-agent-1199",
          body: { kind: "agent-message", text: "reply 1199 live final" }
        }),
        expect.objectContaining({ id: "tool-overlay" }),
        expect.objectContaining({ id: "rollout-compact" }),
        expect.objectContaining({ id: "local-user-next" })
      ])
    );
    expect(state.diagnostics.normalizationRuns).toBeLessThanOrEqual(2);
    expect(state.diagnostics.normalizedEntryVisits).toBeLessThanOrEqual(2500);
  });

  it("builds indexes for entry id turn id and stable identity after reduction", () => {
    let state = createTimelineEngineState();
    state = applyTimelineInput(state, {
      kind: "snapshot-window",
      entries: [
        userEntry("user-1", "turn-1", "hello", 1),
        agentEntry("agent-1", "turn-1", "partial", 2),
        toolEntry("tool-1", "turn-1", "running", 3)
      ]
    });
    state = applyTimelineInput(state, {
      kind: "turn-item-detail",
      entry: agentEntry("agent-1", "turn-1", "partial final", 4)
    });

    expect(state.indexes.byEntryId.get("agent-1")).toBe(1);
    expect(state.indexes.byTurnId.get("turn-1")).toEqual([0, 1, 2]);
    expect(state.indexes.byIdentity.get("agent-message:0:turn-1:agent-1")).toBe(1);
  });

  it("derives visible output compact completion and rollback metadata from indexes", () => {
    const state = applyTimelineInput(createTimelineEngineState(), {
      kind: "snapshot-window",
      entries: [
        userEntry("user-1", "turn-1", "first", 1),
        agentEntry("agent-1", "turn-1", "reply", 2),
        userEntry("user-2", "turn-2", "compact", 3),
        systemEntry("compact-1", "turn-2", "压缩上下文已完成", 4),
        userEntry("user-3", "turn-3", "tail", 5)
      ]
    });

    expect(selectTurnHasVisibleOutput(state, "turn-1")).toBe(true);
    expect(selectTurnHasVisibleOutput(state, "turn-3")).toBe(false);
    expect(selectHasContextCompactionCompletion(state)).toBe(true);
    expect(selectRollbackMetadataForEntry(state, userEntry("user-2", "turn-2", "compact", 3))).toEqual({
      numTurns: 2,
      expectedDeletedTurnIds: ["turn-2", "turn-3"]
    });
  });

  it("does not derive rollback metadata when target is the first known turn of an incomplete window", () => {
    const state = applyTimelineInput(createTimelineEngineState(), {
      kind: "snapshot-window",
      entries: [
        userEntry("user-2", "turn-2", "window head", 2),
        userEntry("user-3", "turn-3", "tail", 3)
      ],
      cursor: "older-turns"
    });

    expect(selectRollbackMetadataForEntry(state, userEntry("user-2", "turn-2", "window head", 2))).toBeNull();
    expect(selectRollbackMetadataForEntry(state, userEntry("user-3", "turn-3", "tail", 3))).toEqual({
      numTurns: 1,
      expectedDeletedTurnIds: ["turn-3"]
    });
  });

  it("confirms optimistic user messages in place and keeps repeated prompts distinct", () => {
    let state = createTimelineEngineState();
    state = applyTimelineInput(state, {
      kind: "optimistic-user",
      entry: {
        id: "local-user-a",
        clientUserMessageId: "local-user-a",
        createdAt: 1,
        body: {
          kind: "user-message",
          text: "same prompt",
          imagePaths: ["/tmp/a.png"],
          skillReferences: [{ name: "skill-a", path: "/skills/a/SKILL.md" }],
          status: "sending"
        }
      }
    });
    state = applyTimelineInput(state, {
      kind: "live-event",
      entry: {
        id: "server-user-a",
        turnId: "turn-a",
        clientUserMessageId: "local-user-a",
        createdAt: 2,
        body: { kind: "user-message", text: "same prompt", status: "sent" }
      }
    });
    state = applyTimelineInput(state, {
      kind: "live-event",
      entry: userEntry("server-user-b", "turn-b", "same prompt", 3)
    });

    const users = selectTimelineEntries(state).filter((entry) => entry.body.kind === "user-message");
    expect(users.map((entry) => entry.id)).toEqual(["server-user-a", "server-user-b"]);
    expect(users[0]).toMatchObject({
      turnId: "turn-a",
      clientUserMessageId: "local-user-a",
      body: {
        kind: "user-message",
        imagePaths: ["/tmp/a.png"],
        skillReferences: [{ name: "skill-a", path: "/skills/a/SKILL.md" }],
        status: "sent"
      }
    });
  });

  it("merges equivalent output entries by stable turn and item identity across sources", () => {
    let state = createTimelineEngineState();
    state = applyTimelineInput(state, {
      kind: "live-event",
      entry: { ...agentEntry("agent-live", "turn-1", "hello", 1), generation: 0 }
    });
    state = applyTimelineInput(state, {
      kind: "turn-item-detail",
      entry: { ...agentEntry("agent-live", "turn-1", "hello world", 2), generation: 0 }
    });
    state = applyTimelineInput(state, {
      kind: "rollout-supplement-item",
      entry: { ...toolEntry("tool-1", "turn-1", "partial", 3), generation: 0 }
    });
    state = applyTimelineInput(state, {
      kind: "turn-item-detail",
      entry: { ...toolEntry("tool-1", "turn-1", "partial\ncomplete", 4), generation: 0 }
    });

    const entries = selectTimelineEntries(state);
    expect(entries.filter((entry) => entry.body.kind === "agent-message")).toEqual([
      expect.objectContaining({ id: "agent-live", body: { kind: "agent-message", text: "hello world" } })
    ]);
    expect(entries.filter((entry) => entry.body.kind === "tool")).toEqual([
      expect.objectContaining({
        id: "tool-1",
        body: expect.objectContaining({ kind: "tool", result: "partial\ncomplete" })
      })
    ]);
  });

  it("renders context compaction once across live snapshot overlay and rollout sources", () => {
    let state = createTimelineEngineState();
    for (const input of [
      { kind: "live-event" as const, entry: systemEntry("live-compact", "turn-1", "压缩上下文已完成", 1) },
      { kind: "snapshot-window" as const, entries: [systemEntry("snapshot-compact", "turn-1", "压缩上下文已完成", 2)] },
      { kind: "overlay-item" as const, entry: systemEntry("overlay-compact", "turn-1", "压缩上下文已完成", 3) },
      { kind: "rollout-supplement-item" as const, entry: systemEntry("rollout-compact", "turn-1", "压缩上下文已完成", 4) }
    ]) {
      state = applyTimelineInput(state, input);
    }

    expect(selectTimelineEntries(state).filter((entry) => entry.body.kind === "system")).toEqual([
      expect.objectContaining({ body: { kind: "system", text: "压缩上下文已完成" } })
    ]);
  });

  it("preserves same-turn source order instead of hoisting every user entry", () => {
    let state = createTimelineEngineState();
    state = applyTimelineInput(state, {
      kind: "snapshot-window",
      entries: [
        userEntry("user-initial", "turn-1", "start", 1),
        reasoningEntry("reasoning-1", "turn-1", "think", 2),
        userEntry("user-steer", "turn-1", "steer", 3),
        toolEntry("tool-1", "turn-1", "tool", 4),
        agentEntry("agent-1", "turn-1", "answer", 5)
      ]
    });

    expect(selectTimelineEntries(state).map((entry) => entry.id)).toEqual([
      "user-initial",
      "reasoning-1",
      "user-steer",
      "tool-1",
      "agent-1"
    ]);
  });

  it("isolates event ids revisions and reused item ids by generation", () => {
    let state = createTimelineEngineState();
    state = applyTimelineInput(state, {
      kind: "live-event",
      eventId: "event-1",
      revision: 5,
      entry: { ...agentEntry("agent-1", "turn-old", "old", 1), generation: 0 }
    });
    state = applyTimelineInput(state, {
      kind: "rollback-fork-replace",
      entries: [],
      generation: 1,
      deletedTurnIds: ["turn-old"]
    });
    state = applyTimelineInput(state, {
      kind: "live-event",
      eventId: "event-1",
      revision: 1,
      entry: { ...agentEntry("agent-1", "turn-new", "new", 2), generation: 1 }
    });
    state = applyTimelineInput(state, {
      kind: "live-event",
      eventId: "late-old",
      revision: 6,
      entry: { ...agentEntry("agent-late", "turn-old", "late", 3), generation: 0 }
    });

    expect(selectTimelineEntries(state)).toEqual([
      expect.objectContaining({ id: "agent-1", turnId: "turn-new", body: { kind: "agent-message", text: "new" } })
    ]);
    expect(state.diagnostics.droppedStaleGenerationEvents).toBe(1);
  });

  it("selects ordered distinct turns for message actions", () => {
    let state = createTimelineEngineState();
    state = applyTimelineInput(state, {
      kind: "snapshot-window",
      entries: [
        userEntry("user-1", "turn-1", "one", 1),
        agentEntry("agent-1", "turn-1", "reply", 2),
        userEntry("user-steer", "turn-1", "steer", 3),
        userEntry("user-2", "turn-2", "two", 4),
        agentEntry("agent-2-live", "turn-2", "same", 5),
        agentEntry("agent-2-snapshot", "turn-2", "same", 6)
      ]
    });

    expect(selectOrderedDistinctTurns(state)).toEqual([
      { turnId: "turn-1", firstEntryId: "user-1", order: 0 },
      { turnId: "turn-2", firstEntryId: "user-2", order: 1 }
    ]);
  });
});
