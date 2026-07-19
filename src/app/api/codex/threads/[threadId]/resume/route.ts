import { NextResponse } from "next/server";
import { getThreadModelLifecycleService } from "../../../../../../server/custom-models/runtime";
import { isRequestAuthenticated } from "../../../../../../server/auth";
import { audit } from "../../../../../../server/security";

export async function POST(
  request: Request,
  context: { params: Promise<{ threadId: string }> }
): Promise<Response> {
  if (!isRequestAuthenticated(request)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  try {
    const { threadId } = await context.params;
    await audit("thread.resume", { threadId });
    const thread = await getThreadModelLifecycleService().resumeThread(threadId);
    return NextResponse.json({
      ok: true,
      thread: { ...thread, timeline: [], nextCursor: null }
    });
  } catch (error) {
    const structured = typeof error === "object" && error !== null
      ? error as { code?: unknown; httpStatus?: unknown; result?: Record<string, unknown> }
      : null;
    if (structured?.code === "SWITCH_RECOVERY_FAILED" && structured.httpStatus === 500) {
      return NextResponse.json(
        { ok: false, code: structured.code, ...(structured.result ?? {}) },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "无法恢复会话" },
      { status: 502 }
    );
  }
}
