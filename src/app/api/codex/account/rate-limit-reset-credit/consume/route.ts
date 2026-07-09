import {
  audit,
  getAppServerGateway,
  ok,
  readJsonRecord,
  requireNonEmptyString,
  serverError,
  unauthorized
} from "../../../_route-helpers";

export async function POST(request: Request): Promise<Response> {
  const auth = unauthorized(request);
  if (auth) {
    return auth;
  }

  try {
    const body = await readJsonRecord(request);
    const idempotencyKey = requireNonEmptyString(body.idempotencyKey, "idempotencyKey");
    await audit("account.rateLimitResetCredit.consume", { idempotencyKey });
    const result = await getAppServerGateway().consumeRateLimitResetCredit(idempotencyKey);
    return ok({ result });
  } catch (error) {
    return serverError(error, "无法消费重置额度 credit");
  }
}
