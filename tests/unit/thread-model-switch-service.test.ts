import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ThreadRuntimeBusyError } from "../../src/server/app-server/runtime";
import { ThreadModelBindingStore } from "../../src/server/custom-models/binding-store";
import { CustomModelCatalogStore } from "../../src/server/custom-models/catalog-store";
import {
  ThreadModelSwitchConflictError,
  ThreadModelSwitchService
} from "../../src/server/custom-models/switch-service";
import type { MobileModelOption, MobileThreadDetail, MobileThreadSummary } from "../../src/shared/codex";
import type {
  ModelSelection,
  RuntimeModelSnapshot,
  ThreadModelBinding,
  ThreadModelBindingInput
} from "../../src/shared/custom-models";

const temporaryDirectories: string[] = [];

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "codex-web-switch-"));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

function appModel(model = "gpt-5.6-sol"): MobileModelOption {
  return {
    id: `${model}-picker`,
    model,
    label: model,
    isDefault: model === "gpt-5.6-sol",
    supportedReasoningEfforts: ["medium", "high"],
    defaultReasoningEffort: "medium",
    inputModalities: ["text", "image"]
  };
}

function threadDetail(
  model: string,
  reasoningEffort: string | null,
  contextUsage: MobileThreadDetail["contextUsage"] = null
): MobileThreadDetail {
  return {
    id: "thread-1",
    title: "测试会话",
    preview: "",
    cwd: "/workspace",
    modelProvider: "provider-current",
    model,
    reasoningEffort,
    status: "idle",
    updatedAt: 1,
    lastTurnId: null,
    nextCursor: null,
    timeline: [],
    contextUsage
  };
}

class FakeSwitchGateway {
  readonly reloadCalls: Array<{
    threadId: string;
    model: string;
    modelProvider: string;
    modelContextWindow?: number;
    reasoningEffort?: string | null;
    permissions?: string | null;
    approvalPolicy?: "untrusted" | "on-request" | "never" | null;
    approvalsReviewer?: "user" | "auto_review" | "guardian_subagent" | null;
  }> = [];
  readonly settingsCalls: Array<{
    threadId: string;
    model?: string;
    reasoningEffort?: string;
  }> = [];
  resumeCalls = 0;
  readonly appModels = [appModel(), appModel("mimo-v2.5-pro"), appModel("mimo-v2.5-pro-next")];
  detail: MobileThreadDetail;
  busy = false;
  private readonly failures = new Map<string, number>();

  constructor(detail: MobileThreadDetail) {
    this.detail = detail;
  }

  fail(model: string, count = 1): void {
    this.failures.set(model, count);
  }

  async listModels(): Promise<MobileModelOption[]> {
    return this.appModels;
  }

  async readCurrentModelProvider(): Promise<string> {
    return "provider-current";
  }

  async resumeThread(): Promise<MobileThreadDetail> {
    this.resumeCalls += 1;
    if (this.detail.turnManifest?.turnIds.length === 0) {
      throw new Error("no rollout found for thread id thread-1");
    }
    return structuredClone(this.detail);
  }

  async readThreadMetadata(): Promise<MobileThreadDetail> {
    return structuredClone(this.detail);
  }

  async readThreadMaterialization(): Promise<"unmaterialized" | "materialized" | "unknown"> {
    if (!this.detail.turnManifest) return "materialized";
    return this.detail.turnManifest.turnIds.length ? "materialized" : "unmaterialized";
  }

  async updateThreadSettings(input: {
    threadId: string;
    model?: string;
    reasoningEffort?: string;
  }): Promise<void> {
    this.settingsCalls.push(structuredClone(input));
    const failures = input.model === undefined ? 0 : this.failures.get(input.model) ?? 0;
    if (input.model !== undefined && failures > 0) {
      this.failures.set(input.model, failures - 1);
      throw new Error(`settings failed: ${input.model}`);
    }
    this.detail = {
      ...this.detail,
      ...(input.model !== undefined ? { model: input.model } : {}),
      ...(input.reasoningEffort !== undefined
        ? { reasoningEffort: input.reasoningEffort }
        : {})
    };
  }

  async assertThreadIdle(): Promise<MobileThreadSummary> {
    if (this.busy) {
      throw new ThreadRuntimeBusyError("thread-1");
    }
    return this.detail;
  }

  async reloadThreadRuntime(input: {
    threadId: string;
    model: string;
    modelProvider: string;
    modelContextWindow?: number;
    reasoningEffort?: string | null;
    permissions?: string | null;
    approvalPolicy?: "untrusted" | "on-request" | "never" | null;
    approvalsReviewer?: "user" | "auto_review" | "guardian_subagent" | null;
  }): Promise<MobileThreadDetail> {
    this.reloadCalls.push(structuredClone(input));
    const failures = this.failures.get(input.model) ?? 0;
    if (failures > 0) {
      this.failures.set(input.model, failures - 1);
      throw new Error(`reload failed: ${input.model}`);
    }
    this.detail = {
      ...this.detail,
      model: input.model,
      modelProvider: input.modelProvider,
      reasoningEffort: input.reasoningEffort ?? null,
      status: "idle"
    };
    return structuredClone(this.detail);
  }
}

type Fixture = Awaited<ReturnType<typeof createFixture>>;

async function createFixture(options: { bound?: boolean; appModelName?: string } = {}) {
  const dataDir = await temporaryDirectory();
  const catalogIds = ["custom-a", "custom-b"];
  const catalogTimes = [
    new Date("2026-07-18T00:00:00.000Z"),
    new Date("2026-07-18T01:00:00.000Z"),
    new Date("2026-07-18T02:00:00.000Z")
  ];
  const catalogStore = new CustomModelCatalogStore({
    dataDir,
    generateId: () => catalogIds.shift() ?? "custom-fallback",
    now: () => catalogTimes.shift() ?? new Date("2026-07-18T03:00:00.000Z")
  });
  await catalogStore.create(
    {
      model: "mimo-v2.5-pro",
      label: "MIMO A",
      contextWindow: 200_000,
      inputModalities: ["text", "image"],
      supportedReasoningEfforts: ["medium", "xhigh"],
      defaultReasoningEffort: "medium"
    },
    0
  );
  await catalogStore.create(
    {
      model: "mimo-v2.5-pro-next",
      label: "MIMO B",
      contextWindow: 300_000,
      inputModalities: ["text"],
      supportedReasoningEfforts: ["vendor-ultra"],
      defaultReasoningEffort: "vendor-ultra"
    },
    1
  );
  const bindingIds = ["binding-current", "binding-next", "binding-recovered", "binding-extra"];
  const bindingStore = new ThreadModelBindingStore({
    dataDir,
    generateId: () => bindingIds.shift() ?? "binding-fallback",
    now: () => new Date("2026-07-18T04:00:00.000Z")
  });
  const bound = options.bound ?? true;
  let binding: ThreadModelBinding | null = null;
  if (bound) {
    binding = await bindingStore.putBinding("thread-1", {
      customModelId: "custom-a",
      model: "mimo-v2.5-pro",
      label: "MIMO A",
      contextWindow: 200_000,
      inputModalities: ["text", "image"],
      supportedReasoningEfforts: ["medium", "xhigh"],
      defaultReasoningEffort: "medium",
      reasoningEffort: "xhigh",
      sourceUpdatedAt: "2026-07-18T00:00:00.000Z"
    });
  }
  const currentModel = bound ? "mimo-v2.5-pro" : options.appModelName ?? "gpt-5.6-sol";
  const currentReasoning = bound ? "xhigh" : "high";
  const gateway = new FakeSwitchGateway(threadDetail(currentModel, currentReasoning));
  const operationIds = ["operation-test", "operation-next", "operation-extra"];
  const service = new ThreadModelSwitchService({
    catalogStore,
    bindingStore,
    gateway,
    generateOperationId: () => operationIds.shift() ?? "operation-fallback",
    now: () => new Date("2026-07-18T05:00:00.000Z")
  });
  return { catalogStore, bindingStore, gateway, service, binding };
}

function expectedCurrent(fixture: Fixture, overrides: {
  selection?: ModelSelection;
  reasoningEffort?: string | null;
  bindingVersion?: string | null;
} = {}) {
  return {
    selection: overrides.selection ?? (fixture.binding
      ? { source: "custom" as const, customModelId: fixture.binding.customModelId }
      : { source: "app-server" as const, model: fixture.gateway.detail.model as string }),
    reasoningEffort: overrides.reasoningEffort === undefined
      ? fixture.gateway.detail.reasoningEffort ?? null
      : overrides.reasoningEffort,
    bindingVersion: overrides.bindingVersion === undefined
      ? fixture.binding?.bindingVersion ?? null
      : overrides.bindingVersion
  };
}

async function switchRequest(
  fixture: Fixture,
  target: ModelSelection,
  overrides: Record<string, unknown> = {}
) {
  return fixture.service.switchModel("thread-1", {
    target,
    expectedCatalogRevision: 2,
    expectedCurrent: expectedCurrent(fixture),
    ...overrides
  });
}

describe("ThreadModelSwitchService 前置条件", () => {
  it.each([
    ["catalog", { expectedCatalogRevision: 1 }, "CATALOG_REVISION_CONFLICT"],
    ["selection", { expectedCurrent: { selection: { source: "app-server", model: "mimo-v2.5-pro" }, reasoningEffort: "xhigh", bindingVersion: "binding-current" } }, "CURRENT_MODEL_STALE"],
    ["reasoning", { expectedCurrent: { selection: { source: "custom", customModelId: "custom-a" }, reasoningEffort: "medium", bindingVersion: "binding-current" } }, "CURRENT_MODEL_STALE"],
    ["bindingVersion", { expectedCurrent: { selection: { source: "custom", customModelId: "custom-a" }, reasoningEffort: "xhigh", bindingVersion: "stale" } }, "CURRENT_MODEL_STALE"]
  ])("%s 过期在 operation 和 runtime 变更前返回 409", async (_label, overrides, code) => {
    const fixture = await createFixture();

    await expect(
      switchRequest(fixture, { source: "custom", customModelId: "custom-b" }, overrides)
    ).rejects.toMatchObject({
      name: ThreadModelSwitchConflictError.name,
      httpStatus: 409,
      code,
      operationId: "operation-test"
    });
    expect(fixture.gateway.reloadCalls).toEqual([]);
    await expect(fixture.bindingStore.getOperation("thread-1")).resolves.toBeNull();
  });

  it("running turn 在 operation 前拒绝", async () => {
    const fixture = await createFixture();
    fixture.gateway.busy = true;

    await expect(
      switchRequest(fixture, { source: "custom", customModelId: "custom-b" })
    ).rejects.toMatchObject({ code: "THREAD_BUSY", httpStatus: 409 });
    expect(fixture.gateway.reloadCalls).toEqual([]);
    await expect(fixture.bindingStore.getOperation("thread-1")).resolves.toBeNull();
  });

  it("已知用量达到目标 90% 时要求手动 compact，未知用量则放行", async () => {
    const blocked = await createFixture();
    blocked.gateway.detail.contextUsage = {
      totalTokens: 270_000,
      inputTokens: 270_000,
      outputTokens: 0,
      reasoningOutputTokens: 0,
      modelContextWindow: 200_000,
      updatedAt: 1
    };
    await expect(
      switchRequest(blocked, { source: "custom", customModelId: "custom-b" })
    ).rejects.toMatchObject({ code: "CONTEXT_COMPACTION_REQUIRED", httpStatus: 409 });
    expect(blocked.gateway.reloadCalls).toEqual([]);

    const allowed = await createFixture();
    allowed.gateway.detail.contextUsage = null;
    await expect(
      switchRequest(allowed, { source: "custom", customModelId: "custom-b" })
    ).resolves.toMatchObject({ httpStatus: 200, outcome: "switched" });
  });
});

describe("ThreadModelSwitchService 成功路径", () => {
  it("未物化空会话原地更新并核验，不执行冷 reload", async () => {
    const fixture = await createFixture({ bound: false });
    fixture.gateway.detail.turnManifest = { turnIds: [] };

    await expect(
      switchRequest(fixture, { source: "custom", customModelId: "custom-a" })
    ).resolves.toMatchObject({
      httpStatus: 200,
      outcome: "switched",
      thread: { model: "mimo-v2.5-pro", reasoningEffort: "medium" }
    });

    expect(fixture.gateway.settingsCalls).toEqual([
      {
        threadId: "thread-1",
        model: "mimo-v2.5-pro",
        reasoningEffort: "medium"
      }
    ]);
    expect(fixture.gateway.reloadCalls).toEqual([]);
    expect(fixture.gateway.resumeCalls).toBe(0);
    await expect(fixture.bindingStore.getThreadState("thread-1")).resolves.toMatchObject({
      binding: { customModelId: "custom-a" },
      operation: null
    });
  });

  it("custom→custom 使用目标默认 reasoning 和自定义窗口", async () => {
    const fixture = await createFixture();

    await expect(
      switchRequest(fixture, { source: "custom", customModelId: "custom-b" })
    ).resolves.toMatchObject({ httpStatus: 200, outcome: "switched", operationId: "operation-test" });
    expect(fixture.gateway.reloadCalls[0]).toMatchObject({
      model: "mimo-v2.5-pro-next",
      modelContextWindow: 300_000,
      reasoningEffort: "vendor-ultra"
    });
    await expect(fixture.bindingStore.getThreadState("thread-1")).resolves.toMatchObject({
      binding: { customModelId: "custom-b", reasoningEffort: "vendor-ultra" },
      operation: null
    });
  });

  it("已有历史会话冷 reload 保持完整权限选择", async () => {
    const fixture = await createFixture();
    fixture.gateway.detail.lastTurnId = "turn-1";
    fixture.gateway.detail.turnManifest = { turnIds: ["turn-1"] };
    fixture.gateway.detail.activePermissionProfile = {
      id: ":danger-full-access",
      extends: null
    };
    fixture.gateway.detail.approvalPolicy = "never";
    fixture.gateway.detail.approvalsReviewer = null;

    await expect(
      switchRequest(fixture, { source: "app-server", model: "gpt-5.6-sol" })
    ).resolves.toMatchObject({ httpStatus: 200, outcome: "switched" });

    expect(fixture.gateway.settingsCalls).toEqual([]);
    expect(fixture.gateway.reloadCalls[0]).toMatchObject({
      model: "gpt-5.6-sol",
      permissions: ":danger-full-access",
      approvalPolicy: "never",
      approvalsReviewer: null
    });
  });

  it("custom→app-server 使用目标默认 reasoning、遗漏窗口并移除绑定", async () => {
    const fixture = await createFixture();

    await expect(
      switchRequest(fixture, { source: "app-server", model: "gpt-5.6-sol" })
    ).resolves.toMatchObject({ httpStatus: 200, outcome: "switched" });
    expect(fixture.gateway.reloadCalls[0]).toEqual({
      threadId: "thread-1",
      model: "gpt-5.6-sol",
      modelProvider: "provider-current",
      reasoningEffort: "medium"
    });
    await expect(fixture.bindingStore.getBinding("thread-1")).resolves.toBeNull();
  });

  it("同名 app-server→custom 仍按来源身份显式切换并建立绑定", async () => {
    const fixture = await createFixture({ bound: false, appModelName: "mimo-v2.5-pro" });

    await expect(
      switchRequest(fixture, { source: "custom", customModelId: "custom-a" })
    ).resolves.toMatchObject({ httpStatus: 200, outcome: "switched" });
    expect(fixture.gateway.reloadCalls[0]).toMatchObject({
      model: "mimo-v2.5-pro",
      modelContextWindow: 200_000,
      reasoningEffort: "medium"
    });
    await expect(fixture.bindingStore.getBinding("thread-1")).resolves.toMatchObject({
      customModelId: "custom-a"
    });
  });

  it("目录编辑后显式 reapply 使用新快照，不会因 customModelId 相同跳过", async () => {
    const fixture = await createFixture();
    await fixture.catalogStore.replace(
      "custom-a",
      {
        model: "mimo-v2.5-pro-reconfigured",
        label: "MIMO Reconfigured",
        contextWindow: 250_000,
        inputModalities: ["text"],
        supportedReasoningEfforts: ["medium"],
        defaultReasoningEffort: "medium"
      },
      2
    );

    await expect(
      fixture.service.switchModel("thread-1", {
        target: { source: "custom", customModelId: "custom-a" },
        expectedCatalogRevision: 3,
        expectedCurrent: expectedCurrent(fixture),
        kind: "reapply"
      })
    ).resolves.toMatchObject({ httpStatus: 200, outcome: "switched" });
    expect(fixture.gateway.reloadCalls[0]).toMatchObject({
      model: "mimo-v2.5-pro-reconfigured",
      modelContextWindow: 250_000,
      reasoningEffort: "medium"
    });
  });
});

describe("ThreadModelSwitchService 失败和恢复", () => {
  it("空会话目标 settings 失败时原地恢复旧状态并返回 recovered", async () => {
    const fixture = await createFixture({ bound: false });
    fixture.gateway.detail.turnManifest = { turnIds: [] };
    fixture.gateway.fail("mimo-v2.5-pro", 1);

    await expect(
      switchRequest(fixture, { source: "custom", customModelId: "custom-a" })
    ).resolves.toMatchObject({
      httpStatus: 502,
      outcome: "recovered",
      code: "SWITCH_TARGET_FAILED",
      thread: { model: "gpt-5.6-sol", reasoningEffort: "high" }
    });
    expect(fixture.gateway.settingsCalls.map((call) => call.model)).toEqual([
      "mimo-v2.5-pro",
      "gpt-5.6-sol"
    ]);
    expect(fixture.gateway.reloadCalls).toEqual([]);
    expect(fixture.gateway.resumeCalls).toBe(0);
    await expect(fixture.bindingStore.getOperation("thread-1")).resolves.toBeNull();
  });

  it("空会话目标和旧状态 settings 都失败时保留 operation", async () => {
    const fixture = await createFixture({ bound: false });
    fixture.gateway.detail.turnManifest = { turnIds: [] };
    fixture.gateway.fail("mimo-v2.5-pro", 1);
    fixture.gateway.fail("gpt-5.6-sol", 1);

    await expect(
      switchRequest(fixture, { source: "custom", customModelId: "custom-a" })
    ).resolves.toMatchObject({
      httpStatus: 500,
      outcome: "recovery_failed",
      code: "SWITCH_RECOVERY_FAILED"
    });
    expect(fixture.gateway.reloadCalls).toEqual([]);
    expect(fixture.gateway.resumeCalls).toBe(0);
    await expect(fixture.bindingStore.getOperation("thread-1")).resolves.toMatchObject({
      operationId: "operation-test"
    });

    await expect(
      fixture.service.ensurePendingOperationRecovered("thread-1")
    ).resolves.toMatchObject({
      httpStatus: 200,
      outcome: "recovered"
    });
    expect(fixture.gateway.settingsCalls.at(-1)).toMatchObject({ model: "gpt-5.6-sol" });
    expect(fixture.gateway.reloadCalls).toEqual([]);
    await expect(fixture.bindingStore.getOperation("thread-1")).resolves.toBeNull();
  });

  it("目标失败且旧状态恢复时返回 502 recovered 并清除 operation", async () => {
    const fixture = await createFixture({ bound: false });
    fixture.gateway.fail("mimo-v2.5-pro", 1);

    await expect(
      switchRequest(fixture, { source: "custom", customModelId: "custom-a" })
    ).resolves.toMatchObject({
      httpStatus: 502,
      outcome: "recovered",
      code: "SWITCH_TARGET_FAILED",
      operationId: "operation-test"
    });
    expect(fixture.gateway.reloadCalls.map((call) => call.model)).toEqual([
      "mimo-v2.5-pro",
      "gpt-5.6-sol"
    ]);
    await expect(fixture.bindingStore.getThreadState("thread-1")).resolves.toEqual({
      binding: null,
      operation: null
    });
  });

  it("目标和旧状态都失败时返回 500 recovery_failed 并保留 operation", async () => {
    const fixture = await createFixture({ bound: false });
    fixture.gateway.fail("mimo-v2.5-pro", 1);
    fixture.gateway.fail("gpt-5.6-sol", 1);

    await expect(
      switchRequest(fixture, { source: "custom", customModelId: "custom-a" })
    ).resolves.toMatchObject({
      httpStatus: 500,
      outcome: "recovery_failed",
      code: "SWITCH_RECOVERY_FAILED",
      operationId: "operation-test"
    });
    await expect(fixture.bindingStore.getOperation("thread-1")).resolves.toMatchObject({
      operationId: "operation-test"
    });

    await expect(
      fixture.service.ensurePendingOperationRecovered("thread-1")
    ).resolves.toMatchObject({
      httpStatus: 200,
      outcome: "recovered",
      operationId: "operation-test"
    });
    expect(fixture.gateway.reloadCalls.at(-1)).toMatchObject({ model: "gpt-5.6-sol" });
    await expect(fixture.bindingStore.getOperation("thread-1")).resolves.toBeNull();
  });

  it("无残留 operation 的访问守卫不重载运行时", async () => {
    const fixture = await createFixture();

    await expect(fixture.service.ensurePendingOperationRecovered("thread-1")).resolves.toBeNull();
    expect(fixture.gateway.reloadCalls).toEqual([]);
  });

  it("重启恢复重试使用 operation 原目标快照，不重新解析已变化目录", async () => {
    const fixture = await createFixture({ bound: false });
    const targetBinding: ThreadModelBinding = {
      customModelId: "custom-a",
      model: "snapshot-model",
      label: "Snapshot",
      contextWindow: 222_000,
      inputModalities: ["text"],
      supportedReasoningEfforts: ["snapshot-effort"],
      defaultReasoningEffort: "snapshot-effort",
      reasoningEffort: "snapshot-effort",
      sourceUpdatedAt: "2026-07-18T00:00:00.000Z",
      bindingVersion: "snapshot-binding",
      boundAt: "2026-07-18T05:00:00.000Z"
    };
    const oldState: RuntimeModelSnapshot = {
      selection: { source: "app-server", model: "gpt-5.6-sol" },
      model: "gpt-5.6-sol",
      label: "gpt-5.6-sol",
      contextWindow: null,
      inputModalities: ["text", "image"],
      supportedReasoningEfforts: ["medium", "high"],
      defaultReasoningEffort: "medium",
      reasoningEffort: "high",
      binding: null
    };
    const targetState: RuntimeModelSnapshot = {
      selection: { source: "custom", customModelId: "custom-a" },
      model: "snapshot-model",
      label: "Snapshot",
      contextWindow: 222_000,
      inputModalities: ["text"],
      supportedReasoningEfforts: ["snapshot-effort"],
      defaultReasoningEffort: "snapshot-effort",
      reasoningEffort: "snapshot-effort",
      binding: targetBinding
    };
    await fixture.bindingStore.beginOperation("thread-1", {
      operationId: "operation-residual",
      kind: "switch",
      oldState,
      targetState,
      permissionSelection: {
        permissions: ":workspace",
        approvalPolicy: "on-request",
        approvalsReviewer: "auto_review"
      }
    });
    await fixture.catalogStore.replace(
      "custom-a",
      {
        model: "catalog-model-after-crash",
        label: "Changed",
        contextWindow: 200_000,
        inputModalities: ["text"],
        supportedReasoningEfforts: [],
        defaultReasoningEffort: null
      },
      2
    );

    await expect(
      fixture.service.recoverPendingOperation("thread-1", "retry-target")
    ).resolves.toMatchObject({ httpStatus: 200, outcome: "switched", operationId: "operation-residual" });
    expect(fixture.gateway.reloadCalls[0]).toMatchObject({
      model: "snapshot-model",
      modelContextWindow: 222_000,
      reasoningEffort: "snapshot-effort",
      permissions: ":workspace",
      approvalPolicy: "on-request",
      approvalsReviewer: "auto_review"
    });
    await expect(fixture.bindingStore.getBinding("thread-1")).resolves.toMatchObject({
      model: "snapshot-model"
    });
  });
});
