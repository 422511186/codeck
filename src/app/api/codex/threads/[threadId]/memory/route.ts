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
    const body = (await request.json()) as { mode?: string };
    if (body.mode !== "enabled" && body.mode !== "disabled") {
      return NextResponse.json({ ok: false, error: "记忆模式必须是 enabled 或 disabled" }, { status: 400 });
    }

    await audit("thread.memoryMode.set", { threadId, mode: body.mode });
    await getAppServerGateway().setThreadMemoryMode(threadId, body.mode);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "无法切换记忆模式" },
      { status: 502 }
    );
  }
}
