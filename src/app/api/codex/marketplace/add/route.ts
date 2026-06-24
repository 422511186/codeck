import {
  audit,
  badRequest,
  getAppServerGateway,
  nonEmptyString,
  ok,
  optionalString,
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
    const source = nonEmptyString(body.source);
    if (!source) {
      return badRequest("source 不能为空");
    }

    await audit("marketplace.add", { source, refName: optionalString(body.refName) });
    const result = await getAppServerGateway().addMarketplace({
      source,
      refName: optionalString(body.refName),
      sparsePaths: optionalStringArray(body.sparsePaths)
    });
    return ok({ result });
  } catch (error) {
    return serverError(error, "无法添加 marketplace");
  }
}
