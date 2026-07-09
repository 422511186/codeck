import {
  audit,
  getAppServerGateway,
  ok,
  optionalStrictNonEmptyString,
  readJsonRecord,
  requireNonEmptyString,
  serverError,
  unauthorized
} from "../../../_route-helpers";

export async function POST(request: Request): Promise<Response> {
  const auth = unauthorized(request);
  if (auth) {
    return auth;
  }

  try {
    const body = await readJsonRecord(request);
    const server = requireNonEmptyString(body.server, "server");
    const uri = requireNonEmptyString(body.uri, "uri");
    const threadId = optionalStrictNonEmptyString(body.threadId, "threadId") ?? null;
    await audit("mcp.resource.read", { server, uri, threadId });
    const resource = await getAppServerGateway().readMcpResource({
      server,
      uri,
      threadId
    });
    return ok({ resource });
  } catch (error) {
    return serverError(error, "无法读取 MCP 资源");
  }
}
