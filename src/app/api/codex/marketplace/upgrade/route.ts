import {
  audit,
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
    const marketplaceName = optionalString(body.marketplaceName);
    await audit("marketplace.upgrade", { marketplaceName });
    const result = await getAppServerGateway().upgradeMarketplace(marketplaceName);
    return ok({ result });
  } catch (error) {
    return serverError(error, "无法升级 marketplace");
  }
}
