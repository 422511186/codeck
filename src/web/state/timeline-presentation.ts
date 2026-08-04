import type { TimelineEntry } from "./timeline";

export type ActivityPresentationKind =
  | "thinking"
  | "skill"
  | "subagent"
  | "file"
  | "read"
  | "list"
  | "search"
  | "command"
  | "web"
  | "image"
  | "tool";

export type ActivityPresentationItem = {
  key: string;
  kind: ActivityPresentationKind;
  label: string;
  entry: TimelineEntry;
  groupIdentity?: string;
  groupAlias?: string;
};

export type ActivityPresentation = {
  summary: string;
  summaryKind: ActivityPresentationKind;
  failed: boolean;
  items: ActivityPresentationItem[];
};

type TimelinePresentationState = {
  running: boolean;
  activeTurnId: string | null;
};

export function timelineEntriesForPresentation(
  entries: TimelineEntry[],
  state: TimelinePresentationState
): TimelineEntry[] {
  if (!state.running) {
    return entries.filter((entry) => entry.body.kind !== "reasoning");
  }

  let placeholderIndex = -1;
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index]!;
    if (
      entry.body.kind === "reasoning" &&
      !entry.body.done &&
      (!state.activeTurnId || entry.turnId === state.activeTurnId)
    ) {
      placeholderIndex = index;
      break;
    }
  }

  if (placeholderIndex >= 0) {
    const placeholder = entries[placeholderIndex]!;
    const hasLaterVisibleEntry = entries.slice(placeholderIndex + 1).some(
      (entry) => entry.turnId === placeholder.turnId && entry.body.kind !== "reasoning"
    );
    if (hasLaterVisibleEntry) {
      placeholderIndex = -1;
    }
  }

  return entries.filter(
    (entry, index) => entry.body.kind !== "reasoning" || index === placeholderIndex
  );
}

export function createActivityPresentation(entries: TimelineEntry[]): ActivityPresentation {
  const items = collapseGroupedActivityItems(entries.flatMap(activityPresentationItems));
  return {
    summary: activitySummary(items),
    summaryKind: activitySummaryKind(items),
    failed: entries.some(activityEntryFailed),
    items
  };
}

function activitySummaryKind(items: ActivityPresentationItem[]): ActivityPresentationKind {
  const kinds = [...new Set(items.map((item) => item.kind).filter((kind) => kind !== "thinking"))];
  return kinds.length === 1 ? kinds[0]! : "tool";
}

function collapseGroupedActivityItems(items: ActivityPresentationItem[]): ActivityPresentationItem[] {
  const result: ActivityPresentationItem[] = [];
  const groupedIndexes = new Map<string, number>();
  const subagentThreadIdsByPath = new Map<string, Set<string>>();
  for (const item of items) {
    if (item.kind !== "subagent" || !item.groupAlias || !item.groupIdentity) continue;
    const identities = subagentThreadIdsByPath.get(item.groupAlias) ?? new Set<string>();
    identities.add(item.groupIdentity);
    subagentThreadIdsByPath.set(item.groupAlias, identities);
  }
  for (const item of items) {
    let groupIdentity = item.groupIdentity;
    if (item.kind === "subagent" && !groupIdentity && item.groupAlias) {
      const aliases = subagentThreadIdsByPath.get(item.groupAlias);
      groupIdentity = aliases?.size === 1 ? [...aliases][0] : `path:${item.groupAlias}`;
    }
    if (!groupIdentity) {
      result.push(item);
      continue;
    }
    const groupKey = `${item.kind}:${groupIdentity}`;
    const existingIndex = groupedIndexes.get(groupKey);
    if (existingIndex === undefined) {
      groupedIndexes.set(groupKey, result.length);
      result.push(item);
    } else {
      result[existingIndex] = item;
    }
  }
  return result;
}

function activityPresentationItems(entry: TimelineEntry): ActivityPresentationItem[] {
  const body = entry.body;
  if (body.kind === "reasoning") {
    return [activityItem(entry, "thinking", "Thinking...")];
  }

  const subagent = subagentMetadata(entry);
  if (subagent) {
    const name = shortPathName(subagent.agentPath) || subagent.agentThreadId || "agent";
    const kind = subagent.kind || (body.kind === "tool" ? body.tool : "activity");
    return [
      {
        ...activityItem(entry, "subagent", `Subagent ${name} · ${kind}`),
        ...(subagent.agentThreadId ? { groupIdentity: subagent.agentThreadId } : {}),
        ...(subagent.agentPath ? { groupAlias: subagent.agentPath } : {})
      }
    ];
  }

  const skillNames = skillNamesFromActivity(entry);
  if (skillNames.length) {
    return skillNames.map((name, index) => ({
      ...activityItem(entry, "skill", `已加载 ${name} Skill`, `skill-${index}`),
      groupIdentity: name
    }));
  }

  if (body.kind === "diff") {
    return [activityItem(entry, "file", `已编辑 ${shortInlineText(body.path)} +${body.added} -${body.removed}`)];
  }
  if (body.kind === "tool" && body.toolKind === "file") {
    return [
      activityItem(
        entry,
        "file",
        `已编辑 ${shortInlineText(body.diffPath ?? body.tool)} +${body.added ?? 0} -${body.removed ?? 0}`
      )
    ];
  }

  if (body.kind === "tool" && body.toolKind === "web") {
    return [activityItem(entry, "web", `已搜索网页 ${shortInlineText(body.tool)}`)];
  }
  if (body.kind === "tool" && body.toolKind === "image") {
    return [
      activityItem(
        entry,
        "image",
        /generat/i.test(body.tool) ? "已生成图片" : "已查看图片"
      )
    ];
  }

  const command = activityCommandText(entry);
  if (isReadActivity(entry)) {
    return [activityItem(entry, "read", `已读取 ${commandTarget(command, "read")}`)];
  }
  if (isListActivity(entry)) {
    return [activityItem(entry, "list", `已浏览 ${commandTarget(command, "list")}`)];
  }
  if (isSearchActivity(entry)) {
    return [activityItem(entry, "search", `已搜索 ${commandTarget(command, "search")}`)];
  }
  if (isCommandActivity(entry)) {
    return [activityItem(entry, "command", `已运行 ${shortInlineText(command || "command")}`)];
  }
  if (body.kind === "tool") {
    return [
      activityItem(
        entry,
        "tool",
        `已调用 ${shortInlineText([body.server, body.tool].filter(Boolean).join(" · "))}`
      )
    ];
  }
  return [activityItem(entry, "tool", shortInlineText(entry.id))];
}

function activityItem(
  entry: TimelineEntry,
  kind: ActivityPresentationKind,
  label: string,
  suffix = ""
): ActivityPresentationItem {
  return {
    key: suffix ? `${entry.id}-${suffix}` : entry.id,
    kind,
    label,
    entry
  };
}

function activitySummary(items: ActivityPresentationItem[]): string {
  if (items.length === 1 && items[0]?.kind === "thinking") {
    return "Thinking...";
  }

  const allPhrases: Array<{ kind: ActivityPresentationKind; text: string }> = [
    { kind: "file", text: "编辑了文件" },
    { kind: "command", text: "运行了命令" },
    { kind: "read", text: "读取了文件" },
    { kind: "search", text: "搜索了代码" },
    { kind: "list", text: "浏览了目录" },
    { kind: "subagent", text: "使用了 Subagent" },
    { kind: "skill", text: "加载了 Skill" },
    { kind: "web", text: "搜索了网页" },
    { kind: "image", text: "处理了图片" },
    { kind: "tool", text: "调用了工具" }
  ];
  const phrases = allPhrases.filter((phrase) => items.some((item) => item.kind === phrase.kind));

  if (phrases.length === 1) {
    return phrases[0]!.text;
  }
  if (phrases.length === 2) {
    return `${phrases[0]!.text}并${phrases[1]!.text}`;
  }
  if (phrases.length > 2) {
    return `${phrases[0]!.text}、${phrases[1]!.text}等操作`;
  }
  return "执行了操作";
}

function subagentMetadata(entry: TimelineEntry): {
  agentThreadId: string;
  agentPath: string;
  kind: string;
} | null {
  if (entry.body.kind !== "tool" || entry.body.server !== "sub-agent") {
    return null;
  }
  try {
    const value = JSON.parse(entry.body.result ?? "") as Record<string, unknown>;
    const agentThreadId = stringField(value.agentThreadId);
    const agentPath = stringField(value.agentPath);
    const kind = stringField(value.kind);
    if (!agentThreadId && !agentPath && !kind) {
      return null;
    }
    return { agentThreadId, agentPath, kind };
  } catch {
    return null;
  }
}

function stringField(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function shortPathName(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).at(-1) ?? "";
}

function skillNamesFromActivity(entry: TimelineEntry): string[] {
  const body = entry.body;
  if (body.kind === "tool" && body.server === "skills" && body.tool === "loaded") {
    return uniqueStrings((body.result ?? "").split(",").map((name) => name.trim()));
  }

  const command = activityCommandText(entry).replace(/\\/g, "/");
  const names = [...command.matchAll(/(?:^|[\s"'])(?:[^\s"']*\/)?skills\/([^/\s"']+)\/SKILL\.md(?=$|[\s"'])/g)]
    .map((match) => match[1]?.trim() ?? "")
    .filter(Boolean);
  return uniqueStrings(names);
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function activityCommandText(entry: TimelineEntry): string {
  if (entry.body.kind === "command") {
    return entry.body.command;
  }
  if (entry.body.kind === "tool") {
    if (isLegacyCommandTool(entry)) {
      const command = commandFromArguments(entry.body.arguments);
      if (command) return command;
    }
    return entry.body.tool;
  }
  return "";
}

function commandFromArguments(argumentsText?: string): string {
  if (!argumentsText) return "";
  try {
    const value = JSON.parse(argumentsText) as { cmd?: unknown };
    return typeof value.cmd === "string" ? value.cmd.trim() : "";
  } catch {
    return "";
  }
}

function isLegacyCommandTool(entry: TimelineEntry): boolean {
  return entry.body.kind === "tool" && (
    entry.body.toolKind === "command" ||
    entry.body.server === "command" ||
    entry.body.tool === "exec_command"
  );
}

function commandTarget(command: string, kind: "read" | "list" | "search"): string {
  const words = shellWords(command);
  if (!words.length) {
    return kind === "search" ? "search" : "target";
  }
  if (kind === "search") {
    const query = words.slice(1).find((word) => !word.startsWith("-"));
    return shortInlineText(query ?? words.at(-1) ?? "search");
  }
  const target = [...words].reverse().find((word) => !word.startsWith("-") && !/^\d+(,\d+)?p$/.test(word));
  return shortInlineText(target ?? words.at(-1) ?? "target");
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

function shortInlineText(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > 88 ? `${clean.slice(0, 85)}...` : clean;
}

function isCommandActivity(entry: TimelineEntry): boolean {
  return entry.body.kind === "command" || isLegacyCommandTool(entry);
}

function isToolNamed(entry: TimelineEntry, pattern: RegExp): boolean {
  if (entry.body.kind === "tool" && entry.body.toolKind !== "command" && !isLegacyCommandTool(entry)) {
    return false;
  }
  const command = activityCommandText(entry);
  return pattern.test(command.split(/\s+/)[0] ?? "");
}

function isReadActivity(entry: TimelineEntry): boolean {
  if (entry.body.kind === "tool" && entry.body.actionKind === "read") {
    return true;
  }
  return isToolNamed(entry, /^(read|cat|sed|head|tail|less|nl)$/i);
}

function isListActivity(entry: TimelineEntry): boolean {
  if (entry.body.kind === "tool" && entry.body.actionKind === "list") {
    return true;
  }
  return isToolNamed(entry, /^(list|ls|dir|tree)$/i);
}

function isSearchActivity(entry: TimelineEntry): boolean {
  if (entry.body.kind === "tool" && entry.body.actionKind === "search") {
    return true;
  }
  return isToolNamed(entry, /^(search|rg|grep|find)$/i);
}

function activityEntryFailed(entry: TimelineEntry): boolean {
  return (
    (entry.body.kind === "tool" && entry.body.status === "failed") ||
    (entry.body.kind === "command" && entry.body.status === "failed")
  );
}
