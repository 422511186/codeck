import {
  audit,
  badRequest,
  getAppServerGateway,
  ok,
  optionalString,
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
    if (typeof body.enabled !== "boolean") {
      return badRequest("enabled 必须是 boolean");
    }

    const name = optionalString(body.name);
    const path = optionalString(body.path);
    if (!name && !path) {
      return badRequest("name 或 path 不能为空");
    }

    await audit("skills.config.write", {
      name,
      hasPath: Boolean(path),
      enabled: body.enabled
    });
    const result = await getAppServerGateway().writeSkillConfig({
      name,
      path,
      enabled: body.enabled
    });
    return ok({ result });
  } catch (error) {
    return serverError(error, "无法写入 Skill 配置");
  }
}
