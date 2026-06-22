import type { AppServerConfig } from "../../config/env";
import type { MobileModelOption, MobileThreadPage } from "../../shared/codex";
import { getRuntimeConfig } from "../runtime";
import { CodexAppServerClient, type AppServerPeer } from "./client";
import { createManagedAppServerPeer, type AppServerStatus, type ManagedAppServerPeer } from "./transport";

class MockAppServerPeer implements ManagedAppServerPeer {
  private status: AppServerStatus = { state: "idle" };

  async connect(): Promise<void> {
    this.status = { state: "ready" };
  }

  getStatus(): AppServerStatus {
    return this.status;
  }

  close(): void {
    this.status = { state: "idle" };
  }

  async request(method: string): Promise<unknown> {
    if (method === "initialize") {
      return {
        userAgent: "codex-web-mock",
        codexHome: "C:\\Users\\huang\\.codex",
        platformFamily: "windows",
        platformOs: "windows"
      };
    }

    if (method === "thread/list") {
      return {
        data: [
          {
            id: "mock-thread-1",
            sessionId: "mock-session-1",
            forkedFromId: null,
            parentThreadId: null,
            preview: "这是用于移动端联调的示例会话",
            ephemeral: false,
            modelProvider: "openai",
            createdAt: 1_767_000_000,
            updatedAt: 1_767_000_600,
            status: { type: "idle" },
            path: null,
            cwd: "C:\\Users\\huang\\workspace",
            cliVersion: "0.141.0",
            source: "appServer",
            threadSource: null,
            agentNickname: null,
            agentRole: null,
            gitInfo: null,
            name: "示例会话",
            turns: []
          }
        ],
        nextCursor: null,
        backwardsCursor: null
      };
    }

    if (method === "model/list") {
      return {
        data: [
          {
            id: "gpt-5-codex",
            model: "gpt-5-codex",
            upgrade: null,
            upgradeInfo: null,
            availabilityNux: null,
            displayName: "GPT-5 Codex",
            description: "Codex 默认模型",
            hidden: false,
            supportedReasoningEfforts: ["low", "medium", "high"],
            defaultReasoningEffort: "medium",
            inputModalities: ["text", "image"],
            supportsPersonality: true,
            additionalSpeedTiers: [],
            serviceTiers: [],
            defaultServiceTier: null,
            isDefault: true
          }
        ],
        nextCursor: null
      };
    }

    throw new Error(`mock app-server 未实现方法: ${method}`);
  }
}

class DisabledAppServerPeer implements ManagedAppServerPeer {
  connect(): Promise<void> {
    return Promise.reject(new Error("app-server 已关闭"));
  }

  getStatus(): AppServerStatus {
    return { state: "disabled" };
  }

  close(): void {
    return undefined;
  }

  request(): Promise<unknown> {
    return Promise.reject(new Error("app-server 已关闭"));
  }
}

export class AppServerGateway {
  private initialized: Promise<void> | null = null;
  private readonly client: CodexAppServerClient;

  constructor(private readonly peer: ManagedAppServerPeer) {
    this.client = new CodexAppServerClient(peer as AppServerPeer);
  }

  getStatus(): AppServerStatus {
    return this.peer.getStatus();
  }

  ensureReady(): Promise<void> {
    if (!this.initialized) {
      this.initialized = this.peer.connect().then(async () => {
        await this.client.initialize();
      });
    }

    return this.initialized;
  }

  async listThreads(params = {}): Promise<MobileThreadPage> {
    await this.ensureReady();
    return this.client.listThreads(params);
  }

  async listModels(): Promise<MobileModelOption[]> {
    await this.ensureReady();
    return this.client.listModels();
  }

  close(): void {
    this.peer.close();
    this.initialized = null;
  }
}

function createPeer(config: AppServerConfig): ManagedAppServerPeer {
  if (config.mode === "mock") {
    return new MockAppServerPeer();
  }

  if (config.mode === "off") {
    return new DisabledAppServerPeer();
  }

  return createManagedAppServerPeer(config);
}

export function createAppServerGateway(config: AppServerConfig): AppServerGateway {
  return new AppServerGateway(createPeer(config));
}

const globalForAppServer = globalThis as typeof globalThis & {
  __codexWebAppServerGateway?: AppServerGateway;
};

export function getAppServerGateway(): AppServerGateway {
  if (!globalForAppServer.__codexWebAppServerGateway) {
    globalForAppServer.__codexWebAppServerGateway = createAppServerGateway(getRuntimeConfig().appServer);
  }

  return globalForAppServer.__codexWebAppServerGateway;
}
