import { createHmac, timingSafeEqual } from "node:crypto";
import { parse, serialize } from "cookie";

const COOKIE_NAME = "codex_web_session";

export type SessionReadResult = {
  authenticated: boolean;
};

function sign(value: string, secret: string): string {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

export function createSessionCookie(accessToken: string, cookieSecret: string): string {
  const payload = Buffer.from(JSON.stringify({ t: accessToken, v: 1 })).toString("base64url");
  const signature = sign(payload, cookieSecret);

  return serialize(COOKIE_NAME, `${payload}.${signature}`, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30
  });
}

export function clearSessionCookie(): string {
  return serialize(COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0
  });
}

export function readSessionCookie(
  cookieHeader: string | null | undefined,
  cookieSecret: string
): SessionReadResult {
  if (!cookieHeader) {
    return { authenticated: false };
  }

  const value = parse(cookieHeader)[COOKIE_NAME];
  if (!value) {
    return { authenticated: false };
  }

  const [payload, signature] = value.split(".");
  if (!payload || !signature) {
    return { authenticated: false };
  }

  const expected = sign(payload, cookieSecret);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (actualBuffer.length !== expectedBuffer.length) {
    return { authenticated: false };
  }

  if (!timingSafeEqual(actualBuffer, expectedBuffer)) {
    return { authenticated: false };
  }

  return { authenticated: true };
}
