import type { SkillReference, TimelineItem, TimelineRole } from "../api/types";

export type TimelineEntryKind =
  | "user-message"
  | "agent-message"
  | "reasoning"
  | "plan"
  | "tool"
  | "command"
  | "diff"
  | "approval"
  | "system"
  | "error";

export type CommandEntryStatus = "running" | "success" | "failed";

export type CommandEntry = {
  kind: "command";
  status: CommandEntryStatus;
  command: string;
  output?: string;
};

export type DiffEntry = {
  kind: "diff";
  path: string;
  added: number;
  removed: number;
  diff: string;
};

export type ReasoningEntry = {
  kind: "reasoning";
  text: string;
  done: boolean;
};

export type ToolEntry = {
  kind: "tool";
  toolKind?: "command" | "mcp" | "dynamic" | "file" | "web" | "image" | "system";
  server: string;
  tool: string;
  status: CommandEntryStatus;
  arguments?: string;
  result?: string;
  imagePaths?: string[];
  diffPath?: string;
  added?: number;
  removed?: number;
};

export type SystemEntry = {
  kind: "system";
  text: string;
};

export type ErrorEntry = {
  kind: "error";
  text: string;
};

export type UserMessageEntry = {
  kind: "user-message";
  text: string;
  imagePaths?: string[];
  skillReferences?: SkillReference[];
  status?: "sending" | "sent" | "failed";
};

export type AgentMessageEntry = {
  kind: "agent-message";
  text: string;
};

export type TimelineEntry = {
  id: string;
  turnId?: string;
  turnIndex?: number;
  clientUserMessageId?: string;
  generation?: number;
  snapshotSequence?: number;
  createdAt: number;
  body:
    | UserMessageEntry
    | AgentMessageEntry
    | ReasoningEntry
    | CommandEntry
    | DiffEntry
    | ToolEntry
    | SystemEntry
    | ErrorEntry;
};

const localImagePattern = /[A-Za-z]:[\\/][^\r\n]+?\.(?:png|jpe?g|webp|gif)/gi;

function normalizeUserTextAndImages(text: string, imagePaths?: string[]): { text: string; imagePaths?: string[] } {
  const images = [...(imagePaths ?? [])];
  let nextText = text.replace(localImagePattern, (match) => {
    images.push(match);
    return "";
  });

  nextText = nextText
    .replace(/^# Files mentioned by the user:[\s\S]*?(?=^## My request for Codex:)/m, "")
    .replace(/^## My request for Codex:\s*/m, "")
    .replace(/^\[图片\]\s*$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return { text: nextText, ...(images.length ? { imagePaths: Array.from(new Set(images)) } : {}) };
}

export function diffStats(diff: string): { added: number; removed: number } {
  let added = 0;
  let removed = 0;

  for (const line of diff.split("\n")) {
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

export function diffEntryFromText(
  id: string,
  diff: string,
  fallbackCreatedAt: number,
  path = "工作区变更",
  stats?: { added?: number; removed?: number }
): TimelineEntry {
  const computed = diffStats(diff);
  return {
    id,
    createdAt: fallbackCreatedAt,
    body: {
      kind: "diff",
      path,
      added: stats?.added ?? computed.added,
      removed: stats?.removed ?? computed.removed,
      diff
    }
  };
}

export function timelineItemToEntry(item: TimelineItem, fallbackCreatedAt: number): TimelineEntry {
  const id = item.id;
  const meta = timelineEntryMeta(item);
  switch (item.role as TimelineRole) {
    case "user": {
      const normalized = normalizeUserTextAndImages(item.text, item.imagePaths);
      return {
        id,
        ...meta,
        createdAt: fallbackCreatedAt,
        body: {
          kind: "user-message",
          text: normalized.text,
          ...(normalized.imagePaths?.length ? { imagePaths: normalized.imagePaths } : {}),
          ...(item.skillReferences?.length ? { skillReferences: item.skillReferences } : {}),
          status: "sent"
        }
      };
    }
    case "agent":
      return { id, ...meta, createdAt: fallbackCreatedAt, body: { kind: "agent-message", text: item.text } };
    case "reasoning":
      return { id, ...meta, createdAt: fallbackCreatedAt, body: { kind: "reasoning", text: item.text, done: item.done ?? true } };
    case "plan":
      return { id, ...meta, createdAt: fallbackCreatedAt, body: { kind: "system", text: item.text } };
    case "system":
      return { id, ...meta, createdAt: fallbackCreatedAt, body: { kind: "system", text: item.text } };
    case "error":
      return { id, ...meta, createdAt: fallbackCreatedAt, body: { kind: "error", text: item.text } };
    case "diff":
      return {
        ...diffEntryFromText(id, item.text, fallbackCreatedAt, item.diffPath ?? "工作区变更", {
        added: item.added,
        removed: item.removed
        }),
        ...meta
      };
    case "tool":
      return {
        id,
        ...meta,
        createdAt: fallbackCreatedAt,
        body: {
          kind: "tool",
          toolKind: item.toolKind,
          server: item.server ?? item.toolKind ?? "tool",
          tool: item.tool ?? item.toolKind ?? "tool",
          status: item.status ?? "success",
          arguments: item.arguments,
          result: item.text,
          diffPath: item.diffPath,
          added: item.added,
          removed: item.removed,
          ...(item.imagePaths?.length ? { imagePaths: item.imagePaths } : {})
        }
      };
    default:
      return { id, ...meta, createdAt: fallbackCreatedAt, body: { kind: "system", text: item.text } };
  }
}

function timelineEntryMeta(
  item: TimelineItem
): Pick<TimelineEntry, "turnId" | "turnIndex" | "clientUserMessageId" | "generation" | "snapshotSequence"> {
  return {
    ...(item.turnId ? { turnId: item.turnId } : {}),
    ...(typeof item.turnIndex === "number" ? { turnIndex: item.turnIndex } : {}),
    ...(item.clientUserMessageId ? { clientUserMessageId: item.clientUserMessageId } : {}),
    ...(typeof item.generation === "number" ? { generation: item.generation } : {}),
    ...(typeof item.snapshotSequence === "number" ? { snapshotSequence: item.snapshotSequence } : {})
  };
}

export function rollbackTurnsForEntry(entries: TimelineEntry[], target: TimelineEntry): number | null {
  if (!target.turnId) {
    return null;
  }

  const turnIds: string[] = [];
  const seen = new Set<string>();
  for (const entry of entries) {
    if (!entry.turnId || seen.has(entry.turnId)) {
      continue;
    }
    seen.add(entry.turnId);
    turnIds.push(entry.turnId);
  }

  const targetIndex = turnIds.indexOf(target.turnId);
  if (targetIndex < 0) {
    return null;
  }

  const numTurns = turnIds.length - targetIndex;
  return numTurns >= 1 ? numTurns : null;
}

export function entriesBeforeEntry(entries: TimelineEntry[], target: TimelineEntry): TimelineEntry[] | null {
  if (!target.turnId) {
    return null;
  }

  const targetIndex = entries.findIndex((entry) => entry.turnId === target.turnId);
  if (targetIndex < 0) {
    return null;
  }

  return entries.slice(0, targetIndex);
}
