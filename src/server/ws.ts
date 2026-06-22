import type { IncomingMessage, Server as HttpServer } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocketServer } from "ws";
import type { AppServerStatus } from "./app-server/transport";

export type BrowserEvent =
  | { type: "hello"; status: "connected" }
  | { type: "health"; appServer: AppServerStatus["state"]; detail?: string };

type UpgradeHandler = (req: IncomingMessage, socket: Duplex, head: Buffer) => Promise<void>;
type BrowserWebSocketOptions = {
  isAuthenticated(cookie: string | undefined): boolean;
  getAppServerStatus(): AppServerStatus;
};

export function attachBrowserWebSocket(
  server: HttpServer,
  nextUpgradeHandler: UpgradeHandler,
  options: BrowserWebSocketOptions
): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true });

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
