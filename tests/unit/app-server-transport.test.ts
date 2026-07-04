import { EventEmitter } from "node:events";
import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { describe, expect, it, vi } from "vitest";
import {
  createAppServerSpawnInvocation,
  createManagedAppServerPeer,
  sanitizeAppServerStatus,
  type AppServerLockLease,
  type AppServerLockMetadata,
  type AppServerLockStore,
  type AppServerTransportDependencies,
  type ManagedAppServerPeer
} from "../../src/server/app-server/transport";

describe("createAppServerSpawnInvocation", () => {
  it("Windows 下通过 PowerShell 启动 codex shim", () => {
    expect(createAppServerSpawnInvocation("codex", ["app-server"], "win32")).toEqual({
      command: "powershell.exe",
      args: ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", "codex", "app-server"]
    });
  });

  it("非 Windows 直接启动 codex", () => {
    expect(createAppServerSpawnInvocation("codex", ["app-server"], "linux")).toEqual({
      command: "codex",
      args: ["app-server"]
    });
  });
});

class FakePeer implements ManagedAppServerPeer {
  connectCalls = 0;
  closeCalls = 0;

  constructor(private readonly connectError: Error | null = null) {}

  async connect(): Promise<void> {
    this.connectCalls += 1;
    if (this.connectError) {
      throw this.connectError;
    }
  }

  getStatus() {
    return { state: "ready" as const };
  }

  onNotification(): () => void {
    return () => undefined;
  }

  onServerRequest(): () => void {
    return () => undefined;
  }

  notify(): Promise<void> {
    return Promise.resolve();
  }

  respondToServerRequest(): Promise<void> {
    return Promise.resolve();
  }

  close(): void {
    this.closeCalls += 1;
  }

  request(): Promise<unknown> {
    return Promise.resolve(null);
  }
}

class MemoryLockStore implements AppServerLockStore {
  metadata: AppServerLockMetadata | null;
  removeCount = 0;

  constructor(initialMetadata: AppServerLockMetadata | null = null) {
    this.metadata = initialMetadata;
  }

  async read(): Promise<AppServerLockMetadata | null> {
    return this.metadata;
  }

  async tryAcquire(_key: string, metadata: AppServerLockMetadata): Promise<AppServerLockLease | null> {
    if (this.metadata) {
      return null;
    }

    this.metadata = metadata;
    return {
      update: async (next) => {
        this.metadata = next;
      },
      release: async () => {
        if (this.metadata?.ownerPid === metadata.ownerPid) {
          this.metadata = null;
        }
      }
    };
  }

  async remove(): Promise<void> {
    this.removeCount += 1;
    this.metadata = null;
  }
}

function createFakeChild(pid = 4242): ChildProcessWithoutNullStreams {
  return {
    pid,
    stderr: new EventEmitter(),
    kill: vi.fn()
  } as unknown as ChildProcessWithoutNullStreams;
}

function createTransportDeps(overrides: Partial<AppServerTransportDependencies> = {}) {
  const child = createFakeChild();
  const peers: FakePeer[] = [];
  const deps: AppServerTransportDependencies = {
    createWebSocketPeer: vi.fn(() => {
      const peer = new FakePeer();
      peers.push(peer);
      return peer;
    }),
    spawnProcess: vi.fn(() => child),
    probeEndpoint: vi.fn(async () => ({ ok: false as const, reason: "unavailable" as const })),
    findAvailablePort: vi.fn(async () => 31317),
    lockStore: new MemoryLockStore(),
    now: () => 1234,
    sleep: vi.fn(async () => undefined),
    pid: 777,
    isPidAlive: vi.fn(() => true),
    registerProcessCleanup: vi.fn(() => vi.fn()),
    ...overrides
  };

  return { child, deps, peers };
}

describe("createManagedAppServerPeer spawn-or-connect", () => {
  it("external 模式只连接已有 app-server，不启动子进程", async () => {
    const { deps, peers } = createTransportDeps();
    const peer = createManagedAppServerPeer({ mode: "external", url: "ws://127.0.0.1:31317" }, deps);

    await peer.connect();

    expect(deps.spawnProcess).not.toHaveBeenCalled();
    expect(peers).toHaveLength(1);
    expect(peer.getStatus()).toMatchObject({
      state: "ready",
      mode: "external",
      managedByCurrentProcess: false,
      reusedExisting: true
    });
  });

  it("固定端口已有可用 app-server 时复用且不 spawn", async () => {
    const { deps, peers } = createTransportDeps({
      probeEndpoint: vi.fn(async () => ({ ok: true as const }))
    });

    const peer = createManagedAppServerPeer(
      {
        mode: "spawn-or-connect",
        codexBin: "codex",
        host: "127.0.0.1",
        port: 31317,
        stateDir: "/tmp/codex-web-app-server-test"
      },
      deps
    );

    await peer.connect();

    expect(deps.spawnProcess).not.toHaveBeenCalled();
    expect(peers).toHaveLength(1);
    expect(peers[0]?.connectCalls).toBe(1);
    expect(peer.getStatus()).toMatchObject({
      state: "ready",
      mode: "spawn-or-connect",
      managedByCurrentProcess: false,
      reusedExisting: true,
      pidKnown: false
    });
  });

  it("固定端口未监听时取得锁并启动 app-server", async () => {
    const lockStore = new MemoryLockStore();
    const { child, deps } = createTransportDeps({ lockStore });

    const peer = createManagedAppServerPeer(
      {
        mode: "spawn-or-connect",
        codexBin: "codex",
        host: "127.0.0.1",
        port: 31317,
        stateDir: "/tmp/codex-web-app-server-test"
      },
      deps
    );

    await peer.connect();

    expect(deps.spawnProcess).toHaveBeenCalledTimes(1);
    expect(deps.spawnProcess).toHaveBeenCalledWith(
      "codex",
      ["app-server", "--listen", "ws://127.0.0.1:31317"],
      expect.objectContaining({ windowsHide: true })
    );
    expect(lockStore.metadata).toMatchObject({
      endpointUrl: "ws://127.0.0.1:31317",
      ownerPid: 777,
      childPid: 4242
    });
    expect(peer.getStatus()).toMatchObject({
      state: "ready",
      mode: "spawn-or-connect",
      managedByCurrentProcess: true,
      reusedExisting: false,
      pidKnown: true
    });

    peer.close();
    expect(child.kill).toHaveBeenCalledTimes(1);
    expect(lockStore.metadata).toBeNull();
  });

  it("两个 Web 后端并发自动启动时最多 spawn 一次", async () => {
    let spawned = false;
    const lockStore = new MemoryLockStore();
    const { deps } = createTransportDeps({
      lockStore,
      probeEndpoint: vi.fn(async () =>
        spawned ? { ok: true as const } : { ok: false as const, reason: "unavailable" as const }
      ),
      spawnProcess: vi.fn(() => {
        spawned = true;
        return createFakeChild();
      })
    });
    const config = {
      mode: "spawn-or-connect" as const,
      codexBin: "codex",
      host: "127.0.0.1",
      port: 31317,
      stateDir: "/tmp/codex-web-app-server-test"
    };

    const first = createManagedAppServerPeer(config, deps);
    const second = createManagedAppServerPeer(config, deps);

    await Promise.all([first.connect(), second.connect()]);

    expect(deps.spawnProcess).toHaveBeenCalledTimes(1);
    expect(first.getStatus()).toMatchObject({ state: "ready" });
    expect(second.getStatus()).toMatchObject({ state: "ready" });
  });

  it("固定端口被非 app-server 占用时返回明确错误且不改用随机端口", async () => {
    const { deps } = createTransportDeps({
      probeEndpoint: vi.fn(async () => ({ ok: false as const, reason: "handshake-failed" as const }))
    });
    const peer = createManagedAppServerPeer(
      {
        mode: "spawn-or-connect",
        codexBin: "codex",
        host: "127.0.0.1",
        port: 31317,
        stateDir: "/tmp/codex-web-app-server-test"
      },
      deps
    );

    await expect(peer.connect()).rejects.toThrow("固定 app-server 端口已被占用或握手失败");

    expect(deps.spawnProcess).not.toHaveBeenCalled();
    expect(deps.findAvailablePort).not.toHaveBeenCalled();
    expect(peer.getStatus()).toMatchObject({
      state: "error",
      mode: "spawn-or-connect",
      errorKind: "handshake-failed"
    });
  });

  it("owner pid 不存在的陈旧锁会被清理后重新启动", async () => {
    const lockStore = new MemoryLockStore({
      endpointUrl: "ws://127.0.0.1:31317",
      ownerPid: 999,
      startedAtMs: 100,
      managedByCurrentProcess: true
    });
    const { deps } = createTransportDeps({
      lockStore,
      isPidAlive: vi.fn((pid) => pid !== 999)
    });
    const peer = createManagedAppServerPeer(
      {
        mode: "spawn-or-connect",
        codexBin: "codex",
        host: "127.0.0.1",
        port: 31317,
        stateDir: "/tmp/codex-web-app-server-test"
      },
      deps
    );

    await peer.connect();

    expect(lockStore.removeCount).toBe(1);
    expect(deps.spawnProcess).toHaveBeenCalledTimes(1);
    expect(peer.getStatus()).toMatchObject({ state: "ready", managedByCurrentProcess: true });
  });

  it("owner pid 不存在但 endpoint 可用时复用残留 app-server 并清理陈旧锁", async () => {
    const lockStore = new MemoryLockStore({
      endpointUrl: "ws://127.0.0.1:31317",
      ownerPid: 999,
      startedAtMs: 100,
      managedByCurrentProcess: true,
      childPid: 4242
    });
    const { deps } = createTransportDeps({
      lockStore,
      probeEndpoint: vi.fn(async () => ({ ok: true as const })),
      isPidAlive: vi.fn((pid) => pid !== 999)
    });
    const peer = createManagedAppServerPeer(
      {
        mode: "spawn-or-connect",
        codexBin: "codex",
        host: "127.0.0.1",
        port: 31317,
        stateDir: "/tmp/codex-web-app-server-test"
      },
      deps
    );

    await peer.connect();

    expect(lockStore.removeCount).toBe(1);
    expect(deps.spawnProcess).not.toHaveBeenCalled();
    expect(peer.getStatus()).toMatchObject({
      state: "ready",
      managedByCurrentProcess: false,
      reusedExisting: true,
      cleanupState: "none"
    });
  });
});

describe("sanitizeAppServerStatus", () => {
  it("状态诊断不会暴露原始 URL、token 或认证信息", () => {
    const status = sanitizeAppServerStatus({
      state: "error",
      message: "connect failed: ws://secret-token@127.0.0.1:31317/app?token=abc"
    });

    expect(status).toMatchObject({ state: "error" });
    if (status.state !== "error") {
      throw new Error("expected error status");
    }
    expect(status.message).toContain("[app-server-url]");
    expect(status.message).not.toContain("secret-token");
    expect(status.message).not.toContain("token=abc");
    expect(status.message).not.toContain("ws://");
  });
});
