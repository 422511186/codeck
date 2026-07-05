import {
  assertAllowedPath,
  audit,
  badRequest,
  getAppServerGateway,
  ok,
  readJsonRecord,
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
    if (
      !Array.isArray(body.command) ||
      body.command.length === 0 ||
      body.command.some((part) => typeof part !== "string" || !part.trim())
    ) {
      return badRequest("command 必须是非空字符串数组");
    }

    const cwd = assertAllowedPath(body.cwd, "cwd");
    const timeoutMs = typeof body.timeoutMs === "number" ? body.timeoutMs : undefined;
    await audit("terminal.exec", { command: body.command, cwd });
    const result = await getAppServerGateway().execCommand({
      command: body.command,
      cwd,
      timeoutMs
    });
    return ok({ result });
  } catch (error) {
    return serverError(error, "无法执行命令");
  }
}
