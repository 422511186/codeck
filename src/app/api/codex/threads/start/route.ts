import { NextResponse } from "next/server";
import { getAppServerGateway } from "../../../../../server/app-server/runtime";
import { isRequestAuthenticated } from "../../../../../server/auth";
import {
  assertRuntimePathAllowed,
  assertRuntimeWorkspaceRootsAllowed,
  audit
} from "../../../../../server/security";

export async function POST(request: Request): Promise<Response> {
  if (!isRequestAuthenticated(request)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      cwd?: string;
      workspaceRoots?: string[];
      model?: string;
      permissions?: string;
    };
    const input = {
      ...body,
      cwd: body.cwd ? assertRuntimePathAllowed(body.cwd) : undefined,
      workspaceRoots: assertRuntimeWorkspaceRootsAllowed(body.workspaceRoots)
    };
    await audit("thread.start", {
      cwd: input.cwd,
      workspaceRoots: input.workspaceRoots,
      model: input.model,
      permissions: input.permissions
    });
    const thread = await getAppServerGateway().startThread(input);
    return NextResponse.json({ ok: true, thread });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "无法启动会话" },
      { status: 502 }
    );
  }
}
