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
    const body = (await request.json().catch(() => ({}))) as { turnId?: string };
    const gateway = getAppServerGateway();
    let turnId = typeof body.turnId === "string" ? body.turnId.trim() : "";

    if (!turnId) {
      const thread = await gateway.readThread(threadId);
      turnId = thread.lastTurnId ?? "";
    }

    if (!turnId) {
      return NextResponse.json({ ok: false, error: "暂无可中断的 turn" }, { status: 409 });
    }

    await audit("turn.interrupt", { threadId, turnId });
    await gateway.interruptTurn(threadId, turnId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "无法 interrupt turn" },
      { status: 502 }
    );
  }
}
