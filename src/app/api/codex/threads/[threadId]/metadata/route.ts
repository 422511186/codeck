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
      gitInfo?: { sha?: string | null; branch?: string | null; originUrl?: string | null } | null;
    };
    await audit("thread.metadata.update", { threadId, gitInfo: body.gitInfo ?? null });
    const thread = await getAppServerGateway().updateThreadMetadata({ threadId, gitInfo: body.gitInfo });
    return NextResponse.json({ ok: true, thread });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "无法更新会话 metadata" },
      { status: 502 }
    );
  }
}
