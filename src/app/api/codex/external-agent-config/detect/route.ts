import {
  assertAllowedPath,
  audit,
  badRequest,
  getAppServerGateway,
  ok,
  optionalStrictStringArray,
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
    if (body.includeHome !== undefined && typeof body.includeHome !== "boolean") {
      return badRequest("includeHome 必须是 boolean");
    }

    const includeHome = body.includeHome;
    const cwds = optionalStrictStringArray(body.cwds, "cwds")?.map((cwd) => assertAllowedPath(cwd, "cwd"));

    await audit("externalAgentConfig.detect", { includeHome: includeHome ?? null, cwdCount: cwds?.length ?? 0 });
    const result = await getAppServerGateway().detectExternalAgentConfig({ includeHome, cwds });
    return ok({ result });
  } catch (error) {
    return serverError(error, "无法检测 external agent config");
  }
}
