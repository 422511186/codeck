import {
  audit,
  badRequest,
  getAppServerGateway,
  nonEmptyString,
  ok,
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
    const marketplaceName = nonEmptyString(body.marketplaceName);
    if (!marketplaceName) {
      return badRequest("marketplaceName 不能为空");
    }

    await audit("marketplace.remove", { marketplaceName });
    const result = await getAppServerGateway().removeMarketplace(marketplaceName);
    return ok({ result });
  } catch (error) {
    return serverError(error, "无法移除 marketplace");
  }
}
