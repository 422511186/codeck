import {
  audit,
  getAppServerGateway,
  ok,
  readJsonRecord,
  requireNonEmptyString,
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
    const command = requireNonEmptyString(body.command, "command");

    await audit("thread.shellCommand", { threadId, command });
    await getAppServerGateway().runThreadShellCommand(threadId, command);
    return ok();
  } catch (error) {
    return serverError(error, "无法执行会话 shell command");
  }
}
