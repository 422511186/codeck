import { NextResponse } from "next/server";
import { getAppServerGateway } from "../../../../../../../server/app-server/runtime";
import { isRequestAuthenticated } from "../../../../../../../server/auth";
import { audit } from "../../../../../../../server/security";

export async function POST(
  request: Request,
  context: { params: Promise<{ loginId: string }> }
): Promise<Response> {
  if (!isRequestAuthenticated(request)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  try {
    const { loginId } = await context.params;
    await audit("account.login.cancel", { loginId });
    const result = await getAppServerGateway().cancelAccountLogin(loginId);
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "无法取消账号登录" },
      { status: 502 }
    );
  }
}
