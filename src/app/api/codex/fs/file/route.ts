import { NextResponse } from "next/server";
import { getAppServerGateway } from "../../../../../server/app-server/runtime";
import { isRequestAuthenticated } from "../../../../../server/auth";
import { assertRuntimePathAllowed, audit } from "../../../../../server/security";

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
    const file = await getAppServerGateway().readFile(allowedPath);
    return NextResponse.json({ ok: true, file });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "无法读取文件" },
      { status: 502 }
    );
  }
}

export async function PUT(request: Request): Promise<Response> {
  if (!isRequestAuthenticated(request)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  try {
    const body = (await request.json()) as { path?: unknown; text?: unknown };
    if (typeof body.path !== "string" || !body.path.trim()) {
      return NextResponse.json({ ok: false, error: "path 不能为空" }, { status: 400 });
    }
    if (typeof body.text !== "string") {
      return NextResponse.json({ ok: false, error: "text 必须是字符串" }, { status: 400 });
    }

    const allowedPath = assertRuntimePathAllowed(body.path);
    await audit("fs.file.write", { path: allowedPath, length: body.text.length });
    await getAppServerGateway().writeFile(allowedPath, body.text);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "无法写入文件" },
      { status: 502 }
    );
  }
}
