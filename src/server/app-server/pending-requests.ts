export type AppServerServerRequestMessage = {
  id: number;
  method: string;
  params?: unknown;
};

export type PendingRequestOption = {
  value: string;
  label: string;
  description?: string;
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
  requestId: number;
};

export type BrowserServerRequestEvent = BrowserServerRequestEnvelope | BrowserServerRequestResolvedEnvelope;

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function stringField(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === "string" ? value : undefined;
}

function approvalOptions(values: unknown): PendingRequestOption[] {
  const decisions = Array.isArray(values) && values.length > 0 ? values : ["accept", "decline"];
  return decisions.map((decision) => {
    const value = typeof decision === "string" ? decision : JSON.stringify(decision);
    const labelByValue: Record<string, string> = {
      accept: "允许",
      acceptForSession: "本次会话允许",
      decline: "拒绝",
      cancel: "取消"
    };

    return {
      value,
      label: labelByValue[value] || value
    };
  });
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

function firstQuestionText(params: Record<string, unknown>): string {
  const questions = Array.isArray(params.questions) ? params.questions : [];
  const firstQuestion = asRecord(questions[0]);
  return stringField(firstQuestion, "question") || "Codex 需要你提供更多信息";
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
      options: approvalOptions(params.availableDecisions)
    };
  }

  if (message.method === "item/fileChange/requestApproval") {
    return {
      ...base,
      kind: "file_approval",
      title: "文件变更审批",
      description: stringField(params, "reason") || stringField(params, "grantRoot") || "Codex 请求修改文件",
      options: approvalOptions(["accept", "decline"])
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
      options: []
    };
  }

  if (message.method === "item/permissions/requestApproval") {
    return {
      ...base,
      kind: "permissions_approval",
      title: "权限审批",
      description: stringField(params, "reason") || stringField(params, "cwd") || "Codex 请求新的权限",
      options: approvalOptions(["accept", "decline"])
    };
  }

  if (message.method === "item/tool/call") {
    return {
      ...base,
      kind: "dynamic_tool",
      title: "工具调用",
      description: "Codex 请求调用动态工具",
      options: approvalOptions(["accept", "decline"])
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
