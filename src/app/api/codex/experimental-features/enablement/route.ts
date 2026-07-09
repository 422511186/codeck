import {
  audit,
  getAppServerGateway,
  ok,
  optionalStrictBoolean,
  readOptionalJsonRecord,
  requireNonEmptyString,
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
    const name = requireNonEmptyString(body.name, "实验功能名称");
    const enabled = optionalStrictBoolean(body.enabled, "enabled") ?? false;
    await audit("experimentalFeature.enablement.set", { name, enabled });
    await getAppServerGateway().setExperimentalFeatureEnablement(name, enabled);
    return ok();
  } catch (error) {
    return serverError(error, "无法设置实验功能");
  }
}
