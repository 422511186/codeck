import {
  assertAllowedPath,
  getAppServerGateway,
  ok,
  optionalStrictStringArray,
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
    const cwds = optionalStrictStringArray(body.cwds, "cwds")?.map((cwd) => assertAllowedPath(cwd, "cwd"));
    const result = await getAppServerGateway().listInstalledPlugins({
      cwds,
      installSuggestionPluginNames: optionalStringArray(body.installSuggestionPluginNames)
    });
    return ok({ result });
  } catch (error) {
    return serverError(error, "无法读取已安装插件");
  }
}
