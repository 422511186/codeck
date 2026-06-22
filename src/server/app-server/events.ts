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
      kind: "turn_diff_updated";
      threadId: string;
      turnId: string;
      diff: string;
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

function isDeltaParams(value: unknown): value is DeltaParams {
  return (
    typeof value === "object" &&
    value !== null &&
    "threadId" in value &&
    "turnId" in value &&
    "itemId" in value &&
    "delta" in value
  );
}

function deltaEvent(kind: BrowserCodexEvent["kind"], params: unknown): BrowserCodexEventEnvelope | null {
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
    } as BrowserCodexEvent
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

  return null;
}
