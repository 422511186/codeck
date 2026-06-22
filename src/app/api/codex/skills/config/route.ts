import { NextResponse } from "next/server";
import { getAppServerGateway } from "../../../../../server/app-server/runtime";
import { isRequestAuthenticated } from "../../../../../server/auth";
import { audit } from "../../../../../server/security";

export async function POST(request: Request): Promise<Response> {
  if (!isRequestAuthenticated(request)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as {
      name?: string | null;
      path?: string | null;
      enabled?: boolean;
    };
    await audit("skills.config.write", {
      name: body.name ?? null,
      hasPath: Boolean(body.path),
      enabled: Boolean(body.enabled)
    });
    const result = await getAppServerGateway().writeSkillConfig({
      name: body.name ?? null,
      path: body.path ?? null,
      enabled: Boolean(body.enabled)
    });
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "无法写入 Skill 配置" },
      { status: 502 }
    );
  }
}
