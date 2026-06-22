import { describe, expect, it } from "vitest";
import type { MobileThreadDetail } from "../../src/shared/codex";
import { appendPendingUserMessage } from "../../src/lib/thread-state";

function thread(): MobileThreadDetail {
  return {
    id: "thread-1",
    title: "测试",
    preview: "",
    cwd: "C:\\repo",
    modelProvider: "openai",
    status: "idle",
    updatedAt: 1,
    lastTurnId: null,
    timeline: []
  };
}

describe("thread-state", () => {
  it("发送前先追加本地 pending 用户消息", () => {
    expect(appendPendingUserMessage(thread(), "你好", 1, "client-1")).toMatchObject({
      timeline: [
        {
          id: "pending-client-1",
          role: "user",
          text: "你好\n[图片]"
        }
      ]
    });
  });
});
