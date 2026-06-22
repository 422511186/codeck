import { getRuntimeConfig } from "./runtime";
import { readSessionCookie } from "./session";

export function isRequestAuthenticated(request: Request): boolean {
  const cookie = request.headers.get("cookie");
  return readSessionCookie(cookie, getRuntimeConfig().accessToken).authenticated;
}

export function isCookieHeaderAuthenticated(cookie: string | undefined): boolean {
  return readSessionCookie(cookie, getRuntimeConfig().accessToken).authenticated;
}
