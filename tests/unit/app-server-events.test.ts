import { describe, expect, it } from "vitest";
import { normalizeAppServerNotification } from "../../src/server/app-server/events";

describe("normalizeAppServerNotification", () => {
  it("把 agent message delta 映射为浏览器 timeline 事件", () => {
    expect(
      normalizeAppServerNotification({
        method: "item/agentMessage/delta",
        params: {
          threadId: "thread-1",
          turnId: "turn-1",
          itemId: "item-1",
          delta: "正在分析"
        }
      })
    ).toEqual({
      type: "codex-event",
      event: {
        kind: "agent_message_delta",
        threadId: "thread-1",
        turnId: "turn-1",
        itemId: "item-1",
        delta: "正在分析"
      }
    });
  });

  it("把 turn diff 更新映射为浏览器 diff 事件", () => {
    expect(
      normalizeAppServerNotification({
        method: "turn/diff/updated",
        params: {
          threadId: "thread-1",
          turnId: "turn-1",
          diff: "diff --git a/a.ts b/a.ts"
        }
      })
    ).toEqual({
      type: "codex-event",
      event: {
        kind: "turn_diff_updated",
        threadId: "thread-1",
        turnId: "turn-1",
        diff: "diff --git a/a.ts b/a.ts"
      }
    });
  });

  it("把 file change output delta 映射为浏览器 timeline 事件", () => {
    expect(
      normalizeAppServerNotification({
        method: "item/fileChange/outputDelta",
        params: {
          threadId: "thread-1",
          turnId: "turn-1",
          itemId: "file-1",
          delta: "写入 src/app.ts"
        }
      })
    ).toEqual({
      type: "codex-event",
      event: {
        kind: "file_output_delta",
        threadId: "thread-1",
        turnId: "turn-1",
        itemId: "file-1",
        delta: "写入 src/app.ts"
      }
    });
  });

  it("把 token usage 更新映射为浏览器 token 事件", () => {
    expect(
      normalizeAppServerNotification({
        method: "thread/tokenUsage/updated",
        params: {
          threadId: "thread-1",
          turnId: "turn-1",
          tokenUsage: {
            total: {
              totalTokens: 100,
              inputTokens: 30,
              cachedInputTokens: 10,
              outputTokens: 50,
              reasoningOutputTokens: 20
            },
            last: {
              totalTokens: 40,
              inputTokens: 15,
              cachedInputTokens: 5,
              outputTokens: 20,
              reasoningOutputTokens: 5
            },
            modelContextWindow: 200000
          }
        }
      })
    ).toEqual({
      type: "codex-event",
      event: {
        kind: "token_usage_updated",
        threadId: "thread-1",
        turnId: "turn-1",
        totalTokens: 100,
        inputTokens: 30,
        outputTokens: 50,
        reasoningOutputTokens: 20,
        modelContextWindow: 200000
      }
    });
  });

  it("把线程 warning 映射为浏览器警告事件", () => {
    expect(
      normalizeAppServerNotification({
        method: "warning",
        params: {
          threadId: "thread-1",
          message: "模型额度即将耗尽"
        }
      })
    ).toEqual({
      type: "codex-event",
      event: {
        kind: "warning",
        threadId: "thread-1",
        message: "模型额度即将耗尽"
      }
    });
  });

  it("把 config warning 映射为全局警告事件", () => {
    expect(
      normalizeAppServerNotification({
        method: "configWarning",
        params: {
          summary: "配置有误",
          details: "请检查 config.toml",
          path: "C:\\Users\\huang\\.codex\\config.toml"
        }
      })
    ).toEqual({
      type: "codex-event",
      event: {
        kind: "warning",
        threadId: null,
        message: "配置有误：请检查 config.toml"
      }
    });
  });

  it("把集成状态变化映射为设置刷新事件", () => {
    for (const method of [
      "account/updated",
      "account/rateLimits/updated",
      "mcpServer/startupStatus/updated",
      "remoteControl/status/changed"
    ]) {
      expect(normalizeAppServerNotification({ method, params: {} })).toEqual({
        type: "codex-event",
        event: { kind: "settings_invalidated" }
      });
    }
  });

  it("把会话目标更新和清除映射为浏览器事件", () => {
    expect(
      normalizeAppServerNotification({
        method: "thread/goal/updated",
        params: {
          threadId: "thread-1",
          turnId: null,
          goal: {
            threadId: "thread-1",
            objective: "完整目标",
            status: "active",
            tokenBudget: 9000,
            tokensUsed: 1,
            timeUsedSeconds: 2,
            createdAt: 3,
            updatedAt: 4
          }
        }
      })
    ).toEqual({
      type: "codex-event",
      event: {
        kind: "thread_goal_updated",
        threadId: "thread-1",
        goal: {
          threadId: "thread-1",
          objective: "完整目标",
          status: "active",
          tokenBudget: 9000,
          tokensUsed: 1,
          timeUsedSeconds: 2,
          createdAt: 3,
          updatedAt: 4
        }
      }
    });

    expect(
      normalizeAppServerNotification({
        method: "thread/goal/cleared",
        params: { threadId: "thread-1" }
      })
    ).toEqual({
      type: "codex-event",
      event: { kind: "thread_goal_cleared", threadId: "thread-1" }
    });
  });

  it("忽略当前未渲染的 notification", () => {
    expect(normalizeAppServerNotification({ method: "unknown", params: {} })).toBeNull();
  });
});
