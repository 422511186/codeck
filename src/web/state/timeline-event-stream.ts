import type { TimelineEntry } from "./timeline";

export type TimelineStreamEventKind =
  | "user-message"
  | "assistant-message"
  | "reasoning"
  | "command"
  | "file-change"
  | "tool"
  | "web-search"
  | "subagent"
  | "plan"
  | "system"
  | "error"
  | "approval";

export type TimelineStreamEventStatus =
  | "pending"
  | "running"
  | "success"
  | "failed"
  | "cancelled"
  | "interrupted"
  | "retrying";

export type TimelineStreamEvent = {
  id: string;
  identity: string;
  entryId: string;
  threadId?: string;
  turnId?: string;
  bootId?: string;
  generation?: number;
  parentId?: string;
  kind: TimelineStreamEventKind;
  eventKind?: string;
  status: TimelineStreamEventStatus;
  label: string;
  visible?: boolean;
  createdAt: number;
  updatedAt: number;
  firstSequence?: number;
  lastSequence?: number;
  sourceOrder: number;
  source: "entry" | "delta" | "lifecycle";
  sourceEventIds: string[];
};

export type TimelineEventStreamState = {
  events: TimelineStreamEvent[];
  processedEventIds: Set<string>;
  nextSourceOrder: number;
  revision: number;
};

export type TimelineStreamInput =
  | {
      kind: "entry";
      entry: TimelineEntry;
      threadId?: string;
      eventId?: string;
      sequence?: number;
      parentId?: string;
    }
  | {
      kind: "lifecycle";
      threadId: string;
      turnId?: string;
      itemId: string;
      eventKind: string;
      status: TimelineStreamEventStatus;
      label?: string;
      visible?: boolean;
      eventId?: string;
      bootId?: string;
      generation?: number;
      createdAt?: number;
      sequence?: number;
      parentId?: string;
    }
  | {
      kind: "delta";
      threadId: string;
      turnId: string;
      itemId: string;
      eventKind: string;
      delta: string;
      eventId?: string;
      bootId?: string;
      generation?: number;
      sequence?: number;
      parentId?: string;
    };

export function createTimelineEventStreamState(
  init: Partial<TimelineEventStreamState> = {}
): TimelineEventStreamState {
  return {
    events: init.events ?? [],
    processedEventIds: init.processedEventIds ?? new Set<string>(),
    nextSourceOrder: init.nextSourceOrder ?? init.events?.length ?? 0,
    revision: init.revision ?? 0
  };
}

export function applyTimelineStreamInput(
  state: TimelineEventStreamState,
  input: TimelineStreamInput
): TimelineEventStreamState {
  const eventLedgerKey = input.eventId ? timelineStreamEventLedgerKey(input) : null;
  if (eventLedgerKey && state.processedEventIds.has(eventLedgerKey)) {
    return state;
  }

  const entry = input.kind === "entry" ? input.entry : null;
  const identity = input.kind === "entry"
    ? timelineEntryStreamIdentity(input.entry)
    : timelineStreamIdentity(
        input.threadId,
        input.turnId ?? "lifecycle",
        input.itemId,
        input.bootId,
        input.generation
      );
  const existingIndex = state.events.findIndex((event) =>
    event.identity === identity ||
    (entry && event.entryId === entry.id && event.turnId === entry.turnId && timelineStreamEventMatchesEntry(event, entry)) ||
    (entry?.body.kind === "error" && event.kind === "error" && event.turnId === entry.turnId && timelineStreamEventMatchesEntry(event, entry))
  );
  const now = input.kind === "lifecycle" ? input.createdAt ?? Date.now() : entry?.createdAt ?? Date.now();
  const sequence = input.sequence ?? (entry ? entry.streamSequence : undefined);
  const nextEvent = existingIndex >= 0
    ? updateStreamEvent(state.events[existingIndex]!, input, entry, identity, now, sequence)
    : createStreamEvent(state, input, entry, identity, now, sequence);

  const events = existingIndex >= 0
    ? state.events.map((event, index) => index === existingIndex ? nextEvent : event)
    : [...state.events, nextEvent];
  const processedEventIds = eventLedgerKey
    ? new Set([...state.processedEventIds, eventLedgerKey])
    : state.processedEventIds;
  const nextState: TimelineEventStreamState = {
    events,
    processedEventIds,
    nextSourceOrder: existingIndex >= 0 ? state.nextSourceOrder : state.nextSourceOrder + 1,
    revision: state.revision + 1
  };
  return {
    ...nextState,
    events: sortTimelineStreamEvents(nextState.events)
  };
}

export function applyTimelineStreamInputs(
  state: TimelineEventStreamState,
  inputs: TimelineStreamInput[]
): TimelineEventStreamState {
  return inputs.reduce(applyTimelineStreamInput, state);
}

export function timelineEventStreamFromEntries(
  entries: TimelineEntry[],
  previous?: TimelineEventStreamState
): TimelineEventStreamState {
  let state = previous ?? createTimelineEventStreamState();
  for (const entry of entries) {
    state = applyTimelineStreamInput(state, { kind: "entry", entry });
  }
  const identities = new Set(entries.map(timelineEntryStreamIdentity));
  const visibleEvents = state.events.filter((event) =>
    identities.has(event.identity) ||
    entries.some((entry) =>
      `${entry.turnId ?? "none"}\u0000${entry.id}` === `${event.turnId ?? "none"}\u0000${event.entryId}` &&
      timelineStreamEventMatchesEntry(event, entry)
    ) ||
    (event.source === "lifecycle" && (event.visible === true || event.kind === "approval"))
  );
  const visibleState = visibleEvents.length === state.events.length
    ? state
    : { ...state, events: visibleEvents, revision: state.revision + 1 };
  return reconcileEntryEventOrder(entries, visibleState);
}

function reconcileEntryEventOrder(
  entries: TimelineEntry[],
  state: TimelineEventStreamState
): TimelineEventStreamState {
  const usedIndexes = new Set<number>();
  const orderedEntryEvents: TimelineStreamEvent[] = [];
  for (const entry of entries) {
    const eventIndex = state.events.findIndex((event, index) =>
      !usedIndexes.has(index) && (
        event.identity === timelineEntryStreamIdentity(entry) ||
        (
          event.entryId === entry.id &&
          event.turnId === entry.turnId &&
          timelineStreamEventMatchesEntry(event, entry)
        )
      )
    );
    if (eventIndex < 0) continue;
    usedIndexes.add(eventIndex);
    orderedEntryEvents.push(state.events[eventIndex]!);
  }
  const remainingEvents = state.events.filter((_event, index) => !usedIndexes.has(index));
  const orderedEvents = [...orderedEntryEvents, ...remainingEvents];
  const orderChanged = orderedEvents.some((event, index) => event !== state.events[index]);
  if (!orderChanged) return state;
  return {
    ...state,
    events: orderedEvents.map((event, sourceOrder) => ({ ...event, sourceOrder })),
    nextSourceOrder: orderedEvents.length,
    revision: state.revision + 1
  };
}

export function orderTimelineEntriesByEventStream(
  entries: TimelineEntry[],
  stream: TimelineEventStreamState
): TimelineEntry[] {
  const byIdentity = new Map(entries.map((entry) => [timelineEntryStreamIdentity(entry), entry]));
  const byEntryKey = new Map<string, TimelineEntry[]>();
  for (const entry of entries) {
    const key = `${entry.turnId ?? "none"}\u0000${entry.id}`;
    const candidates = byEntryKey.get(key) ?? [];
    candidates.push(entry);
    byEntryKey.set(key, candidates);
  }

  const result: TimelineEntry[] = [];
  const used = new Set<string>();
  for (const event of stream.events) {
    const entry = byIdentity.get(event.identity) ??
      byEntryKey.get(`${event.turnId ?? "none"}\u0000${event.entryId}`)?.find((candidate) =>
        timelineStreamEventMatchesEntry(event, candidate)
      );
    if (!entry) continue;
    const identity = timelineEntryStreamIdentity(entry);
    if (used.has(identity)) continue;
    used.add(identity);
    result.push(entry);
  }
  for (const entry of entries) {
    const identity = timelineEntryStreamIdentity(entry);
    if (!used.has(identity)) result.push(entry);
  }
  return result;
}

export function timelineStreamDepthForEntry(
  entry: TimelineEntry,
  stream: TimelineEventStreamState
): number {
  const event = stream.events.find((candidate) => candidate.identity === timelineEntryStreamIdentity(entry)) ??
    stream.events.find((candidate) =>
      candidate.entryId === entry.id &&
      candidate.turnId === entry.turnId &&
      timelineStreamEventMatchesEntry(candidate, entry)
    );
  if (!event?.parentId) return 0;
  const byId = new Map<string, TimelineStreamEvent>();
  for (const candidate of stream.events) {
    byId.set(candidate.id, candidate);
    byId.set(candidate.entryId, candidate);
    for (const sourceEventId of candidate.sourceEventIds) {
      byId.set(sourceEventId, candidate);
    }
  }
  let depth = 0;
  let parentId: string | undefined = event.parentId;
  const visited = new Set<string>();
  while (parentId && !visited.has(parentId)) {
    visited.add(parentId);
    const parent = byId.get(parentId);
    if (!parent) break;
    depth += 1;
    parentId = parent.parentId;
  }
  return depth;
}

export function timelineEntriesForEventStream(
  entries: TimelineEntry[],
  stream: TimelineEventStreamState
): TimelineEntry[] {
  const existing = new Set(entries.map((entry) => `${entry.turnId ?? "none"}\u0000${entry.id}`));
  const existingErrorTurns = new Set(
    entries
      .filter((entry) => entry.body.kind === "error")
      .map((entry) => entry.turnId ?? "none")
  );
  const synthetic = stream.events
    .filter((event) =>
      event.kind === "error" &&
      event.visible === true &&
      !existing.has(`${event.turnId ?? "none"}\u0000${event.entryId}`) &&
      !existingErrorTurns.has(event.turnId ?? "none")
    )
    .map((event): TimelineEntry => ({
      id: event.entryId,
      ...(event.turnId ? { turnId: event.turnId } : {}),
      createdAt: event.createdAt,
      body: {
        kind: "error",
        text: event.label,
        status: event.status === "success" || event.status === "retrying" || event.status === "cancelled" || event.status === "interrupted"
          ? event.status
          : "failed"
      }
    }));
  return synthetic.length ? [...entries, ...synthetic] : entries;
}

export function timelineStreamKindForEntry(entry: TimelineEntry): TimelineStreamEventKind {
  switch (entry.body.kind) {
    case "user-message":
      return "user-message";
    case "agent-message":
      return "assistant-message";
    case "reasoning":
      return "reasoning";
    case "command":
      return "command";
    case "diff":
      return "file-change";
    case "tool":
      if (
        entry.body.toolKind === "command" ||
        entry.body.server === "command" ||
        entry.body.tool === "exec_command"
      ) return "command";
      if (entry.body.toolKind === "file") return "file-change";
      if (entry.body.toolKind === "web") return "web-search";
      if (entry.body.server === "sub-agent") return "subagent";
      return "tool";
    case "error":
      return "error";
    case "system":
      return entry.body.systemKind === "context-compaction" ? "system" : "system";
    default:
      return "system";
  }
}

export function timelineEntryStreamIdentity(entry: TimelineEntry): string {
  return JSON.stringify([
    entry.historyStamp?.bootId ?? entry.bootId ?? "legacy",
    entry.historyStamp?.generation ?? entry.generation ?? "legacy",
    entry.turnId ?? "none",
    entry.id
  ]);
}

function timelineStreamIdentity(
  threadId: string,
  turnId: string,
  itemId: string,
  bootId?: string,
  generation?: number
): string {
  void threadId;
  return JSON.stringify([bootId ?? "legacy", generation ?? "legacy", turnId, itemId]);
}

function createStreamEvent(
  state: TimelineEventStreamState,
  input: TimelineStreamInput,
  entry: TimelineEntry | null,
  identity: string,
  now: number,
  sequence?: number
): TimelineStreamEvent {
  const kind = entry
    ? timelineStreamKindForEntry(entry)
    : timelineStreamKindForEvent(input.kind === "entry" ? "entry" : input.eventKind);
  const status = entry ? timelineStreamStatusForEntry(entry) : input.kind === "lifecycle" ? input.status : "running";
  const entryId = entry?.id ?? (input.kind === "entry" ? "unknown" : input.itemId);
  const turnId = input.kind === "delta" || input.kind === "lifecycle" ? input.turnId : entry?.turnId;
  const bootId = entry?.historyStamp?.bootId ?? entry?.bootId ?? (input.kind !== "entry" ? input.bootId : undefined);
  const generation = entry?.historyStamp?.generation ?? entry?.generation ?? (input.kind !== "entry" ? input.generation : undefined);
  return {
    id: entryId,
    identity,
    entryId,
    ...(turnId ? { turnId } : {}),
    ...(bootId ? { bootId } : {}),
    ...(typeof generation === "number" ? { generation } : {}),
    ...(input.kind === "entry" && input.threadId ? { threadId: input.threadId } : {}),
    ...(input.parentId ? { parentId: input.parentId } : {}),
    kind,
    ...(input.kind !== "entry" ? { eventKind: input.eventKind } : {}),
    status,
    label: input.kind === "lifecycle" && input.label
      ? input.label
      : timelineStreamLabel(entry, input.kind === "entry" ? kind : input.eventKind),
    ...(input.kind === "lifecycle" && input.visible ? { visible: true } : {}),
    createdAt: input.kind === "lifecycle" ? input.createdAt ?? now : entry?.createdAt ?? now,
    updatedAt: now,
    ...(typeof sequence === "number" ? { firstSequence: sequence, lastSequence: sequence } : {}),
    sourceOrder: state.nextSourceOrder,
    source: input.kind,
    ...(input.eventId ? { sourceEventIds: [input.eventId] } : { sourceEventIds: [] })
  };
}

function updateStreamEvent(
  current: TimelineStreamEvent,
  input: TimelineStreamInput,
  entry: TimelineEntry | null,
  identity: string,
  now: number,
  sequence?: number
): TimelineStreamEvent {
  if (typeof sequence === "number" && typeof current.lastSequence === "number" && sequence < current.lastSequence) {
    return input.eventId && !current.sourceEventIds.includes(input.eventId)
      ? { ...current, sourceEventIds: [...current.sourceEventIds, input.eventId] }
      : current;
  }
  const nextStatus = entry
    ? timelineStreamStatusForEntry(entry)
    : input.kind === "lifecycle"
      ? input.status
      : current.status;
  const canReopenApproval = input.kind === "lifecycle" && input.eventKind === "approval_requested";
  const status = isTerminalTimelineStreamStatus(current.status) && !isTerminalTimelineStreamStatus(nextStatus) && !canReopenApproval
    ? current.status
    : nextStatus;
  const nextKind = entry ? timelineStreamKindForEntry(entry) : current.kind;
  const entryBootId = entry?.historyStamp?.bootId ?? entry?.bootId;
  const entryGeneration = entry?.historyStamp?.generation ?? entry?.generation;
  const preserveExistingIdentity = Boolean(
    input.kind === "entry" &&
    entry &&
    (!entryBootId || typeof entryGeneration !== "number") &&
    (current.bootId || typeof current.generation === "number")
  );
  const nextBootId = entry?.historyStamp?.bootId ?? entry?.bootId ?? (input.kind !== "entry" ? input.bootId : undefined);
  const nextGeneration = entry?.historyStamp?.generation ?? entry?.generation ?? (input.kind !== "entry" ? input.generation : undefined);
  return {
    ...current,
    identity: preserveExistingIdentity ? current.identity : identity,
    ...(entry?.id ? { id: entry.id, entryId: entry.id } : {}),
    ...(entry?.turnId ? { turnId: entry.turnId } : {}),
    ...(nextBootId ? { bootId: nextBootId } : {}),
    ...(typeof nextGeneration === "number" ? { generation: nextGeneration } : {}),
    ...(input.kind === "entry" && input.threadId ? { threadId: input.threadId } : {}),
    ...(input.parentId ? { parentId: input.parentId } : {}),
    kind: nextKind,
    ...(input.kind !== "entry" ? { eventKind: input.eventKind } : {}),
    status,
    label: input.kind === "lifecycle" && input.label
      ? input.label
      : timelineStreamLabel(entry, input.kind === "entry" ? nextKind : input.eventKind),
    ...(input.kind === "lifecycle" && input.visible ? { visible: true } : {}),
    updatedAt: now,
    ...(typeof sequence === "number"
      ? {
          firstSequence: Math.min(current.firstSequence ?? sequence, sequence),
          lastSequence: Math.max(current.lastSequence ?? sequence, sequence)
        }
      : {}),
    sourceEventIds: input.eventId && !current.sourceEventIds.includes(input.eventId)
      ? [...current.sourceEventIds, input.eventId]
      : current.sourceEventIds
  };
}

function timelineStreamStatusForEntry(entry: TimelineEntry): TimelineStreamEventStatus {
  if (entry.body.kind === "user-message") {
    return entry.body.status === "sending" ? "pending" : entry.body.status === "failed" ? "failed" : "success";
  }
  if (entry.body.kind === "reasoning") return entry.body.done ? "success" : "running";
  if (entry.body.kind === "tool" || entry.body.kind === "command") {
    if (entry.body.status === "running") return "running";
    return entry.body.status;
  }
  if (entry.body.kind === "error") return entry.body.status ?? "failed";
  return "success";
}

function timelineStreamKindForEvent(eventKind: string): TimelineStreamEventKind {
  if (eventKind.includes("approval")) return "approval";
  if (eventKind.includes("turn") || eventKind.includes("error")) return "error";
  if (eventKind.includes("reasoning")) return "reasoning";
  if (eventKind.includes("command") || eventKind === "exec") return "command";
  if (eventKind.includes("file")) return "file-change";
  if (eventKind.includes("agent_message")) return "assistant-message";
  if (eventKind.includes("plan")) return "plan";
  if (eventKind.includes("web")) return "web-search";
  return "tool";
}

function timelineStreamLabel(entry: TimelineEntry | null, fallbackKind: string): string {
  if (!entry) {
    switch (fallbackKind) {
      case "reasoning_delta": return "Thinking";
      case "command_output_delta": return "Running command";
      case "file_output_delta": return "Editing files";
      case "agent_message_delta": return "Writing response";
      case "turn.started":
      case "turn_started": return "正在执行";
      case "turn.completed":
      case "turn_completed": return "执行完成";
      case "turn.failed":
      case "turn_failed": return "运行失败";
      case "turn.canceled":
      case "turn_canceled": return "已取消";
      case "turn_interrupted": return "已中断";
      case "approval_requested": return "等待审批";
      case "approval_resolved": return "审批已处理";
      default: return "Using tool";
    }
  }
  switch (entry.body.kind) {
    case "reasoning": return "Thinking";
    case "command": return entry.body.command || "Running command";
    case "tool": return [entry.body.server, entry.body.tool].filter(Boolean).join(" · ") || "Using tool";
    case "diff": return entry.body.path || "Editing files";
    case "agent-message": return "Assistant message";
    case "user-message": return "User message";
    case "error": return "Error";
    case "system": return entry.body.text || "System event";
    default: return fallbackKind;
  }
}

function isTerminalTimelineStreamStatus(status: TimelineStreamEventStatus): boolean {
  return status === "success" || status === "failed" || status === "cancelled" || status === "interrupted";
}

function sortTimelineStreamEvents(events: TimelineStreamEvent[]): TimelineStreamEvent[] {
  return [...events].sort((left, right) => {
    if (sameTimelineStreamScope(left, right) && left.firstSequence !== undefined && right.firstSequence !== undefined) {
      return left.firstSequence - right.firstSequence || left.sourceOrder - right.sourceOrder;
    }
    return left.sourceOrder - right.sourceOrder;
  });
}

function timelineStreamEventLedgerKey(input: TimelineStreamInput): string {
  const bootId = input.kind === "entry"
    ? input.entry.historyStamp?.bootId ?? input.entry.bootId
    : input.bootId;
  const generation = input.kind === "entry"
    ? input.entry.historyStamp?.generation ?? input.entry.generation
    : input.generation;
  return JSON.stringify([bootId ?? "legacy", generation ?? "legacy", input.eventId]);
}

export function timelineStreamEventMatchesEntry(event: TimelineStreamEvent, entry: TimelineEntry): boolean {
  const bootId = entry.historyStamp?.bootId ?? entry.bootId;
  const generation = entry.historyStamp?.generation ?? entry.generation;
  return (
    (!bootId || !event.bootId || bootId === event.bootId) &&
    (generation === undefined || event.generation === undefined || generation === event.generation)
  );
}

function sameTimelineStreamScope(left: TimelineStreamEvent, right: TimelineStreamEvent): boolean {
  return left.bootId === right.bootId && left.generation === right.generation;
}
