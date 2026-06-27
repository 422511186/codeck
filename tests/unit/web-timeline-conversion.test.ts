import { describe, it, expect } from "vitest";
import { timelineItemToEntry } from "../../src/web/state/timeline";
import type { TimelineItem } from "../../src/web/api/types";

describe("timeline conversion", () => {
  it("should convert user message", () => {
    const item: TimelineItem = {
      id: "1",
      role: "user",
      text: "hello"
    };
    const entry = timelineItemToEntry(item, 1000);
    expect(entry.id).toBe("1");
    expect(entry.createdAt).toBe(1000);
    expect(entry.body.kind).toBe("user-message");
    expect((entry.body as any).text).toBe("hello");
  });

  it("should convert agent message", () => {
    const item: TimelineItem = {
      id: "2",
      role: "agent",
      text: "response"
    };
    const entry = timelineItemToEntry(item, 2000);
    expect(entry.body.kind).toBe("agent-message");
    expect((entry.body as any).text).toBe("response");
  });

  it("should convert reasoning", () => {
    const item: TimelineItem = {
      id: "5",
      role: "reasoning",
      text: "thinking..."
    };
    const entry = timelineItemToEntry(item, 5000);
    expect(entry.body.kind).toBe("reasoning");
    expect((entry.body as any).text).toBe("thinking...");
    expect((entry.body as any).done).toBe(true);
  });

  it("should convert plan", () => {
    const item: TimelineItem = {
      id: "9",
      role: "plan",
      text: "Step 1: ..."
    };
    const entry = timelineItemToEntry(item, 9000);
    expect(entry.body.kind).toBe("system");
    expect((entry.body as any).text).toBe("Step 1: ...");
  });

  it("should convert tool call", () => {
    const item: TimelineItem = {
      id: "6",
      role: "tool",
      text: "search result"
    };
    const entry = timelineItemToEntry(item, 6000);
    expect(entry.body.kind).toBe("tool");
    expect((entry.body as any).result).toBe("search result");
  });

  it("should handle unknown role as system", () => {
    const item: TimelineItem = {
      id: "10",
      role: "unknown" as TimelineRole,
      text: "Unknown message"
    };
    const entry = timelineItemToEntry(item, 10000);
    expect(entry.body.kind).toBe("system");
    expect((entry.body as any).text).toBe("Unknown message");
  });
});
