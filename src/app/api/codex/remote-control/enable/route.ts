import { NextResponse } from "next/server";
import { getAppServerGateway } from "../../../../../server/app-server/runtime";
import { isRequestAuthenticated } from "../../../../../server/auth";
import { audit } from "../../../../../server/security";

export async function POST(request: Request): Promise<Response> {
  if (!isRequestAuthenticated(request)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  try {
    await audit("remoteControl.enable", {});
    const status = await getAppServerGateway().enableRemoteControl();
    return NextResponse.json({ ok: true, status });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "无法启用远程控制" },
      { status: 502 }
    );
  }
}
