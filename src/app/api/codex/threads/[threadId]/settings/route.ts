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
    const body = (await request.json()) as {
      model?: string;
      reasoningEffort?: string;
      permissions?: string;
    };
    await audit("thread.settings.update", {
      threadId,
      model: body.model,
      reasoningEffort: body.reasoningEffort,
      permissions: body.permissions
    });
    await getAppServerGateway().updateThreadSettings({
      threadId,
      model: body.model,
      reasoningEffort: body.reasoningEffort,
      permissions: body.permissions
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "无法更新会话设置" },
      { status: 502 }
    );
  }
}
