import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

function resetRuntimeGlobals(): void {
  const globalForRuntime = globalThis as typeof globalThis & {
    __codexWebRuntimeConfig?: unknown;
    __codexWebAppServerGateway?: unknown;
  };
  delete globalForRuntime.__codexWebRuntimeConfig;
  delete globalForRuntime.__codexWebAppServerGateway;
}

async function setupRouteTest(): Promise<string> {
  vi.resetModules();
  resetRuntimeGlobals();

  const tmpDir = await mkdtemp(join(tmpdir(), "codex-web-route-"));
  process.env.CODEX_WEB_ACCESS_TOKEN = "test-secret";
  process.env.CODEX_WEB_APP_SERVER_MODE = "mock";
  process.env.CODEX_WEB_AUDIT_LOG_PATH = join(tmpDir, "audit.jsonl");

  // Force runtime config to re-initialize with test env vars
  const { createRuntimeConfig } = await import("../../src/config/env");
  const globalForRuntime = globalThis as typeof globalThis & {
    __codexWebRuntimeConfig?: unknown;
  };
  globalForRuntime.__codexWebRuntimeConfig = createRuntimeConfig(process.env);

  const { createSessionCookie } = await import("../../src/server/session");
  return createSessionCookie("test-secret", "test-secret");
}

function extractCookieValue(setCookieString: string): string {
  // Extract just the cookie value from a Set-Cookie string
  // Input: "codex_web_session=VALUE; Max-Age=...; Path=/; ..."
  // Output: "codex_web_session=VALUE"
  const match = setCookieString.match(/^([^;]+)/);
  return match ? match[1] : setCookieString;
}

function jsonRequest(pathname: string, body: unknown, cookie?: string): Request {
  const headers = new Headers({ "content-type": "application/json" });
  if (cookie) {
    headers.set("cookie", extractCookieValue(cookie));
  }

  return new Request(`http://localhost${pathname}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });
}

function getRequest(pathname: string, cookie?: string): Request {
  const headers = new Headers();
  if (cookie) {
    headers.set("cookie", extractCookieValue(cookie));
  }

  return new Request(`http://localhost${pathname}`, { method: "GET", headers });
}

describe("剩余 app-server 协议 route", () => {
  beforeEach(() => {
    resetRuntimeGlobals();
  });

  it("未认证时拒绝新增环境 API", async () => {
    const { POST } = await import("../../src/app/api/codex/environment/add/route");

    const response = await POST(jsonRequest("/api/codex/environment/add", { environmentId: "env-1", execServerUrl: "http://127.0.0.1:1" }));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ ok: false });
  });

  it("feedback upload 请求体非法时返回 400", async () => {
    const cookie = await setupRouteTest();
    const { POST } = await import("../../src/app/api/codex/feedback/upload/route");

    const response = await POST(
      jsonRequest("/api/codex/feedback/upload", { reason: "缺少 classification" }, cookie)
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ ok: false, error: "classification 不能为空" });
  });

  it("MCP tool call route 调用 mock app-server 并返回结果", async () => {
    const cookie = await setupRouteTest();
    const { POST } = await import("../../src/app/api/codex/mcp/tools/call/route");

    const response = await POST(
      jsonRequest(
        "/api/codex/mcp/tools/call",
        { threadId: "mock-thread-1", server: "filesystem", tool: "read_file", arguments: { path: "README.md" } },
        cookie
      )
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      result: {
        isError: false,
        content: expect.any(Array)
      }
    });
  });

  it("thread realtime route 支持列出 voices 和追加文本", async () => {
    const cookie = await setupRouteTest();
    const voicesRoute = await import("../../src/app/api/codex/realtime/voices/route");
    const appendTextRoute = await import("../../src/app/api/codex/threads/[threadId]/realtime/append-text/route");

    const voicesResponse = await voicesRoute.GET(getRequest("/api/codex/realtime/voices", cookie));
    expect(voicesResponse.status).toBe(200);
    await expect(voicesResponse.json()).resolves.toMatchObject({
      ok: true,
      voices: {
        defaultV1: "alloy"
      }
    });

    const appendResponse = await appendTextRoute.POST(
      jsonRequest("/api/codex/threads/mock-thread-1/realtime/append-text", { text: "你好", role: "user" }, cookie),
      { params: Promise.resolve({ threadId: "mock-thread-1" }) }
    );
    expect(appendResponse.status).toBe(200);
    await expect(appendResponse.json()).resolves.toEqual({ ok: true, result: { accepted: true } });
  });
});
