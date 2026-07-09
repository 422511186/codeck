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
    if (!Array.isArray(body.items)) {
      throw new RouteValidationError("items 必须是数组");
    }

    await audit("thread.items.inject", { threadId, count: body.items.length });
    await getAppServerGateway().injectThreadItems(threadId, body.items as MobileJsonValue[]);
    return ok();
  } catch (error) {
    return serverError(error, "无法注入会话 items");
  }
}
