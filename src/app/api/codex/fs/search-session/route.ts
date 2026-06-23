import { NextResponse } from "next/server";
import { getAppServerGateway } from "../../../../../server/app-server/runtime";
import { isRequestAuthenticated } from "../../../../../server/auth";
import { assertRuntimePathAllowed } from "../../../../../server/security";

function readAllowedRoots(value: unknown): string[] {
  if (!Array.isArray(value) || !value.every((root) => typeof root === "string" && root.trim())) {
    throw new Error("roots 必须是路径数组");
  }

  return value.map((root) => assertRuntimePathAllowed(root));
}

export async function POST(request: Request): Promise<Response> {
  if (!isRequestAuthenticated(request)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  try {
    const body = (await request.json()) as { roots?: unknown };
    const roots = readAllowedRoots(body.roots);
    const session = await getAppServerGateway().startFileSearchSession(roots);
    return NextResponse.json({ ok: true, session });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "无法开始会话式文件搜索" },
      { status: 400 }
    );
  }
}

export async function PUT(request: Request): Promise<Response> {
  if (!isRequestAuthenticated(request)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  try {
    const body = (await request.json()) as { sessionId?: unknown; query?: unknown };
    if (typeof body.sessionId !== "string" || !body.sessionId.trim()) {
      return NextResponse.json({ ok: false, error: "sessionId 不能为空" }, { status: 400 });
    }
    if (typeof body.query !== "string") {
      return NextResponse.json({ ok: false, error: "query 必须是字符串" }, { status: 400 });
    }

    await getAppServerGateway().updateFileSearchSession(body.sessionId.trim(), body.query);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "无法更新会话式文件搜索" },
      { status: 502 }
    );
  }
}

export async function DELETE(request: Request): Promise<Response> {
  if (!isRequestAuthenticated(request)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  try {
    const body = (await request.json()) as { sessionId?: unknown };
    if (typeof body.sessionId !== "string" || !body.sessionId.trim()) {
      return NextResponse.json({ ok: false, error: "sessionId 不能为空" }, { status: 400 });
    }

    await getAppServerGateway().stopFileSearchSession(body.sessionId.trim());
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "无法停止会话式文件搜索" },
      { status: 502 }
    );
  }
}
