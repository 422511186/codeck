import type { MobilePermissionSelection } from "./codex";

export const CUSTOM_MODEL_CATALOG_SCHEMA_VERSION = 1 as const;
export const THREAD_MODEL_BINDING_SCHEMA_VERSION = 1 as const;
export const DEFAULT_CUSTOM_MODEL_CONTEXT_WINDOW = 200_000;
export const MAX_CUSTOM_MODEL_CONTEXT_WINDOW = 1_000_000;
export const CODEX_UNKNOWN_MODEL_MAX_CONTEXT_WINDOW = 272_000;
export const MAX_CUSTOM_MODELS = 200;

export type ModelInputModality = "text" | "image";

export type CustomModelInput = {
  model: string;
  label: string;
  contextWindow: number;
  inputModalities: ModelInputModality[];
  supportedReasoningEfforts: string[];
  defaultReasoningEffort: string | null;
};

export type CustomModelConfig = CustomModelInput & {
  customModelId: string;
  createdAt: string;
  updatedAt: string;
};

export type ModelSelection =
  | { source: "custom"; customModelId: string }
  | { source: "app-server"; model: string };

type SelectableModelBase = {
  model: string;
  label: string;
  contextWindow: number | null;
  inputModalities: ModelInputModality[];
  supportedReasoningEfforts: string[];
  defaultReasoningEffort: string | null;
  isDefault: boolean;
};

export type SelectableModel =
  | (SelectableModelBase & {
      source: "custom";
      customModelId: string;
      contextWindow: number;
      updatedAt: string;
    })
  | (SelectableModelBase & {
      source: "app-server";
    });

export type CustomModelCatalogFile = {
  schemaVersion: typeof CUSTOM_MODEL_CATALOG_SCHEMA_VERSION;
  revision: number;
  models: CustomModelConfig[];
};

export type CustomModelCatalog = Pick<CustomModelCatalogFile, "revision" | "models">;

export type UnifiedModelCatalog = {
  catalogRevision: number;
  appServerModelNames: string[];
  models: SelectableModel[];
};

export type ThreadModelBinding = CustomModelInput & {
  bindingVersion: string;
  customModelId: string;
  reasoningEffort: string | null;
  sourceUpdatedAt: string;
  boundAt: string;
};

export type ThreadModelBindingInput = Omit<ThreadModelBinding, "bindingVersion" | "boundAt">;

export type RuntimeModelSnapshot = {
  selection: ModelSelection;
  model: string;
  label: string;
  contextWindow: number | null;
  inputModalities: ModelInputModality[];
  supportedReasoningEfforts: string[];
  defaultReasoningEffort: string | null;
  reasoningEffort: string | null;
  binding: ThreadModelBinding | null;
};

export type BindingOperationKind = "switch" | "reapply" | "reasoning" | "recover";

export type BindingOperation = {
  operationId: string;
  kind: BindingOperationKind;
  oldState: RuntimeModelSnapshot;
  targetState: RuntimeModelSnapshot;
  permissionSelection?: MobilePermissionSelection;
  startedAt: string;
};

export type ThreadModelBindingFile = {
  schemaVersion: typeof THREAD_MODEL_BINDING_SCHEMA_VERSION;
  revision: number;
  bindings: Record<string, ThreadModelBinding>;
  operations: Record<string, BindingOperation>;
};

export const MODEL_SWITCH_OUTCOMES = ["switched", "recovered", "recovery_failed"] as const;
export type ModelSwitchOutcome = (typeof MODEL_SWITCH_OUTCOMES)[number];

export const MODEL_SWITCH_ERROR_CODES = [
  "CATALOG_REVISION_CONFLICT",
  "CURRENT_MODEL_STALE",
  "THREAD_BUSY",
  "CONTEXT_COMPACTION_REQUIRED",
  "MODEL_CATALOG_ENTRY_REQUIRED",
  "CUSTOM_MODEL_NOT_FOUND",
  "BINDING_OPERATION_PENDING",
  "BINDING_OPERATION_NOT_FOUND",
  "MODEL_SELECTION_INVALID",
  "RUNTIME_VERIFICATION_FAILED",
  "SWITCH_TARGET_FAILED",
  "SWITCH_RECOVERY_FAILED"
] as const;
export type ModelSwitchErrorCode = (typeof MODEL_SWITCH_ERROR_CODES)[number];

export type ModelSwitchExpectedCurrent = {
  selection: ModelSelection;
  reasoningEffort: string | null;
  bindingVersion: string | null;
};

export type ModelSwitchRequest = {
  target: ModelSelection;
  expectedCatalogRevision: number;
  expectedCurrent: ModelSwitchExpectedCurrent;
  kind?: "switch" | "reapply";
};

export type ThreadModelStateView = {
  selection: ModelSelection;
  model: string;
  label: string;
  contextWindow: number | null;
  inputModalities: ModelInputModality[];
  supportedReasoningEfforts: string[];
  defaultReasoningEffort: string | null;
  reasoningEffort: string | null;
  bindingVersion: string | null;
  sourceUpdatedAt: string | null;
  blocked: boolean;
  operationId: string | null;
};

export const CUSTOM_MODEL_ERROR_CODES = [
  "CUSTOM_MODEL_VALIDATION_FAILED",
  "CUSTOM_MODEL_NOT_FOUND",
  "CUSTOM_MODEL_DUPLICATE",
  "CUSTOM_MODEL_LIMIT_REACHED",
  "CATALOG_REVISION_CONFLICT",
  "CUSTOM_MODEL_STORAGE_ERROR",
  "CUSTOM_MODEL_LOCK_TIMEOUT"
] as const;
export type CustomModelErrorCode = (typeof CUSTOM_MODEL_ERROR_CODES)[number];

export function modelSelectionKey(selection: ModelSelection): string {
  return selection.source === "custom"
    ? `custom:${selection.customModelId}`
    : `app-server:${selection.model}`;
}

export function modelSelectionsEqual(left: ModelSelection, right: ModelSelection): boolean {
  return modelSelectionKey(left) === modelSelectionKey(right);
}
