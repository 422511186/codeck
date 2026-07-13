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

  it("uses indexed fast paths for repeated deltas on a long timeline", () => {
    let state = applyTimelineInput(createTimelineEngineState(), {
      kind: "snapshot-window",
      entries: Array.from({ length: 1200 }, (_value, index) =>
        agentEntry(`agent-${index}`, `turn-${index}`, `reply ${index}`, index)
      )
    });

    for (let index = 0; index < 200; index += 1) {
      state = applyTimelineInput(state, {
        kind: "live-event",
        entry: agentEntry("agent-1199", "turn-1199", `reply 1199 ${"x".repeat(index + 1)}`, 2000 + index),
        eventId: `delta-${index}`,
        revision: index + 1
      });
    }

    expect(state.diagnostics.structuralNormalizations).toBe(1);
    expect(state.diagnostics.indexRebuildEntries).toBe(1200);
    expect(state.diagnostics.fastPathCommits).toBe(200);
    expect(state.entries[1199]).toEqual(
      expect.objectContaining({
        id: "agent-1199",
        body: { kind: "agent-message", text: `reply 1199 ${"x".repeat(200)}` }
      })
    );
  });

  it("appends native live delta fragments and rejects sequence gaps", () => {
    let state = createTimelineEngineState();
    state = applyTimelineInput(state, {
      kind: "live-delta",
      entry: agentEntry("agent-1", "turn-1", "hello", 1),
      eventId: "delta-10",
      revision: 1,
      sequence: 10,
      deliveryEpoch: 0
    });
    state = applyTimelineInput(state, {
      kind: "live-delta",
      entry: agentEntry("agent-1", "turn-1", " world", 2),
      eventId: "delta-11",
      revision: 2,
      sequence: 11,
      deliveryEpoch: 0
    });
    state = applyTimelineInput(state, {
      kind: "live-delta",
      entry: agentEntry("agent-1", "turn-1", " lost", 3),
      eventId: "delta-13",
      revision: 3,
      sequence: 13,
      deliveryEpoch: 0
    });

    expect(state.entries).toEqual([
      expect.objectContaining({ body: { kind: "agent-message", text: "hello world" } })
    ]);
    expect(state.diagnostics.sequenceGaps).toBe(1);
    expect(state.diagnostics.repairRequests).toBe(1);
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

  it("does not downgrade complete realtime content with a truncated snapshot", () => {
    let state = applyTimelineInput(createTimelineEngineState(), {
      kind: "live-event",
      entry: {
        ...agentEntry("agent-complete", "turn-1", "完整 realtime 正文", 1),
        completeness: { status: "complete", originalBytes: 24, includedBytes: 24 }
      }
    });

    state = applyTimelineInput(state, {
      kind: "snapshot-window",
      entries: [
        {
          ...agentEntry("agent-complete", "turn-1", "截断 preview", 2),
          completeness: {
            status: "truncated",
            reason: "item-budget",
            originalBytes: 120_000,
            includedBytes: 12,
            contentRef: "tlc-preview"
          }
        }
      ]
    });

    expect(state.entries).toEqual([
      expect.objectContaining({
        id: "agent-complete",
        completeness: expect.objectContaining({ status: "complete" }),
        body: { kind: "agent-message", text: "完整 realtime 正文" }
      })
    ]);
  });

  it("does not replace a richer truncated preview with a shorter partial snapshot", () => {
    let state = applyTimelineInput(createTimelineEngineState(), {
      kind: "live-event",
      entry: {
        ...agentEntry("agent-rich-preview", "turn-1", "较长 preview 正文", 1),
        completeness: {
          status: "truncated",
          reason: "event-budget",
          originalBytes: 200_000,
          includedBytes: 21,
          contentRef: "tlc-rich",
          contentCursor: "cursor-rich"
        }
      }
    });

    state = applyTimelineInput(state, {
      kind: "snapshot-window",
      entries: [
        {
          ...agentEntry("agent-rich-preview", "turn-1", "短", 2),
          completeness: {
            status: "partial",
            reason: "response-budget",
            includedBytes: 3,
            nextCursor: "snapshot-next"
          }
        }
      ]
    });

    expect(state.entries[0]).toEqual(
      expect.objectContaining({
        completeness: expect.objectContaining({
          status: "truncated",
          contentRef: "tlc-rich",
          contentCursor: "cursor-rich",
          nextCursor: "snapshot-next"
        }),
        body: { kind: "agent-message", text: "较长 preview 正文" }
      })
    );
  });

  it("completes a truncated preview in place and records completeness diagnostics", () => {
    let state = applyTimelineInput(createTimelineEngineState(), {
      kind: "turn-item-detail",
      entry: {
        ...toolEntry("tool-content", "turn-1", "preview", 1),
        completeness: {
          status: "truncated",
          reason: "item-budget",
          originalBytes: 200_000,
          includedBytes: 7,
          contentRef: "tlc-tool"
        }
      }
    });
    state = applyTimelineInput(state, {
      kind: "completed-item",
      entry: {
        ...toolEntry("tool-content", "turn-1", "preview + full output", 2),
        completeness: { status: "complete", originalBytes: 20, includedBytes: 20 }
      }
    });
    state = applyTimelineInput(state, {
      kind: "turn-item-detail",
      entry: {
        ...agentEntry("agent-repair", "turn-1", "missing", 3),
        completeness: { status: "repair-required", reason: "source-gap" }
      }
    });

    expect(state.entries.filter((entry) => entry.id === "tool-content")).toEqual([
      expect.objectContaining({
        completeness: expect.objectContaining({ status: "complete" }),
        body: expect.objectContaining({ kind: "tool", result: "preview + full output" })
      })
    ]);
    expect(state.diagnostics).toEqual(
      expect.objectContaining({
        itemTruncations: 1,
        repairRequiredInputs: 1,
        fullContentCompletions: 1
      })
    );
  });

  it("records page continuation and event-budget truncation diagnostics", () => {
    let state = applyTimelineInput(createTimelineEngineState(), {
      kind: "snapshot-window",
      entries: [],
      cursor: "older-page"
    });
    state = applyTimelineInput(state, {
      kind: "live-event",
      entry: {
        ...agentEntry("agent-reference", "turn-1", "preview", 1),
        completeness: {
          status: "truncated",
          reason: "event-budget",
          originalBytes: 500_000,
          includedBytes: 7,
          contentRef: "tlc-event"
        }
      }
    });

    expect(state.diagnostics).toEqual(
      expect.objectContaining({
        pageContinuations: 1,
        eventTruncations: 1,
        itemTruncations: 1
      })
    );
  });

  it("converges realtime reference/full and refresh partial/detail for the same fixture", () => {
    const preview = {
      ...toolEntry("tool-differential", "turn-1", "preview", 1),
      completeness: {
        status: "truncated" as const,
        reason: "event-budget" as const,
        originalBytes: 400_000,
        includedBytes: 7,
        contentRef: "tlc-differential"
      }
    };
    const complete = {
      ...toolEntry("tool-differential", "turn-1", "preview + complete output", 2),
      completeness: { status: "complete" as const, originalBytes: 25, includedBytes: 25 }
    };

    let realtime = applyTimelineInput(createTimelineEngineState(), {
      kind: "live-event",
      entry: preview,
      eventId: "reference-1",
      revision: 1
    });
    realtime = applyTimelineInput(realtime, {
      kind: "completed-item",
      entry: complete,
      eventId: "complete-2",
      revision: 2
    });

    let refreshed = applyTimelineInput(createTimelineEngineState(), {
      kind: "snapshot-window",
      entries: [{ ...preview, completeness: { ...preview.completeness, reason: "item-budget" } }],
      cursor: "detail-continuation"
    });
    refreshed = applyTimelineInput(refreshed, { kind: "turn-item-detail", entry: complete });

    expect(selectTimelineEntries(realtime)).toEqual(selectTimelineEntries(refreshed));
    expect(selectTimelineEntries(realtime)).toEqual([
      expect.objectContaining({
        id: "tool-differential",
        completeness: expect.objectContaining({ status: "complete" }),
        body: expect.objectContaining({ kind: "tool", result: "preview + complete output" })
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

  it("converges realtime fragments and refreshed snapshot to the same visible order and text", () => {
    const snapshotEntries: TimelineEntry[] = [
      userEntry("user-1", "turn-1", "start", 1),
      agentEntry("agent-1", "turn-1", "first answer", 2),
      toolEntry("tool-1", "turn-1", "tests passed", 3),
      agentEntry("agent-2", "turn-1", "final answer", 4),
      {
        id: "diff-1",
        turnId: "turn-1",
        createdAt: 5,
        body: { kind: "diff" as const, path: "src/app.ts", added: 1, removed: 0, diff: "+fixed" }
      }
    ].map((entry, ordinal) => ({
      ...entry,
      sourceOrder: { sourceKind: "snapshot" as const, ordinal }
    }));

    const snapshotState = applyTimelineInput(createTimelineEngineState(), {
      kind: "snapshot-window",
      entries: snapshotEntries
    });

    let realtimeState = createTimelineEngineState();
    const realtimeInputs: TimelineInput[] = [
      { kind: "live-event", entry: { ...snapshotEntries[0]!, sourceOrder: { sourceKind: "live", ordinal: 0 } } },
      {
        kind: "live-delta",
        entry: { ...agentEntry("agent-1", "turn-1", "first ", 2), sourceOrder: { sourceKind: "live", ordinal: 1 } },
        eventId: "agent-1-delta-1",
        revision: 1,
        sequence: 1
      },
      {
        kind: "live-delta",
        entry: { ...agentEntry("agent-1", "turn-1", "draft", 2), sourceOrder: { sourceKind: "live", ordinal: 2 } },
        eventId: "agent-1-delta-2",
        revision: 2,
        sequence: 2
      },
      { kind: "turn-item-detail", entry: snapshotEntries[1]! },
      { kind: "live-event", entry: { ...snapshotEntries[2]!, sourceOrder: { sourceKind: "live", ordinal: 3 } } },
      {
        kind: "live-delta",
        entry: { ...agentEntry("agent-2", "turn-1", "final ", 4), sourceOrder: { sourceKind: "live", ordinal: 4 } },
        eventId: "agent-2-delta-1",
        revision: 1,
        sequence: 1
      },
      { kind: "turn-item-detail", entry: snapshotEntries[3]! },
      { kind: "live-event", entry: { ...snapshotEntries[4]!, sourceOrder: { sourceKind: "live", ordinal: 5 } } }
    ];
    realtimeState = realtimeInputs.reduce(applyTimelineInput, realtimeState);

    const visible = (state: typeof snapshotState) =>
      selectTimelineEntries(state).map((entry) => ({
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

    expect(visible(realtimeState)).toEqual(visible(snapshotState));
    expect(visible(realtimeState)).toEqual([
      { id: "user-1", text: "start" },
      { id: "agent-1", text: "first answer" },
      { id: "tool-1", text: "tests passed" },
      { id: "agent-2", text: "final answer" },
      { id: "diff-1", text: "+fixed" }
    ]);
  });

  it("merges a live file placeholder with its completed snapshot at the original position", () => {
    let state = applyTimelineInput(createTimelineEngineState(), {
      kind: "snapshot-window",
      entries: [
        { ...agentEntry("agent-before", "turn-1", "before", 1), sourceOrder: { sourceKind: "snapshot", ordinal: 0 } },
        { ...agentEntry("agent-after", "turn-1", "after", 3), sourceOrder: { sourceKind: "snapshot", ordinal: 2 } }
      ]
    });
    state = applyTimelineInput(state, {
      kind: "live-event",
      entry: {
        id: "file-1",
        turnId: "turn-1",
        createdAt: 2,
        sourceOrder: { sourceKind: "live", ordinal: 1, beforeEntryId: "agent-after", afterEntryId: "agent-before" },
        body: { kind: "tool", toolKind: "file", server: "file", tool: "file", status: "running", result: "patching" }
      }
    });
    state = applyTimelineInput(state, {
      kind: "turn-item-detail",
      entry: {
        id: "file-1",
        turnId: "turn-1",
        createdAt: 4,
        sourceOrder: { sourceKind: "snapshot", ordinal: 1, beforeEntryId: "agent-after", afterEntryId: "agent-before" },
        body: {
          kind: "tool",
          toolKind: "file",
          server: "file",
          tool: "src/app.ts",
          diffPath: "src/app.ts",
          added: 7,
          removed: 3,
          status: "success",
          result: "+fixed"
        }
      }
    });

    expect(selectTimelineEntries(state).map((entry) => entry.id)).toEqual([
      "agent-before",
      "file-1",
      "agent-after"
    ]);
    expect(selectTimelineEntries(state).filter((entry) => entry.id === "file-1")).toHaveLength(1);
    expect(selectTimelineEntries(state)[1]?.body).toEqual(
      expect.objectContaining({ kind: "tool", tool: "src/app.ts", status: "success" })
    );
  });

  it("inserts a repair-only file change between its anchored agent messages", () => {
    let state = applyTimelineInput(createTimelineEngineState(), {
      kind: "snapshot-window",
      entries: [
        agentEntry("agent-before", "turn-1", "before", 1),
        agentEntry("agent-after", "turn-1", "after", 3)
      ]
    });
    state = applyTimelineInput(state, {
      kind: "snapshot-merge",
      cursor: null,
      entries: [
        {
          id: "file-repaired",
          turnId: "turn-1",
          createdAt: 2,
          sourceOrder: {
            sourceKind: "snapshot",
            ordinal: 1,
            beforeEntryId: "agent-after",
            afterEntryId: "agent-before"
          },
          body: {
            kind: "tool",
            toolKind: "file",
            server: "file",
            tool: "src/app.ts",
            diffPath: "src/app.ts",
            added: 7,
            removed: 3,
            status: "success",
            result: "+fixed"
          }
        }
      ]
    });

    expect(selectTimelineEntries(state).map((entry) => entry.id)).toEqual([
      "agent-before",
      "file-repaired",
      "agent-after"
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
