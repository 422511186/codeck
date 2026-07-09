import {
  audit,
  getAppServerGateway,
  ok,
  readOptionalJsonRecord,
  requireNonEmptyString,
  serverError,
  unauthorized
} from "../../_route-helpers";

export async function POST(
  request: Request,
  context: { params: Promise<{ skillName: string }> }
): Promise<Response> {
  const auth = unauthorized(request);
  if (auth) {
    return auth;
  }

  try {
    const { skillName } = await context.params;
    const body = await readOptionalJsonRecord(request);
    const remoteMarketplaceName = requireNonEmptyString(body.remoteMarketplaceName, "remoteMarketplaceName");
    const remotePluginId = requireNonEmptyString(body.remotePluginId, "remotePluginId");

    await audit("plugin.skill.read", {
      skillName,
      remoteMarketplaceName,
      remotePluginId
    });
    const skill = await getAppServerGateway().readPluginSkill({
      remoteMarketplaceName,
      remotePluginId,
      skillName
    });
    return ok({ skill });
  } catch (error) {
    return serverError(error, "无法读取插件 Skill");
  }
}
