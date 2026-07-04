import { NextResponse } from "next/server";
import { getAppServerGateway, serverError } from "../../_route-helpers";
import { isRequestAuthenticated } from "../../../../../server/auth";

export async function GET(request: Request): Promise<Response> {
  if (!isRequestAuthenticated(request)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  try {
    const authStatus = await getAppServerGateway().getAuthStatus();
    return NextResponse.json({ ok: true, result: authStatus, authStatus });
  } catch (error) {
    return serverError(error, "无法读取账号鉴权状态");
  }
}
