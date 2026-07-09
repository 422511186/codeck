import {
  audit,
  getAppServerGateway,
  ok,
  readJsonRecord,
  requireNonEmptyString,
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
    const name = requireNonEmptyString(body.name, "会话名称");

    await audit("thread.name.set", { threadId, name });
    const thread = await getAppServerGateway().setThreadName(threadId, name);
    return ok({ thread });
  } catch (error) {
    return serverError(error, "无法重命名会话");
  }
}
