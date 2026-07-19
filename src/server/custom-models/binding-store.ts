import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  MAX_CUSTOM_MODEL_CONTEXT_WINDOW,
  THREAD_MODEL_BINDING_SCHEMA_VERSION,
  type BindingOperation,
  type BindingOperationKind,
  type ModelInputModality,
  type ModelSelection,
  type RuntimeModelSnapshot,
  type ThreadModelBinding,
  type ThreadModelBindingFile,
  type ThreadModelBindingInput
} from "../../shared/custom-models";
import type { MobilePermissionSelection } from "../../shared/codex";
import { atomicWriteJson } from "../persistence/atomic-json-file";
import {
  FileLockTimeoutError,
  withFileLock,
  type FileLockOptions
} from "../persistence/file-lock";
import { normalizeCustomModelInput } from "./validation";

type BindingStoreErrorCode =
  | "THREAD_MODEL_BINDING_STORAGE_ERROR"
  | "THREAD_MODEL_BINDING_VALIDATION_FAILED"
  | "THREAD_MODEL_BINDING_LOCK_TIMEOUT"
  | "THREAD_MODEL_OPERATION_PENDING"
  | "THREAD_MODEL_OPERATION_NOT_FOUND"
  | "THREAD_MODEL_OPERATION_STALE";

type AtomicWrite = (filePath: string, value: unknown) => Promise<void>;

type ThreadModelBindingStoreOptions = {
  dataDir: string;
  now?: () => Date;
  generateId?: () => string;
  lockOptions?: FileLockOptions;
  atomicWrite?: AtomicWrite;
};

type BeginOperationInput = {
  operationId?: string;
  kind: BindingOperationKind;
  oldState: RuntimeModelSnapshot;
  targetState: RuntimeModelSnapshot;
  permissionSelection?: MobilePermissionSelection;
  expectedBindingVersion?: string | null;
};

type ThreadModelState = {
  binding: ThreadModelBinding | null;
  operation: BindingOperation | null;
};

export class ThreadModelBindingStoreError extends Error {
  constructor(
    readonly code: BindingStoreErrorCode,
    message: string,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = "ThreadModelBindingStoreError";
  }
}

function isNodeError(error: unknown, code: string): boolean {
  return error instanceof Error && "code" in error && error.code === code;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertAllowedKeys(record: Record<string, unknown>, allowed: string[], subject: string): void {
  if (Object.keys(record).some((key) => !allowed.includes(key))) {
    throw new Error(`${subject} 包含未知字段`);
  }
}

function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string") {
    return false;
  }
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value;
}

function normalizeBindingInput(value: unknown): ThreadModelBindingInput {
  if (!isRecord(value)) {
    throw new Error("binding 必须是对象");
  }
  assertAllowedKeys(
    value,
    [
      "customModelId",
      "model",
      "label",
      "contextWindow",
      "inputModalities",
      "supportedReasoningEfforts",
      "defaultReasoningEffort",
      "reasoningEffort",
      "sourceUpdatedAt"
    ],
    "binding"
  );
  if (typeof value.customModelId !== "string" || value.customModelId.trim().length === 0) {
    throw new Error("binding customModelId 无效");
  }
  if (!isIsoDate(value.sourceUpdatedAt)) {
    throw new Error("binding sourceUpdatedAt 无效");
  }
  const model = normalizeCustomModelInput(
    {
      model: value.model,
      label: value.label,
      contextWindow: value.contextWindow,
      inputModalities: value.inputModalities,
      supportedReasoningEfforts: value.supportedReasoningEfforts,
      defaultReasoningEffort: value.defaultReasoningEffort
    },
    { requireComplete: true }
  );
  const reasoningEffort = value.reasoningEffort;
  if (reasoningEffort !== null && typeof reasoningEffort !== "string") {
    throw new Error("binding reasoningEffort 无效");
  }
  if (model.supportedReasoningEfforts.length === 0 && reasoningEffort !== null) {
    throw new Error("无 reasoning 能力的 binding 必须使用 null");
  }
  if (
    reasoningEffort !== null &&
    !model.supportedReasoningEfforts.includes(reasoningEffort)
  ) {
    throw new Error("binding reasoningEffort 不在支持列表中");
  }
  return {
    ...model,
    customModelId: value.customModelId,
    reasoningEffort,
    sourceUpdatedAt: value.sourceUpdatedAt
  };
}

function validateBinding(value: unknown): ThreadModelBinding {
  if (!isRecord(value)) {
    throw new Error("binding 必须是对象");
  }
  assertAllowedKeys(
    value,
    [
      "bindingVersion",
      "customModelId",
      "model",
      "label",
      "contextWindow",
      "inputModalities",
      "supportedReasoningEfforts",
      "defaultReasoningEffort",
      "reasoningEffort",
      "sourceUpdatedAt",
      "boundAt"
    ],
    "binding"
  );
  if (typeof value.bindingVersion !== "string" || value.bindingVersion.length === 0 || !isIsoDate(value.boundAt)) {
    throw new Error("bindingVersion 或 boundAt 无效");
  }
  const input = normalizeBindingInput({
    customModelId: value.customModelId,
    model: value.model,
    label: value.label,
    contextWindow: value.contextWindow,
    inputModalities: value.inputModalities,
    supportedReasoningEfforts: value.supportedReasoningEfforts,
    defaultReasoningEffort: value.defaultReasoningEffort,
    reasoningEffort: value.reasoningEffort,
    sourceUpdatedAt: value.sourceUpdatedAt
  });
  const binding: ThreadModelBinding = {
    ...input,
    bindingVersion: value.bindingVersion,
    boundAt: value.boundAt
  };
  for (const key of Object.keys(binding) as Array<keyof ThreadModelBinding>) {
    if (JSON.stringify(binding[key]) !== JSON.stringify(value[key])) {
      throw new Error(`binding 字段未规范化: ${key}`);
    }
  }
  return binding;
}

function validateSelection(value: unknown): ModelSelection {
  if (!isRecord(value)) {
    throw new Error("selection 必须是对象");
  }
  if (value.source === "custom") {
    assertAllowedKeys(value, ["source", "customModelId"], "custom selection");
    if (typeof value.customModelId !== "string" || value.customModelId.length === 0) {
      throw new Error("custom selection 无效");
    }
    return { source: "custom", customModelId: value.customModelId };
  }
  if (value.source === "app-server") {
    assertAllowedKeys(value, ["source", "model"], "app-server selection");
    if (typeof value.model !== "string" || value.model.length === 0) {
      throw new Error("app-server selection 无效");
    }
    return { source: "app-server", model: value.model };
  }
  throw new Error("selection source 无效");
}

function validateStringArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    throw new Error(`${field} 无效`);
  }
  if (new Set(value).size !== value.length) {
    throw new Error(`${field} 不能重复`);
  }
  return [...value] as string[];
}

function validateModalities(value: unknown): ModelInputModality[] {
  const modalities = validateStringArray(value, "inputModalities");
  if (!modalities.includes("text") || modalities.some((entry) => entry !== "text" && entry !== "image")) {
    throw new Error("inputModalities 无效");
  }
  return modalities as ModelInputModality[];
}

function validateSnapshot(value: unknown): RuntimeModelSnapshot {
  if (!isRecord(value)) {
    throw new Error("runtime snapshot 必须是对象");
  }
  assertAllowedKeys(
    value,
    [
      "selection",
      "model",
      "label",
      "contextWindow",
      "inputModalities",
      "supportedReasoningEfforts",
      "defaultReasoningEffort",
      "reasoningEffort",
      "binding"
    ],
    "runtime snapshot"
  );
  const selection = validateSelection(value.selection);
  if (typeof value.model !== "string" || value.model.length === 0 || typeof value.label !== "string") {
    throw new Error("runtime snapshot 模型身份无效");
  }
  if (selection.source === "app-server" && selection.model !== value.model) {
    throw new Error("app-server snapshot 模型身份不一致");
  }
  if (
    value.contextWindow !== null &&
    (!Number.isSafeInteger(value.contextWindow) ||
      (value.contextWindow as number) < 1 ||
      (value.contextWindow as number) > MAX_CUSTOM_MODEL_CONTEXT_WINDOW)
  ) {
    throw new Error("runtime snapshot contextWindow 无效");
  }
  const supportedReasoningEfforts = validateStringArray(
    value.supportedReasoningEfforts,
    "supportedReasoningEfforts"
  );
  if (
    value.defaultReasoningEffort !== null &&
    typeof value.defaultReasoningEffort !== "string"
  ) {
    throw new Error("runtime snapshot defaultReasoningEffort 无效");
  }
  if (value.reasoningEffort !== null && typeof value.reasoningEffort !== "string") {
    throw new Error("runtime snapshot reasoningEffort 无效");
  }
  return {
    selection,
    model: value.model,
    label: value.label,
    contextWindow: value.contextWindow as number | null,
    inputModalities: validateModalities(value.inputModalities),
    supportedReasoningEfforts,
    defaultReasoningEffort: value.defaultReasoningEffort as string | null,
    reasoningEffort: value.reasoningEffort as string | null,
    binding: value.binding === null ? null : validateBinding(value.binding)
  };
}

function validateOperation(value: unknown): BindingOperation {
  if (!isRecord(value)) {
    throw new Error("operation 必须是对象");
  }
  assertAllowedKeys(
    value,
    ["operationId", "kind", "oldState", "targetState", "permissionSelection", "startedAt"],
    "operation"
  );
  if (typeof value.operationId !== "string" || value.operationId.length === 0) {
    throw new Error("operationId 无效");
  }
  if (!["switch", "reapply", "reasoning", "recover"].includes(String(value.kind))) {
    throw new Error("operation kind 无效");
  }
  if (!isIsoDate(value.startedAt)) {
    throw new Error("operation startedAt 无效");
  }
  const permissionSelection = value.permissionSelection === undefined
    ? undefined
    : validatePermissionSelection(value.permissionSelection);
  return {
    operationId: value.operationId,
    kind: value.kind as BindingOperationKind,
    oldState: validateSnapshot(value.oldState),
    targetState: validateSnapshot(value.targetState),
    ...(permissionSelection ? { permissionSelection } : {}),
    startedAt: value.startedAt
  };
}

function validatePermissionSelection(value: unknown): MobilePermissionSelection {
  if (!isRecord(value)) {
    throw new Error("permissionSelection 必须是对象");
  }
  assertAllowedKeys(
    value,
    ["permissions", "approvalPolicy", "approvalsReviewer"],
    "permissionSelection"
  );
  if (
    value.permissions !== null &&
    (typeof value.permissions !== "string" || value.permissions.length === 0)
  ) {
    throw new Error("permissionSelection permissions 无效");
  }
  if (
    value.approvalPolicy !== null &&
    !["untrusted", "on-request", "never"].includes(String(value.approvalPolicy))
  ) {
    throw new Error("permissionSelection approvalPolicy 无效");
  }
  if (
    value.approvalsReviewer !== null &&
    !["user", "auto_review", "guardian_subagent"].includes(String(value.approvalsReviewer))
  ) {
    throw new Error("permissionSelection approvalsReviewer 无效");
  }
  return {
    permissions: value.permissions as string | null,
    approvalPolicy: value.approvalPolicy as MobilePermissionSelection["approvalPolicy"],
    approvalsReviewer: value.approvalsReviewer as MobilePermissionSelection["approvalsReviewer"]
  };
}

function validateFile(value: unknown): ThreadModelBindingFile {
  if (!isRecord(value)) {
    throw new Error("binding 文件必须是对象");
  }
  assertAllowedKeys(value, ["schemaVersion", "revision", "bindings", "operations"], "binding 文件");
  if (
    value.schemaVersion !== THREAD_MODEL_BINDING_SCHEMA_VERSION ||
    !Number.isSafeInteger(value.revision) ||
    (value.revision as number) < 0 ||
    !isRecord(value.bindings) ||
    !isRecord(value.operations)
  ) {
    throw new Error("binding 文件 schema 无效");
  }
  const bindings = Object.fromEntries(
    Object.entries(value.bindings).map(([threadId, binding]) => {
      if (!threadId) {
        throw new Error("binding threadId 无效");
      }
      return [threadId, validateBinding(binding)];
    })
  );
  const operations = Object.fromEntries(
    Object.entries(value.operations).map(([threadId, operation]) => {
      if (!threadId) {
        throw new Error("operation threadId 无效");
      }
      return [threadId, validateOperation(operation)];
    })
  );
  return {
    schemaVersion: THREAD_MODEL_BINDING_SCHEMA_VERSION,
    revision: value.revision as number,
    bindings,
    operations
  };
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

export class ThreadModelBindingStore {
  readonly filePath: string;
  readonly lockPath: string;
  private readonly now: () => Date;
  private readonly generateId: () => string;
  private readonly lockOptions: FileLockOptions;
  private readonly atomicWrite: AtomicWrite;

  constructor(options: ThreadModelBindingStoreOptions) {
    this.filePath = join(options.dataDir, "thread-model-bindings.json");
    this.lockPath = `${this.filePath}.lock`;
    this.now = options.now ?? (() => new Date());
    this.generateId = options.generateId ?? randomUUID;
    this.lockOptions = options.lockOptions ?? {};
    this.atomicWrite = options.atomicWrite ?? atomicWriteJson;
  }

  async read(): Promise<ThreadModelBindingFile> {
    try {
      return clone(await this.readFile());
    } catch (error) {
      if (!isNodeError(error, "ENOENT")) {
        throw this.asStoreError(error);
      }
    }
    return this.withLock(async () => clone(await this.readOrInitialize()));
  }

  async getThreadState(threadId: string): Promise<ThreadModelState> {
    const state = await this.read();
    return {
      binding: clone(state.bindings[threadId] ?? null),
      operation: clone(state.operations[threadId] ?? null)
    };
  }

  async getBinding(threadId: string): Promise<ThreadModelBinding | null> {
    return (await this.getThreadState(threadId)).binding;
  }

  async getOperation(threadId: string): Promise<BindingOperation | null> {
    return (await this.getThreadState(threadId)).operation;
  }

  async putBinding(threadId: string, input: ThreadModelBindingInput): Promise<ThreadModelBinding> {
    const normalized = this.createBinding(input);
    return this.mutate((state) => {
      state.bindings[threadId] = normalized;
      return { changed: true, result: clone(normalized) };
    });
  }

  async updateReasoning(threadId: string, reasoningEffort: string | null): Promise<ThreadModelBinding | null> {
    return this.mutate((state) => {
      const current = state.bindings[threadId];
      if (!current) {
        return { changed: false, result: null };
      }
      const updated = this.createBinding({
        ...current,
        reasoningEffort
      });
      state.bindings[threadId] = updated;
      return { changed: true, result: clone(updated) };
    });
  }

  async forkBinding(sourceThreadId: string, targetThreadId: string): Promise<ThreadModelBinding | null> {
    return this.mutate((state) => {
      const source = state.bindings[sourceThreadId];
      if (!source) {
        return { changed: false, result: null };
      }
      const forked = this.createBinding(source);
      state.bindings[targetThreadId] = forked;
      return { changed: true, result: clone(forked) };
    });
  }

  async deleteThreadState(threadId: string): Promise<boolean> {
    return this.mutate((state) => {
      const changed = Boolean(state.bindings[threadId] || state.operations[threadId]);
      delete state.bindings[threadId];
      delete state.operations[threadId];
      return { changed, result: changed };
    });
  }

  async cleanupOrphanThreadState(
    threadId: string
  ): Promise<{ bindingVersion: string | null; operationId: string | null } | null> {
    return this.mutate((state) => {
      const binding = state.bindings[threadId];
      const operation = state.operations[threadId];
      if (!binding && !operation) {
        return { changed: false, result: null };
      }
      delete state.bindings[threadId];
      delete state.operations[threadId];
      return {
        changed: true,
        result: {
          bindingVersion: binding?.bindingVersion ?? null,
          operationId: operation?.operationId ?? null
        }
      };
    });
  }

  async beginOperation(threadId: string, input: BeginOperationInput): Promise<BindingOperation> {
    const permissionSelection = input.permissionSelection === undefined
      ? undefined
      : validatePermissionSelection(input.permissionSelection);
    const operation: BindingOperation = {
      operationId: input.operationId ?? this.generateId(),
      kind: input.kind,
      oldState: validateSnapshot(input.oldState),
      targetState: validateSnapshot(input.targetState),
      ...(permissionSelection ? { permissionSelection } : {}),
      startedAt: this.now().toISOString()
    };
    return this.mutate((state) => {
      if (state.operations[threadId]) {
        throw new ThreadModelBindingStoreError(
          "THREAD_MODEL_OPERATION_PENDING",
          "会话存在未完成的模型绑定操作"
        );
      }
      if (input.expectedBindingVersion !== undefined) {
        const currentVersion = state.bindings[threadId]?.bindingVersion ?? null;
        if (currentVersion !== input.expectedBindingVersion) {
          throw new ThreadModelBindingStoreError(
            "THREAD_MODEL_OPERATION_STALE",
            "会话模型绑定版本已变化"
          );
        }
      }
      state.operations[threadId] = operation;
      return { changed: true, result: clone(operation) };
    });
  }

  async retainOperation(threadId: string, operationId: string): Promise<BindingOperation> {
    const operation = await this.getOperation(threadId);
    if (!operation) {
      throw new ThreadModelBindingStoreError("THREAD_MODEL_OPERATION_NOT_FOUND", "模型绑定操作不存在");
    }
    if (operation.operationId !== operationId) {
      throw new ThreadModelBindingStoreError("THREAD_MODEL_OPERATION_STALE", "模型绑定操作版本已变化");
    }
    return operation;
  }

  async commitOperation(
    threadId: string,
    operationId: string,
    targetBinding: ThreadModelBindingInput | null
  ): Promise<ThreadModelBinding | null> {
    return this.mutate((state) => {
      this.assertOperation(state, threadId, operationId);
      const binding = targetBinding === null ? null : this.createBinding(targetBinding);
      if (binding) {
        state.bindings[threadId] = binding;
      } else {
        delete state.bindings[threadId];
      }
      delete state.operations[threadId];
      return { changed: true, result: clone(binding) };
    });
  }

  async clearOperation(threadId: string, operationId: string): Promise<void> {
    await this.mutate((state) => {
      this.assertOperation(state, threadId, operationId);
      delete state.operations[threadId];
      return { changed: true, result: undefined };
    });
  }

  private assertOperation(state: ThreadModelBindingFile, threadId: string, operationId: string): void {
    const operation = state.operations[threadId];
    if (!operation) {
      throw new ThreadModelBindingStoreError("THREAD_MODEL_OPERATION_NOT_FOUND", "模型绑定操作不存在");
    }
    if (operation.operationId !== operationId) {
      throw new ThreadModelBindingStoreError("THREAD_MODEL_OPERATION_STALE", "模型绑定操作版本已变化");
    }
  }

  private createBinding(input: ThreadModelBindingInput | ThreadModelBinding): ThreadModelBinding {
    let normalized: ThreadModelBindingInput;
    try {
      normalized = normalizeBindingInput({
        customModelId: input.customModelId,
        model: input.model,
        label: input.label,
        contextWindow: input.contextWindow,
        inputModalities: input.inputModalities,
        supportedReasoningEfforts: input.supportedReasoningEfforts,
        defaultReasoningEffort: input.defaultReasoningEffort,
        reasoningEffort: input.reasoningEffort,
        sourceUpdatedAt: input.sourceUpdatedAt
      });
    } catch (error) {
      throw new ThreadModelBindingStoreError(
        "THREAD_MODEL_BINDING_VALIDATION_FAILED",
        "会话模型绑定无效",
        { cause: error }
      );
    }
    return {
      ...normalized,
      bindingVersion: this.generateId(),
      boundAt: this.now().toISOString()
    };
  }

  private async mutate<T>(
    update: (state: ThreadModelBindingFile) => { changed: boolean; result: T }
  ): Promise<T> {
    return this.withLock(async () => {
      const state = await this.readOrInitialize();
      const { changed, result } = update(state);
      if (changed) {
        state.revision += 1;
        try {
          await this.atomicWrite(this.filePath, state);
        } catch (error) {
          throw new ThreadModelBindingStoreError(
            "THREAD_MODEL_BINDING_STORAGE_ERROR",
            "写入会话模型绑定失败",
            { cause: error }
          );
        }
      }
      return result;
    });
  }

  private async readOrInitialize(): Promise<ThreadModelBindingFile> {
    try {
      return await this.readFile();
    } catch (error) {
      if (!isNodeError(error, "ENOENT")) {
        throw this.asStoreError(error);
      }
    }
    const empty: ThreadModelBindingFile = {
      schemaVersion: THREAD_MODEL_BINDING_SCHEMA_VERSION,
      revision: 0,
      bindings: {},
      operations: {}
    };
    try {
      await this.atomicWrite(this.filePath, empty);
    } catch (error) {
      throw new ThreadModelBindingStoreError(
        "THREAD_MODEL_BINDING_STORAGE_ERROR",
        "初始化会话模型绑定失败",
        { cause: error }
      );
    }
    return empty;
  }

  private async readFile(): Promise<ThreadModelBindingFile> {
    const contents = await readFile(this.filePath, "utf8");
    return validateFile(JSON.parse(contents) as unknown);
  }

  private async withLock<T>(callback: () => Promise<T>): Promise<T> {
    try {
      return await withFileLock(this.lockPath, callback, this.lockOptions);
    } catch (error) {
      if (error instanceof ThreadModelBindingStoreError) {
        throw error;
      }
      if (error instanceof FileLockTimeoutError) {
        throw new ThreadModelBindingStoreError(
          "THREAD_MODEL_BINDING_LOCK_TIMEOUT",
          error.message,
          { cause: error }
        );
      }
      throw this.asStoreError(error);
    }
  }

  private asStoreError(error: unknown): ThreadModelBindingStoreError {
    if (error instanceof ThreadModelBindingStoreError) {
      return error;
    }
    return new ThreadModelBindingStoreError(
      "THREAD_MODEL_BINDING_STORAGE_ERROR",
      "读取会话模型绑定失败",
      { cause: error }
    );
  }
}
