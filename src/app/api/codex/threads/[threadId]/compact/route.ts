import { NextResponse } from "next/server";
import { getAppServerGateway } from "../../../../../../server/app-server/runtime";
import { isRequestAuthenticated } from "../../../../../../server/auth";
import { audit } from "../../../../../../server/security";

const THREAD_RUNNING_COMPACT_ERROR_PATTERN =
  /\bactive\b|\brunning\b|\bbusy\b|in[-\s]?progress|non[-\s]?steerable|same[-\s]?turn\s+steer|cannot\s+accept.*steer|current\s+turn|turn\s+in\s+progress|仍在运行|正在运行/i;
const THREAD_RUNNING_COMPACT_ERROR_MESSAGE = "会话仍在运行，停止后才能压缩上下文";
const THREAD_NOT_IDLE_COMPACT_ERROR_MESSAGE = "会话未处于空闲状态，恢复或停止后才能压缩上下文";

export async function POST(
  request: Request,
  context: { params: Promise<{ threadId: string }> }
): Promise<Response> {
  if (!isRequestAuthenticated(request)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let threadId = "";
  try {
    ({ threadId } = await context.params);
    const gateway = getAppServerGateway();
    const summary = await gateway.readThreadSummary(threadId);
    if (summary.status !== "idle") {
      const error =
        summary.status === "active"
          ? THREAD_RUNNING_COMPACT_ERROR_MESSAGE
          : THREAD_NOT_IDLE_COMPACT_ERROR_MESSAGE;
      await audit("thread.compact.reject", {
        threadId,
        reason: summary.status === "active" ? "precheck-active" : "precheck-not-idle",
        status: summary.status
      });
      return NextResponse.json(
        { ok: false, error },
        { status: 409 }
      );
    }
    await audit("thread.compact.start", { threadId });
    await gateway.compactThread(threadId);
    await audit("thread.compact.accepted", { threadId });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (isThreadRunningError(error)) {
      if (threadId) {
        await audit("thread.compact.reject", {
          threadId,
          reason: hasStructuredActiveTurnConflict(error) ? "app-server-active-turn" : "app-server-running",
          source: "app-server"
        });
      }
      return NextResponse.json(
        { ok: false, error: THREAD_RUNNING_COMPACT_ERROR_MESSAGE },
        { status: 409 }
      );
    }
    const message = compactErrorMessage(error);
    if (threadId) {
      await audit("thread.compact.failed", {
        threadId,
        reason: "unknown",
        message
      });
    }
    return NextResponse.json(
      { ok: false, error: message },
      { status: 502 }
    );
  }
}

function isThreadRunningError(error: unknown): boolean {
  if (hasStructuredActiveTurnConflict(error)) {
    return true;
  }
  return THREAD_RUNNING_COMPACT_ERROR_PATTERN.test(compactErrorMessage(error));
}

function hasStructuredActiveTurnConflict(error: unknown): boolean {
  const data = isRecord(error) ? error.data : undefined;
  return containsKey(data, "activeTurnNotSteerable");
}

function containsKey(value: unknown, key: string, depth = 0): boolean {
  if (depth > 5 || !isRecord(value)) {
    return false;
  }
  if (Object.prototype.hasOwnProperty.call(value, key)) {
    return true;
  }
  return Object.values(value).some((child) => containsKey(child, key, depth + 1));
}

function compactErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  if (typeof error === "string" && error) {
    return error;
  }
  return "无法压缩上下文";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
