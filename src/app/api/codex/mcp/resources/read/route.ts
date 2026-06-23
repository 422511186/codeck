import { NextResponse } from "next/server";
import { getAppServerGateway } from "../../../../../../server/app-server/runtime";
import { isRequestAuthenticated } from "../../../../../../server/auth";
import { audit } from "../../../../../../server/security";

export async function POST(request: Request): Promise<Response> {
  if (!isRequestAuthenticated(request)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  try {
    const body = (await request.json()) as { server?: unknown; uri?: unknown; threadId?: unknown };
    if (typeof body.server !== "string" || !body.server.trim()) {
      return NextResponse.json({ ok: false, error: "server 不能为空" }, { status: 400 });
    }
    if (typeof body.uri !== "string" || !body.uri.trim()) {
      return NextResponse.json({ ok: false, error: "uri 不能为空" }, { status: 400 });
    }

    const threadId = typeof body.threadId === "string" && body.threadId.trim() ? body.threadId : null;
    await audit("mcp.resource.read", { server: body.server, uri: body.uri, threadId });
    const resource = await getAppServerGateway().readMcpResource({
      server: body.server,
      uri: body.uri,
      threadId
    });
    return NextResponse.json({ ok: true, resource });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "无法读取 MCP 资源" },
      { status: 502 }
    );
  }
}
