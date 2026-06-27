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

export function timelineItemToEntry(item: TimelineItem, fallbackCreatedAt: number): TimelineEntry {
  const id = item.id;
  switch (item.role as TimelineRole) {
    case "user":
      return { id, createdAt: fallbackCreatedAt, body: { kind: "user-message", text: item.text, status: "sent" } };
    case "agent":
      return { id, createdAt: fallbackCreatedAt, body: { kind: "agent-message", text: item.text } };
    case "reasoning":
      return { id, createdAt: fallbackCreatedAt, body: { kind: "reasoning", text: item.text, done: true } };
    case "plan":
      return { id, createdAt: fallbackCreatedAt, body: { kind: "system", text: item.text } };
    case "tool":
      return {
        id,
        createdAt: fallbackCreatedAt,
        body: { kind: "tool", server: "tool", tool: "tool", status: "success", result: item.text }
      };
    default:
      return { id, createdAt: fallbackCreatedAt, body: { kind: "system", text: item.text } };
  }
}
