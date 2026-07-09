import {
  audit,
  getAppServerGateway,
  ok,
  readJsonRecord,
  RouteValidationError,
  serverError,
  unauthorized
} from "../../_route-helpers";

type CreditType = "credits" | "usage_limit";

function isCreditType(value: unknown): value is CreditType {
  return value === "credits" || value === "usage_limit";
}

export async function POST(request: Request): Promise<Response> {
  const auth = unauthorized(request);
  if (auth) {
    return auth;
  }

  try {
    const body = await readJsonRecord(request);
    if (!isCreditType(body.creditType)) {
      throw new RouteValidationError("creditType 只能是 credits 或 usage_limit");
    }

    await audit("account.addCreditsNudge.sendEmail", { creditType: body.creditType });
    const result = await getAppServerGateway().sendAddCreditsNudgeEmail(body.creditType);
    return ok({ result });
  } catch (error) {
    return serverError(error, "无法发送加购提醒");
  }
}
