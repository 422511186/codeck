import { NextResponse } from "next/server";
import { getAppServerGateway } from "../../../../../../server/app-server/runtime";
import { isRequestAuthenticated } from "../../../../../../server/auth";
import { audit } from "../../../../../../server/security";

export async function POST(
  request: Request,
  context: { params: Promise<{ threadId: string }> }
): Promise<Response> {
  if (!isRequestAuthenticated(request)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  try {
    const { threadId } = await context.params;
    const body = (await request.json()) as { objective?: string; tokenBudget?: number | null };
    const objective = body.objective?.trim();
    if (!objective) {
      return NextResponse.json({ ok: false, error: "会话目标不能为空" }, { status: 400 });
    }

    if (
      body.tokenBudget !== null &&
      body.tokenBudget !== undefined &&
      (!Number.isFinite(body.tokenBudget) || body.tokenBudget < 0)
    ) {
      return NextResponse.json({ ok: false, error: "token budget 必须是非负数字" }, { status: 400 });
    }

    await audit("thread.goal.set", { threadId, objectiveLength: objective.length, tokenBudget: body.tokenBudget });
    const goal = await getAppServerGateway().setThreadGoal({
      threadId,
      objective,
      tokenBudget: body.tokenBudget
    });
    return NextResponse.json({ ok: true, goal });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "无法设置会话目标" },
      { status: 502 }
    );
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ threadId: string }> }
): Promise<Response> {
  if (!isRequestAuthenticated(request)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  try {
    const { threadId } = await context.params;
    await audit("thread.goal.clear", { threadId });
    await getAppServerGateway().clearThreadGoal(threadId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "无法清除会话目标" },
      { status: 502 }
    );
  }
}
