import { NextResponse } from "next/server";
import { getAppServerGateway } from "../../../../../../server/app-server/runtime";
import { isRequestAuthenticated } from "../../../../../../server/auth";
import { audit } from "../../../../../../server/security";

export async function POST(
  request: Request,
  context: { params: Promise<{ threadId: string }> }
): Promise<Response> {
  if (!isRequestAuthenticated(request)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  try {
    const { threadId } = await context.params;
    const body = (await request.json()) as { command?: unknown };
    if (typeof body.command !== "string" || !body.command.trim()) {
      return NextResponse.json({ ok: false, error: "command 不能为空" }, { status: 400 });
    }

    await audit("thread.shellCommand", { threadId, command: body.command });
    await getAppServerGateway().runThreadShellCommand(threadId, body.command);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "无法执行会话 shell command" },
      { status: 502 }
    );
  }
}
