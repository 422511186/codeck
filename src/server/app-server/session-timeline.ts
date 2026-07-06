import type { MobileThreadContextUsage, MobileTimelineItem } from "../../shared/codex";

type SessionTimelineRecord =
  | {
      kind: "message";
      turnId: string;
      text: string;
      sequence: number;
    }
  | {
      kind: "tool";
      turnId: string;
      item: MobileTimelineItem;
      sequence: number;
      callId: string | null;
    };
type SessionToolRecord = Extract<SessionTimelineRecord, { kind: "tool" }>;

const SESSION_TOOL_TEXT_LIMIT = 12_000;
const INTERNAL_CONTROL_TOOL_NAMES = new Set(["update_plan", "write_stdin", "read_thread", "list_threads", "read_thread_terminal"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stringifyJson(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function truncateToolText(text: string): string {
  if (text.length <= SESSION_TOOL_TEXT_LIMIT) {
    return text;
  }
  return `${text.slice(0, SESSION_TOOL_TEXT_LIMIT)}\n...`;
}

function payloadTurnId(payload: Record<string, unknown>): string | null {
  const passthrough = isRecord(payload.internal_chat_message_metadata_passthrough)
    ? payload.internal_chat_message_metadata_passthrough
    : null;
  if (typeof passthrough?.turn_id === "string") {
    return passthrough.turn_id;
  }

  const metadata = isRecord(payload.metadata) ? payload.metadata : null;
  return typeof metadata?.turn_id === "string" ? metadata.turn_id : null;
}

function rawMessageText(payload: Record<string, unknown>): string {
  if (typeof payload.text === "string") {
    return payload.text;
  }
  if (typeof payload.output_text === "string") {
    return payload.output_text;
  }
  if (typeof payload.content === "string") {
    return payload.content;
  }
  if (!Array.isArray(payload.content)) {
    return "";
  }
  return payload.content
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

function parseJsonObject(text: unknown): Record<string, unknown> | null {
  if (isRecord(text)) {
    return text;
  }
  if (typeof text !== "string" || !text.trim()) {
    return null;
  }
  try {
    const parsed = JSON.parse(text);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function shellWords(command: string): string[] {
  const words: string[] = [];
  const pattern = /"([^"]*)"|'([^']*)'|(\S+)/g;
  for (const match of command.matchAll(pattern)) {
    const word = match[1] ?? match[2] ?? match[3] ?? "";
    if (word) {
      words.push(word);
    }
  }
  return words;
}

function firstShellCommand(command: string): string {
  const trimmed = command.trim();
  const firstSegment = trimmed.split(/[;&|]/)[0] ?? trimmed;
  return shellWords(firstSegment)[0] ?? "";
}

function inferCommandActionKind(command: string): "read" | "list" | "search" | "command" {
  const executable = firstShellCommand(command);
  if (/^(rg|grep|find)$/i.test(executable)) {
    return "search";
  }
  if (/^(cat|sed|head|tail|less|nl)$/i.test(executable)) {
    return "read";
  }
  if (/^(ls|dir|tree)$/i.test(executable)) {
    return "list";
  }
  return "command";
}

function skillNameFromCommand(command: string): string | null {
  const match = command.match(/(?:^|[\s'"])(?:[^'"\s]*[\\/])?([^\\/'"\s]+)[\\/]SKILL\.md(?:$|[\s'"])/);
  return match?.[1] ?? null;
}

function skillNameFromOutput(output: string): string | null {
  const match = output.match(/^\s*name:\s*([^\r\n]+)/m);
  return match?.[1]?.trim() || null;
}

function toolStatusFromOutput(output: string): "running" | "success" | "failed" {
  const exitMatch = output.match(/Process exited with code\s+(-?\d+)/i);
  if (exitMatch) {
    return exitMatch[1] === "0" ? "success" : "failed";
  }
  if (/process running with session id/i.test(output)) {
    return "running";
  }
  if (/error|failed|exception/i.test(output)) {
    return "failed";
  }
  return "success";
}

function outputText(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value)) {
    return value
      .map((part) => {
        if (isRecord(part) && typeof part.text === "string") {
          return part.text;
        }
        return stringifyJson(part);
      })
      .filter(Boolean)
      .join("\n");
  }
  return stringifyJson(value);
}

function normalizedToolName(payload: Record<string, unknown>, type: string): string {
  const rawName = typeof payload.name === "string" && payload.name.trim() ? payload.name.trim() : type;
  return rawName.split(".").at(-1) || rawName;
}

function initialToolStatus(payload: Record<string, unknown>): "running" | "success" | "failed" {
  const status = typeof payload.status === "string" ? payload.status.toLowerCase() : "";
  if (status === "completed" || status === "success" || status === "succeeded") {
    return "success";
  }
  if (status === "failed" || status === "error") {
    return "failed";
  }
  return "running";
}

function patchStats(patch: string): { added: number; removed: number } {
  let added = 0;
  let removed = 0;
  for (const line of patch.split(/\r?\n/)) {
    if (line.startsWith("+++") || line.startsWith("---")) {
      continue;
    }
    if (line.startsWith("+")) {
      added += 1;
    } else if (line.startsWith("-")) {
      removed += 1;
    }
  }
  return { added, removed };
}

function patchPrimaryPath(patch: string): string {
  const fileMatch = patch.match(/^\*\*\* (?:Add|Update|Delete) File: (.+)$/m);
  if (fileMatch?.[1]?.trim()) {
    return fileMatch[1].trim();
  }
  const moveMatch = patch.match(/^\*\*\* Move to: (.+)$/m);
  return moveMatch?.[1]?.trim() || "workspace";
}

function toolItemFromFunctionCall(payload: Record<string, unknown>, turnId: string, sequence: number): SessionToolRecord | null {
  const type = typeof payload.type === "string" ? payload.type : "";
  const name = normalizedToolName(payload, type);
  if (INTERNAL_CONTROL_TOOL_NAMES.has(name)) {
    return null;
  }
  const callId = typeof payload.call_id === "string" ? payload.call_id : null;
  const id = typeof payload.id === "string" ? payload.id : callId ?? `${turnId}-tool-${sequence}`;
  const rawArguments = payload.arguments ?? payload.input ?? payload.action;
  const args = parseJsonObject(rawArguments);
  const argumentsText = typeof rawArguments === "string" ? rawArguments : stringifyJson(rawArguments);
  const status = initialToolStatus(payload);

  if (name === "exec_command") {
    const command = typeof args?.cmd === "string" ? args.cmd : "";
    const workdir = typeof args?.workdir === "string" ? args.workdir : "command";
    const skillName = command ? skillNameFromCommand(command) : null;
    if (skillName) {
      return {
        kind: "tool",
        turnId,
        sequence,
        callId,
        item: {
          id,
          turnId,
          role: "tool",
          text: skillName,
          toolKind: "dynamic",
          server: "skills",
          tool: "loaded",
          arguments: argumentsText,
          status
        }
      };
    }

    return {
      kind: "tool",
      turnId,
      sequence,
      callId,
      item: {
        id,
        turnId,
        role: "tool",
        text: command,
        toolKind: "command",
        actionKind: inferCommandActionKind(command),
        server: workdir,
        tool: command || name,
        arguments: argumentsText,
        status
      }
    };
  }

  if (name === "view_image") {
    const imagePath = typeof args?.path === "string" ? args.path : "";
    return {
      kind: "tool",
      turnId,
      sequence,
      callId,
      item: {
        id,
        turnId,
        role: "tool",
        text: imagePath,
        ...(imagePath ? { imagePaths: [imagePath] } : {}),
        toolKind: "image",
        server: "image",
        tool: "view",
        arguments: argumentsText,
        status
      }
    };
  }

  if (name === "tool_search_tool" || name === "tool_search_call" || type === "tool_search_call") {
    const query = typeof args?.query === "string" ? args.query : typeof args?.q === "string" ? args.q : argumentsText;
    return {
      kind: "tool",
      turnId,
      sequence,
      callId,
      item: {
        id,
        turnId,
        role: "tool",
        text: query,
        toolKind: "command",
        actionKind: "search",
        server: "tool-search",
        tool: `search ${query}`.trim(),
        arguments: argumentsText,
        status
      }
    };
  }

  if (name === "apply_patch") {
    const patch = typeof rawArguments === "string" ? rawArguments : argumentsText;
    const targetPath = patchPrimaryPath(patch);
    const stats = patchStats(patch);
    return {
      kind: "tool",
      turnId,
      sequence,
      callId,
      item: {
        id,
        turnId,
        role: "tool",
        text: patch,
        toolKind: "file",
        server: "file",
        tool: targetPath,
        diffPath: targetPath,
        arguments: patch,
        added: stats.added,
        removed: stats.removed,
        status
      }
    };
  }

  return {
    kind: "tool",
    turnId,
    sequence,
    callId,
    item: {
      id,
      turnId,
      role: "tool",
      text: argumentsText,
      toolKind: "dynamic",
      server: "tool",
      tool: name,
      arguments: argumentsText,
      status
    }
  };
}

function applyFunctionOutput(record: SessionToolRecord, output: string): void {
  const nextStatus = toolStatusFromOutput(output);
  if (record.item.server === "skills" && record.item.tool === "loaded") {
    const skillName = skillNameFromOutput(output) ?? record.item.text;
    record.item = {
      ...record.item,
      text: skillName,
      status: nextStatus
    };
    return;
  }

  if (record.item.toolKind === "image" || record.item.toolKind === "file") {
    record.item = { ...record.item, status: nextStatus };
    return;
  }

  record.item = {
    ...record.item,
    text: truncateToolText(output || record.item.text),
    status: nextStatus
  };
}

function contextUsageFromTokenCountRecord(
  payload: Record<string, unknown>,
  timestamp: unknown
): MobileThreadContextUsage | null {
  if (payload.type !== "token_count" || !isRecord(payload.info)) {
    return null;
  }
  const info = payload.info;
  const tokenUsage = isRecord(info.last_token_usage) ? info.last_token_usage : info.total_token_usage;
  if (!isRecord(tokenUsage)) {
    return null;
  }
  const totalTokens = finiteNumber(tokenUsage.total_tokens);
  const inputTokens = finiteNumber(tokenUsage.input_tokens);
  const outputTokens = finiteNumber(tokenUsage.output_tokens);
  const reasoningOutputTokens = finiteNumber(tokenUsage.reasoning_output_tokens);
  if (totalTokens === null || inputTokens === null || outputTokens === null || reasoningOutputTokens === null) {
    return null;
  }

  const modelContextWindow = finiteNumber(info.model_context_window);
  const parsedTimestamp = typeof timestamp === "string" ? Date.parse(timestamp) : NaN;
  return {
    totalTokens,
    inputTokens,
    outputTokens,
    reasoningOutputTokens,
    modelContextWindow,
    updatedAt: Number.isFinite(parsedTimestamp) ? parsedTimestamp : Date.now()
  };
}

export function latestSessionContextUsage(jsonl: string): MobileThreadContextUsage | null {
  let latest: MobileThreadContextUsage | null = null;
  for (const line of jsonl.split(/\r?\n/)) {
    if (!line.trim()) {
      continue;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      continue;
    }
    if (!isRecord(parsed) || !isRecord(parsed.payload)) {
      continue;
    }

    const usage = contextUsageFromTokenCountRecord(parsed.payload, parsed.timestamp);
    if (usage) {
      latest = usage;
    }
  }
  return latest;
}

function sessionTimelineRecords(jsonl: string): SessionTimelineRecord[] {
  const records: SessionTimelineRecord[] = [];
  const byCallId = new Map<string, SessionToolRecord>();
  let sequence = 0;

  for (const line of jsonl.split(/\r?\n/)) {
    if (!line.trim()) {
      continue;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      continue;
    }
    if (!isRecord(parsed) || !isRecord(parsed.payload)) {
      continue;
    }

    const payload = parsed.payload;
    const type = typeof payload.type === "string" ? payload.type : "";
    const turnId = payloadTurnId(payload);
    if (!turnId) {
      continue;
    }

    sequence += 1;

    if (type === "message" || type === "agent_message") {
      const text = rawMessageText(payload).trim();
      if (text) {
        records.push({ kind: "message", turnId, text, sequence });
      }
      continue;
    }

    if (type === "function_call" || type === "custom_tool_call" || type === "tool_search_call") {
      const record = toolItemFromFunctionCall(payload, turnId, sequence);
      if (record) {
        records.push(record);
        if (record.callId) {
          byCallId.set(record.callId, record);
        }
      }
      continue;
    }

    if (
      type === "function_call_output" ||
      type === "custom_tool_call_output" ||
      type === "tool_search_output"
    ) {
      const callId = typeof payload.call_id === "string" ? payload.call_id : null;
      const record = callId ? byCallId.get(callId) : null;
      if (record) {
        applyFunctionOutput(record, outputText(payload.output));
      }
    }
  }

  return records;
}

function textEquivalent(left: string, right: string): boolean {
  const a = left.trim();
  const b = right.trim();
  return Boolean(a && b && (a === b || a.includes(b) || b.includes(a)));
}

function normalizedPathText(value: string | undefined): string {
  return (value ?? "").replace(/\\/g, "/").replace(/\/+$/, "");
}

function pathEquivalent(left: string | undefined, right: string | undefined): boolean {
  const a = normalizedPathText(left);
  const b = normalizedPathText(right);
  if (!a || !b) {
    return false;
  }
  return a === b || a.endsWith(`/${b}`) || b.endsWith(`/${a}`);
}

function itemFilePath(item: MobileTimelineItem): string | undefined {
  return item.diffPath ?? item.tool;
}

function equivalentTool(base: MobileTimelineItem, supplement: MobileTimelineItem): boolean {
  if (base.role === "tool" && supplement.role === "tool" && base.toolKind === "file" && supplement.toolKind === "file") {
    return base.turnId === supplement.turnId && pathEquivalent(itemFilePath(base), itemFilePath(supplement));
  }
  return (
    base.role === "tool" &&
    supplement.role === "tool" &&
    base.turnId === supplement.turnId &&
    base.toolKind === supplement.toolKind &&
    base.server === supplement.server &&
    base.tool === supplement.tool
  );
}

function hasEquivalentBaseTool(baseItems: MobileTimelineItem[], supplement: MobileTimelineItem): boolean {
  return baseItems.some((base) => equivalentTool(base, supplement));
}

function withBaseTurnMeta(item: MobileTimelineItem, baseItems: MobileTimelineItem[]): MobileTimelineItem {
  const firstWithMeta = baseItems.find((base) => base.turnId === item.turnId);
  return {
    ...item,
    ...(typeof item.turnIndex === "number" || typeof firstWithMeta?.turnIndex !== "number"
      ? {}
      : { turnIndex: firstWithMeta.turnIndex })
  };
}

function mergeTurnSessionRecords(
  baseItems: MobileTimelineItem[],
  records: SessionTimelineRecord[]
): MobileTimelineItem[] {
  if (!records.length) {
    return baseItems;
  }

  const result: MobileTimelineItem[] = [];
  const usedToolIds = new Set(baseItems.map((item) => item.id));
  let cursor = 0;
  let matchedMessage = false;

  const collectToolRecords = (endExclusive: number): MobileTimelineItem[] => {
    const items: MobileTimelineItem[] = [];
    for (let index = cursor; index < endExclusive; index += 1) {
      const record = records[index];
      if (!record || record.kind !== "tool") {
        continue;
      }
      if (usedToolIds.has(record.item.id) || hasEquivalentBaseTool(baseItems, record.item)) {
        continue;
      }
      usedToolIds.add(record.item.id);
      items.push(withBaseTurnMeta(record.item, baseItems));
    }
    return items;
  };

  const pushToolRecords = (endExclusive: number) => {
    result.push(...collectToolRecords(endExclusive));
  };

  for (const baseItem of baseItems) {
    if (baseItem.role === "agent") {
      const messageIndex = records.findIndex(
        (record, index) => index >= cursor && record.kind === "message" && textEquivalent(record.text, baseItem.text)
      );
      if (messageIndex >= 0) {
        pushToolRecords(messageIndex);
        result.push(baseItem);
        cursor = messageIndex + 1;
        matchedMessage = true;
        continue;
      }
    }

    result.push(baseItem);
  }

  if (matchedMessage) {
    pushToolRecords(records.length);
  } else {
    const unanchoredToolRecords = collectToolRecords(records.length);
    result.splice(fallbackToolInsertIndex(result), 0, ...unanchoredToolRecords);
  }
  return result;
}

function fallbackToolInsertIndex(items: MobileTimelineItem[]): number {
  const firstAgentIndex = items.findIndex((item) => item.role === "agent");
  return firstAgentIndex >= 0 ? firstAgentIndex : items.length;
}

export function mergeSessionTimelineItems(baseItems: MobileTimelineItem[], jsonl: string): MobileTimelineItem[] {
  const records = sessionTimelineRecords(jsonl);
  if (!records.length || !baseItems.length) {
    return baseItems;
  }

  const recordsByTurn = new Map<string, SessionTimelineRecord[]>();
  for (const record of records) {
    const list = recordsByTurn.get(record.turnId) ?? [];
    list.push(record);
    recordsByTurn.set(record.turnId, list);
  }

  const result: MobileTimelineItem[] = [];
  let index = 0;
  while (index < baseItems.length) {
    const item = baseItems[index]!;
    if (!item.turnId) {
      result.push(item);
      index += 1;
      continue;
    }

    const turnId = item.turnId;
    const chunk: MobileTimelineItem[] = [];
    while (index < baseItems.length && baseItems[index]?.turnId === turnId) {
      chunk.push(baseItems[index]!);
      index += 1;
    }

    result.push(...mergeTurnSessionRecords(chunk, recordsByTurn.get(turnId) ?? []));
  }

  return result;
}
