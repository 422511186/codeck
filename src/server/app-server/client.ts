import type { InitializeParams } from "../../../docs/generated/app-server-ts/InitializeParams";
import type { InitializeResponse } from "../../../docs/generated/app-server-ts/InitializeResponse";
import type { ModelListParams } from "../../../docs/generated/app-server-ts/v2/ModelListParams";
import type { ModelListResponse } from "../../../docs/generated/app-server-ts/v2/ModelListResponse";
import type { ThreadListParams } from "../../../docs/generated/app-server-ts/v2/ThreadListParams";
import type { ThreadListResponse } from "../../../docs/generated/app-server-ts/v2/ThreadListResponse";
import type { ThreadStatus } from "../../../docs/generated/app-server-ts/v2/ThreadStatus";
import type { MobileModelOption, MobileThreadPage } from "../../shared/codex";

export type AppServerPeer = {
  request(method: string, params: unknown): Promise<unknown>;
};

function statusLabel(status: ThreadStatus): string {
  if (status.type === "active") {
    return "active";
  }

  return status.type;
}

export class CodexAppServerClient {
  constructor(private readonly peer: AppServerPeer) {}

  async initialize(): Promise<InitializeResponse> {
    const params: InitializeParams = {
      clientInfo: {
        name: "codex-mobile-web",
        title: "Codex 移动端 Web",
        version: "0.1.0"
      },
      capabilities: {
        experimentalApi: true,
        requestAttestation: false,
        optOutNotificationMethods: []
      }
    };

    return this.peer.request("initialize", params) as Promise<InitializeResponse>;
  }

  async listThreads(params: ThreadListParams = {}): Promise<MobileThreadPage> {
    const response = (await this.peer.request("thread/list", params)) as ThreadListResponse;

    return {
      threads: response.data.map((thread) => ({
        id: thread.id,
        title: thread.name || thread.preview || "未命名会话",
        preview: thread.preview,
        cwd: thread.cwd,
        modelProvider: thread.modelProvider,
        status: statusLabel(thread.status),
        updatedAt: thread.updatedAt
      })),
      nextCursor: response.nextCursor
    };
  }

  async listModels(params: ModelListParams = {}): Promise<MobileModelOption[]> {
    const response = (await this.peer.request("model/list", params)) as ModelListResponse;

    return response.data
      .filter((model) => !model.hidden)
      .map((model) => ({
        id: model.id,
        label: model.displayName || model.model,
        isDefault: model.isDefault,
        supportedReasoningEfforts: model.supportedReasoningEfforts.map(String),
        inputModalities: model.inputModalities.map(String)
      }));
  }
}
