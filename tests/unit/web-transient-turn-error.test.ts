import { beforeEach, describe, expect, it } from "vitest";
import { useStore } from "../../src/web/state/store";

describe("transient turn error recovery", () => {
  beforeEach(() => {
    useStore.setState({
      wsState: "idle",
      reconnectAttempt: 0,
      appServer: null,
      threads: {},
      activeThreadId: null,
      skillsCacheVersion: 0
    });
    window.localStorage.clear();
  });

  it("does not materialize a retryable turn error", () => {
    useStore.getState().setThreadEntries("thread-1", [
      {
        id: "server-user-1",
        turnId: "turn-1",
        createdAt: 1000,
        body: { kind: "user-message", text: "等待重试", status: "sent" }
      }
    ], null);

    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: {
        kind: "turn_error",
        threadId: "thread-1",
        turnId: "turn-1",
        message: "Reconnecting... 1/5: 503 Service Unavailable",
        willRetry: true
      }
    });

    expect(useStore.getState().threads["thread-1"]?.entries).toEqual([
      expect.objectContaining({
        id: "server-user-1",
        body: expect.objectContaining({ kind: "user-message", status: "sent" })
      })
    ]);
  });

  it("removes a stale retry error when the turn completes successfully", () => {
    useStore.getState().setThreadEntries(
      "thread-1",
      [
        {
          id: "server-user-1",
          turnId: "turn-1",
          createdAt: 1000,
          body: { kind: "user-message", text: "等待重试成功", status: "sent" }
        },
        {
          id: "turn-1-error",
          turnId: "turn-1",
          createdAt: 1001,
          body: { kind: "error", text: "Reconnecting... 3/5: 503 Service Unavailable" }
        },
        {
          id: "agent-1",
          turnId: "turn-1",
          createdAt: 1002,
          body: { kind: "agent-message", text: "重试后的完整回复" }
        }
      ],
      null
    );

    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: {
        kind: "turn_completed",
        threadId: "thread-1",
        turnId: "turn-1",
        status: "completed"
      }
    });

    expect(useStore.getState().threads["thread-1"]?.entries.map((entry) => entry.id)).toEqual([
      "server-user-1",
      "agent-1"
    ]);
  });
});
