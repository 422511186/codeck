import { describe, expect, it } from "vitest";
import { createSessionCookie, readSessionCookie } from "../../src/server/session";

describe("session cookie", () => {
  it("能创建并读取合法 session", () => {
    const cookie = createSessionCookie("secret-token", "cookie-secret");
    const session = readSessionCookie(cookie, "cookie-secret");

    expect(session.authenticated).toBe(true);
  });

  it("签名不匹配时拒绝 session", () => {
    const cookie = createSessionCookie("secret-token", "cookie-secret");
    const session = readSessionCookie(cookie, "other-secret");

    expect(session.authenticated).toBe(false);
  });
});
