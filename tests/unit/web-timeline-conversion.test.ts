import { describe, it, expect } from "vitest";
import { timelineItemToEntry } from "../../src/web/state/timeline";
import type { TimelineItem, TimelineRole } from "../../src/web/api/types";

describe("timeline conversion", () => {
  it("should convert user message", () => {
    const item: TimelineItem = {
      id: "1",
      role: "user",
      text: "hello",
      imagePaths: ["C:/shot.png"]
    };
    const entry = timelineItemToEntry(item, 1000);
    expect(entry.id).toBe("1");
    expect(entry.createdAt).toBe(1000);
    expect(entry.body.kind).toBe("user-message");
    expect((entry.body as any).text).toBe("hello");
    expect((entry.body as any).imagePaths).toEqual(["C:/shot.png"]);
  });

  it("should convert historical file mention blocks into image thumbnails", () => {
    const item: TimelineItem = {
      id: "1b",
      role: "user",
      text: `
# Files mentioned by the user:

## shot.png: C:/Users/huang/AppData/Local/Temp/shot.png

# In app browser:
- Current URL: http://127.0.0.1:3000/threads/abc

## My request for Codex:
请看截图

[图片]
`
    };

    const entry = timelineItemToEntry(item, 1001);

    expect(entry.body.kind).toBe("user-message");
    expect((entry.body as any).text).toBe("请看截图");
    expect((entry.body as any).imagePaths).toEqual(["C:/Users/huang/AppData/Local/Temp/shot.png"]);
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

  it("should preserve running reasoning state from refreshed overlay items", () => {
    const item: TimelineItem = {
      id: "5b",
      role: "reasoning",
      text: "",
      done: false
    };
    const entry = timelineItemToEntry(item, 5001);
    expect(entry.body.kind).toBe("reasoning");
    expect((entry.body as any).done).toBe(false);
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

  it("should convert context compaction items into system messages", () => {
    const item: TimelineItem = {
      id: "compact-1",
      role: "system" as TimelineRole,
      text: "压缩上下文已完成"
    };
    const entry = timelineItemToEntry(item, 9100);
    expect(entry.body.kind).toBe("system");
    expect((entry.body as any).text).toBe("压缩上下文已完成");
  });

  it("should convert error items into error cards", () => {
    const item: TimelineItem = {
      id: "error-1",
      role: "error" as TimelineRole,
      text: "API 调用失败：502 Bad Gateway"
    };
    const entry = timelineItemToEntry(item, 9200);
    expect(entry.body.kind).toBe("error");
    expect((entry.body as any).text).toBe("API 调用失败：502 Bad Gateway");
  });

  it("should convert tool call", () => {
    const item: TimelineItem = {
      id: "6",
      role: "tool",
      text: "search result",
      server: "filesystem",
      tool: "read_file",
      arguments: "{\n  \"path\": \"README.md\"\n}",
      status: "success"
    };
    const entry = timelineItemToEntry(item, 6000);
    expect(entry.body.kind).toBe("tool");
    expect((entry.body as any).result).toBe("search result");
    expect((entry.body as any).server).toBe("filesystem");
    expect((entry.body as any).tool).toBe("read_file");
    expect((entry.body as any).arguments).toContain("README.md");
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
