import { NextResponse } from "next/server";
import { getThreadModelLifecycleService } from "../../../../../server/custom-models/runtime";
import { isRequestAuthenticated } from "../../../../../server/auth";
import { audit } from "../../../../../server/security";

export async function GET(
  request: Request,
  context: { params: Promise<{ threadId: string }> }
): Promise<Response> {
  if (!isRequestAuthenticated(request)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  try {
    const { threadId } = await context.params;
    const repairReason = new URL(request.url).searchParams.get("repairReason");
    if (repairReason && TIMELINE_REPAIR_REASONS.has(repairReason)) {
      await audit("thread.timeline.reconcile", { threadId, reason: repairReason });
    }
    const thread = await getThreadModelLifecycleService().readThreadMetadata(threadId);
    if (
      thread.modelState?.selection.source === "custom" &&
      thread.modelState.contextWindow &&
      thread.contextUsage?.modelContextWindow &&
      thread.modelState.contextWindow !== thread.contextUsage.modelContextWindow
    ) {
      await audit("thread.model.context_mismatch", {
        threadId,
        selection: thread.modelState.selection,
        configuredContextWindow: thread.modelState.contextWindow,
        actualContextWindow: thread.contextUsage.modelContextWindow
      });
    }
    return NextResponse.json({ ok: true, thread });
  } catch (error) {
    const structured = typeof error === "object" && error !== null
      ? error as {
          code?: unknown;
          httpStatus?: unknown;
          result?: Record<string, unknown>;
          thread?: unknown;
        }
      : null;
    if (structured?.code === "SWITCH_RECOVERY_FAILED" && structured.httpStatus === 500) {
      return NextResponse.json(
        {
          ok: false,
          code: structured.code,
          ...(structured.result ?? {}),
          ...(structured.thread ? { thread: structured.thread } : {})
        },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "无法读取会话" },
      { status: 502 }
    );
  }
}

const TIMELINE_REPAIR_REASONS = new Set([
  "manual",
  "mutation-retry",
  "timeline-gap",
  "turn-completed",
  "summary-idle",
  "stream-disconnected",
  "baseline-required"
]);
