import { NextResponse } from "next/server";
import { getAppServerGateway } from "../../../../../server/app-server/runtime";
import { isRequestAuthenticated } from "../../../../../server/auth";
import { assertRuntimePathAllowed, audit } from "../../../../../server/security";

export async function POST(request: Request): Promise<Response> {
  if (!isRequestAuthenticated(request)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  try {
    const body = (await request.json()) as { path?: unknown };
    if (typeof body.path !== "string" || !body.path.trim()) {
      return NextResponse.json({ ok: false, error: "path 不能为空" }, { status: 400 });
    }

    const path = assertRuntimePathAllowed(body.path);
    await audit("fs.watch", { path });
    const watch = await getAppServerGateway().watchPath(path);
    return NextResponse.json({ ok: true, watch });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "无法监听文件变化" },
      { status: 502 }
    );
  }
}
