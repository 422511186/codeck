import {
  audit,
  getAppServerGateway,
  ok,
  optionalStrictStringArray,
  readOptionalJsonRecord,
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
    const body = await readOptionalJsonRecord(request);
    const numTurns = readNumTurns(body.numTurns);
    const expectedDeletedTurnIds = optionalStrictStringArray(
      body.expectedDeletedTurnIds,
      "expectedDeletedTurnIds"
    ) ?? undefined;
    await audit("thread.rollback", { threadId, numTurns, expectedDeletedTurnIds });
    const thread = await getAppServerGateway().rollbackThread(threadId, numTurns, { expectedDeletedTurnIds });
    return ok({ thread });
  } catch (error) {
    return serverError(error, "无法 rollback 会话");
  }
}

function readNumTurns(value: unknown): number {
  if (value === undefined) {
    return 1;
  }

  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new RouteValidationError("numTurns 必须是正整数");
  }

  return value;
}
