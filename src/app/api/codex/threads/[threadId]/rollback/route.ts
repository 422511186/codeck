import { NextResponse } from "next/server";
import { historyStampFrom } from "../../../../../../shared/timeline-protocol";
import {
  audit,
  getAppServerGateway,
  ok,
  optionalStrictStringArray,
  readOptionalJsonRecord,
  requireNonEmptyString,
  RouteValidationError,
  serverError,
  unauthorized
} from "../../../_route-helpers";

export async function POST(
  request: Request,
  context: { params: Promise<{ threadId: string }> }
): Promise<Response> {
  const auth = unauthorized(request);
  if (auth) {
    return auth;
  }

  let rollbackAudit: {
    threadId: string;
    operationId: string;
    targetTurnId: string;
    historyStamp: { bootId: string; generation: number };
    expectedTailTurnIds: string[];
  } | null = null;

  try {
    const { threadId } = await context.params;
    const body = await readOptionalJsonRecord(request);
    const operationId = requireNonEmptyString(body.operationId, "operationId");
    const targetTurnId = requireNonEmptyString(body.targetTurnId, "targetTurnId");
    const historyStamp = historyStampFrom(body.historyStamp);
    if (!historyStamp) {
      throw new RouteValidationError("historyStamp 无效");
    }
    const expectedTailTurnIds = optionalStrictStringArray(
      body.expectedTailTurnIds,
      "expectedTailTurnIds"
    );
    if (!expectedTailTurnIds?.length || expectedTailTurnIds[0] !== targetTurnId) {
      throw new RouteValidationError("expectedTailTurnIds 必须从 targetTurnId 开始且不能为空");
    }
    const rollbackRequest = { operationId, targetTurnId, historyStamp, expectedTailTurnIds };
    rollbackAudit = { threadId, ...rollbackRequest };
    await audit("thread.rollback", { threadId, ...rollbackRequest });
    const thread = await getAppServerGateway().rollbackThread(threadId, rollbackRequest);
    return ok({ thread });
  } catch (error) {
    const structured = typeof error === "object" && error !== null
      ? error as {
          code?: unknown;
          httpStatus?: unknown;
          message?: unknown;
          actualTailTurnIds?: unknown;
          authoritativeThread?: unknown;
        }
      : null;
    if (
      (structured?.code === "ROLLBACK_CONFLICT" || structured?.code === "ROLLBACK_UNRESOLVED") &&
      structured.httpStatus === 409
    ) {
      if (rollbackAudit) {
        await audit("thread.rollback.conflict", {
          ...rollbackAudit,
          code: structured.code,
          ...(structured.code === "ROLLBACK_CONFLICT"
            ? { actualTailTurnIds: structured.actualTailTurnIds ?? [] }
            : {})
        });
      }
      return NextResponse.json(
        {
          ok: false,
          code: structured.code,
          error: error instanceof Error ? error.message : "rollback 操作冲突",
          ...(structured.code === "ROLLBACK_CONFLICT"
            ? { actualTailTurnIds: structured.actualTailTurnIds ?? [] }
            : {})
        },
        { status: 409 }
      );
    }
    if (structured?.code === "REPAIR_EXHAUSTED") {
      if (rollbackAudit) {
        await audit("thread.rollback.repair_exhausted", rollbackAudit);
      }
      return NextResponse.json(
        {
          ok: false,
          code: structured.code,
          error: error instanceof Error ? error.message : "rollback 后记录尚未收敛",
          ...(structured.authoritativeThread
            ? { thread: structured.authoritativeThread }
            : {})
        },
        { status: 409 }
      );
    }
    return serverError(error, "无法 rollback 会话");
  }
}
