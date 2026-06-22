import { NextResponse } from "next/server";
import { getAppServerGateway } from "../../../../../server/app-server/runtime";
import { isRequestAuthenticated } from "../../../../../server/auth";

export async function POST(request: Request): Promise<Response> {
  if (!isRequestAuthenticated(request)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      threadId?: string;
      text?: string;
      imagePaths?: string[];
      model?: string;
      reasoningEffort?: string;
    };

    if (!body.threadId) {
      return NextResponse.json({ ok: false, error: "threadId 不能为空" }, { status: 400 });
    }

    if (!body.text?.trim()) {
      return NextResponse.json({ ok: false, error: "消息不能为空" }, { status: 400 });
    }

    const result = await getAppServerGateway().startTurn({
      threadId: body.threadId,
      text: body.text,
      imagePaths: body.imagePaths,
      model: body.model,
      reasoningEffort: body.reasoningEffort
    });
    const thread = await getAppServerGateway().readThread(body.threadId);

    return NextResponse.json({ ok: true, ...result, thread });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "无法发送消息" },
      { status: 502 }
    );
  }
}
