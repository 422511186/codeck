import { getAppServerGateway, ok, serverError, unauthorized } from "../../_route-helpers";

export async function GET(request: Request): Promise<Response> {
  const auth = unauthorized(request);
  if (auth) {
    return auth;
  }

  try {
    const result = await getAppServerGateway().listThreadRealtimeVoices();
    return ok({ voices: result.voices });
  } catch (error) {
    return serverError(error, "无法读取 realtime voices");
  }
}
