import { describe, expect, it, beforeEach, vi } from "vitest";
import {
  ApiError,
  api,
  setSessionInvalidHandler
} from "../../src/web/api/client";

function makeResponse(body: unknown, init: { status?: number } = {}): Response {
  const status = init.status ?? 200;
  return new Response(typeof body === "string" ? body : JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}

describe("web/api/client", () => {
  beforeEach(() => {
    setSessionInvalidHandler(null);
    vi.restoreAllMocks();
  });

  it("returns parsed JSON for ok responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(makeResponse({ ok: true, value: 1 }))
    );
    const data = await api<{ value: number }>("/api/sample");
    expect(data.ok).toBe(true);
    expect(data.value).toBe(1);
  });

  it("throws ApiError when ok=false", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(makeResponse({ ok: false, error: "boom" }))
    );
    await expect(api("/api/sample")).rejects.toMatchObject({
      name: "ApiError",
      message: "boom"
    });
  });

  it("throws ApiError for non-2xx responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(makeResponse({ ok: false, error: "bad" }, { status: 502 }))
    );
    await expect(api("/api/sample")).rejects.toMatchObject({
      message: "bad",
      status: 502,
      body: { ok: false, error: "bad" }
    });
  });

  it("保留 switch 409/502/500 的结构化业务终态", async () => {
    const terminal = {
      ok: false,
      outcome: "recovery_failed",
      code: "SWITCH_RECOVERY_FAILED",
      operationId: "operation-1",
      latestState: { blocked: true }
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(makeResponse(terminal, { status: 500 }))
    );

    await expect(api("/api/switch")).rejects.toMatchObject({
      name: "ApiError",
      status: 500,
      body: terminal
    });
  });

  it("does not expose raw HTML error pages from reverse proxies", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("<!DOCTYPE html><title>huangzy.cyou | 502: Bad gateway</title><body>Cloudflare</body>", {
          status: 502,
          headers: { "content-type": "text/html" }
        })
      )
    );

    await expect(api("/api/sample")).rejects.toMatchObject({
      name: "ApiError",
      message: "上游服务暂不可用（502 Bad gateway）"
    });
  });

  it("invokes session invalid handler on 401", async () => {
    const handler = vi.fn();
    setSessionInvalidHandler(handler);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(makeResponse({ ok: false }, { status: 401 }))
    );
    await expect(api("/api/sample")).rejects.toBeInstanceOf(ApiError);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("skips session handler when skipSessionRedirect is true", async () => {
    const handler = vi.fn();
    setSessionInvalidHandler(handler);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(makeResponse({ ok: false }, { status: 401 }))
    );
    await expect(api("/api/sample", { skipSessionRedirect: true })).rejects.toBeInstanceOf(
      ApiError
    );
    expect(handler).not.toHaveBeenCalled();
  });

  it("serializes JSON body and sets content-type header", async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeResponse({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    await api("/api/sample", { method: "POST", body: { foo: "bar" } });
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify({ foo: "bar" }));
    expect((init.headers as Record<string, string>)["content-type"]).toBe("application/json");
  });

  it("encodes query parameters and skips undefined", async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeResponse({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    await api("/api/sample", { query: { a: 1, b: undefined, c: "x y" } });
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toBe("/api/sample?a=1&c=x%20y");
  });
});
