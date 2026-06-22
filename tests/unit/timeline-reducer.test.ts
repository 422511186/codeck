import { describe, expect, it } from "vitest";
import type { BrowserCodexEvent } from "../../src/server/app-server/events";
import type { MobileThreadDetail } from "../../src/shared/codex";
import { applyCodexTimelineEvent } from "../../src/lib/timeline-reducer";

function thread(timeline: MobileThreadDetail["timeline"] = []): MobileThreadDetail {
  return {
    id: "thread-1",
    title: "测试会话",
    preview: "preview",
    cwd: "C:/repo",
    modelProvider: "openai",
    status: "running",
    updatedAt: 1,
    lastTurnId: "turn-1",
    timeline
  };
}

describe("applyCodexTimelineEvent", () => {
  it("只把当前 thread 的 agent delta 追加到同一个 item", () => {
    const event: BrowserCodexEvent = {
      kind: "agent_message_delta",
      threadId: "thread-1",
      turnId: "turn-1",
      itemId: "agent-1",
      delta: "世界"
    };

    expect(applyCodexTimelineEvent(thread([{ id: "agent-1", role: "agent", text: "你好，" }]), event)).toMatchObject({
      timeline: [{ id: "agent-1", role: "agent", text: "你好，世界" }]
    });
    expect(applyCodexTimelineEvent(thread(), { ...event, threadId: "other-thread" })).toEqual(thread());
  });

  it("把 reasoning、plan、command output 和 file output delta 映射到对应 timeline 角色", () => {
    const current = thread();
    const events: BrowserCodexEvent[] = [
      { kind: "reasoning_delta", threadId: "thread-1", turnId: "turn-1", itemId: "r1", delta: "思考中" },
      { kind: "plan_delta", threadId: "thread-1", turnId: "turn-1", itemId: "p1", delta: "计划 A" },
      { kind: "command_output_delta", threadId: "thread-1", turnId: "turn-1", itemId: "c1", delta: "npm test" },
      { kind: "file_output_delta", threadId: "thread-1", turnId: "turn-1", itemId: "f1", delta: "写入 src/app.ts" }
    ];

    const next = events.reduce(applyCodexTimelineEvent, current);

    expect(next.timeline).toEqual([
      { id: "r1", role: "reasoning", text: "思考中" },
      { id: "p1", role: "plan", text: "计划 A" },
      { id: "c1", role: "tool", text: "npm test" },
      { id: "f1", role: "tool", text: "写入 src/app.ts" }
    ]);
  });

  it("把 turn diff 更新写入稳定的 diff timeline item", () => {
    const first = applyCodexTimelineEvent(thread(), {
      kind: "turn_diff_updated",
      threadId: "thread-1",
      turnId: "turn-1",
      diff: "diff --git a/a.ts b/a.ts"
    });
    const second = applyCodexTimelineEvent(first, {
      kind: "turn_diff_updated",
      threadId: "thread-1",
      turnId: "turn-1",
      diff: "diff --git a/b.ts b/b.ts"
    });

    expect(second.timeline).toEqual([{ id: "diff-turn-1", role: "tool", text: "diff --git a/b.ts b/b.ts" }]);
  });

  it("把 token usage 更新写入稳定的用量 timeline item", () => {
    const next = applyCodexTimelineEvent(thread(), {
      kind: "token_usage_updated",
      threadId: "thread-1",
      turnId: "turn-1",
      totalTokens: 100,
      inputTokens: 30,
      outputTokens: 50,
      reasoningOutputTokens: 20,
      modelContextWindow: 200000
    });

    expect(next.timeline).toEqual([
      {
        id: "usage-turn-1",
        role: "tool",
        text: "Token 用量：总计 100，输入 30，输出 50，推理 20，上下文 200000"
      }
    ]);
    expect(next.tokenUsageTotal).toBe(100);
  });

  it("把线程 warning 写入稳定的警告 timeline item", () => {
    const next = applyCodexTimelineEvent(thread(), {
      kind: "warning",
      threadId: "thread-1",
      message: "配置有误"
    });

    expect(next.timeline).toEqual([{ id: "warning-thread-1", role: "tool", text: "警告：配置有误" }]);
  });

  it("同一 item 的重复 delta 不会重复追加", () => {
    const event: BrowserCodexEvent = {
      kind: "agent_message_delta",
      threadId: "thread-1",
      turnId: "turn-1",
      itemId: "agent-1",
      delta: "重复片段"
    };

    const first = applyCodexTimelineEvent(thread(), event);
    const second = applyCodexTimelineEvent(first, event);

    expect(second.timeline).toEqual([{ id: "agent-1", role: "agent", text: "重复片段" }]);
  });

  it("忽略全局设置刷新事件", () => {
    const current = thread([{ id: "agent-1", role: "agent", text: "已有内容" }]);

    expect(applyCodexTimelineEvent(current, { kind: "settings_invalidated" })).toBe(current);
  });

  it("忽略会话目标事件", () => {
    const current = thread([{ id: "agent-1", role: "agent", text: "已有内容" }]);

    expect(
      applyCodexTimelineEvent(current, {
        kind: "thread_goal_updated",
        threadId: "thread-1",
        goal: {
          threadId: "thread-1",
          objective: "完整目标",
          status: "active",
          tokenBudget: null,
          tokensUsed: 0,
          timeUsedSeconds: 0,
          createdAt: 1,
          updatedAt: 1
        }
      })
    ).toBe(current);
    expect(applyCodexTimelineEvent(current, { kind: "thread_goal_cleared", threadId: "thread-1" })).toBe(current);
  });
});
