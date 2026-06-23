import { NextResponse } from "next/server";
import { getAppServerGateway } from "../../../../../server/app-server/runtime";
import { isRequestAuthenticated } from "../../../../../server/auth";
import { assertRuntimePathAllowed } from "../../../../../server/security";

export async function POST(request: Request): Promise<Response> {
  if (!isRequestAuthenticated(request)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  try {
    const body = (await request.json()) as { query?: unknown; roots?: unknown };
    if (typeof body.query !== "string" || !body.query.trim()) {
      return NextResponse.json({ ok: false, error: "query 不能为空" }, { status: 400 });
    }
    if (!Array.isArray(body.roots) || !body.roots.every((root) => typeof root === "string" && root.trim())) {
      return NextResponse.json({ ok: false, error: "roots 必须是路径数组" }, { status: 400 });
    }

    const roots = body.roots.map((root) => assertRuntimePathAllowed(root));
    const results = await getAppServerGateway().searchFiles({ query: body.query.trim(), roots });
    return NextResponse.json({ ok: true, results });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "无法搜索文件" },
      { status: 502 }
    );
  }
}
