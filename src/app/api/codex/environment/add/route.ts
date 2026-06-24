import {
  audit,
  badRequest,
  getAppServerGateway,
  nonEmptyString,
  ok,
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
    const environmentId = nonEmptyString(body.environmentId);
    const execServerUrl = nonEmptyString(body.execServerUrl);
    if (!environmentId) {
      return badRequest("environmentId 不能为空");
    }
    if (!execServerUrl) {
      return badRequest("execServerUrl 不能为空");
    }

    await audit("environment.add", { environmentId, execServerUrl });
    const result = await getAppServerGateway().addEnvironment({ environmentId, execServerUrl });
    return ok({ result });
  } catch (error) {
    return serverError(error, "无法添加环境");
  }
}
