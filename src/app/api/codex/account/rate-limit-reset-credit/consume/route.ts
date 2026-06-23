import { NextResponse } from "next/server";
import { getAppServerGateway } from "../../../../../../server/app-server/runtime";
import { isRequestAuthenticated } from "../../../../../../server/auth";
import { audit } from "../../../../../../server/security";

export async function POST(request: Request): Promise<Response> {
  if (!isRequestAuthenticated(request)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  try {
    const body = (await request.json()) as { idempotencyKey?: unknown };
    if (typeof body.idempotencyKey !== "string" || !body.idempotencyKey.trim()) {
      return NextResponse.json({ ok: false, error: "idempotencyKey 不能为空" }, { status: 400 });
    }

    const idempotencyKey = body.idempotencyKey.trim();
    await audit("account.rateLimitResetCredit.consume", { idempotencyKey });
    const result = await getAppServerGateway().consumeRateLimitResetCredit(idempotencyKey);
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "无法消费重置额度 credit" },
      { status: 502 }
    );
  }
}
