import type { BrowserCodexEvent } from "../server/app-server/events";
import type { MobileThreadDetail, MobileTimelineItem } from "../shared/codex";

const deltaRoleByKind: Partial<Record<BrowserCodexEvent["kind"], MobileTimelineItem["role"]>> = {
  agent_message_delta: "agent",
  reasoning_delta: "reasoning",
  plan_delta: "plan",
  command_output_delta: "tool",
  file_output_delta: "tool"
};

function upsertTimelineItem(
  timeline: MobileTimelineItem[],
  item: MobileTimelineItem,
  mode: "append" | "replace"
): MobileTimelineItem[] {
  const existing = timeline.find((timelineItem) => timelineItem.id === item.id);
  if (!existing) {
    return [...timeline, item];
  }

  return timeline.map((timelineItem) => {
    if (timelineItem.id !== item.id) {
      return timelineItem;
    }

    return {
      ...timelineItem,
      role: item.role,
      text: mode === "append" && !timelineItem.text.endsWith(item.text) ? `${timelineItem.text}${item.text}` : item.text
    };
  });
}

export function applyCodexTimelineEvent(
  thread: MobileThreadDetail,
  event: BrowserCodexEvent
): MobileThreadDetail {
  if (event.kind === "settings_invalidated") {
    return thread;
  }

  if (event.kind === "warning") {
    if (!event.threadId || thread.id !== event.threadId) {
      return thread;
    }

    return {
      ...thread,
      timeline: upsertTimelineItem(
        thread.timeline,
        { id: `warning-${event.threadId}`, role: "tool", text: `警告：${event.message}` },
        "replace"
      )
    };
  }

  if (thread.id !== event.threadId) {
    return thread;
  }

  if (event.kind === "turn_diff_updated") {
    return {
      ...thread,
      timeline: upsertTimelineItem(
        thread.timeline,
        { id: `diff-${event.turnId}`, role: "tool", text: event.diff },
        "replace"
      )
    };
  }

  if (event.kind === "token_usage_updated") {
    const contextText = event.modelContextWindow === null ? "" : `，上下文 ${event.modelContextWindow}`;
    return {
      ...thread,
      tokenUsageTotal: event.totalTokens,
      timeline: upsertTimelineItem(
        thread.timeline,
        {
          id: `usage-${event.turnId}`,
          role: "tool",
          text: `Token 用量：总计 ${event.totalTokens}，输入 ${event.inputTokens}，输出 ${event.outputTokens}，推理 ${event.reasoningOutputTokens}${contextText}`
        },
        "replace"
      )
    };
  }

  const role = deltaRoleByKind[event.kind];
  if (!role) {
    return thread;
  }

  return {
    ...thread,
    timeline: upsertTimelineItem(thread.timeline, { id: event.itemId, role, text: event.delta }, "append")
  };
}
