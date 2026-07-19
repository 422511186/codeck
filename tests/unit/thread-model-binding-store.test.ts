import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { CustomModelCatalogStore } from "../../src/server/custom-models/catalog-store";
import {
  ThreadModelBindingStore,
  ThreadModelBindingStoreError
} from "../../src/server/custom-models/binding-store";
import type {
  RuntimeModelSnapshot,
  ThreadModelBindingInput
} from "../../src/shared/custom-models";

const temporaryDirectories: string[] = [];

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "codex-web-bindings-"));
  temporaryDirectories.push(directory);
  return directory;
}

function bindingInput(overrides: Partial<ThreadModelBindingInput> = {}): ThreadModelBindingInput {
  return {
    customModelId: "custom-1",
    model: "mimo-v2.5-pro",
    label: "MIMO 2.5 Pro",
    contextWindow: 200_000,
    inputModalities: ["text", "image"],
    supportedReasoningEfforts: ["medium", "xhigh"],
    defaultReasoningEffort: "medium",
    reasoningEffort: "xhigh",
    sourceUpdatedAt: "2026-07-18T00:00:00.000Z",
    ...overrides
  };
}

function customSnapshot(input: ThreadModelBindingInput = bindingInput()): RuntimeModelSnapshot {
  return {
    selection: { source: "custom", customModelId: input.customModelId },
    model: input.model,
    label: input.label,
    contextWindow: input.contextWindow,
    inputModalities: input.inputModalities,
    supportedReasoningEfforts: input.supportedReasoningEfforts,
    defaultReasoningEffort: input.defaultReasoningEffort,
    reasoningEffort: input.reasoningEffort,
    binding: null
  };
}

function appServerSnapshot(): RuntimeModelSnapshot {
  return {
    selection: { source: "app-server", model: "gpt-5.6-sol" },
    model: "gpt-5.6-sol",
    label: "GPT-5.6",
    contextWindow: null,
    inputModalities: ["text", "image"],
    supportedReasoningEfforts: ["medium", "high"],
    defaultReasoningEffort: "medium",
    reasoningEffort: "high",
    binding: null
  };
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("ThreadModelBindingStore", () => {
  it("首次读取初始化独立 schema，且无绑定会话不会按同名目录自动认领", async () => {
    const dataDir = await temporaryDirectory();
    const catalog = new CustomModelCatalogStore({ dataDir, generateId: () => "custom-1" });
    await catalog.create(
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
    const store = new ThreadModelBindingStore({ dataDir });

    await expect(store.getThreadState("old-thread")).resolves.toEqual({ binding: null, operation: null });
    expect(JSON.parse(await readFile(join(dataDir, "thread-model-bindings.json"), "utf8"))).toEqual({
      schemaVersion: 1,
      revision: 0,
      bindings: {},
      operations: {}
    });
  });

  it("创建、reasoning 更新和 fork 均生成独立 bindingVersion", async () => {
    const dataDir = await temporaryDirectory();
    const ids = ["binding-1", "binding-2", "binding-fork"];
    const store = new ThreadModelBindingStore({
      dataDir,
      generateId: () => ids.shift() ?? "binding-fallback",
      now: () => new Date("2026-07-18T01:00:00.000Z")
    });

    const created = await store.putBinding("thread-1", bindingInput());
    const updated = await store.updateReasoning("thread-1", "medium");
    const forked = await store.forkBinding("thread-1", "thread-2");

    expect(created.bindingVersion).toBe("binding-1");
    expect(updated?.bindingVersion).toBe("binding-2");
    expect(updated?.reasoningEffort).toBe("medium");
    expect(forked?.bindingVersion).toBe("binding-fork");
    expect(forked).toMatchObject({ model: created.model, reasoningEffort: "medium" });
    expect(new Set([created.bindingVersion, updated?.bindingVersion, forked?.bindingVersion]).size).toBe(3);
  });

  it("拒绝不受绑定支持的 reasoning，失败时不更新 bindingVersion", async () => {
    const dataDir = await temporaryDirectory();
    const store = new ThreadModelBindingStore({ dataDir, generateId: () => "binding-1" });
    await store.putBinding("thread-1", bindingInput());

    await expect(store.updateReasoning("thread-1", "ultra")).rejects.toMatchObject({
      code: "THREAD_MODEL_BINDING_VALIDATION_FAILED"
    });
    await expect(store.getBinding("thread-1")).resolves.toMatchObject({ bindingVersion: "binding-1" });
  });

  it("operation 先落盘，重启后仍可读取，并在一次提交中替换绑定和清除 operation", async () => {
    const dataDir = await temporaryDirectory();
    const ids = ["binding-old", "operation-1", "binding-target"];
    const store = new ThreadModelBindingStore({ dataDir, generateId: () => ids.shift() ?? "fallback" });
    const oldBinding = await store.putBinding("thread-1", bindingInput());
    const operation = await store.beginOperation("thread-1", {
      kind: "switch",
      oldState: { ...customSnapshot(), binding: oldBinding },
      targetState: appServerSnapshot()
    });
    const restarted = new ThreadModelBindingStore({ dataDir });

    await expect(restarted.retainOperation("thread-1", operation.operationId)).resolves.toEqual(operation);
    const persistedBeforeCommit = JSON.parse(await readFile(join(dataDir, "thread-model-bindings.json"), "utf8"));
    expect(persistedBeforeCommit.operations["thread-1"].operationId).toBe("operation-1");

    const committed = await store.commitOperation(
      "thread-1",
      operation.operationId,
      bindingInput({ model: "mimo-v2.5-pro-next", label: "MIMO Next" })
    );
    expect(committed?.bindingVersion).toBe("binding-target");
    await expect(store.getThreadState("thread-1")).resolves.toMatchObject({
      binding: { model: "mimo-v2.5-pro-next" },
      operation: null
    });
  });

  it("新 operation 持久化完整权限选择，重启后保持显式 null", async () => {
    const dataDir = await temporaryDirectory();
    const store = new ThreadModelBindingStore({
      dataDir,
      generateId: () => "operation-with-permissions"
    });
    const permissionSelection = {
      permissions: ":danger-full-access",
      approvalPolicy: "never" as const,
      approvalsReviewer: null
    };
    const input = {
      kind: "switch" as const,
      oldState: appServerSnapshot(),
      targetState: customSnapshot(),
      permissionSelection
    };

    const operation = await store.beginOperation("thread-1", input);
    expect(operation).toMatchObject({ permissionSelection });

    const restarted = new ThreadModelBindingStore({ dataDir });
    await expect(restarted.getOperation("thread-1")).resolves.toMatchObject({
      permissionSelection
    });
  });

  it.each([
    { permissions: ":workspace", approvalPolicy: "on-request" },
    {
      permissions: ":workspace",
      approvalPolicy: "sometimes",
      approvalsReviewer: "user"
    },
    {
      permissions: ":workspace",
      approvalPolicy: "on-request",
      approvalsReviewer: "user",
      provider: "secret"
    }
  ])("非法 permissionSelection 失败关闭且不覆盖原内容", async (permissionSelection) => {
    const dataDir = await temporaryDirectory();
    const filePath = join(dataDir, "thread-model-bindings.json");
    const legacyStore = new ThreadModelBindingStore({
      dataDir,
      generateId: () => "operation-invalid-permissions"
    });
    await legacyStore.beginOperation("thread-1", {
      kind: "switch",
      oldState: appServerSnapshot(),
      targetState: customSnapshot()
    });
    const persisted = JSON.parse(await readFile(filePath, "utf8"));
    persisted.operations["thread-1"].permissionSelection = permissionSelection;
    const contents = JSON.stringify(persisted);
    await writeFile(filePath, contents, "utf8");

    const restarted = new ThreadModelBindingStore({ dataDir });
    await expect(restarted.getOperation("thread-1")).rejects.toBeInstanceOf(
      ThreadModelBindingStoreError
    );
    expect(await readFile(filePath, "utf8")).toBe(contents);
  });

  it("切换到 app-server 时原子移除绑定和 operation", async () => {
    const dataDir = await temporaryDirectory();
    const ids = ["binding-1", "operation-1"];
    const store = new ThreadModelBindingStore({ dataDir, generateId: () => ids.shift() ?? "fallback" });
    const binding = await store.putBinding("thread-1", bindingInput());
    const operation = await store.beginOperation("thread-1", {
      kind: "switch",
      oldState: { ...customSnapshot(), binding },
      targetState: appServerSnapshot()
    });

    await expect(store.commitOperation("thread-1", operation.operationId, null)).resolves.toBeNull();
    await expect(store.getThreadState("thread-1")).resolves.toEqual({ binding: null, operation: null });
  });

  it("retain 不修改 operation，clear 只清除匹配的 operation", async () => {
    const dataDir = await temporaryDirectory();
    const store = new ThreadModelBindingStore({ dataDir, generateId: () => "operation-1" });
    const operation = await store.beginOperation("thread-1", {
      kind: "recover",
      oldState: appServerSnapshot(),
      targetState: customSnapshot()
    });

    await expect(store.clearOperation("thread-1", "other-operation")).rejects.toMatchObject({
      code: "THREAD_MODEL_OPERATION_STALE"
    });
    await expect(store.retainOperation("thread-1", operation.operationId)).resolves.toEqual(operation);
    await store.clearOperation("thread-1", operation.operationId);
    await expect(store.getOperation("thread-1")).resolves.toBeNull();
  });

  it("Web delete 同时清理 binding 和 operation，archive 不调用清理时保持状态", async () => {
    const dataDir = await temporaryDirectory();
    const ids = ["binding-1", "operation-1"];
    const store = new ThreadModelBindingStore({ dataDir, generateId: () => ids.shift() ?? "fallback" });
    await store.putBinding("thread-1", bindingInput());
    await store.beginOperation("thread-1", {
      kind: "reapply",
      oldState: appServerSnapshot(),
      targetState: customSnapshot()
    });

    expect((await store.getThreadState("thread-1")).binding).not.toBeNull();
    await expect(store.deleteThreadState("thread-1")).resolves.toBe(true);
    await expect(store.getThreadState("thread-1")).resolves.toEqual({ binding: null, operation: null });
    await expect(store.deleteThreadState("orphan-thread")).resolves.toBe(false);
  });

  it("明确不存在的 thread 可清理孤儿状态并返回可审计身份", async () => {
    const dataDir = await temporaryDirectory();
    const ids = ["binding-orphan", "operation-orphan"];
    const store = new ThreadModelBindingStore({ dataDir, generateId: () => ids.shift() ?? "fallback" });
    await store.putBinding("orphan-thread", bindingInput());
    await store.beginOperation("orphan-thread", {
      kind: "recover",
      oldState: appServerSnapshot(),
      targetState: customSnapshot()
    });

    await expect(store.cleanupOrphanThreadState("orphan-thread")).resolves.toEqual({
      bindingVersion: "binding-orphan",
      operationId: "operation-orphan"
    });
    await expect(store.cleanupOrphanThreadState("orphan-thread")).resolves.toBeNull();
  });

  it("绑定 mutation 不改变自定义目录 revision", async () => {
    const dataDir = await temporaryDirectory();
    const catalog = new CustomModelCatalogStore({ dataDir, generateId: () => "custom-1" });
    await catalog.create(
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
    const store = new ThreadModelBindingStore({ dataDir });
    await store.putBinding("thread-1", bindingInput());
    await store.deleteThreadState("thread-1");

    await expect(catalog.read()).resolves.toMatchObject({ revision: 1 });
  });

  it.each([
    "{broken",
    JSON.stringify({ schemaVersion: 2, revision: 0, bindings: {}, operations: {} }),
    JSON.stringify({ schemaVersion: 1, revision: 0, bindings: { t: { provider: "secret" } }, operations: {} }),
    JSON.stringify({ schemaVersion: 1, revision: 0, bindings: {}, operations: { t: { provider: "secret" } } })
  ])("损坏文件失败关闭且不覆盖原内容", async (contents) => {
    const dataDir = await temporaryDirectory();
    const filePath = join(dataDir, "thread-model-bindings.json");
    await writeFile(filePath, contents, "utf8");
    const store = new ThreadModelBindingStore({ dataDir });

    await expect(store.getThreadState("thread-1")).rejects.toBeInstanceOf(ThreadModelBindingStoreError);
    expect(await readFile(filePath, "utf8")).toBe(contents);
  });

  it("序列化文件排除 provider 和凭据字段", async () => {
    const dataDir = await temporaryDirectory();
    const store = new ThreadModelBindingStore({ dataDir });
    await store.putBinding("thread-1", bindingInput());
    const contents = await readFile(join(dataDir, "thread-model-bindings.json"), "utf8");

    expect(contents).not.toContain("provider");
    expect(contents).not.toContain("baseUrl");
    expect(contents).not.toContain("apiKey");
  });
});
