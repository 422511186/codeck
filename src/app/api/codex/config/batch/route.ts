import { NextResponse } from "next/server";
import { getAppServerGateway } from "../../../../../server/app-server/runtime";
import { isRequestAuthenticated } from "../../../../../server/auth";
import { audit } from "../../../../../server/security";
import { assertConfigEdit } from "../config-write-policy";

export async function POST(request: Request): Promise<Response> {
  if (!isRequestAuthenticated(request)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  try {
    const body = (await request.json()) as { edits?: unknown };
    if (!Array.isArray(body.edits) || !body.edits.length) {
      return NextResponse.json({ ok: false, error: "edits 不能为空" }, { status: 400 });
    }

    const edits = body.edits.map(assertConfigEdit);
    await audit("config.batchWrite", { keyPaths: edits.map((edit) => edit.keyPath) });
    const result = await getAppServerGateway().writeConfigBatch(edits);
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "无法批量写入全局配置" },
      { status: 400 }
    );
  }
}
