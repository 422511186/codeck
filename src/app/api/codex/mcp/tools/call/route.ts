import {
  audit,
  badRequest,
  getAppServerGateway,
  nonEmptyString,
  ok,
  readJsonRecord,
  serverError,
  unauthorized
} from "../../../_route-helpers";
import type { MobileJsonValue } from "../../../../../../shared/codex";

export async function POST(request: Request): Promise<Response> {
  const auth = unauthorized(request);
  if (auth) {
    return auth;
  }

  try {
    const body = await readJsonRecord(request);
    const threadId = nonEmptyString(body.threadId);
    const server = nonEmptyString(body.server);
    const tool = nonEmptyString(body.tool);
    if (!threadId) {
      return badRequest("threadId 不能为空");
    }
    if (!server) {
      return badRequest("server 不能为空");
    }
    if (!tool) {
      return badRequest("tool 不能为空");
    }

    await audit("mcp.tool.call", { threadId, server, tool });
    const result = await getAppServerGateway().callMcpTool({
      threadId,
      server,
      tool,
      arguments: "arguments" in body ? (body.arguments as MobileJsonValue) : undefined,
      meta: "meta" in body ? (body.meta as MobileJsonValue) : undefined
    });
    return ok({ result });
  } catch (error) {
    return serverError(error, "无法调用 MCP tool");
  }
}
