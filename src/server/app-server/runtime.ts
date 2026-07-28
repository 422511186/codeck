import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createInterface } from "node:readline";
import { createHash, randomUUID } from "node:crypto";
import { assertRuntimeSessionRolloutFileAllowed } from "../security";
import type { AppServerConfig } from "../../config/env";
import type { ThreadMemoryMode } from "../../../docs/generated/app-server-ts/ThreadMemoryMode";
import type {
  MobileCommandResult,
  MobileConfigEditInput,
  MobileEnvironmentAddResult,
  MobileExternalAgentConfigDetectResult,
  MobileExternalAgentConfigImportResult,
  MobileFeedbackUploadResult,
  MobileFileContent,
  MobileFileEntry,
  MobileFileMetadata,
  MobileAccountLoginCancelView,
  MobileAccountLoginView,
  MobileAccountTokenUsageView,
  MobileAddCreditsNudgeResultView,
  MobileAuthStatusView,
  MobileAppPage,
  MobileBackgroundTerminalPage,
  MobileBackgroundTerminalTerminateResult,
  MobileCollaborationModeView,
  MobileConfigRequirementsView,
  MobileConfigWriteResultView,
  MobileMcpLoginView,
  MobileMcpResourceReadView,
  MobileMcpToolCallResult,
  MobileModelDefaultsView,
  MobileModelOption,
  MobileMarketplaceAddResult,
  MobileMarketplaceRemoveResult,
  MobileMarketplaceUpgradeResult,
  MobileFileSearchSessionView,
  MobileFileSearchResult,
  MobilePluginDetailView,
  MobileGitDiffView,
  MobileJsonValue,
  MobileMockExperimentalMethodResult,
  MobilePluginInstallResultView,
  MobilePluginInstalledResult,
  MobilePluginShareCheckoutResult,
  MobilePluginShareDeleteResult,
  MobilePluginShareListResult,
  MobilePluginShareSaveResult,
  MobilePluginShareUpdateTargetsResult,
  MobilePluginSkillContentView,
  MobileRateLimitResetCreditConsumeResult,
  MobileRemoteControlPairingStatusView,
  MobileRemoteControlPairingView,
  MobileRemoteControlStatusView,
  MobileSettingsView,
  MobileSkillConfigWriteResultView,
  MobileSkillListView,
  MobileTerminalSession,
  MobileThreadElicitationResult,
  MobileThreadGoalView,
  MobileThreadMetadataUpdateInput,
  MobilePermissionSelection,
  MobileRuntimePermissionObservation,
  MobileThreadRealtimeStatusResult,
  MobileThreadRealtimeVoicesResult,
  MobileThreadUnsubscribeResult,
  MobileTimelineItem,
  MobileTimelineContentChunk,
  MobileTimelinePage,
  MobileThreadDetail,
  MobileThreadPage,
  MobileThreadSummary,
  MobileWindowsSandboxReadinessView,
  MobileWindowsSandboxSetupResultView
} from "../../shared/codex";
import {
  TIMELINE_RESPONSE_BYTE_BUDGET,
  TIMELINE_PAGE_BYTE_BUDGET,
  TIMELINE_ITEM_INLINE_BYTE_BUDGET,
  TIMELINE_CONTENT_CHUNK_BYTE_BUDGET,
  boundedTimelineText,
  utf8SafeChunk,
  utf8ByteLength,
  type TimelineCompleteness
} from "../../shared/timeline-content";
import {
  resolveAgentMessageAlias,
  timelineEmptyWindowAnchor,
  type AgentMessageAliasCandidate,
  type AgentMessageAliasResolution,
  type AuthoritativeTurnManifest,
  type HistoryStamp,
  type TimelineGapScope
} from "../../shared/timeline-protocol";
import { getRuntimeConfig } from "../runtime";
import {
  CodexAppServerClient,
  TimelineRepairRequiredError,
  type AddEnvironmentInput,
  type AddMarketplaceInput,
  type AppendThreadRealtimeAudioInput,
  type AppendThreadRealtimeSpeechInput,
  type AppendThreadRealtimeTextInput,
  type AppServerPeer,
  type CallMcpToolInput,
  type DetectExternalAgentConfigInput,
  type ExecCommandInput,
  type ImportExternalAgentConfigInput,
  type ListAppsInput,
  type ListInstalledPluginsInput,
  type ListSkillsInput,
  type ListThreadBackgroundTerminalsInput,
  type ListThreadTurnItemsInput,
  type ListThreadTurnsInput,
  type PluginLookupInput,
  type SavePluginShareInput,
  type PluginSkillReadInput,
  type GetConversationSummaryInput,
  type ReadMcpResourceInput,
  type SearchThreadsInput,
  type SearchFilesInput,
  type SetThreadGoalInput,
  type StartCommandExecInput,
  type StartProcessInput,
  type StartThreadInput,
  type ThreadRuntimeOverrides,
  type StartThreadRealtimeInput,
  type StartTurnInput,
  type UpdatePluginShareTargetsInput,
  type UpdateThreadSettingsInput,
  type UploadFeedbackInput,
  type WindowsSandboxSetupInput,
  type WriteSkillConfigInput
} from "./client";
import type { AppServerNotificationMessage, BrowserCodexEventEnvelope } from "./events";
import { normalizeAppServerNotification } from "./events";
import {
  buildPendingServerRequestResponse,
  normalizePendingServerRequest,
  type AppServerServerRequestMessage,
  type BrowserServerRequestEvent,
  type PendingServerRequestView
} from "./pending-requests";
import {
  latestSessionContextUsageFromLines,
  mergeSessionTimelineRecords,
  scanSessionTimelineSupplement,
  sessionToolOutputFromLines,
  type SessionContentRefLocator,
  type SessionTimelineRecord
} from "./session-timeline";
import { createManagedAppServerPeer, type AppServerStatus, type ManagedAppServerPeer } from "./transport";
import {
  browserTimelineEventForBudget,
  type TimelineEventContentLocator
} from "../timeline-event-payload";
import { createTextUserInput } from "./user-input";
import type { ThreadStartParams } from "../../../docs/generated/app-server-ts/v2/ThreadStartParams";
import type { TurnStartParams } from "../../../docs/generated/app-server-ts/v2/TurnStartParams";
import type { ThreadForkParams } from "../../../docs/generated/app-server-ts/v2/ThreadForkParams";
import type { ThreadCompactStartParams } from "../../../docs/generated/app-server-ts/v2/ThreadCompactStartParams";
import type { ThreadResumeParams } from "../../../docs/generated/app-server-ts/v2/ThreadResumeParams";
import type { ThreadRollbackParams } from "../../../docs/generated/app-server-ts/v2/ThreadRollbackParams";
import type { ThreadSetNameParams } from "../../../docs/generated/app-server-ts/v2/ThreadSetNameParams";
import type { ThreadSettingsUpdateParams } from "../../../docs/generated/app-server-ts/v2/ThreadSettingsUpdateParams";
import type { ThreadGoalSetParams } from "../../../docs/generated/app-server-ts/v2/ThreadGoalSetParams";
import type { ReviewStartParams } from "../../../docs/generated/app-server-ts/v2/ReviewStartParams";
import type { TurnSteerParams } from "../../../docs/generated/app-server-ts/v2/TurnSteerParams";
import type { Thread } from "../../../docs/generated/app-server-ts/v2/Thread";
import type { CommandExecParams } from "../../../docs/generated/app-server-ts/v2/CommandExecParams";
import type { CommandExecResizeParams } from "../../../docs/generated/app-server-ts/v2/CommandExecResizeParams";
import type { CommandExecTerminateParams } from "../../../docs/generated/app-server-ts/v2/CommandExecTerminateParams";
import type { CommandExecWriteParams } from "../../../docs/generated/app-server-ts/v2/CommandExecWriteParams";
import type { ConfigBatchWriteParams } from "../../../docs/generated/app-server-ts/v2/ConfigBatchWriteParams";
import type { ConfigReadResponse } from "../../../docs/generated/app-server-ts/v2/ConfigReadResponse";
import type { ConfigValueWriteParams } from "../../../docs/generated/app-server-ts/v2/ConfigValueWriteParams";
import type { FsCopyParams } from "../../../docs/generated/app-server-ts/v2/FsCopyParams";
import type { FsCreateDirectoryParams } from "../../../docs/generated/app-server-ts/v2/FsCreateDirectoryParams";
import type { FsGetMetadataParams } from "../../../docs/generated/app-server-ts/v2/FsGetMetadataParams";
import type { FsReadDirectoryParams } from "../../../docs/generated/app-server-ts/v2/FsReadDirectoryParams";
import type { FsReadFileParams } from "../../../docs/generated/app-server-ts/v2/FsReadFileParams";
import type { FsRemoveParams } from "../../../docs/generated/app-server-ts/v2/FsRemoveParams";
import type { FsUnwatchParams } from "../../../docs/generated/app-server-ts/v2/FsUnwatchParams";
import type { FsWatchParams } from "../../../docs/generated/app-server-ts/v2/FsWatchParams";
import type { FsWriteFileParams } from "../../../docs/generated/app-server-ts/v2/FsWriteFileParams";
import type { ProcessKillParams } from "../../../docs/generated/app-server-ts/v2/ProcessKillParams";
import type { ProcessResizePtyParams } from "../../../docs/generated/app-server-ts/v2/ProcessResizePtyParams";
import type { ProcessSpawnParams } from "../../../docs/generated/app-server-ts/v2/ProcessSpawnParams";
import type { ProcessWriteStdinParams } from "../../../docs/generated/app-server-ts/v2/ProcessWriteStdinParams";
import type { ThreadTurnsListParams } from "../../../docs/generated/app-server-ts/v2/ThreadTurnsListParams";
import type { ThreadListParams } from "../../../docs/generated/app-server-ts/v2/ThreadListParams";
import type { ThreadSearchParams } from "../../../docs/generated/app-server-ts/v2/ThreadSearchParams";
import type { ThreadMemoryModeSetParams } from "../../../docs/generated/app-server-ts/v2/ThreadMemoryModeSetParams";
import type { ApprovalsReviewer } from "../../../docs/generated/app-server-ts/v2/ApprovalsReviewer";
import type { AskForApproval } from "../../../docs/generated/app-server-ts/v2/AskForApproval";

type TextUserInput = { type: "text"; text: string };
type TimelineOverlayEntry = {
  item: MobileTimelineItem;
  turnId: string | null;
  generation: number;
  provisionalAgent: boolean;
  updatedAtMs: number;
};

type TimelineGenerationTransition = {
  generation: number;
  previousStamp: { bootId: string; generation: number };
  stablePrefix: MobileTimelineItem[];
  nextTimeline: MobileTimelineItem[];
};

type BrowserEventOwnerRecord = {
  bootId: string;
  streamSequence: number;
  threadId: string | null;
  visible: boolean;
};

type TimelineContentSourceBase = {
  threadId: string;
  turnId: string;
  itemId: string;
  field: "text";
  sourceRevision: string;
  expiresAt: number;
};

type SessionTimelineContentSource = TimelineContentSourceBase & {
  kind: "session";
  callId: string;
  sequence: number;
  rolloutPath: string;
};

type AppServerTimelineContentSource = TimelineContentSourceBase & {
  kind: "app-server";
  contentDigest: string | null;
};

type TimelineContentSource = SessionTimelineContentSource | AppServerTimelineContentSource;

type TimelineContentCursorState = {
  contentRef: string;
  sourceRevision: string;
  byteOffset: number;
  chunkBytes: number;
};

export type BrowserTimelineEvent = BrowserCodexEventEnvelope | BrowserServerRequestEvent;

const MAX_TIMELINE_OVERLAY_ITEMS_PER_THREAD = 200;
const MAX_BROWSER_EVENT_BACKLOG = 500;
const MAX_TIMELINE_CONTENT_SOURCES = 2_000;
const MAX_TIMELINE_CONTENT_CURSORS = 10_000;
const MAX_BROWSER_EVENT_OWNER_LEDGER = 2_000;
const SESSION_TIMELINE_SUPPLEMENT_SOURCE_LIMIT = 64 * 1024 * 1024;
const SESSION_TIMELINE_SUPPLEMENT_MATCHED_TEXT_LIMIT = 16 * 1024 * 1024;
const TIMELINE_HARD_BUDGET_METADATA_BYTE_BUDGET = 16 * 1024;
const SESSION_CONTEXT_USAGE_TAIL_LINES = 500;
const SESSION_TIMELINE_SUPPLEMENT_SCAN_LINE_LIMIT = 200_000;
const SESSION_TIMELINE_SUPPLEMENT_RECORD_LIMIT = 240;
const SESSION_TIMELINE_SUPPLEMENT_SCAN_TIME_MS = 1_000;
const CONTEXT_COMPACTION_DONE_TEXT = "压缩上下文已完成";

function pendingReasoningItemId(threadId: string, turnId: string | null): string {
  return `${turnId ?? threadId}-reasoning-pending`;
}

function timelineTurnIdSet(items: MobileTimelineItem[]): Set<string> {
  const turnIds = new Set<string>();
  for (const item of items) {
    if (item.turnId) {
      turnIds.add(item.turnId);
    }
  }
  return turnIds;
}

type BoundedJsonlRead = {
  lines: string[];
  budgetExhausted: boolean;
};

async function readBoundedMatchingSessionLines(
  filePath: string,
  fileSize: number,
  options: {
    maxSourceBytes: number;
    maxMatchedBytes: number;
    maxLines: number;
    maxElapsedMs: number;
    matches: (line: string) => boolean;
  }
): Promise<BoundedJsonlRead> {
  if (fileSize <= 0) {
    return { lines: [], budgetExhausted: false };
  }
  const startedAt = Date.now();
  const start = Math.max(0, fileSize - options.maxSourceBytes);
  const stream = createReadStream(filePath, {
    encoding: "utf8",
    start,
    end: fileSize - 1,
    highWaterMark: 64 * 1024
  });
  const reader = createInterface({ input: stream, crlfDelay: Infinity });
  const lines: string[] = [];
  let sourceLines = 0;
  let matchedBytes = 0;
  let skipPartialLine = start > 0;
  let budgetExhausted = start > 0;

  try {
    for await (const line of reader) {
      if (skipPartialLine) {
        skipPartialLine = false;
        continue;
      }
      sourceLines += 1;
      if (sourceLines > options.maxLines || Date.now() - startedAt > options.maxElapsedMs) {
        budgetExhausted = true;
        break;
      }
      if (!options.matches(line)) {
        continue;
      }
      const lineBytes = utf8ByteLength(line) + 1;
      if (matchedBytes + lineBytes > options.maxMatchedBytes) {
        budgetExhausted = true;
        break;
      }
      matchedBytes += lineBytes;
      lines.push(line);
    }
  } finally {
    reader.close();
    stream.destroy();
  }

  return { lines, budgetExhausted };
}

function mergeOverlayItems(current: MobileTimelineItem, next: MobileTimelineItem): MobileTimelineItem {
  if (current.role !== next.role) {
    return next;
  }

  return {
    ...current,
    ...next,
    text: next.text || current.text,
    imagePaths: next.imagePaths ?? current.imagePaths,
    fileReferences: next.fileReferences ?? current.fileReferences,
    arguments: next.arguments ?? current.arguments,
    status: next.status ?? current.status,
    done: next.done ?? current.done
  };
}

function isRawResponseAgentItem(item: MobileTimelineItem): boolean {
  return item.role === "agent" && item.sourceLocator?.sourceKind === "response";
}

function agentAliasCandidate(
  item: MobileTimelineItem,
  turnId: string | null,
  generation: number,
  provisional: boolean
): AgentMessageAliasCandidate | null {
  if (item.role !== "agent" || !turnId) {
    return null;
  }
  return {
    id: item.id,
    turnId,
    generation,
    text: item.text,
    provisional
  };
}

function sameAgentAlias(
  left: AgentMessageAliasResolution,
  right: AgentMessageAliasResolution
): left is Extract<AgentMessageAliasResolution, { kind: "alias" }> {
  return left.kind === "alias" &&
    right.kind === "alias" &&
    left.canonicalId === right.canonicalId &&
    left.provisionalId === right.provisionalId;
}

function reciprocalAgentMessageAlias(
  incoming: AgentMessageAliasCandidate,
  candidates: AgentMessageAliasCandidate[]
): Extract<AgentMessageAliasResolution, { kind: "alias" }> | null {
  const resolution = resolveAgentMessageAlias(incoming, candidates);
  if (resolution.kind !== "alias") {
    return null;
  }
  const counterpartId = incoming.id === resolution.canonicalId
    ? resolution.provisionalId
    : resolution.canonicalId;
  const counterpart = candidates.find((candidate) => candidate.id === counterpartId);
  if (!counterpart) {
    return null;
  }
  const reverse = resolveAgentMessageAlias(
    counterpart,
    [incoming, ...candidates.filter((candidate) => candidate.id !== counterpart.id)]
  );
  return sameAgentAlias(resolution, reverse) ? resolution : null;
}

function mergeAgentAliasItems(
  provisional: MobileTimelineItem,
  canonical: MobileTimelineItem
): MobileTimelineItem {
  const { sourceLocator: _provisionalSourceLocator, ...provisionalFields } = provisional;
  const createdAt = [provisional.createdAt, canonical.createdAt]
    .filter((value): value is number => typeof value === "number")
    .sort((left, right) => left - right)[0];
  return {
    ...provisionalFields,
    ...canonical,
    id: canonical.id,
    text: canonical.text,
    ...(typeof createdAt === "number" ? { createdAt } : {})
  };
}

type UniqueTimelineIdentityIndex = Map<string, string | null>;

function addUniqueTimelineIdentity(
  index: UniqueTimelineIdentityIndex,
  key: string | null,
  itemId: string
): void {
  if (!key) {
    return;
  }
  const current = index.get(key);
  if (current === undefined) {
    index.set(key, itemId);
  } else if (current !== itemId) {
    index.set(key, null);
  }
}

function timelineItemGeneration(item: MobileTimelineItem, fallback: number): number {
  return item.historyStamp?.generation ?? item.generation ?? fallback;
}

function materializedOverlayIdentityKey(
  item: MobileTimelineItem,
  turnId: string | null,
  generation: number
): string | null {
  if (!turnId) {
    return null;
  }
  if (item.role === "agent") {
    const text = item.text.trim();
    return text ? `agent\u0000${generation}\u0000${turnId}\u0000${text}` : null;
  }
  if (item.role === "user" && item.clientUserMessageId) {
    return `user\u0000${generation}\u0000${turnId}\u0000${item.clientUserMessageId}`;
  }
  return null;
}

function materializedTimelineOverlayIds(
  items: MobileTimelineItem[],
  overlay: ReadonlyMap<string, TimelineOverlayEntry>,
  generation: number
): Set<string> {
  const historyIdentities: UniqueTimelineIdentityIndex = new Map();
  const overlayIdentities: UniqueTimelineIdentityIndex = new Map();

  for (const item of items) {
    addUniqueTimelineIdentity(
      historyIdentities,
      materializedOverlayIdentityKey(
        item,
        item.turnId ?? null,
        timelineItemGeneration(item, generation)
      ),
      item.id
    );
  }

  for (const [id, entry] of overlay) {
    if (entry.item.role === "agent" && (entry.provisionalAgent || isRawResponseAgentItem(entry.item))) {
      continue;
    }
    addUniqueTimelineIdentity(
      overlayIdentities,
      materializedOverlayIdentityKey(entry.item, entry.turnId, entry.generation),
      id
    );
  }

  const materialized = new Set<string>();
  for (const [key, overlayId] of overlayIdentities) {
    const historyId = historyIdentities.get(key);
    if (typeof overlayId === "string" && typeof historyId === "string" && overlayId !== historyId) {
      materialized.add(overlayId);
    }
  }
  return materialized;
}

function agentAliasesById(
  items: MobileTimelineItem[],
  overlay: ReadonlyMap<string, TimelineOverlayEntry>,
  materializedOverlayIds: ReadonlySet<string>,
  generation: number
): Map<string, Extract<AgentMessageAliasResolution, { kind: "alias" }>> {
  const historyIds = new Set(items.map((item) => item.id));
  const candidateByIdentity = new Map<string, AgentMessageAliasCandidate>();
  const addCandidate = (candidate: AgentMessageAliasCandidate | null) => {
    if (!candidate) return;
    candidateByIdentity.set(`${candidate.id}\u0000${candidate.provisional ? "p" : "c"}`, candidate);
  };

  for (const item of items) {
    addCandidate(agentAliasCandidate(
      item,
      item.turnId ?? null,
      timelineItemGeneration(item, generation),
      isRawResponseAgentItem(item)
    ));
  }
  for (const [id, entry] of overlay) {
    if (materializedOverlayIds.has(id) || historyIds.has(id)) {
      continue;
    }
    addCandidate(agentAliasCandidate(
      entry.item,
      entry.turnId,
      entry.generation,
      entry.provisionalAgent
    ));
  }

  const candidatesByTurn = new Map<string, AgentMessageAliasCandidate[]>();
  for (const candidate of candidateByIdentity.values()) {
    const key = `${candidate.generation}\u0000${candidate.turnId}`;
    const candidates = candidatesByTurn.get(key) ?? [];
    candidates.push(candidate);
    candidatesByTurn.set(key, candidates);
  }

  const aliases = new Map<string, Extract<AgentMessageAliasResolution, { kind: "alias" }>>();
  for (const candidates of candidatesByTurn.values()) {
    if (!candidates.some((candidate) => candidate.provisional)) {
      continue;
    }
    for (const candidate of candidates) {
      if (!candidate.provisional) {
        continue;
      }
      const alias = reciprocalAgentMessageAlias(
        candidate,
        candidates.filter((existing) => existing.id !== candidate.id)
      );
      if (alias) {
        aliases.set(alias.canonicalId, alias);
        aliases.set(alias.provisionalId, alias);
      }
    }
  }
  return aliases;
}

function overlayItemWithTurnMeta(item: MobileTimelineItem, turnId: string | null): MobileTimelineItem {
  return {
    ...item,
    ...(turnId ? { turnId } : {})
  };
}

function cloneTimelineOverlay(
  overlay: ReadonlyMap<string, TimelineOverlayEntry> | undefined
): Map<string, TimelineOverlayEntry> {
  return new Map(
    [...(overlay ?? [])].map(([id, entry]) => [
      id,
      {
        ...entry,
        item: {
          ...entry.item,
          ...(entry.item.imagePaths ? { imagePaths: [...entry.item.imagePaths] } : {}),
          ...(entry.item.skillReferences ? { skillReferences: [...entry.item.skillReferences] } : {}),
          ...(entry.item.fileReferences ? { fileReferences: entry.item.fileReferences.map((file) => ({ ...file })) } : {})
        }
      }
    ])
  );
}

function timelineWindowAnchor(
  historyStamp: { bootId: string; generation: number },
  item: MobileTimelineItem
): string {
  return JSON.stringify([
    historyStamp.bootId,
    historyStamp.generation,
    item.turnId ?? null,
    item.id
  ]);
}

function timelineItemIdentityMatches(left: MobileTimelineItem, right: MobileTimelineItem): boolean {
  return left.id === right.id && (left.turnId ?? null) === (right.turnId ?? null);
}

function stableTimelinePrefix(
  previous: MobileTimelineItem[],
  next: MobileTimelineItem[]
): MobileTimelineItem[] {
  const limit = Math.min(previous.length, next.length);
  let length = 0;
  while (length < limit && timelineItemIdentityMatches(previous[length]!, next[length]!)) {
    length += 1;
  }
  return previous.slice(0, length);
}

function stableTimelineSuffixLength(previous: MobileTimelineItem[], next: MobileTimelineItem[]): number {
  const limit = Math.min(previous.length, next.length);
  let length = 0;
  while (
    length < limit &&
    timelineItemIdentityMatches(previous[previous.length - 1 - length]!, next[next.length - 1 - length]!)
  ) {
    length += 1;
  }
  return length;
}

function reverseTimelineTurnGroups(items: MobileTimelineItem[]): MobileTimelineItem[] {
  const groups: MobileTimelineItem[][] = [];
  for (const item of items) {
    const current = groups.at(-1);
    if (current?.[0]?.turnId && current[0].turnId === item.turnId) {
      current.push(item);
    } else {
      groups.push([item]);
    }
  }
  return groups.reverse().flat();
}

function chronologicalTimelineTransition(
  previous: MobileTimelineItem[],
  next: MobileTimelineItem[]
): { previous: MobileTimelineItem[]; next: MobileTimelineItem[] } {
  const prefixLength = stableTimelinePrefix(previous, next).length;
  const suffixLength = stableTimelineSuffixLength(previous, next);
  return suffixLength > prefixLength
    ? { previous: reverseTimelineTurnGroups(previous), next: reverseTimelineTurnGroups(next) }
    : { previous, next };
}

function mergeTimelineTurnMeta(base: MobileTimelineItem, overlay: MobileTimelineItem): MobileTimelineItem {
  return {
    ...overlay,
    ...(overlay.imagePaths?.length || !base.imagePaths?.length ? {} : { imagePaths: base.imagePaths }),
    ...(overlay.skillReferences?.length || !base.skillReferences?.length ? {} : { skillReferences: base.skillReferences }),
    ...(overlay.fileReferences?.length || !base.fileReferences?.length ? {} : { fileReferences: base.fileReferences }),
    ...(overlay.turnId || !base.turnId ? {} : { turnId: base.turnId }),
    ...(typeof overlay.turnIndex === "number" || typeof base.turnIndex !== "number" ? {} : { turnIndex: base.turnIndex })
  };
}

export function browserEventId(event: BrowserTimelineEvent): string {
  if (event.type === "codex-event") {
    return event.event.eventId ?? `${browserCodexEventThreadKey(event)}:${event.event.kind}`;
  }
  if (event.type === "server-request") {
    return `server-request:${event.request.requestId}`;
  }
  return `server-request-resolved:${event.requestId}`;
}

function browserEventCursor(eventId: string): { bootId: string; streamSequence: number } | null {
  const match = /^([^:]+):[^:]+:\d+:(\d+):[^:]+$/.exec(eventId);
  if (!match) {
    return null;
  }
  const streamSequence = Number(match[2]);
  return Number.isSafeInteger(streamSequence) && streamSequence >= 0
    ? { bootId: match[1]!, streamSequence }
    : null;
}

function browserEventStreamSequence(event: BrowserTimelineEvent): number {
  if (event.type !== "codex-event") {
    return Number.POSITIVE_INFINITY;
  }
  return event.event.streamSequence ?? event.event.sequence ?? Number.POSITIVE_INFINITY;
}

function browserCodexEventThreadKey(envelope: BrowserCodexEventEnvelope): string {
  const threadId = "threadId" in envelope.event ? envelope.event.threadId : null;
  return typeof threadId === "string" && threadId ? threadId : "_global";
}

function timelineTurnIds(timeline: MobileTimelineItem[]): string[] {
  const turnIds: string[] = [];
  const seen = new Set<string>();
  for (const item of timeline) {
    if (!item.turnId || seen.has(item.turnId)) {
      continue;
    }
    seen.add(item.turnId);
    turnIds.push(item.turnId);
  }
  return turnIds;
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter((value) => value.length > 0)));
}

function sameStringArray(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function diffStats(diff: string): { added: number; removed: number } {
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

function shouldExposeOverlayTimelineItem(item: MobileTimelineItem): boolean {
  if (item.role === "reasoning") {
    return item.done === false || item.text.trim().length > 0;
  }

  if (item.role === "tool") {
    return Boolean(item.text.trim() || item.arguments || item.imagePaths?.length || item.server || item.tool);
  }

  return item.text.trim().length > 0;
}


function isMissingLiveThreadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  if (/permission denied|invalid params|invalid argument|invalid request/i.test(message)) {
    return false;
  }
  return (
    /thread not found/i.test(message) ||
    /not loaded/i.test(message) ||
    /is not materialized yet/i.test(message)
  );
}

function isAlreadyInitializedError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /already initialized/i.test(message);
}

function isUnsupportedTurnItemsListError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /thread\/turns\/items\/list/i.test(message) && /not supported/i.test(message);
}

function shouldUseOverlayTimelineItem(base: MobileTimelineItem, overlay: MobileTimelineItem): boolean {
  if (base.role !== overlay.role) {
    return base.role === "system" && overlay.role !== "system";
  }

  if (base.role === "reasoning") {
    if (overlay.done === false && !base.text.trim()) {
      return true;
    }
    return overlay.text.length > base.text.length;
  }

  if (base.role === "tool") {
    const baseFinal = base.status === "success" || base.status === "failed";
    const overlayRunning = overlay.status === "running";
    if (baseFinal && overlayRunning) {
      return false;
    }
    if (!baseFinal && overlay.status && overlay.status !== base.status) {
      return true;
    }
    return !base.text && Boolean(overlay.text) || (!baseFinal && overlay.text.length > base.text.length);
  }

  return overlay.text.length > base.text.length;
}

function insertOverlayTimelineItem(timeline: MobileTimelineItem[], item: MobileTimelineItem): MobileTimelineItem[] {
  if (!item.turnId || !isInlineActivityTimelineItem(item)) {
    return [...timeline, item];
  }

  const firstTurnIndex = timeline.findIndex((candidate) => candidate.turnId === item.turnId);
  if (firstTurnIndex < 0) {
    return [...timeline, item];
  }

  let lastTurnIndex = firstTurnIndex;
  for (let index = firstTurnIndex + 1; index < timeline.length; index += 1) {
    if (timeline[index]?.turnId === item.turnId) {
      lastTurnIndex = index;
    }
  }

  const beforeTurn = timeline.slice(0, firstTurnIndex);
  const turnItems = repairOverlayTurnItems([
    ...timeline.slice(firstTurnIndex, lastTurnIndex + 1),
    item
  ]);
  const afterTurn = timeline.slice(lastTurnIndex + 1).filter((candidate) => candidate.turnId !== item.turnId);
  return [...beforeTurn, ...turnItems, ...afterTurn];
}

function repairOverlayTurnItems(items: MobileTimelineItem[]): MobileTimelineItem[] {
  // Preserve interleaved tool/assistant order. New unmatched overlay activity is
  // appended by insertOverlayTimelineItem; do not infer a final assistant reply
  // from role alone and drag trailing activity in front of intermediate text.
  if (items.length < 2) {
    return items;
  }

  const result = [...items];
  let changed = false;

  for (let index = 0; index < result.length; index += 1) {
    const item = result[index]!;
    if (!isInlineActivityTimelineItem(item)) {
      continue;
    }

    const targetIndex = resolveOverlayActivityInsertIndex(result, item, index);
    if (targetIndex === index) {
      continue;
    }

    result.splice(index, 1);
    const adjustedTarget = targetIndex > index ? targetIndex - 1 : targetIndex;
    result.splice(Math.max(0, Math.min(result.length, adjustedTarget)), 0, item);
    changed = true;
    index = -1;
  }

  return changed ? result : items;
}

function resolveOverlayActivityInsertIndex(
  items: MobileTimelineItem[],
  item: MobileTimelineItem,
  currentIndex: number
): number {
  if (typeof item.streamSequence === "number") {
    for (let index = 0; index < items.length; index += 1) {
      if (index === currentIndex) {
        continue;
      }
      const candidate = items[index]!;
      if (typeof candidate.streamSequence === "number" && item.streamSequence < candidate.streamSequence) {
        return index;
      }
    }
  }

  const locator = item.sourceLocator;
  if (locator && (locator.sourceKind === "response" || locator.sourceKind === "rollout")) {
    for (let index = 0; index < items.length; index += 1) {
      if (index === currentIndex) {
        continue;
      }
      const candidate = items[index]!;
      const candidateLocator = candidate.sourceLocator;
      if (
        candidateLocator &&
        (candidateLocator.sourceKind === "response" || candidateLocator.sourceKind === "rollout") &&
        candidateLocator.sourceKind === locator.sourceKind &&
        candidateLocator.sourceId === locator.sourceId &&
        locator.absoluteOutputIndex < candidateLocator.absoluteOutputIndex
      ) {
        return index;
      }
    }
  }

  // Non-destructive fallback: keep source order and never hop over existing visible assistants.
  return currentIndex;
}

function isInlineActivityTimelineItem(item: MobileTimelineItem): boolean {
  return item.role === "reasoning" || item.role === "tool" || item.role === "diff";
}

type MockFsNode = {
  type: "directory" | "file";
  createdAtMs: number;
  modifiedAtMs: number;
  text?: string;
};

type MockCommandExec = {
  resolve(response: MobileCommandResult): void;
};

class MockAppServerPeer implements ManagedAppServerPeer {
  private status: AppServerStatus = { state: "idle", mode: "mock", managedByCurrentProcess: false, reusedExisting: false };
  private thread: Thread = this.createThread();
  private threads: Thread[] = [this.thread];
  private readonly archivedThreads = new Map<string, Thread>();
  private readonly permissionProfilesByThread = new Map<string, string | null>();
  private readonly approvalPoliciesByThread = new Map<string, AskForApproval | null>();
  private readonly approvalsReviewersByThread = new Map<string, ApprovalsReviewer | null>();
  private turnCounter = 1;
  private itemCounter = 2;
  private requestCounter = 0;
  private rateLimitUsedPercent = 42;
  private rateLimitResetCreditsAvailable = 1;
  private remoteControlEnabled = true;
  private remoteControlEnvironmentId: string | null = "mock-env";
  private remoteControlClients = [
    {
      clientId: "mock-phone",
      displayName: "手机浏览器",
      deviceType: "phone",
      platform: "web",
      osVersion: null,
      deviceModel: null,
      appVersion: "0.1.0",
      lastSeenAt: 1_800_000_001
    }
  ];
  private remotePairingClaimed = false;
  private goals = new Map<string, MobileThreadGoalView>();
  private accountState: "chatgpt" | "apiKey" | "none" = "chatgpt";
  private windowsSandboxStatus: "ready" | "notConfigured" | "updateRequired" = "updateRequired";
  private mockConfig: Record<string, unknown> = {
    model: "gpt-5-codex",
    model_provider: "openai",
    model_reasoning_effort: "medium",
    approval_policy: "untrusted",
    sandbox_mode: "workspace-write"
  };
  private mockConfigVersion = 1;
  private experimentalFeatures = [
    {
      name: "appshots",
      stage: "beta",
      displayName: "Appshots",
      description: "自动保存移动端应用截图",
      announcement: "Appshots 已可在移动端试用",
      enabled: false,
      defaultEnabled: false
    }
  ];
  private backgroundTerminals = [
    {
      itemId: "mock-bg-item-1",
      processId: "mock-bg-1",
      command: "npm run dev",
      cwd: "C:\\Users\\huang\\workspace",
      osPid: 4242,
      cpuPercent: 1.5,
      rssKb: 2048n
    }
  ];
  private readonly workspaceRoot = "C:\\Users\\huang\\workspace";
  private readonly mockFs = new Map<string, MockFsNode>([
    [
      "C:\\Users\\huang\\workspace",
      { type: "directory", createdAtMs: 1_700_000_000_000, modifiedAtMs: 1_700_000_000_000 }
    ],
    [
      "C:\\Users\\huang\\workspace\\src",
      { type: "directory", createdAtMs: 1_700_000_000_000, modifiedAtMs: 1_700_000_000_000 }
    ],
    [
      "C:\\Users\\huang\\workspace\\src\\app.ts",
      {
        type: "file",
        createdAtMs: 1_700_000_000_000,
        modifiedAtMs: 1_700_000_000_000,
        text: "export const app = 'mock';\n"
      }
    ],
    [
      "C:\\Users\\huang\\workspace\\README.md",
      {
        type: "file",
        createdAtMs: 1_700_000_000_000,
        modifiedAtMs: 1_700_000_000_000,
        text: "# codeck\n\n移动端 Web 工作台 mock 文件。"
      }
    ]
  ]);
  private readonly mockProcesses = new Set<string>();
  private readonly mockCommandExecs = new Map<string, MockCommandExec>();
  private readonly mockFsWatches = new Map<string, string>();
  private readonly mockFileSearchSessions = new Set<string>();
  private readonly mockElicitationCounts = new Map<string, number>();
  private readonly consumedRateLimitResetCredits = new Set<string>();
  private readonly notificationHandlers = new Set<(message: AppServerNotificationMessage) => void>();
  private readonly serverRequestHandlers = new Set<(message: AppServerServerRequestMessage) => void>();

  private createThread(): Thread {
    return {
      id: "mock-thread-1",
      sessionId: "mock-session-1",
      forkedFromId: null,
      parentThreadId: null,
      extra: null,
      preview: "这是用于移动端联调的示例会话",
      ephemeral: false,
      historyMode: "paginated",
      modelProvider: "openai",
      createdAt: 1_767_000_000,
      updatedAt: 1_767_000_600,
      recencyAt: 1_767_000_600,
      status: { type: "idle" as const },
      path: null,
      cwd: "C:\\Users\\huang\\workspace",
      cliVersion: "0.141.0",
      source: "appServer" as const,
      threadSource: null,
      agentNickname: null,
      agentRole: null,
      gitInfo: null,
      name: "示例会话",
      turns: [
        {
          id: "mock-turn-1",
          itemsView: "full" as const,
          status: "completed" as const,
          error: null,
          startedAt: 1_767_000_010,
          completedAt: 1_767_000_100,
          durationMs: 90000,
          items: [
            {
              type: "userMessage" as const,
              id: "mock-user-1",
              clientId: "mock-client-user-1",
              content: [{ type: "text" as const, text: "帮我看看当前项目", text_elements: [] }]
            },
            {
              type: "agentMessage" as const,
              id: "mock-agent-1",
              text: "我已经连上 Codex app-server，可以读取历史和模型。",
              phase: "final_answer" as const,
              memoryCitation: null
            }
          ]
        }
      ]
    };
  }

  async connect(): Promise<void> {
    this.status = { state: "ready", mode: "mock", managedByCurrentProcess: false, reusedExisting: false };
  }

  getStatus(): AppServerStatus {
    return this.status;
  }

  onNotification(handler: (message: AppServerNotificationMessage) => void): () => void {
    this.notificationHandlers.add(handler);
    return () => this.notificationHandlers.delete(handler);
  }

  onServerRequest(handler: (message: AppServerServerRequestMessage) => void): () => void {
    this.serverRequestHandlers.add(handler);
    return () => this.serverRequestHandlers.delete(handler);
  }

  async respondToServerRequest(): Promise<void> {
    return undefined;
  }

  async notify(): Promise<void> {
    return undefined;
  }

  close(): void {
    this.status = { state: "idle" };
  }

  async request(method: string, params?: unknown): Promise<unknown> {
    if (method === "initialize") {
      return {
        userAgent: "codex-web-mock",
        codexHome: "C:\\Users\\huang\\.codex",
        platformFamily: "windows",
        platformOs: "windows"
      };
    }

    if (method === "thread/list") {
      const listParams = params as ThreadListParams | undefined;
      const sourceThreads = listParams?.archived ? [...this.archivedThreads.values()] : this.threads;
      return {
        data: sourceThreads.map((thread) => ({ ...thread, turns: [] })),
        nextCursor: null,
        backwardsCursor: null
      };
    }

    if (method === "thread/search") {
      const searchParams = params as ThreadSearchParams;
      const searchTerm = searchParams.searchTerm.trim().toLowerCase();
      const sourceThreads = searchParams.archived ? [...this.archivedThreads.values()] : this.threads;
      const results = sourceThreads
        .filter((thread) => this.threadMatchesSearch(thread, searchTerm))
        .slice(0, searchParams.limit || undefined)
        .map((thread) => ({
          thread: { ...thread, turns: [] },
          snippet: this.createSearchSnippet(thread, searchParams.searchTerm)
        }));

      return {
        data: results,
        nextCursor: null,
        backwardsCursor: null
      };
    }

    if (method === "getConversationSummary") {
      const summaryParams = params as { conversationId?: string; rolloutPath?: string };
      const thread =
        this.threads.find((item) => item.id === summaryParams.conversationId) ||
        [...this.archivedThreads.values()].find((item) => item.id === summaryParams.conversationId) ||
        this.thread;
      return {
        summary: {
          conversationId: thread.id,
          path: summaryParams.rolloutPath || thread.path || `C:\\Users\\huang\\.codex\\threads\\${thread.id}.jsonl`,
          preview: thread.preview || thread.name || "未命名会话",
          timestamp: new Date(thread.createdAt * 1000).toISOString(),
          updatedAt: new Date(thread.updatedAt * 1000).toISOString(),
          modelProvider: thread.modelProvider,
          cwd: thread.cwd,
          cliVersion: thread.cliVersion,
          source: thread.source,
          gitInfo: thread.gitInfo
        }
      };
    }

    if (method === "gitDiffToRemote") {
      return {
        sha: "mock-remote-sha",
        diff: "diff --git a/README.md b/README.md\n"
      };
    }

    if (method === "thread/loaded/list") {
      return {
        data: [this.thread.id],
        nextCursor: null
      };
    }

    if (method === "thread/read") {
      const readParams = params as { threadId?: string };
      const thread = this.selectThread(readParams.threadId);
      return {
        thread
      };
    }

    if (method === "thread/resume") {
      const resumeParams = params as ThreadResumeParams;
      const thread = this.selectThread(resumeParams.threadId);
      const runtimeConfig = resumeParams.config as Record<string, unknown> | null | undefined;
      return {
        thread: resumeParams.excludeTurns ? { ...thread, turns: [] } : thread,
        model: resumeParams.model || "gpt-5-codex",
        modelProvider: resumeParams.modelProvider || "openai",
        serviceTier: null,
        cwd: thread.cwd,
        runtimeWorkspaceRoots: ["C:\\Users\\huang\\workspace"],
        instructionSources: [],
        approvalPolicy: this.approvalPolicyForThread(thread.id),
        approvalsReviewer: this.approvalsReviewerForThread(thread.id),
        sandbox: { mode: "workspace-write" },
        activePermissionProfile: this.activePermissionProfileForThread(thread.id),
        reasoningEffort: typeof runtimeConfig?.model_reasoning_effort === "string"
          ? runtimeConfig.model_reasoning_effort
          : "medium",
        initialTurnsPage: resumeParams.initialTurnsPage
          ? {
              data: [...thread.turns].reverse().slice(0, resumeParams.initialTurnsPage.limit || undefined),
              nextCursor: null,
              backwardsCursor: null
            }
          : null
      };
    }

    if (method === "thread/turns/list") {
      const listParams = params as ThreadTurnsListParams;
      const turns = listParams.sortDirection === "desc" ? [...this.thread.turns].reverse() : this.thread.turns;
      return {
        data: turns.slice(0, listParams.limit || undefined),
        nextCursor: null,
        backwardsCursor: null
      };
    }

    if (method === "thread/items/list") {
      const listParams = params as { turnId?: string | null; limit?: number | null };
      const turns = listParams.turnId
        ? this.thread.turns.filter((threadTurn) => threadTurn.id === listParams.turnId)
        : this.thread.turns;
      return {
        data: turns.flatMap((turn) => turn.items).slice(0, listParams.limit || undefined),
        nextCursor: null,
        backwardsCursor: null
      };
    }

    if (method === "thread/start") {
      const startParams = params as ThreadStartParams;
      const runtimeConfig = startParams.config as Record<string, unknown> | null | undefined;
      this.thread = {
        ...this.createThread(),
        id: `mock-thread-${Date.now()}`,
        sessionId: `mock-session-${Date.now()}`,
        preview: "",
        cwd: startParams.cwd || "C:\\Users\\huang\\workspace",
        name: startParams.permissions ? `新会话 ${startParams.permissions}` : "新会话",
        turns: []
      };
      this.permissionProfilesByThread.set(this.thread.id, startParams.permissions ?? null);
      if ("approvalPolicy" in startParams) {
        this.approvalPoliciesByThread.set(this.thread.id, startParams.approvalPolicy ?? null);
      }
      if ("approvalsReviewer" in startParams) {
        this.approvalsReviewersByThread.set(this.thread.id, startParams.approvalsReviewer ?? null);
      }
      this.upsertThread(this.thread);

      return {
        thread: this.thread,
        model: startParams.model || "gpt-5-codex",
        modelProvider: startParams.modelProvider || "openai",
        serviceTier: null,
        cwd: this.thread.cwd,
        runtimeWorkspaceRoots: startParams.runtimeWorkspaceRoots || ["C:\\Users\\huang\\workspace"],
        instructionSources: [],
        approvalPolicy: this.approvalPolicyForThread(this.thread.id),
        approvalsReviewer: this.approvalsReviewerForThread(this.thread.id),
        sandbox: { mode: "workspace-write" },
        activePermissionProfile: this.activePermissionProfileForThread(this.thread.id),
        reasoningEffort: typeof runtimeConfig?.model_reasoning_effort === "string"
          ? runtimeConfig.model_reasoning_effort
          : null
      };
    }

    if (method === "thread/fork") {
      const forkParams = params as ThreadForkParams;
      const sourceThread = this.selectThread(forkParams.threadId);
      this.thread = {
        ...sourceThread,
        id: `mock-fork-${Date.now()}`,
        sessionId: `mock-session-${Date.now()}`,
        forkedFromId: forkParams.threadId,
        parentThreadId: forkParams.threadId,
        name: `${this.thread.name || "会话"} fork`,
        updatedAt: Math.floor(Date.now() / 1000)
      };
      this.permissionProfilesByThread.set(
        this.thread.id,
        this.permissionProfilesByThread.get(forkParams.threadId) ?? null
      );
      this.approvalPoliciesByThread.set(
        this.thread.id,
        this.approvalPoliciesByThread.get(forkParams.threadId) ?? null
      );
      this.approvalsReviewersByThread.set(
        this.thread.id,
        this.approvalsReviewersByThread.get(forkParams.threadId) ?? null
      );
      this.upsertThread(this.thread);

      return {
        thread: this.thread,
        model: forkParams.model || "gpt-5-codex",
        modelProvider: forkParams.modelProvider || "openai",
        serviceTier: null,
        cwd: this.thread.cwd,
        runtimeWorkspaceRoots: forkParams.runtimeWorkspaceRoots || ["C:\\Users\\huang\\workspace"],
        instructionSources: [],
        approvalPolicy: this.approvalPolicyForThread(this.thread.id),
        approvalsReviewer: this.approvalsReviewerForThread(this.thread.id),
        sandbox: { mode: "workspace-write" },
        activePermissionProfile: this.activePermissionProfileForThread(this.thread.id),
        reasoningEffort: null
      };
    }

    if (method === "thread/rollback") {
      const rollbackParams = params as ThreadRollbackParams;
      this.selectThread(rollbackParams.threadId);
      this.thread = {
        ...this.thread,
        turns: this.thread.turns.slice(0, Math.max(0, this.thread.turns.length - rollbackParams.numTurns)),
        updatedAt: Math.floor(Date.now() / 1000)
      };
      this.upsertThread(this.thread);

      return { thread: this.thread };
    }

    if (method === "thread/name/set") {
      const nameParams = params as ThreadSetNameParams;
      const thread = this.selectThread(nameParams.threadId);
      this.thread = {
        ...thread,
        name: nameParams.name,
        updatedAt: Math.floor(Date.now() / 1000)
      };
      this.upsertThread(this.thread);
      return {};
    }

    if (method === "thread/settings/update") {
      const settingsParams = params as ThreadSettingsUpdateParams;
      const thread = this.selectThread(settingsParams.threadId);
      if ("permissions" in settingsParams) {
        this.permissionProfilesByThread.set(thread.id, settingsParams.permissions ?? null);
      }
      if ("approvalPolicy" in settingsParams) {
        this.approvalPoliciesByThread.set(thread.id, settingsParams.approvalPolicy ?? null);
      }
      if ("approvalsReviewer" in settingsParams) {
        this.approvalsReviewersByThread.set(thread.id, settingsParams.approvalsReviewer ?? null);
      }
      return {};
    }

    if (method === "thread/metadata/update") {
      const metadataParams = params as MobileThreadMetadataUpdateInput;
      const thread = this.selectThread(metadataParams.threadId);
      const currentGitInfo = thread.gitInfo ?? { sha: null, branch: null, originUrl: null };
      this.thread = {
        ...thread,
        gitInfo:
          metadataParams.gitInfo === null
            ? null
            : metadataParams.gitInfo
              ? { ...currentGitInfo, ...metadataParams.gitInfo }
              : thread.gitInfo,
        updatedAt: Math.floor(Date.now() / 1000)
      };
      this.upsertThread(this.thread);
      return { thread: this.thread };
    }

    if (method === "thread/goal/get") {
      const goalParams = params as { threadId?: string };
      this.selectThread(goalParams.threadId);
      return { goal: this.goals.get(this.thread.id) || null };
    }

    if (method === "thread/goal/set") {
      const goalParams = params as ThreadGoalSetParams;
      this.selectThread(goalParams.threadId);
      const now = Math.floor(Date.now() / 1000);
      const previous = this.goals.get(goalParams.threadId);
      const goal: MobileThreadGoalView = {
        threadId: goalParams.threadId,
        objective: goalParams.objective ?? previous?.objective ?? "",
        status: goalParams.status ?? previous?.status ?? "active",
        tokenBudget: goalParams.tokenBudget ?? previous?.tokenBudget ?? null,
        tokensUsed: previous?.tokensUsed ?? 0,
        timeUsedSeconds: previous?.timeUsedSeconds ?? 0,
        createdAt: previous?.createdAt ?? now,
        updatedAt: now
      };
      this.goals.set(goalParams.threadId, goal);
      this.emitNotification({
        method: "thread/goal/updated",
        params: { threadId: goalParams.threadId, turnId: null, goal }
      });
      return { goal };
    }

    if (method === "thread/goal/clear") {
      const goalParams = params as { threadId?: string };
      this.selectThread(goalParams.threadId);
      this.goals.delete(this.thread.id);
      this.emitNotification({
        method: "thread/goal/cleared",
        params: { threadId: this.thread.id }
      });
      return { cleared: true };
    }

    if (method === "thread/compact/start") {
      const compactParams = params as ThreadCompactStartParams;
      this.selectThread(compactParams.threadId);
      this.emitNotification({
        method: "thread/compacted",
        params: {
          threadId: compactParams.threadId,
          turnId: this.thread.turns.at(-1)?.id || "mock-turn-1"
        }
      });
      return {};
    }

    if (method === "thread/backgroundTerminals/list") {
      this.selectThread((params as { threadId?: string }).threadId);
      return {
        data: this.backgroundTerminals,
        nextCursor: null
      };
    }

    if (method === "thread/backgroundTerminals/terminate") {
      this.selectThread((params as { threadId?: string }).threadId);
      const terminalParams = params as { processId?: string };
      const previousLength = this.backgroundTerminals.length;
      this.backgroundTerminals = this.backgroundTerminals.filter(
        (terminal) => terminal.processId !== terminalParams.processId
      );
      return { terminated: this.backgroundTerminals.length !== previousLength };
    }

    if (method === "thread/backgroundTerminals/clean") {
      this.selectThread((params as { threadId?: string }).threadId);
      this.backgroundTerminals = [];
      return {};
    }

    if (method === "review/start") {
      const reviewParams = params as ReviewStartParams;
      this.selectThread(reviewParams.threadId);
      const turnId = `mock-review-${++this.turnCounter}`;
      this.thread.turns.push({
        id: turnId,
        itemsView: "full",
        status: "completed",
        error: null,
        startedAt: Math.floor(Date.now() / 1000),
        completedAt: Math.floor(Date.now() / 1000),
        durationMs: 1,
        items: [
          {
            type: "enteredReviewMode",
            id: `mock-review-mode-${++this.itemCounter}`,
            review: "未提交改动"
          },
          {
            type: "agentMessage",
            id: `mock-review-agent-${++this.itemCounter}`,
            text: "已开始审查未提交改动",
            phase: "final_answer",
            memoryCitation: null
          }
        ]
      });
      this.thread = {
        ...this.thread,
        preview: this.thread.preview || "代码审查",
        updatedAt: Math.floor(Date.now() / 1000)
      };
      this.upsertThread(this.thread);
      return {
        turn: this.thread.turns.at(-1),
        reviewThreadId: this.thread.id
      };
    }

    if (method === "thread/memoryMode/set") {
      const memoryParams = params as ThreadMemoryModeSetParams;
      this.selectThread(memoryParams.threadId);
      return {};
    }

    if (method === "memory/reset") {
      return {};
    }

    if (method === "mock/experimentalMethod") {
      const experimentalParams = params as { value?: string | null };
      return { echoed: experimentalParams.value ?? null };
    }

    if (method === "account/login/start") {
      const loginParams = params as { type?: string };
      if (loginParams.type === "apiKey") {
        this.accountState = "apiKey";
        return { type: "apiKey" };
      }

      this.accountState = "chatgpt";
      return { type: "chatgpt", loginId: "mock-login-1", authUrl: "https://auth.openai.com/mock-codex" };
    }

    if (method === "account/login/cancel") {
      return { status: "canceled" };
    }

    if (method === "account/logout") {
      this.accountState = "none";
      return {};
    }

    if (method === "getAuthStatus") {
      if (this.accountState === "none") {
        return {
          authMethod: null,
          authToken: null,
          requiresOpenaiAuth: true
        };
      }

      return {
        authMethod: this.accountState === "apiKey" ? "apikey" : "chatgpt",
        authToken: null,
        requiresOpenaiAuth: false
      };
    }

    if (method === "thread/archive") {
      const actionParams = params as { threadId?: string };
      const archivedThread =
        this.thread.id === actionParams.threadId
          ? this.thread
          : this.threads.find((item) => item.id === actionParams.threadId);
      if (archivedThread) {
        this.archivedThreads.set(archivedThread.id, archivedThread);
      }
      this.threads = this.threads.filter((item) => item.id !== actionParams.threadId);
      this.thread = this.threads[0] || this.createThread();
      return {};
    }

    if (method === "thread/unarchive") {
      const actionParams = params as { threadId?: string };
      const archivedThread = actionParams.threadId ? this.archivedThreads.get(actionParams.threadId) : null;
      if (!archivedThread) {
        throw new Error("找不到已归档会话");
      }

      this.archivedThreads.delete(archivedThread.id);
      this.thread = { ...archivedThread, updatedAt: Math.floor(Date.now() / 1000) };
      this.upsertThread(this.thread);
      return { thread: this.thread };
    }

    if (method === "thread/unsubscribe") {
      const actionParams = params as { threadId?: string };
      this.selectThread(actionParams.threadId);
      return { status: "unsubscribed" };
    }

    if (method === "thread/shellCommand") {
      const shellParams = params as { threadId?: string; command?: string };
      this.selectThread(shellParams.threadId);
      return {};
    }

    if (method === "thread/inject_items") {
      const injectParams = params as { threadId?: string; items?: unknown[] };
      this.selectThread(injectParams.threadId);
      const itemId = `mock-inject-${++this.itemCounter}`;
      const now = Math.floor(Date.now() / 1000);
      this.thread.turns.push({
        id: `mock-turn-${++this.turnCounter}`,
        itemsView: "full",
        status: "completed",
        error: null,
        startedAt: now,
        completedAt: now,
        durationMs: 1,
        items: [
          {
            type: "commandExecution",
            id: itemId,
            command: `已注入 ${injectParams.items?.length ?? 0} 条上下文 item`,
            cwd: this.thread.cwd,
            processId: null,
            source: "agent",
            status: "completed",
            commandActions: [],
            aggregatedOutput: null,
            exitCode: 0,
            durationMs: 1
          }
        ]
      });
      this.thread = { ...this.thread, updatedAt: now };
      this.upsertThread(this.thread);
      return {};
    }

    if (method === "thread/approveGuardianDeniedAction") {
      const guardianParams = params as { threadId?: string };
      this.selectThread(guardianParams.threadId);
      return {};
    }

    if (method === "thread/increment_elicitation") {
      const elicitationParams = params as { threadId?: string };
      this.selectThread(elicitationParams.threadId);
      const count = (this.mockElicitationCounts.get(this.thread.id) ?? 0) + 1;
      this.mockElicitationCounts.set(this.thread.id, count);
      return { count: BigInt(count), paused: count > 0 };
    }

    if (method === "thread/decrement_elicitation") {
      const elicitationParams = params as { threadId?: string };
      this.selectThread(elicitationParams.threadId);
      const count = Math.max(0, (this.mockElicitationCounts.get(this.thread.id) ?? 0) - 1);
      this.mockElicitationCounts.set(this.thread.id, count);
      return { count: BigInt(count), paused: count > 0 };
    }

    if (method === "thread/delete") {
      const actionParams = params as { threadId?: string };
      this.archivedThreads.delete(actionParams.threadId || "");
      this.threads = this.threads.filter((item) => item.id !== actionParams.threadId);
      this.thread = this.threads[0] || this.createThread();
      return {};
    }

    if (method === "turn/start") {
      const startParams = params as TurnStartParams;
      this.selectThread(startParams.threadId);
      if ("permissions" in startParams) {
        this.permissionProfilesByThread.set(this.thread.id, startParams.permissions ?? null);
      }
      if ("approvalPolicy" in startParams) {
        this.approvalPoliciesByThread.set(this.thread.id, startParams.approvalPolicy ?? null);
      }
      if ("approvalsReviewer" in startParams) {
        this.approvalsReviewersByThread.set(this.thread.id, startParams.approvalsReviewer ?? null);
      }
      const textInput = startParams.input.find((item) => item.type === "text") as TextUserInput | undefined;
      const text = textInput?.text.trim() || "";
      const settingSuffix = startParams.model || startParams.effort || startParams.permissions
        ? `（模型 ${startParams.model || "默认"}，思考 ${startParams.effort || "默认"}，权限 ${startParams.permissions || "默认"}）`
        : "";
      createTextUserInput(text);
      const turnId = `mock-turn-${++this.turnCounter}`;
      const userItemId = `mock-user-${++this.itemCounter}`;
      const agentItemId = `mock-agent-${++this.itemCounter}`;
      const liveItemId = `mock-live-${this.itemCounter}`;
      this.thread.turns.push({
        id: turnId,
        itemsView: "full",
        status: "completed",
        error: null,
        startedAt: Math.floor(Date.now() / 1000),
        completedAt: Math.floor(Date.now() / 1000),
        durationMs: 1,
        items: [
          {
            type: "userMessage",
            id: userItemId,
            clientId: userItemId,
            content: startParams.input
          },
          {
            type: "agentMessage",
            id: agentItemId,
            text: `已收到：${text}${settingSuffix}`,
            phase: "final_answer",
            memoryCitation: null
          }
        ]
      });
      this.thread = {
        ...this.thread,
        preview: this.thread.preview || text,
        updatedAt: Math.floor(Date.now() / 1000)
      };
      this.upsertThread(this.thread);
      setTimeout(() => {
        const baseParams = {
          threadId: startParams.threadId,
          turnId
        };
        if (this.approvalPolicyForThread(startParams.threadId) !== "never") {
          this.emitServerRequest(this.createMockServerRequest(text, baseParams, `mock-approval-${this.itemCounter}`));
        }
        this.emitNotification({
          method: "item/reasoning/textDelta",
          params: { ...baseParams, itemId: `mock-reasoning-${this.itemCounter}`, delta: `思考：${text}` }
        });
        this.emitNotification({
          method: "item/plan/delta",
          params: { ...baseParams, itemId: `mock-plan-${this.itemCounter}`, delta: "计划：整理请求并生成回复" }
        });
        this.emitNotification({
          method: "item/commandExecution/outputDelta",
          params: { ...baseParams, itemId: `mock-command-${this.itemCounter}`, delta: "命令输出：mock 完成" }
        });
        this.emitNotification({
          method: "turn/diff/updated",
          params: { ...baseParams, diff: "diff --git a/mock.txt b/mock.txt" }
        });
        this.emitNotification({
          method: "item/fileChange/outputDelta",
          params: { ...baseParams, itemId: `mock-file-${this.itemCounter}`, delta: "文件输出：mock.txt 已更新" }
        });
        this.emitNotification({
          method: "thread/tokenUsage/updated",
          params: {
            ...baseParams,
            tokenUsage: {
              total: {
                totalTokens: 128,
                inputTokens: 48,
                cachedInputTokens: 0,
                outputTokens: 64,
                reasoningOutputTokens: 16
              },
              last: {
                totalTokens: 128,
                inputTokens: 48,
                cachedInputTokens: 0,
                outputTokens: 64,
                reasoningOutputTokens: 16
              },
              modelContextWindow: 200000
            }
          }
        });
        this.emitNotification({
          method: "item/agentMessage/delta",
          params: { ...baseParams, itemId: liveItemId, delta: `实时事件：${text}` }
        });
        if (text.toLowerCase().includes("warning")) {
          this.emitNotification({
            method: "warning",
            params: { threadId: startParams.threadId, message: "线程级 warning 测试" }
          });
          this.emitNotification({
            method: "configWarning",
            params: { summary: "配置 warning 测试", details: "请检查 Codex 配置" }
          });
        }
        if (text.toLowerCase().includes("settings refresh")) {
          this.rateLimitUsedPercent = 64;
          this.emitNotification({
            method: "account/rateLimits/updated",
            params: {}
          });
        }
      }, 25);

      return {
        turn: this.thread.turns.at(-1)
      };
    }

    if (method === "turn/interrupt") {
      const interruptParams = params as { threadId?: string };
      this.selectThread(interruptParams.threadId);
      this.thread = {
        ...this.thread,
        status: { type: "idle" }
      };
      this.upsertThread(this.thread);
      return {};
    }

    if (method === "turn/steer") {
      const steerParams = params as TurnSteerParams;
      this.selectThread(steerParams.threadId);
      const textInput = steerParams.input.find((item) => item.type === "text") as TextUserInput | undefined;
      const text = textInput?.text.trim() || "";
      createTextUserInput(text);
      const turnId = `mock-steer-${++this.turnCounter}`;
      this.thread.turns.push({
        id: turnId,
        itemsView: "full",
        status: "completed",
        error: null,
        startedAt: Math.floor(Date.now() / 1000),
        completedAt: Math.floor(Date.now() / 1000),
        durationMs: 1,
        items: [
          {
            type: "userMessage",
            id: `mock-steer-user-${++this.itemCounter}`,
            clientId: `mock-steer-user-${this.itemCounter}`,
            content: steerParams.input
          },
          {
            type: "agentMessage",
            id: `mock-steer-agent-${++this.itemCounter}`,
            text: `已追加：${text}`,
            phase: "final_answer",
            memoryCitation: null
          }
        ]
      });
      this.upsertThread(this.thread);
      return { turnId };
    }

    if (method === "model/list") {
      return {
        data: [
          {
            id: "gpt-5-codex",
            model: "gpt-5-codex",
            upgrade: null,
            upgradeInfo: null,
            availabilityNux: null,
            displayName: "GPT-5 Codex",
            description: "Codex 默认模型",
            hidden: false,
            supportedReasoningEfforts: ["low", "medium", "high"],
            defaultReasoningEffort: "medium",
            inputModalities: ["text", "image"],
            supportsPersonality: true,
            additionalSpeedTiers: [],
            serviceTiers: [],
            defaultServiceTier: null,
            isDefault: true
          },
          {
            id: "gpt-5-mini",
            model: "gpt-5-mini",
            upgrade: null,
            upgradeInfo: null,
            availabilityNux: null,
            displayName: "GPT-5 Mini",
            description: "更快的轻量模型",
            hidden: false,
            supportedReasoningEfforts: ["low", "medium", "high"],
            defaultReasoningEffort: "medium",
            inputModalities: ["text", "image"],
            supportsPersonality: true,
            additionalSpeedTiers: [],
            serviceTiers: [],
            defaultServiceTier: null,
            isDefault: false
          }
        ],
        nextCursor: null
      };
    }

    if (method === "permissionProfile/list") {
      return {
        data: [
          { id: "default", description: "默认权限配置" },
          { id: "read-only", description: "只读工作区" },
          { id: "full-auto", description: "允许自动执行" }
        ],
        nextCursor: null
      };
    }

    if (method === "fs/readDirectory") {
      const readParams = params as FsReadDirectoryParams;
      return {
        entries: this.listMockDirectory(readParams.path)
      };
    }

    if (method === "fs/readFile") {
      const readParams = params as FsReadFileParams;
      const fileText = this.readMockFile(readParams.path);

      return {
        dataBase64: Buffer.from(fileText, "utf8").toString("base64")
      };
    }

    if (method === "fs/writeFile") {
      const writeParams = params as FsWriteFileParams;
      this.writeMockFile(writeParams.path, Buffer.from(writeParams.dataBase64, "base64").toString("utf8"));
      this.emitMockFsChanged([writeParams.path]);
      return {};
    }

    if (method === "fs/createDirectory") {
      const createParams = params as FsCreateDirectoryParams;
      this.createMockDirectory(createParams.path);
      this.emitMockFsChanged([createParams.path]);
      return {};
    }

    if (method === "fs/remove") {
      const removeParams = params as FsRemoveParams;
      this.removeMockPath(removeParams.path);
      this.emitMockFsChanged([removeParams.path]);
      return {};
    }

    if (method === "fs/copy") {
      const copyParams = params as FsCopyParams;
      this.copyMockPath(copyParams.sourcePath, copyParams.destinationPath);
      this.emitMockFsChanged([copyParams.destinationPath]);
      return {};
    }

    if (method === "fs/getMetadata") {
      const metadataParams = params as FsGetMetadataParams;
      const node = this.getMockNode(metadataParams.path);
      return {
        isDirectory: node.type === "directory",
        isFile: node.type === "file",
        isSymlink: false,
        createdAtMs: node.createdAtMs,
        modifiedAtMs: node.modifiedAtMs
      };
    }

    if (method === "fs/watch") {
      const watchParams = params as FsWatchParams;
      const normalizedPath = this.normalizeMockPath(watchParams.path);
      this.mockFsWatches.set(watchParams.watchId, normalizedPath);
      return { path: normalizedPath };
    }

    if (method === "fs/unwatch") {
      const unwatchParams = params as FsUnwatchParams;
      this.mockFsWatches.delete(unwatchParams.watchId);
      return {};
    }

    if (method === "fuzzyFileSearch") {
      const searchParams = params as { query?: string; roots?: string[] };
      const query = (searchParams.query ?? "").toLowerCase();
      const roots = searchParams.roots?.length ? searchParams.roots : [this.workspaceRoot];
      const files = [...this.mockFs.entries()]
        .filter(([, node]) => node.type === "file")
        .filter(([candidatePath]) => roots.some((root) => candidatePath.startsWith(this.normalizeMockPath(root))))
        .map(([candidatePath]) => {
          const root = roots.find((candidateRoot) => candidatePath.startsWith(this.normalizeMockPath(candidateRoot))) ?? this.workspaceRoot;
          const normalizedRoot = this.normalizeMockPath(root);
          const relativePath = candidatePath.slice(normalizedRoot.length).replace(/^\\+/, "");
          const fileName = relativePath.split("\\").at(-1) ?? relativePath;
          return { root: normalizedRoot, relativePath, fileName };
        })
        .filter((candidate) => {
          const haystack = `${candidate.relativePath}\n${candidate.fileName}`.toLowerCase();
          return !query || haystack.includes(query);
        })
        .map((candidate) => ({
          root: candidate.root,
          path: candidate.relativePath,
          match_type: "file" as const,
          file_name: candidate.fileName,
          score: candidate.fileName.toLowerCase().includes(query) ? 100 : 50,
          indices: query ? [...query].map((_, index) => index) : null
        }));
      return { files };
    }

    if (method === "fuzzyFileSearch/sessionStart") {
      const searchParams = params as { sessionId?: string };
      if (searchParams.sessionId) {
        this.mockFileSearchSessions.add(searchParams.sessionId);
      }
      return {};
    }

    if (method === "fuzzyFileSearch/sessionUpdate") {
      const searchParams = params as { sessionId?: string; query?: string };
      if (searchParams.sessionId && this.mockFileSearchSessions.has(searchParams.sessionId)) {
        const query = (searchParams.query ?? "").toLowerCase();
        const files = [...this.mockFs.entries()]
          .filter(([, node]) => node.type === "file")
          .filter(([candidatePath]) => candidatePath.startsWith(this.workspaceRoot))
          .map(([candidatePath]) => {
            const relativePath = candidatePath.slice(this.workspaceRoot.length).replace(/^\\+/, "");
            const fileName = relativePath.split("\\").at(-1) ?? relativePath;
            return { relativePath, fileName };
          })
          .filter((candidate) => {
            const haystack = `${candidate.relativePath}\n${candidate.fileName}`.toLowerCase();
            return !query || haystack.includes(query);
          })
          .map((candidate) => ({
            root: this.workspaceRoot,
            path: candidate.relativePath,
            match_type: "file" as const,
            file_name: candidate.fileName,
            score: candidate.fileName.toLowerCase().includes(query) ? 100 : 50,
            indices: query ? [...query].map((_, index) => index) : null
          }));
        this.emitNotification({
          method: "fuzzyFileSearch/sessionUpdated",
          params: { sessionId: searchParams.sessionId, query: searchParams.query || "", files }
        });
      }
      return {};
    }

    if (method === "fuzzyFileSearch/sessionStop") {
      const searchParams = params as { sessionId?: string };
      if (searchParams.sessionId) {
        this.mockFileSearchSessions.delete(searchParams.sessionId);
        this.emitNotification({
          method: "fuzzyFileSearch/sessionCompleted",
          params: { sessionId: searchParams.sessionId }
        });
      }
      return {};
    }

    if (method === "command/exec") {
      const execParams = params as CommandExecParams;
      if (execParams.processId && execParams.streamStdoutStderr) {
        const processId = execParams.processId;
        setTimeout(() => {
          if (this.mockCommandExecs.has(processId)) {
            this.emitCommandExecOutput(
              processId,
              `mock command exec: ${execParams.command.join(" ")}\ncwd: ${execParams.cwd || this.thread.cwd}\n`
            );
          }
        }, 5);
        return new Promise<MobileCommandResult>((resolve) => {
          this.mockCommandExecs.set(processId, { resolve });
        });
      }

      return {
        exitCode: 0,
        stdout: `mock command: ${execParams.command.join(" ")}\ncwd: ${execParams.cwd || this.thread.cwd}`,
        stderr: ""
      };
    }

    if (method === "command/exec/write") {
      const writeParams = params as CommandExecWriteParams;
      if (writeParams.deltaBase64) {
        const text = Buffer.from(writeParams.deltaBase64, "base64").toString("utf8").trimEnd();
        this.emitCommandExecOutput(writeParams.processId, `stdin: ${text}\n`);
      }
      return {};
    }

    if (method === "command/exec/resize") {
      const resizeParams = params as CommandExecResizeParams;
      this.emitCommandExecOutput(resizeParams.processId, `尺寸 ${resizeParams.size.cols}x${resizeParams.size.rows}\n`);
      return {};
    }

    if (method === "command/exec/terminate") {
      const terminateParams = params as CommandExecTerminateParams;
      const commandExec = this.mockCommandExecs.get(terminateParams.processId);
      this.mockCommandExecs.delete(terminateParams.processId);
      commandExec?.resolve({ exitCode: 143, stdout: "", stderr: "" });
      return {};
    }

    if (method === "process/spawn") {
      const spawnParams = params as ProcessSpawnParams;
      this.mockProcesses.add(spawnParams.processHandle);
      setTimeout(() => {
        if (!this.mockProcesses.has(spawnParams.processHandle)) {
          return;
        }
        this.emitProcessOutput(
          spawnParams.processHandle,
          `mock process: ${spawnParams.command.join(" ")}\ncwd: ${spawnParams.cwd}\n`
        );
      }, 5);
      return {};
    }

    if (method === "process/writeStdin") {
      const stdinParams = params as ProcessWriteStdinParams;
      if (stdinParams.deltaBase64) {
        const text = Buffer.from(stdinParams.deltaBase64, "base64").toString("utf8").trimEnd();
        this.emitProcessOutput(stdinParams.processHandle, `stdin: ${text}\n`);
      }
      return {};
    }

    if (method === "process/resizePty") {
      const resizeParams = params as ProcessResizePtyParams;
      this.emitProcessOutput(resizeParams.processHandle, `PTY ${resizeParams.size.cols}x${resizeParams.size.rows}\n`);
      return {};
    }

    if (method === "process/kill") {
      const killParams = params as ProcessKillParams;
      this.mockProcesses.delete(killParams.processHandle);
      this.emitNotification({
        method: "process/exited",
        params: {
          processHandle: killParams.processHandle,
          exitCode: 143,
          stdout: "",
          stdoutCapReached: false,
          stderr: "",
          stderrCapReached: false
        }
      });
      return {};
    }

    if (method === "config/read") {
      return {
        config: this.mockConfig,
        origins: {},
        layers: null
      };
    }

    if (method === "config/value/write") {
      const writeParams = params as ConfigValueWriteParams;
      this.writeMockConfigValue(writeParams.keyPath, writeParams.value);
      return this.mockConfigWriteResponse();
    }

    if (method === "config/batchWrite") {
      const writeParams = params as ConfigBatchWriteParams;
      for (const edit of writeParams.edits) {
        this.writeMockConfigValue(edit.keyPath, edit.value);
      }
      return this.mockConfigWriteResponse();
    }

    if (method === "remoteControl/status/read") {
      return {
        status: this.remoteControlEnabled ? "connected" : "disabled",
        serverName: "mock",
        installationId: "mock-installation",
        environmentId: this.remoteControlEnvironmentId
      };
    }

    if (method === "remoteControl/client/list") {
      return {
        data: this.remoteControlClients,
        nextCursor: null
      };
    }

    if (method === "remoteControl/enable") {
      this.remoteControlEnabled = true;
      this.remoteControlEnvironmentId = "mock-env";
      return {
        status: "connected",
        serverName: "mock",
        installationId: "mock-installation",
        environmentId: this.remoteControlEnvironmentId
      };
    }

    if (method === "remoteControl/disable") {
      this.remoteControlEnabled = false;
      this.remoteControlEnvironmentId = null;
      return {
        status: "disabled",
        serverName: "mock",
        installationId: "mock-installation",
        environmentId: null
      };
    }

    if (method === "remoteControl/pairing/start") {
      this.remoteControlEnabled = true;
      this.remoteControlEnvironmentId = "mock-env";
      this.remotePairingClaimed = false;
      return {
        pairingCode: "pair-code-1",
        manualPairingCode: "123-456",
        environmentId: "mock-env",
        expiresAt: 1_800_000_500
      };
    }

    if (method === "remoteControl/pairing/status") {
      this.remotePairingClaimed = true;
      return { claimed: this.remotePairingClaimed };
    }

    if (method === "remoteControl/client/revoke") {
      const revokeParams = params as { clientId?: string };
      this.remoteControlClients = this.remoteControlClients.filter((client) => client.clientId !== revokeParams.clientId);
      return {};
    }

    if (method === "account/read") {
      if (this.accountState === "none") {
        return {
          account: null,
          requiresOpenaiAuth: true
        };
      }
      if (this.accountState === "apiKey") {
        return {
          account: { type: "apiKey", email: null, planType: null },
          requiresOpenaiAuth: false
        };
      }

      return {
        account: { type: "chatgpt", email: "dev@example.com", planType: "pro" },
        requiresOpenaiAuth: false
      };
    }

    if (method === "account/rateLimits/read") {
      return {
        rateLimits: {
          limitId: "codex",
          limitName: "Codex",
          primary: { usedPercent: this.rateLimitUsedPercent, windowDurationMins: 300, resetsAt: 1_800_000_000 },
          secondary: null,
          credits: null,
          individualLimit: null,
          planType: "pro",
          rateLimitReachedType: null
        },
        rateLimitsByLimitId: null,
        rateLimitResetCredits: { availableCount: BigInt(this.rateLimitResetCreditsAvailable) }
      };
    }

    if (method === "account/usage/read") {
      return {
        summary: {
          lifetimeTokens: 123456n,
          peakDailyTokens: 45678n,
          longestRunningTurnSec: 321n,
          currentStreakDays: 7n,
          longestStreakDays: 21n
        },
        dailyUsageBuckets: [{ startDate: "2026-06-23", tokens: 1200n }]
      };
    }

    if (method === "account/rateLimitResetCredit/consume") {
      const resetParams = params as { idempotencyKey?: string };
      if (resetParams.idempotencyKey && this.consumedRateLimitResetCredits.has(resetParams.idempotencyKey)) {
        return { outcome: "alreadyRedeemed" };
      }
      if (resetParams.idempotencyKey) {
        this.consumedRateLimitResetCredits.add(resetParams.idempotencyKey);
      }
      if (this.rateLimitResetCreditsAvailable <= 0) {
        return { outcome: "noCredit" };
      }
      this.rateLimitResetCreditsAvailable -= 1;
      this.rateLimitUsedPercent = 0;
      return { outcome: "reset" };
    }

    if (method === "account/sendAddCreditsNudgeEmail") {
      return { status: "sent" };
    }

    if (method === "mcpServerStatus/list") {
      return {
        data: [
          {
            name: "filesystem",
            serverInfo: null,
            tools: { read_file: {}, write_file: {} },
            resources: [{ uri: "file:///README.md", name: "README", mimeType: "text/markdown" }],
            resourceTemplates: [],
            authStatus: "bearerToken"
          },
          {
            name: "github",
            serverInfo: null,
            tools: { search: {} },
            resources: [],
            resourceTemplates: [],
            authStatus: "notLoggedIn"
          }
        ],
        nextCursor: null
      };
    }

    if (method === "config/mcpServer/reload") {
      return {};
    }

    if (method === "mcpServer/oauth/login") {
      return {
        authorizationUrl: "https://example.com/mcp/github/oauth"
      };
    }

    if (method === "mcpServer/resource/read") {
      return {
        contents: [
          {
            uri: "file:///README.md",
            mimeType: "text/markdown",
            text: "# README\n\n来自 MCP 资源。"
          }
        ]
      };
    }

    if (method === "modelProvider/capabilities/read") {
      return {
        namespaceTools: true,
        imageGeneration: true,
        webSearch: false
      };
    }

    if (method === "collaborationMode/list") {
      return {
        data: [
          { name: "Code", mode: "default", model: "gpt-5-codex", reasoning_effort: "medium" },
          { name: "Ask", mode: "ask", model: null, reasoning_effort: null }
        ]
      };
    }

    if (method === "skills/list") {
      return {
        data: [
          {
            cwd: this.thread.cwd,
            skills: [
              {
                name: "openai-docs",
                description: "查询 OpenAI 官方文档",
                shortDescription: "OpenAI 文档",
                interface: null,
                dependencies: null,
                path: "C:\\Users\\huang\\.codex\\skills\\openai-docs\\SKILL.md",
                scope: "user",
                enabled: true
              },
              {
                name: "repo-helper",
                description: "项目内辅助技能",
                shortDescription: null,
                interface: null,
                dependencies: null,
                path: `${this.thread.cwd}\\.codex\\skills\\repo-helper\\SKILL.md`,
                scope: "repo",
                enabled: false
              }
            ],
            errors: []
          }
        ]
      };
    }

    if (method === "hooks/list") {
      return {
        data: [
          {
            cwd: this.thread.cwd,
            hooks: [
              {
                key: "post-tool-use-format",
                eventName: "postToolUse",
                handlerType: "command",
                matcher: "Edit",
                command: "npm run format",
                timeoutSec: 60n,
                statusMessage: "格式化文件",
                sourcePath: `${this.thread.cwd}\\.codex\\hooks.json`,
                source: "project",
                pluginId: null,
                displayOrder: 1n,
                enabled: true,
                isManaged: false,
                currentHash: "mock-hook-hash",
                trustStatus: "trusted"
              }
            ],
            warnings: ["hook 即将迁移"],
            errors: []
          }
        ]
      };
    }

    if (method === "plugin/list") {
      return {
        marketplaces: [
          {
            name: "个人插件市场",
            path: "C:\\Users\\huang\\.codex\\plugins\\marketplace.json",
            interface: { displayName: "个人插件" },
            plugins: [
              {
                id: "browser-tools",
                remotePluginId: null,
                localVersion: "1.0.0",
                name: "browser-tools",
                shareContext: null,
                source: { type: "local", path: "C:\\Users\\huang\\.codex\\plugins\\browser-tools" },
                installed: true,
                enabled: true,
                installPolicy: "install",
                authPolicy: "none",
                availability: "AVAILABLE",
                interface: {
                  displayName: "浏览器工具",
                  shortDescription: "控制浏览器",
                  longDescription: null,
                  developerName: null,
                  category: null,
                  capabilities: [],
                  websiteUrl: null,
                  privacyPolicyUrl: null,
                  termsOfServiceUrl: null,
                  defaultPrompt: null,
                  brandColor: null,
                  composerIcon: null,
                  composerIconUrl: null,
                  logo: null,
                  logoUrl: null,
                  screenshots: [],
                  screenshotUrls: []
                },
                keywords: ["browser"]
              },
              {
                id: "review-pack",
                remotePluginId: "remote-review-pack",
                localVersion: null,
                name: "review-pack",
                shareContext: null,
                source: { type: "remote" },
                installed: false,
                enabled: false,
                installPolicy: "ask",
                authPolicy: "none",
                availability: "DISABLED_BY_ADMIN",
                interface: null,
                keywords: []
              }
            ]
          }
        ],
        marketplaceLoadErrors: [],
        featuredPluginIds: ["browser-tools"]
      };
    }

    if (method === "plugin/read") {
      return {
        plugin: this.createMockPluginDetail()
      };
    }

    if (method === "plugin/install") {
      return {
        authPolicy: "ON_USE",
        appsNeedingAuth: [
          { id: "browser-app", name: "Browser", description: "浏览器应用", installUrl: null, category: "tool" }
        ]
      };
    }

    if (method === "plugin/uninstall") {
      return {};
    }

    if (method === "app/list") {
      return {
        data: [
          {
            id: "browser-app",
            name: "Browser",
            description: "浏览器应用",
            logoUrl: null,
            logoUrlDark: null,
            distributionChannel: "plugin",
            branding: {
              category: "tool",
              developer: "OpenAI",
              website: null,
              privacyPolicy: null,
              termsOfService: null,
              isDiscoverableApp: true
            },
            appMetadata: null,
            labels: null,
            installUrl: null,
            isAccessible: true,
            isEnabled: true,
            pluginDisplayNames: ["浏览器工具"]
          }
        ],
        nextCursor: null
      };
    }

    if (method === "configRequirements/read") {
      return {
        requirements: {
          allowedApprovalPolicies: ["untrusted"],
          allowedApprovalsReviewers: null,
          allowedSandboxModes: ["workspace-write"],
          allowedWindowsSandboxImplementations: ["unelevated"],
          allowedPermissionProfiles: { default: true, "full-auto": true },
          defaultPermissions: "default",
          allowedWebSearchModes: null,
          allowManagedHooksOnly: false,
          allowAppshots: true,
          allowRemoteControl: true,
          computerUse: null,
          featureRequirements: { skills: true, plugins: true },
          hooks: null,
          enforceResidency: null,
          network: null
        }
      };
    }

    if (method === "experimentalFeature/list") {
      return {
        data: this.experimentalFeatures,
        nextCursor: null
      };
    }

    if (method === "experimentalFeature/enablement/set") {
      const enablement = (params as { enablement?: Record<string, boolean | undefined> }).enablement ?? {};
      this.experimentalFeatures = this.experimentalFeatures.map((feature) =>
        Object.prototype.hasOwnProperty.call(enablement, feature.name)
          ? { ...feature, enabled: Boolean(enablement[feature.name]) }
          : feature
      );
      return {};
    }

    if (method === "windowsSandbox/readiness") {
      return { status: this.windowsSandboxStatus };
    }

    if (method === "windowsSandbox/setupStart") {
      this.windowsSandboxStatus = "ready";
      return { started: true };
    }

    if (method === "plugin/skill/read") {
      return { contents: "# browser:control\n\n控制浏览器。" };
    }

    if (method === "skills/extraRoots/set") {
      return {};
    }

    if (method === "skills/config/write") {
      const configParams = params as { enabled?: boolean };
      return { effectiveEnabled: Boolean(configParams.enabled) };
    }

    if (method === "environment/add") {
      return {};
    }

    if (method === "externalAgentConfig/detect") {
      return {
        items: [
          {
            itemType: "AGENTS_MD",
            description: "导入项目 AGENTS.md",
            cwd: "C:\\Users\\huang\\workspace",
            details: null
          }
        ]
      };
    }

    if (method === "externalAgentConfig/import") {
      return { importId: "mock-import-1" };
    }

    if (method === "feedback/upload") {
      const feedbackParams = params as { threadId?: string | null };
      return { threadId: feedbackParams.threadId ?? this.thread.id };
    }

    if (method === "marketplace/add") {
      return {
        marketplaceName: "mock-marketplace",
        installedRoot: "C:\\Users\\huang\\.codex\\plugins\\mock-marketplace",
        alreadyAdded: false
      };
    }

    if (method === "marketplace/remove") {
      const marketplaceParams = params as { marketplaceName?: string };
      return {
        marketplaceName: marketplaceParams.marketplaceName ?? "mock-marketplace",
        installedRoot: "C:\\Users\\huang\\.codex\\plugins\\mock-marketplace"
      };
    }

    if (method === "marketplace/upgrade") {
      return {
        selectedMarketplaces: ["mock-marketplace"],
        upgradedRoots: ["C:\\Users\\huang\\.codex\\plugins\\mock-marketplace"],
        errors: []
      };
    }

    if (method === "plugin/installed") {
      return {
        marketplaces: [
          {
            name: "个人插件市场",
            path: "C:\\Users\\huang\\.codex\\plugins\\marketplace.json",
            interface: null,
            plugins: [this.createMockPluginDetail().summary]
          }
        ],
        marketplaceLoadErrors: []
      };
    }

    if (method === "plugin/share/save") {
      return {
        remotePluginId: "mock-remote-plugin",
        shareUrl: "https://example.com/plugins/mock-remote-plugin"
      };
    }

    if (method === "plugin/share/updateTargets") {
      const shareParams = params as { discoverability?: string };
      return {
        principals: [
          {
            principalType: "USER",
            principalId: "user-1",
            role: "OWNER",
            name: "测试用户"
          }
        ],
        discoverability: shareParams.discoverability ?? "PRIVATE"
      };
    }

    if (method === "plugin/share/list") {
      return {
        data: [
          {
            plugin: this.createMockPluginDetail().summary,
            localPluginPath: "C:\\Users\\huang\\.codex\\plugins\\browser-tools"
          }
        ]
      };
    }

    if (method === "plugin/share/checkout") {
      return {
        remotePluginId: "mock-remote-plugin",
        pluginId: "browser-tools",
        pluginName: "browser-tools",
        pluginPath: "C:\\Users\\huang\\.codex\\plugins\\browser-tools",
        marketplaceName: "个人插件市场",
        marketplacePath: "C:\\Users\\huang\\.codex\\plugins\\marketplace.json",
        remoteVersion: "v1"
      };
    }

    if (method === "plugin/share/delete") {
      return {};
    }

    if (method === "mcpServer/tool/call") {
      const toolParams = params as { server?: string; tool?: string; arguments?: unknown };
      return {
        content: [{ type: "text", text: `mock tool ${toolParams.server}/${toolParams.tool}` }],
        structuredContent: { arguments: toolParams.arguments ?? null },
        isError: false,
        _meta: { durationMs: 1 }
      };
    }

    if (
      method === "thread/realtime/start" ||
      method === "thread/realtime/appendAudio" ||
      method === "thread/realtime/appendText" ||
      method === "thread/realtime/appendSpeech" ||
      method === "thread/realtime/stop"
    ) {
      return {};
    }

    if (method === "thread/realtime/listVoices") {
      return {
        voices: {
          v1: ["alloy", "echo"],
          v2: ["cedar", "marin"],
          defaultV1: "alloy",
          defaultV2: "cedar"
        }
      };
    }

    throw new Error(`mock app-server 未实现方法: ${method}`);
  }

  private createMockPluginDetail() {
    return {
      marketplaceName: "个人插件市场",
      marketplacePath: "C:\\Users\\huang\\.codex\\plugins\\marketplace.json",
      summary: {
        id: "browser-tools",
        remotePluginId: "remote-browser-tools",
        localVersion: "1.0.0",
        name: "browser-tools",
        shareContext: null,
        source: { type: "local", path: "C:\\Users\\huang\\.codex\\plugins\\browser-tools" },
        installed: true,
        enabled: true,
        installPolicy: "AVAILABLE",
        authPolicy: "ON_USE",
        availability: "AVAILABLE",
        interface: {
          displayName: "浏览器工具",
          shortDescription: "控制浏览器",
          longDescription: "用于移动端验证网页和截图。",
          developerName: "Codex",
          category: "tools",
          capabilities: ["browser"],
          websiteUrl: null,
          privacyPolicyUrl: null,
          termsOfServiceUrl: null,
          defaultPrompt: null,
          brandColor: null,
          composerIcon: null,
          composerIconUrl: null,
          logo: null,
          logoUrl: null,
          screenshots: [],
          screenshotUrls: []
        },
        keywords: ["browser"]
      },
      shareUrl: null,
      description: "用于移动端验证网页和截图。",
      skills: [{ name: "browser:control", description: "控制浏览器", shortDescription: "浏览器控制", enabled: true }],
      hooks: [{ name: "after-edit", description: "编辑后检查" }],
      apps: [{ id: "browser-app", name: "Browser", description: "浏览器应用", installUrl: null, category: "tool" }],
      appTemplates: [],
      mcpServers: ["browser"]
    };
  }

  private emitNotification(message: AppServerNotificationMessage): void {
    for (const handler of this.notificationHandlers) {
      handler(message);
    }
  }

  private emitProcessOutput(processHandle: string, text: string): void {
    this.emitNotification({
      method: "process/outputDelta",
      params: {
        processHandle,
        stream: "stdout",
        deltaBase64: Buffer.from(text, "utf8").toString("base64"),
        capReached: false
      }
    });
  }

  private emitCommandExecOutput(processId: string, text: string): void {
    this.emitNotification({
      method: "command/exec/outputDelta",
      params: {
        processId,
        stream: "stdout",
        deltaBase64: Buffer.from(text, "utf8").toString("base64"),
        capReached: false
      }
    });
  }

  private emitServerRequest(message: AppServerServerRequestMessage): void {
    for (const handler of this.serverRequestHandlers) {
      handler(message);
    }
  }

  private selectThread(threadId: string | undefined): Thread {
    let thread =
      this.threads.find((item) => item.id === threadId) ||
      (threadId ? this.archivedThreads.get(threadId) : null);
    if (!thread && threadId) {
      thread = {
        ...this.createThread(),
        id: threadId,
        sessionId: `mock-session-${threadId}`
      };
      this.upsertThread(thread);
    }
    thread ??= this.thread;
    this.thread = thread;
    return thread;
  }

  private activePermissionProfileForThread(threadId: string): { id: string; extends: string | null } | null {
    const profileId = this.permissionProfilesByThread.get(threadId);
    return profileId ? { id: profileId, extends: null } : null;
  }

  private approvalsReviewerForThread(threadId: string): ApprovalsReviewer {
    return this.approvalsReviewersByThread.get(threadId) ?? "user";
  }

  private approvalPolicyForThread(threadId: string): AskForApproval {
    return this.approvalPoliciesByThread.get(threadId) ?? "untrusted";
  }

  private upsertThread(thread: Thread): void {
    this.threads = [thread, ...this.threads.filter((item) => item.id !== thread.id)];
  }

  private normalizeMockPath(path: string): string {
    const normalized = path.replace(/\//g, "\\");
    if (/^[A-Za-z]:\\$/.test(normalized)) {
      return normalized;
    }
    return normalized.replace(/\\+$/, "");
  }

  private getMockNode(path: string): MockFsNode {
    const normalizedPath = this.normalizeMockPath(path);
    const node = this.mockFs.get(normalizedPath);
    if (!node) {
      throw new Error(`mock 文件不存在: ${normalizedPath}`);
    }
    return node;
  }

  private getMockParentPath(path: string): string {
    const normalizedPath = this.normalizeMockPath(path);
    const index = normalizedPath.lastIndexOf("\\");
    if (index <= 2) {
      return normalizedPath.slice(0, index + 1);
    }
    return normalizedPath.slice(0, index);
  }

  private getMockBaseName(path: string): string {
    const normalizedPath = this.normalizeMockPath(path);
    return normalizedPath.slice(normalizedPath.lastIndexOf("\\") + 1);
  }

  private touchMockPath(path: string): void {
    const node = this.mockFs.get(this.normalizeMockPath(path));
    if (node) {
      node.modifiedAtMs = Date.now();
    }
  }

  private createMockDirectory(path: string): void {
    const normalizedPath = this.normalizeMockPath(path);
    if (this.mockFs.has(normalizedPath)) {
      return;
    }

    const parentPath = this.getMockParentPath(normalizedPath);
    if (parentPath && !this.mockFs.has(parentPath)) {
      this.createMockDirectory(parentPath);
    }

    const now = Date.now();
    this.mockFs.set(normalizedPath, {
      type: "directory",
      createdAtMs: now,
      modifiedAtMs: now
    });
    this.touchMockPath(parentPath);
  }

  private listMockDirectory(path: string): Array<{ fileName: string; isDirectory: boolean; isFile: boolean }> {
    const normalizedPath = this.normalizeMockPath(path);
    const directory = this.getMockNode(normalizedPath);
    if (directory.type !== "directory") {
      throw new Error(`不是目录: ${normalizedPath}`);
    }

    return [...this.mockFs.entries()]
      .filter(([candidatePath]) => candidatePath !== normalizedPath && this.getMockParentPath(candidatePath) === normalizedPath)
      .map(([candidatePath, node]) => ({
        fileName: this.getMockBaseName(candidatePath),
        isDirectory: node.type === "directory",
        isFile: node.type === "file"
      }))
      .sort((left, right) => {
        if (left.isDirectory !== right.isDirectory) {
          return left.isDirectory ? -1 : 1;
        }
        return left.fileName.localeCompare(right.fileName);
      });
  }

  private readMockFile(path: string): string {
    const normalizedPath = this.normalizeMockPath(path);
    const node = this.getMockNode(normalizedPath);
    if (node.type !== "file") {
      throw new Error(`不是文件: ${normalizedPath}`);
    }
    return node.text ?? "";
  }

  private writeMockFile(path: string, text: string): void {
    const normalizedPath = this.normalizeMockPath(path);
    const parentPath = this.getMockParentPath(normalizedPath);
    this.createMockDirectory(parentPath);
    const previous = this.mockFs.get(normalizedPath);
    const now = Date.now();
    this.mockFs.set(normalizedPath, {
      type: "file",
      createdAtMs: previous?.createdAtMs ?? now,
      modifiedAtMs: now,
      text
    });
    this.touchMockPath(parentPath);
  }

  private copyMockPath(sourcePath: string, destinationPath: string): void {
    const normalizedSourcePath = this.normalizeMockPath(sourcePath);
    const normalizedDestinationPath = this.normalizeMockPath(destinationPath);
    const source = this.getMockNode(normalizedSourcePath);
    const now = Date.now();

    if (source.type === "file") {
      this.writeMockFile(normalizedDestinationPath, source.text ?? "");
      return;
    }

    this.createMockDirectory(normalizedDestinationPath);
    for (const [candidatePath, node] of [...this.mockFs.entries()]) {
      if (candidatePath === normalizedSourcePath || !candidatePath.startsWith(`${normalizedSourcePath}\\`)) {
        continue;
      }
      const targetPath = `${normalizedDestinationPath}${candidatePath.slice(normalizedSourcePath.length)}`;
      this.mockFs.set(targetPath, {
        ...node,
        createdAtMs: now,
        modifiedAtMs: now
      });
    }
    this.touchMockPath(this.getMockParentPath(normalizedDestinationPath));
  }

  private removeMockPath(path: string): void {
    const normalizedPath = this.normalizeMockPath(path);
    const parentPath = this.getMockParentPath(normalizedPath);
    for (const candidatePath of [...this.mockFs.keys()]) {
      if (candidatePath === normalizedPath || candidatePath.startsWith(`${normalizedPath}\\`)) {
        this.mockFs.delete(candidatePath);
      }
    }
    this.touchMockPath(parentPath);
  }

  private writeMockConfigValue(keyPath: string, value: unknown): void {
    this.mockConfig = {
      ...this.mockConfig,
      [keyPath]: value
    };
    this.mockConfigVersion += 1;
  }

  private mockConfigWriteResponse(): {
    status: string;
    version: string;
    filePath: string;
    overriddenMetadata: null;
  } {
    return {
      status: "written",
      version: `mock-config-${this.mockConfigVersion}`,
      filePath: "C:\\Users\\huang\\.codex\\config.toml",
      overriddenMetadata: null
    };
  }

  private emitMockFsChanged(paths: string[]): void {
    const normalizedPaths = paths.map((changedPath) => this.normalizeMockPath(changedPath));
    for (const [watchId, watchedPath] of this.mockFsWatches) {
      const changedPaths = normalizedPaths.filter((changedPath) => this.isMockPathInsideWatch(changedPath, watchedPath));
      if (!changedPaths.length) {
        continue;
      }

      this.emitNotification({
        method: "fs/changed",
        params: {
          watchId,
          changedPaths
        }
      });
    }
  }

  private isMockPathInsideWatch(changedPath: string, watchedPath: string): boolean {
    const normalizedChangedPath = changedPath.toLowerCase();
    const normalizedWatchedPath = watchedPath.toLowerCase();
    return normalizedChangedPath === normalizedWatchedPath || normalizedChangedPath.startsWith(`${normalizedWatchedPath}\\`);
  }

  private threadMatchesSearch(thread: Thread, searchTerm: string): boolean {
    if (!searchTerm) {
      return true;
    }

    const haystack = [
      thread.name,
      thread.preview,
      thread.cwd,
      ...thread.turns.flatMap((turn) =>
        turn.items.map((item) => {
          if (item.type === "agentMessage") {
            return item.text;
          }
          if (item.type === "userMessage") {
            return item.content.map((content) => (content.type === "text" ? content.text : "")).join(" ");
          }
          return "";
        })
      )
    ]
      .filter(Boolean)
      .join("\n")
      .toLowerCase();

    return haystack.includes(searchTerm);
  }

  private createSearchSnippet(thread: Thread, searchTerm: string): string {
    const candidates = [thread.preview, thread.name, thread.cwd].filter((candidate): candidate is string =>
      typeof candidate === "string"
    );
    return candidates.find((candidate) => candidate.includes(searchTerm)) || `搜索命中：${searchTerm}`;
  }

  private createMockServerRequest(
    text: string,
    baseParams: { threadId: string; turnId: string },
    itemId: string
  ): AppServerServerRequestMessage {
    if (text.includes("文件审批")) {
      return {
        id: ++this.requestCounter,
        method: "item/fileChange/requestApproval",
        params: {
          ...baseParams,
          itemId,
          startedAtMs: Date.now(),
          reason: "需要写入 mock.txt",
          grantRoot: this.thread.cwd
        }
      };
    }

    if (text.includes("权限审批")) {
      return {
        id: ++this.requestCounter,
        method: "item/permissions/requestApproval",
        params: {
          ...baseParams,
          itemId,
          environmentId: null,
          startedAtMs: Date.now(),
          cwd: this.thread.cwd,
          reason: "需要网络访问",
          permissions: { network: { mode: "allowAll" }, fileSystem: null }
        }
      };
    }

    if (text.toLowerCase().includes("question")) {
      return {
        id: ++this.requestCounter,
        method: "item/tool/requestUserInput",
        params: {
          ...baseParams,
          itemId,
          questions: [
            {
              id: "mode",
              header: "模式",
              question: "请选择执行模式",
              isOther: false,
              isSecret: false,
              options: [
                { label: "快速", description: "更快完成" },
                { label: "稳妥", description: "更仔细检查" }
              ]
            }
          ],
          autoResolutionMs: null
        }
      };
    }

    if (text.toLowerCase().includes("mcp")) {
      return {
        id: ++this.requestCounter,
        method: "mcpServer/elicitation/request",
        params: {
          ...baseParams,
          serverName: "mock-mcp",
          mode: "url",
          _meta: null,
          message: "请确认外部授权",
          url: "https://example.com",
          elicitationId: "mock-elicitation"
        }
      };
    }

    if (text.toLowerCase().includes("dynamic")) {
      return {
        id: ++this.requestCounter,
        method: "item/tool/call",
        params: {
          ...baseParams,
          callId: "mock-dynamic-call",
          namespace: "browser",
          tool: "search",
          arguments: { query: text }
        }
      };
    }

    return {
      id: ++this.requestCounter,
      method: "item/commandExecution/requestApproval",
      params: {
        ...baseParams,
        itemId,
        startedAtMs: Date.now(),
        command: "npm test",
        cwd: this.thread.cwd,
        reason: "mock 命令审批",
        availableDecisions: ["accept", "decline"]
      }
    };
  }
}

class DisabledAppServerPeer implements ManagedAppServerPeer {
  connect(): Promise<void> {
    return Promise.reject(new Error("app-server 已关闭"));
  }

  getStatus(): AppServerStatus {
    return { state: "disabled", mode: "off", managedByCurrentProcess: false, reusedExisting: false };
  }

  onNotification(): () => void {
    return () => undefined;
  }

  onServerRequest(): () => void {
    return () => undefined;
  }

  respondToServerRequest(): Promise<void> {
    return Promise.reject(new Error("app-server 已关闭"));
  }

  notify(): Promise<void> {
    return Promise.reject(new Error("app-server 已关闭"));
  }

  close(): void {
    return undefined;
  }

  request(): Promise<unknown> {
    return Promise.reject(new Error("app-server 已关闭"));
  }
}

const MAX_TERMINAL_TURN_IDS_PER_THREAD = 32;

export type ThreadRuntimeReloadInput = ThreadRuntimeOverrides & {
  threadId: string;
  model: string;
  modelProvider: string;
};

export type RollbackThreadInput = {
  operationId: string;
  targetTurnId: string;
  historyStamp: HistoryStamp;
  expectedTailTurnIds: string[];
};

export class RollbackConflictError extends Error {
  readonly code = "ROLLBACK_CONFLICT" as const;
  readonly httpStatus = 409;

  constructor(readonly actualTailTurnIds: string[], message = "会话尾部已变化，请刷新后重试") {
    super(message);
    this.name = "RollbackConflictError";
  }
}

export class RollbackUnresolvedError extends Error {
  readonly code = "ROLLBACK_UNRESOLVED" as const;
  readonly httpStatus = 409;

  constructor() {
    super("rollback 操作属于旧的服务进程，结果无法安全确认");
    this.name = "RollbackUnresolvedError";
  }
}

function isTerminalRollbackOperationError(error: unknown): boolean {
  return error instanceof RollbackConflictError || error instanceof RollbackUnresolvedError;
}

type RollbackOperationEntry = {
  fingerprint: string;
  promise: Promise<MobileThreadDetail>;
  hasError: boolean;
  error?: unknown;
};

export class CurrentModelProviderError extends Error {
  readonly code = "CURRENT_PROVIDER_UNAVAILABLE" as const;

  constructor() {
    super("Codex 当前配置没有可用的 modelProvider");
    this.name = "CurrentModelProviderError";
  }
}

export class ThreadRuntimeBusyError extends Error {
  readonly code = "THREAD_BUSY" as const;

  constructor(readonly threadId: string) {
    super("会话存在运行中的 turn，无法切换模型");
    this.name = "ThreadRuntimeBusyError";
  }
}

export type ThreadRuntimeIdentity = {
  model: string | null;
  modelProvider: string;
  reasoningEffort: string | null;
};

function completePermissionSelection(source: {
  permissions?: unknown;
  approvalPolicy?: unknown;
  approvalsReviewer?: unknown;
}): MobilePermissionSelection | null {
  const permissions =
    typeof source.permissions === "string" || source.permissions === null
      ? source.permissions
      : undefined;
  const approvalPolicy =
    source.approvalPolicy === null ||
    source.approvalPolicy === "untrusted" ||
    source.approvalPolicy === "on-request" ||
    source.approvalPolicy === "never"
      ? source.approvalPolicy
      : undefined;
  const approvalsReviewer =
    source.approvalsReviewer === null ||
    source.approvalsReviewer === "user" ||
    source.approvalsReviewer === "auto_review" ||
    source.approvalsReviewer === "guardian_subagent"
      ? source.approvalsReviewer
      : undefined;
  if (
    permissions === undefined ||
    approvalPolicy === undefined ||
    approvalsReviewer === undefined
  ) {
    return null;
  }
  return { permissions, approvalPolicy, approvalsReviewer };
}

export type ThreadMaterializationState = "unmaterialized" | "materialized" | "unknown";

export class ThreadRuntimeVerificationError extends Error {
  readonly code = "RUNTIME_VERIFICATION_FAILED" as const;

  constructor(
    readonly expected: ThreadRuntimeIdentity,
    readonly actual: ThreadRuntimeIdentity
  ) {
    super("app-server 冷恢复后的模型运行时身份与目标不一致");
    this.name = "ThreadRuntimeVerificationError";
  }
}

export function verifyThreadRuntime(
  detail: MobileThreadDetail,
  expected: { model: string; modelProvider: string; reasoningEffort?: string | null }
): void {
  const actual: ThreadRuntimeIdentity = {
    model: detail.model ?? null,
    modelProvider: detail.modelProvider,
    reasoningEffort: detail.reasoningEffort ?? null
  };
  const expectedIdentity: ThreadRuntimeIdentity = {
    model: expected.model,
    modelProvider: expected.modelProvider,
    reasoningEffort: expected.reasoningEffort ?? null
  };
  const reasoningMatches = expected.reasoningEffort === undefined ||
    actual.reasoningEffort === expected.reasoningEffort;
  if (
    actual.model !== expected.model ||
    actual.modelProvider !== expected.modelProvider ||
    !reasoningMatches
  ) {
    throw new ThreadRuntimeVerificationError(expectedIdentity, actual);
  }
}

export class AppServerGateway {
  private initialized: Promise<void> | null = null;
  private readonly client: CodexAppServerClient;
  private readonly browserEventHandlers = new Set<(event: BrowserTimelineEvent) => void>();
  private readonly browserEventBacklog: BrowserTimelineEvent[] = [];
  private readonly browserEventOwnerLedger: BrowserEventOwnerRecord[] = [];
  private readonly threadEventRevisions = new Map<string, number>();
  private readonly threadTimelineGenerations = new Map<string, number>();
  private readonly timelineGenerationTransitions = new Map<string, TimelineGenerationTransition>();
  private readonly fragmentSequences = new Map<string, number>();
  private readonly pendingServerRequests = new Map<number, PendingServerRequestView>();
  private readonly terminalSessions = new Map<string, MobileTerminalSession>();
  private readonly commandExecSessions = new Map<string, MobileTerminalSession>();
  private readonly timelineOverlays = new Map<string, Map<string, TimelineOverlayEntry>>();
  private readonly deletedTurnIdsByThread = new Map<string, Set<string>>();
  private readonly timelineContentSources = new Map<string, TimelineContentSource>();
  private readonly timelineContentCursors = new Map<string, TimelineContentCursorState>();
  private readonly timelineContentCursorByPosition = new Map<string, string>();
  private readonly activeTurnIds = new Map<string, string>();
  private readonly runtimeIdentitiesByThread = new Map<string, ThreadRuntimeIdentity>();
  private readonly configuredPermissionSelectionsByThread = new Map<string, MobilePermissionSelection>();
  private readonly runtimePermissionObservationsByThread = new Map<string, MobileRuntimePermissionObservation>();
  private readonly terminalTurnIdsByThread = new Map<string, Set<string>>();
  private readonly threadMutationLocks = new Map<string, Promise<void>>();
  private readonly rollbackOperations = new Map<string, RollbackOperationEntry>();
  private readonly outputDecoders = new Map<string, TextDecoder>();
  private processCounter = 0;
  private commandExecCounter = 0;
  private fsWatchCounter = 0;
  private fileSearchSessionCounter = 0;
  private readonly browserBootId = randomUUID();
  private browserEventSequence = 0;

  constructor(
    private readonly peer: ManagedAppServerPeer,
    private readonly timelinePathPolicy: { assertPathAllowed(path: string): string | Promise<string> } = {
      assertPathAllowed: assertRuntimeSessionRolloutFileAllowed
    }
  ) {
    this.client = new CodexAppServerClient(peer as AppServerPeer);
    this.peer.onNotification((message) => {
      const decodedMessage = this.decodeOutputNotification(message);
      if (!decodedMessage) return;
      this.recordProcessNotification(decodedMessage);
      this.recordCommandExecNotification(decodedMessage);
      this.recordThreadRuntimeIdentityNotification(decodedMessage);
      const event = normalizeAppServerNotification(decodedMessage);
      if (!event) {
        return;
      }
      if (event.type === "server-request-resolved") {
        this.pendingServerRequests.delete(Number(event.requestId));
        this.emitBrowserEvent(event);
        return;
      }
      this.recordActiveTurnIdentity(event);
      this.recordRuntimePermissionObservationEvent(event);
      if (this.isDeletedTurnEvent(event)) {
        return;
      }
      const timelineEvent = this.enrichCodexEvent(event);
      this.recordTimelineOverlay(timelineEvent);

      for (const handler of this.browserEventHandlers) {
        handler(timelineEvent);
      }
    });
    this.peer.onServerRequest((message) => {
      const request = normalizePendingServerRequest(message);
      this.pendingServerRequests.set(request.requestId, request);
      this.emitBrowserEvent({ type: "server-request", request });
    });
  }

  getStatus(): AppServerStatus {
    return this.peer.getStatus();
  }

  getActiveTurnId(threadId: string): string | null {
    return this.activeTurnIds.get(threadId) ?? null;
  }

  getTimelineBootId(): string {
    return this.browserBootId;
  }

  onBrowserEvent(handler: (event: BrowserTimelineEvent) => void): () => void {
    this.browserEventHandlers.add(handler);
    return () => this.browserEventHandlers.delete(handler);
  }

  listBrowserEventBacklog(afterEventId?: string | null): {
    events: BrowserTimelineEvent[];
    gap: boolean;
    gapScope?: TimelineGapScope;
    bootId: string;
    streamCursor: number;
    baselineRequired: boolean;
  } {
    if (!afterEventId) {
      return {
        events: [],
        gap: false,
        bootId: this.browserBootId,
        streamCursor: this.browserEventSequence,
        baselineRequired: true
      };
    }

    const index = this.browserEventBacklog.findIndex((event) => browserEventId(event) === afterEventId);
    if (index < 0) {
      const cursor = browserEventCursor(afterEventId);
      if (!cursor || cursor.bootId !== this.browserBootId) {
        return {
          events: [],
          gap: true,
          gapScope: { scope: "all-tracked" },
          bootId: this.browserBootId,
          streamCursor: this.browserEventSequence,
          baselineRequired: false
        };
      }
      const oldestOwnerSequence = this.browserEventOwnerLedger[0]?.streamSequence;
      if (typeof oldestOwnerSequence !== "number" || cursor.streamSequence < oldestOwnerSequence - 1) {
        return {
          events: [],
          gap: true,
          gapScope: { scope: "all-tracked" },
          bootId: this.browserBootId,
          streamCursor: this.browserEventSequence,
          baselineRequired: false
        };
      }
      const owners = new Set<string>();
      let hasUnknownVisibleOwner = false;
      for (const record of this.browserEventOwnerLedger) {
        if (record.streamSequence <= cursor.streamSequence || !record.visible) {
          continue;
        }
        if (record.threadId) {
          owners.add(record.threadId);
        } else {
          hasUnknownVisibleOwner = true;
        }
      }
      const gapScope: TimelineGapScope = hasUnknownVisibleOwner || !owners.size
        ? { scope: "all-tracked" }
        : { scope: "threads", affectedThreadIds: [...owners] };
      return {
        events: this.browserEventBacklog.filter((event) => browserEventStreamSequence(event) > cursor.streamSequence),
        gap: true,
        gapScope,
        bootId: this.browserBootId,
        streamCursor: this.browserEventSequence,
        baselineRequired: false
      };
    }

    return {
      events: this.browserEventBacklog.slice(index + 1).filter((event) => !this.isBlockedBacklogEvent(event)),
      gap: false,
      bootId: this.browserBootId,
      streamCursor: this.browserEventSequence,
      baselineRequired: false
    };
  }

  listPendingServerRequests(): PendingServerRequestView[] {
    return [...this.pendingServerRequests.values()];
  }

  async resolveServerRequest(
    requestId: number,
    value: string
  ): Promise<void> {
    const request = this.pendingServerRequests.get(requestId);
    if (!request) {
      throw new Error("找不到待处理请求");
    }

    const response = buildPendingServerRequestResponse(request, value);

    await this.peer.respondToServerRequest(requestId, response);
    this.pendingServerRequests.delete(requestId);
    this.emitBrowserEvent({ type: "server-request-resolved", requestId: String(requestId) });
  }

  private emitBrowserEvent(event: BrowserTimelineEvent): void {
    this.recordBrowserEvent(event);
    for (const handler of this.browserEventHandlers) {
      handler(event);
    }
  }

  private broadcastConfiguredPermissionSelection(
    threadId: string,
    selection: MobilePermissionSelection
  ): void {
    const event = this.enrichCodexEvent({
      type: "codex-event",
      event: {
        kind: "thread_permission_configured",
        threadId,
        permissions: selection.permissions,
        approvalPolicy: selection.approvalPolicy,
        approvalsReviewer: selection.approvalsReviewer
      }
    });
    for (const handler of this.browserEventHandlers) {
      handler(event);
    }
  }

  private enrichCodexEvent(envelope: BrowserCodexEventEnvelope): BrowserCodexEventEnvelope {
    const threadId = browserCodexEventThreadKey(envelope);
    const revision = this.nextThreadEventRevision(threadId);
    const generation = this.currentTimelineGeneration(threadId);
    const streamSequence = ++this.browserEventSequence;
    const fragmentSequence = this.nextFragmentSequence(envelope, threadId, generation);
    const eventId =
      envelope.event.eventId ??
      `${this.browserBootId}:${threadId}:${revision}:${streamSequence}:${envelope.event.kind}`;
    const event = {
      ...envelope.event,
      eventId,
      bootId: this.browserBootId,
      streamSequence,
      sequence: streamSequence,
      ...(typeof fragmentSequence === "number" ? { fragmentSequence } : {}),
      revision,
      generation
    };
    const next = browserTimelineEventForBudget(
      { ...envelope, event },
      undefined,
      {
        createContentRef: (content, identity) =>
          this.registerAppServerTimelineContentSource(content, identity)
      }
    ) as BrowserCodexEventEnvelope;
    this.recordBrowserEvent(next);
    return next;
  }

  private nextThreadEventRevision(threadId: string): number {
    const nextRevision = (this.threadEventRevisions.get(threadId) ?? 0) + 1;
    this.threadEventRevisions.set(threadId, nextRevision);
    return nextRevision;
  }

  private nextFragmentSequence(
    envelope: BrowserCodexEventEnvelope,
    threadId: string,
    generation: number
  ): number | undefined {
    const event = envelope.event as unknown as Record<string, unknown>;
    const { turnId, itemId, kind } = event;
    if (
      typeof turnId !== "string" ||
      !turnId ||
      typeof itemId !== "string" ||
      !itemId ||
      typeof event.delta !== "string" ||
      typeof kind !== "string"
    ) {
      return undefined;
    }
    const key = `${threadId}\u0000${generation}\u0000${turnId}\u0000${itemId}\u0000${kind}`;
    const next = (this.fragmentSequences.get(key) ?? 0) + 1;
    this.fragmentSequences.set(key, next);
    return next;
  }

  private recordBrowserEvent(event: BrowserTimelineEvent): void {
    this.browserEventBacklog.push(event);
    while (this.browserEventBacklog.length > MAX_BROWSER_EVENT_BACKLOG) {
      this.browserEventBacklog.shift();
    }
    if (event.type === "codex-event") {
      const bootId = event.event.bootId;
      const streamSequence = event.event.streamSequence ?? event.event.sequence;
      if (typeof bootId === "string" && typeof streamSequence === "number") {
        const threadId = browserCodexEventThreadKey(event);
        this.browserEventOwnerLedger.push({
          bootId,
          streamSequence,
          threadId: threadId === "_global" ? null : threadId,
          visible: this.isVisibleCodexEvent(event)
        });
        while (this.browserEventOwnerLedger.length > MAX_BROWSER_EVENT_OWNER_LEDGER) {
          this.browserEventOwnerLedger.shift();
        }
      }
    }
  }

  private currentTimelineGeneration(threadId: string): number {
    return this.threadTimelineGenerations.get(threadId) ?? 0;
  }

  private bumpTimelineGeneration(
    threadId: string,
    transition?: { previous: MobileTimelineItem[]; next: MobileTimelineItem[] }
  ): number {
    const previousStamp = {
      bootId: this.browserBootId,
      generation: this.currentTimelineGeneration(threadId)
    };
    const next = previousStamp.generation + 1;
    this.threadTimelineGenerations.set(threadId, next);
    const normalizedTransition = transition
      ? chronologicalTimelineTransition(transition.previous, transition.next)
      : null;
    const stablePrefix = normalizedTransition
      ? stableTimelinePrefix(normalizedTransition.previous, normalizedTransition.next)
      : [];
    if (normalizedTransition) {
      this.timelineGenerationTransitions.set(threadId, {
        generation: next,
        previousStamp,
        stablePrefix,
        nextTimeline: normalizedTransition.next
      });
    } else {
      this.timelineGenerationTransitions.delete(threadId);
    }
    this.threadEventRevisions.set(threadId, 0);
    this.clearFragmentSequences(threadId);
    this.clearOutputDecoders(threadId);
    this.pruneBrowserEventBacklogForThread(threadId);
    this.broadcastTimelineGenerationBarrier(threadId);
    return next;
  }

  private resetTimelineGeneration(threadId: string): void {
    this.threadTimelineGenerations.set(threadId, 0);
    this.threadEventRevisions.set(threadId, 0);
    this.timelineGenerationTransitions.delete(threadId);
    this.clearFragmentSequences(threadId);
    this.clearOutputDecoders(threadId);
    this.pruneBrowserEventBacklogForThread(threadId);
    this.broadcastTimelineGenerationBarrier(threadId);
  }

  private broadcastTimelineGenerationBarrier(threadId: string): void {
    const barrier = this.enrichCodexEvent({
      type: "codex-event",
      event: { kind: "timeline_generation_changed", threadId }
    });
    for (const handler of this.browserEventHandlers) {
      handler(barrier);
    }
  }

  private clearFragmentSequences(threadId: string): void {
    const prefix = `${threadId}\u0000`;
    for (const key of this.fragmentSequences.keys()) {
      if (key.startsWith(prefix)) {
        this.fragmentSequences.delete(key);
      }
    }
  }

  private clearOutputDecoders(threadId?: string): void {
    const prefix = threadId ? `${threadId}\u0000` : null;
    for (const key of this.outputDecoders.keys()) {
      if (!prefix || key.startsWith(prefix)) this.outputDecoders.delete(key);
    }
  }

  private isBlockedBacklogEvent(event: BrowserTimelineEvent): boolean {
    if (event.type !== "codex-event") {
      return false;
    }
    const threadId = browserCodexEventThreadKey(event);
    const generation = event.event.generation;
    if (typeof generation === "number" && generation < this.currentTimelineGeneration(threadId) && this.isVisibleCodexEvent(event)) {
      return true;
    }
    return this.isDeletedTurnEvent(event);
  }

  private pruneBrowserEventBacklogForThread(threadId: string): void {
    for (let index = this.browserEventBacklog.length - 1; index >= 0; index -= 1) {
      const event = this.browserEventBacklog[index];
      if (event.type !== "codex-event" || browserCodexEventThreadKey(event) !== threadId) {
        continue;
      }
      if (this.isBlockedBacklogEvent(event)) {
        this.browserEventBacklog.splice(index, 1);
      }
    }
  }

  private isVisibleCodexEvent(envelope: BrowserCodexEventEnvelope): boolean {
    return new Set([
      "agent_message_delta",
      "reasoning_delta",
      "reasoning_started",
      "plan_delta",
      "plan.delta",
      "command_output_delta",
      "file_output_delta",
      "tool_output_delta",
      "turn_diff_updated",
      "context_compacted",
      "item_updated"
    ]).has(envelope.event.kind);
  }

  private isDeletedTurnEvent(envelope: BrowserCodexEventEnvelope): boolean {
    const event = envelope.event;
    if (!("threadId" in event) || typeof event.threadId !== "string" || !("turnId" in event)) {
      return false;
    }
    const turnId = typeof event.turnId === "string" ? event.turnId : null;
    return Boolean(turnId && this.deletedTurnIdsByThread.get(event.threadId)?.has(turnId));
  }

  private recordActiveTurnIdentity(envelope: BrowserCodexEventEnvelope): void {
    const event = envelope.event;
    if (event.kind === "turn_started") {
      if (!this.isTerminalTurn(event.threadId, event.turnId)) {
        this.activeTurnIds.set(event.threadId, event.turnId);
      }
      return;
    }
    if (event.kind === "turn_completed") {
      this.markTerminalTurn(event.threadId, event.turnId);
      if (this.activeTurnIds.get(event.threadId) === event.turnId) {
        this.activeTurnIds.delete(event.threadId);
      }
    }
  }

  private recordRuntimePermissionObservationEvent(envelope: BrowserCodexEventEnvelope): void {
    const event = envelope.event as BrowserCodexEventEnvelope["event"] & Record<string, unknown>;
    if (event.kind !== "thread_settings_updated" || typeof event.threadId !== "string") {
      return;
    }
    const activePermissionProfile = event.activePermissionProfile as { id?: unknown } | null;
    this.runtimePermissionObservationsByThread.set(event.threadId, {
      permissions:
        activePermissionProfile && typeof activePermissionProfile.id === "string"
          ? activePermissionProfile.id
          : null,
      approvalPolicy: typeof event.approvalPolicy === "string" ? event.approvalPolicy : null,
      approvalsReviewer: typeof event.approvalsReviewer === "string" ? event.approvalsReviewer : null
    });
  }

  private recordThreadRuntimeIdentityNotification(message: AppServerNotificationMessage): void {
    if (message.method !== "thread/settings/updated") {
      return;
    }
    const params = message.params as {
      threadId?: unknown;
      threadSettings?: {
        model?: unknown;
        modelProvider?: unknown;
        effort?: unknown;
      };
    } | null | undefined;
    if (!params || typeof params.threadId !== "string" || !params.threadSettings) {
      return;
    }
    this.recordThreadRuntimeIdentity(params.threadId, {
      model: params.threadSettings.model,
      modelProvider: params.threadSettings.modelProvider,
      reasoningEffort: params.threadSettings.effort
    });
  }

  private recordThreadRuntimeIdentity(
    threadId: string,
    source: { model?: unknown; modelProvider?: unknown; reasoningEffort?: unknown }
  ): void {
    if (typeof source.model !== "string" || !source.model.trim() ||
      typeof source.modelProvider !== "string" || !source.modelProvider.trim()) {
      return;
    }
    this.runtimeIdentitiesByThread.set(threadId, {
      model: source.model,
      modelProvider: source.modelProvider,
      reasoningEffort: typeof source.reasoningEffort === "string" ? source.reasoningEffort : null
    });
  }

  private withThreadRuntimeIdentity<T extends MobileThreadSummary>(thread: T): T {
    const identity = this.runtimeIdentitiesByThread.get(thread.id);
    return identity ? { ...thread, ...identity } : thread;
  }

  private setConfiguredPermissionSelection(
    threadId: string,
    selection: MobilePermissionSelection | null
  ): MobilePermissionSelection | null {
    if (!selection) {
      return null;
    }
    this.configuredPermissionSelectionsByThread.set(threadId, selection);
    return selection;
  }

  private mergeConfiguredPermissionSelection(
    threadId: string,
    source: {
      permissions?: unknown;
      approvalPolicy?: unknown;
      approvalsReviewer?: unknown;
    }
  ): MobilePermissionSelection | null {
    const previous = this.configuredPermissionSelectionsByThread.get(threadId);
    return this.setConfiguredPermissionSelection(
      threadId,
      completePermissionSelection({
        permissions: source.permissions !== undefined ? source.permissions : previous?.permissions,
        approvalPolicy:
          source.approvalPolicy !== undefined ? source.approvalPolicy : previous?.approvalPolicy,
        approvalsReviewer:
          source.approvalsReviewer !== undefined
            ? source.approvalsReviewer
            : previous?.approvalsReviewer
      })
    );
  }

  private withPermissionSelection<T extends MobileThreadSummary>(thread: T): T {
    const selection = this.configuredPermissionSelectionsByThread.get(thread.id);
    const observation = this.runtimePermissionObservationsByThread.get(thread.id);
    const threadWithObservation = observation
      ? { ...thread, runtimePermissionObservation: observation }
      : thread;
    if (!selection) {
      const {
        activePermissionProfile: _activePermissionProfile,
        approvalPolicy: _approvalPolicy,
        approvalsReviewer: _approvalsReviewer,
        ...unknownPermissionThread
      } = threadWithObservation;
      return unknownPermissionThread as T;
    }
    return {
      ...threadWithObservation,
      activePermissionProfile: selection.permissions
        ? { id: selection.permissions, extends: null }
        : null,
      approvalPolicy: selection.approvalPolicy,
      approvalsReviewer: selection.approvalsReviewer
    };
  }

  private isTerminalTurn(threadId: string, turnId: string): boolean {
    return this.terminalTurnIdsByThread.get(threadId)?.has(turnId) ?? false;
  }

  private markTerminalTurn(threadId: string, turnId: string): void {
    const turnIds = this.terminalTurnIdsByThread.get(threadId) ?? new Set<string>();
    turnIds.add(turnId);
    while (turnIds.size > MAX_TERMINAL_TURN_IDS_PER_THREAD) {
      const oldestTurnId = turnIds.values().next().value;
      if (typeof oldestTurnId !== "string") {
        break;
      }
      turnIds.delete(oldestTurnId);
    }
    this.terminalTurnIdsByThread.set(threadId, turnIds);
  }

  private markDeletedTurns(
    threadId: string,
    turnIds: string[],
    transition?: { previous: MobileTimelineItem[]; next: MobileTimelineItem[] }
  ): void {
    if (!turnIds.length) {
      return;
    }
    const deleted = this.deletedTurnIdsByThread.get(threadId) ?? new Set<string>();
    for (const turnId of turnIds) {
      deleted.add(turnId);
    }
    this.deletedTurnIdsByThread.set(threadId, deleted);
    this.bumpTimelineGeneration(threadId, transition);
  }

  private recordTimelineOverlay(envelope: BrowserCodexEventEnvelope): void {
    const event = envelope.event;
    if (this.isBlockedBacklogEvent(envelope)) {
      return;
    }

    switch (event.kind) {
      case "turn_started":
        this.upsertTimelineOverlayItem(event.threadId, event.turnId, {
          id: pendingReasoningItemId(event.threadId, event.turnId),
          role: "reasoning",
          text: "",
          done: false
        });
        break;
      case "turn_completed":
        this.finishTurnTimelineOverlay(event.threadId, event.turnId, event.status);
        break;
      case "reasoning_started":
        this.removeTimelineOverlayItem(event.threadId, pendingReasoningItemId(event.threadId, event.turnId));
        this.upsertTimelineOverlayItem(event.threadId, event.turnId, {
          id: event.itemId,
          role: "reasoning",
          text: "",
          done: false
        });
        break;
      case "reasoning_delta":
        this.removeTimelineOverlayItem(event.threadId, pendingReasoningItemId(event.threadId, event.turnId));
        this.appendTimelineOverlayText(
          event.threadId,
          event.turnId,
          event.itemId,
          event.delta,
          {
            role: "reasoning",
            text: "",
            done: false
          }
        );
        break;
      case "agent_message_delta":
        this.appendTimelineOverlayText(
          event.threadId,
          event.turnId,
          event.itemId,
          event.delta,
          { role: "agent", text: "" },
          { provisionalAgent: true }
        );
        break;
      case "command_output_delta":
        this.appendTimelineOverlayText(event.threadId, event.turnId, event.itemId, event.delta, {
          role: "tool",
          text: "",
          toolKind: "command",
          server: "command",
          tool: "command",
          status: "running"
        });
        break;
      case "file_output_delta":
        this.appendTimelineOverlayText(event.threadId, event.turnId, event.itemId, event.delta, {
          role: "tool",
          text: "",
          toolKind: "file",
          server: "file",
          tool: "change",
          status: "running"
        });
        break;
      case "tool_output_delta":
        this.appendTimelineOverlayText(event.threadId, event.turnId, event.itemId, event.delta, {
          role: "tool",
          text: "",
          toolKind: event.toolKind,
          server: event.server,
          tool: event.tool,
          status: "running"
        });
        break;
      case "item_updated":
        if (event.item.role === "reasoning") {
          this.removeTimelineOverlayItem(event.threadId, pendingReasoningItemId(event.threadId, event.turnId));
        }
        this.upsertTimelineOverlayItem(event.threadId, event.turnId, {
          ...event.item,
          ...(event.item.role === "reasoning" ? { done: true } : {})
        });
        break;
      case "turn_diff_updated": {
        const stats = diffStats(event.diff);
        this.upsertTimelineOverlayItem(event.threadId, event.turnId, {
          id: `${event.turnId}-diff`,
          role: "diff",
          text: event.diff,
          toolKind: "file",
          diffPath: "工作区变更",
          added: stats.added,
          removed: stats.removed
        });
        break;
      }
      case "context_compacted":
        this.upsertTimelineOverlayItem(event.threadId, event.turnId, {
          id: `${event.turnId}-context-compacted`,
          role: "system",
          text: CONTEXT_COMPACTION_DONE_TEXT,
          toolKind: "system",
          systemKind: "context-compaction",
          status: "success"
        });
        break;
      case "warning":
        if (event.threadId) {
          this.upsertTimelineOverlayItem(event.threadId, null, {
            id: `${event.threadId}-warning-${event.eventId ?? this.browserEventSequence}`,
            role: "error",
            text: event.message
          });
        }
        break;
      case "turn_error":
        if (event.willRetry === true) {
          this.removeTimelineOverlayItem(event.threadId, `${event.turnId}-error`);
          break;
        }
        this.upsertTimelineOverlayItem(event.threadId, event.turnId, {
          id: `${event.turnId}-error`,
          role: "error",
          text: event.message
        });
        this.finishTurnTimelineOverlay(event.threadId, event.turnId, "failed");
        break;
      default:
        break;
    }
  }

  private upsertTimelineOverlayItem(
    threadId: string,
    turnId: string | null,
    item: MobileTimelineItem,
    options: { provisionalAgent?: boolean } = {}
  ): void {
    const overlay = this.getTimelineOverlay(threadId);
    const current = overlay.get(item.id);
    const itemWithMeta = overlayItemWithTurnMeta(item, turnId);
    const generation = this.currentTimelineGeneration(threadId);
    const incomingProvisional = options.provisionalAgent ?? isRawResponseAgentItem(itemWithMeta);
    const candidate = agentAliasCandidate(itemWithMeta, turnId, generation, incomingProvisional);
    if (candidate) {
      const existingCandidates = [...overlay.values()]
        .map((entry) => agentAliasCandidate(
          entry.item,
          entry.turnId,
          entry.generation,
          entry.provisionalAgent
        ))
        .filter((entry): entry is AgentMessageAliasCandidate => Boolean(entry));
      const alias = reciprocalAgentMessageAlias(candidate, existingCandidates);
      if (alias) {
        const canonicalIsIncoming = alias.canonicalId === candidate.id;
        const canonicalEntry = canonicalIsIncoming ? null : overlay.get(alias.canonicalId);
        const provisionalEntry = canonicalIsIncoming ? overlay.get(alias.provisionalId) : null;
        if (canonicalIsIncoming && provisionalEntry) {
          overlay.delete(alias.provisionalId);
          overlay.set(alias.canonicalId, {
            item: mergeAgentAliasItems(provisionalEntry.item, itemWithMeta),
            turnId,
            generation,
            provisionalAgent: false,
            updatedAtMs: Date.now()
          });
        } else if (canonicalEntry) {
          overlay.set(alias.canonicalId, {
            ...canonicalEntry,
            updatedAtMs: Date.now()
          });
        }
        this.trimTimelineOverlay(overlay);
        return;
      }
    }

    overlay.set(item.id, {
      item: current ? mergeOverlayItems(current.item, itemWithMeta) : itemWithMeta,
      turnId,
      generation,
      provisionalAgent: item.role === "agent"
        ? current
          ? Boolean(current.provisionalAgent && incomingProvisional)
          : incomingProvisional
        : false,
      updatedAtMs: Date.now()
    });
    this.trimTimelineOverlay(overlay);
  }

  private appendTimelineOverlayText(
    threadId: string,
    turnId: string | null,
    itemId: string,
    delta: string,
    defaults: Omit<MobileTimelineItem, "id">,
    options: { provisionalAgent?: boolean } = {}
  ): void {
    if (!delta) {
      return;
    }

    const overlay = this.getTimelineOverlay(threadId);
    const current = overlay.get(itemId);
    const currentItem = current?.item;
    const nextItem: MobileTimelineItem = currentItem
      ? overlayItemWithTurnMeta(
          { ...currentItem, text: `${currentItem.text}${delta}`, status: currentItem.status ?? defaults.status },
          turnId
        )
      : overlayItemWithTurnMeta({ id: itemId, ...defaults, text: `${defaults.text}${delta}` }, turnId);

    overlay.set(itemId, {
      item: nextItem,
      turnId,
      generation: this.currentTimelineGeneration(threadId),
      provisionalAgent: defaults.role === "agent"
        ? Boolean(current?.provisionalAgent || options.provisionalAgent)
        : false,
      updatedAtMs: Date.now()
    });
    this.trimTimelineOverlay(overlay);
  }

  private finishTurnTimelineOverlay(threadId: string, turnId: string, status: string): void {
    const overlay = this.timelineOverlays.get(threadId);
    if (!overlay) {
      return;
    }

    const failed = /fail|error|cancel|interrupt/i.test(status);
    for (const [id, entry] of overlay) {
      if (entry.turnId !== turnId) {
        continue;
      }

      if (!failed && entry.item.role === "error") {
        overlay.delete(id);
        continue;
      }

      if (entry.item.role === "reasoning") {
        if (!entry.item.text.trim()) {
          overlay.delete(id);
          continue;
        }
        overlay.set(id, {
          ...entry,
          item: { ...entry.item, done: true },
          updatedAtMs: Date.now()
        });
        continue;
      }

      if (entry.item.role === "tool" && entry.item.status === "running") {
        overlay.set(id, {
          ...entry,
          item: { ...entry.item, status: failed ? "failed" : "success" },
          updatedAtMs: Date.now()
        });
      }
    }

    this.removeTimelineOverlayItem(threadId, pendingReasoningItemId(threadId, turnId));
  }

  private getTimelineOverlay(threadId: string): Map<string, TimelineOverlayEntry> {
    let overlay = this.timelineOverlays.get(threadId);
    if (!overlay) {
      overlay = new Map();
      this.timelineOverlays.set(threadId, overlay);
    }
    return overlay;
  }

  private removeTimelineOverlayItem(threadId: string, itemId: string): void {
    this.timelineOverlays.get(threadId)?.delete(itemId);
  }

  private clearTimelineOverlayTurns(threadId: string, turnIds: string[]): void {
    const overlay = this.timelineOverlays.get(threadId);
    if (!overlay || !turnIds.length) {
      return;
    }
    const deleted = new Set(turnIds);
    for (const [itemId, entry] of overlay) {
      if (entry.turnId && deleted.has(entry.turnId)) {
        overlay.delete(itemId);
      }
    }
    if (!overlay.size) {
      this.timelineOverlays.delete(threadId);
    }
  }

  private trimTimelineOverlay(overlay: Map<string, TimelineOverlayEntry>): void {
    while (overlay.size > MAX_TIMELINE_OVERLAY_ITEMS_PER_THREAD) {
      const firstKey = overlay.keys().next().value;
      if (typeof firstKey !== "string") {
        return;
      }
      overlay.delete(firstKey);
    }
  }

  private recordProcessNotification(message: AppServerNotificationMessage): void {
    const params = message.params as Record<string, unknown> | null | undefined;
    if (!params || typeof params.processHandle !== "string") {
      return;
    }

    const session = this.terminalSessions.get(params.processHandle);
    if (!session) {
      return;
    }

    if (message.method === "process/outputDelta" && typeof params.deltaBase64 === "string") {
      const delta = Buffer.from(params.deltaBase64, "base64").toString("utf8");
      this.terminalSessions.set(params.processHandle, {
        ...session,
        output: `${session.output}${delta}`
      });
      return;
    }

    if (message.method === "process/exited") {
      const stdout = typeof params.stdout === "string" ? params.stdout : "";
      const stderr = typeof params.stderr === "string" ? params.stderr : "";
      this.terminalSessions.set(params.processHandle, {
        ...session,
        output: `${session.output}${stdout}${stderr}`,
        exitCode: typeof params.exitCode === "number" ? params.exitCode : null,
        running: false
      });
    }
  }

  private decodeOutputNotification(message: AppServerNotificationMessage): AppServerNotificationMessage | null {
    const params = message.params as Record<string, unknown> | null | undefined;
    if (!params) return message;
    if (message.method === "process/exited") {
      if (typeof params.threadId === "string" && typeof params.processHandle === "string") {
        const prefix = `${params.threadId}\u0000${params.processHandle}\u0000`;
        for (const key of this.outputDecoders.keys()) {
          if (key.startsWith(prefix)) this.outputDecoders.delete(key);
        }
      }
      return message;
    }
    if (
      message.method !== "process/outputDelta" &&
      message.method !== "command/exec/outputDelta"
    ) {
      return message;
    }
    const itemId = message.method === "process/outputDelta" ? params.processHandle : params.processId;
    if (
      typeof params.threadId !== "string" ||
      typeof itemId !== "string" ||
      typeof params.deltaBase64 !== "string"
    ) {
      return message;
    }
    const stream = typeof params.stream === "string" ? params.stream : "stdout";
    const key = `${params.threadId}\u0000${itemId}\u0000${stream}`;
    const decoder = this.outputDecoders.get(key) ?? new TextDecoder();
    const capReached = params.capReached === true;
    const delta = decoder.decode(Buffer.from(params.deltaBase64, "base64"), { stream: !capReached });
    if (capReached) {
      this.outputDecoders.delete(key);
    } else {
      this.outputDecoders.set(key, decoder);
    }
    if (!delta) return null;
    return {
      ...message,
      params: {
        ...params,
        deltaBase64: Buffer.from(delta, "utf8").toString("base64")
      }
    };
  }

  private recordCommandExecNotification(message: AppServerNotificationMessage): void {
    const params = message.params as Record<string, unknown> | null | undefined;
    if (!params || typeof params.processId !== "string") {
      return;
    }

    const session = this.commandExecSessions.get(params.processId);
    if (!session) {
      return;
    }

    if (message.method === "command/exec/outputDelta" && typeof params.deltaBase64 === "string") {
      const delta = Buffer.from(params.deltaBase64, "base64").toString("utf8");
      this.commandExecSessions.set(params.processId, {
        ...session,
        output: `${session.output}${delta}`
      });
    }
  }

  ensureReady(): Promise<void> {
    if (this.peer.getStatus().state !== "ready") {
      this.initialized = null;
    }

    if (!this.initialized) {
      this.initialized = this.peer.connect().then(async () => {
        try {
          await this.client.initialize();
        } catch (error) {
          if (!isAlreadyInitializedError(error)) {
            throw error;
          }
        }
      });
    }

    return this.initialized;
  }

  async listThreads(params = {}): Promise<MobileThreadPage> {
    await this.ensureReady();
    return this.client.listThreads(params);
  }

  async searchThreads(input: SearchThreadsInput): Promise<MobileThreadPage> {
    await this.ensureReady();
    return this.client.searchThreads(input);
  }

  async getConversationSummary(input: GetConversationSummaryInput): Promise<MobileThreadSummary> {
    await this.ensureReady();
    return this.client.getConversationSummary(input);
  }

  async gitDiffToRemote(cwd: string): Promise<MobileGitDiffView> {
    await this.ensureReady();
    return this.client.gitDiffToRemote(cwd);
  }

  async listModels(): Promise<MobileModelOption[]> {
    await this.ensureReady();
    return this.client.listModels();
  }

  async readThread(threadId: string): Promise<MobileThreadDetail> {
    await this.ensureReady();
    const detail = await this.applySessionTimelineSupplement(await this.client.readThread(threadId));
    return this.timelineThreadWithinBudget(
      this.withTimelineGeneration(this.applyTimelineOverlay(this.withPermissionSelection(detail)))
    );
  }

  async readThreadMetadata(threadId: string): Promise<MobileThreadDetail> {
    await this.ensureReady();
    const detail = await this.applySessionTimelineSupplement(
      await this.reconcileThreadExecutionStatus(await this.client.readThreadMetadata(threadId))
    );
    return this.withTimelineGeneration(
      this.withThreadRuntimeIdentity(this.withPermissionSelection(detail))
    );
  }

  private timelineThreadWithinBudget(detail: MobileThreadDetail): MobileThreadDetail {
    if (!detail.timeline.length) {
      return timelineThreadWithCompleteness(detail);
    }
    const contentRefs = new Map<string, string>();
    const contentRefForItem = (item: MobileTimelineItem): string | undefined => {
      if (!item.turnId) {
        return undefined;
      }
      const key = `${item.turnId}\u0000${item.id}`;
      const existing = contentRefs.get(key);
      if (existing) {
        return existing;
      }
      const contentRef = this.registerAppServerItemContentSource(
        detail.id,
        item.turnId,
        item.id,
        `${item.generation ?? detail.generation ?? 0}:${item.snapshotSequence ?? detail.snapshotSequence ?? 0}`,
        item.text
      );
      contentRefs.set(key, contentRef);
      return contentRef;
    };
    let itemTextBudget = Math.min(
      TIMELINE_ITEM_INLINE_BYTE_BUDGET,
      Math.max(256, Math.floor((TIMELINE_RESPONSE_BYTE_BUDGET - 128 * 1024) / detail.timeline.length))
    );
    let result = timelineThreadWithCompleteness(detail);
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const timeline = detail.timeline.map((item) => {
        const contentRef = item.completeness?.contentRef ??
          (utf8ByteLength(item.text) > itemTextBudget ? contentRefForItem(item) : undefined);
        const bounded = boundedTimelineText(item.text, {
          maxBytes: itemTextBudget,
          ...(contentRef ? { contentRef } : {})
        });
        return {
          ...item,
          ...(attempt > 0 && item.arguments ? { arguments: undefined } : {}),
          text: bounded.text,
          ...(bounded.completeness.status === "complete"
            ? item.completeness
              ? { completeness: item.completeness }
              : {}
            : { completeness: bounded.completeness })
        };
      });
      result = timelineThreadWithCompleteness({ ...detail, timeline });
      if (utf8ByteLength(JSON.stringify(result)) <= TIMELINE_RESPONSE_BYTE_BUDGET) {
        return result;
      }
      itemTextBudget = Math.max(0, Math.floor(itemTextBudget * 0.7));
    }
    result = timelineThreadWithCompleteness({
      ...detail,
      timeline: detail.timeline.map((item) => compactTimelineItemForHardBudget(item, contentRefForItem(item)))
    });
    if (utf8ByteLength(JSON.stringify(result)) <= TIMELINE_RESPONSE_BYTE_BUDGET) {
      return result;
    }
    throw new RangeError("Timeline thread response exceeds hard payload budget");
  }

  async readThreadSummary(threadId: string): Promise<MobileThreadSummary> {
    await this.ensureReady();
    const summary = await this.reconcileThreadExecutionStatus(await this.client.readThreadSummary(threadId));
    return this.withTimelineSummaryVersion(
      threadId,
      this.withThreadRuntimeIdentity(this.withPermissionSelection(summary))
    );
  }

  async readThreadMaterialization(threadId: string): Promise<ThreadMaterializationState> {
    await this.ensureReady();
    try {
      return await this.client.readLatestThreadTurnState(threadId)
        ? "materialized"
        : "unmaterialized";
    } catch {
      return "unknown";
    }
  }

  private async reconcileThreadExecutionStatus<T extends MobileThreadSummary>(thread: T): Promise<T> {
    if (thread.status !== "active") {
      return thread;
    }
    let latestTurn: Awaited<ReturnType<CodexAppServerClient["readLatestThreadTurnState"]>>;
    try {
      latestTurn = await this.client.readLatestThreadTurnState(thread.id);
    } catch {
      return thread;
    }
    if (!latestTurn) {
      return thread;
    }
    if (latestTurn.status === "inProgress") {
      if (!this.isTerminalTurn(thread.id, latestTurn.turnId)) {
        this.activeTurnIds.set(thread.id, latestTurn.turnId);
      }
      return thread;
    }
    const activeTurnId = this.activeTurnIds.get(thread.id) ?? null;
    if (activeTurnId && activeTurnId !== latestTurn.turnId) {
      return thread;
    }
    this.markTerminalTurn(thread.id, latestTurn.turnId);
    if (activeTurnId === latestTurn.turnId) {
      this.activeTurnIds.delete(thread.id);
    }
    return { ...thread, status: "idle" };
  }

  private async readSessionTimelineSupplement(
    threadId: string,
    allowedTurnIds: ReadonlySet<string>,
    options: { includeContextUsage?: boolean } = {}
  ): Promise<{ records: SessionTimelineRecord[]; contextUsage?: MobileThreadDetail["contextUsage"] } | null> {
    try {
      const sourceRolloutPath = await this.client.getConversationRolloutPath(threadId);
      if (!sourceRolloutPath) {
        return null;
      }
      const rolloutPath = await this.timelinePathPolicy.assertPathAllowed(sourceRolloutPath);
      const metadata = await stat(rolloutPath);
      if (!metadata.isFile()) {
        return null;
      }
      const turnIds = [...allowedTurnIds];
      const { lines, budgetExhausted } = await readBoundedMatchingSessionLines(rolloutPath, metadata.size, {
        maxSourceBytes: SESSION_TIMELINE_SUPPLEMENT_SOURCE_LIMIT,
        maxMatchedBytes: SESSION_TIMELINE_SUPPLEMENT_MATCHED_TEXT_LIMIT,
        maxLines: SESSION_TIMELINE_SUPPLEMENT_SCAN_LINE_LIMIT,
        maxElapsedMs: SESSION_TIMELINE_SUPPLEMENT_SCAN_TIME_MS,
        matches: (line) =>
          (line.includes("response_item") && turnIds.some((turnId) => line.includes(turnId))) ||
          (Boolean(options.includeContextUsage) && line.includes("token_count"))
      });
      if (budgetExhausted && !lines.length) {
        return null;
      }
      const supplement = scanSessionTimelineSupplement(lines, {
        allowedTurnIds,
        maxScanLines: SESSION_TIMELINE_SUPPLEMENT_SCAN_LINE_LIMIT,
        maxScanBytes: SESSION_TIMELINE_SUPPLEMENT_MATCHED_TEXT_LIMIT,
        maxSupplementRecords: SESSION_TIMELINE_SUPPLEMENT_RECORD_LIMIT,
        maxElapsedMs: SESSION_TIMELINE_SUPPLEMENT_SCAN_TIME_MS,
        contentRefFactory: (locator) =>
          this.registerSessionTimelineContentSource(threadId, rolloutPath, metadata, locator)
      });
      const contextUsage = options.includeContextUsage
        ? latestSessionContextUsageFromLines(lines, { maxTailLines: SESSION_CONTEXT_USAGE_TAIL_LINES })
        : null;
      return {
        records: supplement.records,
        ...(contextUsage ? { contextUsage } : {})
      };
    } catch {
      return null;
    }
  }

  private async applySessionTimelineSupplement(detail: MobileThreadDetail): Promise<MobileThreadDetail> {
    const allowedTurnIds = timelineTurnIdSet(detail.timeline);
    const supplement = await this.readSessionTimelineSupplement(detail.id, allowedTurnIds, {
      includeContextUsage: true
    });
    if (!supplement) {
      return detail;
    }
    return {
      ...detail,
      ...(supplement.contextUsage ? { contextUsage: supplement.contextUsage } : {}),
      timeline: allowedTurnIds.size
        ? mergeSessionTimelineRecords(detail.timeline, supplement.records)
        : detail.timeline
    };
  }

  private async applySessionTimelinePageSupplement(
    threadId: string,
    page: MobileTimelinePage
  ): Promise<MobileTimelinePage> {
    const allowedTurnIds = timelineTurnIdSet(page.items);
    if (!allowedTurnIds.size) {
      return page;
    }
    const supplement = await this.readSessionTimelineSupplement(threadId, allowedTurnIds);
    if (!supplement) {
      return page;
    }
    return {
      ...page,
      items: mergeSessionTimelineRecords(page.items, supplement.records)
    };
  }

  private applyTimelineOverlay(detail: MobileThreadDetail): MobileThreadDetail {
    this.pruneTimelineOverlayWindow(detail.id, detail.timeline, detail.turnManifest);
    return {
      ...detail,
      timeline: this.applyTimelineOverlayItems(
        detail.timeline,
        this.timelineOverlays.get(detail.id),
        this.currentTimelineGeneration(detail.id)
      )
    };
  }

  private pruneTimelineOverlayWindow(
    threadId: string,
    timeline: MobileTimelineItem[],
    turnManifest: AuthoritativeTurnManifest | undefined
  ): void {
    const overlay = this.timelineOverlays.get(threadId);
    if (!overlay?.size) {
      return;
    }
    const generation = this.currentTimelineGeneration(threadId);
    const materializedIds = materializedTimelineOverlayIds(timeline, overlay, generation);
    const historyById = new Map(timeline.map((item) => [item.id, item]));
    const authoritativeTurnIds = turnManifest
      ? new Set(turnManifest.turnIds)
      : null;

    for (const [id, entry] of overlay) {
      const historyItem = historyById.get(id);
      const materializedDirectly = historyItem && !shouldUseOverlayTimelineItem(historyItem, entry.item);
      const leftAuthoritativeWindow = Boolean(
        entry.turnId &&
        authoritativeTurnIds &&
        this.isTerminalTurn(threadId, entry.turnId) &&
        !authoritativeTurnIds.has(entry.turnId)
      );
      if (
        entry.generation !== generation ||
        materializedIds.has(id) ||
        materializedDirectly ||
        leftAuthoritativeWindow
      ) {
        overlay.delete(id);
      }
    }
    if (!overlay.size) {
      this.timelineOverlays.delete(threadId);
    }
  }

  private applyTimelineOverlayItems(
    items: MobileTimelineItem[],
    overlay: ReadonlyMap<string, TimelineOverlayEntry> | undefined,
    generation: number
  ): MobileTimelineItem[] {
    if (!overlay?.size) {
      return items;
    }

    const overlayById = new Map(overlay);
    const materializedOverlayIds = materializedTimelineOverlayIds(items, overlayById, generation);
    const usedOverlayIds = new Set(materializedOverlayIds);
    const aliasById = agentAliasesById(items, overlayById, materializedOverlayIds, generation);
    let timeline = items.map((item) => {
      const directOverlayEntry = overlayById.get(item.id);
      const overlayEntry = directOverlayEntry ?? null;
      if (!overlayEntry) {
        const alias = aliasById.get(item.id);
        if (!alias) {
          return item;
        }
        const counterpartId = item.id === alias.canonicalId ? alias.provisionalId : alias.canonicalId;
        const counterpart = overlayById.get(counterpartId);
        if (!counterpart) {
          return item;
        }
        usedOverlayIds.add(counterpartId);
        return item.id === alias.canonicalId
          ? item
          : mergeTimelineTurnMeta(item, mergeAgentAliasItems(item, counterpart.item));
      }

      usedOverlayIds.add(item.id);
      return shouldUseOverlayTimelineItem(item, overlayEntry.item)
        ? mergeTimelineTurnMeta(item, overlayEntry.item)
        : item;
    });

    for (const [id, entry] of overlayById) {
      if (!usedOverlayIds.has(id) && shouldExposeOverlayTimelineItem(entry.item)) {
        timeline = insertOverlayTimelineItem(timeline, entry.item);
      }
    }

    return timeline;
  }

  private withTimelineGeneration(detail: MobileThreadDetail): MobileThreadDetail {
    const generation = this.currentTimelineGeneration(detail.id);
    const snapshotSequence = this.browserEventSequence;
    const historyStamp = { bootId: this.browserBootId, generation };
    const activeTurnId = this.activeTurnIds.get(detail.id);
    const manifestTurnIds = detail.turnManifest?.turnIds ?? [];
    const turnManifest = detail.turnManifest
      ? {
          ...detail.turnManifest,
          turnIds:
            activeTurnId && !manifestTurnIds.includes(activeTurnId)
              ? [...manifestTurnIds, activeTurnId]
              : manifestTurnIds,
          historyStamp,
          pageWatermark: snapshotSequence
        }
      : undefined;
    return {
      ...detail,
      bootId: this.browserBootId,
      generation,
      historyStamp,
      snapshotSequence,
      activeTurnId: activeTurnId ?? null,
      ...(turnManifest ? { turnManifest } : {}),
      timeline: detail.timeline.map((item) => ({
        ...item,
        bootId: this.browserBootId,
        generation,
        historyStamp,
        snapshotSequence,
        baselineWatermark: snapshotSequence
      }))
    };
  }

  private withTimelineSummaryVersion(threadId: string, summary: MobileThreadSummary): MobileThreadSummary {
    return {
      ...summary,
      bootId: this.browserBootId,
      generation: this.currentTimelineGeneration(threadId),
      historyStamp: { bootId: this.browserBootId, generation: this.currentTimelineGeneration(threadId) },
      snapshotSequence: this.browserEventSequence,
      activeTurnId: this.activeTurnIds.get(threadId) ?? null
    };
  }

  async resumeThread(
    threadId: string,
    overrides: ThreadRuntimeOverrides = {}
  ): Promise<MobileThreadDetail> {
    await this.ensureReady();
    const detail = await this.applySessionTimelineSupplement(
      await this.client.resumeThread(threadId, overrides)
    );
    this.recordThreadRuntimeIdentity(threadId, detail);
    this.setConfiguredPermissionSelection(threadId, completePermissionSelection(overrides));
    return this.timelineThreadWithinBudget(
      this.withTimelineGeneration(this.applyTimelineOverlay(this.withPermissionSelection(detail)))
    );
  }

  async startThread(input: StartThreadInput): Promise<MobileThreadSummary> {
    await this.ensureReady();
    const thread = await this.client.startThread(input);
    this.recordThreadRuntimeIdentity(thread.id, thread);
    const selection = completePermissionSelection(input) ?? completePermissionSelection({
      permissions: thread.activePermissionProfile?.id ??
        (thread.activePermissionProfile === null ? null : undefined),
      approvalPolicy: thread.approvalPolicy,
      approvalsReviewer: thread.approvalsReviewer
    });
    this.setConfiguredPermissionSelection(thread.id, selection);
    return this.withPermissionSelection(thread);
  }

  async readCurrentModelProvider(): Promise<string> {
    const provider = (await this.readModelDefaults()).modelProvider?.trim();
    if (!provider) {
      throw new CurrentModelProviderError();
    }
    return provider;
  }

  async assertThreadIdle(threadId: string): Promise<MobileThreadSummary> {
    const summary = await this.readThreadSummary(threadId);
    if (summary.status !== "idle") {
      throw new ThreadRuntimeBusyError(threadId);
    }
    return summary;
  }

  async reloadThreadRuntime(input: ThreadRuntimeReloadInput): Promise<MobileThreadDetail> {
    await this.assertThreadIdle(input.threadId);
    await this.unsubscribeThread(input.threadId);
    const overrides: ThreadRuntimeOverrides = {
      model: input.model,
      modelProvider: input.modelProvider,
      ...(input.modelContextWindow !== undefined
        ? { modelContextWindow: input.modelContextWindow }
        : {}),
      ...(input.reasoningEffort !== undefined
        ? { reasoningEffort: input.reasoningEffort }
        : {}),
      ...(input.permissions !== undefined ? { permissions: input.permissions } : {}),
      ...(input.approvalPolicy !== undefined ? { approvalPolicy: input.approvalPolicy } : {}),
      ...(input.approvalsReviewer !== undefined
        ? { approvalsReviewer: input.approvalsReviewer }
        : {})
    };
    const detail = await this.resumeThread(input.threadId, overrides);
    verifyThreadRuntime(detail, input);
    return detail;
  }

  async startTurn(input: StartTurnInput): Promise<{ turnId: string }> {
    await this.ensureReady();
    const result = await this.client.startTurn(input);
    if (
      input.permissions !== undefined ||
      input.approvalPolicy !== undefined ||
      input.approvalsReviewer !== undefined
    ) {
      this.mergeConfiguredPermissionSelection(input.threadId, input);
    }
    if (!this.isTerminalTurn(input.threadId, result.turnId)) {
      this.activeTurnIds.set(input.threadId, result.turnId);
    }
    return result;
  }

  async forkThread(threadId: string): Promise<MobileThreadDetail> {
    await this.ensureReady();
    const detail = await this.client.forkThread(threadId);
    this.timelineOverlays.delete(detail.id);
    this.deletedTurnIdsByThread.delete(detail.id);
    this.resetTimelineGeneration(detail.id);
    return this.withTimelineGeneration(this.applyTimelineOverlay(detail));
  }

  async rollbackThread(
    threadId: string,
    inputOrNumTurns: RollbackThreadInput | number,
    legacyOptions: { expectedDeletedTurnIds?: string[] } = {}
  ): Promise<MobileThreadDetail> {
    const input = typeof inputOrNumTurns === "number"
      ? await this.legacyRollbackInput(threadId, inputOrNumTurns, legacyOptions)
      : inputOrNumTurns;
    const operationKey = `${this.browserBootId}\u0000${threadId}\u0000${input.operationId}`;
    const fingerprint = JSON.stringify({
      targetTurnId: input.targetTurnId,
      historyStamp: input.historyStamp,
      expectedTailTurnIds: input.expectedTailTurnIds
    });
    const existing = this.rollbackOperations.get(operationKey);
    if (existing) {
      if (existing.fingerprint !== fingerprint) {
        throw new RollbackConflictError([], "同一 rollback operationId 的前置条件不一致");
      }
      if (existing.hasError && !isTerminalRollbackOperationError(existing.error)) {
        throw new RollbackUnresolvedError();
      }
      return existing.promise;
    }

    const promise = this.withThreadMutationLock(threadId, async () => {
      await this.ensureReady();
      if (input.historyStamp.bootId !== this.browserBootId) {
        throw new RollbackUnresolvedError();
      }
      const currentGeneration = this.currentTimelineGeneration(threadId);
      if (input.historyStamp.generation !== currentGeneration) {
        throw new RollbackConflictError([]);
      }

      const before = await this.readThread(threadId);
      const authoritativeTurnIds = before.turnManifest?.turnIds ?? [];
      const targetIndex = authoritativeTurnIds.indexOf(input.targetTurnId);
      const actualTailTurnIds = targetIndex >= 0 ? authoritativeTurnIds.slice(targetIndex) : [];
      if (
        targetIndex < 0 ||
        !sameStringArray(actualTailTurnIds, input.expectedTailTurnIds) ||
        input.expectedTailTurnIds[0] !== input.targetTurnId
      ) {
        throw new RollbackConflictError(actualTailTurnIds);
      }

      let detail: MobileThreadDetail;
      try {
        detail = await this.client.rollbackThread(threadId, actualTailTurnIds.length);
      } catch (error) {
        if (error instanceof TimelineRepairRequiredError && error.authoritativeThread) {
          const transition = { previous: before.timeline, next: error.authoritativeThread.timeline };
          this.markDeletedTurns(threadId, actualTailTurnIds, transition);
          this.clearTimelineOverlayTurns(threadId, actualTailTurnIds);
          if (actualTailTurnIds.includes(this.activeTurnIds.get(threadId) ?? "")) {
            this.activeTurnIds.delete(threadId);
          }
        }
        throw error;
      }
      const remainingTurnIds = new Set(detail.turnManifest?.turnIds ?? []);
      if (actualTailTurnIds.some((turnId) => remainingTurnIds.has(turnId))) {
        throw new RollbackConflictError(
          [...remainingTurnIds],
          `rollback response 与请求删除边界不一致：expected=${actualTailTurnIds.join(",")} actual=${[...remainingTurnIds].join(",")}`
        );
      }

      const transition = { previous: before.timeline, next: detail.timeline };
      this.markDeletedTurns(threadId, actualTailTurnIds, transition);
      this.clearTimelineOverlayTurns(threadId, actualTailTurnIds);
      if (actualTailTurnIds.includes(this.activeTurnIds.get(threadId) ?? "")) {
        this.activeTurnIds.delete(threadId);
      }
      return this.timelineThreadWithinBudget(
        this.withTimelineGeneration(this.applyTimelineOverlay(detail))
      );
    });
    const operation: RollbackOperationEntry = {
      fingerprint,
      promise,
      hasError: false
    };
    void promise.then(
      undefined,
      (error) => {
        operation.hasError = true;
        operation.error = error;
      }
    );
    this.rollbackOperations.set(operationKey, operation);
    this.trimRollbackOperations();
    return promise;
  }

  private async legacyRollbackInput(
    threadId: string,
    numTurns: number,
    options: { expectedDeletedTurnIds?: string[] }
  ): Promise<RollbackThreadInput> {
    const current = await this.readThread(threadId);
    const turnIds = current.turnManifest?.turnIds ?? [];
    const expectedTailTurnIds = options.expectedDeletedTurnIds?.length
      ? options.expectedDeletedTurnIds
      : turnIds.slice(Math.max(0, turnIds.length - numTurns));
    const targetTurnId = expectedTailTurnIds[0] ?? turnIds.at(-1);
    if (!targetTurnId) {
      throw new RollbackConflictError([]);
    }
    return {
      operationId: `legacy-${targetTurnId}-${this.currentTimelineGeneration(threadId)}-${Date.now()}`,
      targetTurnId,
      historyStamp: current.historyStamp ?? {
        bootId: this.browserBootId,
        generation: this.currentTimelineGeneration(threadId)
      },
      expectedTailTurnIds
    };
  }

  private async withThreadMutationLock<T>(threadId: string, action: () => Promise<T>): Promise<T> {
    const previous = this.threadMutationLocks.get(threadId) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.threadMutationLocks.set(threadId, current);
    await previous;
    try {
      return await action();
    } finally {
      release();
      if (this.threadMutationLocks.get(threadId) === current) {
        this.threadMutationLocks.delete(threadId);
      }
    }
  }

  private trimRollbackOperations(): void {
    while (this.rollbackOperations.size > 200) {
      const oldest = this.rollbackOperations.keys().next().value as string | undefined;
      if (!oldest) break;
      this.rollbackOperations.delete(oldest);
    }
  }

  async setThreadName(threadId: string, name: string): Promise<MobileThreadDetail> {
    await this.ensureReady();
    await this.client.setThreadName(threadId, name);
    return this.client.readThreadMetadata(threadId);
  }

  async archiveThread(threadId: string): Promise<void> {
    await this.ensureReady();
    await this.client.archiveThread(threadId);
  }

  async unarchiveThread(threadId: string): Promise<MobileThreadDetail> {
    await this.ensureReady();
    return this.client.unarchiveThread(threadId);
  }

  async unsubscribeThread(threadId: string): Promise<MobileThreadUnsubscribeResult> {
    await this.ensureReady();
    return this.client.unsubscribeThread(threadId);
  }

  async runThreadShellCommand(threadId: string, command: string): Promise<void> {
    await this.ensureReady();
    await this.client.runThreadShellCommand(threadId, command);
  }

  async incrementThreadElicitation(threadId: string): Promise<MobileThreadElicitationResult> {
    await this.ensureReady();
    return this.client.incrementThreadElicitation(threadId);
  }

  async decrementThreadElicitation(threadId: string): Promise<MobileThreadElicitationResult> {
    await this.ensureReady();
    return this.client.decrementThreadElicitation(threadId);
  }

  async deleteThread(threadId: string): Promise<void> {
    await this.ensureReady();
    await this.client.deleteThread(threadId);
    this.runtimeIdentitiesByThread.delete(threadId);
    this.configuredPermissionSelectionsByThread.delete(threadId);
    this.runtimePermissionObservationsByThread.delete(threadId);
  }


  private async withLiveThreadRetry<T>(threadId: string, operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (!isMissingLiveThreadError(error)) {
        throw error;
      }
      await this.resumeThread(threadId);
      return operation();
    }
  }

  async updateThreadSettings(input: UpdateThreadSettingsInput): Promise<void> {
    await this.ensureReady();
    await this.withLiveThreadRetry(input.threadId, () => this.client.updateThreadSettings(input));
    const previousIdentity = this.runtimeIdentitiesByThread.get(input.threadId);
    if (previousIdentity) {
      this.recordThreadRuntimeIdentity(input.threadId, {
        model: input.model ?? previousIdentity.model,
        modelProvider: previousIdentity.modelProvider,
        reasoningEffort: input.reasoningEffort ?? previousIdentity.reasoningEffort
      });
    }
    const hasPermissionUpdate =
      input.permissions !== undefined ||
      input.approvalPolicy !== undefined ||
      input.approvalsReviewer !== undefined;
    if (hasPermissionUpdate) {
      const selection = this.mergeConfiguredPermissionSelection(input.threadId, input);
      if (selection) {
        this.broadcastConfiguredPermissionSelection(input.threadId, selection);
      }
    }
  }

  async listCollaborationModes(): Promise<MobileCollaborationModeView[]> {
    await this.ensureReady();
    return this.client.listCollaborationModes();
  }

  async updateThreadMetadata(input: MobileThreadMetadataUpdateInput): Promise<MobileThreadDetail> {
    await this.ensureReady();
    return this.client.updateThreadMetadata(input);
  }

  async injectThreadItems(threadId: string, items: MobileJsonValue[]): Promise<void> {
    await this.ensureReady();
    await this.client.injectThreadItems(threadId, items);
  }

  async approveGuardianDeniedAction(threadId: string, event: MobileJsonValue): Promise<void> {
    await this.ensureReady();
    await this.client.approveGuardianDeniedAction(threadId, event);
  }

  async setThreadGoal(input: SetThreadGoalInput): Promise<MobileThreadGoalView> {
    await this.ensureReady();
    return this.client.setThreadGoal(input);
  }

  async clearThreadGoal(threadId: string): Promise<void> {
    await this.ensureReady();
    await this.client.clearThreadGoal(threadId);
  }

  async compactThread(threadId: string): Promise<void> {
    await this.ensureReady();
    await this.client.compactThread(threadId);
  }

  async startReview(threadId: string): Promise<{ turnId: string; reviewThreadId: string }> {
    await this.ensureReady();
    return this.client.startReview(threadId);
  }

  async setThreadMemoryMode(threadId: string, mode: ThreadMemoryMode): Promise<void> {
    await this.ensureReady();
    await this.client.setThreadMemoryMode(threadId, mode);
  }

  async resetMemory(): Promise<void> {
    await this.ensureReady();
    await this.client.resetMemory();
  }

  async mockExperimentalMethod(value?: string | null): Promise<MobileMockExperimentalMethodResult> {
    await this.ensureReady();
    return this.client.mockExperimentalMethod(value);
  }

  async loginWithChatGpt(): Promise<MobileAccountLoginView> {
    await this.ensureReady();
    return this.client.loginWithChatGpt();
  }

  async loginWithApiKey(apiKey: string): Promise<MobileAccountLoginView> {
    await this.ensureReady();
    return this.client.loginWithApiKey(apiKey);
  }

  async cancelAccountLogin(loginId: string): Promise<MobileAccountLoginCancelView> {
    await this.ensureReady();
    return this.client.cancelAccountLogin(loginId);
  }

  async logoutAccount(): Promise<void> {
    await this.ensureReady();
    await this.client.logoutAccount();
  }

  async getAccountTokenUsage(): Promise<MobileAccountTokenUsageView> {
    await this.ensureReady();
    return this.client.getAccountTokenUsage();
  }

  async getAuthStatus(): Promise<MobileAuthStatusView> {
    await this.ensureReady();
    return this.client.getAuthStatus();
  }

  async consumeRateLimitResetCredit(idempotencyKey: string): Promise<MobileRateLimitResetCreditConsumeResult> {
    await this.ensureReady();
    return this.client.consumeRateLimitResetCredit(idempotencyKey);
  }

  async sendAddCreditsNudgeEmail(creditType: "credits" | "usage_limit"): Promise<MobileAddCreditsNudgeResultView> {
    await this.ensureReady();
    return this.client.sendAddCreditsNudgeEmail(creditType);
  }

  async readPlugin(input: PluginLookupInput): Promise<MobilePluginDetailView> {
    await this.ensureReady();
    return this.client.readPlugin(input);
  }

  async installPlugin(input: PluginLookupInput): Promise<MobilePluginInstallResultView> {
    await this.ensureReady();
    return this.client.installPlugin(input);
  }

  async uninstallPlugin(pluginId: string): Promise<void> {
    await this.ensureReady();
    return this.client.uninstallPlugin(pluginId);
  }

  async listApps(input: ListAppsInput = {}): Promise<MobileAppPage> {
    await this.ensureReady();
    return this.client.listApps(input);
  }

  async getConfigRequirements(): Promise<MobileConfigRequirementsView | null> {
    await this.ensureReady();
    return this.client.getConfigRequirements();
  }

  async readConfig(): Promise<ConfigReadResponse> {
    await this.ensureReady();
    return this.client.readConfig();
  }

  async writeConfigValue(
    keyPath: string,
    value: MobileConfigEditInput["value"]
  ): Promise<MobileConfigWriteResultView> {
    await this.ensureReady();
    return this.client.writeConfigValue(keyPath, value);
  }

  async writeConfigBatch(edits: MobileConfigEditInput[]): Promise<MobileConfigWriteResultView> {
    await this.ensureReady();
    return this.client.writeConfigBatch(edits);
  }

  async getWindowsSandboxReadiness(): Promise<MobileWindowsSandboxReadinessView> {
    await this.ensureReady();
    return this.client.getWindowsSandboxReadiness();
  }

  async startWindowsSandboxSetup(input: WindowsSandboxSetupInput): Promise<MobileWindowsSandboxSetupResultView> {
    await this.ensureReady();
    return this.client.startWindowsSandboxSetup(input);
  }

  async readPluginSkill(input: PluginSkillReadInput): Promise<MobilePluginSkillContentView> {
    await this.ensureReady();
    return this.client.readPluginSkill(input);
  }

  async setSkillsExtraRoots(extraRoots: string[]): Promise<void> {
    await this.ensureReady();
    return this.client.setSkillsExtraRoots(extraRoots);
  }

  async writeSkillConfig(input: WriteSkillConfigInput): Promise<MobileSkillConfigWriteResultView> {
    await this.ensureReady();
    return this.client.writeSkillConfig(input);
  }

  async listSkills(input: ListSkillsInput = {}): Promise<MobileSkillListView> {
    await this.ensureReady();
    return this.client.listSkills(input);
  }

  async setExperimentalFeatureEnablement(name: string, enabled: boolean): Promise<void> {
    await this.ensureReady();
    await this.client.setExperimentalFeatureEnablement(name, enabled);
  }

  async refreshMcpServer(_serverName: string): Promise<void> {
    await this.ensureReady();
    return this.client.refreshMcpServer();
  }

  async loginMcpServer(serverName: string): Promise<MobileMcpLoginView> {
    await this.ensureReady();
    return this.client.loginMcpServer(serverName);
  }

  async readMcpResource(input: ReadMcpResourceInput): Promise<MobileMcpResourceReadView> {
    await this.ensureReady();
    return this.client.readMcpResource(input);
  }

  async enableRemoteControl(): Promise<MobileRemoteControlStatusView> {
    await this.ensureReady();
    return this.client.enableRemoteControl();
  }

  async disableRemoteControl(): Promise<MobileRemoteControlStatusView> {
    await this.ensureReady();
    return this.client.disableRemoteControl();
  }

  async startRemoteControlPairing(): Promise<MobileRemoteControlPairingView> {
    await this.ensureReady();
    return this.client.startRemoteControlPairing();
  }

  async readRemoteControlPairingStatus(input: {
    pairingCode?: string | null;
    manualPairingCode?: string | null;
  }): Promise<MobileRemoteControlPairingStatusView> {
    await this.ensureReady();
    return this.client.readRemoteControlPairingStatus(input);
  }

  async revokeRemoteControlClient(environmentId: string, clientId: string): Promise<void> {
    await this.ensureReady();
    return this.client.revokeRemoteControlClient(environmentId, clientId);
  }

  async interruptTurn(threadId: string, turnId: string): Promise<void> {
    await this.ensureReady();
    return this.client.interruptTurn(threadId, turnId);
  }

  async steerTurn(input: { threadId: string; expectedTurnId: string; text: string }): Promise<{ turnId: string }> {
    await this.ensureReady();
    return this.client.steerTurn(input);
  }

  async readDirectory(path: string): Promise<MobileFileEntry[]> {
    await this.ensureReady();
    return this.client.readDirectory(path);
  }

  async readFile(path: string): Promise<MobileFileContent> {
    await this.ensureReady();
    return this.client.readFile(path);
  }

  async writeFile(path: string, text: string): Promise<void> {
    await this.ensureReady();
    return this.client.writeFile(path, text);
  }

  async createDirectory(path: string): Promise<void> {
    await this.ensureReady();
    return this.client.createDirectory(path);
  }

  async removePath(path: string): Promise<void> {
    await this.ensureReady();
    return this.client.removePath(path);
  }

  async copyPath(sourcePath: string, destinationPath: string): Promise<void> {
    await this.ensureReady();
    return this.client.copyPath(sourcePath, destinationPath);
  }

  async getMetadata(path: string): Promise<MobileFileMetadata> {
    await this.ensureReady();
    return this.client.getMetadata(path);
  }

  async watchPath(path: string): Promise<{ watchId: string; path: string }> {
    await this.ensureReady();
    const watchId = `mobile-watch-${++this.fsWatchCounter}`;
    return this.client.watchPath(watchId, path);
  }

  async unwatchPath(watchId: string): Promise<void> {
    await this.ensureReady();
    await this.client.unwatchPath(watchId);
  }

  async searchFiles(input: SearchFilesInput): Promise<MobileFileSearchResult[]> {
    await this.ensureReady();
    return this.client.searchFiles(input);
  }

  async startFileSearchSession(roots: string[]): Promise<MobileFileSearchSessionView> {
    await this.ensureReady();
    const sessionId = `mobile-file-search-${++this.fileSearchSessionCounter}`;
    await this.client.startFileSearchSession({ sessionId, roots });
    return { sessionId };
  }

  async updateFileSearchSession(sessionId: string, query: string): Promise<void> {
    await this.ensureReady();
    await this.client.updateFileSearchSession(sessionId, query);
  }

  async stopFileSearchSession(sessionId: string): Promise<void> {
    await this.ensureReady();
    await this.client.stopFileSearchSession(sessionId);
  }

  async execCommand(input: ExecCommandInput): Promise<MobileCommandResult> {
    await this.ensureReady();
    return this.client.execCommand(input);
  }

  async startCommandExecSession(input: Omit<StartCommandExecInput, "processId">): Promise<MobileTerminalSession> {
    await this.ensureReady();
    const processId = `mobile-command-${++this.commandExecCounter}`;
    const session: MobileTerminalSession = {
      processHandle: processId,
      cwd: input.cwd,
      command: input.command,
      output: "",
      exitCode: null,
      running: true
    };
    this.commandExecSessions.set(processId, session);
    this.client
      .startCommandExec({ ...input, processId })
      .then((result) => {
        const current = this.commandExecSessions.get(processId);
        if (!current) {
          return;
        }
        this.commandExecSessions.set(processId, {
          ...current,
          output: `${current.output}${result.stdout}${result.stderr}`,
          exitCode: result.exitCode,
          running: false
        });
      })
      .catch((error) => {
        const current = this.commandExecSessions.get(processId);
        if (!current) {
          return;
        }
        this.commandExecSessions.set(processId, {
          ...current,
          output: `${current.output}${error instanceof Error ? error.message : "command exec 失败"}`,
          exitCode: 1,
          running: false
        });
      });
    return this.commandExecSessions.get(processId) ?? session;
  }

  async writeCommandExecStdin(processId: string, text: string): Promise<void> {
    await this.ensureReady();
    await this.client.writeCommandExec(processId, text);
  }

  async resizeCommandExecSession(processId: string, cols: number, rows: number): Promise<void> {
    await this.ensureReady();
    await this.client.resizeCommandExec(processId, cols, rows);
  }

  async terminateCommandExecSession(processId: string): Promise<void> {
    await this.ensureReady();
    await this.client.terminateCommandExec(processId);
  }

  async readCommandExecSession(processId: string): Promise<MobileTerminalSession> {
    await this.ensureReady();
    const session = this.commandExecSessions.get(processId);
    if (!session) {
      throw new Error("找不到 command exec 会话");
    }
    return session;
  }

  async startProcessSession(input: Omit<StartProcessInput, "processHandle">): Promise<MobileTerminalSession> {
    await this.ensureReady();
    const processHandle = `mobile-process-${++this.processCounter}`;
    const session: MobileTerminalSession = {
      processHandle,
      cwd: input.cwd,
      command: input.command,
      output: "",
      exitCode: null,
      running: true
    };
    this.terminalSessions.set(processHandle, session);
    try {
      await this.client.startProcess({ ...input, processHandle });
    } catch (error) {
      this.terminalSessions.delete(processHandle);
      throw error;
    }
    return this.terminalSessions.get(processHandle) ?? session;
  }

  async writeProcessStdin(processHandle: string, text: string): Promise<void> {
    await this.ensureReady();
    await this.client.writeProcessStdin(processHandle, text);
  }

  async resizeProcessSession(processHandle: string, cols: number, rows: number): Promise<void> {
    await this.ensureReady();
    await this.client.resizeProcessPty(processHandle, cols, rows);
  }

  async killProcessSession(processHandle: string): Promise<void> {
    await this.ensureReady();
    await this.client.killProcess(processHandle);
  }

  async readProcessSession(processHandle: string): Promise<MobileTerminalSession> {
    await this.ensureReady();
    const session = this.terminalSessions.get(processHandle);
    if (!session) {
      throw new Error("找不到终端会话");
    }
    return session;
  }

  async listThreadBackgroundTerminals(input: ListThreadBackgroundTerminalsInput): Promise<MobileBackgroundTerminalPage> {
    await this.ensureReady();
    return this.client.listThreadBackgroundTerminals(input);
  }

  async terminateThreadBackgroundTerminal(
    threadId: string,
    processId: string
  ): Promise<MobileBackgroundTerminalTerminateResult> {
    await this.ensureReady();
    return this.client.terminateThreadBackgroundTerminal(threadId, processId);
  }

  async cleanThreadBackgroundTerminals(threadId: string): Promise<void> {
    await this.ensureReady();
    await this.client.cleanThreadBackgroundTerminals(threadId);
  }

  async readSettings(): Promise<MobileSettingsView> {
    await this.ensureReady();
    return this.client.readSettings();
  }

  async readModelDefaults(): Promise<MobileModelDefaultsView> {
    await this.ensureReady();
    return this.client.readModelDefaults();
  }

  async listThreadTurns(input: ListThreadTurnsInput): Promise<MobileTimelinePage> {
    await this.ensureReady();
    const upstreamPage = await this.applySessionTimelinePageSupplement(
      input.threadId,
      await this.client.listThreadTurns(input)
    );
    const generation = this.currentTimelineGeneration(input.threadId);
    const pageWatermark = this.browserEventSequence;
    this.pruneTimelineOverlayWindow(
      input.threadId,
      upstreamPage.items,
      upstreamPage.turnManifest
    );
    const overlaySnapshot = cloneTimelineOverlay(this.timelineOverlays.get(input.threadId));
    const page = {
      ...upstreamPage,
      items: this.applyTimelineOverlayItems(upstreamPage.items, overlaySnapshot, generation)
    };
    return this.timelinePageWithinBudget(
      input.threadId,
      this.withTimelinePageVersion(input.threadId, page, { generation, pageWatermark })
    );
  }

  async listThreadTurnItems(input: ListThreadTurnItemsInput): Promise<MobileTimelinePage> {
    await this.ensureReady();
    const page = await this.client.listThreadTurnItems(input);
    return this.timelinePageWithinBudget(
      input.threadId,
      this.withTimelinePageVersion(
        input.threadId,
        await this.applySessionTimelinePageSupplement(input.threadId, page)
      )
    );
  }

  private withTimelinePageVersion(
    threadId: string,
    page: MobileTimelinePage,
    version?: { generation: number; pageWatermark: number }
  ): MobileTimelinePage {
    const generation = version?.generation ?? this.currentTimelineGeneration(threadId);
    const pageWatermark = version?.pageWatermark ?? this.browserEventSequence;
    const historyStamp = { bootId: this.browserBootId, generation };
    const emptyWindowAnchor = this.emptyTimelineWindowAnchor(threadId, generation, page);
    const turnManifest = page.turnManifest
      ? { ...page.turnManifest, historyStamp, pageWatermark }
      : undefined;
    const windowStartAnchor = page.items[0]
      ? timelineWindowAnchor(historyStamp, page.items[0])
      : emptyWindowAnchor;
    const windowEndAnchor = page.items.at(-1)
      ? timelineWindowAnchor(historyStamp, page.items.at(-1)!)
      : emptyWindowAnchor;
    const preservedThrough = this.preservedTimelineAnchor(threadId, generation, page.items[0]);
    return {
      ...page,
      bootId: this.browserBootId,
      generation,
      historyStamp,
      pageWatermark,
      ...(turnManifest ? { turnManifest } : {}),
      ...(windowStartAnchor ? { windowStartAnchor } : {}),
      ...(windowEndAnchor ? { windowEndAnchor } : {}),
      ...(preservedThrough ? { preservedThrough } : {}),
      items: page.items.map((item) => ({
        ...item,
        bootId: this.browserBootId,
        generation,
        historyStamp,
        snapshotSequence: pageWatermark,
        baselineWatermark: pageWatermark
      }))
    };
  }

  private emptyTimelineWindowAnchor(
    threadId: string,
    generation: number,
    page: MobileTimelinePage
  ): string | undefined {
    const transition = this.timelineGenerationTransitions.get(threadId);
    if (
      page.items.length ||
      page.nextCursor !== null ||
      !transition ||
      transition.generation !== generation ||
      transition.nextTimeline.length
    ) {
      return undefined;
    }
    return timelineEmptyWindowAnchor({ bootId: this.browserBootId, generation });
  }

  private preservedTimelineAnchor(
    threadId: string,
    generation: number,
    firstPageItem: MobileTimelineItem | undefined
  ): string | undefined {
    const transition = this.timelineGenerationTransitions.get(threadId);
    if (!transition || transition.generation !== generation || !firstPageItem) {
      return undefined;
    }
    const matchingIndexes = transition.nextTimeline.flatMap((item, index) =>
      timelineItemIdentityMatches(item, firstPageItem) ? [index] : []
    );
    if (matchingIndexes.length !== 1) {
      return undefined;
    }
    const boundaryIndex = Math.min(matchingIndexes[0]!, transition.stablePrefix.length) - 1;
    const boundaryItem = transition.stablePrefix[boundaryIndex];
    return boundaryItem
      ? timelineWindowAnchor(transition.previousStamp, boundaryItem)
      : undefined;
  }

  private timelinePageWithinBudget(threadId: string, page: MobileTimelinePage): MobileTimelinePage {
    if (!page.items.length) {
      return timelinePageWithCompleteness(page);
    }
    const contentRefs = new Map<string, string>();
    const contentRefForItem = (item: MobileTimelineItem): string | undefined => {
      if (!item.turnId) {
        return undefined;
      }
      const key = `${item.turnId}\u0000${item.id}`;
      const existing = contentRefs.get(key);
      if (existing) {
        return existing;
      }
      const contentRef = this.registerAppServerItemContentSource(
        threadId,
        item.turnId,
        item.id,
        `${item.generation ?? 0}:${item.snapshotSequence ?? 0}`,
        item.text
      );
      contentRefs.set(key, contentRef);
      return contentRef;
    };
    let itemTextBudget = Math.min(
      TIMELINE_ITEM_INLINE_BYTE_BUDGET,
      Math.max(256, Math.floor((TIMELINE_PAGE_BYTE_BUDGET - 64 * 1024) / page.items.length))
    );
    let result = timelinePageWithCompleteness(page);
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const items = page.items.map((item) => {
        const contentRef = item.completeness?.contentRef ??
          (utf8ByteLength(item.text) > itemTextBudget ? contentRefForItem(item) : undefined);
        const bounded = boundedTimelineText(item.text, {
          maxBytes: itemTextBudget,
          ...(contentRef ? { contentRef } : {})
        });
        return {
          ...item,
          ...(attempt > 0 && item.arguments ? { arguments: undefined } : {}),
          text: bounded.text,
          ...(bounded.completeness.status === "complete"
            ? item.completeness
              ? { completeness: item.completeness }
              : {}
            : { completeness: bounded.completeness })
        };
      });
      result = timelinePageWithCompleteness({ ...page, items });
      if (utf8ByteLength(JSON.stringify(result)) <= TIMELINE_PAGE_BYTE_BUDGET) {
        return result;
      }
      itemTextBudget = Math.max(0, Math.floor(itemTextBudget * 0.7));
    }
    result = timelinePageWithCompleteness({
      ...page,
      items: page.items.map((item) => compactTimelineItemForHardBudget(item, contentRefForItem(item)))
    });
    if (utf8ByteLength(JSON.stringify(result)) <= TIMELINE_PAGE_BYTE_BUDGET) {
      return result;
    }
    throw new RangeError("Timeline page response exceeds hard payload budget");
  }

  async readTimelineContent(input: {
    threadId: string;
    contentRef: string;
    cursor?: string | null;
    maxBytes?: number;
  }): Promise<MobileTimelineContentChunk> {
    const source = this.timelineContentSources.get(input.contentRef);
    if (!source || source.threadId !== input.threadId) {
      return repairRequiredContentChunk(input.contentRef, "invalid-content-ref");
    }
    if (source.expiresAt < Date.now()) {
      this.deleteTimelineContentSource(input.contentRef);
      return repairRequiredContentChunk(input.contentRef, "invalid-content-ref");
    }

    let byteOffset = 0;
    let chunkBytes = clampTimelineContentChunkBytes(input.maxBytes);
    if (input.cursor) {
      const cursor = this.timelineContentCursors.get(input.cursor);
      if (
        !cursor ||
        cursor.contentRef !== input.contentRef
      ) {
        return repairRequiredContentChunk(input.contentRef, "invalid-content-ref");
      }
      byteOffset = cursor.byteOffset;
      chunkBytes = cursor.chunkBytes;
    }

    const resolved = await this.resolveTimelineContentSource(source);
    if (typeof resolved !== "string") {
      return repairRequiredContentChunk(input.contentRef, resolved.reason);
    }
    const currentSource = this.timelineContentSources.get(input.contentRef);
    if (currentSource !== source || source.expiresAt < Date.now()) {
      if (currentSource === source && source.expiresAt < Date.now()) {
        this.deleteTimelineContentSource(input.contentRef);
      }
      return repairRequiredContentChunk(input.contentRef, "invalid-content-ref");
    }
    const text = resolved;
    const effectiveSourceRevision = timelineContentSourceRevision(source);
    if (input.cursor) {
      const cursor = this.timelineContentCursors.get(input.cursor);
      if (!cursor || cursor.contentRef !== input.contentRef || cursor.sourceRevision !== effectiveSourceRevision) {
        return repairRequiredContentChunk(input.contentRef, "invalid-content-ref");
      }
    }

    const chunk = utf8SafeChunk(text, byteOffset, chunkBytes);
    const nextCursor =
      chunk.endOffset < chunk.totalBytes
        ? this.timelineContentCursor(
            input.contentRef,
            effectiveSourceRevision,
            chunk.endOffset,
            chunkBytes
          )
        : null;
    return {
      text: chunk.text,
      startOffset: chunk.startOffset,
      endOffset: chunk.endOffset,
      nextCursor,
      includedBytes: chunk.endOffset - chunk.startOffset,
      completeness: {
        status: nextCursor ? "partial" : "complete",
        ...(nextCursor ? { reason: "response-budget" as const } : {}),
        nextCursor,
        originalBytes: chunk.totalBytes,
        includedBytes: chunk.endOffset - chunk.startOffset,
        contentRef: input.contentRef,
        contentCursor: nextCursor
      }
    };
  }

  private registerSessionTimelineContentSource(
    threadId: string,
    rolloutPath: string,
    metadata: { size: number; mtimeMs: number },
    locator: SessionContentRefLocator
  ): string {
    if (!locator.callId) {
      return `tlc_unresolved_${locator.itemId}`;
    }
    const contentRef = `tlc_${randomUUID().replace(/-/g, "")}`;
    this.timelineContentSources.set(contentRef, {
      kind: "session",
      threadId,
      turnId: locator.turnId,
      itemId: locator.itemId,
      callId: locator.callId,
      sequence: locator.sequence,
      field: locator.field,
      rolloutPath,
      sourceRevision: `${metadata.size}:${metadata.mtimeMs}`,
      expiresAt: Date.now() + 15 * 60 * 1000
    });
    this.pruneTimelineContentSources();
    return contentRef;
  }

  private registerAppServerTimelineContentSource(
    content: TimelineEventContentLocator,
    identity: BrowserCodexEventEnvelope["event"]
  ): string | undefined {
    if (!content.turnId || !content.itemId) {
      return undefined;
    }
    return this.registerAppServerItemContentSource(
      content.threadId,
      content.turnId,
      content.itemId,
      `${identity.generation ?? 0}:${identity.revision ?? 0}`,
      content.originalKind === "item_updated" ? content.text : undefined
    );
  }

  private registerAppServerItemContentSource(
    threadId: string,
    turnId: string,
    itemId: string,
    sourceRevision: string,
    text?: string
  ): string {
    const contentRef = `tlc_${randomUUID().replace(/-/g, "")}`;
    this.timelineContentSources.set(contentRef, {
      kind: "app-server",
      threadId,
      turnId,
      itemId,
      field: "text",
      sourceRevision,
      contentDigest: typeof text === "string" ? timelineTextDigest(text) : null,
      expiresAt: Date.now() + 15 * 60 * 1000
    });
    this.pruneTimelineContentSources();
    return contentRef;
  }

  private pruneTimelineContentSources(now = Date.now()): void {
    for (const [contentRef, source] of this.timelineContentSources) {
      if (source.expiresAt < now) {
        this.deleteTimelineContentSource(contentRef);
      }
    }
    while (this.timelineContentSources.size > MAX_TIMELINE_CONTENT_SOURCES) {
      const oldest = this.timelineContentSources.keys().next().value;
      if (typeof oldest !== "string") break;
      this.deleteTimelineContentSource(oldest);
    }
  }

  private deleteTimelineContentSource(contentRef: string): void {
    this.timelineContentSources.delete(contentRef);
    for (const [cursor, state] of this.timelineContentCursors) {
      if (state.contentRef === contentRef) {
        this.deleteTimelineContentCursor(cursor, state);
      }
    }
  }

  private deleteTimelineContentCursor(cursor: string, state?: TimelineContentCursorState): void {
    const current = state ?? this.timelineContentCursors.get(cursor);
    this.timelineContentCursors.delete(cursor);
    if (!current) return;
    const key = timelineContentCursorPositionKey(
      current.contentRef,
      current.sourceRevision,
      current.byteOffset,
      current.chunkBytes
    );
    if (this.timelineContentCursorByPosition.get(key) === cursor) {
      this.timelineContentCursorByPosition.delete(key);
    }
  }

  private trimTimelineContentCursors(): void {
    while (this.timelineContentCursors.size > MAX_TIMELINE_CONTENT_CURSORS) {
      const oldest = this.timelineContentCursors.keys().next().value;
      if (typeof oldest !== "string") break;
      this.deleteTimelineContentCursor(oldest);
    }
  }

  private async resolveTimelineContentSource(
    source: TimelineContentSource
  ): Promise<string | { reason: "source-revision" | "source-gap" }> {
    if (source.kind === "session") {
      let rolloutPath: string;
      try {
        rolloutPath = await this.timelinePathPolicy.assertPathAllowed(source.rolloutPath);
      } catch {
        return { reason: "source-gap" };
      }
      const metadata = await stat(rolloutPath).catch(() => null);
      const sourceRevision = metadata ? `${metadata.size}:${metadata.mtimeMs}` : null;
      if (!metadata?.isFile() || sourceRevision !== source.sourceRevision) {
        return { reason: "source-revision" };
      }
      const { lines, budgetExhausted } = await readBoundedMatchingSessionLines(rolloutPath, metadata.size, {
        maxSourceBytes: SESSION_TIMELINE_SUPPLEMENT_SOURCE_LIMIT,
        maxMatchedBytes: SESSION_TIMELINE_SUPPLEMENT_MATCHED_TEXT_LIMIT,
        maxLines: SESSION_TIMELINE_SUPPLEMENT_SCAN_LINE_LIMIT,
        maxElapsedMs: SESSION_TIMELINE_SUPPLEMENT_SCAN_TIME_MS,
        matches: (line) => line.includes(source.callId)
      });
      if (budgetExhausted && !lines.length) {
        return { reason: "source-gap" };
      }
      return sessionToolOutputFromLines(lines, source.callId) ?? { reason: "source-gap" };
    }

    const seenCursors = new Set<string>();
    let cursor: string | null | undefined;
    let scannedBytes = 0;
    while (true) {
      if (cursor) {
        if (seenCursors.has(cursor)) {
          return { reason: "source-gap" };
        }
        seenCursors.add(cursor);
      }
      let page: MobileTimelinePage;
      try {
        page = await this.withLiveThreadRetry(source.threadId, () =>
          this.client.listThreadTurnItems({
            threadId: source.threadId,
            turnId: source.turnId,
            cursor,
            limit: 100
          })
        );
      } catch (error) {
        if (isMissingLiveThreadError(error)) {
          return { reason: "source-gap" };
        }
        throw error;
      }
      scannedBytes += utf8ByteLength(JSON.stringify(page));
      if (scannedBytes > TIMELINE_RESPONSE_BYTE_BUDGET) {
        return { reason: "source-gap" };
      }
      const item = page.items.find((candidate) => candidate.id === source.itemId);
      if (item) {
        if (
          typeof item.generation === "number" &&
          !source.sourceRevision.startsWith(`${item.generation}:`)
        ) {
          return { reason: "source-revision" };
        }
        const contentDigest = timelineTextDigest(item.text);
        if (source.contentDigest && source.contentDigest !== contentDigest) {
          return { reason: "source-revision" };
        }
        source.contentDigest ??= contentDigest;
        return item.text;
      }
      const nextCursor = page.nextCursor ?? null;
      if (!nextCursor) {
        return { reason: "source-gap" };
      }
      if (seenCursors.has(nextCursor)) {
        return { reason: "source-gap" };
      }
      cursor = nextCursor;
    }
  }

  private timelineContentCursor(
    contentRef: string,
    sourceRevision: string,
    byteOffset: number,
    chunkBytes: number
  ): string {
    const key = timelineContentCursorPositionKey(contentRef, sourceRevision, byteOffset, chunkBytes);
    const existing = this.timelineContentCursorByPosition.get(key);
    if (existing) {
      return existing;
    }
    const cursor = `tlcc_${randomUUID().replace(/-/g, "")}`;
    this.timelineContentCursorByPosition.set(key, cursor);
    this.timelineContentCursors.set(cursor, { contentRef, sourceRevision, byteOffset, chunkBytes });
    this.trimTimelineContentCursors();
    return cursor;
  }

  private async listThreadTurnItemsFromTurns(input: ListThreadTurnItemsInput): Promise<MobileTimelinePage> {
    let cursor: string | null | undefined;
    const pageLimit = Math.max(1, Math.min(input.limit ?? 30, 100));
    const seenCursors = new Set<string>();
    let scannedBytes = 0;

    while (true) {
      if (cursor) {
        if (seenCursors.has(cursor)) {
          return timelinePageWithCompleteness(
            { items: [], nextCursor: cursor },
            { status: "repair-required", reason: "cursor-loop", nextCursor: cursor }
          );
        }
        seenCursors.add(cursor);
      }
      const page = await this.client.listThreadTurns({
        threadId: input.threadId,
        cursor,
        limit: pageLimit
      });
      scannedBytes += utf8ByteLength(JSON.stringify(page));
      if (scannedBytes > TIMELINE_RESPONSE_BYTE_BUDGET) {
        return timelinePageWithCompleteness(
          { items: [], nextCursor: cursor ?? page.nextCursor ?? null },
          {
            status: "partial",
            reason: "response-budget",
            nextCursor: cursor ?? page.nextCursor ?? null
          }
        );
      }
      const items = page.items.filter((item) => item.turnId === input.turnId);
      if (items.length) {
        return timelinePageWithCompleteness({
          items: typeof input.limit === "number" ? items.slice(0, input.limit) : items,
          nextCursor: null
        });
      }
      if (!page.nextCursor) {
        return timelinePageWithCompleteness({ items: [], nextCursor: null });
      }
      if (seenCursors.has(page.nextCursor)) {
        return timelinePageWithCompleteness(
          { items: [], nextCursor: page.nextCursor },
          { status: "repair-required", reason: "cursor-loop", nextCursor: page.nextCursor }
        );
      }
      cursor = page.nextCursor;
    }
  }

  async addEnvironment(input: AddEnvironmentInput): Promise<MobileEnvironmentAddResult> {
    await this.ensureReady();
    return this.client.addEnvironment(input);
  }

  async detectExternalAgentConfig(input: DetectExternalAgentConfigInput = {}): Promise<MobileExternalAgentConfigDetectResult> {
    await this.ensureReady();
    return this.client.detectExternalAgentConfig(input);
  }

  async importExternalAgentConfig(input: ImportExternalAgentConfigInput): Promise<MobileExternalAgentConfigImportResult> {
    await this.ensureReady();
    return this.client.importExternalAgentConfig(input);
  }

  async uploadFeedback(input: UploadFeedbackInput): Promise<MobileFeedbackUploadResult> {
    await this.ensureReady();
    return this.client.uploadFeedback(input);
  }

  async addMarketplace(input: AddMarketplaceInput): Promise<MobileMarketplaceAddResult> {
    await this.ensureReady();
    return this.client.addMarketplace(input);
  }

  async removeMarketplace(marketplaceName: string): Promise<MobileMarketplaceRemoveResult> {
    await this.ensureReady();
    return this.client.removeMarketplace(marketplaceName);
  }

  async upgradeMarketplace(marketplaceName?: string | null): Promise<MobileMarketplaceUpgradeResult> {
    await this.ensureReady();
    return this.client.upgradeMarketplace(marketplaceName);
  }

  async listInstalledPlugins(input: ListInstalledPluginsInput = {}): Promise<MobilePluginInstalledResult> {
    await this.ensureReady();
    return this.client.listInstalledPlugins(input);
  }

  async savePluginShare(input: SavePluginShareInput): Promise<MobilePluginShareSaveResult> {
    await this.ensureReady();
    return this.client.savePluginShare(input);
  }

  async updatePluginShareTargets(input: UpdatePluginShareTargetsInput): Promise<MobilePluginShareUpdateTargetsResult> {
    await this.ensureReady();
    return this.client.updatePluginShareTargets(input);
  }

  async listPluginShares(): Promise<MobilePluginShareListResult> {
    await this.ensureReady();
    return this.client.listPluginShares();
  }

  async checkoutPluginShare(remotePluginId: string): Promise<MobilePluginShareCheckoutResult> {
    await this.ensureReady();
    return this.client.checkoutPluginShare(remotePluginId);
  }

  async deletePluginShare(remotePluginId: string): Promise<MobilePluginShareDeleteResult> {
    await this.ensureReady();
    return this.client.deletePluginShare(remotePluginId);
  }

  async callMcpTool(input: CallMcpToolInput): Promise<MobileMcpToolCallResult> {
    await this.ensureReady();
    return this.client.callMcpTool(input);
  }

  async startThreadRealtime(input: StartThreadRealtimeInput): Promise<MobileThreadRealtimeStatusResult> {
    await this.ensureReady();
    return this.client.startThreadRealtime(input);
  }

  async appendThreadRealtimeAudio(input: AppendThreadRealtimeAudioInput): Promise<MobileThreadRealtimeStatusResult> {
    await this.ensureReady();
    return this.client.appendThreadRealtimeAudio(input);
  }

  async appendThreadRealtimeText(input: AppendThreadRealtimeTextInput): Promise<MobileThreadRealtimeStatusResult> {
    await this.ensureReady();
    return this.client.appendThreadRealtimeText(input);
  }

  async appendThreadRealtimeSpeech(input: AppendThreadRealtimeSpeechInput): Promise<MobileThreadRealtimeStatusResult> {
    await this.ensureReady();
    return this.client.appendThreadRealtimeSpeech(input);
  }

  async stopThreadRealtime(threadId: string): Promise<MobileThreadRealtimeStatusResult> {
    await this.ensureReady();
    return this.client.stopThreadRealtime(threadId);
  }

  async listThreadRealtimeVoices(): Promise<MobileThreadRealtimeVoicesResult> {
    await this.ensureReady();
    return this.client.listThreadRealtimeVoices();
  }

  close(): void {
    this.peer.close();
    this.initialized = null;
    this.timelineContentSources.clear();
    this.timelineContentCursors.clear();
    this.timelineContentCursorByPosition.clear();
    this.clearOutputDecoders();
  }
}

function clampTimelineContentChunkBytes(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return TIMELINE_CONTENT_CHUNK_BYTE_BUDGET;
  }
  return Math.max(1, Math.min(Math.floor(value), TIMELINE_CONTENT_CHUNK_BYTE_BUDGET));
}

function timelineTextDigest(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function timelineContentSourceRevision(source: TimelineContentSource): string {
  return source.kind === "app-server" && source.contentDigest
    ? `${source.sourceRevision}:${source.contentDigest}`
    : source.sourceRevision;
}

function timelineContentCursorPositionKey(
  contentRef: string,
  sourceRevision: string,
  byteOffset: number,
  chunkBytes: number
): string {
  return `${contentRef}\u0000${sourceRevision}\u0000${byteOffset}\u0000${chunkBytes}`;
}

function repairRequiredContentChunk(
  contentRef: string,
  reason: "invalid-content-ref" | "source-revision" | "source-gap"
): MobileTimelineContentChunk {
  return {
    text: "",
    startOffset: 0,
    endOffset: 0,
    nextCursor: null,
    includedBytes: 0,
    completeness: {
      status: "repair-required",
      reason,
      nextCursor: null,
      includedBytes: 0,
      contentRef,
      contentCursor: null
    }
  };
}

function compactTimelineItemForHardBudget(
  item: MobileTimelineItem,
  fallbackContentRef: string | undefined
): MobileTimelineItem {
  const contentRef = item.completeness?.contentRef ?? fallbackContentRef;
  const imagePaths = cloneTimelineItemMetadataIfWithinBudget(item.imagePaths, (path) => path);
  const skillReferences = cloneTimelineItemMetadataIfWithinBudget(item.skillReferences, (skill) => ({ ...skill }));
  const fileReferences = cloneTimelineItemMetadataIfWithinBudget(item.fileReferences, (file) => ({ ...file }));
  const bounded = boundedTimelineText(item.text, {
    maxBytes: 0,
    ...(contentRef ? { contentRef } : {})
  });
  const completeness =
    item.completeness?.status === "repair-required"
      ? item.completeness
      : bounded.completeness.status === "complete"
        ? item.completeness
        : bounded.completeness;
  return {
    id: item.id,
    ...(typeof item.createdAt === "number" ? { createdAt: item.createdAt } : {}),
    ...(item.turnId ? { turnId: item.turnId } : {}),
    ...(typeof item.turnIndex === "number" ? { turnIndex: item.turnIndex } : {}),
    ...(item.clientUserMessageId ? { clientUserMessageId: item.clientUserMessageId } : {}),
    ...(typeof item.generation === "number" ? { generation: item.generation } : {}),
    ...(typeof item.snapshotSequence === "number" ? { snapshotSequence: item.snapshotSequence } : {}),
    role: item.role,
    text: bounded.text,
    ...(item.toolKind ? { toolKind: item.toolKind } : {}),
    ...(item.actionKind ? { actionKind: item.actionKind } : {}),
    ...(item.status ? { status: item.status } : {}),
    ...(imagePaths ? { imagePaths } : {}),
    ...(skillReferences ? { skillReferences } : {}),
    ...(fileReferences ? { fileReferences } : {}),
    ...(typeof item.added === "number" ? { added: item.added } : {}),
    ...(typeof item.removed === "number" ? { removed: item.removed } : {}),
    ...(completeness ? { completeness } : {})
  };
}

function cloneTimelineItemMetadataIfWithinBudget<T>(
  items: readonly T[] | undefined,
  cloneItem: (item: T) => T
): T[] | undefined {
  if (!items?.length) {
    return undefined;
  }
  const cloned = items.map(cloneItem);
  if (utf8ByteLength(JSON.stringify(cloned)) > TIMELINE_HARD_BUDGET_METADATA_BYTE_BUDGET) {
    return undefined;
  }
  return cloned;
}

function timelinePageWithCompleteness(
  page: MobileTimelinePage,
  completeness: TimelineCompleteness =
    page.completeness ??
    {
      status: page.nextCursor ? "partial" : "complete",
      ...(page.nextCursor ? { reason: "page-budget" as const } : {}),
      nextCursor: page.nextCursor
    }
): MobileTimelinePage {
  let includedBytes = page.includedBytes ?? 0;
  let result: MobileTimelinePage = {
    ...page,
    includedBytes,
    completeness: { ...completeness, includedBytes }
  };
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const nextBytes = utf8ByteLength(JSON.stringify(result));
    if (nextBytes === includedBytes) {
      break;
    }
    includedBytes = nextBytes;
    result = {
      ...result,
      includedBytes,
      completeness: { ...result.completeness!, includedBytes }
    };
  }
  return result;
}

function timelineThreadWithCompleteness(detail: MobileThreadDetail): MobileThreadDetail {
  const completeness: TimelineCompleteness =
    detail.completeness ??
    {
      status: detail.nextCursor ? "partial" : "complete",
      ...(detail.nextCursor ? { reason: "response-budget" as const } : {}),
      nextCursor: detail.nextCursor
    };
  let includedBytes = detail.includedBytes ?? 0;
  let result: MobileThreadDetail = {
    ...detail,
    includedBytes,
    completeness: { ...completeness, includedBytes }
  };
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const nextBytes = utf8ByteLength(JSON.stringify(result));
    if (nextBytes === includedBytes) {
      break;
    }
    includedBytes = nextBytes;
    result = {
      ...result,
      includedBytes,
      completeness: { ...result.completeness!, includedBytes }
    };
  }
  return result;
}

function createPeer(config: AppServerConfig): ManagedAppServerPeer {
  if (config.mode === "mock") {
    return new MockAppServerPeer();
  }

  if (config.mode === "off") {
    return new DisabledAppServerPeer();
  }

  return createManagedAppServerPeer(config);
}

export function createAppServerGateway(config: AppServerConfig): AppServerGateway {
  return new AppServerGateway(createPeer(config));
}

const globalForAppServer = globalThis as typeof globalThis & {
  __codexWebAppServerGateway?: AppServerGateway;
};

export function getAppServerGateway(): AppServerGateway {
  if (!globalForAppServer.__codexWebAppServerGateway) {
    globalForAppServer.__codexWebAppServerGateway = createAppServerGateway(getRuntimeConfig().appServer);
  }

  return globalForAppServer.__codexWebAppServerGateway;
}
