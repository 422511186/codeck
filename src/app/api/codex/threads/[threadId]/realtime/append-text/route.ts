import {
  audit,
  badRequest,
  getAppServerGateway,
  nonEmptyString,
  ok,
  readJsonRecord,
  serverError,
  unauthorized
} from "../../../../_route-helpers";

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

    const body = await readJsonRecord(request);
    const text = nonEmptyString(body.text);
    const role = body.role === "user" || body.role === "developer" ? body.role : null;
    if (!text) {
      return badRequest("text 不能为空");
    }
    if (!role) {
      return badRequest("role 只能是 user 或 developer");
    }

    await audit("thread.realtime.appendText", { threadId, role, textLength: text.length });
    const result = await getAppServerGateway().appendThreadRealtimeText({ threadId, text, role });
    return ok({ result });
  } catch (error) {
    return serverError(error, "无法追加 realtime text");
  }
}
