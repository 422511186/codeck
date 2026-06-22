import { NextResponse } from "next/server";
import { getAppServerGateway } from "../../../../../../server/app-server/runtime";
import { isRequestAuthenticated } from "../../../../../../server/auth";

export async function GET(
  request: Request,
  context: { params: Promise<{ threadId: string }> }
): Promise<Response> {
  if (!isRequestAuthenticated(request)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  try {
    const { threadId } = await context.params;
    const url = new URL(request.url);
    const limit = url.searchParams.get("limit");
    const page = await getAppServerGateway().listThreadTurns({
      threadId,
      cursor: url.searchParams.get("cursor"),
      limit: limit ? Number(limit) : undefined
    });
    return NextResponse.json({ ok: true, page });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "无法读取 turn 分页" },
      { status: 502 }
    );
  }
}
