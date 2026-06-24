import {
  audit,
  getAppServerGateway,
  ok,
  optionalStringArray,
  readJsonRecord,
  serverError,
  unauthorized
} from "../../_route-helpers";

export async function POST(request: Request): Promise<Response> {
  const auth = unauthorized(request);
  if (auth) {
    return auth;
  }

  try {
    const body = await readJsonRecord(request);
    const includeHome = typeof body.includeHome === "boolean" ? body.includeHome : undefined;
    const cwds = optionalStringArray(body.cwds);

    await audit("externalAgentConfig.detect", { includeHome: includeHome ?? null, cwdCount: cwds?.length ?? 0 });
    const result = await getAppServerGateway().detectExternalAgentConfig({ includeHome, cwds });
    return ok({ result });
  } catch (error) {
    return serverError(error, "无法检测 external agent config");
  }
}
