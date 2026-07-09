import {
  audit,
  getAppServerGateway,
  ok,
  optionalStrictStringArray,
  readOptionalJsonRecord,
  serverError,
  unauthorized
} from "../../_route-helpers";

export async function POST(request: Request): Promise<Response> {
  const auth = unauthorized(request);
  if (auth) {
    return auth;
  }

  try {
    const body = await readOptionalJsonRecord(request);
    const extraRoots = optionalStrictStringArray(body.extraRoots, "extraRoots") ?? [];
    await audit("skills.extraRoots.set", { count: extraRoots.length });
    await getAppServerGateway().setSkillsExtraRoots(extraRoots);
    return ok();
  } catch (error) {
    return serverError(error, "无法设置 Skill 根目录");
  }
}
