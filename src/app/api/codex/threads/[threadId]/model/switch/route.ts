import { randomUUID } from "node:crypto";
import { getThreadModelSwitchService } from "../../../../../../../server/custom-models/runtime";
import { audit, readJsonRecord, unauthorized } from "../../../../_route-helpers";
import { readSwitchRequest, switchErrorResponse, switchTerminalResponse } from "../_helpers";

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
    const input = readSwitchRequest(await readJsonRecord(request));
    const operationId = randomUUID();
    await audit("thread.model.switch.request", {
      operationId,
      threadId,
      target: input.target,
      expectedCatalogRevision: input.expectedCatalogRevision,
      expectedCurrent: input.expectedCurrent,
      kind: input.kind ?? "switch"
    });
    const result = await getThreadModelSwitchService().switchModel(threadId, input, operationId);
    await audit("thread.model.switch.result", {
      operationId: result.operationId,
      threadId,
      outcome: result.outcome,
      code: result.code ?? null,
      old: input.expectedCurrent,
      target: result.latestState.selection,
      bindingVersion: result.latestState.bindingVersion,
      reasoningEffort: result.latestState.reasoningEffort,
      contextWindow: result.latestState.contextWindow,
      modelProvider: result.modelProvider,
      errorSummary: result.error ? "模型运行时操作失败" : null
    });
    return switchTerminalResponse(result);
  } catch (error) {
    const response = switchErrorResponse(error);
    const structured = typeof error === "object" && error !== null
      ? error as { operationId?: unknown; code?: unknown }
      : null;
    if (structured?.operationId) {
      await audit("thread.model.switch.result", {
        operationId: structured.operationId,
        outcome: "not_started",
        code: structured.code ?? "MODEL_SWITCH_FAILED"
      });
    }
    return response;
  }
}
