import { NextResponse } from "next/server";
import { getAppServerGateway } from "../../../../../server/app-server/runtime";
import type { StartTurnInput } from "../../../../../server/app-server/client";
import { isRequestAuthenticated } from "../../../../../server/auth";
import { getRuntimeConfig } from "../../../../../server/runtime";
import { assertRuntimePathAllowed, audit } from "../../../../../server/security";

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
      permissions?: string;
      additionalContext?: StartTurnInput["additionalContext"];
      collaborationMode?: StartTurnInput["collaborationMode"];
    };

    if (!body.threadId) {
      return NextResponse.json({ ok: false, error: "threadId 不能为空" }, { status: 400 });
    }

    if (!body.text?.trim()) {
      return NextResponse.json({ ok: false, error: "消息不能为空" }, { status: 400 });
    }

    const config = getRuntimeConfig();
    const imagePaths = body.imagePaths?.map((imagePath) => assertRuntimePathAllowed(imagePath, [config.uploadDir]));
    await audit("turn.start", {
      threadId: body.threadId,
      textLength: body.text.length,
      imageCount: imagePaths?.length || 0,
      model: body.model,
      reasoningEffort: body.reasoningEffort,
      permissions: body.permissions,
      additionalContext: body.additionalContext,
      collaborationMode: body.collaborationMode
    });
    const result = await getAppServerGateway().startTurn({
      threadId: body.threadId,
      text: body.text,
      imagePaths,
      model: body.model,
      reasoningEffort: body.reasoningEffort,
      permissions: body.permissions,
      additionalContext: body.additionalContext,
      collaborationMode: body.collaborationMode
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
