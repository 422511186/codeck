import { afterEach, describe, expect, it, vi } from "vitest";
import { createReconnectingBrowserSocket, type BrowserSocketLike } from "../../src/lib/ws-client";

class FakeSocket implements BrowserSocketLike {
  readonly listeners = new Map<string, Array<(event: { data?: string }) => void>>();
  closed = false;

  addEventListener(type: string, listener: (event: { data?: string }) => void): void {
    this.listeners.set(type, [...(this.listeners.get(type) || []), listener]);
  }

  close(): void {
    this.closed = true;
  }

  emit(type: string, event: { data?: string } = {}): void {
    for (const listener of this.listeners.get(type) || []) {
      listener(event);
    }
  }
}

describe("createReconnectingBrowserSocket", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("断线后会回调离线并自动重连", async () => {
    vi.useFakeTimers();
    const sockets: FakeSocket[] = [];
    const onMessage = vi.fn();
    const onClose = vi.fn();
    const controller = createReconnectingBrowserSocket(
      {
        onMessage,
        onClose
      },
      {
        reconnectDelayMs: 10,
        createSocket: () => {
          const socket = new FakeSocket();
          sockets.push(socket);
          return socket;
        }
      }
    );

    expect(sockets).toHaveLength(1);
    sockets[0].emit("message", { data: "{\"type\":\"hello\"}" });
    expect(onMessage).toHaveBeenCalledWith({ type: "hello" });

    sockets[0].emit("close");
    expect(onClose).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(10);
    expect(sockets).toHaveLength(2);

    controller.close();
    expect(sockets[1].closed).toBe(true);
  });
});
