import { getThreadModelSwitchService } from "../../../../../../../server/custom-models/runtime";
import { RouteValidationError, audit, readJsonRecord, unauthorized } from "../../../../_route-helpers";
import { switchErrorResponse, switchTerminalResponse } from "../_helpers";

export async function POST(
  request: Request,
  context: { params: Promise<{ threadId: string }> }
): Promise<Response> {
  const auth = unauthorized(request);
  if (auth) {
    return auth;
  }
  try {
    const { threadId } = await context.params;
    const body = await readJsonRecord(request);
    if (Object.keys(body).some((key) => key !== "action")) {
      throw new RouteValidationError("恢复请求只允许 action 字段");
    }
    if (body.action !== "restore-old" && body.action !== "retry-target") {
      throw new RouteValidationError("action 必须是 restore-old 或 retry-target");
    }
    const result = await getThreadModelSwitchService().recoverPendingOperation(threadId, body.action);
    await audit("thread.model.binding.recover", {
      operationId: result.operationId,
      threadId,
      action: body.action,
      outcome: result.outcome,
      code: result.code ?? null,
      bindingVersion: result.latestState.bindingVersion,
      modelProvider: result.modelProvider,
      errorSummary: result.error ? "模型运行时恢复失败" : null
    });
    return switchTerminalResponse(result);
  } catch (error) {
    return switchErrorResponse(error);
  }
}
