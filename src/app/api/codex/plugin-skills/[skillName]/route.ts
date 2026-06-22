import { NextResponse } from "next/server";
import { getAppServerGateway } from "../../../../../server/app-server/runtime";
import { isRequestAuthenticated } from "../../../../../server/auth";
import { audit } from "../../../../../server/security";

export async function POST(
  request: Request,
  context: { params: Promise<{ skillName: string }> }
): Promise<Response> {
  if (!isRequestAuthenticated(request)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  try {
    const { skillName } = await context.params;
    const body = (await request.json().catch(() => ({}))) as {
      remoteMarketplaceName?: string;
      remotePluginId?: string;
    };
    if (!body.remoteMarketplaceName || !body.remotePluginId) {
      return NextResponse.json({ ok: false, error: "缺少插件 Skill 定位参数" }, { status: 400 });
    }

    await audit("plugin.skill.read", {
      skillName,
      remoteMarketplaceName: body.remoteMarketplaceName,
      remotePluginId: body.remotePluginId
    });
    const skill = await getAppServerGateway().readPluginSkill({
      remoteMarketplaceName: body.remoteMarketplaceName,
      remotePluginId: body.remotePluginId,
      skillName
    });
    return NextResponse.json({ ok: true, skill });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "无法读取插件 Skill" },
      { status: 502 }
    );
  }
}
