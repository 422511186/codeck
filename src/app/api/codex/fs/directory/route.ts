import { NextResponse } from "next/server";
import { getAppServerGateway } from "../../../../../server/app-server/runtime";
import { isRequestAuthenticated } from "../../../../../server/auth";
import { assertRuntimePathAllowed } from "../../../../../server/security";

export async function GET(request: Request): Promise<Response> {
  if (!isRequestAuthenticated(request)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const url = new URL(request.url);
  const path = url.searchParams.get("path");
  if (!path) {
    return NextResponse.json({ ok: false, error: "path 不能为空" }, { status: 400 });
  }

  try {
    const allowedPath = assertRuntimePathAllowed(path);
    const entries = await getAppServerGateway().readDirectory(allowedPath);
    return NextResponse.json({ ok: true, entries });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "无法读取目录" },
      { status: 502 }
    );
  }
}
