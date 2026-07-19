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
    await audit("thread.unarchive", { threadId });
    const thread = await getThreadModelLifecycleService().unarchiveThread(threadId);
    return NextResponse.json({ ok: true, thread });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "无法恢复归档会话" },
      { status: 502 }
    );
  }
}
