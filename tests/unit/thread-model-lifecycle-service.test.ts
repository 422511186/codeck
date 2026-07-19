import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ThreadModelBindingStore } from "../../src/server/custom-models/binding-store";
import { CustomModelCatalogStore } from "../../src/server/custom-models/catalog-store";
import {
  ThreadModelLifecycleService,
  ThreadModelRecoveryBlockedError,
  ThreadStartSelectionError
} from "../../src/server/custom-models/lifecycle-service";
import type { MobileModelOption, MobileThreadDetail, MobileThreadSummary } from "../../src/shared/codex";
import type { ThreadModelBindingInput } from "../../src/shared/custom-models";

const temporaryDirectories: string[] = [];

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "codex-web-lifecycle-"));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

function appModel(): MobileModelOption {
  return {
    id: "gpt-picker",
    model: "gpt-5.6-sol",
    label: "GPT-5.6",
    isDefault: true,
    supportedReasoningEfforts: ["medium", "high"],
    defaultReasoningEffort: "medium",
    inputModalities: ["text", "image"]
  };
}

function summary(id: string, input: { model?: string; modelProvider?: string; reasoningEffort?: string | null }): MobileThreadSummary {
  return {
    id,
    title: "会话",
    preview: "",
    cwd: "/workspace",
    model: input.model ?? "gpt-5.6-sol",
    modelProvider: input.modelProvider ?? "provider-current",
    reasoningEffort: input.reasoningEffort ?? null,
    status: "idle",
    updatedAt: 1
  };
}

function detail(id: string, input: { model?: string; modelProvider?: string; reasoningEffort?: string | null }): MobileThreadDetail {
  return {
    ...summary(id, input),
    lastTurnId: null,
    nextCursor: null,
    timeline: []
  };
}

class FakeLifecycleGateway {
  readonly startCalls: unknown[] = [];
  readonly resumeCalls: unknown[][] = [];
  readonly reloadCalls: unknown[] = [];
  readonly updateCalls: unknown[] = [];
  readonly deleteCalls: string[] = [];
  failSettings = false;
  nextThreadId = "thread-new";
  resumeIdOverride: string | null = null;

  async listModels(): Promise<MobileModelOption[]> {
    return [appModel()];
  }

  async readCurrentModelProvider(): Promise<string> {
    return "provider-current";
  }

  async startThread(input: {
    model?: string;
    modelProvider?: string;
    reasoningEffort?: string | null;
  }): Promise<MobileThreadSummary> {
    this.startCalls.push(structuredClone(input));
    return summary(this.nextThreadId, input);
  }

  async resumeThread(
    threadId: string,
    overrides: { model?: string; modelProvider?: string; reasoningEffort?: string | null } = {}
  ): Promise<MobileThreadDetail> {
    this.resumeCalls.push([threadId, structuredClone(overrides)]);
    return detail(this.resumeIdOverride ?? threadId, overrides);
  }

  async readThreadMetadata(threadId: string): Promise<MobileThreadDetail> {
    return detail(threadId, {
      model: threadId === "thread-custom" ? "mimo-v2.5-pro" : "gpt-5.6-sol",
      reasoningEffort: threadId === "thread-custom" ? "xhigh" : "medium"
    });
  }

  async reloadThreadRuntime(input: {
    threadId: string;
    model: string;
    modelProvider: string;
    reasoningEffort?: string | null;
  }): Promise<MobileThreadDetail> {
    this.reloadCalls.push(structuredClone(input));
    return detail(input.threadId, input);
  }

  async forkThread(threadId: string): Promise<MobileThreadDetail> {
    return detail(`${threadId}-fork`, { model: "gpt-5.6-sol", reasoningEffort: "medium" });
  }

  async unarchiveThread(threadId: string): Promise<MobileThreadDetail> {
    return detail(threadId, { model: "mimo-v2.5-pro", reasoningEffort: "xhigh" });
  }

  async deleteThread(threadId: string): Promise<void> {
    this.deleteCalls.push(threadId);
  }

  async updateThreadSettings(input: unknown): Promise<void> {
    this.updateCalls.push(structuredClone(input));
    if (this.failSettings) {
      throw new Error("settings failed");
    }
  }
}

async function createFixture() {
  const dataDir = await temporaryDirectory();
  const catalogStore = new CustomModelCatalogStore({
    dataDir,
    generateId: () => "custom-1",
    now: () => new Date("2026-07-18T00:00:00.000Z")
  });
  await catalogStore.create(
    {
      model: "mimo-v2.5-pro",
      label: "MIMO",
      contextWindow: 200_000,
      inputModalities: ["text", "image"],
      supportedReasoningEfforts: ["medium", "xhigh"],
      defaultReasoningEffort: "medium"
    },
    0
  );
  let id = 0;
  const bindingStore = new ThreadModelBindingStore({
    dataDir,
    generateId: () => `binding-${++id}`,
    now: () => new Date("2026-07-18T01:00:00.000Z")
  });
  const gateway = new FakeLifecycleGateway();
  const switchService = {
    ensurePendingOperationRecovered: vi.fn().mockResolvedValue(null)
  };
  const service = new ThreadModelLifecycleService({
    catalogStore,
    bindingStore,
    gateway,
    switchService
  });
  return { catalogStore, bindingStore, gateway, switchService, service };
}

function bindingInput(): ThreadModelBindingInput {
  return {
    customModelId: "custom-1",
    model: "mimo-v2.5-pro",
    label: "MIMO",
    contextWindow: 200_000,
    inputModalities: ["text", "image"],
    supportedReasoningEfforts: ["medium", "xhigh"],
    defaultReasoningEffort: "medium",
    reasoningEffort: "xhigh",
    sourceUpdatedAt: "2026-07-18T00:00:00.000Z"
  };
}

function stateForTest() {
  return {
    selection: { source: "app-server" as const, model: "gpt-5.6-sol" },
    model: "gpt-5.6-sol",
    label: "GPT-5.6",
    contextWindow: null,
    inputModalities: ["text", "image"] as Array<"text" | "image">,
    supportedReasoningEfforts: ["medium"],
    defaultReasoningEffort: "medium",
    reasoningEffort: "medium",
    bindingVersion: null,
    sourceUpdatedAt: null,
    blocked: false,
    operationId: null
  };
}

describe("ThreadModelLifecycleService start/resume", () => {
  it("自定义 start 一次传入目标配置，并在返回前提交 binding", async () => {
    const fixture = await createFixture();

    const thread = await fixture.service.startThread(
      { cwd: "/workspace" },
      { source: "custom", customModelId: "custom-1" },
      1
    );

    expect(fixture.gateway.startCalls).toEqual([
      {
        cwd: "/workspace",
        model: "mimo-v2.5-pro",
        modelProvider: "provider-current",
        modelContextWindow: 200_000,
        reasoningEffort: "medium"
      }
    ]);
    await expect(fixture.bindingStore.getBinding(thread.id)).resolves.toMatchObject({
      customModelId: "custom-1",
      model: "mimo-v2.5-pro",
      reasoningEffort: "medium"
    });
    expect(thread.modelState).toMatchObject({
      selection: { source: "custom", customModelId: "custom-1" }
    });
  });

  it("失效或 stale 自定义默认在调用 app-server 前返回稳定错误", async () => {
    const fixture = await createFixture();

    await expect(
      fixture.service.startThread(
        { cwd: "/workspace" },
        { source: "custom", customModelId: "missing" },
        1
      )
    ).rejects.toMatchObject({ code: "CUSTOM_MODEL_NOT_FOUND" });
    await expect(
      fixture.service.startThread(
        { cwd: "/workspace" },
        { source: "custom", customModelId: "custom-1" },
        0
      )
    ).rejects.toBeInstanceOf(ThreadStartSelectionError);
    expect(fixture.gateway.startCalls).toEqual([]);
  });

  it("app-server start 使用结构化身份但不创建 binding", async () => {
    const fixture = await createFixture();

    const thread = await fixture.service.startThread(
      { cwd: "/workspace" },
      { source: "app-server", model: "gpt-5.6-sol" },
      1
    );

    expect(fixture.gateway.startCalls[0]).toMatchObject({
      model: "gpt-5.6-sol",
      modelProvider: "provider-current",
      reasoningEffort: "medium"
    });
    await expect(fixture.bindingStore.getBinding(thread.id)).resolves.toBeNull();
  });

  it("自定义绑定 resume 使用当前 provider 与快照；无绑定同名旧会话保持 app-server", async () => {
    const fixture = await createFixture();
    await fixture.bindingStore.putBinding("thread-custom", bindingInput());

    const custom = await fixture.service.resumeThread("thread-custom");
    expect(fixture.gateway.resumeCalls[0]).toEqual([
      "thread-custom",
      {
        model: "mimo-v2.5-pro",
        modelProvider: "provider-current",
        modelContextWindow: 200_000,
        reasoningEffort: "xhigh"
      }
    ]);
    expect(custom.modelState?.selection).toEqual({ source: "custom", customModelId: "custom-1" });

    await fixture.service.resumeThread("thread-old");
    expect(fixture.gateway.resumeCalls[1]).toEqual(["thread-old", {}]);
    await expect(fixture.bindingStore.getBinding("thread-old")).resolves.toBeNull();
  });

  it("pending operation 自动恢复失败时阻止正常 resume", async () => {
    const fixture = await createFixture();
    fixture.switchService.ensurePendingOperationRecovered.mockResolvedValue({
      httpStatus: 500,
      outcome: "recovery_failed",
      operationId: "operation-1",
      latestState: { blocked: true }
    });

    await expect(fixture.service.resumeThread("thread-1")).rejects.toBeInstanceOf(
      ThreadModelRecoveryBlockedError
    );
    expect(fixture.gateway.resumeCalls).toEqual([]);
  });

  it("resume 返回其他 thread ID 时拒绝采用运行时状态", async () => {
    const fixture = await createFixture();
    fixture.gateway.resumeIdOverride = "thread-other";

    await expect(fixture.service.resumeThread("thread-1")).rejects.toThrow(
      "app-server 返回了其他会话"
    );
  });

  it("元数据读取附加来源敏感状态且不触发冷 resume", async () => {
    const fixture = await createFixture();
    await fixture.bindingStore.putBinding("thread-custom", bindingInput());

    const custom = await fixture.service.readThreadMetadata("thread-custom");
    const official = await fixture.service.readThreadMetadata("thread-old");

    expect(custom.modelState).toMatchObject({
      selection: { source: "custom", customModelId: "custom-1" },
      contextWindow: 200_000,
      bindingVersion: expect.any(String)
    });
    expect(official.modelState).toMatchObject({
      selection: { source: "app-server", model: "gpt-5.6-sol" },
      bindingVersion: null
    });
    expect(fixture.gateway.resumeCalls).toEqual([]);
  });

  it("元数据读取恢复失败时仍携带可渲染 thread 与阻塞状态", async () => {
    const fixture = await createFixture();
    fixture.switchService.ensurePendingOperationRecovered.mockResolvedValue({
      httpStatus: 500,
      outcome: "recovery_failed",
      operationId: "operation-1",
      latestState: { ...stateForTest(), blocked: true, operationId: "operation-1" }
    });

    await expect(fixture.service.readThreadMetadata("thread-1")).rejects.toMatchObject({
      code: "SWITCH_RECOVERY_FAILED",
      thread: {
        id: "thread-1",
        modelState: { blocked: true, operationId: "operation-1" }
      }
    });
  });
});

describe("ThreadModelLifecycleService fork/delete/settings", () => {
  it("fork 继承快照并生成独立 bindingVersion，delete 清理 binding/operation", async () => {
    const fixture = await createFixture();
    const source = await fixture.bindingStore.putBinding("thread-1", bindingInput());

    const forked = await fixture.service.forkThread("thread-1");
    const forkBinding = await fixture.bindingStore.getBinding(forked.id);
    expect(forkBinding).toMatchObject({ customModelId: source.customModelId, model: source.model });
    expect(forkBinding?.bindingVersion).not.toBe(source.bindingVersion);
    expect(fixture.gateway.reloadCalls).toEqual([
      {
        threadId: forked.id,
        model: "mimo-v2.5-pro",
        modelProvider: "provider-current",
        modelContextWindow: 200_000,
        reasoningEffort: "xhigh"
      }
    ]);
    expect(forked).toMatchObject({
      model: "mimo-v2.5-pro",
      reasoningEffort: "xhigh",
      modelState: { bindingVersion: forkBinding?.bindingVersion }
    });

    await fixture.service.deleteThread(forked.id);
    expect(fixture.gateway.deleteCalls).toEqual([forked.id]);
    await expect(fixture.bindingStore.getThreadState(forked.id)).resolves.toEqual({
      binding: null,
      operation: null
    });
    await expect(fixture.bindingStore.getBinding("thread-1")).resolves.toEqual(source);
  });

  it("custom reasoning 只在 app-server ack 后提交新 bindingVersion", async () => {
    const fixture = await createFixture();
    const before = await fixture.bindingStore.putBinding("thread-1", bindingInput());

    const auditDetail = await fixture.service.updateThreadSettings({
      threadId: "thread-1",
      reasoningEffort: "medium"
    });
    const after = await fixture.bindingStore.getBinding("thread-1");
    expect(fixture.gateway.updateCalls).toEqual([
      { threadId: "thread-1", reasoningEffort: "medium" }
    ]);
    expect(after).toMatchObject({ reasoningEffort: "medium" });
    expect(after?.bindingVersion).not.toBe(before.bindingVersion);
    expect(auditDetail).toEqual({
      operationId: expect.any(String),
      bindingVersion: after?.bindingVersion,
      reasoningEffort: "medium"
    });
    await expect(fixture.bindingStore.getOperation("thread-1")).resolves.toBeNull();
  });

  it("settings ack 失败时不更新 binding 并清除 reasoning operation", async () => {
    const fixture = await createFixture();
    const before = await fixture.bindingStore.putBinding("thread-1", bindingInput());
    fixture.gateway.failSettings = true;

    await expect(
      fixture.service.updateThreadSettings({ threadId: "thread-1", reasoningEffort: "medium" })
    ).rejects.toThrow("settings failed");
    await expect(fixture.bindingStore.getBinding("thread-1")).resolves.toEqual(before);
    await expect(fixture.bindingStore.getOperation("thread-1")).resolves.toBeNull();
  });

  it("访问守卫在 recovery_failed 时禁止 turn start", async () => {
    const fixture = await createFixture();
    fixture.switchService.ensurePendingOperationRecovered.mockResolvedValue({
      httpStatus: 500,
      outcome: "recovery_failed",
      operationId: "operation-1",
      latestState: { blocked: true }
    });

    await expect(fixture.service.ensureThreadReady("thread-1")).rejects.toMatchObject({
      code: "SWITCH_RECOVERY_FAILED"
    });
  });
});
