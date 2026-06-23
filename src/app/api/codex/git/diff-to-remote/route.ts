import { NextResponse } from "next/server";
import { getAppServerGateway } from "../../../../../server/app-server/runtime";
import { isRequestAuthenticated } from "../../../../../server/auth";
import { assertRuntimePathAllowed } from "../../../../../server/security";

export async function GET(request: Request): Promise<Response> {
  if (!isRequestAuthenticated(request)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const cwd = url.searchParams.get("cwd")?.trim();
    if (!cwd) {
      return NextResponse.json({ ok: false, error: "cwd 不能为空" }, { status: 400 });
    }

    const diff = await getAppServerGateway().gitDiffToRemote(assertRuntimePathAllowed(cwd));
    return NextResponse.json({ ok: true, diff });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "无法读取远端 Git diff" },
      { status: 502 }
    );
  }
}
