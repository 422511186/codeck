import { NextResponse } from "next/server";
import { getThreadModelLifecycleService } from "../../../../../../server/custom-models/runtime";
import { isRequestAuthenticated } from "../../../../../../server/auth";
import { audit } from "../../../../../../server/security";
import type { ThreadRuntimeOverrides } from "../../../../../../server/app-server/client";

type PermissionRuntimeOverrides = Pick<
  ThreadRuntimeOverrides,
  "permissions" | "approvalPolicy" | "approvalsReviewer"
>;

export async function POST(
  request: Request,
  context: { params: Promise<{ threadId: string }> }
): Promise<Response> {
  if (!isRequestAuthenticated(request)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  try {
    const { threadId } = await context.params;
    const permissionOverrides = await readPermissionOverrides(request);
    if (permissionOverrides === null) {
      return NextResponse.json({ ok: false, error: "权限配置无效" }, { status: 400 });
    }
    await audit("thread.resume", { threadId });
    const lifecycle = getThreadModelLifecycleService();
    const thread = Object.keys(permissionOverrides).length
      ? await lifecycle.resumeThread(threadId, permissionOverrides)
      : await lifecycle.resumeThread(threadId);
    return NextResponse.json({
      ok: true,
      thread: { ...thread, timeline: [], nextCursor: null }
    });
  } catch (error) {
    const structured = typeof error === "object" && error !== null
      ? error as { code?: unknown; httpStatus?: unknown; result?: Record<string, unknown> }
      : null;
    if (structured?.code === "SWITCH_RECOVERY_FAILED" && structured.httpStatus === 500) {
      return NextResponse.json(
        { ok: false, code: structured.code, ...(structured.result ?? {}) },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "无法恢复会话" },
      { status: 502 }
    );
  }
}

async function readPermissionOverrides(
  request: Request
): Promise<PermissionRuntimeOverrides | null> {
  const raw = await request.text();
  if (!raw.trim()) {
    return {};
  }
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return null;
  }
  const record = body as Record<string, unknown>;
  const hasPermissionField =
    Object.prototype.hasOwnProperty.call(record, "permissions") ||
    Object.prototype.hasOwnProperty.call(record, "approvalPolicy") ||
    Object.prototype.hasOwnProperty.call(record, "approvalsReviewer");
  if (!hasPermissionField) {
    return {};
  }
  const permissions = record.permissions;
  const approvalPolicy = record.approvalPolicy;
  const approvalsReviewer = record.approvalsReviewer;
  if (
    !(typeof permissions === "string" || permissions === null) ||
    !(
      approvalPolicy === null ||
      approvalPolicy === "untrusted" ||
      approvalPolicy === "on-request" ||
      approvalPolicy === "never"
    ) ||
    !(
      approvalsReviewer === null ||
      approvalsReviewer === "user" ||
      approvalsReviewer === "auto_review" ||
      approvalsReviewer === "guardian_subagent"
    )
  ) {
    return null;
  }
  return { permissions, approvalPolicy, approvalsReviewer };
}
