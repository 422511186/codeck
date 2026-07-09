import {
  assertAllowedPath,
  audit,
  getAppServerGateway,
  ok,
  readJsonRecord,
  RouteValidationError,
  serverError,
  unauthorized
} from "../../_route-helpers";

export async function GET(request: Request): Promise<Response> {
  const auth = unauthorized(request);
  if (auth) {
    return auth;
  }

  const url = new URL(request.url);
  const path = url.searchParams.get("path");

  try {
    const allowedPath = assertAllowedPath(path, "path");
    const file = await getAppServerGateway().readFile(allowedPath);
    return ok({ file });
  } catch (error) {
    return serverError(error, "无法读取文件");
  }
}

export async function PUT(request: Request): Promise<Response> {
  const auth = unauthorized(request);
  if (auth) {
    return auth;
  }

  try {
    const body = await readJsonRecord(request);
    if (typeof body.text !== "string") {
      throw new RouteValidationError("text 必须是字符串");
    }

    const allowedPath = assertAllowedPath(body.path, "path");
    await audit("fs.file.write", { path: allowedPath, length: body.text.length });
    await getAppServerGateway().writeFile(allowedPath, body.text);
    return ok();
  } catch (error) {
    return serverError(error, "无法写入文件");
  }
}
