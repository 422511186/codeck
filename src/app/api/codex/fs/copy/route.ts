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
    const sourcePath = assertAllowedPath(body.sourcePath, "sourcePath");
    const destinationPath = assertAllowedPath(body.destinationPath, "destinationPath");
    await audit("fs.path.copy", { sourcePath, destinationPath });
    await getAppServerGateway().copyPath(sourcePath, destinationPath);
    return ok();
  } catch (error) {
    return serverError(error, "无法复制路径");
  }
}
