import { NextResponse } from "next/server";
import { getAppServerGateway } from "../../../../../server/app-server/runtime";
import { isRequestAuthenticated } from "../../../../../server/auth";
import { assertRuntimePathAllowed, audit } from "../../../../../server/security";

export async function POST(request: Request): Promise<Response> {
  if (!isRequestAuthenticated(request)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  try {
    const body = (await request.json()) as { command?: string[]; cwd?: string; timeoutMs?: number };
    if (!body.command?.length) {
      return NextResponse.json({ ok: false, error: "command 不能为空" }, { status: 400 });
    }

    const cwd = body.cwd ? assertRuntimePathAllowed(body.cwd) : undefined;
    await audit("terminal.exec", { command: body.command, cwd });
    const result = await getAppServerGateway().execCommand({
      command: body.command,
      cwd,
      timeoutMs: body.timeoutMs
    });
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "无法执行命令" },
      { status: 502 }
    );
  }
}
