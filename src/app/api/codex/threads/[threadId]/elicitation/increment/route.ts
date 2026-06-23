import { NextResponse } from "next/server";
import { getAppServerGateway } from "../../../../../../../server/app-server/runtime";
import { isRequestAuthenticated } from "../../../../../../../server/auth";
import { audit } from "../../../../../../../server/security";

export async function POST(
  request: Request,
  context: { params: Promise<{ threadId: string }> }
): Promise<Response> {
  if (!isRequestAuthenticated(request)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  try {
    const { threadId } = await context.params;
    await audit("thread.elicitation.increment", { threadId });
    const result = await getAppServerGateway().incrementThreadElicitation(threadId);
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "无法增加 elicitation 计数" },
      { status: 502 }
    );
  }
}
