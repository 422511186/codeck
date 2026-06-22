import { NextResponse } from "next/server";
import { getAppServerGateway } from "../../../../../server/app-server/runtime";
import { isRequestAuthenticated } from "../../../../../server/auth";
import { assertRuntimePathAllowed, audit } from "../../../../../server/security";

export async function POST(request: Request): Promise<Response> {
  if (!isRequestAuthenticated(request)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  try {
    const body = (await request.json()) as { sourcePath?: unknown; destinationPath?: unknown };
    if (typeof body.sourcePath !== "string" || !body.sourcePath.trim()) {
      return NextResponse.json({ ok: false, error: "sourcePath 不能为空" }, { status: 400 });
    }
    if (typeof body.destinationPath !== "string" || !body.destinationPath.trim()) {
      return NextResponse.json({ ok: false, error: "destinationPath 不能为空" }, { status: 400 });
    }

    const sourcePath = assertRuntimePathAllowed(body.sourcePath);
    const destinationPath = assertRuntimePathAllowed(body.destinationPath);
    await audit("fs.path.copy", { sourcePath, destinationPath });
    await getAppServerGateway().copyPath(sourcePath, destinationPath);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "无法复制路径" },
      { status: 502 }
    );
  }
}
