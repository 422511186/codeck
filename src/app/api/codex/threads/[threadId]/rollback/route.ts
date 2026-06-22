import { NextResponse } from "next/server";
import { getAppServerGateway } from "../../../../../../server/app-server/runtime";
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
    const body = (await request.json().catch(() => ({}))) as { numTurns?: number };
    const numTurns = body.numTurns || 1;
    await audit("thread.rollback", { threadId, numTurns });
    const thread = await getAppServerGateway().rollbackThread(threadId, numTurns);
    return NextResponse.json({ ok: true, thread });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "无法 rollback 会话" },
      { status: 502 }
    );
  }
}
