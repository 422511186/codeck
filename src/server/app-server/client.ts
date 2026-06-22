import { Buffer } from "node:buffer";
import path from "node:path";
import type { InitializeParams } from "../../../docs/generated/app-server-ts/InitializeParams";
import type { InitializeResponse } from "../../../docs/generated/app-server-ts/InitializeResponse";
import type { CommandExecParams } from "../../../docs/generated/app-server-ts/v2/CommandExecParams";
import type { CommandExecResponse } from "../../../docs/generated/app-server-ts/v2/CommandExecResponse";
import type { ConfigReadResponse } from "../../../docs/generated/app-server-ts/v2/ConfigReadResponse";
import type { FsReadDirectoryParams } from "../../../docs/generated/app-server-ts/v2/FsReadDirectoryParams";
import type { FsReadDirectoryResponse } from "../../../docs/generated/app-server-ts/v2/FsReadDirectoryResponse";
import type { FsReadFileParams } from "../../../docs/generated/app-server-ts/v2/FsReadFileParams";
import type { FsReadFileResponse } from "../../../docs/generated/app-server-ts/v2/FsReadFileResponse";
import type { ModelListParams } from "../../../docs/generated/app-server-ts/v2/ModelListParams";
import type { ModelListResponse } from "../../../docs/generated/app-server-ts/v2/ModelListResponse";
import type { RemoteControlStatusReadResponse } from "../../../docs/generated/app-server-ts/v2/RemoteControlStatusReadResponse";
import type { Thread } from "../../../docs/generated/app-server-ts/v2/Thread";
import type { ThreadItem } from "../../../docs/generated/app-server-ts/v2/ThreadItem";
import type { ThreadReadResponse } from "../../../docs/generated/app-server-ts/v2/ThreadReadResponse";
import type { ThreadForkParams } from "../../../docs/generated/app-server-ts/v2/ThreadForkParams";
import type { ThreadForkResponse } from "../../../docs/generated/app-server-ts/v2/ThreadForkResponse";
import type { ThreadListParams } from "../../../docs/generated/app-server-ts/v2/ThreadListParams";
import type { ThreadListResponse } from "../../../docs/generated/app-server-ts/v2/ThreadListResponse";
import type { ThreadRollbackParams } from "../../../docs/generated/app-server-ts/v2/ThreadRollbackParams";
import type { ThreadRollbackResponse } from "../../../docs/generated/app-server-ts/v2/ThreadRollbackResponse";
import type { ThreadStartParams } from "../../../docs/generated/app-server-ts/v2/ThreadStartParams";
import type { ThreadStartResponse } from "../../../docs/generated/app-server-ts/v2/ThreadStartResponse";
import type { ThreadStatus } from "../../../docs/generated/app-server-ts/v2/ThreadStatus";
import type { TurnInterruptParams } from "../../../docs/generated/app-server-ts/v2/TurnInterruptParams";
import type { TurnStartParams } from "../../../docs/generated/app-server-ts/v2/TurnStartParams";
import type { TurnStartResponse } from "../../../docs/generated/app-server-ts/v2/TurnStartResponse";
import type { TurnSteerParams } from "../../../docs/generated/app-server-ts/v2/TurnSteerParams";
import type { TurnSteerResponse } from "../../../docs/generated/app-server-ts/v2/TurnSteerResponse";
import type {
  MobileCommandResult,
  MobileFileContent,
  MobileFileEntry,
  MobileModelOption,
  MobileSettingsView,
  MobileThreadDetail,
  MobileThreadPage,
  MobileThreadSummary,
  MobileTimelineItem
} from "../../shared/codex";
import { createTurnUserInput } from "./user-input";

export type AppServerPeer = {
  request(method: string, params: unknown): Promise<unknown>;
};

export type StartThreadInput = {
  cwd?: string;
  workspaceRoots?: string[];
  model?: string;
  permissions?: string;
};

export type StartTurnInput = {
  threadId: string;
  text: string;
  imagePaths?: string[];
  model?: string;
  reasoningEffort?: string;
};

export type ExecCommandInput = {
  command: string[];
  cwd?: string;
  timeoutMs?: number;
};

function statusLabel(status: ThreadStatus): string {
  if (status.type === "active") {
    return "active";
  }

  return status.type;
}

function threadSummary(thread: Thread): MobileThreadSummary {
  return {
    id: thread.id,
    title: thread.name || thread.preview || "未命名会话",
    preview: thread.preview,
    cwd: thread.cwd,
    modelProvider: thread.modelProvider,
    status: statusLabel(thread.status),
    updatedAt: thread.updatedAt
  };
}

function userMessageText(item: Extract<ThreadItem, { type: "userMessage" }>): string {
  return item.content
    .map((content) => {
      if (content.type === "text") {
        return content.text;
      }

      if (content.type === "image" || content.type === "localImage") {
        return "[图片]";
      }

      return `[${content.type}]`;
    })
    .join("\n");
}

function timelineItem(item: ThreadItem): MobileTimelineItem | null {
  if (item.type === "userMessage") {
    return { id: item.id, role: "user", text: userMessageText(item) };
  }

  if (item.type === "agentMessage") {
    return { id: item.id, role: "agent", text: item.text };
  }

  if (item.type === "reasoning") {
    return { id: item.id, role: "reasoning", text: [...item.summary, ...item.content].join("\n") };
  }

  if (item.type === "plan") {
    return { id: item.id, role: "plan", text: item.text };
  }

  if (item.type === "commandExecution") {
    return {
      id: item.id,
      role: "tool",
      text: item.aggregatedOutput ? `${item.command}\n${item.aggregatedOutput}` : item.command
    };
  }

  return null;
}

function threadDetail(thread: Thread): MobileThreadDetail {
  const timeline = thread.turns.flatMap((turn) =>
    turn.items.flatMap((item) => {
      const mapped = timelineItem(item);
      return mapped ? [mapped] : [];
    })
  );

  return {
    ...threadSummary(thread),
    lastTurnId: thread.turns.at(-1)?.id || null,
    timeline
  };
}

function joinChildPath(parentPath: string, childName: string): string {
  const hasWindowsSeparator = parentPath.includes("\\");
  const pathApi = hasWindowsSeparator ? path.win32 : path.posix;
  return pathApi.join(parentPath, childName);
}

function settingsValue(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  return typeof value === "string" ? value : JSON.stringify(value);
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
      threads: response.data.map(threadSummary),
      nextCursor: response.nextCursor
    };
  }

  async readThread(threadId: string): Promise<MobileThreadDetail> {
    const response = (await this.peer.request("thread/read", {
      threadId,
      includeTurns: true
    })) as ThreadReadResponse;

    return threadDetail(response.thread);
  }

  async startThread(input: StartThreadInput): Promise<MobileThreadSummary> {
    const params: ThreadStartParams = {
      cwd: input.cwd,
      runtimeWorkspaceRoots: input.workspaceRoots,
      model: input.model,
      permissions: input.permissions
    };

    const response = (await this.peer.request("thread/start", params)) as ThreadStartResponse;
    return threadSummary(response.thread);
  }

  async startTurn(input: StartTurnInput): Promise<{ turnId: string }> {
    const params: TurnStartParams = {
      threadId: input.threadId,
      input: createTurnUserInput(input.text, input.imagePaths),
      model: input.model,
      effort: input.reasoningEffort
    };

    const response = (await this.peer.request("turn/start", params)) as TurnStartResponse;
    return { turnId: response.turn.id };
  }

  async forkThread(threadId: string): Promise<MobileThreadDetail> {
    const params: ThreadForkParams = {
      threadId,
      excludeTurns: false
    };
    const response = (await this.peer.request("thread/fork", params)) as ThreadForkResponse;
    return threadDetail(response.thread);
  }

  async rollbackThread(threadId: string, numTurns: number): Promise<MobileThreadDetail> {
    const params: ThreadRollbackParams = {
      threadId,
      numTurns
    };
    const response = (await this.peer.request("thread/rollback", params)) as ThreadRollbackResponse;
    return threadDetail(response.thread);
  }

  async interruptTurn(threadId: string, turnId: string): Promise<void> {
    const params: TurnInterruptParams = {
      threadId,
      turnId
    };
    await this.peer.request("turn/interrupt", params);
  }

  async steerTurn(input: { threadId: string; expectedTurnId: string; text: string }): Promise<{ turnId: string }> {
    const params: TurnSteerParams = {
      threadId: input.threadId,
      expectedTurnId: input.expectedTurnId,
      input: createTurnUserInput(input.text)
    };
    const response = (await this.peer.request("turn/steer", params)) as TurnSteerResponse;
    return { turnId: response.turnId };
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

  async readDirectory(directoryPath: string): Promise<MobileFileEntry[]> {
    const params: FsReadDirectoryParams = { path: directoryPath };
    const response = (await this.peer.request("fs/readDirectory", params)) as FsReadDirectoryResponse;

    return response.entries.map((entry) => ({
      name: entry.fileName,
      path: joinChildPath(directoryPath, entry.fileName),
      isDirectory: entry.isDirectory,
      isFile: entry.isFile
    }));
  }

  async readFile(filePath: string): Promise<MobileFileContent> {
    const params: FsReadFileParams = { path: filePath };
    const response = (await this.peer.request("fs/readFile", params)) as FsReadFileResponse;

    return {
      path: filePath,
      text: Buffer.from(response.dataBase64, "base64").toString("utf8")
    };
  }

  async execCommand(input: ExecCommandInput): Promise<MobileCommandResult> {
    const params: CommandExecParams = {
      command: input.command,
      cwd: input.cwd,
      timeoutMs: input.timeoutMs ?? 30_000
    };
    const response = (await this.peer.request("command/exec", params)) as CommandExecResponse;

    return {
      exitCode: response.exitCode,
      stdout: response.stdout,
      stderr: response.stderr
    };
  }

  async readSettings(): Promise<MobileSettingsView> {
    const [configResponse, remoteControlResponse] = await Promise.all([
      this.peer.request("config/read", {}),
      this.peer.request("remoteControl/status/read", {})
    ]);
    const config = (configResponse as ConfigReadResponse).config;
    const remoteControl = remoteControlResponse as RemoteControlStatusReadResponse;

    return {
      model: settingsValue(config.model),
      modelProvider: settingsValue(config.model_provider),
      reasoningEffort: settingsValue(config.model_reasoning_effort),
      approvalPolicy: settingsValue(config.approval_policy),
      sandboxMode: settingsValue(config.sandbox_mode),
      remoteControlStatus: remoteControl.status
    };
  }
}
