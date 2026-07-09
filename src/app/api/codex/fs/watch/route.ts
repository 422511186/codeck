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
    const path = assertAllowedPath(body.path, "path");
    await audit("fs.watch", { path });
    const watch = await getAppServerGateway().watchPath(path);
    return ok({ watch });
  } catch (error) {
    return serverError(error, "无法监听文件变化");
  }
}
