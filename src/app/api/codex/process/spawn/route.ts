import { NextResponse } from "next/server";
import { getAppServerGateway } from "../../../../../server/app-server/runtime";
import { isRequestAuthenticated } from "../../../../../server/auth";
import { assertRuntimePathAllowed, audit } from "../../../../../server/security";

export async function POST(request: Request): Promise<Response> {
  if (!isRequestAuthenticated(request)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  try {
    const body = (await request.json()) as { command?: unknown; cwd?: unknown };
    if (!Array.isArray(body.command) || !body.command.every((item) => typeof item === "string") || !body.command.length) {
      return NextResponse.json({ ok: false, error: "command 不能为空" }, { status: 400 });
    }
    if (typeof body.cwd !== "string" || !body.cwd.trim()) {
      return NextResponse.json({ ok: false, error: "cwd 不能为空" }, { status: 400 });
    }

    const cwd = assertRuntimePathAllowed(body.cwd);
    await audit("process.spawn", { command: body.command, cwd });
    const session = await getAppServerGateway().startProcessSession({ command: body.command, cwd });
    return NextResponse.json({ ok: true, session });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "无法启动终端会话" },
      { status: 502 }
    );
  }
}
