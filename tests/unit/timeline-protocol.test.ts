import { describe, expect, it } from "vitest";
import {
  historyStampFrom,
  repairWindowFrom,
  resolveAgentMessageAlias,
  timelineGapScopeFrom,
  timelineSequencesFrom
} from "../../src/shared/timeline-protocol";

describe("timeline protocol", () => {
  it("parses a complete history stamp and rejects legacy partial stamps", () => {
    expect(historyStampFrom({ bootId: "boot-a", generation: 2 })).toEqual({ bootId: "boot-a", generation: 2 });
    expect(historyStampFrom({ generation: 2 })).toBeNull();
    expect(historyStampFrom({ bootId: "", generation: -1 })).toBeNull();
  });

  it("normalizes legacy sequence only as a stream cursor", () => {
    expect(timelineSequencesFrom({ sequence: 7 })).toEqual({ streamSequence: 7 });
    expect(timelineSequencesFrom({ streamSequence: 8, fragmentSequence: 3, sequence: 7 })).toEqual({
      streamSequence: 8,
      fragmentSequence: 3
    });
  });

  it("normalizes thread-scoped and all-tracked gap payloads", () => {
    expect(timelineGapScopeFrom({ threadId: "thread-a" })).toEqual({
      scope: "threads",
      affectedThreadIds: ["thread-a"]
    });
    expect(timelineGapScopeFrom({ affectedThreadIds: ["thread-b", "thread-a", "thread-b"] })).toEqual({
      scope: "threads",
      affectedThreadIds: ["thread-b", "thread-a"]
    });
    expect(timelineGapScopeFrom({ scope: "all-tracked" })).toEqual({ scope: "all-tracked" });
    expect(timelineGapScopeFrom({})).toBeNull();
  });

  it("accepts only complete bounded repair windows", () => {
    expect(
      repairWindowFrom({
        bootId: "boot-a",
        generation: 2,
        pageWatermark: 12,
        windowStartAnchor: "turn-1/item-1",
        windowEndAnchor: "turn-2/item-2",
        preservedThrough: "turn-0/item-0"
      })
    ).toEqual({
      historyStamp: { bootId: "boot-a", generation: 2 },
      pageWatermark: 12,
      windowStartAnchor: "turn-1/item-1",
      windowEndAnchor: "turn-2/item-2",
      preservedThrough: "turn-0/item-0"
    });
    expect(
      repairWindowFrom({ bootId: "boot-a", generation: 2, pageWatermark: 12, windowStartAnchor: "start" })
    ).toBeNull();
  });

  type AliasCandidate = {
    id: string;
    turnId: string;
    generation: number;
    text: string;
    provisional: boolean;
  };

  const canonical = (overrides: Partial<AliasCandidate> = {}): AliasCandidate => ({
    id: "canonical-1",
    turnId: "turn-1",
    generation: 2,
    text: "完整回答",
    provisional: false,
    ...overrides
  });
  const provisional = (overrides: Partial<AliasCandidate> = {}): AliasCandidate => ({
    id: "provisional-1",
    turnId: "turn-1",
    generation: 2,
    text: "完整回答",
    provisional: true,
    ...overrides
  });

  it("resolves a unique provisional agent alias with equal or prefix-compatible text", () => {
    expect(resolveAgentMessageAlias(canonical(), [provisional()])).toEqual({
      kind: "alias",
      canonicalId: "canonical-1",
      provisionalId: "provisional-1"
    });
    expect(resolveAgentMessageAlias(canonical(), [provisional({ text: "完整" })])).toEqual({
      kind: "alias",
      canonicalId: "canonical-1",
      provisionalId: "provisional-1"
    });
  });

  it("does not alias across turns or between two canonical items", () => {
    expect(resolveAgentMessageAlias(canonical(), [provisional({ turnId: "turn-2" })])).toEqual({
      kind: "none",
      reason: "no-match"
    });
    expect(resolveAgentMessageAlias(canonical(), [canonical({ id: "canonical-2" })])).toEqual({
      kind: "none",
      reason: "no-match"
    });
  });

  it("fails closed for conflicting or ambiguous provisional candidates", () => {
    expect(resolveAgentMessageAlias(canonical(), [provisional({ text: "其他回答" })])).toEqual({
      kind: "none",
      reason: "conflict"
    });
    expect(
      resolveAgentMessageAlias(canonical(), [provisional(), provisional({ id: "provisional-2" })])
    ).toEqual({ kind: "none", reason: "ambiguous" });
  });
});
