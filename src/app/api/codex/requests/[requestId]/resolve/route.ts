import { NextResponse } from "next/server";
import { getAppServerGateway } from "../../../../../../server/app-server/runtime";
import { isRequestAuthenticated } from "../../../../../../server/auth";
import { audit } from "../../../../../../server/security";

export async function POST(
  request: Request,
  context: { params: Promise<{ requestId: string }> }
): Promise<Response> {
  if (!isRequestAuthenticated(request)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  try {
    const { requestId } = await context.params;
    const id = Number(requestId);
    if (!Number.isInteger(id)) {
      return NextResponse.json({ ok: false, error: "requestId 无效" }, { status: 400 });
    }

    const body = (await request.json()) as { value?: unknown; response?: unknown };
    const hasRawResponse = Object.prototype.hasOwnProperty.call(body, "response");
    if (!hasRawResponse && typeof body.value !== "string") {
      return NextResponse.json({ ok: false, error: "value 无效" }, { status: 400 });
    }

    await audit("request.resolve", hasRawResponse ? { requestId: id, mode: "raw" } : { requestId: id, value: body.value });
    await getAppServerGateway().resolveServerRequest(
      id,
      typeof body.value === "string" ? body.value : "",
      hasRawResponse ? { response: body.response } : undefined
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "无法处理请求" },
      { status: 502 }
    );
  }
}
