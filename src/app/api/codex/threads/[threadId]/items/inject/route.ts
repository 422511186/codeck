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
    const body = (await request.json()) as { items?: unknown };
    if (!Array.isArray(body.items)) {
      return NextResponse.json({ ok: false, error: "items 必须是数组" }, { status: 400 });
    }

    await audit("thread.items.inject", { threadId, count: body.items.length });
    await getAppServerGateway().injectThreadItems(threadId, body.items as MobileJsonValue[]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "无法注入会话 items" },
      { status: 502 }
    );
  }
}
