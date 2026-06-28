import { beforeEach, describe, expect, it } from "vitest";
import { useStore } from "../../src/web/state/store";

describe("web store codex events", () => {
  beforeEach(() => {
    useStore.setState({
      wsState: "idle",
      appServer: null,
      threads: {},
      activeThreadId: null
    });
  });

  it("updates running state from app-server turn lifecycle events", () => {
    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: { kind: "turn_started", threadId: "thread-1", turnId: "turn-1" }
    });

    expect(useStore.getState().threads["thread-1"]?.running).toBe(true);

    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: { kind: "turn_completed", threadId: "thread-1", turnId: "turn-1" }
    });

    expect(useStore.getState().threads["thread-1"]?.running).toBe(false);
  });

  it("streams agent deltas into timeline entries", () => {
    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: {
        kind: "agent_message_delta",
        threadId: "thread-1",
        turnId: "turn-1",
        itemId: "agent-1",
        delta: "第一段"
      }
    });
    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: {
        kind: "agent_message_delta",
        threadId: "thread-1",
        turnId: "turn-1",
        itemId: "agent-1",
        delta: "第二段"
      }
    });

    expect(useStore.getState().threads["thread-1"]?.entries).toEqual([
      expect.objectContaining({
        id: "agent-1",
        body: { kind: "agent-message", text: "第一段第二段" }
      })
    ]);
  });

  it("shows context compaction completion as a system timeline entry", () => {
    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: { kind: "context_compacted", threadId: "thread-1", turnId: "turn-1" }
    });

    expect(useStore.getState().threads["thread-1"]?.entries).toEqual([
      expect.objectContaining({
        id: "turn-1-context-compacted",
        body: { kind: "system", text: "压缩上下文已完成" }
      })
    ]);
  });

  it("syncs thread mode, model, and reasoning effort from settings update events", () => {
    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: {
        kind: "thread_settings_updated",
        threadId: "thread-1",
        model: "gpt-5-codex",
        reasoningEffort: "high",
        collaborationMode: "plan"
      }
    });

    expect(useStore.getState().threads["thread-1"]).toEqual(
      expect.objectContaining({
        mode: "plan",
        model: "gpt-5-codex",
        modelEffort: "high"
      })
    );
  });

  it("renders app-server warnings and turn errors as timeline error cards", () => {
    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: { kind: "warning", threadId: "thread-1", message: "配置警告" }
    });
    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: {
        kind: "turn_error",
        threadId: "thread-1",
        turnId: "turn-1",
        message: "API 调用失败：502 Bad Gateway",
        willRetry: false
      }
    });

    expect(useStore.getState().threads["thread-1"]?.entries).toEqual([
      expect.objectContaining({
        id: expect.stringMatching(/warning/),
        body: { kind: "error", text: "配置警告" }
      }),
      expect.objectContaining({
        id: "turn-1-error",
        body: { kind: "error", text: "API 调用失败：502 Bad Gateway" }
      })
    ]);
  });

  it("upserts completed timeline items from websocket events", () => {
    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: {
        kind: "item_updated",
        threadId: "thread-1",
        turnId: "turn-1",
        completedAtMs: 1234,
        item: { id: "agent-1", role: "agent", text: "完整回复" }
      }
    });

    expect(useStore.getState().threads["thread-1"]?.entries).toEqual([
      expect.objectContaining({
        id: "agent-1",
        createdAt: 1234,
        body: { kind: "agent-message", text: "完整回复" }
      })
    ]);
  });
});
