import { audit, badRequest, getAppServerGateway, ok, serverError, unauthorized } from "../../../../_route-helpers";

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
    if (!threadId) {
      return badRequest("threadId 不能为空");
    }

    await audit("thread.realtime.stop", { threadId });
    const result = await getAppServerGateway().stopThreadRealtime(threadId);
    return ok({ result });
  } catch (error) {
    return serverError(error, "无法停止 realtime 会话");
  }
}
