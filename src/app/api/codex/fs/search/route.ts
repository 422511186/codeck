import {
  assertAllowedPath,
  getAppServerGateway,
  ok,
  readJsonRecord,
  requireNonEmptyString,
  requireStrictStringArray,
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
    const query = requireNonEmptyString(body.query, "query");
    const roots = requireStrictStringArray(body.roots, "roots").map((root) => assertAllowedPath(root, "root"));
    const results = await getAppServerGateway().searchFiles({ query, roots });
    return ok({ results });
  } catch (error) {
    return serverError(error, "无法搜索文件");
  }
}
