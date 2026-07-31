import type { MobileSkillReference, MobileThreadContextUsage, MobileTimelineItem } from "../../shared/codex";
import {
  boundedTimelineText,
  createOpaqueTimelineContentRef,
  TIMELINE_ITEM_INLINE_BYTE_BUDGET,
  utf8ByteLength
} from "../../shared/timeline-content";

export type SessionTimelineRecord =
  | {
      kind: "message";
      turnId: string;
      text: string;
      sequence: number;
    }
  | {
      kind: "skill-reference";
      turnId: string;
      anchorText: string;
      skillReferences: MobileSkillReference[];
      sequence: number;
    }
  | {
      kind: "tool";
      turnId: string;
      item: MobileTimelineItem;
      sequence: number;
      callId: string | null;
      nestedExec?: boolean;
    };
type SessionToolRecord = Extract<SessionTimelineRecord, { kind: "tool" }>;

const INTERNAL_CONTROL_TOOL_NAMES = new Set([
  "update_plan",
  "write_stdin",
  "read_thread",
  "list_threads",
  "read_thread_terminal",
  "wait",
  "wait_agent",
  "list_agents",
  "get_goal",
  "create_goal",
  "update_goal"
]);
const SUBAGENT_TOOL_NAMES = new Set(["spawn_agent", "followup_task", "send_message", "interrupt_agent"]);
const DEFAULT_SESSION_SUPPLEMENT_RECORD_LIMIT = 120;
const MAX_NESTED_EXEC_CALLS = 24;
const MAX_NESTED_EXEC_SOURCE_CHARS = 240_000;

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

function isAbsoluteSkillPath(value: string): boolean {
  const absolute = /^\/(?!\/)/.test(value) || /^[A-Za-z]:[\\/]/.test(value);
  return absolute && /(?:^|[\\/])SKILL\.md$/i.test(value);
}

function hiddenSkillReference(text: string): MobileSkillReference | null {
  if (!text.endsWith("</skill>")) {
    return null;
  }
  const match = /^<skill>\r?\n<name>([^<>\r\n]+)<\/name>\r?\n<path>([^<>\r\n]+)<\/path>(?:\r?\n|$)/.exec(text);
  if (!match) {
    return null;
  }
  const name = match[1]!.trim();
  const path = match[2]!.trim();
  return name && isAbsoluteSkillPath(path) ? { name, path } : null;
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
  const explicitFailure = output.split(/\r?\n/).some((line) =>
    /^\s*(?:Script failed\b|FAIL\b|Failed Tests?\b|Error:|(?:rg|grep|sed|cat|ls|find):.*(?:No such|error)|(?:Test Files|Tests)\s+.*\bfailed\b)/i.test(line)
  );
  if (explicitFailure) {
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

function outputTextParts(value: unknown): string[] {
  if (!Array.isArray(value)) {
    const text = outputText(value);
    return text ? [text] : [];
  }
  return value
    .map((part) => {
      if (isRecord(part) && typeof part.text === "string") {
        return part.text;
      }
      return stringifyJson(part);
    })
    .filter(Boolean);
}

function nestedExecOutputParts(value: unknown): string[] {
  const parts = outputTextParts(value);
  if (/^Script (?:completed|failed|running)\b/i.test(parts[0] ?? "")) {
    return parts.slice(1);
  }
  return parts;
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

function subagentKind(tool: string): string {
  if (tool === "spawn_agent") return "started";
  if (tool === "interrupt_agent") return "interrupted";
  return "updated";
}

function subagentPath(value: Record<string, unknown> | null): string {
  if (!value) return "";
  for (const key of ["agentPath", "agent_path", "task_name", "target"]) {
    if (typeof value[key] === "string" && value[key].trim()) {
      const path = value[key].trim();
      if (path.startsWith("/")) return path;
      if (path.startsWith("root/")) return `/${path}`;
      if (/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(path)) return "";
      return `/root/${path}`;
    }
  }
  return "";
}

function subagentThreadId(value: Record<string, unknown> | null): string {
  if (!value) return "";
  for (const key of ["agentThreadId", "agent_thread_id", "agent_id"]) {
    if (typeof value[key] === "string" && value[key].trim()) {
      return value[key].trim();
    }
  }
  if (typeof value.target === "string" && /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(value.target.trim())) {
    return value.target.trim();
  }
  return "";
}

function subagentResultText(tool: string, input: Record<string, unknown> | null, output?: string): string {
  const parsedOutput = output ? parseJsonObject(output) : null;
  const agentPath = subagentPath(parsedOutput) || subagentPath(input);
  const agentThreadId = subagentThreadId(parsedOutput) || subagentThreadId(input);
  return JSON.stringify({ agentThreadId, agentPath, kind: subagentKind(tool) });
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

type NestedExecCommand = {
  command: string;
  workdir: string;
};

function nestedExecCommands(source: unknown): NestedExecCommand[] {
  if (typeof source !== "string" || source.length > MAX_NESTED_EXEC_SOURCE_CHARS) {
    return [];
  }
  const calls = directCallArguments(source, "tools.exec_command", MAX_NESTED_EXEC_CALLS);
  const commands: NestedExecCommand[] = [];
  for (const call of calls) {
    const parsed = staticExecCommand(call);
    if (!parsed) {
      continue;
    }
    commands.push(parsed);
  }
  return commands;
}

function directCallArguments(source: string, callee: string, limit: number): string[] {
  const calls: string[] = [];
  let index = 0;
  while (index < source.length && calls.length < limit) {
    const char = source[index]!;
    if (char === '"' || char === "'" || char === "`") {
      index = skipQuotedSource(source, index, char) + 1;
      continue;
    }
    if (char === "/" && source[index + 1] === "/") {
      index = source.indexOf("\n", index + 2);
      if (index < 0) break;
      continue;
    }
    if (char === "/" && source[index + 1] === "*") {
      const end = source.indexOf("*/", index + 2);
      if (end < 0) break;
      index = end + 2;
      continue;
    }
    if (!source.startsWith(callee, index) || isIdentifierChar(source[index - 1]) || isIdentifierChar(source[index + callee.length])) {
      index += 1;
      continue;
    }
    let opening = index + callee.length;
    while (/\s/.test(source[opening] ?? "")) opening += 1;
    if (source[opening] !== "(") {
      index += callee.length;
      continue;
    }
    const closing = matchingParenthesis(source, opening);
    if (closing < 0) {
      break;
    }
    calls.push(source.slice(opening + 1, closing).trim());
    index = closing + 1;
  }
  return calls;
}

function isIdentifierChar(value: string | undefined): boolean {
  return Boolean(value && /[A-Za-z0-9_$]/.test(value));
}

function skipQuotedSource(source: string, start: number, quote: string): number {
  for (let index = start + 1; index < source.length; index += 1) {
    if (source[index] === "\\") {
      index += 1;
      continue;
    }
    if (source[index] === quote) {
      return index;
    }
  }
  return source.length - 1;
}

function matchingParenthesis(source: string, opening: number): number {
  let depth = 0;
  for (let index = opening; index < source.length; index += 1) {
    const char = source[index]!;
    if (char === '"' || char === "'" || char === "`") {
      index = skipQuotedSource(source, index, char);
      continue;
    }
    if (char === "/" && source[index + 1] === "/") {
      const end = source.indexOf("\n", index + 2);
      if (end < 0) return -1;
      index = end;
      continue;
    }
    if (char === "/" && source[index + 1] === "*") {
      const end = source.indexOf("*/", index + 2);
      if (end < 0) return -1;
      index = end + 1;
      continue;
    }
    if (char === "(") {
      depth += 1;
    } else if (char === ")") {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
  }
  return -1;
}

function staticExecCommand(objectLiteral: string): NestedExecCommand | null {
  const trimmed = objectLiteral.trim();
  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) {
    return null;
  }
  const members = splitStaticObjectMembers(trimmed.slice(1, -1));
  if (!members) {
    return null;
  }

  const properties = new Map<string, string>();
  const stringKeys = new Set(["cmd", "workdir", "shell", "justification", "sandbox_permissions"]);
  const numberKeys = new Set(["yield_time_ms", "max_output_tokens"]);
  const booleanKeys = new Set(["login", "tty"]);
  for (const member of members) {
    const match = member.match(/^\s*(?:"([A-Za-z_][A-Za-z0-9_-]*)"|([A-Za-z_][A-Za-z0-9_-]*))\s*:\s*([\s\S]+?)\s*$/);
    const key = match?.[1] ?? match?.[2];
    const value = match?.[3];
    if (!key || value === undefined || properties.has(key)) {
      return null;
    }
    const validValue = stringKeys.has(key)
      ? decodeStaticJsonString(value) !== null
      : numberKeys.has(key)
        ? /^-?\d+(?:\.\d+)?$/.test(value)
        : booleanKeys.has(key)
          ? /^(?:true|false)$/.test(value)
          : key === "prefix_rule"
            ? isStaticStringArray(value)
            : false;
    if (!validValue) {
      return null;
    }
    properties.set(key, value);
  }

  const command = decodeStaticJsonString(properties.get("cmd") ?? "");
  const workdir = properties.has("workdir")
    ? decodeStaticJsonString(properties.get("workdir")!)
    : "command";
  return command && workdir !== null ? { command, workdir } : null;
}

function splitStaticObjectMembers(source: string): string[] | null {
  const members: string[] = [];
  let start = 0;
  const closers: string[] = [];
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index]!;
    if (char === '"') {
      const end = skipQuotedSource(source, index, char);
      if (end === source.length - 1 && source[end] !== char) return null;
      index = end;
      continue;
    }
    if (char === "'" || char === "`" || (char === "/" && (source[index + 1] === "/" || source[index + 1] === "*"))) {
      return null;
    }
    if (char === "(" || char === "[" || char === "{") {
      closers.push(char === "(" ? ")" : char === "[" ? "]" : "}");
      continue;
    }
    if (char === ")" || char === "]" || char === "}") {
      if (closers.pop() !== char) return null;
      continue;
    }
    if (char === "," && closers.length === 0) {
      const member = source.slice(start, index).trim();
      if (member) members.push(member);
      start = index + 1;
    }
  }
  if (closers.length) return null;
  const trailing = source.slice(start).trim();
  if (trailing) members.push(trailing);
  return members;
}

function decodeStaticJsonString(value: string): string | null {
  if (!/^"(?:\\.|[^"\\])*"$/.test(value)) return null;
  try {
    const parsed = JSON.parse(value);
    return typeof parsed === "string" ? parsed : null;
  } catch {
    return null;
  }
}

function isStaticStringArray(value: string): boolean {
  if (!value.startsWith("[") || !value.endsWith("]")) return false;
  const members = splitStaticObjectMembers(value.slice(1, -1));
  return Boolean(members?.every((member) => decodeStaticJsonString(member) !== null));
}

function nestedExecCommandRecords(
  payload: Record<string, unknown>,
  turnId: string,
  sequence: number
): SessionToolRecord[] {
  const type = typeof payload.type === "string" ? payload.type : "";
  const name = normalizedToolName(payload, type);
  if (type !== "custom_tool_call" || name !== "exec") {
    return [];
  }
  const commands = nestedExecCommands(payload.input);
  if (!commands.length) {
    return [];
  }
  const callId = typeof payload.call_id === "string" ? payload.call_id : null;
  const explicitId = typeof payload.id === "string" ? payload.id : callId;
  const parentId = explicitId ?? `synthetic:rollout:${encodeURIComponent(turnId)}:${sequence}`;
  const status = initialToolStatus(payload);
  return commands.map((command, index) => {
    const id = `${parentId}:nested:${index}`;
    const skillName = skillNameFromCommand(command.command);
    const item: MobileTimelineItem = skillName
      ? {
          id,
          turnId,
          role: "tool",
          text: skillName,
          toolKind: "dynamic",
          server: "skills",
          tool: "loaded",
          arguments: JSON.stringify({ cmd: command.command, workdir: command.workdir }),
          status
        }
      : {
          id,
          turnId,
          role: "tool",
          text: command.command,
          toolKind: "command",
          actionKind: inferCommandActionKind(command.command),
          server: command.workdir,
          tool: command.command,
          arguments: JSON.stringify({ cmd: command.command, workdir: command.workdir }),
          status
        };
    return {
      kind: "tool" as const,
      turnId,
      sequence: sequence + index,
      callId,
      nestedExec: true,
      item
    };
  });
}

function toolItemFromFunctionCall(payload: Record<string, unknown>, turnId: string, sequence: number): SessionToolRecord | null {
  const type = typeof payload.type === "string" ? payload.type : "";
  const name = normalizedToolName(payload, type);
  if (INTERNAL_CONTROL_TOOL_NAMES.has(name)) {
    return null;
  }
  const callId = typeof payload.call_id === "string" ? payload.call_id : null;
  const explicitId = typeof payload.id === "string" ? payload.id : callId;
  const id = explicitId ?? `synthetic:rollout:${encodeURIComponent(turnId)}:${sequence}`;
  const identityMeta = explicitId
    ? {}
    : { sourceLocator: { sourceKind: "rollout" as const, sourceId: turnId, absoluteOutputIndex: sequence } };
  const rawArguments = payload.arguments ?? payload.input ?? payload.action;
  const args = parseJsonObject(rawArguments);
  const argumentsText = typeof rawArguments === "string" ? rawArguments : stringifyJson(rawArguments);
  const status = initialToolStatus(payload);

  if (SUBAGENT_TOOL_NAMES.has(name)) {
    const safeArguments = JSON.stringify({
      agentPath: subagentPath(args),
      kind: subagentKind(name)
    });
    return {
      kind: "tool",
      turnId,
      sequence,
      callId,
      item: {
        id,
        ...identityMeta,
        turnId,
        role: "tool",
        text: subagentResultText(name, args),
        toolKind: "dynamic",
        server: "sub-agent",
        tool: name,
        arguments: safeArguments,
        status
      }
    };
  }

  if (type === "custom_tool_call" && name === "exec" && !String(rawArguments ?? "").includes("tools.exec_command")) {
    return null;
  }

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
          ...identityMeta,
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
        ...identityMeta,
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
        ...identityMeta,
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
        ...identityMeta,
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
        ...identityMeta,
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
      ...identityMeta,
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

function applyFunctionOutput(
  record: SessionToolRecord,
  output: string,
  contentRefFactory?: (locator: SessionContentRefLocator) => string
): void {
  const nextStatus = toolStatusFromOutput(output);
  if (record.item.server === "sub-agent") {
    record.item = {
      ...record.item,
      text: subagentResultText(record.item.tool ?? "", parseJsonObject(record.item.arguments), output),
      status: nextStatus
    };
    return;
  }
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

  const text = output || record.item.text;
  const contentRef =
    utf8ByteLength(text) > TIMELINE_ITEM_INLINE_BYTE_BUDGET
      ? contentRefFactory?.({
          turnId: record.turnId,
          itemId: record.item.id,
          sequence: record.sequence,
          callId: record.callId,
          field: "text"
        }) ??
        createOpaqueTimelineContentRef([
          "session",
          record.turnId,
          record.item.id,
          record.sequence,
          "text"
        ])
      : undefined;
  record.item = {
    ...record.item,
    ...boundedTimelineText(text, { ...(contentRef ? { contentRef } : {}) }),
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

export type LatestSessionContextUsageOptions = {
  maxTailLines?: number;
};

export function latestSessionContextUsageFromLines(
  lines: Iterable<string>,
  options: LatestSessionContextUsageOptions = {}
): MobileThreadContextUsage | null {
  let latest: MobileThreadContextUsage | null = null;
  const maxTailLines =
    typeof options.maxTailLines === "number" && Number.isFinite(options.maxTailLines) && options.maxTailLines > 0
      ? Math.floor(options.maxTailLines)
      : Number.POSITIVE_INFINITY;
  const tailLines: string[] = [];
  for (const line of lines) {
    tailLines.push(line);
    while (tailLines.length > maxTailLines) {
      tailLines.shift();
    }
  }
  for (const line of tailLines) {
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

export function latestSessionContextUsage(
  jsonl: string,
  options: LatestSessionContextUsageOptions = {}
): MobileThreadContextUsage | null {
  return latestSessionContextUsageFromLines(jsonlLines(jsonl), options);
}

type SessionTimelineRecordsOptions = {
  allowedTurnIds?: ReadonlySet<string>;
  includeUnboundSkillReferences?: boolean;
  maxSupplementRecords?: number;
  contentRefFactory?: (locator: SessionContentRefLocator) => string;
};

export type SessionContentRefLocator = {
  turnId: string;
  itemId: string;
  sequence: number;
  callId: string | null;
  field: "text";
};

export type ScanSessionTimelineSupplementOptions = SessionTimelineRecordsOptions & {
  maxScanLines?: number;
  maxScanBytes?: number;
  maxElapsedMs?: number;
  nowMs?: () => number;
};

export type ScanSessionTimelineSupplementResult = {
  records: SessionTimelineRecord[];
  diagnostics: {
    scannedLines: number;
    scannedBytes: number;
    parsedRecords: number;
    budgetExhausted: boolean;
  };
};

function positiveIntegerLimit(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : Number.POSITIVE_INFINITY;
}

function* jsonlLines(jsonl: string): Iterable<string> {
  let start = 0;
  while (start <= jsonl.length) {
    const nextNewline = jsonl.indexOf("\n", start);
    const end = nextNewline === -1 ? jsonl.length : nextNewline;
    yield jsonl.slice(start, end).replace(/\r$/, "");
    if (nextNewline === -1) {
      break;
    }
    start = nextNewline + 1;
  }
}

export function scanSessionTimelineSupplement(
  lines: Iterable<string>,
  options: ScanSessionTimelineSupplementOptions = {}
): ScanSessionTimelineSupplementResult {
  const records: SessionTimelineRecord[] = [];
  const byCallId = new Map<string, SessionToolRecord[]>();
  const maxSupplementRecords = positiveIntegerLimit(options.maxSupplementRecords);
  const maxScanLines = positiveIntegerLimit(options.maxScanLines);
  const maxScanBytes = positiveIntegerLimit(options.maxScanBytes);
  const maxElapsedMs = positiveIntegerLimit(options.maxElapsedMs);
  const nowMs = options.nowMs ?? Date.now;
  const deadlineMs = Number.isFinite(maxElapsedMs) ? nowMs() + maxElapsedMs : Number.POSITIVE_INFINITY;
  let sequence = 0;
  let scannedLines = 0;
  let scannedBytes = 0;
  let budgetExhausted = false;
  const lastUserMessageByTurn = new Map<string, string>();
  const iterator = lines[Symbol.iterator]();

  while (scannedLines < maxScanLines) {
    if (nowMs() > deadlineMs) {
      budgetExhausted = true;
      break;
    }

    const next = iterator.next();
    if (next.done) {
      break;
    }

    const line = next.value;
    scannedLines += 1;
    scannedBytes += utf8ByteLength(line) + 1;
    if (scannedBytes > maxScanBytes) {
      budgetExhausted = true;
      break;
    }

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
    if (
      options.allowedTurnIds &&
      !options.allowedTurnIds.has(turnId) &&
      !options.includeUnboundSkillReferences
    ) {
      continue;
    }

    sequence += 1;

    if (type === "message" || type === "agent_message") {
      const text = rawMessageText(payload).trim();
      if (type === "message" && payload.role === "user") {
        const skillReference = hiddenSkillReference(text);
        if (skillReference || text.startsWith("<skill>")) {
          const anchorText = lastUserMessageByTurn.get(turnId);
          if (skillReference && anchorText && records.length < maxSupplementRecords) {
            records.push({
              kind: "skill-reference",
              turnId,
              anchorText,
              skillReferences: [skillReference],
              sequence
            });
          } else if (skillReference && anchorText) {
            budgetExhausted = true;
          }
          continue;
        }
        if (text) {
          lastUserMessageByTurn.set(turnId, text);
        }
      }
      if (text) {
        if (records.length < maxSupplementRecords) {
          records.push({ kind: "message", turnId, text, sequence });
        } else {
          budgetExhausted = true;
        }
      }
      continue;
    }

    if (type === "function_call" || type === "custom_tool_call" || type === "tool_search_call") {
      if (records.length >= maxSupplementRecords) {
        budgetExhausted = true;
        continue;
      }
      const nestedRecords = nestedExecCommandRecords(payload, turnId, sequence);
      const nextRecords = nestedRecords.length
        ? nestedRecords
        : [toolItemFromFunctionCall(payload, turnId, sequence)].filter(
            (record): record is SessionToolRecord => Boolean(record)
          );
      const availableRecords = nextRecords.slice(0, Math.max(0, maxSupplementRecords - records.length));
      if (availableRecords.length < nextRecords.length) {
        budgetExhausted = true;
      }
      for (const record of availableRecords) {
        records.push(record);
        if (record.callId) {
          const grouped = byCallId.get(record.callId) ?? [];
          grouped.push(record);
          byCallId.set(record.callId, grouped);
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
      const groupedRecords = callId ? byCallId.get(callId) : null;
      if (groupedRecords?.length) {
        if (groupedRecords.every((record) => record.nestedExec)) {
          const parts = nestedExecOutputParts(payload.output);
          if (groupedRecords.length === 1) {
            applyFunctionOutput(groupedRecords[0]!, parts.join("\n"), options.contentRefFactory);
          } else if (parts.length === groupedRecords.length) {
            groupedRecords.forEach((record, index) => {
              applyFunctionOutput(record, parts[index] ?? "", options.contentRefFactory);
            });
          }
        } else {
          applyFunctionOutput(groupedRecords[0]!, outputText(payload.output), options.contentRefFactory);
        }
      }
    }
  }

  if (scannedLines >= maxScanLines && Number.isFinite(maxScanLines)) {
    budgetExhausted = true;
  }

  return {
    records,
    diagnostics: {
      scannedLines,
      scannedBytes,
      parsedRecords: records.length,
      budgetExhausted
    }
  };
}

export function sessionToolOutputFromLines(lines: Iterable<string>, callId: string): string | null {
  for (const line of lines) {
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
    if (
      (payload.type === "function_call_output" ||
        payload.type === "custom_tool_call_output" ||
        payload.type === "tool_search_output") &&
      payload.call_id === callId
    ) {
      return outputText(payload.output);
    }
  }
  return null;
}

function sessionTimelineRecords(
  jsonl: string,
  options: SessionTimelineRecordsOptions = {}
): SessionTimelineRecord[] {
  return scanSessionTimelineSupplement(jsonlLines(jsonl), options).records;
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

function strongToolIdentityMatch(base: MobileTimelineItem, supplement: MobileTimelineItem): boolean {
  if (base.role !== "tool" || supplement.role !== "tool" || base.turnId !== supplement.turnId) {
    return false;
  }
  if (base.id && supplement.id && base.id === supplement.id) {
    return true;
  }
  const baseLocator = base.sourceLocator;
  const supplementLocator = supplement.sourceLocator;
  if (
    baseLocator &&
    supplementLocator &&
    (baseLocator.sourceKind === "response" || baseLocator.sourceKind === "rollout") &&
    (supplementLocator.sourceKind === "response" || supplementLocator.sourceKind === "rollout") &&
    baseLocator.sourceKind === supplementLocator.sourceKind &&
    baseLocator.sourceId === supplementLocator.sourceId &&
    baseLocator.absoluteOutputIndex === supplementLocator.absoluteOutputIndex
  ) {
    return true;
  }
  return false;
}

type MessageAnchorInterval = {
  beforeBaseMessageIndex: number | null;
  afterBaseMessageIndex: number | null;
  supplementStartIndex: number;
  supplementEndIndex: number;
};

type CanonicalToolPlacement = {
  baseIndex: number;
  supplementIndex: number;
  interval: MessageAnchorInterval;
};

function weakToolMetadataMatch(base: MobileTimelineItem, supplement: MobileTimelineItem): boolean {
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

function findNeighborMessageIndex(
  items: MobileTimelineItem[],
  index: number,
  direction: "before" | "after"
): number | null {
  if (direction === "before") {
    for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
      const item = items[cursor];
      if (item?.role === "agent" || item?.role === "user") {
        return cursor;
      }
    }
    return null;
  }
  for (let cursor = index + 1; cursor < items.length; cursor += 1) {
    const item = items[cursor];
    if (item?.role === "agent" || item?.role === "user") {
      return cursor;
    }
  }
  return null;
}

function findNeighborRecordMessage(
  records: SessionTimelineRecord[],
  index: number,
  direction: "before" | "after"
): { index: number; text: string } | null {
  if (direction === "before") {
    for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
      const record = records[cursor];
      if (record?.kind === "message") {
        return { index: cursor, text: record.text };
      }
    }
    return null;
  }
  for (let cursor = index + 1; cursor < records.length; cursor += 1) {
    const record = records[cursor];
    if (record?.kind === "message") {
      return { index: cursor, text: record.text };
    }
  }
  return null;
}

function uniqueBaseMessageIndex(baseItems: MobileTimelineItem[], text: string): number | null {
  const matches = baseItems.flatMap((item, index) =>
    (item.role === "agent" || item.role === "user") && textEquivalent(item.text, text) ? [index] : []
  );
  return matches.length === 1 ? matches[0]! : null;
}

function resolveMessageAnchorInterval(
  baseItems: MobileTimelineItem[],
  records: SessionTimelineRecord[],
  supplementIndex: number
): MessageAnchorInterval | null {
  const previous = findNeighborRecordMessage(records, supplementIndex, "before");
  const next = findNeighborRecordMessage(records, supplementIndex, "after");
  if (!previous && !next) {
    return null;
  }

  const beforeBaseMessageIndex = previous ? uniqueBaseMessageIndex(baseItems, previous.text) : null;
  const afterBaseMessageIndex = next ? uniqueBaseMessageIndex(baseItems, next.text) : null;
  if ((previous && beforeBaseMessageIndex === null) || (next && afterBaseMessageIndex === null)) {
    return null;
  }
  if (
    beforeBaseMessageIndex !== null &&
    afterBaseMessageIndex !== null &&
    beforeBaseMessageIndex >= afterBaseMessageIndex
  ) {
    return null;
  }

  return {
    beforeBaseMessageIndex,
    afterBaseMessageIndex,
    supplementStartIndex: previous ? previous.index + 1 : 0,
    supplementEndIndex: next ? next.index : records.length
  };
}

function baseToolMatchesAnchorInterval(
  baseItems: MobileTimelineItem[],
  baseIndex: number,
  interval: MessageAnchorInterval
): boolean {
  return (
    findNeighborMessageIndex(baseItems, baseIndex, "before") === interval.beforeBaseMessageIndex &&
    findNeighborMessageIndex(baseItems, baseIndex, "after") === interval.afterBaseMessageIndex
  );
}

function resolveCanonicalToolPlacements(
  baseItems: MobileTimelineItem[],
  records: SessionTimelineRecord[]
): CanonicalToolPlacement[] {
  const placements: CanonicalToolPlacement[] = [];
  const consumedBaseToolIndexes = new Set<number>();

  for (let supplementIndex = 0; supplementIndex < records.length; supplementIndex += 1) {
    const record = records[supplementIndex];
    if (!record || record.kind !== "tool") {
      continue;
    }
    const interval = resolveMessageAnchorInterval(baseItems, records, supplementIndex);
    if (!interval) {
      continue;
    }

    const strongCandidates = baseItems.flatMap((base, baseIndex) =>
      !consumedBaseToolIndexes.has(baseIndex) && strongToolIdentityMatch(base, record.item)
        ? [baseIndex]
        : []
    );
    let baseIndex = strongCandidates.length === 1 ? strongCandidates[0]! : -1;
    if (baseIndex < 0) {
      const anchoredMetadataCandidates = baseItems.flatMap((base, candidateIndex) =>
        !consumedBaseToolIndexes.has(candidateIndex) &&
        base.role === "tool" &&
        weakToolMetadataMatch(base, record.item) &&
        baseToolMatchesAnchorInterval(baseItems, candidateIndex, interval)
          ? [candidateIndex]
          : []
      );
      baseIndex = anchoredMetadataCandidates.length === 1 ? anchoredMetadataCandidates[0]! : -1;
    }
    if (baseIndex < 0) {
      continue;
    }

    consumedBaseToolIndexes.add(baseIndex);
    placements.push({ baseIndex, supplementIndex, interval });
  }

  return placements;
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

  const recoveredSkillsByUserId = new Map<string, MobileSkillReference[]>();
  for (const record of records) {
    if (record.kind !== "skill-reference") {
      continue;
    }
    const matches = baseItems.filter(
      (item) => item.role === "user" && item.text.trim() === record.anchorText.trim()
    );
    if (matches.length !== 1 || matches[0]!.skillReferences?.length) {
      continue;
    }
    const user = matches[0]!;
    const existing = recoveredSkillsByUserId.get(user.id) ?? [];
    for (const skill of record.skillReferences) {
      if (!existing.some((current) => current.name === skill.name && current.path === skill.path)) {
        existing.push(skill);
      }
    }
    recoveredSkillsByUserId.set(user.id, existing);
  }

  const result: MobileTimelineItem[] = [];
  const usedToolIds = new Set(baseItems.map((item) => item.id));
  const placements = resolveCanonicalToolPlacements(baseItems, records);
  const placementBySupplementIndex = new Map(
    placements.map((placement) => [placement.supplementIndex, placement] as const)
  );
  const placedBaseToolIndexes = new Set(placements.map((placement) => placement.baseIndex));
  const emittedBaseToolIndexes = new Set<number>();
  let cursor = 0;
  let matchedMessage = false;

  const collectToolRecords = (endExclusive: number): MobileTimelineItem[] => {
    const items: MobileTimelineItem[] = [];
    for (let index = cursor; index < endExclusive; index += 1) {
      const record = records[index];
      if (!record || record.kind !== "tool") {
        continue;
      }
      const placement = placementBySupplementIndex.get(index);
      if (placement) {
        const baseItem = baseItems[placement.baseIndex]!;
        if (!emittedBaseToolIndexes.has(placement.baseIndex)) {
          emittedBaseToolIndexes.add(placement.baseIndex);
          items.push(baseItem);
        }
        continue;
      }
      if (usedToolIds.has(record.item.id)) {
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

  for (let baseIndex = 0; baseIndex < baseItems.length; baseIndex += 1) {
    const baseItem = baseItems[baseIndex]!;
    if (baseItem.role === "tool" && placedBaseToolIndexes.has(baseIndex)) {
      continue;
    }
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
    if (baseItem.role === "tool") {
      emittedBaseToolIndexes.add(baseIndex);
    }
  }

  if (matchedMessage) {
    pushToolRecords(records.length);
  } else {
    const unanchoredToolRecords = collectToolRecords(records.length);
    result.splice(fallbackToolInsertIndex(result), 0, ...unanchoredToolRecords);
  }
  return result.map((item) => {
    const skillReferences = recoveredSkillsByUserId.get(item.id);
    return skillReferences?.length && !item.skillReferences?.length
      ? { ...item, skillReferences }
      : item;
  });
}

function fallbackToolInsertIndex(items: MobileTimelineItem[]): number {
  const firstAgentIndex = items.findIndex((item) => item.role === "agent");
  return firstAgentIndex >= 0 ? firstAgentIndex : items.length;
}

export type MergeSessionTimelineItemsOptions = {
  allowedTurnIds?: ReadonlySet<string>;
  includeUnboundSkillReferences?: boolean;
  maxSupplementRecords?: number;
};

export function mergeSessionTimelineItems(
  baseItems: MobileTimelineItem[],
  jsonl: string,
  options: MergeSessionTimelineItemsOptions = {}
): MobileTimelineItem[] {
  const records = sessionTimelineRecords(jsonl, {
    allowedTurnIds: options.allowedTurnIds,
    includeUnboundSkillReferences: options.includeUnboundSkillReferences,
    maxSupplementRecords: options.maxSupplementRecords ?? DEFAULT_SESSION_SUPPLEMENT_RECORD_LIMIT
  });
  return mergeSessionTimelineRecords(baseItems, records);
}

function mergeUnboundSkillReferences(
  baseItems: MobileTimelineItem[],
  records: SessionTimelineRecord[]
): MobileTimelineItem[] {
  const usersByText = new Map<string, MobileTimelineItem[]>();
  for (const item of baseItems) {
    if (item.role !== "user") {
      continue;
    }
    const text = item.text.trim();
    if (!text) {
      continue;
    }
    const users = usersByText.get(text) ?? [];
    users.push(item);
    usersByText.set(text, users);
  }

  const recoveredById = new Map<string, MobileSkillReference[]>();
  for (const record of records) {
    if (record.kind !== "skill-reference") {
      continue;
    }
    const users = usersByText.get(record.anchorText.trim()) ?? [];
    if (users.length !== 1 || users[0]!.skillReferences?.length) {
      continue;
    }
    const existing = recoveredById.get(users[0]!.id) ?? [];
    for (const skill of record.skillReferences) {
      if (!existing.some((current) => current.name === skill.name && current.path === skill.path)) {
        existing.push(skill);
      }
    }
    recoveredById.set(users[0]!.id, existing);
  }

  return baseItems.map((item) => {
    const skillReferences = recoveredById.get(item.id);
    return skillReferences?.length && !item.skillReferences?.length
      ? { ...item, skillReferences }
      : item;
  });
}

export function mergeSessionTimelineRecords(
  baseItems: MobileTimelineItem[],
  records: SessionTimelineRecord[]
): MobileTimelineItem[] {
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

  return mergeUnboundSkillReferences(result, records);
}
