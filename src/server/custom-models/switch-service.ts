import { randomUUID } from "node:crypto";
import type { AppServerGateway, ThreadRuntimeReloadInput } from "../app-server/runtime";
import { ThreadRuntimeBusyError, verifyThreadRuntime } from "../app-server/runtime";
import type {
  MobileModelOption,
  MobilePermissionSelection,
  MobileThreadDetail
} from "../../shared/codex";
import {
  modelSelectionsEqual,
  type BindingOperation,
  type CustomModelCatalog,
  type CustomModelConfig,
  type ModelInputModality,
  type ModelSelection,
  type ModelSwitchErrorCode,
  type ModelSwitchRequest,
  type RuntimeModelSnapshot,
  type ThreadModelBinding,
  type ThreadModelBindingInput,
  type ThreadModelStateView
} from "../../shared/custom-models";
import { ThreadModelBindingStore, ThreadModelBindingStoreError } from "./binding-store";
import { CustomModelCatalogStore } from "./catalog-store";
import { ModelCatalogPrerequisiteError, assertLargeCustomModelSupported } from "./model-catalog";

type SwitchGateway = Pick<
  AppServerGateway,
  | "listModels"
  | "readCurrentModelProvider"
  | "readThreadMetadata"
  | "readThreadMaterialization"
  | "resumeThread"
  | "assertThreadIdle"
  | "reloadThreadRuntime"
  | "updateThreadSettings"
>;

type SwitchServiceOptions = {
  catalogStore: CustomModelCatalogStore;
  bindingStore: ThreadModelBindingStore;
  gateway: SwitchGateway;
  generateOperationId?: () => string;
  now?: () => Date;
};

export type ThreadModelSwitchTerminalResult = {
  httpStatus: 200 | 502 | 500;
  outcome: "switched" | "recovered" | "recovery_failed";
  code?: "SWITCH_TARGET_FAILED" | "SWITCH_RECOVERY_FAILED";
  operationId: string;
  modelProvider: string;
  thread: MobileThreadDetail | null;
  latestState: ThreadModelStateView;
  error?: string;
};

export class ThreadModelSwitchConflictError extends Error {
  readonly httpStatus = 409 as const;

  constructor(
    readonly code: ModelSwitchErrorCode,
    readonly operationId: string,
    readonly latestState: ThreadModelStateView | null,
    readonly latestCatalog: CustomModelCatalog | null,
    message: string
  ) {
    super(message);
    this.name = "ThreadModelSwitchConflictError";
  }
}

class KeyedSerialExecutor {
  private readonly tails = new Map<string, Promise<void>>();

  async run<T>(key: string, task: () => Promise<T>): Promise<T> {
    const previous = this.tails.get(key) ?? Promise.resolve();
    let release: () => void = () => undefined;
    const turn = new Promise<void>((resolve) => {
      release = resolve;
    });
    const tail = previous.catch(() => undefined).then(() => turn);
    this.tails.set(key, tail);
    await previous.catch(() => undefined);
    try {
      return await task();
    } finally {
      release();
      if (this.tails.get(key) === tail) {
        this.tails.delete(key);
      }
    }
  }
}

function safeErrorSummary(error: unknown): string {
  const message = error instanceof Error ? error.message : "模型运行时操作失败";
  return message.replace(/[\r\n\t]+/gu, " ").slice(0, 300);
}

function permissionSelectionFromDetail(
  detail: MobileThreadDetail
): MobilePermissionSelection | undefined {
  if (
    detail.activePermissionProfile === undefined ||
    detail.approvalPolicy === undefined ||
    detail.approvalsReviewer === undefined
  ) {
    return undefined;
  }
  return {
    permissions: detail.activePermissionProfile?.id ?? null,
    approvalPolicy: detail.approvalPolicy,
    approvalsReviewer: detail.approvalsReviewer
  };
}

function appModalities(model: MobileModelOption): ModelInputModality[] {
  return model.inputModalities.filter(
    (entry): entry is ModelInputModality => entry === "text" || entry === "image"
  );
}

export function selectTargetReasoning(
  current: string | null,
  supported: string[],
  defaultReasoningEffort: string | null
): string | null {
  return current !== null && supported.includes(current) ? current : defaultReasoningEffort;
}

function bindingInputFromSnapshot(snapshot: RuntimeModelSnapshot): ThreadModelBindingInput | null {
  if (snapshot.selection.source !== "custom") {
    return null;
  }
  const binding = snapshot.binding;
  if (!binding) {
    throw new Error("自定义模型 operation 快照缺少 binding");
  }
  return {
    customModelId: binding.customModelId,
    model: binding.model,
    label: binding.label,
    contextWindow: binding.contextWindow,
    inputModalities: [...binding.inputModalities],
    supportedReasoningEfforts: [...binding.supportedReasoningEfforts],
    defaultReasoningEffort: binding.defaultReasoningEffort,
    reasoningEffort: snapshot.reasoningEffort,
    sourceUpdatedAt: binding.sourceUpdatedAt
  };
}

function stateView(
  snapshot: RuntimeModelSnapshot,
  options: { binding?: ThreadModelBinding | null; blocked?: boolean; operationId?: string | null } = {}
): ThreadModelStateView {
  const binding = options.binding === undefined ? snapshot.binding : options.binding;
  return {
    selection: structuredClone(snapshot.selection),
    model: snapshot.model,
    label: snapshot.label,
    contextWindow: snapshot.contextWindow,
    inputModalities: [...snapshot.inputModalities],
    supportedReasoningEfforts: [...snapshot.supportedReasoningEfforts],
    defaultReasoningEffort: snapshot.defaultReasoningEffort,
    reasoningEffort: snapshot.reasoningEffort,
    bindingVersion: binding?.bindingVersion ?? null,
    sourceUpdatedAt: binding?.sourceUpdatedAt ?? null,
    blocked: options.blocked ?? false,
    operationId: options.operationId ?? null
  };
}

function snapshotFromCurrent(
  detail: MobileThreadDetail,
  binding: ThreadModelBinding | null,
  appModels: MobileModelOption[]
): RuntimeModelSnapshot {
  if (!detail.model) {
    throw new Error("app-server 未返回当前会话模型");
  }
  if (binding) {
    return {
      selection: { source: "custom", customModelId: binding.customModelId },
      model: binding.model,
      label: binding.label,
      contextWindow: binding.contextWindow,
      inputModalities: [...binding.inputModalities],
      supportedReasoningEfforts: [...binding.supportedReasoningEfforts],
      defaultReasoningEffort: binding.defaultReasoningEffort,
      reasoningEffort: detail.reasoningEffort ?? binding.reasoningEffort,
      binding: structuredClone(binding)
    };
  }
  const appModel = appModels.find((model) => model.model === detail.model);
  const currentReasoning = detail.reasoningEffort ?? null;
  return {
    selection: { source: "app-server", model: detail.model },
    model: detail.model,
    label: appModel?.label ?? detail.model,
    contextWindow: null,
    inputModalities: appModel ? appModalities(appModel) : ["text"],
    supportedReasoningEfforts: appModel?.supportedReasoningEfforts ?? (currentReasoning ? [currentReasoning] : []),
    defaultReasoningEffort: appModel?.defaultReasoningEffort ?? currentReasoning,
    reasoningEffort: currentReasoning,
    binding: null
  };
}

function targetFromCustom(
  model: CustomModelConfig,
  currentReasoning: string | null,
  operationId: string,
  now: Date
): RuntimeModelSnapshot {
  const reasoningEffort = selectTargetReasoning(
    currentReasoning,
    model.supportedReasoningEfforts,
    model.defaultReasoningEffort
  );
  const binding: ThreadModelBinding = {
    customModelId: model.customModelId,
    model: model.model,
    label: model.label,
    contextWindow: model.contextWindow,
    inputModalities: [...model.inputModalities],
    supportedReasoningEfforts: [...model.supportedReasoningEfforts],
    defaultReasoningEffort: model.defaultReasoningEffort,
    reasoningEffort,
    sourceUpdatedAt: model.updatedAt,
    bindingVersion: operationId,
    boundAt: now.toISOString()
  };
  return {
    selection: { source: "custom", customModelId: model.customModelId },
    model: model.model,
    label: model.label,
    contextWindow: model.contextWindow,
    inputModalities: [...model.inputModalities],
    supportedReasoningEfforts: [...model.supportedReasoningEfforts],
    defaultReasoningEffort: model.defaultReasoningEffort,
    reasoningEffort,
    binding
  };
}

function targetFromAppModel(
  model: MobileModelOption,
  currentReasoning: string | null
): RuntimeModelSnapshot {
  return {
    selection: { source: "app-server", model: model.model },
    model: model.model,
    label: model.label,
    contextWindow: null,
    inputModalities: appModalities(model),
    supportedReasoningEfforts: [...model.supportedReasoningEfforts],
    defaultReasoningEffort: model.defaultReasoningEffort,
    reasoningEffort: selectTargetReasoning(
      currentReasoning,
      model.supportedReasoningEfforts,
      model.defaultReasoningEffort
    ),
    binding: null
  };
}

export class ThreadModelSwitchService {
  private readonly serial = new KeyedSerialExecutor();
  private readonly generateOperationId: () => string;
  private readonly now: () => Date;

  constructor(private readonly options: SwitchServiceOptions) {
    this.generateOperationId = options.generateOperationId ?? randomUUID;
    this.now = options.now ?? (() => new Date());
  }

  async switchModel(
    threadId: string,
    request: ModelSwitchRequest,
    requestedOperationId?: string
  ): Promise<ThreadModelSwitchTerminalResult> {
    return this.serial.run(threadId, async () => {
      const operationId = requestedOperationId ?? this.generateOperationId();
      const [catalog, threadState] = await Promise.all([
        this.options.catalogStore.read(),
        this.options.bindingStore.getThreadState(threadId)
      ]);
      if (threadState.operation) {
        throw new ThreadModelSwitchConflictError(
          "BINDING_OPERATION_PENDING",
          threadState.operation.operationId,
          stateView(threadState.operation.oldState, {
            blocked: true,
            operationId: threadState.operation.operationId
          }),
          catalog,
          "会话存在未完成的模型切换操作"
        );
      }

      const [metadata, materialization, appModels, provider] = await Promise.all([
        this.options.gateway.readThreadMetadata(threadId),
        this.options.gateway.readThreadMaterialization(threadId),
        this.options.gateway.listModels(),
        this.options.gateway.readCurrentModelProvider()
      ]);
      const inPlace = materialization === "unmaterialized";
      const detail = inPlace ? metadata : await this.options.gateway.resumeThread(threadId);
      const current = snapshotFromCurrent(detail, threadState.binding, appModels);
      const permissionSelection = permissionSelectionFromDetail(detail);
      const latestState = stateView(current);
      if (catalog.revision !== request.expectedCatalogRevision) {
        throw new ThreadModelSwitchConflictError(
          "CATALOG_REVISION_CONFLICT",
          operationId,
          latestState,
          catalog,
          "自定义模型目录修订号已变化"
        );
      }
      if (
        (threadState.binding !== null && detail.model !== threadState.binding.model) ||
        !modelSelectionsEqual(current.selection, request.expectedCurrent.selection) ||
        current.reasoningEffort !== request.expectedCurrent.reasoningEffort ||
        (threadState.binding?.bindingVersion ?? null) !== request.expectedCurrent.bindingVersion
      ) {
        throw new ThreadModelSwitchConflictError(
          "CURRENT_MODEL_STALE",
          operationId,
          latestState,
          catalog,
          "会话当前模型状态已变化"
        );
      }
      try {
        await this.options.gateway.assertThreadIdle(threadId);
      } catch (error) {
        if (error instanceof ThreadRuntimeBusyError ||
          (typeof error === "object" && error !== null && "code" in error && error.code === "THREAD_BUSY")) {
          throw new ThreadModelSwitchConflictError(
            "THREAD_BUSY",
            operationId,
            latestState,
            catalog,
            "会话存在运行中的 turn"
          );
        }
        throw error;
      }

      let target: RuntimeModelSnapshot;
      try {
        target = this.resolveTarget(request.target, current.reasoningEffort, catalog, appModels, operationId);
      } catch (error) {
        if (error instanceof ModelCatalogPrerequisiteError) {
          throw new ThreadModelSwitchConflictError(
            "MODEL_CATALOG_ENTRY_REQUIRED",
            operationId,
            latestState,
            catalog,
            error.message
          );
        }
        throw error;
      }
      const knownUsage = detail.contextUsage?.totalTokens;
      if (
        target.contextWindow !== null &&
        typeof knownUsage === "number" &&
        knownUsage >= target.contextWindow * 0.9
      ) {
        throw new ThreadModelSwitchConflictError(
          "CONTEXT_COMPACTION_REQUIRED",
          operationId,
          latestState,
          catalog,
          "当前上下文用量已达到目标窗口的 90%，请先手动 compact"
        );
      }

      const latestCatalog = await this.options.catalogStore.read();
      if (latestCatalog.revision !== request.expectedCatalogRevision) {
        throw new ThreadModelSwitchConflictError(
          "CATALOG_REVISION_CONFLICT",
          operationId,
          latestState,
          latestCatalog,
          "自定义模型目录修订号已变化"
        );
      }

      try {
        await this.options.bindingStore.beginOperation(threadId, {
          operationId,
          kind: request.kind ?? "switch",
          oldState: current,
          targetState: target,
          permissionSelection,
          expectedBindingVersion: request.expectedCurrent.bindingVersion
        });
      } catch (error) {
        if (error instanceof ThreadModelBindingStoreError && error.code === "THREAD_MODEL_OPERATION_STALE") {
          const latestBinding = await this.options.bindingStore.getBinding(threadId);
          throw new ThreadModelSwitchConflictError(
            "CURRENT_MODEL_STALE",
            operationId,
            stateView(current, { binding: latestBinding }),
            latestCatalog,
            "会话模型绑定版本已变化"
          );
        }
        throw error;
      }
      return this.executeSwitch(
        threadId,
        operationId,
        current,
        target,
        provider,
        inPlace,
        permissionSelection
      );
    });
  }

  async recoverPendingOperation(
    threadId: string,
    action: "restore-old" | "retry-target"
  ): Promise<ThreadModelSwitchTerminalResult> {
    return this.serial.run(threadId, () => this.recoverPendingOperationLocked(threadId, action));
  }

  async ensurePendingOperationRecovered(
    threadId: string
  ): Promise<ThreadModelSwitchTerminalResult | null> {
    return this.serial.run(threadId, async () => {
      if (!await this.options.bindingStore.getOperation(threadId)) {
        return null;
      }
      return this.recoverPendingOperationLocked(threadId, "restore-old");
    });
  }

  private resolveTarget(
    selection: ModelSelection,
    currentReasoning: string | null,
    catalog: CustomModelCatalog,
    appModels: MobileModelOption[],
    operationId: string
  ): RuntimeModelSnapshot {
    if (selection.source === "custom") {
      const model = catalog.models.find((entry) => entry.customModelId === selection.customModelId);
      if (!model) {
        throw new ThreadModelSwitchConflictError(
          "CUSTOM_MODEL_NOT_FOUND",
          operationId,
          null,
          catalog,
          "目标自定义模型不存在"
        );
      }
      assertLargeCustomModelSupported(model, appModels);
      return targetFromCustom(model, currentReasoning, operationId, this.now());
    }
    const model = appModels.find((entry) => entry.model === selection.model);
    if (!model) {
      throw new ThreadModelSwitchConflictError(
        "MODEL_SELECTION_INVALID",
        operationId,
        null,
        catalog,
        "目标 app-server 模型不存在"
      );
    }
    return targetFromAppModel(model, currentReasoning);
  }

  private async recoverPendingOperationLocked(
    threadId: string,
    action: "restore-old" | "retry-target"
  ): Promise<ThreadModelSwitchTerminalResult> {
    const operation = await this.options.bindingStore.getOperation(threadId);
    if (!operation) {
      throw new ThreadModelSwitchConflictError(
        "BINDING_OPERATION_NOT_FOUND",
        this.generateOperationId(),
        null,
        null,
        "会话没有待恢复的模型操作"
      );
    }
    const snapshot = action === "retry-target" ? operation.targetState : operation.oldState;
    const provider = await this.options.gateway.readCurrentModelProvider();
    try {
      const materialization = await this.options.gateway.readThreadMaterialization(threadId);
      const inPlace = materialization === "unmaterialized";
      const thread = await this.applySnapshot(
        threadId,
        snapshot,
        provider,
        inPlace,
        operation.permissionSelection
      );
      const binding = await this.options.bindingStore.commitOperation(
        threadId,
        operation.operationId,
        bindingInputFromSnapshot(snapshot)
      );
      return {
        httpStatus: 200,
        outcome: action === "retry-target" ? "switched" : "recovered",
        operationId: operation.operationId,
        modelProvider: provider,
        thread,
        latestState: stateView(snapshot, { binding })
      };
    } catch (error) {
      return {
        httpStatus: 500,
        outcome: "recovery_failed",
        code: "SWITCH_RECOVERY_FAILED",
        operationId: operation.operationId,
        modelProvider: provider,
        thread: null,
        latestState: stateView(snapshot, {
          blocked: true,
          operationId: operation.operationId
        }),
        error: safeErrorSummary(error)
      };
    }
  }

  private async executeSwitch(
    threadId: string,
    operationId: string,
    oldState: RuntimeModelSnapshot,
    targetState: RuntimeModelSnapshot,
    provider: string,
    inPlace: boolean,
    permissionSelection?: MobilePermissionSelection
  ): Promise<ThreadModelSwitchTerminalResult> {
    try {
      const thread = await this.applySnapshot(
        threadId,
        targetState,
        provider,
        inPlace,
        permissionSelection
      );
      const binding = await this.options.bindingStore.commitOperation(
        threadId,
        operationId,
        bindingInputFromSnapshot(targetState)
      );
      return {
        httpStatus: 200,
        outcome: "switched",
        operationId,
        modelProvider: provider,
        thread,
        latestState: stateView(targetState, { binding })
      };
    } catch (targetError) {
      try {
        const thread = await this.applySnapshot(
          threadId,
          oldState,
          provider,
          inPlace,
          permissionSelection
        );
        const binding = await this.options.bindingStore.commitOperation(
          threadId,
          operationId,
          bindingInputFromSnapshot(oldState)
        );
        return {
          httpStatus: 502,
          outcome: "recovered",
          code: "SWITCH_TARGET_FAILED",
          operationId,
          modelProvider: provider,
          thread,
          latestState: stateView(oldState, { binding }),
          error: safeErrorSummary(targetError)
        };
      } catch (recoveryError) {
        return {
          httpStatus: 500,
          outcome: "recovery_failed",
          code: "SWITCH_RECOVERY_FAILED",
          operationId,
          modelProvider: provider,
          thread: null,
          latestState: stateView(oldState, { blocked: true, operationId }),
          error: safeErrorSummary(recoveryError)
        };
      }
    }
  }

  private async applySnapshot(
    threadId: string,
    snapshot: RuntimeModelSnapshot,
    provider: string,
    inPlace: boolean,
    permissionSelection?: MobilePermissionSelection
  ): Promise<MobileThreadDetail> {
    if (!inPlace) {
      return this.reloadSnapshot(threadId, snapshot, provider, permissionSelection);
    }
    await this.options.gateway.updateThreadSettings({
      threadId,
      model: snapshot.model,
      ...(snapshot.reasoningEffort !== null
        ? { reasoningEffort: snapshot.reasoningEffort }
        : {})
    });
    const detail = await this.options.gateway.readThreadMetadata(threadId);
    verifyThreadRuntime(detail, {
      model: snapshot.model,
      modelProvider: provider,
      reasoningEffort: snapshot.reasoningEffort
    });
    return detail;
  }

  private reloadSnapshot(
    threadId: string,
    snapshot: RuntimeModelSnapshot,
    provider: string,
    permissionSelection?: MobilePermissionSelection
  ): Promise<MobileThreadDetail> {
    const input: ThreadRuntimeReloadInput = {
      threadId,
      model: snapshot.model,
      modelProvider: provider,
      reasoningEffort: snapshot.reasoningEffort,
      ...(permissionSelection ?? {}),
      ...(snapshot.selection.source === "custom" && snapshot.contextWindow !== null
        ? { modelContextWindow: snapshot.contextWindow }
        : {})
    };
    return this.options.gateway.reloadThreadRuntime(input);
  }
}
