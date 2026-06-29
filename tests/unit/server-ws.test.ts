import { createServer } from "node:http";
import type { IncomingMessage } from "node:http";
import { Duplex } from "node:stream";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WebSocketServer } from "ws";
import { attachBrowserWebSocket } from "../../src/server/ws";

class FakeSocket extends Duplex {
  writes: string[] = [];

  _read(): void {}

  _write(chunk: Buffer, _encoding: BufferEncoding, callback: (error?: Error | null) => void): void {
    this.writes.push(chunk.toString("utf8"));
    callback();
  }
}

function createUpgradeRequest(url: string, cookie?: string): IncomingMessage {
  return {
    url,
    headers: { cookie }
  } as IncomingMessage;
}

function createOptions(isAuthenticated = true) {
  return {
    isAuthenticated: vi.fn(() => isAuthenticated),
    getAppServerStatus: vi.fn(() => ({ state: "ready" as const })),
    subscribeToAppServerEvents: vi.fn(() => vi.fn())
  };
}

describe("attachBrowserWebSocket", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("将非 /ws upgrade 请求转发给 Next.js handler", async () => {
    const server = createServer();
    const nextUpgradeHandler = vi.fn(async () => {});
    const options = createOptions();
    const socket = new FakeSocket();
    const head = Buffer.alloc(0);

    const wss = attachBrowserWebSocket(server, nextUpgradeHandler, options);
    server.emit("upgrade", createUpgradeRequest("/_next/webpack-hmr"), socket, head);
    await vi.waitFor(() => expect(nextUpgradeHandler).toHaveBeenCalledOnce());

    expect(nextUpgradeHandler).toHaveBeenCalledWith(expect.objectContaining({ url: "/_next/webpack-hmr" }), socket, head);
    expect(options.isAuthenticated).not.toHaveBeenCalled();

    wss.close();
    server.close();
  });

  it("拒绝未认证的 /ws upgrade 请求", () => {
    const server = createServer();
    const nextUpgradeHandler = vi.fn(async () => {});
    const options = createOptions(false);
    const socket = new FakeSocket();

    const wss = attachBrowserWebSocket(server, nextUpgradeHandler, options);
    server.emit("upgrade", createUpgradeRequest("/ws", undefined), socket, Buffer.alloc(0));

    expect(options.isAuthenticated).toHaveBeenCalledWith(undefined);
    expect(socket.writes).toContain("HTTP/1.1 401 Unauthorized\r\n\r\n");
    expect(socket.destroyed).toBe(true);
    expect(nextUpgradeHandler).not.toHaveBeenCalled();

    wss.close();
    server.close();
  });

  it("接受已认证的 /ws 连接并发送初始消息", async () => {
    const server = createServer();
    const nextUpgradeHandler = vi.fn(async () => {});
    const options = createOptions(true);
    const client = { send: vi.fn() };
    const handleUpgrade = vi.spyOn(WebSocketServer.prototype, "handleUpgrade").mockImplementation((req, _socket, _head, callback) => {
      callback(client as never, req);
    });
    const socket = new FakeSocket();
    const head = Buffer.alloc(0);

    const wss = attachBrowserWebSocket(server, nextUpgradeHandler, options);
    server.emit("upgrade", createUpgradeRequest("/ws", "session=valid"), socket, head);

    expect(handleUpgrade).toHaveBeenCalledWith(expect.objectContaining({ url: "/ws" }), socket, head, expect.any(Function));
    expect(client.send).toHaveBeenNthCalledWith(1, JSON.stringify({ type: "hello", status: "connected" }));
    expect(client.send).toHaveBeenNthCalledWith(
      2,
      JSON.stringify({
        type: "health",
        appServer: "ready"
      })
    );
    expect(options.isAuthenticated).toHaveBeenCalledWith("session=valid");
    expect(nextUpgradeHandler).not.toHaveBeenCalled();

    wss.close();
    server.close();
  });
});
