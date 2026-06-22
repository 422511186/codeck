import type { IncomingMessage, Server as HttpServer } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocketServer } from "ws";

export type BrowserEvent =
  | { type: "hello"; status: "connected" }
  | { type: "health"; appServer: "not_connected" };

type UpgradeHandler = (req: IncomingMessage, socket: Duplex, head: Buffer) => Promise<void>;

export function attachBrowserWebSocket(
  server: HttpServer,
  nextUpgradeHandler: UpgradeHandler
): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true });

  wss.on("connection", (socket) => {
    const events: BrowserEvent[] = [
      { type: "hello", status: "connected" },
      { type: "health", appServer: "not_connected" }
    ];

    for (const event of events) {
      socket.send(JSON.stringify(event));
    }
  });

  server.on("upgrade", (req, socket, head) => {
    const url = new URL(req.url || "/", "http://localhost");
    if (url.pathname === "/ws") {
      wss.handleUpgrade(req, socket, head, (client) => {
        wss.emit("connection", client, req);
      });
      return;
    }

    nextUpgradeHandler(req, socket, head).catch(() => {
      socket.destroy();
    });
  });

  return wss;
}
