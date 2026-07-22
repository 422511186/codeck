export type AppServerServerRequestMessage = {
  id: number;
  method: string;
  params?: unknown;
};

export class PendingServerRequestOptionError extends Error {
  readonly httpStatus = 400 as const;

  constructor() {
    super("审批选项无效或已过期");
    this.name = "PendingServerRequestOptionError";
  }
}

export type PendingRequestOption = {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
};

export type PendingServerRequestView = {
  requestId: number;
  kind:
    | "command_approval"
    | "file_approval"
    | "permissions_approval"
    | "question"
    | "mcp_elicitation"
    | "dynamic_tool"
    | "unknown";
  method: string;
  threadId?: string;
  turnId?: string;
  itemId?: string;
  title: string;
  description: string;
  options: PendingRequestOption[];
  params: unknown;
};

export type BrowserServerRequestEnvelope = {
  type: "server-request";
  request: PendingServerRequestView;
};

export type BrowserServerRequestResolvedEnvelope = {
  type: "server-request-resolved";
  requestId: string;
};

export type BrowserServerRequestEvent = BrowserServerRequestEnvelope | BrowserServerRequestResolvedEnvelope;

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function stringField(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === "string" ? value : undefined;
}

function approvalOptions(values: unknown, params: Record<string, unknown> = {}): PendingRequestOption[] {
  const decisions = Array.isArray(values) && values.length > 0 ? values : ["accept", "decline"];
  return decisions.map((decision, index) => {
    if (typeof decision === "string") {
      const labelByValue: Record<string, string> = {
        accept: "允许一次",
        acceptForSession: "本次会话允许",
        decline: "拒绝",
        cancel: "中断"
      };
      const label = labelByValue[decision];
      return label
        ? { value: decision, label }
        : {
            value: decision,
            label: "不支持的审批选项",
            description: "当前客户端无法安全表达该审批选项",
            disabled: true
          };
    }

    const value = `decision:${index}`;
    const structured = structuredDecisionPresentation(decision, params);
    return {
      value,
      label: structured?.label ?? "不支持的审批选项",
      ...(structured?.description
        ? { description: structured.description }
        : { description: "当前客户端无法安全表达该审批选项" }),
      ...(structured ? {} : { disabled: true })
    };
  });
}

function structuredDecisionPresentation(
  decision: unknown,
  params: Record<string, unknown>
): { label: string; description?: string } | null {
  const record = asRecord(decision);
  const execPolicy = asRecord(record.acceptWithExecpolicyAmendment);
  const execAmendment = execPolicy.execpolicy_amendment;
  if (Array.isArray(execAmendment) && execAmendment.every((token) => typeof token === "string")) {
    return {
      label: "允许并应用命令规则",
      description: stringField(params, "command") || execAmendment.join(" ")
    };
  }

  const network = asRecord(record.applyNetworkPolicyAmendment);
  const amendment = asRecord(network.network_policy_amendment);
  if (
    typeof amendment.host === "string" &&
    (amendment.action === "allow" || amendment.action === "deny")
  ) {
    return {
      label: "应用网络规则",
      description: `${amendment.action === "allow" ? "允许" : "拒绝"} ${amendment.host}`
    };
  }

  return null;
}

function questionOptions(params: Record<string, unknown>): PendingRequestOption[] {
  const questions = Array.isArray(params.questions) ? params.questions : [];
  const firstQuestion = asRecord(questions[0]);
  const options = Array.isArray(firstQuestion.options) ? firstQuestion.options : [];

  return options.map((option) => {
    const optionRecord = asRecord(option);
    const label = stringField(optionRecord, "label") || "";
    return {
      value: stringField(optionRecord, "id") || label,
      label,
      description: stringField(optionRecord, "description")
    };
  });
}

function questionId(params: Record<string, unknown>): string | null {
  const questions = Array.isArray(params.questions) ? params.questions : [];
  const firstQuestion = asRecord(questions[0]);
  return stringField(firstQuestion, "id") || null;
}

function firstQuestionText(params: Record<string, unknown>): string {
  const questions = Array.isArray(params.questions) ? params.questions : [];
  const firstQuestion = asRecord(questions[0]);
  return stringField(firstQuestion, "question") || "Codex 需要你提供更多信息";
}

function dynamicToolDescription(params: Record<string, unknown>): string {
  const namespace = stringField(params, "namespace");
  const tool = stringField(params, "tool") || "unknown";
  const qualifiedName = namespace ? `${namespace}/${tool}` : tool;
  return `${qualifiedName}\n${JSON.stringify(params.arguments ?? {})}`;
}

export function normalizePendingServerRequest(message: AppServerServerRequestMessage): PendingServerRequestView {
  const params = asRecord(message.params);
  const base = {
    requestId: message.id,
    method: message.method,
    threadId: stringField(params, "threadId"),
    turnId: stringField(params, "turnId") || undefined,
    itemId: stringField(params, "itemId") || undefined,
    params: message.params
  };

  if (message.method === "item/commandExecution/requestApproval") {
    return {
      ...base,
      kind: "command_approval",
      title: "命令审批",
      description: stringField(params, "command") || stringField(params, "reason") || "Codex 请求执行命令",
      options: approvalOptions(params.availableDecisions, params)
    };
  }

  if (message.method === "item/fileChange/requestApproval") {
    return {
      ...base,
      kind: "file_approval",
      title: "文件变更审批",
      description: stringField(params, "reason") || stringField(params, "grantRoot") || "Codex 请求修改文件",
      options: approvalOptions(["accept", "decline"], params)
    };
  }

  if (message.method === "item/tool/requestUserInput") {
    return {
      ...base,
      kind: "question",
      title: "需要你回答",
      description: firstQuestionText(params),
      options: questionOptions(params)
    };
  }

  if (message.method === "mcpServer/elicitation/request") {
    return {
      ...base,
      kind: "mcp_elicitation",
      title: "MCP 请求",
      description: stringField(params, "message") || "MCP 服务器需要你确认",
      options: approvalOptions(["accept", "decline", "cancel"], params)
    };
  }

  if (message.method === "item/permissions/requestApproval") {
    return {
      ...base,
      kind: "permissions_approval",
      title: "权限审批",
      description: stringField(params, "reason") || stringField(params, "cwd") || "Codex 请求新的权限",
      options: approvalOptions(["accept", "decline"], params)
    };
  }

  if (message.method === "item/tool/call") {
    return {
      ...base,
      kind: "dynamic_tool",
      title: "动态工具调用",
      description: dynamicToolDescription(params),
      options: [
        { value: "submit", label: "回传结果" },
        { value: "fail", label: "标记失败" }
      ]
    };
  }

  return {
    ...base,
    kind: "unknown",
    title: "Codex 请求",
    description: message.method,
    options: []
  };
}

export function buildPendingServerRequestResponse(request: PendingServerRequestView, value: string): unknown {
  const params = asRecord(request.params);

  if (request.kind === "command_approval" || request.kind === "file_approval") {
    return { decision: approvalDecisionForRequest(request, value) };
  }

  if (request.kind === "permissions_approval") {
    assertAvailableOption(request, value);
    if (value === "accept") {
      return {
        permissions: asRecord(params.permissions),
        scope: "session"
      };
    }

    return {
      permissions: {},
      scope: "turn"
    };
  }

  if (request.kind === "question") {
    assertAvailableOption(request, value);
    const id = questionId(params);
    if (!id) {
      throw new Error("question 缺少 id，无法回答");
    }

    return {
      answers: {
        [id]: {
          answers: [value]
        }
      }
    };
  }

  if (request.kind === "mcp_elicitation") {
    assertAvailableOption(request, value);
    return {
      action: value,
      content: value === "accept" ? {} : null,
      _meta: null
    };
  }

  if (request.kind === "dynamic_tool") {
    if (value === "fail") {
      return {
        success: false,
        contentItems: [{ type: "inputText", text: "用户在移动端标记动态工具调用失败" }]
      };
    }

    return {
      success: true,
      contentItems: [{ type: "inputText", text: value }]
    };
  }

  return { decision: value };
}

function approvalDecisionForRequest(request: PendingServerRequestView, value: string): unknown {
  const optionIndex = request.options.findIndex((option) => option.value === value);
  const option = optionIndex >= 0 ? request.options[optionIndex] : undefined;
  if (!option || option.disabled) {
    throw new PendingServerRequestOptionError();
  }

  const params = asRecord(request.params);
  const fallbackDecisions = request.kind === "file_approval" ? ["accept", "decline"] : ["accept", "decline"];
  const decisions = Array.isArray(params.availableDecisions) && params.availableDecisions.length
    ? params.availableDecisions
    : fallbackDecisions;
  const rawDecision = decisions[optionIndex];
  if (typeof rawDecision === "string" && rawDecision === value) {
    return rawDecision;
  }
  if (value === `decision:${optionIndex}` && rawDecision && typeof rawDecision === "object") {
    if (structuredDecisionPresentation(rawDecision, params)) {
      return rawDecision;
    }
  }
  throw new PendingServerRequestOptionError();
}

function assertAvailableOption(request: PendingServerRequestView, value: string): void {
  const option = request.options.find((candidate) => candidate.value === value);
  if (!option || option.disabled) {
    throw new PendingServerRequestOptionError();
  }
}
