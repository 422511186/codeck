import { NextResponse } from "next/server";
import { getAppServerGateway } from "../../../../../server/app-server/runtime";
import { isRequestAuthenticated } from "../../../../../server/auth";

export async function GET(
  request: Request,
  context: { params: Promise<{ processId: string }> }
): Promise<Response> {
  if (!isRequestAuthenticated(request)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  try {
    const { processId } = await context.params;
    const session = await getAppServerGateway().readCommandExecSession(processId);
    return NextResponse.json({ ok: true, session });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "无法读取 command exec 会话" },
      { status: 502 }
    );
  }
}
