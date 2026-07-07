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
    const gateway = getAppServerGateway();
    const summary = await gateway.readThreadSummary(threadId);
    if (summary.status === "active") {
      return NextResponse.json(
        { ok: false, error: "会话仍在运行，停止后才能压缩上下文" },
        { status: 409 }
      );
    }
    await audit("thread.compact.start", { threadId });
    await gateway.compactThread(threadId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (isThreadRunningError(error)) {
      return NextResponse.json(
        { ok: false, error: "会话仍在运行，停止后才能压缩上下文" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "无法压缩上下文" },
      { status: 502 }
    );
  }
}

function isThreadRunningError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /active|running|in[-\s]?progress|仍在运行|正在运行/i.test(message);
}
