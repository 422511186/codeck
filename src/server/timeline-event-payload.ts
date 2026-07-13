import type { BrowserTimelineEvent } from "./app-server/runtime";
import {
  TIMELINE_EVENT_BYTE_BUDGET,
  utf8ByteLength,
  utf8SafePrefix,
  type TimelineCompleteness
} from "../shared/timeline-content";

export type TimelineEventContentLocator = {
  threadId: string;
  turnId?: string;
  itemId?: string;
  text: string;
  originalKind: string;
  itemRole?: "user" | "agent" | "reasoning" | "plan" | "tool" | "diff" | "system" | "error";
  toolKind?: "command" | "mcp" | "dynamic" | "file" | "web" | "image" | "system";
  server?: string;
  tool?: string;
  status?: "running" | "success" | "failed";
};

export type TimelineEventBudgetOptions = {
  createContentRef?: (
    content: TimelineEventContentLocator,
    identity: Extract<BrowserTimelineEvent, { type: "codex-event" }>["event"]
  ) => string | undefined;
};

export function browserTimelineEventForBudget(
  event: BrowserTimelineEvent,
  maxBytes = TIMELINE_EVENT_BYTE_BUDGET,
  options: TimelineEventBudgetOptions = {}
): BrowserTimelineEvent {
  if (utf8ByteLength(JSON.stringify(event)) <= maxBytes) {
    return event;
  }
  if (event.type !== "codex-event") {
    return event;
  }
  const content = eventContent(event);
  const identity = event.event;
  const contentRef = content ? options.createContentRef?.(content, identity) : undefined;
  const sourceText = content?.text ?? "";
  const originalBytes = utf8ByteLength(sourceText);
  let previewBudget = Math.min(64 * 1024, Math.max(0, Math.floor(maxBytes / 2)));

  while (previewBudget >= 0) {
    const preview = utf8SafePrefix(sourceText, previewBudget);
    const completeness: TimelineCompleteness = contentRef
      ? {
          status: "truncated",
          reason: "event-budget",
          originalBytes,
          includedBytes: preview.bytes,
          contentRef,
          contentCursor: null
        }
      : {
          status: "repair-required",
          reason: "event-budget",
          originalBytes,
          includedBytes: preview.bytes
        };
    const reference: BrowserTimelineEvent = {
      type: "codex-event",
      event: {
        kind: "timeline_content_reference",
        threadId: content?.threadId ?? eventThreadId(event),
        ...(content?.turnId ? { turnId: content.turnId } : {}),
        ...(content?.itemId ? { itemId: content.itemId } : {}),
        originalKind: content?.originalKind ?? identity.kind,
        ...(content?.itemRole ? { itemRole: content.itemRole } : {}),
        ...(content?.toolKind ? { toolKind: content.toolKind } : {}),
        ...(content?.server ? { server: content.server } : {}),
        ...(content?.tool ? { tool: content.tool } : {}),
        ...(content?.status ? { status: content.status } : {}),
        preview: preview.text,
        ...(contentRef ? { contentRef } : {}),
        completeness,
        ...(identity.eventId ? { eventId: identity.eventId } : {}),
        ...(typeof identity.sequence === "number" ? { sequence: identity.sequence } : {}),
        ...(typeof identity.revision === "number" ? { revision: identity.revision } : {}),
        ...(typeof identity.generation === "number" ? { generation: identity.generation } : {})
      }
    };
    if (utf8ByteLength(JSON.stringify(reference)) <= maxBytes) {
      return reference;
    }
    if (previewBudget === 0) {
      const minimal: BrowserTimelineEvent = {
        type: "codex-event",
        event: {
          kind: "timeline_content_reference",
          threadId: content?.threadId ?? eventThreadId(event),
          ...(content?.turnId ? { turnId: content.turnId } : {}),
          ...(content?.itemId ? { itemId: content.itemId } : {}),
          originalKind: content?.originalKind ?? identity.kind,
          preview: "",
          ...(contentRef ? { contentRef } : {}),
          completeness: contentRef
            ? {
                status: "truncated",
                reason: "event-budget",
                originalBytes,
                includedBytes: 0,
                contentRef,
                contentCursor: null
              }
            : {
                status: "repair-required",
                reason: "event-budget",
                originalBytes,
                includedBytes: 0
              },
          ...(identity.eventId ? { eventId: identity.eventId } : {}),
          ...(typeof identity.sequence === "number" ? { sequence: identity.sequence } : {}),
          ...(typeof identity.revision === "number" ? { revision: identity.revision } : {}),
          ...(typeof identity.generation === "number" ? { generation: identity.generation } : {})
        }
      };
      if (utf8ByteLength(JSON.stringify(minimal)) <= maxBytes) {
        return minimal;
      }
      throw new RangeError("Timeline event identity exceeds hard payload budget");
    }
    previewBudget = Math.floor(previewBudget / 2);
  }
  throw new RangeError("Timeline event exceeds hard payload budget");
}

export function serializeBrowserTimelineEvent(
  event: BrowserTimelineEvent,
  maxBytes = TIMELINE_EVENT_BYTE_BUDGET
): string {
  return JSON.stringify(browserTimelineEventForBudget(event, maxBytes));
}

function eventContent(
  event: Extract<BrowserTimelineEvent, { type: "codex-event" }>
): TimelineEventContentLocator | null {
  const value = event.event;
  if (value.kind === "item_updated") {
    return {
      threadId: value.threadId,
      turnId: value.turnId,
      itemId: value.item.id,
      text: value.item.text,
      originalKind: value.kind,
      itemRole: value.item.role,
      ...(value.item.toolKind ? { toolKind: value.item.toolKind } : {}),
      ...(value.item.server ? { server: value.item.server } : {}),
      ...(value.item.tool ? { tool: value.item.tool } : {}),
      ...(value.item.status ? { status: value.item.status } : {})
    };
  }
  if (
    value.kind === "agent_message_delta" ||
    value.kind === "reasoning_delta" ||
    value.kind === "plan_delta" ||
    value.kind === "command_output_delta" ||
    value.kind === "file_output_delta" ||
    value.kind === "tool_output_delta"
  ) {
    return {
      threadId: value.threadId,
      turnId: value.turnId,
      itemId: value.itemId,
      text: value.delta,
      originalKind: value.kind
    };
  }
  if (value.kind === "turn_diff_updated") {
    return {
      threadId: value.threadId,
      turnId: value.turnId,
      itemId: `${value.turnId}-diff`,
      text: value.diff,
      originalKind: value.kind
    };
  }
  return null;
}

function eventThreadId(event: Extract<BrowserTimelineEvent, { type: "codex-event" }>): string {
  return "threadId" in event.event && typeof event.event.threadId === "string" ? event.event.threadId : "_global";
}
