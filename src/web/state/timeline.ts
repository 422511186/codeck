import type { TimelineItem, TimelineRole } from "../api/types";

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
  server: string;
  tool: string;
  status: CommandEntryStatus;
  arguments?: string;
  result?: string;
  imagePaths?: string[];
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
  status?: "sending" | "sent" | "failed";
};

export type AgentMessageEntry = {
  kind: "agent-message";
  text: string;
};

export type TimelineEntry = {
  id: string;
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

export function timelineItemToEntry(item: TimelineItem, fallbackCreatedAt: number): TimelineEntry {
  const id = item.id;
  switch (item.role as TimelineRole) {
    case "user": {
      const normalized = normalizeUserTextAndImages(item.text, item.imagePaths);
      return {
        id,
        createdAt: fallbackCreatedAt,
        body: {
          kind: "user-message",
          text: normalized.text,
          ...(normalized.imagePaths?.length ? { imagePaths: normalized.imagePaths } : {}),
          status: "sent"
        }
      };
    }
    case "agent":
      return { id, createdAt: fallbackCreatedAt, body: { kind: "agent-message", text: item.text } };
    case "reasoning":
      return { id, createdAt: fallbackCreatedAt, body: { kind: "reasoning", text: item.text, done: item.done ?? true } };
    case "plan":
      return { id, createdAt: fallbackCreatedAt, body: { kind: "system", text: item.text } };
    case "system":
      return { id, createdAt: fallbackCreatedAt, body: { kind: "system", text: item.text } };
    case "error":
      return { id, createdAt: fallbackCreatedAt, body: { kind: "error", text: item.text } };
    case "tool":
      return {
        id,
        createdAt: fallbackCreatedAt,
        body: {
          kind: "tool",
          server: item.server ?? item.toolKind ?? "tool",
          tool: item.tool ?? item.toolKind ?? "tool",
          status: item.status ?? "success",
          arguments: item.arguments,
          result: item.text,
          ...(item.imagePaths?.length ? { imagePaths: item.imagePaths } : {})
        }
      };
    default:
      return { id, createdAt: fallbackCreatedAt, body: { kind: "system", text: item.text } };
  }
}
