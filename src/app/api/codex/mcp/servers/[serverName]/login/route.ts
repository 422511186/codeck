import { NextResponse } from "next/server";
import { getAppServerGateway } from "../../../../../../../server/app-server/runtime";
import { isRequestAuthenticated } from "../../../../../../../server/auth";
import { audit } from "../../../../../../../server/security";

export async function POST(
  request: Request,
  context: { params: Promise<{ serverName: string }> }
): Promise<Response> {
  if (!isRequestAuthenticated(request)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  try {
    const { serverName } = await context.params;
    await audit("mcp.server.oauthLogin", { serverName });
    const login = await getAppServerGateway().loginMcpServer(serverName);
    return NextResponse.json({ ok: true, login });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "无法启动 MCP 登录" },
      { status: 502 }
    );
  }
}
