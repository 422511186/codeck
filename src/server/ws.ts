import type { IncomingMessage, Server as HttpServer } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocketServer } from "ws";
import type { BrowserCodexEventEnvelope } from "./app-server/events";
import type { AppServerStatus } from "./app-server/transport";

export type BrowserEvent =
  | { type: "hello"; status: "connected" }
  | { type: "health"; appServer: AppServerStatus["state"]; detail?: string }
  | BrowserCodexEventEnvelope;

type UpgradeHandler = (req: IncomingMessage, socket: Duplex, head: Buffer) => Promise<void>;
type BrowserWebSocketOptions = {
  isAuthenticated(cookie: string | undefined): boolean;
  getAppServerStatus(): AppServerStatus;
  subscribeToAppServerEvents(handler: (event: BrowserCodexEventEnvelope) => void): () => void;
};

export function attachBrowserWebSocket(
  server: HttpServer,
  nextUpgradeHandler: UpgradeHandler,
  options: BrowserWebSocketOptions
): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true });
  const unsubscribe = options.subscribeToAppServerEvents((event) => {
    const payload = JSON.stringify(event);
    for (const client of wss.clients) {
      if (client.readyState === client.OPEN) {
        client.send(payload);
      }
    }
  });

  wss.on("close", unsubscribe);

  wss.on("connection", (socket) => {
    const appServerStatus = options.getAppServerStatus();
    const events: BrowserEvent[] = [
      { type: "hello", status: "connected" },
      {
        type: "health",
        appServer: appServerStatus.state,
        detail: appServerStatus.state === "error" ? appServerStatus.message : undefined
      }
    ];

    for (const event of events) {
      socket.send(JSON.stringify(event));
    }
  });

  server.on("upgrade", (req, socket, head) => {
    const url = new URL(req.url || "/", "http://localhost");
    if (url.pathname === "/ws") {
      if (!options.isAuthenticated(req.headers.cookie)) {
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
        return;
      }

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
