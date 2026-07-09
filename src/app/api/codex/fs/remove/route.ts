import {
  assertAllowedPath,
  audit,
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
    const allowedPath = assertAllowedPath(body.path, "path");
    await audit("fs.path.remove", { path: allowedPath });
    await getAppServerGateway().removePath(allowedPath);
    return ok();
  } catch (error) {
    return serverError(error, "无法删除路径");
  }
}
