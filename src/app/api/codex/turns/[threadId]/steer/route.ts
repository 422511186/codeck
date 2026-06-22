import { NextResponse } from "next/server";
import { getAppServerGateway } from "../../../../../../server/app-server/runtime";
import { isRequestAuthenticated } from "../../../../../../server/auth";

export async function POST(
  request: Request,
  context: { params: Promise<{ threadId: string }> }
): Promise<Response> {
  if (!isRequestAuthenticated(request)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  try {
    const { threadId } = await context.params;
    const body = (await request.json()) as { expectedTurnId?: string; text?: string };
    if (!body.expectedTurnId) {
      return NextResponse.json({ ok: false, error: "expectedTurnId 不能为空" }, { status: 400 });
    }
    if (!body.text?.trim()) {
      return NextResponse.json({ ok: false, error: "追加指令不能为空" }, { status: 400 });
    }

    const result = await getAppServerGateway().steerTurn({
      threadId,
      expectedTurnId: body.expectedTurnId,
      text: body.text
    });
    const thread = await getAppServerGateway().readThread(threadId);
    return NextResponse.json({ ok: true, ...result, thread });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "无法 steer turn" },
      { status: 502 }
    );
  }
}
