import {
  audit,
  badRequest,
  getAppServerGateway,
  nonEmptyString,
  ok,
  readJsonRecord,
  serverError,
  unauthorized
} from "../../../_route-helpers";

export async function POST(request: Request): Promise<Response> {
  const auth = unauthorized(request);
  if (auth) {
    return auth;
  }

  try {
    const body = await readJsonRecord(request);
    const remotePluginId = nonEmptyString(body.remotePluginId);
    if (!remotePluginId) {
      return badRequest("remotePluginId 不能为空");
    }

    await audit("plugin.share.delete", { remotePluginId });
    const result = await getAppServerGateway().deletePluginShare(remotePluginId);
    return ok({ result });
  } catch (error) {
    return serverError(error, "无法删除 plugin share");
  }
}
