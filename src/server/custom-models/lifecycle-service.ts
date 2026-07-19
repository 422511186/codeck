import { randomUUID } from "node:crypto";
import type {
  StartThreadInput,
  ThreadRuntimeOverrides,
  UpdateThreadSettingsInput
} from "../app-server/client";
import type { AppServerGateway, ThreadRuntimeReloadInput } from "../app-server/runtime";
import type { MobileModelOption, MobileThreadDetail, MobileThreadSummary } from "../../shared/codex";
import {
  type CustomModelCatalog,
  type ModelInputModality,
  type ModelSelection,
  type RuntimeModelSnapshot,
  type ThreadModelBinding,
  type ThreadModelBindingInput,
  type ThreadModelStateView
} from "../../shared/custom-models";
import { ThreadModelBindingStore } from "./binding-store";
import { CustomModelCatalogStore } from "./catalog-store";
import { assertLargeCustomModelSupported } from "./model-catalog";
import type { ThreadModelSwitchService, ThreadModelSwitchTerminalResult } from "./switch-service";

type LifecycleGateway = Pick<
  AppServerGateway,
  | "listModels"
  | "readCurrentModelProvider"
  | "startThread"
  | "readThreadMetadata"
  | "resumeThread"
  | "reloadThreadRuntime"
  | "forkThread"
  | "unarchiveThread"
  | "deleteThread"
  | "updateThreadSettings"
>;

type SwitchGuard = Pick<ThreadModelSwitchService, "ensurePendingOperationRecovered">;

type LifecycleServiceOptions = {
  catalogStore: CustomModelCatalogStore;
  bindingStore: ThreadModelBindingStore;
  gateway: LifecycleGateway;
  switchService: SwitchGuard;
};

export class ThreadStartSelectionError extends Error {
  readonly httpStatus = 409 as const;

  constructor(
    readonly code: "CATALOG_REVISION_CONFLICT" | "CUSTOM_MODEL_NOT_FOUND" | "MODEL_SELECTION_INVALID",
    readonly latestCatalog: CustomModelCatalog,
    message: string
  ) {
    super(message);
    this.name = "ThreadStartSelectionError";
  }
}

export class ThreadModelRecoveryBlockedError extends Error {
  readonly code = "SWITCH_RECOVERY_FAILED" as const;
  readonly httpStatus = 500 as const;

  constructor(
    readonly result: ThreadModelSwitchTerminalResult,
    readonly thread?: MobileThreadDetail
  ) {
    super("会话模型恢复失败，发送与正常恢复已被阻止");
    this.name = "ThreadModelRecoveryBlockedError";
  }
}

function appModalities(model: MobileModelOption): ModelInputModality[] {
  return model.inputModalities.filter(
    (value): value is ModelInputModality => value === "text" || value === "image"
  );
}

function bindingInputFromCustom(
  model: CustomModelCatalog["models"][number],
  reasoningEffort: string | null
): ThreadModelBindingInput {
  return {
    customModelId: model.customModelId,
    model: model.model,
    label: model.label,
    contextWindow: model.contextWindow,
    inputModalities: [...model.inputModalities],
    supportedReasoningEfforts: [...model.supportedReasoningEfforts],
    defaultReasoningEffort: model.defaultReasoningEffort,
    reasoningEffort,
    sourceUpdatedAt: model.updatedAt
  };
}

function stateFromBinding(binding: ThreadModelBinding): ThreadModelStateView {
  return {
    selection: { source: "custom", customModelId: binding.customModelId },
    model: binding.model,
    label: binding.label,
    contextWindow: binding.contextWindow,
    inputModalities: [...binding.inputModalities],
    supportedReasoningEfforts: [...binding.supportedReasoningEfforts],
    defaultReasoningEffort: binding.defaultReasoningEffort,
    reasoningEffort: binding.reasoningEffort,
    bindingVersion: binding.bindingVersion,
    sourceUpdatedAt: binding.sourceUpdatedAt,
    blocked: false,
    operationId: null
  };
}

function stateFromAppModel(
  model: MobileModelOption | null,
  modelName: string,
  reasoningEffort: string | null
): ThreadModelStateView {
  return {
    selection: { source: "app-server", model: modelName },
    model: modelName,
    label: model?.label ?? modelName,
    contextWindow: null,
    inputModalities: model ? appModalities(model) : ["text"],
    supportedReasoningEfforts: model?.supportedReasoningEfforts ?? (reasoningEffort ? [reasoningEffort] : []),
    defaultReasoningEffort: model?.defaultReasoningEffort ?? reasoningEffort,
    reasoningEffort,
    bindingVersion: null,
    sourceUpdatedAt: null,
    blocked: false,
    operationId: null
  };
}

function bindingSnapshot(binding: ThreadModelBinding): RuntimeModelSnapshot {
  return {
    selection: { source: "custom", customModelId: binding.customModelId },
    model: binding.model,
    label: binding.label,
    contextWindow: binding.contextWindow,
    inputModalities: [...binding.inputModalities],
    supportedReasoningEfforts: [...binding.supportedReasoningEfforts],
    defaultReasoningEffort: binding.defaultReasoningEffort,
    reasoningEffort: binding.reasoningEffort,
    binding: structuredClone(binding)
  };
}

function assertRuntimeIdentity(
  thread: MobileThreadSummary,
  expected: { model: string; modelProvider: string; reasoningEffort: string | null }
): void {
  if (
    thread.model !== expected.model ||
    thread.modelProvider !== expected.modelProvider ||
    (thread.reasoningEffort ?? null) !== expected.reasoningEffort
  ) {
    throw new Error("app-server 返回的新会话运行时身份与模型选择不一致");
  }
}

function assertThreadIdentity(thread: MobileThreadSummary, expectedThreadId: string): void {
  if (thread.id !== expectedThreadId) {
    throw new Error("app-server 返回了其他会话，拒绝采用模型运行时状态");
  }
}

export class ThreadModelLifecycleService {
  constructor(private readonly options: LifecycleServiceOptions) {}

  async startThread(
    input: Omit<StartThreadInput, "model" | "modelProvider" | "modelContextWindow" | "reasoningEffort">,
    selection?: ModelSelection,
    expectedCatalogRevision?: number
  ): Promise<MobileThreadSummary> {
    if (!selection) {
      return this.options.gateway.startThread(input);
    }
    const [catalog, appModels, provider] = await Promise.all([
      this.options.catalogStore.read(),
      this.options.gateway.listModels(),
      this.options.gateway.readCurrentModelProvider()
    ]);
    if (catalog.revision !== expectedCatalogRevision) {
      throw new ThreadStartSelectionError(
        "CATALOG_REVISION_CONFLICT",
        catalog,
        "模型目录修订号已变化"
      );
    }

    if (selection.source === "custom") {
      const model = catalog.models.find((entry) => entry.customModelId === selection.customModelId);
      if (!model) {
        throw new ThreadStartSelectionError(
          "CUSTOM_MODEL_NOT_FOUND",
          catalog,
          "设备默认引用的自定义模型已不存在"
        );
      }
      assertLargeCustomModelSupported(model, appModels);
      const reasoningEffort = model.defaultReasoningEffort;
      const thread = await this.options.gateway.startThread({
        ...input,
        model: model.model,
        modelProvider: provider,
        modelContextWindow: model.contextWindow,
        reasoningEffort
      });
      assertRuntimeIdentity(thread, {
        model: model.model,
        modelProvider: provider,
        reasoningEffort
      });
      const binding = await this.options.bindingStore.putBinding(
        thread.id,
        bindingInputFromCustom(model, reasoningEffort)
      );
      return { ...thread, modelState: stateFromBinding(binding) };
    }

    const model = appModels.find((entry) => entry.model === selection.model);
    if (!model) {
      throw new ThreadStartSelectionError(
        "MODEL_SELECTION_INVALID",
        catalog,
        "设备默认引用的 app-server 模型已不存在"
      );
    }
    const reasoningEffort = model.defaultReasoningEffort;
    const thread = await this.options.gateway.startThread({
      ...input,
      model: model.model,
      modelProvider: provider,
      reasoningEffort
    });
    assertRuntimeIdentity(thread, { model: model.model, modelProvider: provider, reasoningEffort });
    return {
      ...thread,
      modelState: stateFromAppModel(model, model.model, reasoningEffort)
    };
  }

  async ensureThreadReady(threadId: string): Promise<ThreadModelSwitchTerminalResult | null> {
    const recovery = await this.options.switchService.ensurePendingOperationRecovered(threadId);
    if (recovery?.outcome === "recovery_failed" || recovery?.httpStatus === 500) {
      throw new ThreadModelRecoveryBlockedError(recovery);
    }
    return recovery;
  }

  async readThreadMetadata(threadId: string): Promise<MobileThreadDetail> {
    let thread = await this.options.gateway.readThreadMetadata(threadId);
    assertThreadIdentity(thread, threadId);
    let recovery: ThreadModelSwitchTerminalResult | null;
    try {
      recovery = await this.ensureThreadReady(threadId);
    } catch (error) {
      if (error instanceof ThreadModelRecoveryBlockedError) {
        throw new ThreadModelRecoveryBlockedError(error.result, {
          ...thread,
          modelState: error.result.latestState
        });
      }
      throw error;
    }
    if (recovery) {
      thread = await this.options.gateway.readThreadMetadata(threadId);
      assertThreadIdentity(thread, threadId);
    }
    const binding = await this.options.bindingStore.getBinding(threadId);
    if (binding) {
      return { ...thread, modelState: stateFromBinding(binding) };
    }
    if (!thread.model) {
      return thread;
    }
    const appModels = await this.options.gateway.listModels();
    return {
      ...thread,
      modelState: stateFromAppModel(
        appModels.find((model) => model.model === thread.model) ?? null,
        thread.model,
        thread.reasoningEffort ?? null
      )
    };
  }

  async resumeThread(threadId: string): Promise<MobileThreadDetail> {
    await this.ensureThreadReady(threadId);
    const binding = await this.options.bindingStore.getBinding(threadId);
    if (!binding) {
      const thread = await this.options.gateway.resumeThread(threadId);
      assertThreadIdentity(thread, threadId);
      if (!thread.model) {
        return thread;
      }
      const appModels = await this.options.gateway.listModels();
      return {
        ...thread,
        modelState: stateFromAppModel(
          appModels.find((model) => model.model === thread.model) ?? null,
          thread.model,
          thread.reasoningEffort ?? null
        )
      };
    }

    const provider = await this.options.gateway.readCurrentModelProvider();
    const overrides: ThreadRuntimeOverrides = {
      model: binding.model,
      modelProvider: provider,
      modelContextWindow: binding.contextWindow,
      reasoningEffort: binding.reasoningEffort
    };
    let thread = await this.options.gateway.resumeThread(threadId, overrides);
    assertThreadIdentity(thread, threadId);
    if (
      thread.model !== binding.model ||
      thread.modelProvider !== provider ||
      (thread.reasoningEffort ?? null) !== binding.reasoningEffort
    ) {
      const reloadInput: ThreadRuntimeReloadInput = { threadId, ...overrides, model: binding.model, modelProvider: provider };
      thread = await this.options.gateway.reloadThreadRuntime(reloadInput);
      assertThreadIdentity(thread, threadId);
    }
    return { ...thread, modelState: stateFromBinding(binding) };
  }

  async forkThread(threadId: string): Promise<MobileThreadDetail> {
    await this.ensureThreadReady(threadId);
    let thread = await this.options.gateway.forkThread(threadId);
    const forkedThreadId = thread.id;
    const binding = await this.options.bindingStore.forkBinding(threadId, forkedThreadId);
    if (binding) {
      const provider = await this.options.gateway.readCurrentModelProvider();
      if (
        thread.model !== binding.model ||
        thread.modelProvider !== provider ||
        (thread.reasoningEffort ?? null) !== binding.reasoningEffort
      ) {
        thread = await this.options.gateway.reloadThreadRuntime({
          threadId: forkedThreadId,
          model: binding.model,
          modelProvider: provider,
          modelContextWindow: binding.contextWindow,
          reasoningEffort: binding.reasoningEffort
        });
        assertThreadIdentity(thread, forkedThreadId);
      }
      return { ...thread, modelState: stateFromBinding(binding) };
    }
    return thread;
  }

  async unarchiveThread(threadId: string): Promise<MobileThreadDetail> {
    await this.ensureThreadReady(threadId);
    await this.options.gateway.unarchiveThread(threadId);
    return this.resumeThread(threadId);
  }

  async deleteThread(threadId: string): Promise<void> {
    await this.options.gateway.deleteThread(threadId);
    await this.options.bindingStore.deleteThreadState(threadId);
  }

  async updateThreadSettings(
    input: Omit<UpdateThreadSettingsInput, "model">
  ): Promise<{
    operationId: string;
    bindingVersion: string;
    reasoningEffort: string;
  } | null> {
    const binding = await this.options.bindingStore.getBinding(input.threadId);
    if (!binding || input.reasoningEffort === undefined) {
      await this.options.gateway.updateThreadSettings(input);
      return null;
    }
    if (!binding.supportedReasoningEfforts.includes(input.reasoningEffort)) {
      throw new Error("reasoningEffort 不受当前自定义模型支持");
    }
    const oldState = bindingSnapshot(binding);
    const prospectiveBinding: ThreadModelBinding = {
      ...binding,
      reasoningEffort: input.reasoningEffort,
      bindingVersion: randomUUID()
    };
    const targetState = bindingSnapshot(prospectiveBinding);
    const operation = await this.options.bindingStore.beginOperation(input.threadId, {
      kind: "reasoning",
      oldState,
      targetState,
      expectedBindingVersion: binding.bindingVersion
    });
    try {
      await this.options.gateway.updateThreadSettings(input);
    } catch (error) {
      await this.options.bindingStore.clearOperation(input.threadId, operation.operationId);
      throw error;
    }
    const committed = await this.options.bindingStore.commitOperation(
      input.threadId,
      operation.operationId,
      {
        customModelId: binding.customModelId,
        model: binding.model,
        label: binding.label,
        contextWindow: binding.contextWindow,
        inputModalities: [...binding.inputModalities],
        supportedReasoningEfforts: [...binding.supportedReasoningEfforts],
        defaultReasoningEffort: binding.defaultReasoningEffort,
        reasoningEffort: input.reasoningEffort,
        sourceUpdatedAt: binding.sourceUpdatedAt
      }
    );
    if (!committed) {
      throw new Error("reasoning 绑定提交结果为空");
    }
    return {
      operationId: operation.operationId,
      bindingVersion: committed.bindingVersion,
      reasoningEffort: input.reasoningEffort
    };
  }
}
