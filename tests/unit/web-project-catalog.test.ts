import { describe, expect, it } from "vitest";
import { mergeProjectCatalog } from "../../src/web/projects/catalog";
import type { ProjectRecord, ServerProjectRecord } from "../../src/shared/projects";

function local(overrides: Partial<ProjectRecord> = {}): ProjectRecord {
  return {
    id: "local-1",
    name: "Local",
    path: "C:/Work/Local",
    addedAt: 1,
    lastUsedAt: 10,
    storage: "client",
    ...overrides
  };
}

function server(overrides: Partial<ServerProjectRecord> = {}): ServerProjectRecord {
  return {
    id: "server-1",
    name: "Server",
    path: "C:/Work/Server",
    addedAt: 2,
    lastUsedAt: 20,
    storage: "server",
    ...overrides
  };
}

describe("mergeProjectCatalog", () => {
  it("合并两边项目并按最近使用时间倒序", () => {
    const result = mergeProjectCatalog([local()], [server()]);

    expect(result.projects.map((project) => project.id)).toEqual(["server-1", "local-1"]);
    expect(result.conflicts).toEqual([]);
  });

  it("同路径只展示服务端候选并返回显式冲突", () => {
    const localProject = local({ path: "C:/Work/Demo", name: "Local alias" });
    const serverProject = server({ path: "c:\\work\\demo\\", name: "Server alias" });
    const result = mergeProjectCatalog([localProject], [serverProject]);

    expect(result.projects).toEqual([serverProject]);
    expect(result.conflicts).toEqual([{ local: localProject, server: serverProject }]);
  });

  it("POSIX 路径大小写不同不视为冲突", () => {
    const result = mergeProjectCatalog(
      [local({ path: "/Work/Demo" })],
      [server({ path: "/work/demo" })]
    );

    expect(result.projects).toHaveLength(2);
    expect(result.conflicts).toEqual([]);
  });
});
