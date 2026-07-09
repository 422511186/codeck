import {
  audit,
  getAppServerGateway,
  ok,
  readJsonRecord,
  requireNonEmptyString,
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
    const objective = requireNonEmptyString(body.objective, "会话目标");
    const tokenBudget = readTokenBudget(body.tokenBudget);

    await audit("thread.goal.set", { threadId, objectiveLength: objective.length, tokenBudget });
    const goal = await getAppServerGateway().setThreadGoal({
      threadId,
      objective,
      tokenBudget
    });
    return ok({ goal });
  } catch (error) {
    return serverError(error, "无法设置会话目标");
  }
}

function readTokenBudget(value: unknown): number | null | undefined {
  if (value === undefined || value === null) {
    return value;
  }

  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new RouteValidationError("token budget 必须是非负数字");
  }

  return value;
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ threadId: string }> }
): Promise<Response> {
  const auth = unauthorized(request);
  if (auth) {
    return auth;
  }

  try {
    const { threadId } = await context.params;
    await audit("thread.goal.clear", { threadId });
    await getAppServerGateway().clearThreadGoal(threadId);
    return ok();
  } catch (error) {
    return serverError(error, "无法清除会话目标");
  }
}
