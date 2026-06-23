import { NextResponse } from "next/server";
import { getAppServerGateway } from "../../../../../../server/app-server/runtime";
import { isRequestAuthenticated } from "../../../../../../server/auth";
import { audit } from "../../../../../../server/security";

function positiveInteger(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : fallback;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ processId: string }> }
): Promise<Response> {
  if (!isRequestAuthenticated(request)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  try {
    const { processId } = await context.params;
    const body = (await request.json()) as { cols?: number; rows?: number };
    const cols = positiveInteger(body.cols, 80);
    const rows = positiveInteger(body.rows, 24);
    await audit("commandExec.resize", { processId, cols, rows });
    await getAppServerGateway().resizeCommandExecSession(processId, cols, rows);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "无法调整 command exec 尺寸" },
      { status: 502 }
    );
  }
}
