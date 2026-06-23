import { NextResponse } from "next/server";
import { getAppServerGateway } from "../../../../../server/app-server/runtime";
import { isRequestAuthenticated } from "../../../../../server/auth";
import { audit } from "../../../../../server/security";

type CreditType = "credits" | "usage_limit";

function isCreditType(value: unknown): value is CreditType {
  return value === "credits" || value === "usage_limit";
}

export async function POST(request: Request): Promise<Response> {
  if (!isRequestAuthenticated(request)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  try {
    const body = (await request.json()) as { creditType?: unknown };
    if (!isCreditType(body.creditType)) {
      return NextResponse.json({ ok: false, error: "creditType 只能是 credits 或 usage_limit" }, { status: 400 });
    }

    await audit("account.addCreditsNudge.sendEmail", { creditType: body.creditType });
    const result = await getAppServerGateway().sendAddCreditsNudgeEmail(body.creditType);
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "无法发送加购提醒" },
      { status: 502 }
    );
  }
}
