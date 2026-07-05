import { spawn, type ChildProcessWithoutNullStreams, type SpawnOptionsWithoutStdio } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { join } from "node:path";
import { WebSocket } from "ws";
import type { AppServerConfig } from "../../config/env";
import { JsonRpcPeer } from "./json-rpc";
import type { AppServerPeer } from "./client";
import type { AppServerNotificationMessage } from "./events";
import type { AppServerServerRequestMessage } from "./pending-requests";

export type AppServerErrorKind =
  | "timeout"
  | "unavailable"
  | "handshake-failed"
  | "startup-failed"
  | "lock-timeout"
  | "stale-lock";

export type AppServerStatusDiagnostics = {
  mode?: AppServerConfig["mode"];
  managedByCurrentProcess?: boolean;
  reusedExisting?: boolean;
  pidKnown?: boolean;
  errorKind?: AppServerErrorKind;
  cleanupState?: "none" | "child-terminated" | "metadata-cleared" | "stale-lock-cleared";
};

export type AppServerStatus = (
  | { state: "disabled" }
  | { state: "idle" }
  | { state: "starting" }
  | { state: "connecting" }
  | { state: "ready" }
  | { state: "error"; message: string }
) &
  AppServerStatusDiagnostics;

export type AppServerEndpointProbeResult =
  | { ok: true }
  | { ok: false; reason: "unavailable" | "timeout" | "handshake-failed" };

export type AppServerLockMetadata = {
  endpointUrl: string;
  ownerPid: number;
  startedAtMs: number;
  managedByCurrentProcess: boolean;
  childPid?: number;
};

export type AppServerLockLease = {
  update(metadata: AppServerLockMetadata): Promise<void>;
  release(): Promise<void>;
};

export type AppServerLockStore = {
  read(key: string): Promise<AppServerLockMetadata | null>;
  tryAcquire(key: string, metadata: AppServerLockMetadata): Promise<AppServerLockLease | null>;
  remove(key: string): Promise<void>;
};

export type AppServerTransportDependencies = {
  createWebSocketPeer?: (url: string) => ManagedAppServerPeer;
  spawnProcess?: (
    command: string,
    args: string[],
    options: SpawnOptionsWithoutStdio
  ) => ChildProcessWithoutNullStreams;
  probeEndpoint?: (url: string) => Promise<AppServerEndpointProbeResult>;
  findAvailablePort?: (host: string) => Promise<number>;
  lockStore?: AppServerLockStore;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  pid?: number;
  isPidAlive?: (pid: number) => boolean;
  registerProcessCleanup?: (cleanup: () => void) => () => void;
};

export type ManagedAppServerPeer = AppServerPeer & {
  connect(): Promise<void>;
  close(): void;
  getStatus(): AppServerStatus;
  onNotification(handler: (message: AppServerNotificationMessage) => void): () => void;
  onServerRequest(handler: (message: AppServerServerRequestMessage) => void): () => void;
  notify(method: string, params?: unknown): Promise<void>;
  respondToServerRequest(id: number, result: unknown): Promise<void>;
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

function sanitizeErrorMessage(message: string): string {
  return message.replace(/\b(?:wss?|https?):\/\/[^\s'"<>]+/gi, "[app-server-url]");
}

export function sanitizeAppServerStatus(status: AppServerStatus): AppServerStatus {
  if (status.state !== "error") {
    return status;
  }

  return {
    ...status,
    message: sanitizeErrorMessage(status.message)
  };
}

function appServerEndpointUrl(host: string, port: number): string {
  return `ws://${host}:${port}`;
}

function appServerLockKey(host: string, port: number): string {
  return `${host}-${port}`.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

function defaultIsPidAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) {
    return false;
  }

  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return isNodeError(error) && error.code === "EPERM";
  }
}

function defaultRegisterProcessCleanup(cleanup: () => void): () => void {
  let cleaned = false;
  const runCleanup = () => {
    if (cleaned) {
      return;
    }
    cleaned = true;
    cleanup();
  };
  const onSigint = () => {
    runCleanup();
    process.exit(130);
  };
  const onSigterm = () => {
    runCleanup();
    process.exit(143);
  };

  process.once("exit", runCleanup);
  process.once("SIGINT", onSigint);
  process.once("SIGTERM", onSigterm);

  return () => {
    process.off("exit", runCleanup);
    process.off("SIGINT", onSigint);
    process.off("SIGTERM", onSigterm);
  };
}

class FileAppServerLockStore implements AppServerLockStore {
  constructor(private readonly stateDir: string) {}

  async read(key: string): Promise<AppServerLockMetadata | null> {
    try {
      const raw = await readFile(this.metadataPath(key), "utf8");
      const parsed = JSON.parse(raw) as Partial<AppServerLockMetadata>;
      if (
        typeof parsed.endpointUrl !== "string" ||
        typeof parsed.ownerPid !== "number" ||
        typeof parsed.startedAtMs !== "number"
      ) {
        return null;
      }

      return {
        endpointUrl: parsed.endpointUrl,
        ownerPid: parsed.ownerPid,
        startedAtMs: parsed.startedAtMs,
        managedByCurrentProcess: parsed.managedByCurrentProcess === true,
        ...(typeof parsed.childPid === "number" ? { childPid: parsed.childPid } : {})
      };
    } catch (error) {
      if (isNodeError(error) && error.code === "ENOENT") {
        return null;
      }
      return null;
    }
  }

  async tryAcquire(key: string, metadata: AppServerLockMetadata): Promise<AppServerLockLease | null> {
    await mkdir(this.stateDir, { recursive: true });
    const lockDir = this.lockDir(key);
    try {
      await mkdir(lockDir);
    } catch (error) {
      if (isNodeError(error) && error.code === "EEXIST") {
        return null;
      }
      throw error;
    }

    await this.writeMetadata(key, metadata);
    return {
      update: async (next) => {
        await this.writeMetadata(key, next);
      },
      release: async () => {
        const current = await this.read(key);
        if (current?.ownerPid === metadata.ownerPid) {
          await this.remove(key);
        }
      }
    };
  }

  async remove(key: string): Promise<void> {
    await rm(this.lockDir(key), { recursive: true, force: true });
  }

  private async writeMetadata(key: string, metadata: AppServerLockMetadata): Promise<void> {
    await writeFile(this.metadataPath(key), `${JSON.stringify(metadata, null, 2)}\n`, "utf8");
  }

  private lockDir(key: string): string {
    return join(this.stateDir, `${key}.lock`);
  }

  private metadataPath(key: string): string {
    return join(this.lockDir(key), "metadata.json");
  }
}

function classifyProbeError(error: Error): AppServerEndpointProbeResult {
  const message = error.message.toLowerCase();
  const code = isNodeError(error) ? error.code : undefined;

  if (code === "ECONNREFUSED" || code === "ENOTFOUND" || code === "EHOSTUNREACH" || code === "ENETUNREACH") {
    return { ok: false, reason: "unavailable" };
  }
  if (message.includes("timeout")) {
    return { ok: false, reason: "timeout" };
  }
  if (message.includes("unexpected server response") || message.includes("socket hang up")) {
    return { ok: false, reason: "handshake-failed" };
  }

  return { ok: false, reason: "handshake-failed" };
}

function probeAppServerEndpoint(url: string): Promise<AppServerEndpointProbeResult> {
  return new Promise((resolve) => {
    const socket = new WebSocket(url);
    const timeout = setTimeout(() => {
      socket.close();
      resolve({ ok: false, reason: "timeout" });
    }, 500);

    socket.once("open", () => {
      clearTimeout(timeout);
      socket.close();
      resolve({ ok: true });
    });

    socket.once("error", (error) => {
      clearTimeout(timeout);
      resolve(classifyProbeError(error));
    });
  });
}

function createDefaultTransportDependencies(config: AppServerConfig): Required<AppServerTransportDependencies> {
  return {
    createWebSocketPeer: (url) => new WebSocketAppServerPeer(url),
    spawnProcess: (command, args, options) =>
      spawn(/*turbopackIgnore: true*/ command, args, options) as ChildProcessWithoutNullStreams,
    probeEndpoint: probeAppServerEndpoint,
    findAvailablePort,
    lockStore:
      config.mode === "spawn-or-connect"
        ? new FileAppServerLockStore(config.stateDir)
        : new FileAppServerLockStore(join(process.cwd(), ".codex-web-app-server-unused")),
    now: () => Date.now(),
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    pid: process.pid,
    isPidAlive: defaultIsPidAlive,
    registerProcessCleanup: defaultRegisterProcessCleanup
  };
}

function mergeTransportDependencies(
  config: AppServerConfig,
  overrides: AppServerTransportDependencies = {}
): Required<AppServerTransportDependencies> {
  return {
    ...createDefaultTransportDependencies(config),
    ...overrides
  };
}

export function createAppServerSpawnInvocation(
  codexBin: string,
  args: string[],
  platform: NodeJS.Platform = process.platform
): { command: string; args: string[] } {
  if (platform === "win32" && !/\.(exe|cmd|bat)$/i.test(codexBin)) {
    return {
      command: "powershell.exe",
      args: ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", codexBin, ...args]
    };
  }

  return { command: codexBin, args };
}

export class WebSocketAppServerPeer implements ManagedAppServerPeer {
  private socket: WebSocket | null = null;
  private rpc: JsonRpcPeer | null = null;
  private status: AppServerStatus;
  private connecting: Promise<void> | null = null;
  private readonly notificationHandlers = new Set<(message: AppServerNotificationMessage) => void>();
  private readonly serverRequestHandlers = new Set<(message: AppServerServerRequestMessage) => void>();

  constructor(
    protected url: string,
    private readonly diagnostics: AppServerStatusDiagnostics = {}
  ) {
    this.status = this.withDiagnostics({ state: "idle" });
  }

  getStatus(): AppServerStatus {
    return sanitizeAppServerStatus(this.status);
  }

  onNotification(handler: (message: AppServerNotificationMessage) => void): () => void {
    this.notificationHandlers.add(handler);
    return () => this.notificationHandlers.delete(handler);
  }

  onServerRequest(handler: (message: AppServerServerRequestMessage) => void): () => void {
    this.serverRequestHandlers.add(handler);
    return () => this.serverRequestHandlers.delete(handler);
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
        this.status = this.withDiagnostics({ state: "connecting" });
        await this.openSocket();
        return;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }

    this.connecting = null;
    this.status = this.withDiagnostics({
      state: "error",
      message: lastError?.message || "连接 app-server 超时",
      errorKind: "timeout"
    });
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
        this.rpc.onServerRequest((message) => {
          for (const handler of this.serverRequestHandlers) {
            handler(message);
          }
        });
        this.status = this.withDiagnostics({ state: "ready" });
        resolve();
      });

      socket.on("message", (data) => {
        this.rpc?.handleMessage(data.toString());
      });

      socket.once("close", () => {
        this.rpc?.failPendingRequests(new Error("app-server disconnected"));
        if (this.status.state === "ready") {
          this.status = this.withDiagnostics({ state: "idle" });
        }
        this.socket = null;
        this.rpc = null;
        this.connecting = null;
      });

      socket.once("error", (error) => {
        clearTimeout(timeout);
        this.rpc?.failPendingRequests(error instanceof Error ? error : new Error("app-server WebSocket error"));
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

  async notify(method: string, params?: unknown): Promise<void> {
    await this.connect();
    if (!this.rpc) {
      throw new Error("app-server 尚未连接");
    }

    this.rpc.notify(method, params);
  }

  async respondToServerRequest(id: number, result: unknown): Promise<void> {
    await this.connect();
    if (!this.rpc) {
      throw new Error("app-server 尚未连接");
    }

    this.rpc.respond(id, result);
  }

  close(): void {
    this.rpc?.failPendingRequests(new Error("app-server disconnected"));
    this.socket?.close();
    this.socket = null;
    this.rpc = null;
    this.status = this.withDiagnostics({ state: "idle" });
    this.connecting = null;
  }

  private withDiagnostics(status: AppServerStatus): AppServerStatus {
    return {
      ...status,
      ...this.diagnostics,
      ...(status.state === "error" && status.errorKind ? { errorKind: status.errorKind } : {})
    };
  }
}

class ManagedAppServerPeerWrapper implements ManagedAppServerPeer {
  protected delegate: ManagedAppServerPeer | null = null;
  protected status: AppServerStatus;
  private readonly notificationHandlers = new Set<(message: AppServerNotificationMessage) => void>();
  private readonly serverRequestHandlers = new Set<(message: AppServerServerRequestMessage) => void>();
  private delegateUnsubscribers: Array<() => void> = [];

  constructor(protected diagnostics: AppServerStatusDiagnostics) {
    this.status = this.withDiagnostics({ state: "idle" });
  }

  connect(): Promise<void> {
    return Promise.reject(new Error("app-server 连接未配置"));
  }

  getStatus(): AppServerStatus {
    if (this.delegate && this.status.state === "ready") {
      const delegateStatus = this.delegate.getStatus();
      if (delegateStatus.state !== "ready") {
        return sanitizeAppServerStatus(this.withDiagnostics(delegateStatus));
      }
    }

    return sanitizeAppServerStatus(this.status);
  }

  onNotification(handler: (message: AppServerNotificationMessage) => void): () => void {
    this.notificationHandlers.add(handler);
    return () => this.notificationHandlers.delete(handler);
  }

  onServerRequest(handler: (message: AppServerServerRequestMessage) => void): () => void {
    this.serverRequestHandlers.add(handler);
    return () => this.serverRequestHandlers.delete(handler);
  }

  async request(method: string, params: unknown): Promise<unknown> {
    await this.connect();
    return this.requireDelegate().request(method, params);
  }

  async notify(method: string, params?: unknown): Promise<void> {
    await this.connect();
    return this.requireDelegate().notify(method, params);
  }

  async respondToServerRequest(id: number, result: unknown): Promise<void> {
    await this.connect();
    return this.requireDelegate().respondToServerRequest(id, result);
  }

  close(): void {
    this.delegate?.close();
    this.setStatus({ state: "idle" });
  }

  protected setDelegate(delegate: ManagedAppServerPeer): void {
    if (this.delegate === delegate) {
      return;
    }

    for (const unsubscribe of this.delegateUnsubscribers) {
      unsubscribe();
    }
    this.delegateUnsubscribers = [
      delegate.onNotification((message) => {
        for (const handler of this.notificationHandlers) {
          handler(message);
        }
      }),
      delegate.onServerRequest((message) => {
        for (const handler of this.serverRequestHandlers) {
          handler(message);
        }
      })
    ];
    this.delegate = delegate;
  }

  protected setDiagnostics(diagnostics: AppServerStatusDiagnostics): void {
    this.diagnostics = {
      ...this.diagnostics,
      ...diagnostics
    };
    this.status = this.withDiagnostics(this.status);
  }

  protected setStatus(status: AppServerStatus): void {
    this.status = this.withDiagnostics(status);
  }

  protected async connectDelegate(delegate: ManagedAppServerPeer): Promise<void> {
    this.setDelegate(delegate);
    this.setStatus({ state: "connecting" });
    try {
      await delegate.connect();
      this.setStatus({ state: "ready" });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.setStatus({ state: "error", message, errorKind: "startup-failed" });
      throw error;
    }
  }

  private requireDelegate(): ManagedAppServerPeer {
    if (!this.delegate) {
      throw new Error("app-server 尚未连接");
    }
    return this.delegate;
  }

  private withDiagnostics(status: AppServerStatus): AppServerStatus {
    return {
      ...status,
      ...this.diagnostics,
      ...(status.state === "error" && status.errorKind ? { errorKind: status.errorKind } : {})
    };
  }
}

class ExternalAppServerPeer extends ManagedAppServerPeerWrapper {
  private connecting: Promise<void> | null = null;

  constructor(
    private readonly url: string,
    private readonly deps: Required<AppServerTransportDependencies>
  ) {
    super({ mode: "external", managedByCurrentProcess: false, reusedExisting: true, pidKnown: false });
  }

  override connect(): Promise<void> {
    if (this.getStatus().state === "ready") {
      return Promise.resolve();
    }
    if (!this.connecting) {
      this.connecting = this.connectDelegate(this.deps.createWebSocketPeer(this.url)).finally(() => {
        if (this.getStatus().state !== "ready") {
          this.connecting = null;
        }
      });
    }
    return this.connecting;
  }
}

class SpawnedAppServerPeer extends ManagedAppServerPeerWrapper {
  private child: ChildProcessWithoutNullStreams | null = null;
  private started = false;
  private connecting: Promise<void> | null = null;
  private unregisterCleanup: (() => void) | null = null;

  constructor(
    private readonly config: Extract<AppServerConfig, { mode: "spawn" }>,
    private readonly deps: Required<AppServerTransportDependencies>
  ) {
    super({ mode: "spawn", managedByCurrentProcess: false, reusedExisting: false, pidKnown: false });
  }

  override connect(): Promise<void> {
    if (this.getStatus().state === "ready") {
      return Promise.resolve();
    }
    if (!this.connecting) {
      this.connecting = this.connectSpawned().finally(() => {
        if (this.getStatus().state !== "ready") {
          this.connecting = null;
        }
      });
    }
    return this.connecting;
  }

  private async connectSpawned(): Promise<void> {
    if (!this.started) {
      const port = this.config.port ?? (await this.deps.findAvailablePort(this.config.host));
      const endpointUrl = appServerEndpointUrl(this.config.host, port);
      this.startOwnedChild(endpointUrl);
      this.setDelegate(this.deps.createWebSocketPeer(endpointUrl));
    }

    await this.connectDelegate(this.requireStartedDelegate());
  }

  override close(): void {
    super.close();
    this.unregisterCleanup?.();
    this.unregisterCleanup = null;
    if (this.child) {
      this.child.kill();
    }
    this.child = null;
    this.started = false;
    this.connecting = null;
    this.setDiagnostics({ managedByCurrentProcess: false, pidKnown: false, cleanupState: "child-terminated" });
  }

  private startOwnedChild(endpointUrl: string): void {
    this.setStatus({ state: "starting" });
    const invocation = createAppServerSpawnInvocation(this.config.codexBin, ["app-server", "--listen", endpointUrl]);
    this.child = this.deps.spawnProcess(invocation.command, invocation.args, {
      windowsHide: true,
      env: process.env
    });
    this.child.stderr.on("data", (chunk) => {
      console.error(`codex app-server: ${chunk.toString().trim()}`);
    });
    this.unregisterCleanup = this.deps.registerProcessCleanup(() => this.close());
    this.started = true;
    this.setDiagnostics({
      managedByCurrentProcess: true,
      reusedExisting: false,
      pidKnown: typeof this.child.pid === "number",
      cleanupState: "none"
    });
  }

  private requireStartedDelegate(): ManagedAppServerPeer {
    if (!this.delegate) {
      throw new Error("app-server 尚未连接");
    }
    return this.delegate;
  }
}

class SpawnOrConnectAppServerPeer extends ManagedAppServerPeerWrapper {
  private child: ChildProcessWithoutNullStreams | null = null;
  private started = false;
  private connecting: Promise<void> | null = null;
  private lease: AppServerLockLease | null = null;
  private unregisterCleanup: (() => void) | null = null;

  constructor(
    private readonly config: Extract<AppServerConfig, { mode: "spawn-or-connect" }>,
    private readonly deps: Required<AppServerTransportDependencies>
  ) {
    super({ mode: "spawn-or-connect", managedByCurrentProcess: false, reusedExisting: false, pidKnown: false });
  }

  override connect(): Promise<void> {
    if (this.getStatus().state === "ready") {
      return Promise.resolve();
    }
    if (!this.connecting) {
      this.connecting = this.connectAuto().finally(() => {
        if (this.getStatus().state !== "ready") {
          this.connecting = null;
        }
      });
    }
    return this.connecting;
  }

  override close(): void {
    super.close();
    this.unregisterCleanup?.();
    this.unregisterCleanup = null;
    if (this.child) {
      this.child.kill();
    }
    this.child = null;
    this.started = false;
    this.connecting = null;
    if (this.lease) {
      void this.lease.release();
      this.lease = null;
    }
    this.setDiagnostics({
      managedByCurrentProcess: false,
      pidKnown: false,
      cleanupState: "metadata-cleared"
    });
  }

  private async connectAuto(): Promise<void> {
    const port = this.config.port ?? (await this.deps.findAvailablePort(this.config.host));
    const endpointUrl = appServerEndpointUrl(this.config.host, port);

    if (this.config.port !== null) {
      await this.clearStaleLockIfNeeded(port);
      const probe = await this.deps.probeEndpoint(endpointUrl);
      if (probe.ok) {
        await this.connectExisting(endpointUrl);
        return;
      }
      if (probe.reason === "handshake-failed") {
        this.fail("固定 app-server 端口已被占用或握手失败，请检查 CODEX_WEB_APP_SERVER_PORT", "handshake-failed");
      }
    }

    if (this.config.port === null) {
      await this.startOwned(endpointUrl, null);
      return;
    }

    await this.startOrWaitForOwner(port, endpointUrl);
  }

  private async startOrWaitForOwner(port: number, endpointUrl: string): Promise<void> {
    const key = appServerLockKey(this.config.host, port);
    const deadline = this.deps.now() + 10_000;

    while (this.deps.now() <= deadline) {
      const metadata = await this.deps.lockStore.read(key);
      if (metadata && !this.deps.isPidAlive(metadata.ownerPid)) {
        await this.deps.lockStore.remove(key);
        this.setDiagnostics({ cleanupState: "stale-lock-cleared" });
      }

      const lease = await this.deps.lockStore.tryAcquire(key, {
        endpointUrl,
        ownerPid: this.deps.pid,
        startedAtMs: this.deps.now(),
        managedByCurrentProcess: true
      });
      if (lease) {
        this.lease = lease;
        await this.startOwned(endpointUrl, lease);
        return;
      }

      const probe = await this.deps.probeEndpoint(endpointUrl);
      if (probe.ok) {
        await this.connectExisting(endpointUrl);
        return;
      }
      if (probe.reason === "handshake-failed") {
        this.fail("固定 app-server 端口已被占用或握手失败，请检查 CODEX_WEB_APP_SERVER_PORT", "handshake-failed");
      }

      await this.deps.sleep(100);
    }

    this.fail("等待 app-server 启动锁释放超时", "lock-timeout");
  }

  private async startOwned(endpointUrl: string, lease: AppServerLockLease | null): Promise<void> {
    this.setStatus({ state: "starting" });
    const invocation = createAppServerSpawnInvocation(this.config.codexBin, ["app-server", "--listen", endpointUrl]);
    this.child = this.deps.spawnProcess(invocation.command, invocation.args, {
      windowsHide: true,
      env: process.env
    });
    this.child.stderr.on("data", (chunk) => {
      console.error(`codex app-server: ${chunk.toString().trim()}`);
    });
    this.unregisterCleanup = this.deps.registerProcessCleanup(() => this.close());
    this.started = true;
    this.setDiagnostics({
      managedByCurrentProcess: true,
      reusedExisting: false,
      pidKnown: typeof this.child.pid === "number",
      cleanupState: "none"
    });

    if (lease) {
      await lease.update({
        endpointUrl,
        ownerPid: this.deps.pid,
        startedAtMs: this.deps.now(),
        managedByCurrentProcess: true,
        ...(typeof this.child.pid === "number" ? { childPid: this.child.pid } : {})
      });
    }

    this.setDelegate(this.deps.createWebSocketPeer(endpointUrl));
    await this.connectDelegate(this.getCurrentDelegate());
  }

  private async connectExisting(endpointUrl: string): Promise<void> {
    this.setDiagnostics({
      managedByCurrentProcess: false,
      reusedExisting: true,
      pidKnown: false,
      cleanupState: "none"
    });
    this.setDelegate(this.deps.createWebSocketPeer(endpointUrl));
    await this.connectDelegate(this.getCurrentDelegate());
  }

  private async clearStaleLockIfNeeded(port: number): Promise<void> {
    const key = appServerLockKey(this.config.host, port);
    const metadata = await this.deps.lockStore.read(key);
    if (metadata && !this.deps.isPidAlive(metadata.ownerPid)) {
      await this.deps.lockStore.remove(key);
      this.setDiagnostics({ cleanupState: "stale-lock-cleared" });
    }
  }

  private fail(message: string, errorKind: AppServerErrorKind): never {
    this.setStatus({ state: "error", message, errorKind });
    throw new Error(message);
  }

  private getCurrentDelegate(): ManagedAppServerPeer {
    if (!this.delegate) {
      throw new Error("app-server 尚未连接");
    }
    return this.delegate;
  }
}

export function createManagedAppServerPeer(
  config: AppServerConfig,
  depsOverrides: AppServerTransportDependencies = {}
): ManagedAppServerPeer {
  const deps = mergeTransportDependencies(config, depsOverrides);

  if (config.mode === "external") {
    return new ExternalAppServerPeer(config.url, deps);
  }

  if (config.mode === "spawn") {
    return new SpawnedAppServerPeer(config, deps);
  }

  if (config.mode === "spawn-or-connect") {
    return new SpawnOrConnectAppServerPeer(config, deps);
  }

  throw new Error(`不支持的真实 app-server 模式: ${config.mode}`);
}
