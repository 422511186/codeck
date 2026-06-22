export type AppServerNotificationMessage = {
  method: string;
  params?: unknown;
};

export type BrowserCodexEvent =
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
      kind: "turn_diff_updated";
      threadId: string;
      turnId: string;
      diff: string;
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

type DeltaEventKind = Extract<BrowserCodexEvent, { delta: string }>["kind"];

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

export function normalizeAppServerNotification(
  message: AppServerNotificationMessage
): BrowserCodexEventEnvelope | null {
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

  return null;
}
