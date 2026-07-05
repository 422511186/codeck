import { describe, expect, it } from "vitest";
import { AppServerGateway, createAppServerGateway } from "../../src/server/app-server/runtime";
import type { AppServerNotificationMessage } from "../../src/server/app-server/events";
import type { AppServerServerRequestMessage } from "../../src/server/app-server/pending-requests";
import type { AppServerStatus, ManagedAppServerPeer } from "../../src/server/app-server/transport";

class ReconnectablePeer implements ManagedAppServerPeer {
  status: AppServerStatus = { state: "idle" };
  connectCount = 0;
  initializeCount = 0;
  notifications: string[] = [];

  async connect(): Promise<void> {
    this.connectCount += 1;
    this.status = { state: "ready" };
  }

  close(): void {
    this.status = { state: "idle" };
  }

  getStatus(): AppServerStatus {
    return this.status;
  }

  onNotification(_handler: (message: AppServerNotificationMessage) => void): () => void {
    return () => undefined;
  }

  onServerRequest(_handler: (message: AppServerServerRequestMessage) => void): () => void {
    return () => undefined;
  }

  async respondToServerRequest(): Promise<void> {
    return undefined;
  }

  async notify(method: string): Promise<void> {
    this.notifications.push(method);
  }

  async request(method: string): Promise<unknown> {
    if (method === "initialize") {
      this.initializeCount += 1;
      return {
        userAgent: "codex-test",
        codexHome: "C:\\Users\\huang\\.codex",
        platformFamily: "windows",
        platformOs: "windows"
      };
    }
    if (method === "thread/list") {
      return { data: [], nextCursor: null };
    }
    throw new Error(`unexpected method ${method}`);
  }
}

class AlreadyInitializedPeer implements ManagedAppServerPeer {
  status: AppServerStatus = { state: "ready" };
  connectCount = 0;
  initializeCount = 0;
  notifications: string[] = [];

  async connect(): Promise<void> {
    this.connectCount += 1;
    this.status = { state: "ready" };
  }

  close(): void {
    this.status = { state: "idle" };
  }

  getStatus(): AppServerStatus {
    return this.status;
  }

  onNotification(_handler: (message: AppServerNotificationMessage) => void): () => void {
    return () => undefined;
  }

  onServerRequest(_handler: (message: AppServerServerRequestMessage) => void): () => void {
    return () => undefined;
  }

  async respondToServerRequest(): Promise<void> {
    return undefined;
  }

  async notify(method: string): Promise<void> {
    this.notifications.push(method);
  }

  async request(method: string): Promise<unknown> {
    if (method === "initialize") {
      this.initializeCount += 1;
      throw new Error("Already initialized");
    }
    if (method === "thread/list") {
      return { data: [], nextCursor: null };
    }
    throw new Error(`unexpected method ${method}`);
  }
}

class UnsupportedTurnItemsPeer implements ManagedAppServerPeer {
  status: AppServerStatus = { state: "idle" };
  calls: Array<{ method: string; params?: unknown }> = [];

  async connect(): Promise<void> {
    this.status = { state: "ready" };
  }

  close(): void {
    this.status = { state: "idle" };
  }

  getStatus(): AppServerStatus {
    return this.status;
  }

  onNotification(_handler: (message: AppServerNotificationMessage) => void): () => void {
    return () => undefined;
  }

  onServerRequest(_handler: (message: AppServerServerRequestMessage) => void): () => void {
    return () => undefined;
  }

  async respondToServerRequest(): Promise<void> {
    return undefined;
  }

  async notify(): Promise<void> {
    return undefined;
  }

  async request(method: string, params?: unknown): Promise<unknown> {
    this.calls.push({ method, params });
    if (method === "initialize") {
      return {
        userAgent: "codex-test",
        codexHome: "/tmp/.codex",
        platformFamily: "unix",
        platformOs: "linux"
      };
    }
    if (method === "thread/turns/items/list") {
      throw new Error("thread/turns/items/list is not supported yet");
    }
    if (method === "thread/turns/list") {
      return {
        data: [
          {
            id: "turn-other",
            itemsView: { type: "complete" },
            status: { type: "completed" },
            error: null,
            startedAt: 1,
            completedAt: 2,
            durationMs: 1000,
            items: []
          },
          {
            id: "turn-target",
            itemsView: { type: "complete" },
            status: { type: "completed" },
            error: null,
            startedAt: 3,
            completedAt: 4,
            durationMs: 1000,
            items: [
              {
                type: "agentMessage",
                id: "item-target-agent",
                text: "fallback item",
                phase: "final_answer",
                memoryCitation: null
              }
            ]
          }
        ],
        nextCursor: null,
        backwardsCursor: null
      };
    }
    throw new Error(`unexpected method ${method}`);
  }
}

class RejectingServerRequestPeer implements ManagedAppServerPeer {
  status: AppServerStatus = { state: "ready" };
  responses: Array<{ id: number; result: unknown }> = [];
  private serverRequestHandler: ((message: AppServerServerRequestMessage) => void) | null = null;
  private notificationHandler: ((message: AppServerNotificationMessage) => void) | null = null;

  async connect(): Promise<void> {
    this.status = { state: "ready" };
  }

  close(): void {
    this.status = { state: "idle" };
  }

  getStatus(): AppServerStatus {
    return this.status;
  }

  onNotification(handler: (message: AppServerNotificationMessage) => void): () => void {
    this.notificationHandler = handler;
    return () => {
      this.notificationHandler = null;
    };
  }

  onServerRequest(handler: (message: AppServerServerRequestMessage) => void): () => void {
    this.serverRequestHandler = handler;
    return () => {
      this.serverRequestHandler = null;
    };
  }

  emitServerRequest(message: AppServerServerRequestMessage): void {
    this.serverRequestHandler?.(message);
  }

  emitNotification(message: AppServerNotificationMessage): void {
    this.notificationHandler?.(message);
  }

  async respondToServerRequest(id: number, result: unknown): Promise<void> {
    this.responses.push({ id, result });
    throw new Error("app-server 拒绝 response");
  }

  async notify(): Promise<void> {
    return undefined;
  }

  async request(): Promise<unknown> {
    return {};
  }
}

class NotificationOverlayPeer implements ManagedAppServerPeer {
  status: AppServerStatus = { state: "idle" };
  private readonly notificationHandlers = new Set<(message: AppServerNotificationMessage) => void>();

  async connect(): Promise<void> {
    this.status = { state: "ready" };
  }

  close(): void {
    this.status = { state: "idle" };
  }

  getStatus(): AppServerStatus {
    return this.status;
  }

  onNotification(handler: (message: AppServerNotificationMessage) => void): () => void {
    this.notificationHandlers.add(handler);
    return () => this.notificationHandlers.delete(handler);
  }

  onServerRequest(_handler: (message: AppServerServerRequestMessage) => void): () => void {
    return () => undefined;
  }

  emitNotification(message: AppServerNotificationMessage): void {
    for (const handler of this.notificationHandlers) {
      handler(message);
    }
  }

  async respondToServerRequest(): Promise<void> {
    return undefined;
  }

  async notify(): Promise<void> {
    return undefined;
  }

  async request(method: string): Promise<unknown> {
    if (method === "initialize") {
      return {
        userAgent: "codex-test",
        codexHome: "/tmp/.codex",
        platformFamily: "unix",
        platformOs: "linux"
      };
    }

    if (method === "thread/read") {
      return {
        thread: {
          id: "thread-1",
          sessionId: "session-1",
          forkedFromId: null,
          parentThreadId: null,
          preview: "overlay test",
          ephemeral: false,
          modelProvider: "openai",
          createdAt: 1,
          updatedAt: 2,
          status: { type: "idle" },
          path: null,
          cwd: "/tmp/workspace",
          cliVersion: "0.141.0",
          source: "appServer",
          threadSource: null,
          agentNickname: null,
          agentRole: null,
          gitInfo: null,
          name: "Overlay",
          turns: [
            {
              id: "turn-1",
              itemsView: "full",
              status: "completed",
              error: null,
              startedAt: 1,
              completedAt: 2,
              durationMs: 1,
              items: [
                {
                  type: "userMessage",
                  id: "user-1",
                  clientId: "client-user-1",
                  content: [{ type: "text", text: "触发工具", text_elements: [] }]
                }
              ]
            }
          ]
        }
      };
    }

    if (method === "thread/goal/get") {
      return { goal: null };
    }

    if (method === "thread/rollback") {
      return {
        thread: {
          id: "thread-1",
          sessionId: "session-1",
          forkedFromId: null,
          parentThreadId: null,
          preview: "overlay test",
          ephemeral: false,
          modelProvider: "openai",
          createdAt: 1,
          updatedAt: 3,
          status: { type: "idle" },
          path: null,
          cwd: "/tmp/workspace",
          cliVersion: "0.141.0",
          source: "appServer",
          threadSource: null,
          agentNickname: null,
          agentRole: null,
          gitInfo: null,
          name: "Overlay",
          turns: []
        }
      };
    }

    throw new Error(`unexpected method ${method}`);
  }
}

class SnapshotWithFinalAgentOverlayPeer extends NotificationOverlayPeer {
  override async request(method: string): Promise<unknown> {
    if (method !== "thread/read") {
      return super.request(method);
    }

    return {
      thread: {
        id: "thread-1",
        sessionId: "session-1",
        forkedFromId: null,
        parentThreadId: null,
        preview: "overlay final answer test",
        ephemeral: false,
        modelProvider: "openai",
        createdAt: 1,
        updatedAt: 2,
        status: { type: "idle" },
        path: null,
        cwd: "/tmp/workspace",
        cliVersion: "0.141.0",
        source: "appServer",
        threadSource: null,
        agentNickname: null,
        agentRole: null,
        gitInfo: null,
        name: "Overlay",
        turns: [
          {
            id: "turn-1",
            itemsView: "full",
            status: "completed",
            error: null,
            startedAt: 1,
            completedAt: 2,
            durationMs: 1,
            items: [
              {
                type: "userMessage",
                id: "user-1",
                clientId: "client-user-1",
                content: [{ type: "text", text: "触发工具", text_elements: [] }]
              },
              {
                type: "agentMessage",
                id: "agent-final",
                text: "最终答复",
                phase: "final_answer",
                memoryCitation: null
              }
            ]
          }
        ]
      }
    };
  }
}

class PartialRollbackPeer implements ManagedAppServerPeer {
  status: AppServerStatus = { state: "idle" };
  private readonly notificationHandlers = new Set<(message: AppServerNotificationMessage) => void>();

  async connect(): Promise<void> {
    this.status = { state: "ready" };
  }

  close(): void {
    this.status = { state: "idle" };
  }

  getStatus(): AppServerStatus {
    return this.status;
  }

  onNotification(handler: (message: AppServerNotificationMessage) => void): () => void {
    this.notificationHandlers.add(handler);
    return () => this.notificationHandlers.delete(handler);
  }

  onServerRequest(_handler: (message: AppServerServerRequestMessage) => void): () => void {
    return () => undefined;
  }

  emitNotification(message: AppServerNotificationMessage): void {
    for (const handler of this.notificationHandlers) {
      handler(message);
    }
  }

  async respondToServerRequest(): Promise<void> {
    return undefined;
  }

  async notify(): Promise<void> {
    return undefined;
  }

  async request(method: string): Promise<unknown> {
    if (method === "initialize") {
      return {
        userAgent: "codex-test",
        codexHome: "/tmp/.codex",
        platformFamily: "unix",
        platformOs: "linux"
      };
    }

    if (method === "thread/read") {
      return { thread: threadWithTurns(["turn-1", "turn-2"]) };
    }

    if (method === "thread/goal/get") {
      return { goal: null };
    }

    if (method === "thread/rollback") {
      return { thread: threadWithTurns(["turn-1"]) };
    }

    throw new Error(`unexpected method ${method}`);
  }
}

class SnapshotReasoningPeer implements ManagedAppServerPeer {
  status: AppServerStatus = { state: "idle" };
  private readonly notificationHandlers = new Set<(message: AppServerNotificationMessage) => void>();

  async connect(): Promise<void> {
    this.status = { state: "ready" };
  }

  close(): void {
    this.status = { state: "idle" };
  }

  getStatus(): AppServerStatus {
    return this.status;
  }

  onNotification(handler: (message: AppServerNotificationMessage) => void): () => void {
    this.notificationHandlers.add(handler);
    return () => this.notificationHandlers.delete(handler);
  }

  onServerRequest(_handler: (message: AppServerServerRequestMessage) => void): () => void {
    return () => undefined;
  }

  emitNotification(message: AppServerNotificationMessage): void {
    for (const handler of this.notificationHandlers) {
      handler(message);
    }
  }

  async respondToServerRequest(): Promise<void> {
    return undefined;
  }

  async notify(): Promise<void> {
    return undefined;
  }

  async request(method: string): Promise<unknown> {
    if (method === "initialize") {
      return {
        userAgent: "codex-test",
        codexHome: "/tmp/.codex",
        platformFamily: "unix",
        platformOs: "linux"
      };
    }

    if (method === "thread/read") {
      return {
        thread: {
          ...(threadWithTurns(["turn-1"]) as Record<string, unknown>),
          turns: [
            {
              id: "turn-1",
              itemsView: "full",
              status: "completed",
              error: null,
              startedAt: 1,
              completedAt: 2,
              durationMs: 1,
              items: [
                {
                  type: "userMessage",
                  id: "user-turn-1",
                  clientId: "client-turn-1",
                  content: [{ type: "text", text: "看一下当前工作目录的位置", text_elements: [] }]
                },
                {
                  type: "reasoning",
                  id: "reasoning-snapshot",
                  summary: ["Checking working directory in Chinese"],
                  content: []
                }
              ]
            }
          ]
        }
      };
    }

    if (method === "thread/goal/get") {
      return { goal: null };
    }

    throw new Error(`unexpected method ${method}`);
  }
}

class SessionResponseItemsPeer implements ManagedAppServerPeer {
  status: AppServerStatus = { state: "idle" };
  readonly calls: Array<{ method: string; params?: unknown }> = [];

  async connect(): Promise<void> {
    this.status = { state: "ready" };
  }

  close(): void {
    this.status = { state: "idle" };
  }

  getStatus(): AppServerStatus {
    return this.status;
  }

  onNotification(_handler: (message: AppServerNotificationMessage) => void): () => void {
    return () => undefined;
  }

  onServerRequest(_handler: (message: AppServerServerRequestMessage) => void): () => void {
    return () => undefined;
  }

  async respondToServerRequest(): Promise<void> {
    return undefined;
  }

  async notify(): Promise<void> {
    return undefined;
  }

  async request(method: string, params?: unknown): Promise<unknown> {
    this.calls.push({ method, params });
    if (method === "initialize") {
      return {
        userAgent: "codex-test",
        codexHome: "/tmp/.codex",
        platformFamily: "unix",
        platformOs: "linux"
      };
    }
    if (method === "thread/read") {
      return { thread: { ...sessionThread(), turns: [] } };
    }
    if (method === "thread/turns/list") {
      return { data: sessionThread().turns, nextCursor: null, backwardsCursor: null };
    }
    if (method === "thread/turns/items/list") {
      return {
        data: sessionThread().turns[0]!.items,
        nextCursor: null
      };
    }
    if (method === "thread/goal/get") {
      return { goal: null };
    }
    if (method === "getConversationSummary") {
      return {
        summary: {
          conversationId: "thread-1",
          path: "/tmp/codex-session.jsonl",
          preview: "session supplement",
          timestamp: "2026-07-04T19:00:00.000Z",
          updatedAt: "2026-07-04T19:01:00.000Z",
          modelProvider: "openai",
          cwd: "/tmp/workspace",
          cliVersion: "0.141.0",
          source: "appServer",
          gitInfo: null
        }
      };
    }
    if (method === "fs/readFile") {
      return {
        dataBase64: Buffer.from(sessionJsonl(), "utf8").toString("base64")
      };
    }
    throw new Error(`unexpected method ${method}`);
  }
}

class SessionResponseItemsWithNativePatchPeer extends SessionResponseItemsPeer {
  override async request(method: string, params?: unknown): Promise<unknown> {
    this.calls.push({ method, params });
    if (method === "initialize") {
      return {
        userAgent: "codex-test",
        codexHome: "/tmp/.codex",
        platformFamily: "unix",
        platformOs: "linux"
      };
    }
    if (method === "thread/read") {
      return { thread: { ...sessionThreadWithNativePatch(), turns: [] } };
    }
    if (method === "thread/turns/list") {
      return { data: sessionThreadWithNativePatch().turns, nextCursor: null, backwardsCursor: null };
    }
    if (method === "thread/turns/items/list") {
      return {
        data: sessionThreadWithNativePatch().turns[0]!.items,
        nextCursor: null
      };
    }
    if (method === "thread/goal/get") {
      return { goal: null };
    }
    if (method === "getConversationSummary") {
      return {
        summary: {
          conversationId: "thread-1",
          path: "/tmp/codex-session.jsonl",
          preview: "session supplement",
          timestamp: "2026-07-04T19:00:00.000Z",
          updatedAt: "2026-07-04T19:01:00.000Z",
          modelProvider: "openai",
          cwd: "/tmp/workspace",
          cliVersion: "0.141.0",
          source: "appServer",
          gitInfo: null
        }
      };
    }
    if (method === "fs/readFile") {
      return {
        dataBase64: Buffer.from(sessionJsonl(), "utf8").toString("base64")
      };
    }
    throw new Error(`unexpected method ${method}`);
  }
}

function threadWithTurns(turnIds: string[]): unknown {
  return {
    id: "thread-1",
    sessionId: "session-1",
    forkedFromId: null,
    parentThreadId: null,
    preview: "partial rollback",
    ephemeral: false,
    modelProvider: "openai",
    createdAt: 1,
    updatedAt: 3,
    status: { type: "idle" },
    path: null,
    cwd: "/tmp/workspace",
    cliVersion: "0.141.0",
    source: "appServer",
    threadSource: null,
    agentNickname: null,
    agentRole: null,
    gitInfo: null,
    name: "Partial",
    turns: turnIds.map((turnId, index) => ({
      id: turnId,
      itemsView: "full",
      status: "completed",
      error: null,
      startedAt: index + 1,
      completedAt: index + 2,
      durationMs: 1,
      items: [
        {
          type: "userMessage",
          id: `user-${turnId}`,
          clientId: `client-${turnId}`,
          content: [{ type: "text", text: `消息 ${turnId}`, text_elements: [] }]
        }
      ]
    }))
  };
}

type SessionThreadFixture = Record<string, unknown> & {
  turns: Array<Record<string, unknown> & { items: unknown[] }>;
};

function sessionThread(): SessionThreadFixture {
  return {
    id: "thread-1",
    sessionId: "session-1",
    forkedFromId: null,
    parentThreadId: null,
    preview: "session supplement",
    ephemeral: false,
    modelProvider: "openai",
    createdAt: 1,
    updatedAt: 3,
    status: { type: "idle" },
    path: "/tmp/codex-session.jsonl",
    cwd: "/tmp/workspace",
    cliVersion: "0.141.0",
    source: "appServer",
    threadSource: null,
    agentNickname: null,
    agentRole: null,
    gitInfo: null,
    name: "Session",
    turns: [
      {
        id: "turn-1",
        itemsView: "full",
        status: "completed",
        error: null,
        startedAt: 1,
        completedAt: 2,
        durationMs: 1,
        items: [
          {
            type: "userMessage",
            id: "user-1",
            clientId: "client-user-1",
            content: [{ type: "text", text: "排查活动缺失", text_elements: [] }]
          },
          {
            type: "agentMessage",
            id: "agent-1",
            text: "我先看链路。",
            phase: "commentary",
            memoryCitation: null
          },
          {
            type: "agentMessage",
            id: "agent-2",
            text: "证据已经清楚。",
            phase: "commentary",
            memoryCitation: null
          }
        ]
      }
    ]
  };
}

function sessionThreadWithNativePatch(): SessionThreadFixture {
  const thread = sessionThread();
  thread.turns[0]!.items.splice(2, 0, {
    type: "fileChange",
    id: "native-patch",
    status: "success",
    changes: [
      {
        path: "/tmp/workspace/src/web/components/Timeline.tsx",
        diff: "@@ -1 +1\n-old line\n+new line"
      }
    ]
  });
  return thread;
}

function sessionJsonl(): string {
  const turnMeta = { turn_id: "turn-1" };
  const line = (payload: Record<string, unknown>, timestamp: string) =>
    JSON.stringify({ timestamp, type: "response_item", payload: { ...payload, internal_chat_message_metadata_passthrough: turnMeta } });
  return [
    line(
      {
        type: "message",
        id: "msg-1",
        role: "assistant",
        phase: "commentary",
        content: [{ type: "output_text", text: "我先看链路。" }]
      },
      "2026-07-04T19:00:00.000Z"
    ),
    line(
      {
        type: "function_call",
        id: "fc-skill",
        call_id: "call-skill",
        name: "exec_command",
        arguments: JSON.stringify({
          cmd: "sed -n '1,160p' /home/hzy/.codex/plugins/cache/demo/skills/systematic-debugging/SKILL.md",
          workdir: "/tmp/workspace"
        })
      },
      "2026-07-04T19:00:01.000Z"
    ),
    line(
      {
        type: "function_call_output",
        call_id: "call-skill",
        output: "---\nname: systematic-debugging\ndescription: Debug carefully\n---"
      },
      "2026-07-04T19:00:02.000Z"
    ),
    line(
      {
        type: "function_call",
        id: "fc-read",
        call_id: "call-read",
        name: "exec_command",
        arguments: JSON.stringify({
          cmd: "sed -n '650,820p' src/server/app-server/client.ts",
          workdir: "/tmp/workspace"
        })
      },
      "2026-07-04T19:00:03.000Z"
    ),
    line(
      {
        type: "function_call_output",
        call_id: "call-read",
        output: "Chunk ID: read\nProcess exited with code 0\nOutput:\nclient code"
      },
      "2026-07-04T19:00:04.000Z"
    ),
    line(
      {
        type: "function_call",
        id: "fc-search",
        call_id: "call-search",
        name: "exec_command",
        arguments: JSON.stringify({
          cmd: "rg -n \"timeline\" src/server src/web",
          workdir: "/tmp/workspace"
        })
      },
      "2026-07-04T19:00:05.000Z"
    ),
    line(
      {
        type: "function_call_output",
        call_id: "call-search",
        output: "Chunk ID: search\nProcess exited with code 0\nOutput:\nsrc/web/components/Timeline.tsx"
      },
      "2026-07-04T19:00:06.000Z"
    ),
    line(
      {
        type: "tool_search_call",
        id: "tsc-search",
        call_id: "call-tool-search",
        status: "completed",
        execution: "client",
        arguments: {
          query: "image generation built-in image_gen generate image",
          limit: 10
        }
      },
      "2026-07-04T19:00:06.100Z"
    ),
    line(
      {
        type: "tool_search_output",
        call_id: "call-tool-search",
        output: { results: [] }
      },
      "2026-07-04T19:00:06.200Z"
    ),
    line(
      {
        type: "custom_tool_call",
        id: "ctc-patch",
        call_id: "call-patch",
        name: "apply_patch",
        status: "completed",
        input:
          "*** Begin Patch\n*** Update File: src/web/components/Timeline.tsx\n@@\n-old line\n+new line\n*** End Patch\n"
      },
      "2026-07-04T19:00:06.300Z"
    ),
    line(
      {
        type: "custom_tool_call_output",
        call_id: "call-patch",
        output: "Success. Updated the following files:\nM /tmp/workspace/src/web/components/Timeline.tsx"
      },
      "2026-07-04T19:00:06.400Z"
    ),
    line(
      {
        type: "function_call",
        id: "fc-plan",
        call_id: "call-plan",
        name: "update_plan",
        arguments: JSON.stringify({
          plan: [{ step: "复现真实事件", status: "in_progress" }]
        })
      },
      "2026-07-04T19:00:06.500Z"
    ),
    line(
      {
        type: "message",
        id: "msg-2",
        role: "assistant",
        phase: "commentary",
        content: [{ type: "output_text", text: "证据已经清楚。" }]
      },
      "2026-07-04T19:00:07.000Z"
    )
  ].join("\n");
}

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
    await expect(gateway.listModels()).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "gpt-5-codex",
          label: "GPT-5 Codex",
          isDefault: true
        })
      ])
    );
  });

  it("off 模式会保留 disabled 状态并拒绝请求", async () => {
    const gateway = createAppServerGateway({ mode: "off" });

    expect(gateway.getStatus()).toMatchObject({
      state: "disabled",
      mode: "off",
      managedByCurrentProcess: false,
      reusedExisting: false
    });
    await expect(gateway.listThreads()).rejects.toThrow("app-server 已关闭");
  });

  it("app-server 断线后下一次请求会重新初始化连接", async () => {
    const peer = new ReconnectablePeer();
    const gateway = new AppServerGateway(peer);

    await gateway.listThreads();
    peer.close();
    await gateway.listThreads();

    expect(peer.connectCount).toBe(2);
    expect(peer.initializeCount).toBe(2);
    expect(peer.notifications).toEqual(["initialized", "initialized"]);
  });

  it("连接到已初始化的 app-server 时把 Already initialized 视为 ready", async () => {
    const peer = new AlreadyInitializedPeer();
    const gateway = new AppServerGateway(peer);

    await expect(gateway.listThreads()).resolves.toEqual({
      threads: [],
      nextCursor: null
    });
    expect(peer.connectCount).toBe(1);
    expect(peer.initializeCount).toBe(1);
    expect(peer.notifications).toEqual([]);
  });

  it("刷新读取会合并尚未 materialized 的实时工具输出", async () => {
    const peer = new NotificationOverlayPeer();
    const gateway = new AppServerGateway(peer);

    await gateway.ensureReady();
    peer.emitNotification({
      method: "command/exec/outputDelta",
      params: {
        threadId: "thread-1",
        turnId: "turn-1",
        processId: "process-1",
        deltaBase64: Buffer.from("npm test\n").toString("base64")
      }
    });
    peer.emitNotification({
      method: "item/mcpToolCall/progress",
      params: {
        threadId: "thread-1",
        turnId: "turn-1",
        itemId: "mcp-1",
        message: "正在读取资源"
      }
    });

    expect((await gateway.readThread("thread-1")).timeline).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "process-1",
          turnId: "turn-1",
          role: "tool",
          text: "npm test\n",
          toolKind: "command",
          server: "command",
          tool: "command",
          status: "running"
        }),
        expect.objectContaining({
          id: "mcp-1",
          turnId: "turn-1",
          role: "tool",
          text: "正在读取资源",
          toolKind: "mcp",
          server: "mcp",
          tool: "progress",
          status: "running"
        })
      ])
    );

    peer.emitNotification({
      method: "turn/completed",
      params: { threadId: "thread-1", turn: { id: "turn-1", status: "completed" } }
    });

    expect(await gateway.readThread("thread-1")).toMatchObject({
      timeline: expect.arrayContaining([
        expect.objectContaining({ id: "process-1", status: "success" }),
        expect.objectContaining({ id: "mcp-1", status: "success" })
      ])
    });
  });

  it("刷新读取会把未匹配 overlay 活动插入所属 turn 的最终回复之前", async () => {
    const peer = new SnapshotWithFinalAgentOverlayPeer();
    const gateway = new AppServerGateway(peer);

    await gateway.ensureReady();
    peer.emitNotification({
      method: "item/commandExecution/outputDelta",
      params: {
        threadId: "thread-1",
        turnId: "turn-1",
        itemId: "cmd-overlay",
        delta: "rg timeline src\n"
      }
    });
    peer.emitNotification({
      method: "turn/completed",
      params: { threadId: "thread-1", turn: { id: "turn-1", status: "completed" } }
    });

    const detail = await gateway.readThread("thread-1");

    expect(detail.timeline.map((item) => item.id)).toEqual(["user-1", "cmd-overlay", "agent-final"]);
    expect(detail.timeline[1]).toMatchObject({
      id: "cmd-overlay",
      turnId: "turn-1",
      role: "tool",
      status: "success"
    });
  });

  it("overlay 替换已 materialized item 时保留 turn 元数据", async () => {
    const peer = new NotificationOverlayPeer();
    const gateway = new AppServerGateway(peer);

    await gateway.ensureReady();
    peer.emitNotification({
      method: "item/started",
      params: {
        threadId: "thread-1",
        turnId: "turn-1",
        item: {
          type: "userMessage",
          id: "user-1",
          clientId: "client-user-1",
          content: [{ type: "text", text: "覆盖后的用户消息", text_elements: [] }]
        },
        startedAtMs: 1234
      }
    });

    expect(await gateway.readThread("thread-1")).toMatchObject({
      timeline: expect.arrayContaining([
        expect.objectContaining({
          id: "user-1",
          turnId: "turn-1",
          turnIndex: 0,
          role: "user",
          text: "覆盖后的用户消息"
        })
      ])
    });
  });

  it("刷新读取会合并 agent message delta overlay", async () => {
    const peer = new NotificationOverlayPeer();
    const gateway = new AppServerGateway(peer);

    await gateway.ensureReady();
    peer.emitNotification({
      method: "item/agentMessage/delta",
      params: {
        threadId: "thread-1",
        turnId: "turn-1",
        itemId: "agent-live-1",
        delta: "正在生成的 agent 正文"
      }
    });

    expect(await gateway.readThread("thread-1")).toMatchObject({
      timeline: expect.arrayContaining([
        expect.objectContaining({
          id: "agent-live-1",
          turnId: "turn-1",
          role: "agent",
          text: "正在生成的 agent 正文"
        })
      ])
    });
  });

  it("rollback 后清理被删除 turn 的 overlay", async () => {
    const peer = new NotificationOverlayPeer();
    const gateway = new AppServerGateway(peer);

    await gateway.ensureReady();
    peer.emitNotification({
      method: "item/commandExecution/outputDelta",
      params: {
        threadId: "thread-1",
        turnId: "turn-1",
        itemId: "cmd-deleted",
        delta: "旧命令输出\n"
      }
    });

    expect((await gateway.readThread("thread-1")).timeline).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "cmd-deleted" })])
    );

    await gateway.rollbackThread("thread-1", 1);

    const detail = await gateway.readThread("thread-1");
    expect(detail.timeline.some((item) => item.id === "cmd-deleted")).toBe(false);
  });

  it("rollback 后清理尚未 materialized 的 live turn overlay 和 backlog", async () => {
    const peer = new NotificationOverlayPeer();
    const gateway = new AppServerGateway(peer);
    const seen: ReturnType<typeof gateway.listBrowserEventBacklog>["events"] = [];
    gateway.onBrowserEvent((event) => seen.push(event));

    await gateway.ensureReady();
    peer.emitNotification({
      method: "item/reasoning/summaryTextDelta",
      params: {
        threadId: "thread-1",
        turnId: "turn-live",
        itemId: "reasoning-live",
        delta: "旧思考"
      }
    });
    peer.emitNotification({
      method: "item/commandExecution/outputDelta",
      params: {
        threadId: "thread-1",
        turnId: "turn-live",
        itemId: "cmd-live",
        delta: "旧工具输出\n"
      }
    });

    expect((await gateway.readThread("thread-1")).timeline).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "reasoning-live", turnId: "turn-live" }),
        expect.objectContaining({ id: "cmd-live", turnId: "turn-live" })
      ])
    );
    const oldEvent = seen.find(
      (event) => event.type === "codex-event" && event.event.kind === "reasoning_delta"
    );
    const oldEventId = oldEvent?.type === "codex-event" ? oldEvent.event.eventId : null;

    const rolledBack = await gateway.rollbackThread("thread-1", 1, { expectedDeletedTurnIds: ["turn-live"] });

    expect(rolledBack.timeline.some((item) => item.turnId === "turn-live")).toBe(false);
    if (oldEventId) {
      expect(gateway.listBrowserEventBacklog(oldEventId).events).toEqual([]);
    }

    peer.emitNotification({
      method: "item/agentMessage/delta",
      params: {
        threadId: "thread-1",
        turnId: "turn-live",
        itemId: "agent-live-late",
        delta: "不应回流"
      }
    });

    expect((await gateway.readThread("thread-1")).timeline.some((item) => item.turnId === "turn-live")).toBe(false);
  });

  it("rollback 不会信任 expectedDeletedTurnIds 屏蔽仍存在的 turn", async () => {
    const peer = new PartialRollbackPeer();
    const gateway = new AppServerGateway(peer);

    await gateway.ensureReady();
    const rolledBack = await gateway.rollbackThread("thread-1", 1, {
      expectedDeletedTurnIds: ["turn-1", "turn-2"]
    });

    expect(rolledBack.timeline).toEqual(expect.arrayContaining([expect.objectContaining({ turnId: "turn-1" })]));
    peer.emitNotification({
      method: "item/commandExecution/outputDelta",
      params: {
        threadId: "thread-1",
        turnId: "turn-1",
        itemId: "cmd-still-valid",
        delta: "仍然有效"
      }
    });

    expect((await gateway.readThread("thread-1")).timeline).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "cmd-still-valid", turnId: "turn-1", text: "仍然有效" })
      ])
    );
  });

  it("刷新读取合并 snapshot 与 overlay 中同 turn 等价 reasoning，避免重复卡片", async () => {
    const peer = new SnapshotReasoningPeer();
    const gateway = new AppServerGateway(peer);

    await gateway.ensureReady();
    peer.emitNotification({
      method: "item/reasoning/summaryTextDelta",
      params: {
        threadId: "thread-1",
        turnId: "turn-1",
        itemId: "reasoning-overlay",
        delta: "Checking working directory in Chinese"
      }
    });

    const detail = await gateway.readThread("thread-1");
    const reasoningItems = detail.timeline.filter((item) => item.role === "reasoning");

    expect(reasoningItems).toHaveLength(1);
    expect(reasoningItems[0]).toMatchObject({
      turnId: "turn-1",
      text: "Checking working directory in Chinese"
    });
  });

  it("读取会话详情时从 rollout JSONL 补齐 app-server 历史缺失的工具活动", async () => {
    const peer = new SessionResponseItemsPeer();
    const gateway = new AppServerGateway(peer);

    const detail = await gateway.readThread("thread-1");

    const ids = detail.timeline.map((item) => item.id);
    expect(ids.indexOf("agent-1")).toBeLessThan(ids.indexOf("fc-skill"));
    expect(ids.indexOf("fc-skill")).toBeLessThan(ids.indexOf("fc-read"));
    expect(ids.indexOf("fc-read")).toBeLessThan(ids.indexOf("fc-search"));
    expect(ids.indexOf("fc-search")).toBeLessThan(ids.indexOf("tsc-search"));
    expect(ids.indexOf("tsc-search")).toBeLessThan(ids.indexOf("ctc-patch"));
    expect(ids.indexOf("ctc-patch")).toBeLessThan(ids.indexOf("agent-2"));
    expect(ids).not.toContain("fc-plan");
    expect(detail.timeline.filter((item) => item.role === "agent")).toHaveLength(2);
    expect(detail.timeline).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "fc-skill",
          turnId: "turn-1",
          role: "tool",
          toolKind: "dynamic",
          server: "skills",
          tool: "loaded",
          text: "systematic-debugging",
          status: "success"
        }),
        expect.objectContaining({
          id: "fc-read",
          turnId: "turn-1",
          role: "tool",
          toolKind: "command",
          actionKind: "read",
          server: "/tmp/workspace",
          tool: "sed -n '650,820p' src/server/app-server/client.ts",
          status: "success"
        }),
        expect.objectContaining({
          id: "fc-search",
          turnId: "turn-1",
          role: "tool",
          toolKind: "command",
          actionKind: "search",
          server: "/tmp/workspace",
          tool: "rg -n \"timeline\" src/server src/web",
          status: "success"
        }),
        expect.objectContaining({
          id: "tsc-search",
          turnId: "turn-1",
          role: "tool",
          toolKind: "command",
          actionKind: "search",
          server: "tool-search",
          tool: "search image generation built-in image_gen generate image",
          status: "success"
        }),
        expect.objectContaining({
          id: "ctc-patch",
          turnId: "turn-1",
          role: "tool",
          toolKind: "file",
          server: "file",
          tool: "src/web/components/Timeline.tsx",
          added: 1,
          removed: 1,
          status: "success"
        })
      ])
    );
  });

  it("读取单个 turn items 时也从 rollout JSONL 补齐缺失工具活动", async () => {
    const peer = new SessionResponseItemsPeer();
    const gateway = new AppServerGateway(peer);

    const page = await gateway.listThreadTurnItems({ threadId: "thread-1", turnId: "turn-1", limit: 100 });

    expect(page.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "fc-skill", turnId: "turn-1", server: "skills", tool: "loaded" }),
        expect.objectContaining({ id: "fc-read", turnId: "turn-1", actionKind: "read" }),
        expect.objectContaining({ id: "fc-search", turnId: "turn-1", actionKind: "search" }),
        expect.objectContaining({ id: "tsc-search", turnId: "turn-1", actionKind: "search" }),
        expect.objectContaining({ id: "ctc-patch", turnId: "turn-1", toolKind: "file" })
      ])
    );
    expect(page.items.map((item) => item.id)).not.toContain("fc-plan");
  });

  it("app-server 已有 fileChange 时不会把 JSONL apply_patch 补成重复文件活动", async () => {
    const peer = new SessionResponseItemsWithNativePatchPeer();
    const gateway = new AppServerGateway(peer);

    const page = await gateway.listThreadTurnItems({ threadId: "thread-1", turnId: "turn-1", limit: 100 });
    const fileItems = page.items.filter((item) => item.role === "tool" && item.toolKind === "file");

    expect(fileItems).toHaveLength(1);
    expect(fileItems[0]).toMatchObject({
      id: "native-patch",
      tool: "/tmp/workspace/src/web/components/Timeline.tsx"
    });
    expect(page.items.map((item) => item.id)).not.toContain("ctc-patch");
  });

  it("rollback 后旧 generation 的 backlog 可见事件不会重新进入 timeline", async () => {
    const peer = new NotificationOverlayPeer();
    const gateway = new AppServerGateway(peer);
    const seen: ReturnType<typeof gateway.listBrowserEventBacklog>["events"] = [];
    const unsubscribe = gateway.onBrowserEvent((event) => {
      seen.push(event);
    });

    await gateway.ensureReady();
    peer.emitNotification({
      method: "item/commandExecution/outputDelta",
      params: {
        threadId: "thread-1",
        turnId: "turn-1",
        itemId: "cmd-old",
        delta: "旧输出\n"
      }
    });

    const oldEvent = seen.find(
      (event) => event.type === "codex-event" && event.event.kind === "command_output_delta"
    );
    const oldEventId = oldEvent?.type === "codex-event" ? oldEvent.event.eventId : null;

    await gateway.rollbackThread("thread-1", 1);

    peer.emitNotification({
      method: "item/commandExecution/outputDelta",
      params: {
        threadId: "thread-1",
        turnId: "turn-1",
        itemId: "cmd-old-late",
        delta: "不应回流\n"
      }
    });

    expect((await gateway.readThread("thread-1")).timeline.some((item) => item.id === "cmd-old-late")).toBe(false);
    if (oldEventId) {
      const replay = gateway.listBrowserEventBacklog(oldEventId);
      expect(replay.events).toEqual([]);
    }
    unsubscribe();
  });

  it("刷新读取会保留运行中的 reasoning 占位，并在空内容完成后清理", async () => {
    const peer = new NotificationOverlayPeer();
    const gateway = new AppServerGateway(peer);

    await gateway.ensureReady();
    peer.emitNotification({
      method: "turn/started",
      params: { threadId: "thread-1", turn: { id: "turn-active" } }
    });

    expect(await gateway.readThread("thread-1")).toMatchObject({
      timeline: expect.arrayContaining([
        expect.objectContaining({
          id: "turn-active-reasoning-pending",
          turnId: "turn-active",
          role: "reasoning",
          text: "",
          done: false
        })
      ])
    });

    peer.emitNotification({
      method: "turn/completed",
      params: { threadId: "thread-1", turn: { id: "turn-active", status: "completed" } }
    });

    const detail = await gateway.readThread("thread-1");
    expect(detail.timeline.some((item) => item.id === "turn-active-reasoning-pending")).toBe(false);
  });

  it("刷新读取会保留 turn diff overlay 并带行数统计", async () => {
    const peer = new NotificationOverlayPeer();
    const gateway = new AppServerGateway(peer);

    await gateway.ensureReady();
    peer.emitNotification({
      method: "turn/diff/updated",
      params: {
        threadId: "thread-1",
        turnId: "turn-1",
        diff: "--- a/src/app.ts\n+++ b/src/app.ts\n@@ -1,2 +1,3 @@\n-old\n+new\n+added"
      }
    });

    expect(await gateway.readThread("thread-1")).toMatchObject({
      timeline: expect.arrayContaining([
        expect.objectContaining({
          id: "turn-1-diff",
          role: "diff",
          diffPath: "工作区变更",
          added: 2,
          removed: 1,
          text: expect.stringContaining("+added")
        })
      ])
    });
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
      event: expect.objectContaining({
        kind: "agent_message_delta",
        threadId: "mock-thread-1",
        turnId: "mock-turn-2",
        itemId: "mock-live-4",
        delta: "实时事件：实时流测试",
        eventId: expect.any(String),
        sequence: expect.any(Number),
        revision: expect.any(Number)
      })
    });
    expect(events).toContainEqual({
      type: "codex-event",
      event: expect.objectContaining({
        kind: "reasoning_delta",
        threadId: "mock-thread-1",
        turnId: "mock-turn-2",
        itemId: "mock-reasoning-4",
        delta: "思考：实时流测试",
        eventId: expect.any(String),
        sequence: expect.any(Number),
        revision: expect.any(Number)
      })
    });
    expect(events).toContainEqual({
      type: "codex-event",
      event: expect.objectContaining({
        kind: "plan_delta",
        threadId: "mock-thread-1",
        turnId: "mock-turn-2",
        itemId: "mock-plan-4",
        delta: "计划：整理请求并生成回复",
        eventId: expect.any(String),
        sequence: expect.any(Number),
        revision: expect.any(Number)
      })
    });
    expect(events).toContainEqual({
      type: "codex-event",
      event: expect.objectContaining({
        kind: "command_output_delta",
        threadId: "mock-thread-1",
        turnId: "mock-turn-2",
        itemId: "mock-command-4",
        delta: "命令输出：mock 完成",
        eventId: expect.any(String),
        sequence: expect.any(Number),
        revision: expect.any(Number)
      })
    });
    expect(events).toContainEqual({
      type: "codex-event",
      event: expect.objectContaining({
        kind: "turn_diff_updated",
        threadId: "mock-thread-1",
        turnId: "mock-turn-2",
        diff: "diff --git a/mock.txt b/mock.txt",
        eventId: expect.any(String),
        sequence: expect.any(Number),
        revision: expect.any(Number)
      })
    });
    expect(events).toContainEqual({
      type: "codex-event",
      event: expect.objectContaining({
        kind: "file_output_delta",
        threadId: "mock-thread-1",
        turnId: "mock-turn-2",
        itemId: "mock-file-4",
        delta: "文件输出：mock.txt 已更新",
        eventId: expect.any(String),
        sequence: expect.any(Number),
        revision: expect.any(Number)
      })
    });
    expect(events).toContainEqual({
      type: "codex-event",
      event: expect.objectContaining({
        kind: "token_usage_updated",
        threadId: "mock-thread-1",
        turnId: "mock-turn-2",
        totalTokens: 128,
        inputTokens: 48,
        outputTokens: 64,
        reasoningOutputTokens: 16,
        modelContextWindow: 200000,
        eventId: expect.any(String),
        sequence: expect.any(Number),
        revision: expect.any(Number)
      })
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

    await gateway.resolveServerRequest(1, "accept");

    expect(gateway.listPendingServerRequests()).toEqual([]);
    expect(events).toContainEqual({ type: "server-request-resolved", requestId: "1" });
  });

  it("resolveServerRequest 为 question 构造 response，respond 失败时保留 pending 且不广播 resolved", async () => {
    const peer = new RejectingServerRequestPeer();
    const gateway = new AppServerGateway(peer);
    const events: unknown[] = [];

    gateway.onBrowserEvent((event) => events.push(event));
    peer.emitServerRequest({
      id: 22,
      method: "item/tool/requestUserInput",
      params: {
        threadId: "thread-1",
        turnId: "turn-1",
        itemId: "item-1",
        questions: [
          {
            id: "mode",
            header: "模式",
            question: "请选择模式",
            isOther: false,
            isSecret: false,
            options: [{ id: "fast", label: "快速", description: "更快完成" }]
          }
        ],
        autoResolutionMs: null
      }
    });

    await expect(gateway.resolveServerRequest(22, "fast")).rejects.toThrow("app-server 拒绝 response");

    expect(peer.responses).toEqual([
      {
        id: 22,
        result: { answers: { mode: { answers: ["fast"] } } }
      }
    ]);
    expect(gateway.listPendingServerRequests()).toHaveLength(1);
    expect(events).not.toContainEqual({ type: "server-request-resolved", requestId: 22 });
  });

  it("app-server 外部 resolved notification 会删除 pending 并广播 string requestId", () => {
    const peer = new RejectingServerRequestPeer();
    const gateway = new AppServerGateway(peer);
    const events: unknown[] = [];

    gateway.onBrowserEvent((event) => events.push(event));
    peer.emitServerRequest({
      id: 23,
      method: "item/commandExecution/requestApproval",
      params: {
        threadId: "thread-1",
        turnId: "turn-1",
        itemId: "item-1",
        command: "npm test",
        availableDecisions: ["accept", "decline"]
      }
    });

    expect(gateway.listPendingServerRequests()).toHaveLength(1);

    peer.emitNotification({ method: "serverRequest/resolved", params: { requestId: 23 } });

    expect(gateway.listPendingServerRequests()).toEqual([]);
    expect(events).toContainEqual({ type: "server-request-resolved", requestId: "23" });
  });

  it("mock 模式支持 fork、rollback、interrupt 和 steer", async () => {
    const gateway = createAppServerGateway({ mode: "mock" });
    await gateway.ensureReady();

    const forked = await gateway.forkThread("mock-thread-1");
    expect(forked.id).not.toBe("mock-thread-1");

    await gateway.startTurn({ threadId: forked.id, text: "需要回滚" });
    const rolledBack = await gateway.rollbackThread(forked.id, 1);
    expect(rolledBack.timeline.some((item) => item.text.includes("需要回滚"))).toBe(false);

    await expect(gateway.interruptTurn(forked.id, rolledBack.lastTurnId || "mock-turn-1")).resolves.toBeUndefined();
    await expect(
      gateway.steerTurn({ threadId: forked.id, expectedTurnId: rolledBack.lastTurnId || "mock-turn-1", text: "请继续" })
    ).resolves.toMatchObject({ turnId: expect.any(String) });
  });

  it("mock 模式支持文件、终端和设置面板所需数据", async () => {
    const gateway = createAppServerGateway({ mode: "mock" });
    await gateway.ensureReady();

    await expect(gateway.readDirectory("C:\\Users\\huang\\workspace")).resolves.toEqual([
      {
        name: "src",
        path: "C:\\Users\\huang\\workspace\\src",
        isDirectory: true,
        isFile: false
      },
      {
        name: "README.md",
        path: "C:\\Users\\huang\\workspace\\README.md",
        isDirectory: false,
        isFile: true
      }
    ]);
    await expect(gateway.readFile("C:\\Users\\huang\\workspace\\README.md")).resolves.toEqual({
      path: "C:\\Users\\huang\\workspace\\README.md",
      text: "# Codex Web\n\n移动端 Web 工作台 mock 文件。"
    });
    await expect(gateway.getMetadata("C:\\Users\\huang\\workspace\\README.md")).resolves.toMatchObject({
      isDirectory: false,
      isFile: true,
      isSymlink: false,
      createdAtMs: expect.any(Number),
      modifiedAtMs: expect.any(Number)
    });
    await gateway.writeFile("C:\\Users\\huang\\workspace\\README.md", "# 已保存\n\n来自移动端。");
    await expect(gateway.readFile("C:\\Users\\huang\\workspace\\README.md")).resolves.toEqual({
      path: "C:\\Users\\huang\\workspace\\README.md",
      text: "# 已保存\n\n来自移动端。"
    });
    await gateway.createDirectory("C:\\Users\\huang\\workspace\\docs");
    await expect(gateway.readDirectory("C:\\Users\\huang\\workspace")).resolves.toEqual(
      expect.arrayContaining([
        {
          name: "docs",
          path: "C:\\Users\\huang\\workspace\\docs",
          isDirectory: true,
          isFile: false
        }
      ])
    );
    await gateway.copyPath("C:\\Users\\huang\\workspace\\README.md", "C:\\Users\\huang\\workspace\\README.copy.md");
    await expect(gateway.readFile("C:\\Users\\huang\\workspace\\README.copy.md")).resolves.toEqual({
      path: "C:\\Users\\huang\\workspace\\README.copy.md",
      text: "# 已保存\n\n来自移动端。"
    });
    await gateway.removePath("C:\\Users\\huang\\workspace\\README.copy.md");
    await expect(gateway.readDirectory("C:\\Users\\huang\\workspace")).resolves.toEqual(
      expect.not.arrayContaining([
        expect.objectContaining({
          path: "C:\\Users\\huang\\workspace\\README.copy.md"
        })
      ])
    );
    await expect(gateway.execCommand({ command: ["npm", "--version"], cwd: "C:\\Users\\huang\\workspace" })).resolves.toEqual({
      exitCode: 0,
      stdout: "mock command: npm --version\ncwd: C:\\Users\\huang\\workspace",
      stderr: ""
    });
    await expect(gateway.searchFiles({ query: "app", roots: ["C:\\Users\\huang\\workspace"] })).resolves.toEqual([
      {
        root: "C:\\Users\\huang\\workspace",
        path: "src\\app.ts",
        fullPath: "C:\\Users\\huang\\workspace\\src\\app.ts",
        fileName: "app.ts",
        matchType: "file",
        score: 100,
        indices: [0, 1, 2]
      }
    ]);
    await expect(gateway.readSettings()).resolves.toEqual({
      model: "gpt-5-codex",
      modelProvider: "openai",
      reasoningEffort: "medium",
      reasoningSummary: null,
      approvalPolicy: "untrusted",
      sandboxMode: "workspace-write",
      loadedThreadIds: ["mock-thread-1"],
      experimentalFeatures: [
        {
          name: "appshots",
          stage: "beta",
          displayName: "Appshots",
          description: "自动保存移动端应用截图",
          announcement: "Appshots 已可在移动端试用",
          enabled: false,
          defaultEnabled: false
        }
      ],
      authStatus: {
        authMethod: "chatgpt",
        hasAuthToken: false,
        requiresOpenaiAuth: false
      },
      remoteControlStatus: "connected",
      remoteControlServerName: "mock",
      remoteControlInstallationId: "mock-installation",
      remoteControlEnvironmentId: "mock-env",
      account: {
        type: "chatgpt",
        email: "dev@example.com",
        planType: "pro",
        requiresOpenaiAuth: false
      },
      rateLimit: {
        limitId: "codex",
        limitName: "Codex",
        usedPercent: 42,
        windowDurationMins: 300,
        resetsAt: 1_800_000_000,
        resetCreditsAvailable: 1
      },
      providerCapabilities: {
        namespaceTools: true,
        imageGeneration: true,
        webSearch: false
      },
      remoteControlClients: [
        {
          clientId: "mock-phone",
          displayName: "手机浏览器",
          deviceType: "phone",
          platform: "web",
          lastSeenAt: 1_800_000_001
        }
      ],
      mcpServers: [
        {
          name: "filesystem",
          authStatus: "bearerToken",
          toolCount: 2,
          resourceCount: 1,
          resourceTemplateCount: 0,
          resources: [{ uri: "file:///README.md", name: "README", mimeType: "text/markdown" }]
        },
        {
          name: "github",
          authStatus: "notLoggedIn",
          toolCount: 1,
          resourceCount: 0,
          resourceTemplateCount: 0,
          resources: []
        }
      ],
      collaborationModes: [
        { name: "Code", mode: "default", model: "gpt-5-codex", reasoningEffort: "medium" },
        { name: "Ask", mode: "ask", model: null, reasoningEffort: null }
      ],
      permissionProfiles: [
        { id: "default", label: "default", description: "默认权限配置" },
        { id: "read-only", label: "read-only", description: "只读工作区" },
        { id: "full-auto", label: "full-auto", description: "允许自动执行" }
      ],
      skills: [
        {
          cwd: "C:\\Users\\huang\\workspace",
          name: "openai-docs",
          path: "C:\\Users\\huang\\.codex\\skills\\openai-docs\\SKILL.md",
          description: "查询 OpenAI 官方文档",
          shortDescription: "OpenAI 文档",
          scope: "user",
          enabled: true
        },
        {
          cwd: "C:\\Users\\huang\\workspace",
          name: "repo-helper",
          path: "C:\\Users\\huang\\workspace\\.codex\\skills\\repo-helper\\SKILL.md",
          description: "项目内辅助技能",
          shortDescription: null,
          scope: "repo",
          enabled: false
        }
      ],
      skillErrors: [],
      hooks: [
        {
          cwd: "C:\\Users\\huang\\workspace",
          key: "post-tool-use-format",
          eventName: "postToolUse",
          handlerType: "command",
          matcher: "Edit",
          command: "npm run format",
          source: "project",
          sourcePath: "C:\\Users\\huang\\workspace\\.codex\\hooks.json",
          pluginId: null,
          enabled: true,
          trustStatus: "trusted",
          statusMessage: "格式化文件"
        }
      ],
      hookWarnings: [{ cwd: "C:\\Users\\huang\\workspace", message: "hook 即将迁移" }],
      hookErrors: [],
      plugins: [
        {
          marketplaceName: "个人插件市场",
          marketplacePath: "C:\\Users\\huang\\.codex\\plugins\\marketplace.json",
          marketplaceDisplayName: "个人插件",
          id: "browser-tools",
          name: "browser-tools",
          displayName: "浏览器工具",
          shortDescription: "控制浏览器",
          installed: true,
          enabled: true,
          availability: "AVAILABLE",
          sourceType: "local"
        },
        {
          marketplaceName: "个人插件市场",
          marketplacePath: "C:\\Users\\huang\\.codex\\plugins\\marketplace.json",
          marketplaceDisplayName: "个人插件",
          id: "review-pack",
          name: "review-pack",
          displayName: null,
          shortDescription: null,
          installed: false,
          enabled: false,
          availability: "DISABLED_BY_ADMIN",
          sourceType: "remote"
        }
      ],
      pluginMarketplaceErrors: []
    });
  });

  it("mock 模式支持监听文件变化并停止监听", async () => {
    const gateway = createAppServerGateway({ mode: "mock" });
    const events: unknown[] = [];

    gateway.onBrowserEvent((event) => events.push(event));
    await gateway.ensureReady();

    await expect(gateway.watchPath("C:\\Users\\huang\\workspace")).resolves.toEqual({
      watchId: "mobile-watch-1",
      path: "C:\\Users\\huang\\workspace"
    });
    await gateway.writeFile("C:\\Users\\huang\\workspace\\README.md", "# 触发监听");

    expect(events).toContainEqual({
      type: "codex-event",
      event: expect.objectContaining({
        kind: "fs_changed",
        watchId: "mobile-watch-1",
        paths: ["C:\\Users\\huang\\workspace\\README.md"],
        eventId: expect.any(String),
        sequence: expect.any(Number),
        revision: expect.any(Number)
      })
    });

    events.length = 0;
    await expect(gateway.unwatchPath("mobile-watch-1")).resolves.toBeUndefined();
    await gateway.writeFile("C:\\Users\\huang\\workspace\\README.md", "# 停止监听后不广播");

    expect(events).toEqual([]);
  });

  it("mock 模式支持交互式终端会话", async () => {
    const gateway = createAppServerGateway({ mode: "mock" });
    await gateway.ensureReady();

    const session = await gateway.startProcessSession({
      command: ["npm", "test"],
      cwd: "C:\\Users\\huang\\workspace"
    });

    expect(session).toMatchObject({
      cwd: "C:\\Users\\huang\\workspace",
      command: ["npm", "test"],
      exitCode: null,
      running: true
    });

    await new Promise((resolve) => setTimeout(resolve, 20));
    await expect(gateway.readProcessSession(session.processHandle)).resolves.toMatchObject({
      output: expect.stringContaining("mock process: npm test"),
      running: true
    });

    await gateway.writeProcessStdin(session.processHandle, "继续\n");
    await expect(gateway.readProcessSession(session.processHandle)).resolves.toMatchObject({
      output: expect.stringContaining("stdin: 继续")
    });

    await gateway.resizeProcessSession(session.processHandle, 100, 30);
    await expect(gateway.readProcessSession(session.processHandle)).resolves.toMatchObject({
      output: expect.stringContaining("PTY 100x30")
    });

    await gateway.killProcessSession(session.processHandle);
    await expect(gateway.readProcessSession(session.processHandle)).resolves.toMatchObject({
      exitCode: 143,
      running: false
    });
  });

  it("mock 模式支持 command exec 会话控制", async () => {
    const gateway = createAppServerGateway({ mode: "mock" });
    await gateway.ensureReady();

    const session = await gateway.startCommandExecSession({
      command: ["node", "-i"],
      cwd: "C:\\Users\\huang\\workspace"
    });

    expect(session).toMatchObject({
      cwd: "C:\\Users\\huang\\workspace",
      command: ["node", "-i"],
      exitCode: null,
      running: true
    });

    await new Promise((resolve) => setTimeout(resolve, 20));
    await expect(gateway.readCommandExecSession(session.processHandle)).resolves.toMatchObject({
      output: expect.stringContaining("mock command exec: node -i"),
      running: true
    });

    await gateway.writeCommandExecStdin(session.processHandle, "继续\n");
    await gateway.resizeCommandExecSession(session.processHandle, 100, 30);
    await expect(gateway.readCommandExecSession(session.processHandle)).resolves.toMatchObject({
      output: expect.stringContaining("stdin: 继续"),
      running: true
    });

    await gateway.terminateCommandExecSession(session.processHandle);
    await expect(gateway.readCommandExecSession(session.processHandle)).resolves.toMatchObject({
      exitCode: 143,
      running: false
    });
  });

  it("mock 模式支持管理会话后台终端", async () => {
    const gateway = createAppServerGateway({ mode: "mock" });
    await gateway.ensureReady();

    await expect(gateway.listThreadBackgroundTerminals({ threadId: "mock-thread-1" })).resolves.toEqual({
      terminals: [
        {
          itemId: "mock-bg-item-1",
          processId: "mock-bg-1",
          command: "npm run dev",
          cwd: "C:\\Users\\huang\\workspace",
          osPid: 4242,
          cpuPercent: 1.5,
          rssKb: 2048
        }
      ],
      nextCursor: null
    });
    await expect(gateway.terminateThreadBackgroundTerminal("mock-thread-1", "mock-bg-1")).resolves.toEqual({
      terminated: true
    });
    await expect(gateway.listThreadBackgroundTerminals({ threadId: "mock-thread-1" })).resolves.toEqual({
      terminals: [],
      nextCursor: null
    });
    await expect(gateway.cleanThreadBackgroundTerminals("mock-thread-1")).resolves.toBeUndefined();
  });

  it("mock 模式支持 turns 和 items 分页读取", async () => {
    const gateway = createAppServerGateway({ mode: "mock" });
    await gateway.ensureReady();

    await expect(gateway.listThreadTurns({ threadId: "mock-thread-1", limit: 1 })).resolves.toMatchObject({
      items: expect.arrayContaining([expect.objectContaining({ role: "agent", text: expect.stringContaining("Codex app-server") })]),
      nextCursor: null
    });
    await expect(gateway.listThreadTurnItems({ threadId: "mock-thread-1", turnId: "mock-turn-1", limit: 2 })).resolves.toMatchObject({
      items: expect.arrayContaining([expect.objectContaining({ role: "agent", text: expect.stringContaining("Codex app-server") })]),
      nextCursor: null
    });
  });

  it("app-server 不支持 turn items 分页时回退到 turns/list 读取目标 turn", async () => {
    const peer = new UnsupportedTurnItemsPeer();
    const gateway = new AppServerGateway(peer);

    await expect(
      gateway.listThreadTurnItems({ threadId: "thread-1", turnId: "turn-target", limit: 100 })
    ).resolves.toEqual({
      items: [
        {
          id: "item-target-agent",
          turnId: "turn-target",
          role: "agent",
          text: "fallback item"
        }
      ],
      nextCursor: null
    });
    expect(peer.calls.map((call) => call.method)).toContain("thread/turns/items/list");
    expect(peer.calls).toContainEqual({
      method: "thread/turns/list",
      params: {
        threadId: "thread-1",
        limit: 100,
        sortDirection: "desc",
        itemsView: "full"
      }
    });
  });

  it("mock 模式支持搜索会话历史", async () => {
    const gateway = createAppServerGateway({ mode: "mock" });
    await gateway.ensureReady();

    await gateway.startThread({ model: "gpt-5-codex", permissions: "default" });

    await expect(gateway.searchThreads({ searchTerm: "示例", limit: 10 })).resolves.toMatchObject({
      threads: expect.arrayContaining([
        expect.objectContaining({
          id: "mock-thread-1",
          title: "示例会话",
          preview: expect.stringContaining("示例")
        })
      ]),
      nextCursor: null
    });
  });

  it("mock 模式支持 resume 会话并返回初始 timeline", async () => {
    const gateway = createAppServerGateway({ mode: "mock" });
    await gateway.ensureReady();

    await expect(gateway.resumeThread("mock-thread-1")).resolves.toMatchObject({
      id: "mock-thread-1",
      title: "示例会话",
      lastTurnId: "mock-turn-1",
      timeline: expect.arrayContaining([
        expect.objectContaining({ role: "user", text: "帮我看看当前项目" }),
        expect.objectContaining({ role: "agent", text: "我已经连上 Codex app-server，可以读取历史和模型。" })
      ])
    });
  });

  it("mock 模式支持设置和清除会话目标", async () => {
    const gateway = createAppServerGateway({ mode: "mock" });
    await gateway.ensureReady();

    await expect(
      gateway.setThreadGoal({ threadId: "mock-thread-1", objective: "手机端完整目标", tokenBudget: 9000 })
    ).resolves.toMatchObject({
      objective: "手机端完整目标",
      status: "active",
      tokenBudget: 9000
    });
    await expect(gateway.readThread("mock-thread-1")).resolves.toMatchObject({
      goal: expect.objectContaining({ objective: "手机端完整目标", tokenBudget: 9000 })
    });

    await expect(gateway.clearThreadGoal("mock-thread-1")).resolves.toBeUndefined();
    await expect(gateway.readThread("mock-thread-1")).resolves.toMatchObject({ goal: null });
  });

  it("mock 模式支持上下文压缩并广播事件", async () => {
    const gateway = createAppServerGateway({ mode: "mock" });
    const events: unknown[] = [];

    gateway.onBrowserEvent((event) => events.push(event));
    await gateway.ensureReady();
    await gateway.compactThread("mock-thread-1");

    expect(events).toContainEqual({
      type: "codex-event",
      event: expect.objectContaining({
        kind: "context_compacted",
        threadId: "mock-thread-1",
        turnId: "mock-turn-1",
        eventId: expect.any(String),
        sequence: expect.any(Number),
        revision: expect.any(Number)
      })
    });
  });

  it("mock 模式支持启动未提交改动代码审查", async () => {
    const gateway = createAppServerGateway({ mode: "mock" });
    await gateway.ensureReady();

    await expect(gateway.startReview("mock-thread-1")).resolves.toEqual({
      turnId: "mock-review-2",
      reviewThreadId: "mock-thread-1"
    });
    await expect(gateway.readThread("mock-thread-1")).resolves.toMatchObject({
      timeline: expect.arrayContaining([
        expect.objectContaining({ role: "tool", text: "代码审查：未提交改动" }),
        expect.objectContaining({ role: "agent", text: "已开始审查未提交改动" })
      ])
    });
  });

  it("mock 模式支持管理远程控制配对和客户端", async () => {
    const gateway = createAppServerGateway({ mode: "mock" });
    await gateway.ensureReady();

    await expect(gateway.startRemoteControlPairing()).resolves.toMatchObject({
      pairingCode: "pair-code-1",
      manualPairingCode: "123-456",
      environmentId: "mock-env"
    });
    await expect(
      gateway.readRemoteControlPairingStatus({ pairingCode: "pair-code-1", manualPairingCode: "123-456" })
    ).resolves.toEqual({ claimed: true });

    await expect(gateway.revokeRemoteControlClient("mock-env", "mock-phone")).resolves.toBeUndefined();
    await expect(gateway.readSettings()).resolves.toMatchObject({
      remoteControlClients: []
    });

    await expect(gateway.disableRemoteControl()).resolves.toMatchObject({ status: "disabled", environmentId: null });
    await expect(gateway.readSettings()).resolves.toMatchObject({
      remoteControlStatus: "disabled",
      remoteControlEnvironmentId: null
    });

    await expect(gateway.enableRemoteControl()).resolves.toMatchObject({ status: "connected", environmentId: "mock-env" });
  });

  it("mock 模式支持读取、安装和卸载插件", async () => {
    const gateway = createAppServerGateway({ mode: "mock" });
    await gateway.ensureReady();

    await expect(
      gateway.readPlugin({
        marketplacePath: "C:\\Users\\huang\\.codex\\plugins\\marketplace.json",
        pluginName: "browser-tools"
      })
    ).resolves.toMatchObject({
      id: "browser-tools",
      displayName: "浏览器工具",
      skillCount: 1,
      hookCount: 1,
      appCount: 1,
      mcpServers: ["browser"]
    });
    await expect(
      gateway.installPlugin({
        marketplacePath: "C:\\Users\\huang\\.codex\\plugins\\marketplace.json",
        pluginName: "browser-tools"
      })
    ).resolves.toMatchObject({
      authPolicy: "ON_USE",
      appsNeedingAuth: [expect.objectContaining({ id: "browser-app", name: "Browser" })]
    });
    await expect(gateway.uninstallPlugin("browser-tools")).resolves.toBeUndefined();
  });

  it("mock 模式支持读取 Apps 列表", async () => {
    const gateway = createAppServerGateway({ mode: "mock" });
    await gateway.ensureReady();

    await expect(gateway.listApps()).resolves.toEqual({
      apps: [
        {
          id: "browser-app",
          name: "Browser",
          description: "浏览器应用",
          category: "tool",
          developer: "OpenAI",
          installUrl: null,
          isAccessible: true,
          isEnabled: true,
          pluginDisplayNames: ["浏览器工具"]
        }
      ],
      nextCursor: null
    });
  });

  it("mock 模式支持读取配置要求和管理 Windows Sandbox", async () => {
    const gateway = createAppServerGateway({ mode: "mock" });
    await gateway.ensureReady();

    await expect(gateway.getConfigRequirements()).resolves.toEqual({
      allowedApprovalPolicies: ["untrusted"],
      allowedSandboxModes: ["workspace-write"],
      allowedWindowsSandboxImplementations: ["unelevated"],
      allowedPermissionProfiles: { default: true, "full-auto": true },
      defaultPermissions: "default",
      allowManagedHooksOnly: false,
      allowAppshots: true,
      allowRemoteControl: true,
      featureRequirements: { skills: true, plugins: true }
    });
    await expect(gateway.getWindowsSandboxReadiness()).resolves.toEqual({ status: "updateRequired" });
    await expect(gateway.startWindowsSandboxSetup({ mode: "unelevated", cwd: "C:\\Users\\huang\\workspace" })).resolves.toEqual({
      started: true
    });
    await expect(gateway.getWindowsSandboxReadiness()).resolves.toEqual({ status: "ready" });
  });

  it("mock 模式支持切换实验功能", async () => {
    const gateway = createAppServerGateway({ mode: "mock" });
    await gateway.ensureReady();

    await expect(gateway.setExperimentalFeatureEnablement("appshots", true)).resolves.toBeUndefined();
    await expect(gateway.readSettings()).resolves.toMatchObject({
      experimentalFeatures: [expect.objectContaining({ name: "appshots", enabled: true })]
    });
  });

  it("mock 模式支持写入全局配置并刷新设置", async () => {
    const gateway = createAppServerGateway({ mode: "mock" });
    await gateway.ensureReady();

    await expect(
      gateway.writeConfigBatch([
        { keyPath: "model", value: "gpt-5-mini" },
        { keyPath: "model_reasoning_effort", value: "high" },
        { keyPath: "approval_policy", value: "on-request" },
        { keyPath: "sandbox_mode", value: "read-only" }
      ])
    ).resolves.toMatchObject({
      status: "written",
      filePath: "C:\\Users\\huang\\.codex\\config.toml"
    });

    await expect(gateway.readSettings()).resolves.toMatchObject({
      model: "gpt-5-mini",
      reasoningEffort: "high",
      approvalPolicy: "on-request",
      sandboxMode: "read-only"
    });
  });

  it("mock 模式支持读取插件 Skill、设置额外根目录和写入 Skill 配置", async () => {
    const gateway = createAppServerGateway({ mode: "mock" });
    await gateway.ensureReady();

    const listedSkills = await gateway.listSkills({ enabledOnly: true });
    expect(listedSkills.skills).toEqual([
      expect.objectContaining({
        name: "openai-docs",
        path: "C:\\Users\\huang\\.codex\\skills\\openai-docs\\SKILL.md",
        enabled: true
      })
    ]);
    expect(listedSkills.skillErrors).toEqual([]);
    await expect(
      gateway.readPluginSkill({
        remoteMarketplaceName: "个人插件市场",
        remotePluginId: "remote-browser-tools",
        skillName: "browser:control"
      })
    ).resolves.toEqual({ contents: "# browser:control\n\n控制浏览器。" });
    await expect(gateway.setSkillsExtraRoots(["C:\\Users\\huang\\workspace\\skills"])).resolves.toBeUndefined();
    await expect(gateway.writeSkillConfig({ name: "openai-docs", enabled: false })).resolves.toEqual({
      effectiveEnabled: false
    });
  });

  it("mock 模式支持刷新 MCP、启动 OAuth 登录和读取资源", async () => {
    const gateway = createAppServerGateway({ mode: "mock" });
    await gateway.ensureReady();

    await expect(gateway.refreshMcpServer("filesystem")).resolves.toBeUndefined();
    await expect(gateway.loginMcpServer("github")).resolves.toEqual({
      authorizationUrl: "https://example.com/mcp/github/oauth"
    });
    await expect(
      gateway.readMcpResource({ server: "filesystem", uri: "file:///README.md", threadId: "mock-thread-1" })
    ).resolves.toEqual({
      contents: [{ uri: "file:///README.md", mimeType: "text/markdown", text: "# README\n\n来自 MCP 资源。" }]
    });
  });

  it("mock 模式支持切换记忆模式和重置记忆", async () => {
    const gateway = createAppServerGateway({ mode: "mock" });
    await gateway.ensureReady();

    await expect(gateway.setThreadMemoryMode("mock-thread-1", "enabled")).resolves.toBeUndefined();
    await expect(gateway.resetMemory()).resolves.toBeUndefined();
  });

  it("mock 模式支持管理 Codex 账号登录状态", async () => {
    const gateway = createAppServerGateway({ mode: "mock" });
    await gateway.ensureReady();

    await expect(gateway.getAuthStatus()).resolves.toEqual({
      authMethod: "chatgpt",
      hasAuthToken: false,
      requiresOpenaiAuth: false
    });
    await expect(gateway.loginWithChatGpt()).resolves.toEqual({
      type: "chatgpt",
      loginId: "mock-login-1",
      authUrl: "https://auth.openai.com/mock-codex"
    });
    await expect(gateway.loginWithApiKey("sk-test")).resolves.toEqual({ type: "apiKey" });
    await expect(gateway.readSettings()).resolves.toMatchObject({
      account: { type: "apiKey", requiresOpenaiAuth: false }
    });
    await expect(gateway.cancelAccountLogin("mock-login-1")).resolves.toEqual({ status: "canceled" });
    await expect(gateway.logoutAccount()).resolves.toBeUndefined();
    await expect(gateway.getAuthStatus()).resolves.toEqual({
      authMethod: null,
      hasAuthToken: false,
      requiresOpenaiAuth: true
    });
    await expect(gateway.readSettings()).resolves.toMatchObject({
      account: { type: "none", email: null, planType: null, requiresOpenaiAuth: true }
    });
  });

  it("mock 模式支持读取账号 token 用量、消费重置额度 credit 和发送加购提醒", async () => {
    const gateway = createAppServerGateway({ mode: "mock" });
    await gateway.ensureReady();

    await expect(gateway.getAccountTokenUsage()).resolves.toEqual({
      summary: {
        lifetimeTokens: 123456,
        peakDailyTokens: 45678,
        longestRunningTurnSec: 321,
        currentStreakDays: 7,
        longestStreakDays: 21
      },
      dailyUsageBuckets: [{ startDate: "2026-06-23", tokens: 1200 }]
    });
    await expect(gateway.consumeRateLimitResetCredit("reset-key-1")).resolves.toEqual({ outcome: "reset" });
    await expect(gateway.readSettings()).resolves.toMatchObject({
      rateLimit: { usedPercent: 0, resetCreditsAvailable: 0 }
    });
    await expect(gateway.consumeRateLimitResetCredit("reset-key-1")).resolves.toEqual({ outcome: "alreadyRedeemed" });
    await expect(gateway.sendAddCreditsNudgeEmail("usage_limit")).resolves.toEqual({ status: "sent" });
  });

  it("mock 模式支持重命名当前会话", async () => {
    const gateway = createAppServerGateway({ mode: "mock" });
    await gateway.ensureReady();

    const thread = await gateway.setThreadName("mock-thread-1", "手机端新标题");

    expect(thread.title).toBe("手机端新标题");
    await expect(gateway.readThread("mock-thread-1")).resolves.toMatchObject({
      id: "mock-thread-1",
      title: "手机端新标题"
    });
  });

  it("mock 模式支持会话 metadata、注入 items、批准 Guardian 动作和 mock 探针", async () => {
    const gateway = createAppServerGateway({ mode: "mock" });
    await gateway.ensureReady();

    await expect(
      gateway.updateThreadMetadata({
        threadId: "mock-thread-1",
        gitInfo: { sha: "abc123", branch: "main", originUrl: null }
      })
    ).resolves.toMatchObject({ id: "mock-thread-1" });
    await expect(
      gateway.injectThreadItems("mock-thread-1", [{ type: "message", role: "user", content: "注入上下文" }])
    ).resolves.toBeUndefined();
    await expect(gateway.readThread("mock-thread-1")).resolves.toMatchObject({
      timeline: expect.arrayContaining([expect.objectContaining({ role: "tool", text: "已注入 1 条上下文 item" })])
    });
    await expect(
      gateway.approveGuardianDeniedAction("mock-thread-1", { type: "guardian_assessment", id: "event-1" })
    ).resolves.toBeUndefined();
    await expect(gateway.mockExperimentalMethod("hello")).resolves.toEqual({ echoed: "hello" });
  });

  it("mock 模式支持读取会话摘要", async () => {
    const gateway = createAppServerGateway({ mode: "mock" });
    await gateway.ensureReady();

    await expect(gateway.getConversationSummary({ conversationId: "mock-thread-1" })).resolves.toMatchObject({
      id: "mock-thread-1",
      title: "这是用于移动端联调的示例会话",
      status: "summary"
    });
  });

  it("mock 模式支持读取远端 Git diff", async () => {
    const gateway = createAppServerGateway({ mode: "mock" });
    await gateway.ensureReady();

    await expect(gateway.gitDiffToRemote("C:\\Users\\huang\\workspace")).resolves.toEqual({
      sha: "mock-remote-sha",
      diff: "diff --git a/README.md b/README.md\n"
    });
  });

  it("mock 模式支持取消订阅会话", async () => {
    const gateway = createAppServerGateway({ mode: "mock" });
    await gateway.ensureReady();

    await expect(gateway.unsubscribeThread("mock-thread-1")).resolves.toEqual({ status: "unsubscribed" });
  });

  it("mock 模式支持剩余 app-server 协议", async () => {
    const gateway = createAppServerGateway({ mode: "mock" });
    await gateway.ensureReady();

    await expect(gateway.addEnvironment({ environmentId: "mock-env-2", execServerUrl: "http://127.0.0.1:4567" })).resolves.toEqual({
      added: true
    });
    await expect(gateway.detectExternalAgentConfig({ includeHome: true, cwds: ["C:\\Users\\huang\\workspace"] })).resolves.toMatchObject({
      items: [expect.objectContaining({ itemType: "AGENTS_MD" })]
    });
    await expect(
      gateway.importExternalAgentConfig({
        migrationItems: [{ itemType: "AGENTS_MD", description: "导入 AGENTS.md", cwd: "C:\\Users\\huang\\workspace", details: null }]
      })
    ).resolves.toEqual({ importId: "mock-import-1" });
    await expect(gateway.uploadFeedback({ classification: "bug", reason: "移动端反馈" })).resolves.toEqual({
      threadId: "mock-thread-1"
    });
    await expect(gateway.addMarketplace({ source: "https://example.com/plugins.git" })).resolves.toMatchObject({
      marketplaceName: "mock-marketplace",
      alreadyAdded: false
    });
    await expect(gateway.removeMarketplace("mock-marketplace")).resolves.toMatchObject({
      marketplaceName: "mock-marketplace"
    });
    await expect(gateway.upgradeMarketplace()).resolves.toMatchObject({
      selectedMarketplaces: ["mock-marketplace"],
      errors: []
    });
    await expect(gateway.listInstalledPlugins()).resolves.toMatchObject({
      marketplaces: expect.any(Array),
      marketplaceLoadErrors: []
    });
    await expect(gateway.savePluginShare({ pluginPath: "C:\\Users\\huang\\.codex\\plugins\\browser-tools" })).resolves.toMatchObject({
      remotePluginId: "mock-remote-plugin"
    });
    await expect(
      gateway.updatePluginShareTargets({
        remotePluginId: "mock-remote-plugin",
        discoverability: "PRIVATE",
        shareTargets: [{ principalType: "USER", principalId: "user-1", role: "OWNER" }]
      })
    ).resolves.toMatchObject({ discoverability: "PRIVATE" });
    await expect(gateway.listPluginShares()).resolves.toMatchObject({ data: expect.any(Array) });
    await expect(gateway.checkoutPluginShare("mock-remote-plugin")).resolves.toMatchObject({ pluginId: "browser-tools" });
    await expect(gateway.deletePluginShare("mock-remote-plugin")).resolves.toEqual({ deleted: true });
    await expect(
      gateway.callMcpTool({ threadId: "mock-thread-1", server: "filesystem", tool: "read_file", arguments: { path: "README.md" } })
    ).resolves.toMatchObject({ isError: false });
    await expect(gateway.startThreadRealtime({ threadId: "mock-thread-1", outputModality: "text" })).resolves.toEqual({ started: true });
    await expect(gateway.appendThreadRealtimeText({ threadId: "mock-thread-1", text: "你好", role: "user" })).resolves.toEqual({
      accepted: true
    });
    await expect(gateway.appendThreadRealtimeSpeech({ threadId: "mock-thread-1", text: "朗读" })).resolves.toEqual({
      accepted: true
    });
    await expect(
      gateway.appendThreadRealtimeAudio({
        threadId: "mock-thread-1",
        audio: { data: "AAAA", sampleRate: 24000, numChannels: 1, samplesPerChannel: null, itemId: null }
      })
    ).resolves.toEqual({ accepted: true });
    await expect(gateway.listThreadRealtimeVoices()).resolves.toMatchObject({ voices: { defaultV1: "alloy" } });
    await expect(gateway.stopThreadRealtime("mock-thread-1")).resolves.toEqual({ stopped: true });
  });

  it("mock 模式支持会话 shell command", async () => {
    const gateway = createAppServerGateway({ mode: "mock" });
    await gateway.ensureReady();

    await expect(gateway.runThreadShellCommand("mock-thread-1", "npm test")).resolves.toBeUndefined();
  });

  it("mock 模式支持调整会话 elicitation 计数", async () => {
    const gateway = createAppServerGateway({ mode: "mock" });
    await gateway.ensureReady();

    await expect(gateway.incrementThreadElicitation("mock-thread-1")).resolves.toEqual({ count: 1, paused: true });
    await expect(gateway.decrementThreadElicitation("mock-thread-1")).resolves.toEqual({ count: 0, paused: false });
  });

  it("mock 模式支持归档、恢复归档和删除会话", async () => {
    const gateway = createAppServerGateway({ mode: "mock" });
    await gateway.ensureReady();
    const newThread = await gateway.startThread({ model: "gpt-5-codex", permissions: "default" });

    await gateway.archiveThread(newThread.id);
    await expect(gateway.listThreads()).resolves.toMatchObject({
      threads: expect.not.arrayContaining([expect.objectContaining({ id: newThread.id })])
    });
    await expect(gateway.unarchiveThread(newThread.id)).resolves.toMatchObject({
      id: newThread.id
    });
    await expect(gateway.listThreads()).resolves.toMatchObject({
      threads: expect.arrayContaining([expect.objectContaining({ id: newThread.id })])
    });

    await gateway.deleteThread("mock-thread-1");
    await expect(gateway.listThreads()).resolves.toMatchObject({
      threads: expect.not.arrayContaining([expect.objectContaining({ id: "mock-thread-1" })])
    });
  });
});
