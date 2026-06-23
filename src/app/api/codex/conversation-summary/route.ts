import { NextResponse } from "next/server";
import { getAppServerGateway } from "../../../../server/app-server/runtime";
import { isRequestAuthenticated } from "../../../../server/auth";

export async function GET(request: Request): Promise<Response> {
  if (!isRequestAuthenticated(request)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const threadId = url.searchParams.get("threadId")?.trim();
    if (!threadId) {
      return NextResponse.json({ ok: false, error: "threadId 不能为空" }, { status: 400 });
    }

    const summary = await getAppServerGateway().getConversationSummary({ conversationId: threadId });
    return NextResponse.json({ ok: true, summary });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "无法读取会话摘要" },
      { status: 502 }
    );
  }
}
