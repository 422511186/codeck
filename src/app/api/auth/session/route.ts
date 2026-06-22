import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { readSessionCookie } from "../../../../server/session";
import { getRuntimeConfig } from "../../../../server/runtime";

const config = getRuntimeConfig();

export async function GET(): Promise<Response> {
  const cookie = (await headers()).get("cookie");
  const session = readSessionCookie(cookie, config.accessToken);
  return NextResponse.json(session);
}
