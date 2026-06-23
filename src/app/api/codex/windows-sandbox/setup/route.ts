import { NextResponse } from "next/server";
import { getAppServerGateway } from "../../../../../server/app-server/runtime";
import { isRequestAuthenticated } from "../../../../../server/auth";
import { audit } from "../../../../../server/security";

type WindowsSandboxSetupMode = "elevated" | "unelevated";

function isSetupMode(value: unknown): value is WindowsSandboxSetupMode {
  return value === "elevated" || value === "unelevated";
}

export async function POST(request: Request): Promise<Response> {
  if (!isRequestAuthenticated(request)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as { mode?: unknown; cwd?: unknown };
    if (!isSetupMode(body.mode)) {
      return NextResponse.json({ ok: false, error: "mode 只能是 elevated 或 unelevated" }, { status: 400 });
    }

    const cwd = typeof body.cwd === "string" && body.cwd.trim() ? body.cwd.trim() : null;
    await audit("windowsSandbox.setupStart", { mode: body.mode, cwd });
    const result = await getAppServerGateway().startWindowsSandboxSetup({ mode: body.mode, cwd });
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "无法启动 Windows Sandbox 设置" },
      { status: 502 }
    );
  }
}
