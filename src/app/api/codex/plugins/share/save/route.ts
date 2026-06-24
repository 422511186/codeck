import {
  audit,
  badRequest,
  getAppServerGateway,
  nonEmptyString,
  ok,
  optionalString,
  readJsonRecord,
  serverError,
  unauthorized
} from "../../../_route-helpers";
import type { MobilePluginShareTarget } from "../../../../../../shared/codex";

export async function POST(request: Request): Promise<Response> {
  const auth = unauthorized(request);
  if (auth) {
    return auth;
  }

  try {
    const body = await readJsonRecord(request);
    const pluginPath = nonEmptyString(body.pluginPath);
    if (!pluginPath) {
      return badRequest("pluginPath 不能为空");
    }
    const shareTargets = Array.isArray(body.shareTargets) ? (body.shareTargets as MobilePluginShareTarget[]) : null;

    await audit("plugin.share.save", { pluginPath, remotePluginId: optionalString(body.remotePluginId) });
    const result = await getAppServerGateway().savePluginShare({
      pluginPath,
      remotePluginId: optionalString(body.remotePluginId),
      discoverability: optionalString(body.discoverability),
      shareTargets
    });
    return ok({ result });
  } catch (error) {
    return serverError(error, "无法保存 plugin share");
  }
}
