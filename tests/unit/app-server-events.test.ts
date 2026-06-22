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

  it("忽略当前未渲染的 notification", () => {
    expect(normalizeAppServerNotification({ method: "unknown", params: {} })).toBeNull();
  });
});
