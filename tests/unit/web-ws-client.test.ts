import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WsClient, type WsEvent } from "../../src/web/ws/client";

class FakeSocket {
  static instances: FakeSocket[] = [];
  listeners: Record<string, ((event: any) => void)[]> = {};
  readyState = 0;
  closeCount = 0;

  constructor(public url: string) {
    FakeSocket.instances.push(this);
  }

  addEventListener(name: string, listener: (event: any) => void): void {
    (this.listeners[name] ??= []).push(listener);
  }

  close(): void {
    this.closeCount += 1;
    this.emit("close");
  }

  emit(name: string, payload?: any): void {
    for (const listener of this.listeners[name] ?? []) {
      listener(payload);
    }
  }

  emitOpen(): void {
    this.readyState = 1;
    this.emit("open");
  }

  emitMessage(data: unknown): void {
    this.emit("message", { data: typeof data === "string" ? data : JSON.stringify(data) });
  }
}

describe("WsClient", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    FakeSocket.instances = [];
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("dispatches parsed events to subscribers", () => {
    const client = new WsClient({
      url: "ws://x",
      autoConnect: false,
      createSocket: (url) => new FakeSocket(url) as unknown as WebSocket
    });
    client.connect();
    const received: WsEvent[] = [];
    const off = client.onEvent((event) => received.push(event));

    const socket = FakeSocket.instances[0]!;
    socket.emitOpen();
    socket.emitMessage({ type: "hello", status: "connected" });

    expect(received).toEqual([{ type: "hello", status: "connected" }]);
    off();
    socket.emitMessage({ type: "hello", status: "connected" });
    expect(received).toHaveLength(1);
  });

  it("auto-reconnects on close and resets retries on open", () => {
    const client = new WsClient({
      url: "ws://x",
      autoConnect: false,
      minBackoffMs: 100,
      maxBackoffMs: 1_000,
      createSocket: (url) => new FakeSocket(url) as unknown as WebSocket
    });
    client.connect();

    const first = FakeSocket.instances[0]!;
    first.emitOpen();
    expect(client.connectionState).toBe("open");

    first.emit("close");
    expect(client.connectionState).toBe("reconnecting");

    vi.advanceTimersByTime(150);
    expect(FakeSocket.instances).toHaveLength(2);
    const second = FakeSocket.instances[1]!;
    second.emitOpen();
    expect(client.connectionState).toBe("open");
  });

  it("does not reconnect after caller close()", () => {
    const client = new WsClient({
      url: "ws://x",
      autoConnect: false,
      createSocket: (url) => new FakeSocket(url) as unknown as WebSocket
    });
    client.connect();
    const first = FakeSocket.instances[0]!;
    first.emitOpen();

    client.close();
    expect(client.connectionState).toBe("closed");
    vi.advanceTimersByTime(60_000);
    expect(FakeSocket.instances).toHaveLength(1);
  });

  it("ignores malformed messages", () => {
    const client = new WsClient({
      url: "ws://x",
      autoConnect: false,
      createSocket: (url) => new FakeSocket(url) as unknown as WebSocket
    });
    client.connect();
    const received: WsEvent[] = [];
    client.onEvent((event) => received.push(event));
    const socket = FakeSocket.instances[0]!;
    socket.emitOpen();
    socket.emit("message", { data: "not-json" });
    expect(received).toEqual([]);
  });
});
