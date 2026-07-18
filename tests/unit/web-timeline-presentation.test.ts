import { describe, expect, it } from "vitest";
import type { TimelineEntry } from "../../src/web/state/timeline";
import { createActivityPresentation } from "../../src/web/state/timeline-presentation";

describe("timeline presentation", () => {
  it("优先识别结构化 Subagent、完整 Skill 路径并生成有界摘要", () => {
    const entries: TimelineEntry[] = [
      toolEntry(
        "skill",
        "sed -n '1,120p' /repo/.codex/skills/systematic-debugging/SKILL.md",
        "skill body"
      ),
      toolEntry(
        "subagent-start",
        "started",
        JSON.stringify({ agentThreadId: "agent-a", agentPath: "audit", kind: "started" }),
        "sub-agent",
        "dynamic"
      ),
      toolEntry(
        "subagent-complete",
        "completed",
        JSON.stringify({ agentThreadId: "agent-b", agentPath: "audit", kind: "completed" }),
        "sub-agent",
        "dynamic"
      ),
      {
        id: "diff",
        turnId: "turn-1",
        createdAt: 4,
        body: {
          kind: "diff",
          path: "src/app.ts",
          added: 2,
          removed: 1,
          diff: "--- a/src/app.ts\n+++ b/src/app.ts"
        }
      },
      toolEntry("command", "npm test", "failed", "/repo", "command", "failed"),
      toolEntry("mcp", "search", "result", "mcp", "mcp")
    ];

    const presentation = createActivityPresentation(entries);

    expect(presentation.summary).toBe("编辑了文件、运行了命令等操作");
    expect(presentation.summaryKind).toBe("tool");
    expect(presentation.failed).toBe(true);
    expect(presentation.items.map((item) => item.kind)).toEqual([
      "skill",
      "subagent",
      "subagent",
      "file",
      "command",
      "tool"
    ]);
    expect(presentation.items.map((item) => item.label)).toEqual([
      "已加载 systematic-debugging Skill",
      "Subagent audit · started",
      "Subagent audit · completed",
      "已编辑 src/app.ts +2 -1",
      "已运行 npm test",
      "已调用 mcp · search"
    ]);
  });

  it("以 agentThreadId 区分同路径代理，并将唯一路径补录并入原生代理", () => {
    const entries: TimelineEntry[] = [
      toolEntry(
        "native-a",
        "spawn_agent",
        JSON.stringify({ agentThreadId: "thread-a", agentPath: "/root/audit", kind: "started" }),
        "sub-agent",
        "dynamic"
      ),
      toolEntry(
        "path-only-a",
        "followup_task",
        JSON.stringify({ agentThreadId: "", agentPath: "/root/audit", kind: "updated" }),
        "sub-agent",
        "dynamic"
      ),
      toolEntry(
        "native-b",
        "spawn_agent",
        JSON.stringify({ agentThreadId: "thread-b", agentPath: "/root/review", kind: "started" }),
        "sub-agent",
        "dynamic"
      ),
      toolEntry(
        "native-c",
        "spawn_agent",
        JSON.stringify({ agentThreadId: "thread-c", agentPath: "/root/review", kind: "started" }),
        "sub-agent",
        "dynamic"
      ),
      toolEntry(
        "ambiguous-path",
        "followup_task",
        JSON.stringify({ agentThreadId: "", agentPath: "/root/review", kind: "updated" }),
        "sub-agent",
        "dynamic"
      )
    ];

    const presentation = createActivityPresentation(entries);

    expect(presentation.items.map((item) => item.key)).toEqual([
      "path-only-a",
      "native-b",
      "native-c",
      "ambiguous-path"
    ]);
    expect(presentation.items.map((item) => item.label)).toEqual([
      "Subagent audit · updated",
      "Subagent review · started",
      "Subagent review · started",
      "Subagent review · updated"
    ]);
  });

  it("无法解析的 Subagent 和不完整 Skill 路径保守降级", () => {
    const entries: TimelineEntry[] = [
      toolEntry("bad-subagent", "started", "not-json", "sub-agent", "dynamic"),
      toolEntry("near-skill", "sed -n '1,20p' notes/SKILL.md", "notes")
    ];

    const presentation = createActivityPresentation(entries);

    expect(presentation.items.map((item) => item.kind)).toEqual(["tool", "read"]);
    expect(presentation.summary).toBe("读取了文件并调用了工具");
  });

  it("覆盖 list/search/web/image 与通用 dynamic 工具的动作语义", () => {
    const entries: TimelineEntry[] = [
      {
        ...toolEntry("list", "ls src", "a.ts"),
        body: {
          ...toolEntry("list", "ls src", "a.ts").body,
          actionKind: "list" as const
        }
      },
      {
        ...toolEntry("search", "rg timeline src", "src/app.ts"),
        body: {
          ...toolEntry("search", "rg timeline src", "src/app.ts").body,
          actionKind: "search" as const
        }
      },
      toolEntry("web", "Codex activity UI", "results", "web", "web" as never),
      toolEntry("image", "view", "/tmp/screenshot.png", "image", "image" as never),
      toolEntry("dynamic", "inspect", "result", "plugin", "dynamic")
    ];

    const presentation = createActivityPresentation(entries);

    expect(presentation.items.map((item) => item.kind)).toEqual([
      "list",
      "search",
      "web",
      "image",
      "tool"
    ]);
    expect(presentation.items.map((item) => item.label)).toEqual([
      "已浏览 src",
      "已搜索 timeline",
      "已搜索网页 Codex activity UI",
      "已查看图片",
      "已调用 plugin · inspect"
    ]);
  });
});

function toolEntry(
  id: string,
  tool: string,
  result: string,
  server = "/repo",
  toolKind: "command" | "mcp" | "dynamic" | "web" | "image" = "command",
  status: "running" | "success" | "failed" = "success"
): TimelineEntry & { body: Extract<TimelineEntry["body"], { kind: "tool" }> } {
  return {
    id,
    turnId: "turn-1",
    createdAt: 1,
    body: {
      kind: "tool",
      toolKind,
      server,
      tool,
      status,
      result
    }
  };
}
