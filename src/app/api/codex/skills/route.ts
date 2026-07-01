import { NextResponse } from "next/server";
import { getAppServerGateway } from "../../../../server/app-server/runtime";
import { isRequestAuthenticated } from "../../../../server/auth";
import { assertRuntimePathAllowed } from "../../../../server/security";

export async function GET(request: Request): Promise<Response> {
  if (!isRequestAuthenticated(request)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const enabledOnly = url.searchParams.get("enabledOnly") !== "false";
    const cwd = url.searchParams.get("cwd")?.trim();
    const cwds = cwd ? [assertRuntimePathAllowed(cwd)] : undefined;
    const skills = await getAppServerGateway().listSkills({ enabledOnly, cwds });
    return NextResponse.json({ ok: true, ...skills });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "无法读取 Skill 列表" },
      { status: 502 }
    );
  }
}
