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
    const expectedTurnId = requireNonEmptyString(body.expectedTurnId, "expectedTurnId");
    const text = requireNonEmptyString(body.text, "追加指令");

    await audit("turn.steer", {
      threadId,
      expectedTurnId,
      textLength: text.length
    });
    const result = await getAppServerGateway().steerTurn({
      threadId,
      expectedTurnId,
      text
    });
    const thread = await getAppServerGateway().readThread(threadId);
    return ok({ ...result, thread });
  } catch (error) {
    return serverError(error, "无法 steer turn");
  }
}
