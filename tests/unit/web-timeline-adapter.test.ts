import { describe, expect, it } from "vitest";
import {
  mergeTurnItemDetailsIntoTimeline,
  repairReconstructedTimelineEntries
} from "../../src/web/state/timeline-adapter";
import type { TimelineEntry } from "../../src/web/state/timeline";

function entry(id: string, turnId: string, createdAt: number, body: TimelineEntry["body"]): TimelineEntry {
  return { id, turnId, createdAt, body };
}

describe("timeline adapter", () => {
  it("places repaired trailing activity before the final assistant message", () => {
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

    expect(repaired.map((item) => item.id)).toEqual(["user-1", "cmd-1", "agent-1"]);
    expect(repaired[0]?.createdAt).toBe(1);
    expect(repaired[1]!.createdAt).toBeGreaterThan(repaired[0]!.createdAt);
    expect(repaired[2]!.createdAt).toBeGreaterThan(repaired[1]!.createdAt);
  });

  it("merges turn item detail activity into the target turn without page-level ordering", () => {
    const base = [
      entry("user-1", "turn-1", 1, { kind: "user-message", text: "分析 bug", status: "sent" }),
      entry("agent-1", "turn-1", 2, { kind: "agent-message", text: "最终结论" })
    ];
    const details = [
      entry("agent-1", "turn-1", 10, { kind: "agent-message", text: "最终结论" }),
      entry("cmd-1", "turn-1", 11, {
        kind: "tool",
        toolKind: "command",
        server: "command",
        tool: "npm test",
        status: "success",
        result: "passed"
      })
    ];

    expect(mergeTurnItemDetailsIntoTimeline(base, details, "turn-1").map((item) => item.id)).toEqual([
      "user-1",
      "cmd-1",
      "agent-1"
    ]);
  });
});
