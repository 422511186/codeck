import { beforeEach, describe, expect, it, vi } from "vitest";

const mockApi = vi.fn();

vi.mock("../../src/web/api/client", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../src/web/api/client")>();
  return { ...original, api: (...args: unknown[]) => mockApi(...args) };
});
describe("项目目录前端 endpoints", () => {
  beforeEach(() => {
    mockApi.mockReset();
    mockApi.mockResolvedValue({ ok: true, revision: 2, defaultStorage: "server", projects: [] });
  });

  it("读取项目目录并填充缺省 projects", async () => {
    mockApi.mockResolvedValue({ ok: true, revision: 1, defaultStorage: "client" });
    const { codex } = await import("../../src/web/api/endpoints");

    await expect(codex.projectCatalog()).resolves.toEqual({
      revision: 1,
      defaultStorage: "client",
      projects: []
    });
    expect(mockApi).toHaveBeenCalledWith("/api/codex/projects");
  });

  it("创建、重命名、删除和 touch 使用项目 API", async () => {
    const { codex } = await import("../../src/web/api/endpoints");
    const input = { id: "project-1", name: "Demo", path: "/workspace/demo", addedAt: 1, lastUsedAt: 2 };

    await codex.createServerProject(input, 1);
    expect(mockApi).toHaveBeenLastCalledWith("/api/codex/projects", {
      method: "POST",
      body: { expectedRevision: 1, ...input }
    });
    await codex.renameServerProject("project-1", "New", 2);
    expect(mockApi).toHaveBeenLastCalledWith("/api/codex/projects/project-1", {
      method: "PUT",
      body: { expectedRevision: 2, name: "New" }
    });
    await codex.deleteServerProject("project-1", 2);
    expect(mockApi).toHaveBeenLastCalledWith("/api/codex/projects/project-1", {
      method: "DELETE",
      body: { expectedRevision: 2 }
    });
    await codex.touchServerProject("project-1", 30);
    expect(mockApi).toHaveBeenLastCalledWith("/api/codex/projects/project-1/touch", {
      method: "POST",
      body: { lastUsedAt: 30 }
    });
  });

  it("修改共享默认值携带 revision", async () => {
    const { codex } = await import("../../src/web/api/endpoints");

    await codex.updateDefaultProjectStorage("client", 3);
    expect(mockApi).toHaveBeenCalledWith("/api/codex/projects/default-storage", {
      method: "PUT",
      body: { expectedRevision: 3, defaultStorage: "client" }
    });
  });
});
