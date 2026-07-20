// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ProjectCatalogRevisionConflictError,
  ProjectCatalogStoreError,
  ProjectPathConflictError
} from "../../src/server/projects/catalog-store";
import type { ProjectCatalog } from "../../src/shared/projects";

const mockAuthenticated = vi.fn(() => true);
const mockAudit = vi.fn();
const mockAllowedPath = vi.fn((path: string) => path.replace(/\\/g, "/"));
const mockRead = vi.fn();
const mockCreate = vi.fn();
const mockRename = vi.fn();
const mockDelete = vi.fn();
const mockTouch = vi.fn();
const mockSetDefaultStorage = vi.fn();

vi.mock("../../src/server/auth", () => ({
  isRequestAuthenticated: () => mockAuthenticated()
}));

vi.mock("../../src/server/security", () => ({
  assertRuntimePathAllowed: (...args: unknown[]) => mockAllowedPath(...args as [string]),
  assertRuntimeWorkspaceRootsAllowed: (roots: string[]) => roots,
  audit: (...args: unknown[]) => mockAudit(...args)
}));

vi.mock("../../src/server/projects/runtime", () => ({
  getProjectCatalogStore: () => ({
    read: (...args: unknown[]) => mockRead(...args),
    create: (...args: unknown[]) => mockCreate(...args),
    rename: (...args: unknown[]) => mockRename(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
    touch: (...args: unknown[]) => mockTouch(...args),
    setDefaultStorage: (...args: unknown[]) => mockSetDefaultStorage(...args)
  })
}));

const emptyCatalog: ProjectCatalog = { revision: 0, defaultStorage: "server", projects: [] };
const populatedCatalog: ProjectCatalog = {
  revision: 1,
  defaultStorage: "server",
  projects: [
    {
      id: "project-1",
      name: "Demo",
      path: "C:/Work/Demo",
      addedAt: 10,
      lastUsedAt: 20,
      storage: "server"
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

describe("项目目录 routes", () => {
  beforeEach(() => {
    vi.resetModules();
    mockAuthenticated.mockReset();
    mockAuthenticated.mockReturnValue(true);
    mockAudit.mockReset();
    mockAudit.mockResolvedValue(undefined);
    mockAllowedPath.mockReset();
    mockAllowedPath.mockImplementation((path: string) => path.replace(/\\/g, "/"));
    for (const mock of [mockRead, mockCreate, mockRename, mockDelete, mockTouch, mockSetDefaultStorage]) {
      mock.mockReset();
    }
    mockRead.mockResolvedValue(emptyCatalog);
  });

  it("所有入口要求认证", async () => {
    mockAuthenticated.mockReturnValue(false);
    const collection = await import("../../src/app/api/codex/projects/route");
    const item = await import("../../src/app/api/codex/projects/[projectId]/route");
    const touch = await import("../../src/app/api/codex/projects/[projectId]/touch/route");
    const defaults = await import("../../src/app/api/codex/projects/default-storage/route");

    expect((await collection.GET(request("/api/codex/projects", "GET"))).status).toBe(401);
    expect((await collection.POST(request("/api/codex/projects", "POST", {}))).status).toBe(401);
    expect((await item.PUT(request("/api/codex/projects/project-1", "PUT", {}), { params: Promise.resolve({ projectId: "project-1" }) })).status).toBe(401);
    expect((await item.DELETE(request("/api/codex/projects/project-1", "DELETE", {}), { params: Promise.resolve({ projectId: "project-1" }) })).status).toBe(401);
    expect((await touch.POST(request("/api/codex/projects/project-1/touch", "POST", {}), { params: Promise.resolve({ projectId: "project-1" }) })).status).toBe(401);
    expect((await defaults.PUT(request("/api/codex/projects/default-storage", "PUT", {}))).status).toBe(401);
  });

  it("GET 返回完整目录", async () => {
    mockRead.mockResolvedValue(populatedCatalog);
    const { GET } = await import("../../src/app/api/codex/projects/route");
    const response = await GET(request("/api/codex/projects", "GET"));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, ...populatedCatalog });
  });

  it("POST 校验 allowlist、保留迁移 ID 并记录审计", async () => {
    mockCreate.mockResolvedValue(populatedCatalog);
    const { POST } = await import("../../src/app/api/codex/projects/route");
    const response = await POST(request("/api/codex/projects", "POST", {
      expectedRevision: 0,
      id: "project-1",
      name: "Demo",
      path: "C:\\Work\\Demo",
      addedAt: 10,
      lastUsedAt: 20
    }));

    expect(response.status).toBe(200);
    expect(mockAllowedPath).toHaveBeenCalledWith("C:\\Work\\Demo", []);
    expect(mockCreate).toHaveBeenCalledWith({
      id: "project-1",
      name: "Demo",
      path: "C:/Work/Demo",
      addedAt: 10,
      lastUsedAt: 20
    }, 0);
    expect(mockAudit).toHaveBeenCalledWith("project.create", expect.objectContaining({
      projectId: "project-1",
      oldRevision: 0,
      newRevision: 1
    }));
  });

  it("revision 和路径冲突返回 409 与最新目录", async () => {
    const { POST } = await import("../../src/app/api/codex/projects/route");
    mockCreate.mockRejectedValueOnce(new ProjectCatalogRevisionConflictError(populatedCatalog));
    const revision = await POST(request("/api/codex/projects", "POST", {
      expectedRevision: 0,
      name: "Demo",
      path: "C:/Work/Demo"
    }));
    expect(revision.status).toBe(409);
    await expect(revision.json()).resolves.toMatchObject({
      code: "PROJECT_CATALOG_REVISION_CONFLICT",
      revision: 1
    });

    mockCreate.mockRejectedValueOnce(new ProjectPathConflictError(populatedCatalog, populatedCatalog.projects[0]));
    const path = await POST(request("/api/codex/projects", "POST", {
      expectedRevision: 1,
      name: "Demo",
      path: "C:/Work/Demo"
    }));
    expect(path.status).toBe(409);
    await expect(path.json()).resolves.toMatchObject({
      code: "PROJECT_PATH_CONFLICT",
      conflictingProject: { id: "project-1" }
    });
  });

  it("重命名、touch、默认值和删除调用对应 store", async () => {
    mockRename.mockResolvedValue({ ...populatedCatalog, revision: 2 });
    mockTouch.mockResolvedValue(populatedCatalog);
    mockSetDefaultStorage.mockResolvedValue({ ...populatedCatalog, revision: 2, defaultStorage: "client" });
    mockDelete.mockResolvedValue({ ...populatedCatalog, revision: 2, projects: [] });
    const item = await import("../../src/app/api/codex/projects/[projectId]/route");
    const touch = await import("../../src/app/api/codex/projects/[projectId]/touch/route");
    const defaults = await import("../../src/app/api/codex/projects/default-storage/route");
    const context = { params: Promise.resolve({ projectId: "project-1" }) };

    expect((await item.PUT(request("/api/codex/projects/project-1", "PUT", { expectedRevision: 1, name: "New" }), context)).status).toBe(200);
    expect(mockRename).toHaveBeenCalledWith("project-1", "New", 1);
    expect((await touch.POST(request("/api/codex/projects/project-1/touch", "POST", { lastUsedAt: 30 }), context)).status).toBe(200);
    expect(mockTouch).toHaveBeenCalledWith("project-1", 30);
    expect((await defaults.PUT(request("/api/codex/projects/default-storage", "PUT", { expectedRevision: 1, defaultStorage: "client" }))).status).toBe(200);
    expect(mockSetDefaultStorage).toHaveBeenCalledWith("client", 1);
    expect((await item.DELETE(request("/api/codex/projects/project-1", "DELETE", { expectedRevision: 1 }), context)).status).toBe(200);
    expect(mockDelete).toHaveBeenCalledWith("project-1", 1);
  });

  it("不存在项目返回 404 且删除不调用文件系统或 thread API", async () => {
    mockDelete.mockRejectedValue(new ProjectCatalogStoreError("PROJECT_NOT_FOUND", "项目不存在"));
    const item = await import("../../src/app/api/codex/projects/[projectId]/route");
    const response = await item.DELETE(
      request("/api/codex/projects/missing", "DELETE", { expectedRevision: 1 }),
      { params: Promise.resolve({ projectId: "missing" }) }
    );
    expect(response.status).toBe(404);
    expect(mockDelete).toHaveBeenCalledTimes(1);
  });
});
