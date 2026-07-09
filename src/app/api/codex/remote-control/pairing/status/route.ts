import {
  audit,
  getAppServerGateway,
  ok,
  optionalStrictNullableString,
  readOptionalJsonRecord,
  serverError,
  unauthorized
} from "../../../_route-helpers";

export async function POST(request: Request): Promise<Response> {
  const auth = unauthorized(request);
  if (auth) {
    return auth;
  }

  try {
    const body = await readOptionalJsonRecord(request);
    const pairingCode = optionalStrictNullableString(body.pairingCode, "pairingCode");
    const manualPairingCode = optionalStrictNullableString(body.manualPairingCode, "manualPairingCode");
    await audit("remoteControl.pairing.status", {
      hasPairingCode: Boolean(pairingCode),
      hasManualPairingCode: Boolean(manualPairingCode)
    });
    const pairingStatus = await getAppServerGateway().readRemoteControlPairingStatus({
      pairingCode: pairingCode ?? null,
      manualPairingCode: manualPairingCode ?? null
    });
    return ok({ pairingStatus });
  } catch (error) {
    return serverError(error, "无法读取配对状态");
  }
}
