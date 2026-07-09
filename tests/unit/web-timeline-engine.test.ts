import { describe, expect, it } from "vitest";
import {
  applyTimelineInput,
  createTimelineEngineState,
  selectOrderedDistinctTurns,
  selectTimelineEntries,
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
