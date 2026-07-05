import { beforeEach, describe, expect, it, vi } from "vitest";

const mockIsRequestAuthenticated = vi.fn((_request?: Request) => true);
const mockAudit = vi.fn();
const mockWriteSkillConfig = vi.fn();
const mockReadConfig = vi.fn();

vi.mock("../../src/server/auth", () => ({
  isRequestAuthenticated: (request: Request) => mockIsRequestAuthenticated(request)
}));

vi.mock("../../src/server/security", () => ({
  audit: (...args: unknown[]) => mockAudit(...args)
}));

vi.mock("../../src/server/app-server/runtime", () => ({
  getAppServerGateway: () => ({
    writeSkillConfig: (...args: unknown[]) => mockWriteSkillConfig(...args),
    readConfig: (...args: unknown[]) => mockReadConfig(...args)
  })
}));

function jsonRequest(pathname: string, body: unknown): Request {
  return new Request(`http://localhost${pathname}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}

describe("codex config routes", () => {
  beforeEach(() => {
    vi.resetModules();
    mockIsRequestAuthenticated.mockReset();
    mockIsRequestAuthenticated.mockReturnValue(true);
    mockAudit.mockReset();
    mockWriteSkillConfig.mockReset();
    mockReadConfig.mockReset();
    mockWriteSkillConfig.mockResolvedValue({ effectiveEnabled: false });
    mockReadConfig.mockResolvedValue({ config: { model: "gpt-5" }, origins: {}, layers: null });
  });

  it("skills/config 拒绝字符串 false 且不调用 app-server", async () => {
    const { POST } = await import("../../src/app/api/codex/skills/config/route");

    const response = await POST(
      jsonRequest("/api/codex/skills/config", { name: "openai-docs", enabled: "false" })
    );

    expect(response.status).toBe(400);
    expect(mockWriteSkillConfig).not.toHaveBeenCalled();
  });

  it("skills/config 保留 boolean false 语义", async () => {
    const { POST } = await import("../../src/app/api/codex/skills/config/route");

    const response = await POST(
      jsonRequest("/api/codex/skills/config", { name: "openai-docs", enabled: false })
    );

    expect(response.status).toBe(200);
    expect(mockWriteSkillConfig).toHaveBeenCalledWith({ name: "openai-docs", path: null, enabled: false });
  });

  it("config/value GET 未认证时返回 401", async () => {
    mockIsRequestAuthenticated.mockReturnValue(false);
    const route = await import("../../src/app/api/codex/config/value/route");

    const response = await route.GET(new Request("http://localhost/api/codex/config/value"));

    expect(response.status).toBe(401);
    expect(mockReadConfig).not.toHaveBeenCalled();
  });

  it("config/value GET 返回当前配置对象", async () => {
    const route = await import("../../src/app/api/codex/config/value/route");

    const response = await route.GET(new Request("http://localhost/api/codex/config/value"));

    expect(response.status).toBe(200);
    expect(mockReadConfig).toHaveBeenCalledTimes(1);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      result: { config: { model: "gpt-5" }, origins: {}, layers: null }
    });
  });
});
