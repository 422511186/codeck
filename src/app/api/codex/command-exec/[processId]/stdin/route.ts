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
    const body = (await request.json()) as { text?: string };
    await audit("commandExec.stdin", { processId, byteLength: Buffer.byteLength(body.text || "", "utf8") });
    await getAppServerGateway().writeCommandExecStdin(processId, body.text || "");
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "无法写入 command exec 输入" },
      { status: 502 }
    );
  }
}
