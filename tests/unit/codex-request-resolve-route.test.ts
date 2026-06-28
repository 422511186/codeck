import { beforeEach, describe, expect, it, vi } from "vitest";

const mockResolveServerRequest = vi.fn();
const mockAudit = vi.fn();

vi.mock("../../src/server/auth", () => ({
  isRequestAuthenticated: () => true
}));

vi.mock("../../src/server/security", () => ({
  audit: (...args: unknown[]) => mockAudit(...args)
}));

vi.mock("../../src/server/app-server/runtime", () => ({
  getAppServerGateway: () => ({
    resolveServerRequest: (...args: unknown[]) => mockResolveServerRequest(...args)
  })
}));

describe("codex request resolve route", () => {
  beforeEach(() => {
    vi.resetModules();
    mockResolveServerRequest.mockReset();
    mockAudit.mockReset();
    mockResolveServerRequest.mockResolvedValue(undefined);
  });

  it("常规路径提交 value，由 gateway 构造 app-server response", async () => {
    const { POST } = await import("../../src/app/api/codex/requests/[requestId]/resolve/route");

    const response = await POST(
      new Request("http://localhost/api/codex/requests/22/resolve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ value: "fast" })
      }),
      { params: Promise.resolve({ requestId: "22" }) }
    );

    expect(response.status).toBe(200);
    expect(mockResolveServerRequest).toHaveBeenCalledWith(22, "fast", undefined);
    expect(mockAudit).toHaveBeenCalledWith("request.resolve", { requestId: 22, value: "fast" });
  });

  it("保留 response 兼容逃生路径，但审计不记录完整 response", async () => {
    const { POST } = await import("../../src/app/api/codex/requests/[requestId]/resolve/route");
    const rawResponse = { answers: { mode: { answers: ["fast"] } } };

    const response = await POST(
      new Request("http://localhost/api/codex/requests/22/resolve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ response: rawResponse })
      }),
      { params: Promise.resolve({ requestId: "22" }) }
    );

    expect(response.status).toBe(200);
    expect(mockResolveServerRequest).toHaveBeenCalledWith(22, "", { response: rawResponse });
    expect(mockAudit).toHaveBeenCalledWith("request.resolve", { requestId: 22, mode: "raw" });
  });

  it("没有 value 或 response 时返回 400", async () => {
    const { POST } = await import("../../src/app/api/codex/requests/[requestId]/resolve/route");

    const response = await POST(
      new Request("http://localhost/api/codex/requests/22/resolve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ decision: "approve" })
      }),
      { params: Promise.resolve({ requestId: "22" }) }
    );
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json).toMatchObject({ ok: false, error: "value 无效" });
    expect(mockResolveServerRequest).not.toHaveBeenCalled();
  });
});
