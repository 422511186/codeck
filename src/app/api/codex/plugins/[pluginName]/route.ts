import { NextResponse } from "next/server";
import { getAppServerGateway } from "../../../../../server/app-server/runtime";
import { isRequestAuthenticated } from "../../../../../server/auth";
import { audit } from "../../../../../server/security";

export async function POST(
  request: Request,
  context: { params: Promise<{ pluginName: string }> }
): Promise<Response> {
  if (!isRequestAuthenticated(request)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  try {
    const { pluginName } = await context.params;
    const body = (await request.json().catch(() => ({}))) as {
      marketplaceName?: string | null;
      marketplacePath?: string | null;
    };
    await audit("plugin.read", { pluginName, marketplaceName: body.marketplaceName ?? null });
    const plugin = await getAppServerGateway().readPlugin({
      marketplacePath: body.marketplacePath ?? null,
      remoteMarketplaceName: body.marketplacePath ? null : body.marketplaceName ?? null,
      pluginName
    });
    return NextResponse.json({ ok: true, plugin });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "无法读取插件详情" },
      { status: 502 }
    );
  }
}
