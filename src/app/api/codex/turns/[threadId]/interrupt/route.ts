import {
  audit,
  getAppServerGateway,
  ok,
  optionalStrictNonEmptyString,
  readOptionalJsonRecord,
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
    const body = await readOptionalJsonRecord(request);
    const gateway = getAppServerGateway();
    let turnId = optionalStrictNonEmptyString(body.turnId, "turnId") ?? "";

    if (!turnId) {
      const thread = await gateway.readThread(threadId);
      turnId = thread.lastTurnId ?? "";
    }

    if (!turnId) {
      return new Response(JSON.stringify({ ok: false, error: "暂无可中断的 turn" }), {
        status: 409,
        headers: { "content-type": "application/json" }
      });
    }

    await audit("turn.interrupt", { threadId, turnId });
    await gateway.interruptTurn(threadId, turnId);
    return ok();
  } catch (error) {
    return serverError(error, "无法 interrupt turn");
  }
}
