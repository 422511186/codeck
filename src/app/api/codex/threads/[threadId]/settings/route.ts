import type { UpdateThreadSettingsInput } from "../../../../../../server/app-server/client";
import { getThreadModelLifecycleService } from "../../../../../../server/custom-models/runtime";
import {
  audit,
  isRecord,
  ok,
  optionalApprovalPolicy,
  optionalStrictNonEmptyString,
  optionalStrictNullableString,
  readJsonRecord,
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

  try {
    const { threadId } = await context.params;
    const body = await readJsonRecord(request);
    if (Object.hasOwn(body, "model")) {
      throw new RouteValidationError("model 必须通过独立模型切换命令修改");
    }
    const reasoningEffort = optionalStrictNonEmptyString(body.reasoningEffort, "reasoningEffort");
    const permissions = optionalStrictNullableString(body.permissions, "permissions");
    const approvalPolicy = optionalApprovalPolicy(body.approvalPolicy);
    const approvalsReviewer = readApprovalsReviewer(body.approvalsReviewer);
    const collaborationMode = readCollaborationMode(body.collaborationMode);
    await audit("thread.settings.update", {
      threadId,
      reasoningEffort,
      permissions,
      approvalPolicy,
      approvalsReviewer,
      collaborationMode
    });
    const bindingUpdate = await getThreadModelLifecycleService().updateThreadSettings({
      threadId,
      reasoningEffort,
      permissions,
      approvalPolicy,
      approvalsReviewer,
      collaborationMode
    });
    if (bindingUpdate) {
      await audit("thread.model.binding.update", {
        threadId,
        operationId: bindingUpdate.operationId,
        bindingVersion: bindingUpdate.bindingVersion,
        reasoningEffort: bindingUpdate.reasoningEffort
      });
    }
    return ok();
  } catch (error) {
    return serverError(error, "无法更新会话设置");
  }
}

function readApprovalsReviewer(value: unknown): UpdateThreadSettingsInput["approvalsReviewer"] {
  if (value === undefined || value === null) {
    return value;
  }

  if (value === "user" || value === "auto_review" || value === "guardian_subagent") {
    return value;
  }

  throw new RouteValidationError("approvalsReviewer 无效");
}

function readCollaborationMode(value: unknown): UpdateThreadSettingsInput["collaborationMode"] {
  if (value === undefined || value === null) {
    return value;
  }

  if (!isRecord(value) || typeof value.mode !== "string" || !isRecord(value.settings)) {
    throw new RouteValidationError("collaborationMode 无效");
  }

  return value as UpdateThreadSettingsInput["collaborationMode"];
}
