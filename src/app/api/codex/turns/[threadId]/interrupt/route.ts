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
    const body = (await request.json()) as { turnId?: string };
    if (!body.turnId) {
      return NextResponse.json({ ok: false, error: "turnId 不能为空" }, { status: 400 });
    }

    await audit("turn.interrupt", { threadId, turnId: body.turnId });
    await getAppServerGateway().interruptTurn(threadId, body.turnId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "无法 interrupt turn" },
      { status: 502 }
    );
  }
}
