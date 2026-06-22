import { NextResponse } from "next/server";
import { getAppServerGateway } from "../../../../../server/app-server/runtime";
import { isRequestAuthenticated } from "../../../../../server/auth";
import { audit } from "../../../../../server/security";

export async function POST(request: Request): Promise<Response> {
  if (!isRequestAuthenticated(request)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  try {
    await audit("remoteControl.pairing.start", {});
    const pairing = await getAppServerGateway().startRemoteControlPairing();
    return NextResponse.json({ ok: true, pairing });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "无法开始配对" },
      { status: 502 }
    );
  }
}
