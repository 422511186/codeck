import {
  audit,
  getAppServerGateway,
  ok,
  readJsonRecord,
  RouteValidationError,
  serverError,
  unauthorized
} from "../../../_route-helpers";

export async function POST(
  request: Request,
  context: { params: Promise<{ requestId: string }> }
): Promise<Response> {
  const auth = unauthorized(request);
  if (auth) {
    return auth;
  }

  try {
    const { requestId } = await context.params;
    const id = Number(requestId);
    if (!Number.isInteger(id)) {
      throw new RouteValidationError("requestId 无效");
    }

    const body = await readJsonRecord(request);
    const hasRawResponse = Object.prototype.hasOwnProperty.call(body, "response");
    if (!hasRawResponse && typeof body.value !== "string") {
      throw new RouteValidationError("value 无效");
    }

    await audit("request.resolve", hasRawResponse ? { requestId: id, mode: "raw" } : { requestId: id, value: body.value });
    await getAppServerGateway().resolveServerRequest(
      id,
      typeof body.value === "string" ? body.value : "",
      hasRawResponse ? { response: body.response } : undefined
    );
    return ok();
  } catch (error) {
    return serverError(error, "无法处理请求");
  }
}
