import { beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Timeline } from "../../src/web/components/Timeline";
import { useStore } from "../../src/web/state/store";

describe("transient turn error mobile rendering", () => {
  beforeEach(() => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
    useStore.setState({
      wsState: "idle",
      reconnectAttempt: 0,
      appServer: null,
      threads: {},
      activeThreadId: null,
      skillsCacheVersion: 0
    });
  });

  it("does not render a stale error at the timeline tail after successful recovery", () => {
    useStore.getState().setThreadEntries("thread-1", [
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
    ], null);

    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: {
        kind: "turn_completed",
        threadId: "thread-1",
        turnId: "turn-1",
        status: "completed"
      }
    });

    const entries = useStore.getState().threads["thread-1"]?.entries ?? [];
    render(<div style={{ width: 390 }}><Timeline entries={entries} /></div>);

    expect(screen.getByText("重试后的完整回复")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByText(/Reconnecting\.\.\./)).not.toBeInTheDocument();
  });
});
