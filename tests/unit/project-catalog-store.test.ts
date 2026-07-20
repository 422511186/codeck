// @vitest-environment node

import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  ProjectCatalogRevisionConflictError,
  ProjectCatalogStore,
  ProjectPathConflictError
} from "../../src/server/projects/catalog-store";
import { normalizeProjectPathKey } from "../../src/shared/projects";

const temporaryDirectories: string[] = [];

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "codex-web-projects-"));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("project path normalization", () => {
  it("Windows 路径大小写不敏感，POSIX 路径保留大小写", () => {
    expect(normalizeProjectPathKey("C:\\Work\\Demo\\")).toBe("c:/work/demo");
    expect(normalizeProjectPathKey("c:/work/demo")).toBe("c:/work/demo");
    expect(normalizeProjectPathKey("/Work/Demo/")).toBe("/Work/Demo");
    expect(normalizeProjectPathKey("/work/demo")).toBe("/work/demo");
  });
});

describe("ProjectCatalogStore", () => {
  it("首次读取初始化默认服务端目录", async () => {
    const dataDir = await temporaryDirectory();
    const store = new ProjectCatalogStore({ dataDir });

    await expect(store.read()).resolves.toEqual({ revision: 0, defaultStorage: "server", projects: [] });
    await expect(readFile(join(dataDir, "projects.json"), "utf8").then(JSON.parse)).resolves.toEqual({
      schemaVersion: 1,
      revision: 0,
      defaultStorage: "server",
      projects: []
    });
  });

  it("创建、重命名、默认值修改和删除递增 revision", async () => {
    const dataDir = await temporaryDirectory();
    const store = new ProjectCatalogStore({
      dataDir,
      now: () => 100,
      generateId: () => "project-1"
    });

    const created = await store.create({ name: "Demo", path: "C:/Work/Demo" }, 0);
    expect(created).toMatchObject({
      revision: 1,
      projects: [{ id: "project-1", storage: "server", addedAt: 100, lastUsedAt: 100 }]
    });
    await expect(store.rename("project-1", "Renamed", 1)).resolves.toMatchObject({ revision: 2 });
    await expect(store.setDefaultStorage("client", 2)).resolves.toMatchObject({
      revision: 3,
      defaultStorage: "client"
    });
    await expect(store.delete("project-1", 3)).resolves.toEqual({
      revision: 4,
      defaultStorage: "client",
      projects: []
    });
  });

  it("过期 revision 返回最新完整目录", async () => {
    const dataDir = await temporaryDirectory();
    const store = new ProjectCatalogStore({ dataDir, generateId: () => "project-1" });
    await store.create({ name: "Demo", path: "/workspace/demo" }, 0);

    await expect(store.rename("project-1", "Old write", 0)).rejects.toBeInstanceOf(
      ProjectCatalogRevisionConflictError
    );
  });

  it("同一路径拒绝重复项目", async () => {
    const dataDir = await temporaryDirectory();
    const ids = ["project-1", "project-2"];
    const store = new ProjectCatalogStore({ dataDir, generateId: () => ids.shift() ?? "fallback" });
    await store.create({ name: "One", path: "C:/Work/Demo" }, 0);

    await expect(store.create({ name: "Two", path: "c:\\work\\demo\\" }, 1)).rejects.toBeInstanceOf(
      ProjectPathConflictError
    );
  });

  it("touch 只接受更晚时间且不递增 revision", async () => {
    const dataDir = await temporaryDirectory();
    const store = new ProjectCatalogStore({ dataDir, now: () => 100, generateId: () => "project-1" });
    await store.create({ name: "Demo", path: "/workspace/demo" }, 0);

    await expect(store.touch("project-1", 90)).resolves.toMatchObject({
      revision: 1,
      projects: [{ lastUsedAt: 100 }]
    });
    await expect(store.touch("project-1", 120)).resolves.toMatchObject({
      revision: 1,
      projects: [{ lastUsedAt: 120 }]
    });
  });

  it.each([
    "{broken",
    JSON.stringify({ schemaVersion: 2, revision: 0, defaultStorage: "server", projects: [] }),
    JSON.stringify({
      schemaVersion: 1,
      revision: 0,
      defaultStorage: "server",
      projects: [{ id: "bad", name: "", path: "/workspace", addedAt: 1, lastUsedAt: 1, storage: "server" }]
    })
  ])("损坏文件失败关闭且保留原内容", async (contents) => {
    const dataDir = await temporaryDirectory();
    const filePath = join(dataDir, "projects.json");
    await writeFile(filePath, contents, "utf8");
    const store = new ProjectCatalogStore({ dataDir });

    await expect(store.read()).rejects.toMatchObject({ code: "PROJECT_CATALOG_STORAGE_ERROR" });
    expect(await readFile(filePath, "utf8")).toBe(contents);
  });
});
