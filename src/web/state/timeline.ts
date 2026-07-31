import type { FileReference, SkillReference, TimelineItem, TimelineRole } from "../api/types";
import type { TimelineCompleteness } from "../../shared/timeline-content";
import type { AuthoritativeTurnManifest, CanonicalSourceLocator, HistoryStamp } from "../../shared/timeline-protocol";
import {
  createTimelineEngineState,
  selectRollbackMetadataForEntry,
  selectTurnHasVisibleOutput
} from "./timeline-engine";
import { decodeFilesMentioned } from "../../shared/file-attachments";

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
  actionKind?: "read" | "list" | "search" | "command";
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
  systemKind?: "context-compaction" | "warning";
  status?: CommandEntryStatus;
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
  fileReferences?: FileReference[];
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
  bootId?: string;
  historyStamp?: HistoryStamp;
  snapshotSequence?: number;
  streamSequence?: number;
  fragmentSequence?: number;
  revision?: number;
  baselineWatermark?: number;
  sourceLocator?: CanonicalSourceLocator;
  provisional?: "turn-diff";
  sendOperation?: {
    payloadFingerprint: string;
    bootId?: string;
    outcome: "pending" | "accepted" | "ambiguous" | "rejected";
  };
  completeness?: TimelineCompleteness;
  sourceOrder?: {
    sourceKind: "live" | "snapshot" | "pagination" | "turn-detail" | "supplement" | "optimistic";
    ordinal: number;
    sequence?: number;
    beforeEntryId?: string;
    beforeTurnId?: string;
    afterEntryId?: string;
    afterTurnId?: string;
  };
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

export function hasVisibleTurnOutput(entries: TimelineEntry[], turnId: string): boolean {
  return selectTurnHasVisibleOutput(createTimelineEngineState({ entries }), turnId);
}

const localImagePattern = /[A-Za-z]:[\\/][^\r\n]+?\.(?:png|jpe?g|webp|gif)/gi;
const codexRequestMarkerPattern = /^## My request for Codex:[^\S\r\n]*(?:\r?\n|$)/m;
const codexFileWrapperPattern = /^# Files mentioned by the user:[^\S\r\n]*$/m;
const trustedBrowserContextPattern =
  /<in-app-browser-context\s+source=["']ambient-ui-state["'][^>]*>[\s\S]*?<\/in-app-browser-context>/i;
const trustedGoalContextPattern =
  /^<codex_internal_context\s+source="goal">([\s\S]*)<\/codex_internal_context>$/;
const goalObjectivePattern = /<objective>([\s\S]*?)<\/objective>/g;

export function visibleUserMessageText(text: string): string {
  const trimmedText = text.trim();
  const goalContext = trustedGoalContextPattern.exec(trimmedText);
  if (goalContext) {
    const objectiveMatches = [...goalContext[1]!.matchAll(goalObjectivePattern)];
    const objective = objectiveMatches[0]?.[1]?.trim() ?? "";
    if (objectiveMatches.length === 1 && objective) {
      return objective;
    }
  }

  const requestMarker = codexRequestMarkerPattern.exec(text);
  if (!requestMarker) {
    return text;
  }

  const wrapper = text.slice(0, requestMarker.index);
  if (!codexFileWrapperPattern.test(wrapper) && !trustedBrowserContextPattern.test(wrapper)) {
    return text;
  }

  return text.slice(requestMarker.index + requestMarker[0].length);
}

function normalizeUserTextAndImages(
  text: string,
  imagePaths?: string[],
  skillReferences?: SkillReference[]
): { text: string; imagePaths?: string[]; skillReferences?: SkillReference[]; fileReferences?: import("../../shared/file-attachments").FileReference[] } {
  const images = [...(imagePaths ?? [])];
  let nextText = text.replace(localImagePattern, (match) => {
    images.push(match);
    return "";
  });

  const decodedFiles = decodeFilesMentioned(nextText);
  nextText = visibleUserMessageText(decodedFiles.text);
  const normalizedSkills = normalizeSkillReferences(skillReferences);
  const recovered = normalizedSkills.length ? { text: nextText, skillReferences: normalizedSkills } : recoverSkillReferences(nextText);
  nextText = recovered.text;
  nextText = nextText
    .replace(/^\[图片\]\s*$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return {
    text: nextText,
    ...(images.length ? { imagePaths: Array.from(new Set(images)) } : {}),
    ...(recovered.skillReferences.length ? { skillReferences: recovered.skillReferences } : {}),
    ...(decodedFiles.fileReferences.length ? { fileReferences: decodedFiles.fileReferences } : {})
  };
}

function recoverSkillReferences(text: string): { text: string; skillReferences: SkillReference[] } {
  const references: SkillReference[] = [];
  const keptLines: string[] = [];
  let fence: { marker: "`" | "~"; length: number } | null = null;

  for (const line of text.split(/\r?\n/)) {
    const fenceMatch = /^\s*(`{3,}|~{3,})/.exec(line);
    if (fenceMatch) {
      const token = fenceMatch[1]!;
      const marker = token[0] as "`" | "~";
      if (!fence) {
        fence = { marker, length: token.length };
      } else if (fence.marker === marker && token.length >= fence.length) {
        fence = null;
      }
      keptLines.push(line);
      continue;
    }

    if (!fence) {
      const reference = standaloneSkillReference(line);
      if (reference) {
        references.push(reference);
        continue;
      }
    }
    keptLines.push(line);
  }

  return { text: keptLines.join("\n"), skillReferences: normalizeSkillReferences(references) };
}

function standaloneSkillReference(line: string): SkillReference | null {
  const match = /^\s*\[\$?([^\]\r\n]+)\]\((<?)([^)\r\n]+)(>?)\)\s*$/.exec(line);
  if (!match || (match[2] === "<") !== (match[4] === ">")) {
    return null;
  }
  const name = match[1]!.trim();
  const path = decodeSkillPath(match[3]!.trim());
  if (!name || !isAbsoluteSkillPath(path)) {
    return null;
  }
  return { name, path };
}

function decodeSkillPath(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function isAbsoluteSkillPath(value: string): boolean {
  const absolute = /^\/(?!\/)/.test(value) || /^[A-Za-z]:[\\/]/.test(value);
  return absolute && /(?:^|[\\/])SKILL\.md$/i.test(value);
}

function normalizeSkillReferences(references?: SkillReference[]): SkillReference[] {
  const unique = new Map<string, SkillReference>();
  for (const reference of references ?? []) {
    const name = reference.name.trim().replace(/^\$/, "");
    const path = reference.path.trim();
    if (name && path) {
      unique.set(`${name}\u0001${path}`, { name, path });
    }
  }
  return [...unique.values()];
}

export function skillDisplayName(name: string): string {
  const words = name.trim().replace(/^\$/, "").split(/[-_\s]+/).filter(Boolean);
  const connectors = new Set(["and", "for", "in", "of", "to", "with"]);
  return words
    .map((word, index) => {
      const lower = word.toLowerCase();
      if (lower === "openspec") return "OpenSpec";
      if (index > 0 && connectors.has(lower)) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
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
  const createdAt = timelineItemCreatedAt(item, fallbackCreatedAt);
  switch (item.role as TimelineRole) {
    case "user": {
      const normalized = normalizeUserTextAndImages(item.text, item.imagePaths, item.skillReferences);
      return {
        id,
        ...meta,
        createdAt,
        body: {
          kind: "user-message",
          text: normalized.text,
          ...(normalized.imagePaths?.length ? { imagePaths: normalized.imagePaths } : {}),
          ...(normalized.skillReferences?.length ? { skillReferences: normalized.skillReferences } : {}),
          ...(item.fileReferences?.length
            ? { fileReferences: item.fileReferences }
            : normalized.fileReferences?.length
              ? { fileReferences: normalized.fileReferences }
              : {}),
          status: "sent"
        }
      };
    }
    case "agent":
      return { id, ...meta, createdAt, body: { kind: "agent-message", text: item.text } };
    case "reasoning":
      return { id, ...meta, createdAt, body: { kind: "reasoning", text: item.text, done: item.done ?? true } };
    case "plan":
      return { id, ...meta, createdAt, body: { kind: "system", text: item.text } };
    case "system":
      return {
        id,
        ...meta,
        createdAt,
        body: {
          kind: "system",
          text: item.text,
          ...(item.systemKind ? { systemKind: item.systemKind } : {}),
          ...(item.status ? { status: item.status } : {})
        }
      };
    case "error":
      return { id, ...meta, createdAt, body: { kind: "error", text: item.text } };
    case "diff":
      return {
        ...diffEntryFromText(id, item.text, createdAt, item.diffPath ?? "工作区变更", {
        added: item.added,
        removed: item.removed
        }),
        ...meta
      };
    case "tool":
      return {
        id,
        ...meta,
        createdAt,
        body: {
          kind: "tool",
          toolKind: item.toolKind,
          actionKind: item.actionKind,
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
      return { id, ...meta, createdAt, body: { kind: "system", text: item.text } };
  }
}

const MIN_REAL_TIMESTAMP_MS = Date.UTC(2000, 0, 1);
const MAX_REAL_TIMESTAMP_MS = Date.UTC(3000, 0, 1);

function timelineItemCreatedAt(item: TimelineItem, fallbackCreatedAt: number): number {
  const itemCreatedAt = normalizeTimelineTimestamp(item.createdAt);
  if (itemCreatedAt !== null) {
    return itemCreatedAt;
  }

  const turnCreatedAt = uuidV7Timestamp(item.turnId);
  if (turnCreatedAt !== null) {
    return turnCreatedAt;
  }

  return normalizeTimelineTimestamp(fallbackCreatedAt) ?? fallbackCreatedAt;
}

function normalizeTimelineTimestamp(value: number | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  if (value >= MIN_REAL_TIMESTAMP_MS && value < MAX_REAL_TIMESTAMP_MS) {
    return value;
  }
  const milliseconds = value * 1000;
  if (milliseconds >= MIN_REAL_TIMESTAMP_MS && milliseconds < MAX_REAL_TIMESTAMP_MS) {
    return milliseconds;
  }
  return value;
}

function uuidV7Timestamp(value: string | undefined): number | null {
  const match = value?.match(/^([0-9a-f]{8})-([0-9a-f]{4})-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  if (!match) {
    return null;
  }
  const timestamp = Number.parseInt(`${match[1]}${match[2]}`, 16);
  return timestamp >= MIN_REAL_TIMESTAMP_MS && timestamp < MAX_REAL_TIMESTAMP_MS ? timestamp : null;
}

function timelineEntryMeta(
  item: TimelineItem
): Pick<
  TimelineEntry,
  | "turnId"
  | "turnIndex"
  | "clientUserMessageId"
  | "generation"
  | "bootId"
  | "historyStamp"
  | "snapshotSequence"
  | "streamSequence"
  | "fragmentSequence"
  | "baselineWatermark"
  | "sourceLocator"
  | "provisional"
  | "completeness"
> {
  return {
    ...(item.turnId ? { turnId: item.turnId } : {}),
    ...(typeof item.turnIndex === "number" ? { turnIndex: item.turnIndex } : {}),
    ...(item.clientUserMessageId ? { clientUserMessageId: item.clientUserMessageId } : {}),
    ...(typeof item.generation === "number" ? { generation: item.generation } : {}),
    ...(item.bootId ? { bootId: item.bootId } : {}),
    ...(item.historyStamp ? { historyStamp: item.historyStamp } : {}),
    ...(typeof item.snapshotSequence === "number" ? { snapshotSequence: item.snapshotSequence } : {}),
    ...(typeof item.streamSequence === "number" ? { streamSequence: item.streamSequence } : {}),
    ...(typeof item.fragmentSequence === "number" ? { fragmentSequence: item.fragmentSequence } : {}),
    ...(typeof item.baselineWatermark === "number" ? { baselineWatermark: item.baselineWatermark } : {}),
    ...(item.sourceLocator ? { sourceLocator: item.sourceLocator } : {}),
    ...(item.provisional ? { provisional: item.provisional } : {}),
    ...(item.completeness ? { completeness: item.completeness } : {})
  };
}

export function rollbackTurnsForEntry(
  entries: TimelineEntry[],
  target: TimelineEntry,
  options: { cursor?: string | null; turnManifest?: AuthoritativeTurnManifest | null } = {}
): number | null {
  return rollbackMetadataForEntry(entries, target, options)?.expectedTailTurnIds.length ?? null;
}

export function rollbackMetadataForEntry(
  entries: TimelineEntry[],
  target: TimelineEntry,
  options: { cursor?: string | null; turnManifest?: AuthoritativeTurnManifest | null } = {}
): {
  targetTurnId: string;
  historyStamp: HistoryStamp;
  expectedTailTurnIds: string[];
} | null {
  return selectRollbackMetadataForEntry(
    createTimelineEngineState({
      entries,
      cursor: options.cursor ?? null,
      turnManifest: options.turnManifest ?? null
    }),
    target
  );
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
