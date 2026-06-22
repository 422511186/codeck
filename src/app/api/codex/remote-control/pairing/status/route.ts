import { NextResponse } from "next/server";
import { getAppServerGateway } from "../../../../../../server/app-server/runtime";
import { isRequestAuthenticated } from "../../../../../../server/auth";
import { audit } from "../../../../../../server/security";

export async function POST(request: Request): Promise<Response> {
  if (!isRequestAuthenticated(request)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as {
      pairingCode?: string | null;
      manualPairingCode?: string | null;
    };
    await audit("remoteControl.pairing.status", {
      hasPairingCode: Boolean(body.pairingCode),
      hasManualPairingCode: Boolean(body.manualPairingCode)
    });
    const pairingStatus = await getAppServerGateway().readRemoteControlPairingStatus({
      pairingCode: body.pairingCode ?? null,
      manualPairingCode: body.manualPairingCode ?? null
    });
    return NextResponse.json({ ok: true, pairingStatus });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "无法读取配对状态" },
      { status: 502 }
    );
  }
}
