import {
  audit,
  getAppServerGateway,
  ok,
  readOptionalJsonRecord,
  requireNonEmptyString,
  serverError,
  unauthorized
} from "../../../../_route-helpers";

export async function POST(
  request: Request,
  context: { params: Promise<{ clientId: string }> }
): Promise<Response> {
  const auth = unauthorized(request);
  if (auth) {
    return auth;
  }

  try {
    const { clientId } = await context.params;
    const body = await readOptionalJsonRecord(request);
    const environmentId = requireNonEmptyString(body.environmentId, "environmentId");

    await audit("remoteControl.client.revoke", { environmentId, clientId });
    await getAppServerGateway().revokeRemoteControlClient(environmentId, clientId);
    return ok();
  } catch (error) {
    return serverError(error, "无法撤销远程客户端");
  }
}
