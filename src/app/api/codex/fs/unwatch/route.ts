import {
  audit,
  getAppServerGateway,
  ok,
  readJsonRecord,
  requireNonEmptyString,
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
    const watchId = requireNonEmptyString(body.watchId, "watchId");

    await audit("fs.unwatch", { watchId });
    await getAppServerGateway().unwatchPath(watchId);
    return ok();
  } catch (error) {
    return serverError(error, "无法停止监听文件变化");
  }
}
