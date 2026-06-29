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

  it("streams plan deltas into visible timeline entries", () => {
    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: {
        kind: "plan_delta",
        threadId: "thread-1",
        turnId: "turn-1",
        itemId: "plan-1",
        delta: "1. 检查事件\n"
      }
    });
    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: {
        kind: "plan_delta",
        threadId: "thread-1",
        turnId: "turn-1",
        itemId: "plan-1",
        delta: "2. 修复渲染\n"
      }
    });

    expect(useStore.getState().threads["thread-1"]?.entries).toEqual([
      expect.objectContaining({
        id: "plan-1",
        body: { kind: "system", text: "1. 检查事件\n2. 修复渲染\n" }
      })
    ]);
  });

  it("streams reasoning deltas and replaces them with completed reasoning item", () => {
    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: {
        kind: "reasoning_delta",
        threadId: "thread-1",
        turnId: "turn-1",
        itemId: "reasoning-1",
        delta: "第一段"
      }
    });
    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: {
        kind: "reasoning_delta",
        threadId: "thread-1",
        turnId: "turn-1",
        itemId: "reasoning-1",
        delta: "第二段"
      }
    });

    expect(useStore.getState().threads["thread-1"]?.entries).toEqual([
      expect.objectContaining({
        id: "reasoning-1",
        body: { kind: "reasoning", text: "第一段第二段", done: false }
      })
    ]);

    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: {
        kind: "item_updated",
        threadId: "thread-1",
        turnId: "turn-1",
        completedAtMs: 1234,
        item: { id: "reasoning-1", role: "reasoning", text: "完整推理" }
      }
    });

    expect(useStore.getState().threads["thread-1"]?.entries).toEqual([
      expect.objectContaining({
        id: "reasoning-1",
        createdAt: 1234,
        body: { kind: "reasoning", text: "完整推理", done: true }
      })
    ]);
  });

  it("creates a running reasoning entry before text deltas arrive", () => {
    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: {
        kind: "reasoning_started",
        threadId: "thread-1",
        turnId: "turn-1",
        itemId: "reasoning-1"
      }
    });

    expect(useStore.getState().threads["thread-1"]?.entries).toEqual([
      expect.objectContaining({
        id: "reasoning-1",
        body: { kind: "reasoning", text: "", done: false }
      })
    ]);
  });

  it("creates a pending reasoning placeholder when a turn starts", () => {
    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: { kind: "turn_started", threadId: "thread-1", turnId: "turn-1" }
    });

    expect(useStore.getState().threads["thread-1"]?.entries).toEqual([
      expect.objectContaining({
        id: "turn-1-reasoning-pending",
        body: { kind: "reasoning", text: "", done: false }
      })
    ]);
  });

  it("replaces the pending reasoning placeholder with real reasoning deltas", () => {
    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: { kind: "turn_started", threadId: "thread-1", turnId: "turn-1" }
    });
    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: {
        kind: "reasoning_delta",
        threadId: "thread-1",
        turnId: "turn-1",
        itemId: "reasoning-1",
        delta: "公开推理摘要"
      }
    });

    expect(useStore.getState().threads["thread-1"]?.entries).toEqual([
      expect.objectContaining({
        id: "reasoning-1",
        body: { kind: "reasoning", text: "公开推理摘要", done: false }
      })
    ]);
  });

  it("removes an empty pending reasoning placeholder when a turn completes", () => {
    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: { kind: "turn_started", threadId: "thread-1", turnId: "turn-1" }
    });
    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: { kind: "turn_completed", threadId: "thread-1", turnId: "turn-1", status: "completed" }
    });

    expect(useStore.getState().threads["thread-1"]?.entries).toEqual([]);
  });

  it("streams command output deltas into the same running tool entry", () => {
    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: {
        kind: "command_output_delta",
        threadId: "thread-1",
        turnId: "turn-1",
        itemId: "cmd-1",
        delta: "one\n"
      }
    });
    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: {
        kind: "command_output_delta",
        threadId: "thread-1",
        turnId: "turn-1",
        itemId: "cmd-1",
        delta: "two\n"
      }
    });

    expect(useStore.getState().threads["thread-1"]?.entries).toEqual([
      expect.objectContaining({
        id: "cmd-1",
        body: expect.objectContaining({
          kind: "tool",
          result: "one\ntwo\n",
          status: "running"
        })
      })
    ]);
  });

  it("preserves non-file tool progress kind instead of rendering it as file output", () => {
    const cases = [
      { id: "mcp-1", server: "mcp", tool: "progress", toolKind: "mcp" as const },
      { id: "dynamic-1", server: "dynamic", tool: "browser.search", toolKind: "dynamic" as const },
      { id: "sub-agent-1", server: "sub-agent", tool: "activity", toolKind: "dynamic" as const },
      { id: "collab-1", server: "collab", tool: "agent", toolKind: "dynamic" as const }
    ];

    for (const item of cases) {
      useStore.getState().dispatchEvent({
        type: "codex-event",
        event: {
          kind: "tool_output_delta",
          threadId: "thread-1",
          turnId: "turn-1",
          itemId: item.id,
          delta: `${item.server} 正在执行\n`,
          server: item.server,
          tool: item.tool,
          toolKind: item.toolKind
        }
      });
    }

    expect(useStore.getState().threads["thread-1"]?.entries).toEqual(
      cases.map((item) =>
        expect.objectContaining({
          id: item.id,
          body: expect.objectContaining({
            kind: "tool",
            server: item.server,
            tool: item.tool,
            result: `${item.server} 正在执行\n`,
            status: "running"
          })
        })
      )
    );

    for (const entry of useStore.getState().threads["thread-1"]?.entries ?? []) {
      expect(entry.body).toEqual(expect.objectContaining({ kind: "tool" }));
      if (entry.body.kind === "tool") {
        expect(entry.body.server).not.toBe("file");
        expect(entry.body.tool).not.toBe("file");
      }
    }
  });

  it("keeps real file-change output on the file tool card", () => {
    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: {
        kind: "file_output_delta",
        threadId: "thread-1",
        turnId: "turn-1",
        itemId: "file-1",
        delta: "写入 src/app.ts\n"
      }
    });

    expect(useStore.getState().threads["thread-1"]?.entries).toEqual([
      expect.objectContaining({
        id: "file-1",
        body: expect.objectContaining({
          kind: "tool",
          server: "file",
          tool: "file",
          result: "写入 src/app.ts\n",
          status: "running"
        })
      })
    ]);
  });

  it("merges running snapshots without deleting live deltas", () => {
    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: {
        kind: "agent_message_delta",
        threadId: "thread-1",
        turnId: "turn-1",
        itemId: "agent-live",
        delta: "直播输出"
      }
    });

    useStore.getState().mergeThreadEntries(
      "thread-1",
      [
        {
          id: "user-1",
          createdAt: 10,
          body: { kind: "user-message", text: "问题", status: "sent" }
        }
      ],
      null
    );

    expect(useStore.getState().threads["thread-1"]?.entries.map((entry) => entry.id)).toEqual([
      "agent-live",
      "user-1"
    ]);

    useStore.getState().mergeThreadEntries(
      "thread-1",
      [
        {
          id: "agent-live",
          createdAt: 20,
          body: { kind: "agent-message", text: "直播输出完成" }
        }
      ],
      null
    );

    expect(useStore.getState().threads["thread-1"]?.entries[0]).toEqual(
      expect.objectContaining({
        id: "agent-live",
        body: { kind: "agent-message", text: "直播输出完成" }
      })
    );
  });

  it("drops local optimistic user messages once a later snapshot confirms them", () => {
    useStore.getState().appendEntries("thread-1", [
      {
        id: "local-user-1",
        createdAt: 100,
        body: { kind: "user-message", text: "帮我看一下母乳结构", status: "sending" }
      },
      {
        id: "agent-live",
        createdAt: 101,
        body: { kind: "agent-message", text: "正在看" }
      }
    ]);

    useStore.getState().mergeThreadEntries(
      "thread-1",
      [
        {
          id: "server-user-1",
          createdAt: 102,
          body: { kind: "user-message", text: "帮我看一下母乳结构", status: "sent" }
        }
      ],
      null
    );

    expect(useStore.getState().threads["thread-1"]?.entries).toEqual([
      expect.objectContaining({ id: "agent-live" }),
      expect.objectContaining({ id: "server-user-1" })
    ]);
  });

  it("dedupes duplicate local user messages before the server confirms them", () => {
    useStore.getState().appendEntries("thread-1", [
      {
        id: "local-user-1",
        createdAt: 100,
        body: { kind: "user-message", text: "只发送一次", status: "sending" }
      }
    ]);
    useStore.getState().appendEntries("thread-1", [
      {
        id: "local-user-2",
        createdAt: 101,
        body: { kind: "user-message", text: "只发送一次", status: "sending" }
      }
    ]);

    expect(useStore.getState().threads["thread-1"]?.entries).toEqual([
      expect.objectContaining({ id: "local-user-1" })
    ]);
  });

  it("drops the local user message when a websocket item confirms the same prompt", () => {
    useStore.getState().appendEntries("thread-1", [
      {
        id: "local-user-1",
        createdAt: 100,
        body: { kind: "user-message", text: "确认我", status: "sent" }
      },
      {
        id: "agent-live",
        createdAt: 101,
        body: { kind: "agent-message", text: "处理中" }
      }
    ]);

    useStore.getState().replaceOrAddEntry("thread-1", {
      id: "server-user-1",
      createdAt: 102,
      body: { kind: "user-message", text: "确认我", status: "sent" }
    });

    expect(useStore.getState().threads["thread-1"]?.entries).toEqual([
      expect.objectContaining({ id: "agent-live" }),
      expect.objectContaining({ id: "server-user-1" })
    ]);
  });

  it("collapses adjacent duplicate confirmed user messages from snapshots", () => {
    useStore.getState().setThreadEntries(
      "thread-1",
      [
        {
          id: "server-user-1",
          createdAt: 100,
          body: { kind: "user-message", text: "相同内容", status: "sent" }
        },
        {
          id: "server-user-2",
          createdAt: 101,
          body: { kind: "user-message", text: "相同内容", status: "sent" }
        },
        {
          id: "agent-1",
          createdAt: 102,
          body: { kind: "agent-message", text: "回复" }
        }
      ],
      null
    );

    expect(useStore.getState().threads["thread-1"]?.entries.map((entry) => entry.id)).toEqual([
      "server-user-1",
      "agent-1"
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

  it("normalizes pending server requests restored from the HTTP API", () => {
    useStore.getState().setPendingRequests([
      {
        requestId: "req-question",
        threadId: "thread-1",
        kind: "question",
        title: "需要你回答",
        description: "请选择模式",
        options: [{ value: "fast", label: "快速" }],
        params: {
          questions: [{ id: "mode", question: "请选择模式" }]
        }
      }
    ]);

    expect(useStore.getState().threads["thread-1"]?.pendingApprovals).toEqual([
      expect.objectContaining({
        requestId: "req-question",
        request: {
          questions: [{ id: "mode", question: "请选择模式" }]
        }
      })
    ]);
  });
});
