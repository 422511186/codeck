import {
  audit,
  getAppServerGateway,
  ok,
  RouteValidationError,
  serverError,
  unauthorized
} from "../../../_route-helpers";

export async function GET(
  request: Request,
  context: { params: Promise<{ threadId: string }> }
): Promise<Response> {
  const auth = unauthorized(request);
  if (auth) {
    return auth;
  }

  try {
    const { threadId } = await context.params;
    const url = new URL(request.url);
    const contentRef = url.searchParams.get("contentRef")?.trim();
    if (!contentRef) {
      throw new RouteValidationError("contentRef 不能为空");
    }
    const cursor = url.searchParams.get("cursor");
    const maxBytesValue = url.searchParams.get("maxBytes");
    const maxBytes = maxBytesValue === null ? undefined : Number(maxBytesValue);
    if (maxBytes !== undefined && (!Number.isFinite(maxBytes) || maxBytes <= 0)) {
      throw new RouteValidationError("maxBytes 必须是正数");
    }
    const chunk = await getAppServerGateway().readTimelineContent({
      threadId,
      contentRef,
      cursor,
      maxBytes
    });
    await audit("timeline.content.read", {
      threadId,
      startOffset: chunk.startOffset,
      endOffset: chunk.endOffset,
      status: chunk.completeness.status
    });
    return ok({ chunk });
  } catch (error) {
    return serverError(error, "无法读取 timeline 完整内容");
  }
}
