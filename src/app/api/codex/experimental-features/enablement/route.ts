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
      name?: string;
      enabled?: boolean;
    };
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) {
      return NextResponse.json({ ok: false, error: "缺少实验功能名称" }, { status: 400 });
    }

    const enabled = Boolean(body.enabled);
    await audit("experimentalFeature.enablement.set", { name, enabled });
    await getAppServerGateway().setExperimentalFeatureEnablement(name, enabled);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "无法设置实验功能" },
      { status: 502 }
    );
  }
}
