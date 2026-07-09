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
  context: { params: Promise<{ threadId: string }> }
): Promise<Response> {
  const auth = unauthorized(request);
  if (auth) {
    return auth;
  }

  try {
    const { threadId } = await context.params;
    const body = await readJsonRecord(request);
    if (body.mode !== "enabled" && body.mode !== "disabled") {
      throw new RouteValidationError("记忆模式必须是 enabled 或 disabled");
    }

    await audit("thread.memoryMode.set", { threadId, mode: body.mode });
    await getAppServerGateway().setThreadMemoryMode(threadId, body.mode);
    return ok();
  } catch (error) {
    return serverError(error, "无法切换记忆模式");
  }
}
