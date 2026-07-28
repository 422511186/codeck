import {
  audit,
  badRequest,
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
    if (typeof body.value !== "string") {
      throw new RouteValidationError("value 无效");
    }

    await audit("request.resolve", { requestId: id, value: body.value });
    await getAppServerGateway().resolveServerRequest(id, body.value);
    return ok();
  } catch (error) {
    const structured = typeof error === "object" && error !== null
      ? error as { httpStatus?: unknown }
      : null;
    if (structured?.httpStatus === 400) {
      return badRequest(error instanceof Error ? error.message : "审批选项无效或已过期");
    }
    return serverError(error, "无法处理请求");
  }
}
