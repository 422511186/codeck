import { NextResponse } from "next/server";
import { getAppServerGateway } from "../../../../../../../server/app-server/runtime";
import { isRequestAuthenticated } from "../../../../../../../server/auth";
import { audit } from "../../../../../../../server/security";
import type { MobileJsonValue } from "../../../../../../../shared/codex";

export async function POST(
  request: Request,
  context: { params: Promise<{ threadId: string }> }
): Promise<Response> {
  if (!isRequestAuthenticated(request)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  try {
    const { threadId } = await context.params;
    const body = (await request.json()) as { event?: unknown };
    if (body.event === undefined) {
      return NextResponse.json({ ok: false, error: "event 不能为空" }, { status: 400 });
    }

    await audit("thread.guardian.approveDeniedAction", { threadId });
    await getAppServerGateway().approveGuardianDeniedAction(threadId, body.event as MobileJsonValue);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "无法批准 Guardian 拦截动作" },
      { status: 502 }
    );
  }
}
