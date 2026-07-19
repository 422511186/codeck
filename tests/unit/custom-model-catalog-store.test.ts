import { mkdtemp, readFile, rm, stat, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CatalogRevisionConflictError,
  CustomModelCatalogStore,
  CustomModelStoreError
} from "../../src/server/custom-models/catalog-store";
import { atomicWriteJson } from "../../src/server/persistence/atomic-json-file";
import type { CustomModelConfig, CustomModelInput } from "../../src/shared/custom-models";

const temporaryDirectories: string[] = [];

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "codex-web-custom-models-"));
  temporaryDirectories.push(directory);
  return directory;
}

function input(index = 1): CustomModelInput {
  return {
    model: `mimo-v2.5-pro-${index}`,
    label: `MIMO ${index}`,
    contextWindow: 200_000,
    inputModalities: ["text"],
    supportedReasoningEfforts: ["medium", "xhigh"],
    defaultReasoningEffort: "medium"
  };
}

function config(index: number): CustomModelConfig {
  return {
    ...input(index),
    customModelId: `custom-${index}`,
    createdAt: "2026-07-18T00:00:00.000Z",
    updatedAt: "2026-07-18T00:00:00.000Z"
  };
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("CustomModelCatalogStore", () => {
  it("首次读取原子初始化 schemaVersion 1 和 revision 0", async () => {
    const dataDir = await temporaryDirectory();
    const store = new CustomModelCatalogStore({ dataDir });

    await expect(store.read()).resolves.toEqual({ revision: 0, models: [] });
    const file = JSON.parse(await readFile(join(dataDir, "custom-models.json"), "utf8"));
    expect(file).toEqual({ schemaVersion: 1, revision: 0, models: [] });
    expect((await stat(join(dataDir, "custom-models.json"))).isFile()).toBe(true);
    expect((await stat(join(dataDir, "custom-models.json"))).mode & 0o777).toBe(0o600);
  });

  it.each([
    "{broken-json",
    JSON.stringify({ schemaVersion: 2, revision: 0, models: [] }),
    JSON.stringify({ schemaVersion: 1, revision: -1, models: [] }),
    JSON.stringify({ schemaVersion: 1, revision: 0, models: [{ provider: "secret" }] })
  ])("目录文件损坏时失败关闭且保留原内容", async (contents) => {
    const dataDir = await temporaryDirectory();
    const filePath = join(dataDir, "custom-models.json");
    await writeFile(filePath, contents, "utf8");
    const store = new CustomModelCatalogStore({ dataDir });

    await expect(store.read()).rejects.toMatchObject({ code: "CUSTOM_MODEL_STORAGE_ERROR" });
    expect(await readFile(filePath, "utf8")).toBe(contents);
  });

  it("创建、完整替换和删除分别递增 revision 并保留身份时间", async () => {
    const dataDir = await temporaryDirectory();
    const times = [
      new Date("2026-07-18T00:00:00.000Z"),
      new Date("2026-07-18T01:00:00.000Z")
    ];
    const ids = ["custom-created"];
    const store = new CustomModelCatalogStore({
      dataDir,
      now: () => times.shift() ?? new Date("2026-07-18T02:00:00.000Z"),
      generateId: () => ids.shift() ?? "custom-fallback"
    });

    const created = await store.create(input(), 0);
    expect(created.revision).toBe(1);
    expect(created.models[0]).toMatchObject({
      customModelId: "custom-created",
      createdAt: "2026-07-18T00:00:00.000Z",
      updatedAt: "2026-07-18T00:00:00.000Z"
    });

    const replaced = await store.replace("custom-created", input(2), 1);
    expect(replaced.revision).toBe(2);
    expect(replaced.models[0]).toMatchObject({
      customModelId: "custom-created",
      model: "mimo-v2.5-pro-2",
      createdAt: "2026-07-18T00:00:00.000Z",
      updatedAt: "2026-07-18T01:00:00.000Z"
    });

    await expect(store.delete("custom-created", 2)).resolves.toEqual({ revision: 3, models: [] });
  });

  it("两个实例在锁内重读并将过期 revision 返回为最新完整目录", async () => {
    const dataDir = await temporaryDirectory();
    const first = new CustomModelCatalogStore({ dataDir, generateId: () => "custom-first" });
    const second = new CustomModelCatalogStore({ dataDir, generateId: () => "custom-second" });

    const results = await Promise.allSettled([first.create(input(1), 0), second.create(input(2), 0)]);
    const fulfilled = results.filter((result) => result.status === "fulfilled");
    const rejected = results.filter((result) => result.status === "rejected");

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    const conflict = (rejected[0] as PromiseRejectedResult).reason;
    expect(conflict).toBeInstanceOf(CatalogRevisionConflictError);
    expect(conflict).toMatchObject({
      code: "CATALOG_REVISION_CONFLICT",
      latestCatalog: { revision: 1 }
    });
    expect(conflict.latestCatalog.models).toHaveLength(1);
  });

  it("写入失败时保留上一版完整文件", async () => {
    const dataDir = await temporaryDirectory();
    const store = new CustomModelCatalogStore({ dataDir, generateId: () => "custom-1" });
    await store.create(input(), 0);
    const filePath = join(dataDir, "custom-models.json");
    const before = await readFile(filePath, "utf8");
    const failingStore = new CustomModelCatalogStore({
      dataDir,
      atomicWrite: vi.fn().mockRejectedValue(new Error("disk full"))
    });

    await expect(failingStore.replace("custom-1", input(2), 1)).rejects.toMatchObject({
      code: "CUSTOM_MODEL_STORAGE_ERROR"
    });
    expect(await readFile(filePath, "utf8")).toBe(before);
  });

  it("原子写入不留下临时文件", async () => {
    const dataDir = await temporaryDirectory();
    const filePath = join(dataDir, "value.json");

    await atomicWriteJson(filePath, { revision: 1 });

    expect(JSON.parse(await readFile(filePath, "utf8"))).toEqual({ revision: 1 });
    const { readdir } = await import("node:fs/promises");
    expect((await readdir(dataDir)).filter((name) => name.endsWith(".tmp"))).toEqual([]);
  });

  it("锁占用超时返回稳定错误", async () => {
    const dataDir = await temporaryDirectory();
    const store = new CustomModelCatalogStore({
      dataDir,
      lockOptions: { timeoutMs: 20, retryDelayMs: 5, staleMs: 60_000 }
    });
    await store.read();
    await writeFile(join(dataDir, "custom-models.json.lock"), "occupied", "utf8");

    await expect(store.create(input(), 0)).rejects.toMatchObject({ code: "CUSTOM_MODEL_LOCK_TIMEOUT" });
  });

  it("恢复 stale 锁后完成 mutation", async () => {
    const dataDir = await temporaryDirectory();
    const store = new CustomModelCatalogStore({
      dataDir,
      generateId: () => "custom-stale",
      lockOptions: { timeoutMs: 100, retryDelayMs: 5, staleMs: 10 }
    });
    await store.read();
    const lockPath = join(dataDir, "custom-models.json.lock");
    await writeFile(lockPath, "stale", "utf8");
    const old = new Date(Date.now() - 60_000);
    await utimes(lockPath, old, old);

    await expect(store.create(input(), 0)).resolves.toMatchObject({ revision: 1 });
  });

  it("达到 200 条上限后只阻止创建，仍允许替换和删除", async () => {
    const dataDir = await temporaryDirectory();
    await writeFile(
      join(dataDir, "custom-models.json"),
      `${JSON.stringify({ schemaVersion: 1, revision: 10, models: Array.from({ length: 200 }, (_, i) => config(i)) }, null, 2)}\n`,
      "utf8"
    );
    const store = new CustomModelCatalogStore({ dataDir });

    await expect(store.create(input(201), 10)).rejects.toMatchObject({ code: "CUSTOM_MODEL_LIMIT_REACHED" });
    await expect(store.replace("custom-0", input(300), 10)).resolves.toMatchObject({ revision: 11 });
    await expect(store.delete("custom-1", 11)).resolves.toMatchObject({ revision: 12 });
  });

  it("不存在的 customModelId 返回稳定错误且不改 revision", async () => {
    const dataDir = await temporaryDirectory();
    const store = new CustomModelCatalogStore({ dataDir });

    await expect(store.replace("missing", input(), 0)).rejects.toBeInstanceOf(CustomModelStoreError);
    await expect(store.delete("missing", 0)).rejects.toMatchObject({ code: "CUSTOM_MODEL_NOT_FOUND" });
    await expect(store.read()).resolves.toEqual({ revision: 0, models: [] });
  });
});
