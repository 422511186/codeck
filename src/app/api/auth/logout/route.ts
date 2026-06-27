import { NextResponse } from "next/server";
import { clearSessionCookie } from "../../../../server/session";

export async function POST(): Promise<Response> {
  const response = NextResponse.json({ ok: true });
  response.headers.append("set-cookie", clearSessionCookie());
  return response;
}
