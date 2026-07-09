import {
  assertAllowedPath,
  audit,
  getAppServerGateway,
  ok,
  readJsonRecord,
  requireStrictStringArray,
  RouteValidationError,
  serverError,
  unauthorized
} from "../../_route-helpers";

export async function POST(request: Request): Promise<Response> {
  const auth = unauthorized(request);
  if (auth) {
    return auth;
  }

  try {
    const body = await readJsonRecord(request);
    const command = requireStrictStringArray(body.command, "command");
    if (!command.length) {
      throw new RouteValidationError("command 不能为空");
    }
    const cwd = assertAllowedPath(body.cwd, "cwd");
    await audit("process.spawn", { command, cwd });
    const session = await getAppServerGateway().startProcessSession({ command, cwd });
    return ok({ session });
  } catch (error) {
    return serverError(error, "无法启动终端会话");
  }
}
