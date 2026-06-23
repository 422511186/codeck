import { NextResponse } from "next/server";
import { getAppServerGateway } from "../../../../../../server/app-server/runtime";
import { isRequestAuthenticated } from "../../../../../../server/auth";
import { audit } from "../../../../../../server/security";

export async function POST(request: Request): Promise<Response> {
  if (!isRequestAuthenticated(request)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  try {
    const body = (await request.json()) as { apiKey?: unknown };
    if (typeof body.apiKey !== "string" || !body.apiKey.trim()) {
      return NextResponse.json({ ok: false, error: "apiKey 不能为空" }, { status: 400 });
    }

    await audit("account.login.apiKey", { keyLength: body.apiKey.length });
    const login = await getAppServerGateway().loginWithApiKey(body.apiKey);
    return NextResponse.json({ ok: true, login });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "无法使用 API Key 登录" },
      { status: 502 }
    );
  }
}
