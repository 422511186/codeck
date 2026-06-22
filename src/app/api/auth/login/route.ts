import { NextResponse } from "next/server";
import { createSessionCookie } from "../../../../server/session";
import { getRuntimeConfig } from "../../../../server/runtime";

const config = getRuntimeConfig();
const cookieSecret = config.accessToken;

export async function POST(request: Request): Promise<Response> {
  const body = (await request.json()) as { token?: string };

  if (body.token !== config.accessToken) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.headers.append("set-cookie", createSessionCookie(config.accessToken, cookieSecret));
  return response;
}
