import { NextResponse } from "next/server";
import { getAppServerGateway } from "../../../../../../../server/app-server/runtime";
import { isRequestAuthenticated } from "../../../../../../../server/auth";
import { audit } from "../../../../../../../server/security";

export async function POST(
  request: Request,
  context: { params: Promise<{ clientId: string }> }
): Promise<Response> {
  if (!isRequestAuthenticated(request)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  try {
    const { clientId } = await context.params;
    const body = (await request.json().catch(() => ({}))) as { environmentId?: string };
    if (!body.environmentId) {
      return NextResponse.json({ ok: false, error: "缺少 environmentId" }, { status: 400 });
    }

    await audit("remoteControl.client.revoke", { environmentId: body.environmentId, clientId });
    await getAppServerGateway().revokeRemoteControlClient(body.environmentId, clientId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "无法撤销远程客户端" },
      { status: 502 }
    );
  }
}
