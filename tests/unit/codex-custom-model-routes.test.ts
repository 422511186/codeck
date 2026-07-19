import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  CatalogRevisionConflictError,
  CustomModelStoreError
} from "../../src/server/custom-models/catalog-store";
import type { CustomModelCatalog } from "../../src/shared/custom-models";

const mockAuthenticated = vi.fn(() => true);
const mockAudit = vi.fn();
const mockRead = vi.fn();
const mockCreate = vi.fn();
const mockReplace = vi.fn();
const mockDelete = vi.fn();
const mockListModels = vi.fn();

vi.mock("../../src/server/auth", () => ({
  isRequestAuthenticated: () => mockAuthenticated()
}));

vi.mock("../../src/server/security", () => ({
  assertRuntimePathAllowed: (path: string) => path,
  assertRuntimeWorkspaceRootsAllowed: (roots: string[]) => roots,
  audit: (...args: unknown[]) => mockAudit(...args)
}));

vi.mock("../../src/server/custom-models/runtime", () => ({
  getCustomModelCatalogStore: () => ({
    read: (...args: unknown[]) => mockRead(...args),
    create: (...args: unknown[]) => mockCreate(...args),
    replace: (...args: unknown[]) => mockReplace(...args),
    delete: (...args: unknown[]) => mockDelete(...args)
  })
}));

vi.mock("../../src/server/app-server/runtime", () => ({
  getAppServerGateway: () => ({
    listModels: (...args: unknown[]) => mockListModels(...args)
  })
}));

const emptyCatalog = { revision: 0, models: [] };
const populatedCatalog: CustomModelCatalog = {
  revision: 1,
  models: [
    {
      customModelId: "custom-1",
      model: "mimo-v2.5-pro",
      label: "MIMO",
      contextWindow: 200_000,
      inputModalities: ["text"],
      supportedReasoningEfforts: [],
      defaultReasoningEffort: null,
      createdAt: "2026-07-18T00:00:00.000Z",
      updatedAt: "2026-07-18T00:00:00.000Z"
    }
  ]
};

function request(pathname: string, method: string, body?: unknown): Request {
  return new Request(`http://localhost${pathname}`, {
    method,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
}

function mutableInput(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    model: "mimo-v2.5-pro",
    label: "MIMO",
    contextWindow: 200_000,
    inputModalities: ["text"],
    supportedReasoningEfforts: [],
    defaultReasoningEffort: null,
    ...overrides
  };
}

describe("自定义模型 CRUD routes", () => {
  beforeEach(() => {
    vi.resetModules();
    mockAuthenticated.mockReset();
    mockAuthenticated.mockReturnValue(true);
    mockAudit.mockReset();
    mockAudit.mockResolvedValue(undefined);
    mockRead.mockReset();
    mockCreate.mockReset();
    mockReplace.mockReset();
    mockDelete.mockReset();
    mockListModels.mockReset();
    mockRead.mockResolvedValue(emptyCatalog);
  });

  it("统一模型目录返回 catalogRevision 和后端合并后的来源身份", async () => {
    mockRead.mockResolvedValue(populatedCatalog);
    mockListModels.mockResolvedValue([
      {
        id: "official-id",
        model: "mimo-v2.5-pro",
        label: "Official MIMO",
        isDefault: false,
        supportedReasoningEfforts: ["medium"],
        defaultReasoningEffort: "medium",
        inputModalities: ["text"]
      },
      {
        id: "gpt-id",
        model: "gpt-5.6-sol",
        label: "GPT-5.6",
        isDefault: true,
        supportedReasoningEfforts: ["high"],
        defaultReasoningEffort: "high",
        inputModalities: ["text", "image"]
      }
    ]);
    const { GET } = await import("../../src/app/api/codex/models/route");

    const response = await GET(request("/api/codex/models", "GET"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      catalogRevision: 1,
      models: [
        { source: "custom", customModelId: "custom-1", model: "mimo-v2.5-pro" },
        { source: "app-server", model: "gpt-5.6-sol" }
      ]
    });
  });

  it("所有入口都要求认证", async () => {
    mockAuthenticated.mockReturnValue(false);
    const collection = await import("../../src/app/api/codex/custom-models/route");
    const item = await import("../../src/app/api/codex/custom-models/[customModelId]/route");

    expect((await collection.GET(request("/api/codex/custom-models", "GET"))).status).toBe(401);
    expect((await collection.POST(request("/api/codex/custom-models", "POST", {}))).status).toBe(401);
    expect(
      (await item.PUT(request("/api/codex/custom-models/custom-1", "PUT", {}), {
        params: Promise.resolve({ customModelId: "custom-1" })
      })).status
    ).toBe(401);
    expect(
      (await item.DELETE(request("/api/codex/custom-models/custom-1", "DELETE", {}), {
        params: Promise.resolve({ customModelId: "custom-1" })
      })).status
    ).toBe(401);
    expect(mockRead).not.toHaveBeenCalled();
  });

  it("GET 返回完整目录", async () => {
    mockRead.mockResolvedValue(populatedCatalog);
    const { GET } = await import("../../src/app/api/codex/custom-models/route");

    const response = await GET(request("/api/codex/custom-models", "GET"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, ...populatedCatalog });
  });

  it("POST malformed JSON 返回 400 且不调用 store", async () => {
    const { POST } = await import("../../src/app/api/codex/custom-models/route");
    const malformed = new Request("http://localhost/api/codex/custom-models", {
      method: "POST",
      body: "{"
    });

    const response = await POST(malformed);

    expect(response.status).toBe(400);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("POST 拒绝 provider/路径字段并返回字段级错误", async () => {
    const { POST } = await import("../../src/app/api/codex/custom-models/route");
    const response = await POST(
      request("/api/codex/custom-models", "POST", {
        expectedRevision: 0,
        ...mutableInput({ provider: "renamed-provider", persistencePath: "/tmp/injected" })
      })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      code: "CUSTOM_MODEL_VALIDATION_FAILED",
      issues: [expect.objectContaining({ field: "provider" })]
    });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("POST 应用创建默认值并要求 expectedRevision", async () => {
    mockCreate.mockResolvedValue(populatedCatalog);
    const { POST } = await import("../../src/app/api/codex/custom-models/route");
    const response = await POST(
      request("/api/codex/custom-models", "POST", {
        expectedRevision: 0,
        model: " mimo-v2.5-pro ",
        label: " MIMO "
      })
    );

    expect(response.status).toBe(200);
    expect(mockCreate).toHaveBeenCalledWith(
      {
        model: "mimo-v2.5-pro",
        label: "MIMO",
        contextWindow: 200_000,
        inputModalities: ["text"],
        supportedReasoningEfforts: [],
        defaultReasoningEffort: null
      },
      0
    );
    await expect(response.json()).resolves.toEqual({ ok: true, ...populatedCatalog });
    expect(mockAudit).toHaveBeenCalledWith("customModel.create", {
      customModelId: "custom-1",
      model: "mimo-v2.5-pro",
      oldRevision: 0,
      newRevision: 1
    });
    expect(JSON.stringify(mockAudit.mock.calls)).not.toMatch(/provider|baseUrl|apiKey|authorization|secret/i);
  });

  it("revision 409 返回稳定 code 和最新完整目录", async () => {
    mockCreate.mockRejectedValue(new CatalogRevisionConflictError(populatedCatalog));
    const { POST } = await import("../../src/app/api/codex/custom-models/route");

    const response = await POST(
      request("/api/codex/custom-models", "POST", { expectedRevision: 0, ...mutableInput() })
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      code: "CATALOG_REVISION_CONFLICT",
      error: "自定义模型目录已被其他客户端修改",
      ...populatedCatalog
    });
  });

  it("PUT 是完整替换，缺失字段返回 400", async () => {
    const { PUT } = await import("../../src/app/api/codex/custom-models/[customModelId]/route");
    const response = await PUT(
      request("/api/codex/custom-models/custom-1", "PUT", {
        expectedRevision: 1,
        model: "mimo-v2.5-pro",
        label: "MIMO"
      }),
      { params: Promise.resolve({ customModelId: "custom-1" }) }
    );

    expect(response.status).toBe(400);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("PUT 不存在返回 404，DELETE 成功返回完整目录", async () => {
    const item = await import("../../src/app/api/codex/custom-models/[customModelId]/route");
    mockReplace.mockRejectedValue(
      new CustomModelStoreError("CUSTOM_MODEL_NOT_FOUND", "自定义模型不存在")
    );

    const notFound = await item.PUT(
      request("/api/codex/custom-models/missing", "PUT", {
        expectedRevision: 1,
        ...mutableInput()
      }),
      { params: Promise.resolve({ customModelId: "missing" }) }
    );
    expect(notFound.status).toBe(404);
    await expect(notFound.json()).resolves.toMatchObject({
      ok: false,
      code: "CUSTOM_MODEL_NOT_FOUND"
    });

    mockRead.mockResolvedValue(populatedCatalog);
    mockDelete.mockResolvedValue({ revision: 2, models: [] });
    const deleted = await item.DELETE(
      request("/api/codex/custom-models/custom-1", "DELETE", { expectedRevision: 1 }),
      { params: Promise.resolve({ customModelId: "custom-1" }) }
    );
    expect(deleted.status).toBe(200);
    await expect(deleted.json()).resolves.toEqual({ ok: true, revision: 2, models: [] });
    expect(mockAudit).toHaveBeenCalledWith("customModel.delete", {
      customModelId: "custom-1",
      model: "mimo-v2.5-pro",
      oldRevision: 1,
      newRevision: 2
    });
  });

  it("PUT 成功审计身份与目录 revision，不记录配置外字段", async () => {
    mockReplace.mockResolvedValue({ ...populatedCatalog, revision: 2 });
    const { PUT } = await import("../../src/app/api/codex/custom-models/[customModelId]/route");
    const response = await PUT(
      request("/api/codex/custom-models/custom-1", "PUT", {
        expectedRevision: 1,
        ...mutableInput()
      }),
      { params: Promise.resolve({ customModelId: "custom-1" }) }
    );

    expect(response.status).toBe(200);
    expect(mockAudit).toHaveBeenCalledWith("customModel.replace", {
      customModelId: "custom-1",
      model: "mimo-v2.5-pro",
      oldRevision: 1,
      newRevision: 2
    });
  });
});
