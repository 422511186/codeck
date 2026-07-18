import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";
import type { MobileTimelineItem } from "../../shared/codex";
import type { TimelineCompleteness } from "../../shared/timeline-content";
import { timelineItem } from "./client";

export type AppServerNotificationMessage = {
  method: string;
  params?: unknown;
};

export type BrowserThreadGoal = {
  threadId: string;
  objective: string;
  status: string;
  tokenBudget: number | null;
  tokensUsed: number;
  timeUsedSeconds: number;
  createdAt: number;
  updatedAt: number;
};

export type BrowserFileSearchResult = {
  root: string;
  path: string;
  fullPath: string;
  fileName: string;
  matchType: "file" | "directory";
  score: number;
  indices: number[] | null;
};

export type BrowserRealtimeAudioChunk = {
  data: string;
  sampleRate: number;
  numChannels: number;
  samplesPerChannel: number | null;
  itemId: string | null;
};

export type BrowserCodexEvent =
  | {
      kind: "turn_started";
      threadId: string;
      turnId: string;
    }
  | {
      kind: "turn_completed";
      threadId: string;
      turnId: string;
      status: string;
    }
  | {
      kind: "thread_status_changed";
      threadId: string;
      status: string;
      activeFlags?: unknown[];
    }
  | {
      kind: "timeline_generation_changed";
      threadId: string;
    }
  | {
      kind: "agent_message_delta";
      threadId: string;
      turnId: string;
      itemId: string;
      delta: string;
      capReached?: boolean;
    }
  | {
      kind: "reasoning_delta";
      threadId: string;
      turnId: string;
      itemId: string;
      delta: string;
    }
  | {
      kind: "reasoning_started";
      threadId: string;
      turnId: string;
      itemId: string;
    }
  | {
      kind: "plan_delta";
      threadId: string;
      turnId: string;
      itemId: string;
      delta: string;
    }
  | {
      kind: "plan.delta";
      threadId: string;
      turnId: string;
      plan: Array<{ text: string; completed: boolean }>;
    }
  | {
      kind: "command_output_delta";
      threadId: string;
      turnId: string;
      itemId: string;
      delta: string;
    }
  | {
      kind: "file_output_delta";
      threadId: string;
      turnId: string;
      itemId: string;
      delta: string;
      changes?: Array<{ path: string; kind: unknown; diff: string }>;
    }
  | {
      kind: "tool_output_delta";
      threadId: string;
      turnId: string;
      itemId: string;
      delta: string;
      server: string;
      tool: string;
      toolKind: NonNullable<MobileTimelineItem["toolKind"]>;
    }
  | {
      kind: "item_updated";
      threadId: string;
      turnId: string;
      completedAtMs: number;
      item: MobileTimelineItem;
    }
  | {
      kind: "timeline_content_reference";
      threadId: string;
      turnId?: string;
      itemId?: string;
      originalKind: string;
      itemRole?: MobileTimelineItem["role"];
      toolKind?: MobileTimelineItem["toolKind"];
      server?: string;
      tool?: string;
      status?: MobileTimelineItem["status"];
      preview: string;
      contentRef?: string;
      completeness: TimelineCompleteness;
      sourceLocator?: MobileTimelineItem["sourceLocator"];
    }
  | {
      kind: "turn_diff_updated";
      threadId: string;
      turnId: string;
      diff: string;
    }
  | {
      kind: "context_compacted";
      threadId: string;
      turnId: string;
    }
  | {
      kind: "token_usage_updated";
      threadId: string;
      turnId: string;
      totalTokens: number;
      inputTokens: number;
      outputTokens: number;
      reasoningOutputTokens: number;
      modelContextWindow: number | null;
    }
  | {
      kind: "warning";
      threadId: string | null;
      message: string;
    }
  | {
      kind: "turn_error";
      threadId: string;
      turnId: string;
      message: string;
      willRetry: boolean;
    }
  | {
      kind: "settings_invalidated";
    }
  | {
      kind: "skills_changed";
    }
  | {
      kind: "thread_settings_updated";
      threadId: string;
      model: string | null;
      reasoningEffort: string | null;
      approvalsReviewer: string | null;
      activePermissionProfile: BrowserActivePermissionProfile | null;
      collaborationMode: "plan" | "default" | null;
    }
  | {
      kind: "thread_goal_updated";
      threadId: string;
      goal: BrowserThreadGoal;
    }
  | {
      kind: "thread_goal_cleared";
      threadId: string;
    }
  | {
      kind: "fs_changed";
      watchId: string;
      paths: string[];
    }
  | {
      kind: "file_search_session_updated";
      sessionId: string;
      query: string;
      results: BrowserFileSearchResult[];
    }
  | {
      kind: "file_search_session_completed";
      sessionId: string;
    }
  | {
      kind: "realtime_started";
      threadId: string;
      realtimeSessionId: string | null;
      version: string;
    }
  | {
      kind: "realtime_transcript_delta";
      threadId: string;
      role: string;
      delta: string;
    }
  | {
      kind: "realtime_transcript_done";
      threadId: string;
      role: string;
      text: string;
    }
  | {
      kind: "realtime_output_audio_delta";
      threadId: string;
      audio: BrowserRealtimeAudioChunk;
    }
  | {
      kind: "realtime_error";
      threadId: string;
      message: string;
    }
  | {
      kind: "realtime_closed";
      threadId: string;
      reason: string | null;
    }
  | {
      kind: "external_agent_config_import_completed";
      importId: string;
      itemTypeResults: unknown[];
    };

export type BrowserActivePermissionProfile = {
  id: string;
  extends: string | null;
};

export type BrowserTimelineEventIdentity = {
  eventId: string;
  bootId: string;
  streamSequence: number;
  fragmentSequence?: number;
  /** Legacy alias for streamSequence. */
  sequence: number;
  revision: number;
  generation: number;
};

export type BrowserCodexEventEnvelope = {
  type: "codex-event";
  event: BrowserCodexEvent & Partial<BrowserTimelineEventIdentity>;
};

export type BrowserServerRequestResolvedEnvelope = {
  type: "server-request-resolved";
  requestId: string;
};

export type BrowserAppServerNotificationEnvelope = BrowserCodexEventEnvelope | BrowserServerRequestResolvedEnvelope;

type DeltaParams = {
  threadId: string;
  turnId: string;
  itemId: string;
  delta: string;
};

type DeltaEventKind = Exclude<
  Extract<BrowserCodexEvent, { turnId: string; itemId: string; delta: string }>["kind"],
  "tool_output_delta"
>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isDeltaParams(value: unknown): value is DeltaParams {
  return isRecord(value) && "threadId" in value && "turnId" in value && "itemId" in value && "delta" in value;
}

function deltaEvent(kind: DeltaEventKind, params: unknown): BrowserCodexEventEnvelope | null {
  if (!isDeltaParams(params)) {
    return null;
  }

  return {
    type: "codex-event",
    event: {
      kind,
      threadId: String(params.threadId),
      turnId: String(params.turnId),
      itemId: String(params.itemId),
      delta: String(params.delta)
    }
  };
}

function base64Delta(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  try {
    return Buffer.from(value, "base64").toString("utf8");
  } catch {
    return "";
  }
}

function processDeltaEvent(
  kind: "command" | "process",
  params: unknown
): BrowserCodexEventEnvelope | null {
  if (!isRecord(params) || typeof params.threadId !== "string" || typeof params.turnId !== "string") {
    return null;
  }

  const itemId =
    kind === "command"
      ? typeof params.processId === "string"
        ? params.processId
        : null
      : typeof params.processHandle === "string"
        ? params.processHandle
        : null;
  if (!itemId) {
    return null;
  }

  return {
    type: "codex-event",
    event: {
      kind: "command_output_delta",
      threadId: params.threadId,
      turnId: params.turnId,
      itemId,
      delta: base64Delta(params.deltaBase64),
      ...(params.capReached === true ? { capReached: true } : {})
    }
  };
}

function rawResponseTimelineItem(
  value: unknown,
  locator?: { responseId: string; absoluteOutputIndex: number }
): MobileTimelineItem | null {
  if (!isRecord(value) || typeof value.type !== "string") {
    return null;
  }

  const metadata = isRecord(value.metadata) ? value.metadata : null;
  const explicitId =
    typeof value.id === "string"
      ? value.id
      : typeof value.call_id === "string"
        ? value.call_id
        : null;
  const sourceLocator = locator
    ? { sourceKind: "response" as const, sourceId: locator.responseId, absoluteOutputIndex: locator.absoluteOutputIndex }
    : undefined;
  const id = explicitId ?? (sourceLocator
    ? `synthetic:response:${encodeURIComponent(sourceLocator.sourceId)}:${sourceLocator.absoluteOutputIndex}`
    : `unresolved:response:${value.type}:${randomUUID()}`);
  const identityMeta = {
    ...(sourceLocator ? { sourceLocator } : {}),
    ...(!explicitId && !sourceLocator
      ? { completeness: { status: "repair-required" as const, reason: "source-gap" as const } }
      : {})
  };

  if (value.type === "message" || value.type === "agent_message") {
    const text = rawMessageText(value);
    if (text) {
      return {
        id,
        ...identityMeta,
        role: "agent",
        text
      };
    }
  }

  if (value.type === "reasoning") {
    const summary = Array.isArray(value.summary)
      ? value.summary
          .map((part) => (isRecord(part) && typeof part.text === "string" ? part.text : ""))
          .filter(Boolean)
      : [];
    const content = Array.isArray(value.content)
      ? value.content
          .map((part) => (isRecord(part) && typeof part.text === "string" ? part.text : ""))
          .filter(Boolean)
      : [];
    return {
      id,
      ...identityMeta,
      role: "reasoning",
      text: [...summary, ...content].join("\n"),
      done: true
    };
  }

  if (value.type === "local_shell_call" && isRecord(value.action)) {
    const command = Array.isArray(value.action.command) ? value.action.command.join(" ") : "shell";
    return {
      id,
      ...identityMeta,
      role: "tool",
      text: command,
      toolKind: "command",
      server: typeof value.action.working_directory === "string" ? value.action.working_directory : "command",
      tool: command,
      status: typeof value.status === "string" && value.status === "in_progress" ? "running" : "success"
    };
  }

  if (value.type === "function_call" || value.type === "custom_tool_call" || value.type === "tool_search_call") {
    return {
      id,
      ...identityMeta,
      role: "tool",
      text: typeof value.arguments === "string" ? value.arguments : stringifyForEvent(value),
      toolKind: "dynamic",
      server: typeof value.namespace === "string" ? value.namespace : "raw",
      tool: typeof value.name === "string" ? value.name : value.type,
      arguments: typeof value.arguments === "string" ? value.arguments : undefined,
      status: "running"
    };
  }

  if (
    value.type === "function_call_output" ||
    value.type === "custom_tool_call_output" ||
    value.type === "tool_search_output"
  ) {
    return {
      id,
      ...identityMeta,
      role: "tool",
      text: stringifyForEvent(value.output ?? value),
      toolKind: "dynamic",
      server: "raw",
      tool: value.type,
      status: "success"
    };
  }

  if (value.type === "web_search_call") {
    return {
      id,
      ...identityMeta,
      role: "tool",
      text: stringifyForEvent(value.action ?? value),
      toolKind: "web",
      server: "web",
      tool: "search",
      status: "success"
    };
  }

  if (value.type === "image_generation_call") {
    return {
      id,
      ...identityMeta,
      role: "tool",
      text: typeof value.revised_prompt === "string" ? value.revised_prompt : "",
      toolKind: "image",
      server: "image",
      tool: "generation",
      status: typeof value.status === "string" && value.status === "completed" ? "success" : "running"
    };
  }

  if (value.type === "compaction" || value.type === "compaction_trigger" || value.type === "context_compaction") {
    return {
      id,
      ...identityMeta,
      role: "system",
      text: "压缩上下文已完成",
      toolKind: "system"
    };
  }

  return {
    id,
    ...identityMeta,
    role: "tool",
    text: stringifyForEvent(value),
    toolKind: "dynamic",
    server: "raw",
    tool: typeof value.name === "string" ? value.name : value.type,
    status: eventStatus(value.status)
  };
}

function rawMessageText(value: Record<string, unknown>): string {
  if (typeof value.text === "string" && value.text.trim()) {
    return value.text;
  }
  if (typeof value.output_text === "string" && value.output_text.trim()) {
    return value.output_text;
  }
  if (typeof value.content === "string" && value.content.trim()) {
    return value.content;
  }
  if (!Array.isArray(value.content)) {
    return "";
  }
  return value.content
    .map((part) => {
      if (!isRecord(part)) {
        return "";
      }
      if (typeof part.text === "string") {
        return part.text;
      }
      if (typeof part.output_text === "string") {
        return part.output_text;
      }
      if (typeof part.content === "string") {
        return part.content;
      }
      return "";
    })
    .filter((part) => part.trim().length > 0)
    .join("\n");
}

function stringifyForEvent(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  try {
    return JSON.stringify(
      value,
      (_key, nested) => (typeof nested === "bigint" ? nested.toString() : nested),
      2
    );
  } catch {
    return String(value);
  }
}

function eventStatus(value: unknown): "running" | "success" | "failed" {
  const normalized = typeof value === "string" ? value.toLowerCase() : "";
  if (normalized.includes("fail") || normalized.includes("error") || normalized.includes("cancel")) {
    return "failed";
  }
  if (normalized.includes("running") || normalized.includes("progress") || normalized.includes("started")) {
    return "running";
  }
  return "success";
}

function normalizePlanSteps(value: unknown): Array<{ text: string; completed: boolean }> {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((step) => {
    if (!isRecord(step) || typeof step.step !== "string") {
      return [];
    }
    return [{ text: step.step, completed: step.status === "completed" }];
  });
}

function hookRunTimelineItem(value: unknown): MobileTimelineItem | null {
  if (!isRecord(value) || typeof value.id !== "string") {
    return null;
  }

  const entries = Array.isArray(value.entries) ? value.entries : [];
  const entryText = entries
    .map((entry) => stringifyForEvent(entry))
    .filter(Boolean)
    .join("\n");
  const statusMessage = typeof value.statusMessage === "string" ? value.statusMessage : "";
  const text = [statusMessage, entryText].filter(Boolean).join("\n") || stringifyForEvent(value);

  return {
    id: value.id,
    role: "tool",
    text,
    toolKind: "system",
    server: "hook",
    tool: typeof value.eventName === "string" ? value.eventName : "hook",
    status: eventStatus(value.status)
  };
}

function numberOrZero(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function activePermissionProfileOrNull(value: unknown): BrowserActivePermissionProfile | null {
  if (!isRecord(value) || typeof value.id !== "string") {
    return null;
  }

  return {
    id: value.id,
    extends: typeof value.extends === "string" ? value.extends : null
  };
}

function collaborationModeKind(value: unknown): "plan" | "default" | null {
  if (!isRecord(value)) {
    return null;
  }

  return value.mode === "plan" || value.mode === "default" ? value.mode : null;
}

function turnErrorMessage(error: unknown): string | null {
  if (!isRecord(error) || typeof error.message !== "string") {
    return null;
  }

  const details = typeof error.additionalDetails === "string" && error.additionalDetails.trim()
    ? `：${error.additionalDetails}`
    : "";
  return `${error.message}${details}`;
}

function normalizeGoal(value: unknown): BrowserThreadGoal | null {
  if (!isRecord(value) || typeof value.threadId !== "string" || typeof value.objective !== "string") {
    return null;
  }

  return {
    threadId: value.threadId,
    objective: value.objective,
    status: typeof value.status === "string" ? value.status : "active",
    tokenBudget: typeof value.tokenBudget === "number" ? value.tokenBudget : null,
    tokensUsed: numberOrZero(value.tokensUsed),
    timeUsedSeconds: numberOrZero(value.timeUsedSeconds),
    createdAt: numberOrZero(value.createdAt),
    updatedAt: numberOrZero(value.updatedAt)
  };
}

function joinSearchPath(root: string, searchPath: string): string {
  if (/^[A-Za-z]:[\\/]/.test(searchPath) || searchPath.startsWith("\\\\")) {
    return searchPath;
  }

  const separator = root.includes("\\") ? "\\" : "/";
  return `${root.replace(/[\\/]+$/, "")}${separator}${searchPath.replace(/^[\\/]+/, "")}`;
}

function normalizeFileSearchResult(value: unknown): BrowserFileSearchResult | null {
  if (!isRecord(value) || typeof value.root !== "string" || typeof value.path !== "string") {
    return null;
  }

  const matchType = value.match_type === "directory" ? "directory" : "file";
  const fileName = typeof value.file_name === "string" ? value.file_name : value.path.split(/[\\/]/).at(-1) || value.path;

  return {
    root: value.root,
    path: value.path,
    fullPath: joinSearchPath(value.root, value.path),
    fileName,
    matchType,
    score: numberOrZero(value.score),
    indices: Array.isArray(value.indices) ? value.indices.filter((index): index is number => typeof index === "number") : null
  };
}

function normalizeRealtimeAudio(value: unknown): BrowserRealtimeAudioChunk | null {
  if (
    !isRecord(value) ||
    typeof value.data !== "string" ||
    typeof value.sampleRate !== "number" ||
    typeof value.numChannels !== "number"
  ) {
    return null;
  }

  return {
    data: value.data,
    sampleRate: value.sampleRate,
    numChannels: value.numChannels,
    samplesPerChannel: typeof value.samplesPerChannel === "number" ? value.samplesPerChannel : null,
    itemId: typeof value.itemId === "string" ? value.itemId : null
  };
}

export function normalizeAppServerNotification(
  message: AppServerNotificationMessage
): BrowserAppServerNotificationEnvelope | null {
  if (message.method === "serverRequest/resolved") {
    const params = message.params as { requestId?: unknown } | null | undefined;
    if (!params || (typeof params.requestId !== "number" && typeof params.requestId !== "string")) {
      return null;
    }

    return { type: "server-request-resolved", requestId: String(params.requestId) };
  }

  if (message.method === "turn/started") {
    const params = message.params as { threadId?: unknown; turn?: { id?: unknown } } | null | undefined;
    if (!params || typeof params.threadId !== "string" || typeof params.turn?.id !== "string") {
      return null;
    }

    return {
      type: "codex-event",
      event: {
        kind: "turn_started",
        threadId: params.threadId,
        turnId: params.turn.id
      }
    };
  }

  if (message.method === "turn/completed") {
    const params = message.params as
      | { threadId?: unknown; turn?: { id?: unknown; status?: unknown } }
      | null
      | undefined;
    if (!params || typeof params.threadId !== "string" || typeof params.turn?.id !== "string") {
      return null;
    }

    return {
      type: "codex-event",
      event: {
        kind: "turn_completed",
        threadId: params.threadId,
        turnId: params.turn.id,
        status: typeof params.turn.status === "string" ? params.turn.status : "completed"
      }
    };
  }

  if (message.method === "thread/status/changed") {
    const params = message.params as { threadId?: unknown; status?: unknown } | null | undefined;
    if (!params || typeof params.threadId !== "string" || !isRecord(params.status)) {
      return null;
    }
    const status = typeof params.status.type === "string" ? params.status.type : null;
    if (!status) {
      return null;
    }
    const activeFlags = Array.isArray(params.status.activeFlags) ? params.status.activeFlags : null;

    return {
      type: "codex-event",
      event: {
        kind: "thread_status_changed",
        threadId: params.threadId,
        status,
        ...(activeFlags ? { activeFlags } : {})
      }
    };
  }

  if (message.method === "turn/plan/updated") {
    const params = message.params as { threadId?: unknown; turnId?: unknown; plan?: unknown } | null | undefined;
    if (!params || typeof params.threadId !== "string" || typeof params.turnId !== "string") {
      return null;
    }

    return {
      type: "codex-event",
      event: {
        kind: "plan.delta",
        threadId: params.threadId,
        turnId: params.turnId,
        plan: normalizePlanSteps(params.plan)
      }
    };
  }

  if (message.method === "hook/started" || message.method === "hook/completed") {
    const params = message.params as { threadId?: unknown; turnId?: unknown; run?: unknown } | null | undefined;
    if (!params || typeof params.threadId !== "string") {
      return null;
    }
    const item = hookRunTimelineItem(params.run);
    if (!item) {
      return null;
    }

    return {
      type: "codex-event",
      event: {
        kind: "item_updated",
        threadId: params.threadId,
        turnId: typeof params.turnId === "string" ? params.turnId : item.id,
        completedAtMs: Date.now(),
        item
      }
    };
  }

  if (message.method === "item/agentMessage/delta") {
    return deltaEvent("agent_message_delta", message.params);
  }

  if (message.method === "item/reasoning/textDelta" || message.method === "item/reasoning/summaryTextDelta") {
    return deltaEvent("reasoning_delta", message.params);
  }

  if (message.method === "item/reasoning/summaryPartAdded") {
    const params = message.params as { threadId?: unknown; turnId?: unknown; itemId?: unknown } | null | undefined;
    if (!params || typeof params.threadId !== "string" || typeof params.turnId !== "string" || typeof params.itemId !== "string") {
      return null;
    }
    return {
      type: "codex-event",
      event: {
        kind: "reasoning_started",
        threadId: params.threadId,
        turnId: params.turnId,
        itemId: params.itemId
      }
    };
  }

  if (message.method === "item/plan/delta") {
    return deltaEvent("plan_delta", message.params);
  }

  if (message.method === "item/commandExecution/outputDelta") {
    return deltaEvent("command_output_delta", message.params);
  }

  if (message.method === "item/commandExecution/terminalInteraction") {
    const params = message.params as { threadId?: unknown; turnId?: unknown; itemId?: unknown; stdin?: unknown } | null | undefined;
    if (
      !params ||
      typeof params.threadId !== "string" ||
      typeof params.turnId !== "string" ||
      typeof params.itemId !== "string" ||
      typeof params.stdin !== "string"
    ) {
      return null;
    }

    return {
      type: "codex-event",
      event: {
        kind: "command_output_delta",
        threadId: params.threadId,
        turnId: params.turnId,
        itemId: params.itemId,
        delta: `\n$ ${params.stdin}`
      }
    };
  }

  if (message.method === "command/exec/outputDelta") {
    return processDeltaEvent("command", message.params);
  }

  if (message.method === "process/outputDelta") {
    return processDeltaEvent("process", message.params);
  }

  if (message.method === "item/fileChange/outputDelta") {
    return deltaEvent("file_output_delta", message.params);
  }

  if (message.method === "item/fileChange/patchUpdated") {
    const params = message.params as {
      threadId?: unknown;
      turnId?: unknown;
      itemId?: unknown;
      changes?: unknown;
    } | null | undefined;
    if (
      !params ||
      typeof params.threadId !== "string" ||
      typeof params.turnId !== "string" ||
      typeof params.itemId !== "string" ||
      !Array.isArray(params.changes)
    ) {
      return null;
    }
    const changes = params.changes.flatMap((change) =>
      isRecord(change) && typeof change.path === "string" && typeof change.diff === "string"
        ? [{ path: change.path, kind: change.kind, diff: change.diff }]
        : []
    );
    return {
      type: "codex-event",
      event: {
        kind: "file_output_delta",
        threadId: params.threadId,
        turnId: params.turnId,
        itemId: params.itemId,
        delta: changes.map((change) => change.diff).filter(Boolean).join("\n"),
        changes
      }
    };
  }

  if (message.method === "item/mcpToolCall/progress") {
    const params = message.params as { threadId?: unknown; turnId?: unknown; itemId?: unknown; message?: unknown } | null | undefined;
    if (
      !params ||
      typeof params.threadId !== "string" ||
      typeof params.turnId !== "string" ||
      typeof params.itemId !== "string" ||
      typeof params.message !== "string"
    ) {
      return null;
    }
    return {
      type: "codex-event",
      event: {
        kind: "tool_output_delta",
        threadId: params.threadId,
        turnId: params.turnId,
        itemId: params.itemId,
        delta: params.message,
        server: "mcp",
        tool: "progress",
        toolKind: "mcp"
      }
    };
  }

  if (message.method === "item/completed" || message.method === "item/started") {
    const params = message.params as
      | { threadId?: unknown; turnId?: unknown; item?: unknown; completedAtMs?: unknown; startedAtMs?: unknown }
      | null
      | undefined;
    if (!params || typeof params.threadId !== "string" || typeof params.turnId !== "string") {
      return null;
    }
    const item = params.item ? timelineItem(params.item as Parameters<typeof timelineItem>[0]) : null;
    if (!item) return null;
    if (message.method === "item/started" && item.role === "reasoning") {
      return {
        type: "codex-event",
        event: {
          kind: "reasoning_started",
          threadId: params.threadId,
          turnId: params.turnId,
          itemId: item.id
        }
      };
    }

    const lifecycleItem =
      item.systemKind === "context-compaction"
        ? {
            ...item,
            text: message.method === "item/started" ? "正在自动压缩上下文" : "压缩上下文已完成",
            status: message.method === "item/started" ? "running" as const : "success" as const
          }
        : item;

    return {
      type: "codex-event",
      event: {
        kind: "item_updated",
        threadId: params.threadId,
        turnId: params.turnId,
        completedAtMs:
          typeof params.completedAtMs === "number"
            ? params.completedAtMs
            : typeof params.startedAtMs === "number"
              ? params.startedAtMs
              : Date.now(),
        item: lifecycleItem
      }
    };
  }

  if (message.method === "rawResponseItem/completed") {
    const params = message.params as {
      threadId?: unknown;
      turnId?: unknown;
      item?: unknown;
      responseId?: unknown;
      absoluteOutputIndex?: unknown;
    } | null | undefined;
    if (!params || typeof params.threadId !== "string" || typeof params.turnId !== "string") {
      return null;
    }
    const item = rawResponseTimelineItem(
      params.item,
      typeof params.responseId === "string" &&
      typeof params.absoluteOutputIndex === "number" &&
      Number.isSafeInteger(params.absoluteOutputIndex) &&
      params.absoluteOutputIndex >= 0
        ? { responseId: params.responseId, absoluteOutputIndex: params.absoluteOutputIndex }
        : undefined
    );
    if (!item) return null;

    return {
      type: "codex-event",
      event: {
        kind: "item_updated",
        threadId: params.threadId,
        turnId: params.turnId,
        completedAtMs: Date.now(),
        item
      }
    };
  }

  if (message.method === "turn/diff/updated") {
    const params = message.params as { threadId?: unknown; turnId?: unknown; diff?: unknown } | null | undefined;
    if (!params || !params.threadId || !params.turnId || typeof params.diff !== "string") {
      return null;
    }

    return {
      type: "codex-event",
      event: {
        kind: "turn_diff_updated",
        threadId: String(params.threadId),
        turnId: String(params.turnId),
        diff: params.diff
      }
    };
  }

  if (message.method === "thread/tokenUsage/updated") {
    const params = message.params as
      | {
          threadId?: unknown;
          turnId?: unknown;
          tokenUsage?: { total?: Record<string, unknown>; last?: Record<string, unknown>; modelContextWindow?: unknown };
        }
      | null
      | undefined;
    if (!params?.threadId || !params.turnId || !params.tokenUsage?.total) {
      return null;
    }
    const usage = params.tokenUsage.last ?? params.tokenUsage.total;

    return {
      type: "codex-event",
      event: {
        kind: "token_usage_updated",
        threadId: String(params.threadId),
        turnId: String(params.turnId),
        totalTokens: numberOrZero(usage.totalTokens),
        inputTokens: numberOrZero(usage.inputTokens),
        outputTokens: numberOrZero(usage.outputTokens),
        reasoningOutputTokens: numberOrZero(usage.reasoningOutputTokens),
        modelContextWindow:
          typeof params.tokenUsage.modelContextWindow === "number" ? params.tokenUsage.modelContextWindow : null
      }
    };
  }

  if (message.method === "thread/compacted") {
    const params = message.params as { threadId?: unknown; turnId?: unknown } | null | undefined;
    if (!params || typeof params.threadId !== "string" || typeof params.turnId !== "string") {
      return null;
    }

    return {
      type: "codex-event",
      event: {
        kind: "context_compacted",
        threadId: params.threadId,
        turnId: params.turnId
      }
    };
  }

  if (message.method === "warning") {
    const params = message.params as { threadId?: unknown; message?: unknown } | null | undefined;
    if (!params || typeof params.message !== "string") {
      return null;
    }

    return {
      type: "codex-event",
      event: {
        kind: "warning",
        threadId: typeof params.threadId === "string" ? params.threadId : null,
        message: params.message
      }
    };
  }

  if (message.method === "error") {
    const params = message.params as
      | { threadId?: unknown; turnId?: unknown; error?: unknown; willRetry?: unknown }
      | null
      | undefined;
    const errorMessage = turnErrorMessage(params?.error);
    if (!params || typeof params.threadId !== "string" || typeof params.turnId !== "string" || !errorMessage) {
      return null;
    }

    return {
      type: "codex-event",
      event: {
        kind: "turn_error",
        threadId: params.threadId,
        turnId: params.turnId,
        message: errorMessage,
        willRetry: Boolean(params.willRetry)
      }
    };
  }

  if (message.method === "configWarning") {
    const params = message.params as { summary?: unknown; details?: unknown } | null | undefined;
    if (!params || typeof params.summary !== "string") {
      return null;
    }
    const details = typeof params.details === "string" && params.details.trim() ? `：${params.details}` : "";

    return {
      type: "codex-event",
      event: {
        kind: "warning",
        threadId: null,
        message: `${params.summary}${details}`
      }
    };
  }

  if (
    message.method === "account/updated" ||
    message.method === "account/rateLimits/updated" ||
    message.method === "mcpServer/startupStatus/updated" ||
    message.method === "remoteControl/status/changed"
  ) {
    return {
      type: "codex-event",
      event: {
        kind: "settings_invalidated"
      }
    };
  }

  if (message.method === "skills/changed") {
    return {
      type: "codex-event",
      event: {
        kind: "skills_changed"
      }
    };
  }

  if (message.method === "thread/settings/updated") {
    const params = message.params as { threadId?: unknown; threadSettings?: unknown } | null | undefined;
    if (!params || typeof params.threadId !== "string" || !isRecord(params.threadSettings)) {
      return null;
    }

    return {
      type: "codex-event",
      event: {
        kind: "thread_settings_updated",
        threadId: params.threadId,
        model: stringOrNull(params.threadSettings.model),
        reasoningEffort: stringOrNull(params.threadSettings.effort),
        approvalsReviewer: stringOrNull(params.threadSettings.approvalsReviewer),
        activePermissionProfile: activePermissionProfileOrNull(params.threadSettings.activePermissionProfile),
        collaborationMode: collaborationModeKind(params.threadSettings.collaborationMode)
      }
    };
  }

  if (message.method === "thread/goal/updated") {
    const params = message.params as { threadId?: unknown; goal?: unknown } | null | undefined;
    const goal = normalizeGoal(params?.goal);
    if (!params || typeof params.threadId !== "string" || !goal) {
      return null;
    }

    return {
      type: "codex-event",
      event: {
        kind: "thread_goal_updated",
        threadId: params.threadId,
        goal
      }
    };
  }

  if (message.method === "thread/goal/cleared") {
    const params = message.params as { threadId?: unknown } | null | undefined;
    if (!params || typeof params.threadId !== "string") {
      return null;
    }

    return {
      type: "codex-event",
      event: {
        kind: "thread_goal_cleared",
        threadId: params.threadId
      }
    };
  }

  if (message.method === "fs/changed") {
    const params = message.params as { watchId?: unknown; changedPaths?: unknown } | null | undefined;
    if (!params || typeof params.watchId !== "string" || !Array.isArray(params.changedPaths)) {
      return null;
    }

    return {
      type: "codex-event",
      event: {
        kind: "fs_changed",
        watchId: params.watchId,
        paths: params.changedPaths.filter((changedPath): changedPath is string => typeof changedPath === "string")
      }
    };
  }

  if (message.method === "fuzzyFileSearch/sessionUpdated") {
    const params = message.params as { sessionId?: unknown; query?: unknown; files?: unknown } | null | undefined;
    if (!params || typeof params.sessionId !== "string" || typeof params.query !== "string" || !Array.isArray(params.files)) {
      return null;
    }

    return {
      type: "codex-event",
      event: {
        kind: "file_search_session_updated",
        sessionId: params.sessionId,
        query: params.query,
        results: params.files.flatMap((file) => {
          const result = normalizeFileSearchResult(file);
          return result ? [result] : [];
        })
      }
    };
  }

  if (message.method === "fuzzyFileSearch/sessionCompleted") {
    const params = message.params as { sessionId?: unknown } | null | undefined;
    if (!params || typeof params.sessionId !== "string") {
      return null;
    }

    return {
      type: "codex-event",
      event: {
        kind: "file_search_session_completed",
        sessionId: params.sessionId
      }
    };
  }

  if (message.method === "thread/realtime/started") {
    const params = message.params as { threadId?: unknown; realtimeSessionId?: unknown; version?: unknown } | null | undefined;
    if (!params || typeof params.threadId !== "string" || typeof params.version !== "string") {
      return null;
    }

    return {
      type: "codex-event",
      event: {
        kind: "realtime_started",
        threadId: params.threadId,
        realtimeSessionId: typeof params.realtimeSessionId === "string" ? params.realtimeSessionId : null,
        version: params.version
      }
    };
  }

  if (message.method === "thread/realtime/transcript/delta") {
    const params = message.params as { threadId?: unknown; role?: unknown; delta?: unknown } | null | undefined;
    if (!params || typeof params.threadId !== "string" || typeof params.role !== "string" || typeof params.delta !== "string") {
      return null;
    }

    return {
      type: "codex-event",
      event: {
        kind: "realtime_transcript_delta",
        threadId: params.threadId,
        role: params.role,
        delta: params.delta
      }
    };
  }

  if (message.method === "thread/realtime/transcript/done") {
    const params = message.params as { threadId?: unknown; role?: unknown; text?: unknown } | null | undefined;
    if (!params || typeof params.threadId !== "string" || typeof params.role !== "string" || typeof params.text !== "string") {
      return null;
    }

    return {
      type: "codex-event",
      event: {
        kind: "realtime_transcript_done",
        threadId: params.threadId,
        role: params.role,
        text: params.text
      }
    };
  }

  if (message.method === "thread/realtime/outputAudio/delta") {
    const params = message.params as { threadId?: unknown; audio?: unknown } | null | undefined;
    const audio = normalizeRealtimeAudio(params?.audio);
    if (!params || typeof params.threadId !== "string" || !audio) {
      return null;
    }

    return {
      type: "codex-event",
      event: {
        kind: "realtime_output_audio_delta",
        threadId: params.threadId,
        audio
      }
    };
  }

  if (message.method === "thread/realtime/error") {
    const params = message.params as { threadId?: unknown; message?: unknown } | null | undefined;
    if (!params || typeof params.threadId !== "string" || typeof params.message !== "string") {
      return null;
    }

    return {
      type: "codex-event",
      event: {
        kind: "realtime_error",
        threadId: params.threadId,
        message: params.message
      }
    };
  }

  if (message.method === "thread/realtime/closed") {
    const params = message.params as { threadId?: unknown; reason?: unknown } | null | undefined;
    if (!params || typeof params.threadId !== "string") {
      return null;
    }

    return {
      type: "codex-event",
      event: {
        kind: "realtime_closed",
        threadId: params.threadId,
        reason: typeof params.reason === "string" ? params.reason : null
      }
    };
  }

  if (message.method === "externalAgentConfig/import/completed") {
    const params = message.params as { importId?: unknown; itemTypeResults?: unknown } | null | undefined;
    if (!params || typeof params.importId !== "string" || !Array.isArray(params.itemTypeResults)) {
      return null;
    }

    return {
      type: "codex-event",
      event: {
        kind: "external_agent_config_import_completed",
        importId: params.importId,
        itemTypeResults: params.itemTypeResults
      }
    };
  }

  return null;
}
