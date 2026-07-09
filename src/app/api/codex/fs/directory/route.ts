import {
  assertAllowedPath,
  audit,
  getAppServerGateway,
  ok,
  readJsonRecord,
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
    const entries = await getAppServerGateway().readDirectory(allowedPath);
    return ok({ entries });
  } catch (error) {
    return serverError(error, "无法读取目录");
  }
}

export async function POST(request: Request): Promise<Response> {
  const auth = unauthorized(request);
  if (auth) {
    return auth;
  }

  try {
    const body = await readJsonRecord(request);
    const allowedPath = assertAllowedPath(body.path, "path");
    await audit("fs.directory.create", { path: allowedPath });
    await getAppServerGateway().createDirectory(allowedPath);
    return ok();
  } catch (error) {
    return serverError(error, "无法创建目录");
  }
}
