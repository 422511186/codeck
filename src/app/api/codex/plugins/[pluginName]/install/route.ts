import {
  audit,
  getAppServerGateway,
  ok,
  optionalStrictNullableString,
  readOptionalJsonRecord,
  serverError,
  unauthorized
} from "../../../_route-helpers";

export async function POST(
  request: Request,
  context: { params: Promise<{ pluginName: string }> }
): Promise<Response> {
  const auth = unauthorized(request);
  if (auth) {
    return auth;
  }

  try {
    const { pluginName } = await context.params;
    const body = await readOptionalJsonRecord(request);
    const marketplaceName = optionalStrictNullableString(body.marketplaceName, "marketplaceName");
    const marketplacePath = optionalStrictNullableString(body.marketplacePath, "marketplacePath");
    await audit("plugin.install", { pluginName, marketplaceName: marketplaceName ?? null });
    const result = await getAppServerGateway().installPlugin({
      marketplacePath: marketplacePath ?? null,
      remoteMarketplaceName: marketplacePath ? null : marketplaceName ?? null,
      pluginName
    });
    return ok({ result });
  } catch (error) {
    return serverError(error, "无法安装插件");
  }
}
