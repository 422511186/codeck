import { describe, it, expect } from "vitest";
import { entriesBeforeEntry, rollbackTurnsForEntry, timelineItemToEntry } from "../../src/web/state/timeline";
import type { TimelineItem, TimelineRole } from "../../src/web/api/types";

describe("timeline conversion", () => {
  it("should convert user message", () => {
    const item: TimelineItem = {
      id: "1",
      turnId: "turn-1",
      turnIndex: 3,
      role: "user",
      text: "hello",
      imagePaths: ["C:/shot.png"]
    };
    const entry = timelineItemToEntry(item, 1000);
    expect(entry.id).toBe("1");
    expect(entry.turnId).toBe("turn-1");
    expect(entry.turnIndex).toBe(3);
    expect(entry.createdAt).toBe(1000);
    expect(entry.body.kind).toBe("user-message");
    expect((entry.body as any).text).toBe("hello");
    expect((entry.body as any).imagePaths).toEqual(["C:/shot.png"]);
  });

  it("uses UUIDv7 turn time instead of the pagination request time", () => {
    const turnId = "019f5e2a-80c2-72a2-9b84-e9b54ec7a26e";
    const turnCreatedAt = Number.parseInt("019f5e2a80c2", 16);
    const requestCreatedAt = Date.parse("2026-07-14T02:00:00.000Z");

    const user = timelineItemToEntry(
      { id: "history-user", turnId, role: "user", text: "历史问题" },
      requestCreatedAt
    );
    const agent = timelineItemToEntry(
      { id: "history-agent", turnId, role: "agent", text: "历史回答" },
      requestCreatedAt + 1
    );

    expect(user.createdAt).toBe(turnCreatedAt);
    expect(agent.createdAt).toBe(turnCreatedAt);
    expect(user.createdAt).not.toBe(requestCreatedAt);
  });

  it("normalizes Unix-second fallbacks without changing synthetic ordering values", () => {
    const unixSeconds = 1_783_991_271;

    expect(
      timelineItemToEntry({ id: "history-seconds", role: "agent", text: "历史回答" }, unixSeconds).createdAt
    ).toBe(unixSeconds * 1000);
    expect(
      timelineItemToEntry({ id: "synthetic-order", turnId: "turn-old", role: "agent", text: "排序值" }, 1000)
        .createdAt
    ).toBe(1000);
  });

  it("should preserve user message skill references", () => {
    const item: TimelineItem = {
      id: "1-skill",
      role: "user",
      text: "分析这个问题",
      skillReferences: [
        {
          name: "openspec-explore",
          path: "/repo/.codex/skills/openspec-explore/SKILL.md"
        }
      ]
    };

    const entry = timelineItemToEntry(item, 1002);

    expect(entry.body.kind).toBe("user-message");
    expect((entry.body as any).text).toBe("分析这个问题");
    expect((entry.body as any).skillReferences).toEqual([
      {
        name: "openspec-explore",
        path: "/repo/.codex/skills/openspec-explore/SKILL.md"
      }
    ]);
  });

  it("should compute rollback turn count from target entry turn metadata", () => {
    const entries = [
      { id: "u1", turnId: "turn-1", turnIndex: 0, createdAt: 1, body: { kind: "user-message", text: "one" } },
      { id: "a1", turnId: "turn-1", turnIndex: 0, createdAt: 2, body: { kind: "agent-message", text: "one reply" } },
      { id: "u2", turnId: "turn-2", turnIndex: 1, createdAt: 3, body: { kind: "user-message", text: "two" } },
      { id: "a2", turnId: "turn-2", turnIndex: 1, createdAt: 4, body: { kind: "agent-message", text: "two reply" } },
      { id: "u3", turnId: "turn-3", turnIndex: 2, createdAt: 5, body: { kind: "user-message", text: "three" } }
    ] as const;

    expect(rollbackTurnsForEntry([...entries], entries[2])).toBe(2);
    expect(rollbackTurnsForEntry([...entries], entries[4])).toBe(1);
  });

  it("should compute rollback turn count from ordered distinct normalized turns", () => {
    const entries = [
      { id: "u1", turnId: "turn-1", createdAt: 1, body: { kind: "user-message", text: "one" } },
      { id: "a1-live", turnId: "turn-1", createdAt: 2, body: { kind: "agent-message", text: "same" } },
      { id: "a1-snapshot", turnId: "turn-1", createdAt: 3, body: { kind: "agent-message", text: "same" } },
      { id: "u2", turnId: "turn-2", createdAt: 4, body: { kind: "user-message", text: "two" } },
      { id: "a2", turnId: "turn-2", createdAt: 5, body: { kind: "agent-message", text: "two reply" } }
    ] as const;

    expect(rollbackTurnsForEntry([...entries], entries[0])).toBe(2);
    expect(rollbackTurnsForEntry([...entries], entries[3])).toBe(1);
  });

  it("should keep only entries before the target turn for rewind draft semantics", () => {
    const entries = [
      { id: "u1", turnId: "turn-1", turnIndex: 0, createdAt: 1, body: { kind: "user-message", text: "one" } },
      { id: "a1", turnId: "turn-1", turnIndex: 0, createdAt: 2, body: { kind: "agent-message", text: "one reply" } },
      { id: "u2", turnId: "turn-2", turnIndex: 1, createdAt: 3, body: { kind: "user-message", text: "two" } },
      { id: "a2", turnId: "turn-2", turnIndex: 1, createdAt: 4, body: { kind: "agent-message", text: "two reply" } }
    ] as const;

    expect(entriesBeforeEntry([...entries], entries[2])?.map((entry) => entry.id)).toEqual(["u1", "a1"]);
    expect(entriesBeforeEntry([...entries], entries[0])).toEqual([]);
  });

  it("should not compute rollback count without reliable turn metadata", () => {
    const entries = [
      { id: "u1", createdAt: 1, body: { kind: "user-message", text: "one" } },
      { id: "u2", turnId: "turn-2", createdAt: 2, body: { kind: "user-message", text: "two" } }
    ] as const;

    expect(rollbackTurnsForEntry([...entries], entries[0])).toBeNull();
    expect(rollbackTurnsForEntry([...entries], { ...entries[1], turnId: "missing" })).toBeNull();
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

  it("should preserve tool action kind for activity grouping", () => {
    const item: TimelineItem = {
      id: "6b",
      role: "tool",
      text: "src/app.ts",
      toolKind: "command",
      actionKind: "search",
      server: "/repo",
      tool: "rg timeline src",
      status: "success"
    };
    const entry = timelineItemToEntry(item, 6001);
    expect(entry.body.kind).toBe("tool");
    expect((entry.body as any).actionKind).toBe("search");
  });

  it("should convert diff items and compute line stats", () => {
    const item: TimelineItem = {
      id: "diff-1",
      role: "diff" as TimelineRole,
      text: "--- a/src/app.ts\n+++ b/src/app.ts\n@@ -1,2 +1,3 @@\n-old\n+new\n+added",
      diffPath: "src/app.ts"
    };
    const entry = timelineItemToEntry(item, 7000);
    expect(entry.body.kind).toBe("diff");
    expect((entry.body as any).path).toBe("src/app.ts");
    expect((entry.body as any).added).toBe(2);
    expect((entry.body as any).removed).toBe(1);
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
