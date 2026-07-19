import { beforeEach, describe, expect, it, vi } from "vitest";

const mockListBrowserEventBacklog = vi.fn();
const mockOnBrowserEvent = vi.fn();
const mockAudit = vi.fn();

vi.mock("../../src/server/auth", () => ({
  isRequestAuthenticated: () => true
}));

vi.mock("../../src/server/security", () => ({
  audit: (...args: unknown[]) => mockAudit(...args)
}));

vi.mock("../../src/server/app-server/runtime", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/server/app-server/runtime")>();
  return {
    ...actual,
    getAppServerGateway: () => ({
      listBrowserEventBacklog: (...args: unknown[]) => mockListBrowserEventBacklog(...args),
      onBrowserEvent: (...args: unknown[]) => mockOnBrowserEvent(...args)
    })
  };
});

describe("codex events route", () => {
  beforeEach(() => {
    vi.resetModules();
    mockListBrowserEventBacklog.mockReset();
    mockOnBrowserEvent.mockReset();
    mockAudit.mockReset();
    mockAudit.mockResolvedValue(undefined);
    mockOnBrowserEvent.mockReturnValue(() => undefined);
    mockListBrowserEventBacklog.mockReturnValue({ events: [], gap: false });
  });

  it("返回 SSE 响应并支持 Last-Event-ID 补发", async () => {
    mockListBrowserEventBacklog.mockReturnValue({
      gap: false,
      events: [
        {
          type: "codex-event",
          event: {
            kind: "agent_message_delta",
            threadId: "thread-1",
            turnId: "turn-1",
            itemId: "agent-1",
            delta: "hello",
            eventId: "thread-1:1:1:agent_message_delta",
            sequence: 1,
            revision: 1
          }
        }
      ]
    });

    const { GET } = await import("../../src/app/api/codex/events/route");
    const abort = new AbortController();
    const response = await GET(
      new Request("http://localhost/api/codex/events", {
        headers: { "Last-Event-ID": "thread-1:0:0:turn_started" },
        signal: abort.signal
      })
    );
    abort.abort();
    const body = await response.text();

    expect(response.headers.get("Content-Type")).toContain("text/event-stream");
    expect(response.headers.get("Cache-Control")).toContain("no-cache");
    expect(mockListBrowserEventBacklog).toHaveBeenCalledWith("thread-1:0:0:turn_started");
    expect(body).toContain("id: thread-1:1:1:agent_message_delta");
    expect(body).toContain('"kind":"agent_message_delta"');
  });

  it("补发不可用时发送 timeline-gap 信号", async () => {
    mockListBrowserEventBacklog.mockReturnValue({
      events: [],
      gap: true,
      bootId: "boot-a",
      gapScope: { scope: "threads", affectedThreadIds: ["thread-1"] }
    });

    const { GET } = await import("../../src/app/api/codex/events/route");
    const abort = new AbortController();
    const response = await GET(
      new Request("http://localhost/api/codex/events?lastEventId=thread-1:9:9:agent_message_delta", { signal: abort.signal })
    );
    abort.abort();
    const body = await response.text();

    expect(mockListBrowserEventBacklog).toHaveBeenCalledWith("thread-1:9:9:agent_message_delta");
    expect(body).toContain('"type":"timeline-gap"');
    expect(body).toContain('"lastEventId":"thread-1:9:9:agent_message_delta"');
    expect(body).toContain('"threadId":"thread-1"');
  });

  it("无 cursor 时即使 backlog 有记录也发送 baseline-required 控制事件", async () => {
    mockListBrowserEventBacklog.mockReturnValue({
      events: [
        {
          type: "codex-event",
          event: {
            kind: "turn_started",
            threadId: "thread-1",
            turnId: "turn-1",
            eventId: "event-1"
          }
        }
      ],
      gap: false,
      bootId: "boot-a",
      streamCursor: 4,
      baselineRequired: true
    });

    const { GET } = await import("../../src/app/api/codex/events/route");
    const abort = new AbortController();
    const response = await GET(new Request("http://localhost/api/codex/events", { signal: abort.signal }));
    abort.abort();
    const body = await response.text();

    expect(body).toContain('"type":"timeline-baseline-required"');
    expect(body).toContain('"bootId":"boot-a"');
    expect(body).toContain('"streamCursor":4');
    expect(body).toContain('"kind":"turn_started"');
    expect(mockAudit).toHaveBeenCalledWith("timeline.stream.baseline_required", {
      bootId: "boot-a",
      streamCursor: 4,
      scope: "all-tracked"
    });
  });

  it("timeline gap 保留完整 affectedThreadIds", async () => {
    mockListBrowserEventBacklog.mockReturnValue({
      events: [],
      gap: true,
      bootId: "boot-a",
      gapScope: { scope: "threads", affectedThreadIds: ["thread-a", "thread-b"] }
    });

    const { GET } = await import("../../src/app/api/codex/events/route");
    const abort = new AbortController();
    const response = await GET(new Request("http://localhost/api/codex/events?lastEventId=old", { signal: abort.signal }));
    abort.abort();
    const body = await response.text();

    expect(body).toContain('"scope":"threads"');
    expect(body).toContain('"affectedThreadIds":["thread-a","thread-b"]');
    expect(body).not.toContain('"threadId":"old"');
  });

  it("owner ledger 不可恢复时发送 all-tracked barrier", async () => {
    mockListBrowserEventBacklog.mockReturnValue({
      events: [],
      gap: true,
      bootId: "boot-new",
      gapScope: { scope: "all-tracked" }
    });

    const { GET } = await import("../../src/app/api/codex/events/route");
    const abort = new AbortController();
    const response = await GET(new Request("http://localhost/api/codex/events?lastEventId=boot-old:event", { signal: abort.signal }));
    abort.abort();
    const body = await response.text();

    expect(body).toContain('"scope":"all-tracked"');
    expect(body).toContain('"bootId":"boot-new"');
  });

  it("定期发送 SSE heartbeat，避免代理空闲断开事件流", async () => {
    vi.useFakeTimers();
    const { GET } = await import("../../src/app/api/codex/events/route");
    const abort = new AbortController();
    const response = await GET(new Request("http://localhost/api/codex/events", { signal: abort.signal }));
    const reader = response.body?.getReader();
    expect(reader).toBeDefined();

    const decoder = new TextDecoder();
    const first = await reader!.read();
    expect(decoder.decode(first.value)).toContain(": connected");

    const heartbeat = reader!.read();
    await vi.advanceTimersByTimeAsync(15_000);
    abort.abort();
    const second = await heartbeat;

    expect(decoder.decode(second.value)).toContain(": ping");
  });

  it("先订阅实时事件再读取 backlog，避免重连窗口丢事件", async () => {
    const order: string[] = [];
    mockOnBrowserEvent.mockImplementation((handler: (event: unknown) => void) => {
      order.push("subscribe");
      handler({
        type: "codex-event",
        event: {
          kind: "agent_message_delta",
          threadId: "thread-1",
          turnId: "turn-1",
          itemId: "agent-live",
          delta: "live",
          eventId: "thread-1:2:2:agent_message_delta",
          sequence: 2,
          revision: 2
        }
      });
      return () => undefined;
    });
    mockListBrowserEventBacklog.mockImplementation(() => {
      order.push("backlog");
      return {
        gap: false,
        events: [
          {
            type: "codex-event",
            event: {
              kind: "agent_message_delta",
              threadId: "thread-1",
              turnId: "turn-1",
              itemId: "agent-replay",
              delta: "replay",
              eventId: "thread-1:1:1:agent_message_delta",
              sequence: 1,
              revision: 1
            }
          }
        ]
      };
    });

    const { GET } = await import("../../src/app/api/codex/events/route");
    const abort = new AbortController();
    const response = await GET(new Request("http://localhost/api/codex/events", { signal: abort.signal }));
    abort.abort();
    const body = await response.text();

    expect(order).toEqual(["subscribe", "backlog"]);
    expect(body).toContain("id: thread-1:1:1:agent_message_delta");
    expect(body).toContain("id: thread-1:2:2:agent_message_delta");
  });
});
