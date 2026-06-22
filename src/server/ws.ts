import type { Server as HttpServer } from "node:http";
import { WebSocketServer } from "ws";

export type BrowserEvent =
  | { type: "hello"; status: "connected" }
  | { type: "health"; appServer: "not_connected" };

export function attachBrowserWebSocket(server: HttpServer): WebSocketServer {
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (socket) => {
    const events: BrowserEvent[] = [
      { type: "hello", status: "connected" },
      { type: "health", appServer: "not_connected" }
    ];

    for (const event of events) {
      socket.send(JSON.stringify(event));
    }
  });

  return wss;
}
