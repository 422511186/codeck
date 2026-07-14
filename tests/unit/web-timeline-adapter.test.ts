import { describe, expect, it } from "vitest";
import {
  repairReconstructedTimelineEntries,
  threadDetailEntries,
  threadDetailEntriesWithTurnItems
} from "../../src/web/state/timeline-adapter";
import type { ThreadDetail } from "../../src/web/api/types";
import type { TimelineEntry } from "../../src/web/state/timeline";

function entry(id: string, turnId: string, createdAt: number, body: TimelineEntry["body"]): TimelineEntry {
  return { id, turnId, createdAt, body };
}

describe("timeline adapter", () => {
  it("normalizes Unix-second snapshot timestamps to milliseconds", () => {
    const updatedAtSeconds = 1_783_991_271;
    const detail = {
      id: "thread-seconds",
      title: "历史会话",
      preview: "",
      cwd: "/repo",
      modelProvider: "custom",
      status: "idle",
      updatedAt: updatedAtSeconds,
      lastTurnId: "turn-old",
      nextCursor: null,
      timeline: [
        { id: "history-user", turnId: "turn-old", role: "user" as const, text: "历史问题" },
        { id: "history-agent", turnId: "turn-old", role: "agent" as const, text: "历史回答" }
      ]
    } satisfies ThreadDetail;

    const entries = threadDetailEntries(detail);

    expect(entries.map((item) => item.createdAt)).toEqual([
      (updatedAtSeconds - 2) * 1000,
      (updatedAtSeconds - 1) * 1000
    ]);
  });

  it("preserves source order without moving trailing activity or rewriting timestamps", () => {
    const repaired = repairReconstructedTimelineEntries([
      entry("user-1", "turn-1", 1, { kind: "user-message", text: "分析 bug", status: "sent" }),
      entry("agent-1", "turn-1", 2, { kind: "agent-message", text: "最终结论" }),
      entry("cmd-1", "turn-1", 3, {
        kind: "tool",
        toolKind: "command",
        server: "command",
        tool: "npm test",
        status: "success",
        result: "passed"
      })
    ]);

    expect(repaired.map((item) => item.id)).toEqual(["user-1", "agent-1", "cmd-1"]);
    expect(repaired[0]?.createdAt).toBe(1);
    expect(repaired[1]?.createdAt).toBe(2);
    expect(repaired[2]?.createdAt).toBe(3);
    expect(repaired.map((item) => item.sourceOrder?.ordinal)).toEqual([0, 1, 2]);
  });

  it("maps turn detail order to source metadata without merging visible entries", () => {
    const details = repairReconstructedTimelineEntries([
      entry("agent-1", "turn-1", 10, { kind: "agent-message", text: "最终结论" }),
      entry("cmd-1", "turn-1", 11, {
        kind: "tool",
        toolKind: "command",
        server: "command",
        tool: "npm test",
        status: "success",
        result: "passed"
      })
    ], "turn-detail");

    expect(details.map((item) => item.id)).toEqual(["agent-1", "cmd-1"]);
    expect(details[0]?.sourceOrder).toEqual({
      sourceKind: "turn-detail",
      ordinal: 0,
      beforeEntryId: "cmd-1"
    });
    expect(details[1]?.sourceOrder).toEqual({
      sourceKind: "turn-detail",
      ordinal: 1,
      afterEntryId: "agent-1"
    });
  });

  it("continues turn item detail beyond five pages", async () => {
    const detail = {
      id: "thread-1",
      title: "长会话",
      preview: "",
      cwd: "/repo",
      modelProvider: "openai",
      status: "idle",
      updatedAt: 100,
      lastTurnId: "turn-1",
      nextCursor: null,
      timeline: []
    } satisfies ThreadDetail;
    const requestedCursors: Array<string | null | undefined> = [];

    const result = await threadDetailEntriesWithTurnItems(detail, "thread-1", async (_threadId, turnId, cursor) => {
      requestedCursors.push(cursor);
      const pageIndex = cursor ? Number(cursor.slice("page-".length)) : 0;
      return {
        items: [{ id: `agent-${pageIndex}`, turnId, role: "agent", text: `第 ${pageIndex + 1} 页` }],
        nextCursor: pageIndex < 5 ? `page-${pageIndex + 1}` : null
      };
    });

    expect(requestedCursors).toHaveLength(6);
    expect(result.detailEntries.map((item) => item.id)).toEqual([
      "agent-0",
      "agent-1",
      "agent-2",
      "agent-3",
      "agent-4",
      "agent-5"
    ]);
  });

  it("returns repair-required when turn item cursor loops", async () => {
    const detail = {
      id: "thread-loop",
      title: "cursor loop",
      preview: "",
      cwd: "/repo",
      modelProvider: "openai",
      status: "idle",
      updatedAt: 100,
      lastTurnId: "turn-loop",
      nextCursor: null,
      timeline: []
    } satisfies ThreadDetail;
    let requests = 0;

    const result = await threadDetailEntriesWithTurnItems(detail, "thread-loop", async (_threadId, turnId) => {
      requests += 1;
      return {
        items: [{ id: "agent-loop", turnId, role: "agent", text: "重复页" }],
        nextCursor: "same-cursor"
      };
    });

    expect(requests).toBe(2);
    expect(result).toEqual(
      expect.objectContaining({
        detailCompleteness: expect.objectContaining({ status: "repair-required", reason: "cursor-loop" })
      })
    );
  });

  it("resumes turn item detail from an explicit continuation cursor", async () => {
    const detail = {
      id: "thread-resume",
      title: "resume",
      preview: "",
      cwd: "/repo",
      modelProvider: "openai",
      status: "idle",
      updatedAt: 100,
      lastTurnId: "turn-resume",
      nextCursor: null,
      timeline: []
    } satisfies ThreadDetail;
    const requestedCursors: Array<string | null | undefined> = [];

    const result = await threadDetailEntriesWithTurnItems(
      detail,
      "thread-resume",
      async (_threadId, turnId, cursor) => {
        requestedCursors.push(cursor);
        return {
          items: [{ id: "agent-resumed", turnId, role: "agent", text: "续读正文" }],
          nextCursor: null
        };
      },
      { cursor: "detail-continuation" }
    );

    expect(requestedCursors).toEqual(["detail-continuation"]);
    expect(result.detailEntries.map((item) => item.id)).toEqual(["agent-resumed"]);
    expect(result.detailCompleteness).toEqual(
      expect.objectContaining({ status: "complete", nextCursor: null })
    );
  });

  it("returns scoped repair-required when a continuation cursor becomes invalid", async () => {
    const detail = {
      id: "thread-invalid-cursor",
      title: "invalid cursor",
      preview: "",
      cwd: "/repo",
      modelProvider: "openai",
      status: "idle",
      updatedAt: 100,
      lastTurnId: "turn-invalid",
      nextCursor: null,
      timeline: []
    } satisfies ThreadDetail;

    const result = await threadDetailEntriesWithTurnItems(
      detail,
      "thread-invalid-cursor",
      async () => {
        throw new Error("cursor expired");
      },
      { cursor: "expired-cursor" }
    );

    expect(result.detailEntries).toEqual([]);
    expect(result.detailCompleteness).toEqual({ status: "repair-required", reason: "source-gap" });
  });
});
