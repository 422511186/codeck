import type { UpdateThreadSettingsInput } from "../../../../../../server/app-server/client";
import {
  audit,
  getAppServerGateway,
  isRecord,
  ok,
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
    const model = optionalStrictNonEmptyString(body.model, "model");
    const reasoningEffort = optionalStrictNonEmptyString(body.reasoningEffort, "reasoningEffort");
    const permissions = optionalStrictNullableString(body.permissions, "permissions");
    const approvalsReviewer = readApprovalsReviewer(body.approvalsReviewer);
    const collaborationMode = readCollaborationMode(body.collaborationMode);
    await audit("thread.settings.update", {
      threadId,
      model,
      reasoningEffort,
      permissions,
      approvalsReviewer,
      collaborationMode
    });
    await getAppServerGateway().updateThreadSettings({
      threadId,
      model,
      reasoningEffort,
      permissions,
      approvalsReviewer,
      collaborationMode
    });
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
