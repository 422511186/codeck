import { NextResponse } from "next/server";
import { getAppServerGateway } from "../../../../../../server/app-server/runtime";
import { isRequestAuthenticated } from "../../../../../../server/auth";
import { audit } from "../../../../../../server/security";

export async function POST(
  request: Request,
  context: { params: Promise<{ processId: string }> }
): Promise<Response> {
  if (!isRequestAuthenticated(request)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  try {
    const { processId } = await context.params;
    await audit("commandExec.terminate", { processId });
    await getAppServerGateway().terminateCommandExecSession(processId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "无法终止 command exec 会话" },
      { status: 502 }
    );
  }
}
