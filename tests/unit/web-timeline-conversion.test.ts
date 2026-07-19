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

  it("restores standalone historical Skill links and removes only those lines from the body", () => {
    const entry = timelineItemToEntry(
      {
        id: "historical-skill-link",
        role: "user",
        text: [
          "请先审查方案",
          "",
          "[$grill-with-docs](/Users/huangzy/.cc-switch/skills/grill-with-docs/SKILL.md)",
          "",
          "然后继续"
        ].join("\n")
      },
      1003
    );

    expect(entry.body).toEqual({
      kind: "user-message",
      text: "请先审查方案\n\n然后继续",
      skillReferences: [
        {
          name: "grill-with-docs",
          path: "/Users/huangzy/.cc-switch/skills/grill-with-docs/SKILL.md"
        }
      ],
      status: "sent"
    });
  });

  it("restores multiple POSIX and Windows Skill lines with stable deduplication", () => {
    const entry = timelineItemToEntry(
      {
        id: "historical-multiple-skills",
        role: "user",
        text: [
          "[$grilling](/Users/huangzy/.cc-switch/skills/grilling/SKILL.md)",
          "[$grilling](/Users/huangzy/.cc-switch/skills/grilling/SKILL.md)",
          "[$domain-modeling](C:\\Users\\huangzy\\skills\\domain-modeling\\SKILL.md)"
        ].join("\n")
      },
      1004
    );

    expect((entry.body as any).text).toBe("");
    expect((entry.body as any).skillReferences).toEqual([
      { name: "grilling", path: "/Users/huangzy/.cc-switch/skills/grilling/SKILL.md" },
      { name: "domain-modeling", path: "C:\\Users\\huangzy\\skills\\domain-modeling\\SKILL.md" }
    ]);
  });

  it("keeps inline, quoted, fenced, and incomplete Skill-like Markdown as authored text", () => {
    const text = [
      "正文中的 [$grilling](/Users/me/grilling/SKILL.md) 不应恢复。",
      "> [$quoted](/Users/me/quoted/SKILL.md)",
      "```md",
      "[$coded](/Users/me/coded/SKILL.md)",
      "```",
      "[$incomplete](/Users/me/incomplete/readme.md)"
    ].join("\n");
    const entry = timelineItemToEntry({ id: "skill-like-text", role: "user", text }, 1005);

    expect((entry.body as any).text).toBe(text);
    expect((entry.body as any).skillReferences).toBeUndefined();
  });

  it("keeps structured Skill references authoritative without parsing body fallbacks", () => {
    const rawFallback = "[$other](/Users/me/other/SKILL.md)";
    const entry = timelineItemToEntry(
      {
        id: "structured-skill-authority",
        role: "user",
        text: rawFallback,
        skillReferences: [{ name: "grilling", path: "/Users/me/grilling/SKILL.md" }]
      },
      1006
    );

    expect((entry.body as any).text).toBe(rawFallback);
    expect((entry.body as any).skillReferences).toEqual([
      { name: "grilling", path: "/Users/me/grilling/SKILL.md" }
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

    const options = {
      turnManifest: {
        historyStamp: { bootId: "boot-1", generation: 0 },
        turnIds: ["turn-1", "turn-2", "turn-3"]
      }
    };
    expect(rollbackTurnsForEntry([...entries], entries[2], options)).toBe(2);
    expect(rollbackTurnsForEntry([...entries], entries[4], options)).toBe(1);
  });

  it("should compute rollback turn count from ordered distinct normalized turns", () => {
    const entries = [
      { id: "u1", turnId: "turn-1", createdAt: 1, body: { kind: "user-message", text: "one" } },
      { id: "a1-live", turnId: "turn-1", createdAt: 2, body: { kind: "agent-message", text: "same" } },
      { id: "a1-snapshot", turnId: "turn-1", createdAt: 3, body: { kind: "agent-message", text: "same" } },
      { id: "u2", turnId: "turn-2", createdAt: 4, body: { kind: "user-message", text: "two" } },
      { id: "a2", turnId: "turn-2", createdAt: 5, body: { kind: "agent-message", text: "two reply" } }
    ] as const;

    const options = {
      turnManifest: {
        historyStamp: { bootId: "boot-1", generation: 0 },
        turnIds: ["turn-1", "turn-2"]
      }
    };
    expect(rollbackTurnsForEntry([...entries], entries[0], options)).toBe(2);
    expect(rollbackTurnsForEntry([...entries], entries[3], options)).toBe(1);
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

  it("只展示 Codex 注入包装中的真实用户请求并保留消息附件元数据", () => {
    const item: TimelineItem = {
      id: "wrapped-user",
      turnId: "turn-wrapped",
      clientUserMessageId: "client-wrapped",
      role: "user",
      text: `
# Files mentioned by the user:

## screenshot.png: /tmp/screenshot.png

<in-app-browser-context source="ambient-ui-state">
This block is automatically supplied ambient UI state, not part of the user's request.
# In app browser:
- Current URL: http://127.0.0.1:3000/threads/current
</in-app-browser-context>

## My request for Codex:
只显示这句话
`,
      imagePaths: ["/tmp/screenshot.png"],
      skillReferences: [
        {
          name: "openspec-apply-change",
          path: "/repo/.codex/skills/openspec-apply-change/SKILL.md"
        }
      ]
    };

    const entry = timelineItemToEntry(item, 1003);

    expect(entry.clientUserMessageId).toBe("client-wrapped");
    expect(entry.body).toEqual({
      kind: "user-message",
      text: "只显示这句话",
      imagePaths: ["/tmp/screenshot.png"],
      skillReferences: [
        {
          name: "openspec-apply-change",
          path: "/repo/.codex/skills/openspec-apply-change/SKILL.md"
        }
      ],
      status: "sent"
    });
  });

  it("保留用户主动输入的相似 XML、Markdown 和不完整包装", () => {
    const authored = [
      "<in-app-browser-context>",
      "这是用户自己输入但没有可信 source 的标签",
      "</in-app-browser-context>",
      "",
      "## My request for Codex:",
      "这也是用户正文"
    ].join("\n");
    const incomplete = [
      '<in-app-browser-context source="ambient-ui-state">',
      "缺少关闭标签和 request marker"
    ].join("\n");

    const authoredEntry = timelineItemToEntry(
      { id: "authored-markup", role: "user", text: authored },
      1004
    );
    const incompleteEntry = timelineItemToEntry(
      { id: "incomplete-wrapper", role: "user", text: incomplete },
      1005
    );

    expect(authoredEntry.body.kind).toBe("user-message");
    expect((authoredEntry.body as any).text).toBe(authored);
    expect(incompleteEntry.body.kind).toBe("user-message");
    expect((incompleteEntry.body as any).text).toBe(incomplete);
  });

  it("只展示可信 goal continuation 中唯一 objective 的正文", () => {
    const text = [
      '<codex_internal_context source="goal">',
      "Continue working toward the active thread goal.",
      "",
      "<objective>",
      "补充进入当前 OpenSpec，并完成开发改造与真实会话验收",
      "</objective>",
      "",
      "Budget:",
      "- Tokens used: 0",
      "",
      "Completion audit:",
      "Do not rely on intent or partial progress.",
      "</codex_internal_context>"
    ].join("\n");

    const entry = timelineItemToEntry(
      {
        id: "goal-continuation",
        turnId: "turn-goal",
        clientUserMessageId: "client-goal",
        role: "user",
        text
      },
      1006
    );

    expect(entry.clientUserMessageId).toBe("client-goal");
    expect(entry.body).toEqual({
      kind: "user-message",
      text: "补充进入当前 OpenSpec，并完成开发改造与真实会话验收",
      status: "sent"
    });
  });

  it("保留普通、不完整或包含多个 objective 的相似 goal XML", () => {
    const authored = "<objective>这是用户主动输入的 XML</objective>";
    const incomplete = [
      '<codex_internal_context source="goal">',
      "<objective>缺少完整外层结束标签</objective>"
    ].join("\n");
    const ambiguous = [
      '<codex_internal_context source="goal">',
      "<objective>第一个目标</objective>",
      "<objective>第二个目标</objective>",
      "</codex_internal_context>"
    ].join("\n");

    for (const [id, text] of [
      ["authored-objective", authored],
      ["incomplete-goal", incomplete],
      ["ambiguous-goal", ambiguous]
    ] as const) {
      const entry = timelineItemToEntry({ id, role: "user", text }, 1007);
      expect(entry.body.kind).toBe("user-message");
      expect((entry.body as any).text).toBe(text);
    }
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
