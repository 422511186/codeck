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
    if (!text) {
      return badRequest("text 不能为空");
    }

    await audit("thread.realtime.appendSpeech", { threadId, textLength: text.length });
    const result = await getAppServerGateway().appendThreadRealtimeSpeech({ threadId, text });
    return ok({ result });
  } catch (error) {
    return serverError(error, "无法追加 realtime speech");
  }
}
