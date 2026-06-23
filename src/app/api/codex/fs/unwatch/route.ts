import { NextResponse } from "next/server";
import { getAppServerGateway } from "../../../../../server/app-server/runtime";
import { isRequestAuthenticated } from "../../../../../server/auth";
import { audit } from "../../../../../server/security";

export async function POST(request: Request): Promise<Response> {
  if (!isRequestAuthenticated(request)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  try {
    const body = (await request.json()) as { watchId?: unknown };
    if (typeof body.watchId !== "string" || !body.watchId.trim()) {
      return NextResponse.json({ ok: false, error: "watchId 不能为空" }, { status: 400 });
    }

    await audit("fs.unwatch", { watchId: body.watchId });
    await getAppServerGateway().unwatchPath(body.watchId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "无法停止监听文件变化" },
      { status: 502 }
    );
  }
}
