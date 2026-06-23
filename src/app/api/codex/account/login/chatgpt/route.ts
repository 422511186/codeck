import { NextResponse } from "next/server";
import { getAppServerGateway } from "../../../../../../server/app-server/runtime";
import { isRequestAuthenticated } from "../../../../../../server/auth";
import { audit } from "../../../../../../server/security";

export async function POST(request: Request): Promise<Response> {
  if (!isRequestAuthenticated(request)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  try {
    await audit("account.login.chatgpt", {});
    const login = await getAppServerGateway().loginWithChatGpt();
    return NextResponse.json({ ok: true, login });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "无法启动 ChatGPT 登录" },
      { status: 502 }
    );
  }
}
