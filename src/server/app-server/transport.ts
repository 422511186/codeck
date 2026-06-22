import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createServer } from "node:net";
import { WebSocket } from "ws";
import type { AppServerConfig } from "../../config/env";
import { JsonRpcPeer } from "./json-rpc";
import type { AppServerPeer } from "./client";
import type { AppServerNotificationMessage } from "./events";

export type AppServerStatus =
  | { state: "disabled" }
  | { state: "idle" }
  | { state: "starting" }
  | { state: "connecting" }
  | { state: "ready" }
  | { state: "error"; message: string };

export type ManagedAppServerPeer = AppServerPeer & {
  connect(): Promise<void>;
  close(): void;
  getStatus(): AppServerStatus;
  onNotification(handler: (message: AppServerNotificationMessage) => void): () => void;
};

async function findAvailablePort(host: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, host, () => {
      const address = server.address();
      server.close(() => {
        if (typeof address === "object" && address) {
          resolve(address.port);
        } else {
          reject(new Error("无法分配 app-server 端口"));
        }
      });
    });
  });
}

export class WebSocketAppServerPeer implements ManagedAppServerPeer {
  private socket: WebSocket | null = null;
  private rpc: JsonRpcPeer | null = null;
  private status: AppServerStatus = { state: "idle" };
  private connecting: Promise<void> | null = null;
  private readonly notificationHandlers = new Set<(message: AppServerNotificationMessage) => void>();

  constructor(protected url: string) {}

  getStatus(): AppServerStatus {
    return this.status;
  }

  onNotification(handler: (message: AppServerNotificationMessage) => void): () => void {
    this.notificationHandlers.add(handler);
    return () => this.notificationHandlers.delete(handler);
  }

  connect(): Promise<void> {
    if (this.status.state === "ready") {
      return Promise.resolve();
    }

    if (this.connecting) {
      return this.connecting;
    }

    this.connecting = this.connectWithRetry();
    return this.connecting;
  }

  private async connectWithRetry(): Promise<void> {
    const deadline = Date.now() + 10_000;
    let lastError: Error | null = null;

    while (Date.now() < deadline) {
      try {
        this.status = { state: "connecting" };
        await this.openSocket();
        return;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }

    this.connecting = null;
    this.status = { state: "error", message: lastError?.message || "连接 app-server 超时" };
    throw lastError || new Error("连接 app-server 超时");
  }

  private openSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(this.url);
      const timeout = setTimeout(() => {
        socket.close();
        reject(new Error("连接 app-server 超时"));
      }, 2_000);

      socket.once("open", () => {
        clearTimeout(timeout);
        this.socket = socket;
        this.rpc = new JsonRpcPeer((message) => socket.send(message));
        this.rpc.onNotification((message) => {
          for (const handler of this.notificationHandlers) {
            handler(message);
          }
        });
        this.status = { state: "ready" };
        resolve();
      });

      socket.on("message", (data) => {
        this.rpc?.handleMessage(data.toString());
      });

      socket.once("close", () => {
        if (this.status.state === "ready") {
          this.status = { state: "idle" };
        }
        this.socket = null;
        this.rpc = null;
        this.connecting = null;
      });

      socket.once("error", (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  async request(method: string, params: unknown): Promise<unknown> {
    await this.connect();
    if (!this.rpc) {
      throw new Error("app-server 尚未连接");
    }

    return this.rpc.request(method, params);
  }

  close(): void {
    this.socket?.close();
    this.socket = null;
    this.rpc = null;
    this.status = { state: "idle" };
    this.connecting = null;
  }
}

class SpawnedAppServerPeer extends WebSocketAppServerPeer {
  private child: ChildProcessWithoutNullStreams | null = null;
  private started = false;

  constructor(
    private readonly config: Extract<AppServerConfig, { mode: "spawn" }>,
    private endpointUrl = ""
  ) {
    super(endpointUrl);
  }

  override async connect(): Promise<void> {
    if (!this.started) {
      const port = this.config.port ?? (await findAvailablePort(this.config.host));
      this.endpointUrl = `ws://${this.config.host}:${port}`;
      this.url = this.endpointUrl;
      this.child = spawn(this.config.codexBin, ["app-server", "--listen", this.endpointUrl], {
        windowsHide: true,
        env: process.env
      });
      this.child.stderr.on("data", (chunk) => {
        console.error(`codex app-server: ${chunk.toString().trim()}`);
      });
      this.started = true;
    }

    return super.connect();
  }

  override close(): void {
    super.close();
    this.child?.kill();
    this.child = null;
    this.started = false;
  }
}

export function createManagedAppServerPeer(config: AppServerConfig): ManagedAppServerPeer {
  if (config.mode === "external") {
    return new WebSocketAppServerPeer(config.url);
  }

  if (config.mode === "spawn") {
    return new SpawnedAppServerPeer(config);
  }

  throw new Error(`不支持的真实 app-server 模式: ${config.mode}`);
}
