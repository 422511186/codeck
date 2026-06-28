import type { MobileTimelineItem } from "../../shared/codex";
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
      kind: "agent_message_delta";
      threadId: string;
      turnId: string;
      itemId: string;
      delta: string;
    }
  | {
      kind: "reasoning_delta";
      threadId: string;
      turnId: string;
      itemId: string;
      delta: string;
    }
  | {
      kind: "plan_delta";
      threadId: string;
      turnId: string;
      itemId: string;
      delta: string;
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
    }
  | {
      kind: "item_updated";
      threadId: string;
      turnId: string;
      completedAtMs: number;
      item: MobileTimelineItem;
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
      kind: "thread_settings_updated";
      threadId: string;
      model: string | null;
      reasoningEffort: string | null;
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

export type BrowserCodexEventEnvelope = {
  type: "codex-event";
  event: BrowserCodexEvent;
};

type DeltaParams = {
  threadId: string;
  turnId: string;
  itemId: string;
  delta: string;
};

type DeltaEventKind = Extract<BrowserCodexEvent, { turnId: string; itemId: string; delta: string }>["kind"];

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

function numberOrZero(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null;
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
): BrowserCodexEventEnvelope | null {
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

  if (message.method === "item/agentMessage/delta") {
    return deltaEvent("agent_message_delta", message.params);
  }

  if (message.method === "item/reasoning/textDelta" || message.method === "item/reasoning/summaryTextDelta") {
    return deltaEvent("reasoning_delta", message.params);
  }

  if (message.method === "item/plan/delta") {
    return deltaEvent("plan_delta", message.params);
  }

  if (message.method === "item/commandExecution/outputDelta") {
    return deltaEvent("command_output_delta", message.params);
  }

  if (message.method === "item/fileChange/outputDelta") {
    return deltaEvent("file_output_delta", message.params);
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
      | { threadId?: unknown; turnId?: unknown; tokenUsage?: { total?: Record<string, unknown>; modelContextWindow?: unknown } }
      | null
      | undefined;
    if (!params?.threadId || !params.turnId || !params.tokenUsage?.total) {
      return null;
    }

    return {
      type: "codex-event",
      event: {
        kind: "token_usage_updated",
        threadId: String(params.threadId),
        turnId: String(params.turnId),
        totalTokens: numberOrZero(params.tokenUsage.total.totalTokens),
        inputTokens: numberOrZero(params.tokenUsage.total.inputTokens),
        outputTokens: numberOrZero(params.tokenUsage.total.outputTokens),
        reasoningOutputTokens: numberOrZero(params.tokenUsage.total.reasoningOutputTokens),
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
