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
import type { MobilePluginShareTarget } from "../../../../../../shared/codex";

export async function POST(request: Request): Promise<Response> {
  const auth = unauthorized(request);
  if (auth) {
    return auth;
  }

  try {
    const body = await readJsonRecord(request);
    const remotePluginId = nonEmptyString(body.remotePluginId);
    const discoverability = nonEmptyString(body.discoverability);
    if (!remotePluginId) {
      return badRequest("remotePluginId 不能为空");
    }
    if (!discoverability) {
      return badRequest("discoverability 不能为空");
    }
    if (!Array.isArray(body.shareTargets)) {
      return badRequest("shareTargets 必须是数组");
    }

    const shareTargets = body.shareTargets as MobilePluginShareTarget[];
    await audit("plugin.share.updateTargets", { remotePluginId, targetCount: shareTargets.length });
    const result = await getAppServerGateway().updatePluginShareTargets({ remotePluginId, discoverability, shareTargets });
    return ok({ result });
  } catch (error) {
    return serverError(error, "无法更新 plugin share 目标");
  }
}
