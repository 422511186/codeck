import { NextResponse } from "next/server";
import { getAppServerGateway } from "../../../../server/app-server/runtime";
import { isRequestAuthenticated } from "../../../../server/auth";

export async function GET(request: Request): Promise<Response> {
  if (!isRequestAuthenticated(request)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const cursor = url.searchParams.get("cursor");
    const page = await getAppServerGateway().listThreads({
      limit: 30,
      cursor,
      sortKey: "updated_at",
      sortDirection: "desc"
    });

    return NextResponse.json({ ok: true, ...page });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "无法读取会话历史" },
      { status: 502 }
    );
  }
}
