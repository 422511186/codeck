import {
  assertAllowedPath,
  getAppServerGateway,
  ok,
  readJsonRecord,
  requireNonEmptyString,
  requireStrictStringArray,
  RouteValidationError,
  serverError,
  unauthorized
} from "../../_route-helpers";

function readAllowedRoots(value: unknown): string[] {
  return requireStrictStringArray(value, "roots").map((root) => assertAllowedPath(root, "root"));
}

export async function POST(request: Request): Promise<Response> {
  const auth = unauthorized(request);
  if (auth) {
    return auth;
  }

  try {
    const body = await readJsonRecord(request);
    const roots = readAllowedRoots(body.roots);
    const session = await getAppServerGateway().startFileSearchSession(roots);
    return ok({ session });
  } catch (error) {
    return serverError(error, "无法开始会话式文件搜索");
  }
}

export async function PUT(request: Request): Promise<Response> {
  const auth = unauthorized(request);
  if (auth) {
    return auth;
  }

  try {
    const body = await readJsonRecord(request);
    const sessionId = requireNonEmptyString(body.sessionId, "sessionId");
    if (typeof body.query !== "string") {
      throw new RouteValidationError("query 必须是字符串");
    }

    await getAppServerGateway().updateFileSearchSession(sessionId, body.query);
    return ok();
  } catch (error) {
    return serverError(error, "无法更新会话式文件搜索");
  }
}

export async function DELETE(request: Request): Promise<Response> {
  const auth = unauthorized(request);
  if (auth) {
    return auth;
  }

  try {
    const body = await readJsonRecord(request);
    const sessionId = requireNonEmptyString(body.sessionId, "sessionId");
    await getAppServerGateway().stopFileSearchSession(sessionId);
    return ok();
  } catch (error) {
    return serverError(error, "无法停止会话式文件搜索");
  }
}
