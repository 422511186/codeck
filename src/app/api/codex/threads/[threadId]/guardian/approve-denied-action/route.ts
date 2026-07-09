import type { MobileJsonValue } from "../../../../../../../shared/codex";
import {
  audit,
  getAppServerGateway,
  ok,
  readJsonRecord,
  RouteValidationError,
  serverError,
  unauthorized
} from "../../../../_route-helpers";

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
    if (body.event === undefined) {
      throw new RouteValidationError("event 不能为空");
    }

    await audit("thread.guardian.approveDeniedAction", { threadId });
    await getAppServerGateway().approveGuardianDeniedAction(threadId, body.event as MobileJsonValue);
    return ok();
  } catch (error) {
    return serverError(error, "无法批准 Guardian 拦截动作");
  }
}
