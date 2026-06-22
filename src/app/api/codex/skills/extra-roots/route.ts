import { NextResponse } from "next/server";
import { getAppServerGateway } from "../../../../../server/app-server/runtime";
import { isRequestAuthenticated } from "../../../../../server/auth";
import { audit } from "../../../../../server/security";

export async function POST(request: Request): Promise<Response> {
  if (!isRequestAuthenticated(request)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as { extraRoots?: string[] };
    const extraRoots = Array.isArray(body.extraRoots) ? body.extraRoots : [];
    await audit("skills.extraRoots.set", { count: extraRoots.length });
    await getAppServerGateway().setSkillsExtraRoots(extraRoots);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "无法设置 Skill 根目录" },
      { status: 502 }
    );
  }
}
