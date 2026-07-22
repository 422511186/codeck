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
    expect(mockResolveServerRequest).toHaveBeenCalledWith(22, "fast");
    expect(mockAudit).toHaveBeenCalledWith("request.resolve", { requestId: 22, value: "fast" });
  });

  it("拒绝绕过 pending option 校验的 raw response", async () => {
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

    expect(response.status).toBe(400);
    expect(mockResolveServerRequest).not.toHaveBeenCalled();
    expect(mockAudit).not.toHaveBeenCalled();
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

  it("把 pending option 过期错误映射为 400", async () => {
    const { POST } = await import("../../src/app/api/codex/requests/[requestId]/resolve/route");
    const error = Object.assign(new Error("审批选项无效或已过期"), { httpStatus: 400 });
    mockResolveServerRequest.mockRejectedValueOnce(error);

    const response = await POST(
      new Request("http://localhost/api/codex/requests/22/resolve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ value: "decision:99" })
      }),
      { params: Promise.resolve({ requestId: "22" }) }
    );
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json).toMatchObject({ ok: false, error: "审批选项无效或已过期" });
  });
});
