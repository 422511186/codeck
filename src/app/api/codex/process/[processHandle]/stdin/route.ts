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
  context: { params: Promise<{ processHandle: string }> }
): Promise<Response> {
  const auth = unauthorized(request);
  if (auth) {
    return auth;
  }

  try {
    const { processHandle } = await context.params;
    const body = await readJsonRecord(request);
    if (typeof body.text !== "string") {
      throw new RouteValidationError("text 必须是字符串");
    }

    await audit("process.stdin.write", { processHandle, length: body.text.length });
    await getAppServerGateway().writeProcessStdin(processHandle, body.text);
    return ok();
  } catch (error) {
    return serverError(error, "无法写入终端输入");
  }
}
