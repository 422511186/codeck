import { describe, expect, it } from "vitest";
import { createAppServerGateway } from "../../src/server/app-server/runtime";

describe("createAppServerGateway", () => {
  it("mock 模式可以初始化并返回移动端基础数据", async () => {
    const gateway = createAppServerGateway({ mode: "mock" });

    await gateway.ensureReady();

    expect(gateway.getStatus().state).toBe("ready");
    await expect(gateway.listThreads({ limit: 10 })).resolves.toMatchObject({
      threads: [
        {
          id: "mock-thread-1",
          title: "示例会话",
          status: "idle"
        }
      ],
      nextCursor: null
    });
    await expect(gateway.listModels()).resolves.toMatchObject([
      {
        id: "gpt-5-codex",
        label: "GPT-5 Codex",
        isDefault: true
      }
    ]);
  });

  it("off 模式会保留 disabled 状态并拒绝请求", async () => {
    const gateway = createAppServerGateway({ mode: "off" });

    expect(gateway.getStatus()).toEqual({ state: "disabled" });
    await expect(gateway.listThreads()).rejects.toThrow("app-server 已关闭");
  });

  it("mock 模式发送消息时会广播规范化 realtime 事件", async () => {
    const gateway = createAppServerGateway({ mode: "mock" });
    const events: unknown[] = [];

    gateway.onBrowserEvent((event) => events.push(event));
    await gateway.ensureReady();
    await gateway.startTurn({ threadId: "mock-thread-1", text: "实时流测试" });
    await new Promise((resolve) => setTimeout(resolve, 40));

    expect(events).toContainEqual({
      type: "codex-event",
      event: {
        kind: "agent_message_delta",
        threadId: "mock-thread-1",
        turnId: "mock-turn-2",
        itemId: "mock-live-4",
        delta: "实时事件：实时流测试"
      }
    });
    expect(events).toContainEqual({
      type: "codex-event",
      event: {
        kind: "reasoning_delta",
        threadId: "mock-thread-1",
        turnId: "mock-turn-2",
        itemId: "mock-reasoning-4",
        delta: "思考：实时流测试"
      }
    });
    expect(events).toContainEqual({
      type: "codex-event",
      event: {
        kind: "plan_delta",
        threadId: "mock-thread-1",
        turnId: "mock-turn-2",
        itemId: "mock-plan-4",
        delta: "计划：整理请求并生成回复"
      }
    });
    expect(events).toContainEqual({
      type: "codex-event",
      event: {
        kind: "command_output_delta",
        threadId: "mock-thread-1",
        turnId: "mock-turn-2",
        itemId: "mock-command-4",
        delta: "命令输出：mock 完成"
      }
    });
    expect(events).toContainEqual({
      type: "codex-event",
      event: {
        kind: "turn_diff_updated",
        threadId: "mock-thread-1",
        turnId: "mock-turn-2",
        diff: "diff --git a/mock.txt b/mock.txt"
      }
    });
    expect(events).toContainEqual({
      type: "codex-event",
      event: {
        kind: "file_output_delta",
        threadId: "mock-thread-1",
        turnId: "mock-turn-2",
        itemId: "mock-file-4",
        delta: "文件输出：mock.txt 已更新"
      }
    });
    expect(events).toContainEqual({
      type: "codex-event",
      event: {
        kind: "token_usage_updated",
        threadId: "mock-thread-1",
        turnId: "mock-turn-2",
        totalTokens: 128,
        inputTokens: 48,
        outputTokens: 64,
        reasoningOutputTokens: 16,
        modelContextWindow: 200000
      }
    });
  });

  it("mock 模式收到 server request 时会进入 pending 队列并广播给浏览器", async () => {
    const gateway = createAppServerGateway({ mode: "mock" });
    const events: unknown[] = [];

    gateway.onBrowserEvent((event) => events.push(event));
    await gateway.ensureReady();
    await gateway.startTurn({ threadId: "mock-thread-1", text: "审批测试" });
    await new Promise((resolve) => setTimeout(resolve, 40));

    expect(gateway.listPendingServerRequests()).toHaveLength(1);
    expect(events).toContainEqual({
      type: "server-request",
      request: expect.objectContaining({
        requestId: 1,
        kind: "command_approval",
        title: "命令审批",
        description: "npm test"
      })
    });

    await gateway.resolveServerRequest(1, { decision: "accept" });

    expect(gateway.listPendingServerRequests()).toEqual([]);
    expect(events).toContainEqual({ type: "server-request-resolved", requestId: 1 });
  });
});
