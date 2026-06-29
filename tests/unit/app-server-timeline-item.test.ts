import { describe, expect, it } from "vitest";
import { timelineItem } from "../../src/server/app-server/client";
import type { ThreadItem } from "../../docs/generated/app-server-ts/v2/ThreadItem";

describe("timelineItem", () => {
  it("maps collaboration tool calls into visible tool items", () => {
    const item: ThreadItem = {
      type: "collabAgentToolCall",
      id: "collab-1",
      tool: "spawnAgent",
      status: "inProgress",
      senderThreadId: "thread-1",
      receiverThreadIds: ["thread-2"],
      prompt: "分析问题",
      model: "gpt-5-codex",
      reasoningEffort: "medium",
      agentsStates: {}
    };

    expect(timelineItem(item)).toMatchObject({
      id: "collab-1",
      role: "tool",
      toolKind: "dynamic",
      server: "collab",
      tool: "spawnAgent",
      status: "running",
      text: expect.stringContaining("分析问题")
    });
  });

  it("maps hook prompts, sub-agent activity, and sleep into visible items", () => {
    expect(
      timelineItem({
        type: "hookPrompt",
        id: "hook-1",
        fragments: [{ text: "执行 after-edit hook", hookRunId: "hook-run-1" }]
      })
    ).toMatchObject({
      id: "hook-1",
      role: "system",
      text: expect.stringContaining("执行 after-edit hook")
    });

    expect(
      timelineItem({
        type: "subAgentActivity",
        id: "sub-1",
        kind: "started",
        agentThreadId: "thread-2",
        agentPath: "/tmp/agent"
      })
    ).toMatchObject({
      id: "sub-1",
      role: "tool",
      server: "sub-agent",
      tool: "started",
      status: "running"
    });

    expect(timelineItem({ type: "sleep", id: "sleep-1", durationMs: 1200 })).toMatchObject({
      id: "sleep-1",
      role: "system",
      text: "等待 1200ms"
    });
  });

  it("falls back to a visible system item for unknown thread items", () => {
    expect(timelineItem({ type: "futureItem", id: "future-1", value: "visible" } as unknown as ThreadItem)).toMatchObject({
      id: "future-1",
      role: "system",
      text: expect.stringContaining("futureItem")
    });
  });
});
