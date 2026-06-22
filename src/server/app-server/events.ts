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
    }
  | {
      kind: "warning";
      threadId: string | null;
      message: string;
    }
  | {
      kind: "settings_invalidated";
    }
  | {
      kind: "thread_goal_updated";
      threadId: string;
      goal: BrowserThreadGoal;
    }
  | {
      kind: "thread_goal_cleared";
      threadId: string;
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

  return null;
}
