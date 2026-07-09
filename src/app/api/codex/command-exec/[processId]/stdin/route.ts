import {
  audit,
  getAppServerGateway,
  ok,
  readJsonRecord,
  RouteValidationError,
  serverError,
  unauthorized
} from "../../../_route-helpers";

export async function POST(
  request: Request,
  context: { params: Promise<{ processId: string }> }
): Promise<Response> {
  const auth = unauthorized(request);
  if (auth) {
    return auth;
  }

  try {
    const { processId } = await context.params;
    const body = await readJsonRecord(request);
    if (typeof body.text !== "string") {
      throw new RouteValidationError("text 必须是字符串");
    }
    await audit("commandExec.stdin", { processId, byteLength: Buffer.byteLength(body.text, "utf8") });
    await getAppServerGateway().writeCommandExecStdin(processId, body.text);
    return ok();
  } catch (error) {
    return serverError(error, "无法写入 command exec 输入");
  }
}
