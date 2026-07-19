import type { MobileModelOption } from "../../shared/codex";
import {
  CODEX_UNKNOWN_MODEL_MAX_CONTEXT_WINDOW,
  type CustomModelConfig,
  type ModelInputModality,
  type SelectableModel
} from "../../shared/custom-models";

export class ModelCatalogPrerequisiteError extends Error {
  readonly code = "MODEL_CATALOG_ENTRY_REQUIRED" as const;

  constructor(readonly model: string) {
    super(`模型 ${model} 的上下文窗口超过 Codex 未知模型上限，需要先加入 app-server 权威模型目录`);
    this.name = "ModelCatalogPrerequisiteError";
  }
}

function appModelModalities(model: MobileModelOption): ModelInputModality[] {
  return model.inputModalities.filter(
    (modality): modality is ModelInputModality => modality === "text" || modality === "image"
  );
}

export function mergeSelectableModels(
  appServerModels: MobileModelOption[],
  customModels: CustomModelConfig[]
): SelectableModel[] {
  const customModelNames = new Set(customModels.map((model) => model.model));
  const customEntries: SelectableModel[] = customModels.map((model) => ({
    source: "custom",
    customModelId: model.customModelId,
    model: model.model,
    label: model.label,
    contextWindow: model.contextWindow,
    inputModalities: [...model.inputModalities],
    supportedReasoningEfforts: [...model.supportedReasoningEfforts],
    defaultReasoningEffort: model.defaultReasoningEffort,
    isDefault: false,
    updatedAt: model.updatedAt
  }));
  const appServerEntries: SelectableModel[] = appServerModels
    .filter((model) => !customModelNames.has(model.model))
    .map((model) => ({
      source: "app-server",
      model: model.model,
      label: model.label,
      contextWindow: null,
      inputModalities: appModelModalities(model),
      supportedReasoningEfforts: [...model.supportedReasoningEfforts],
      defaultReasoningEffort: model.defaultReasoningEffort,
      isDefault: model.isDefault
    }));
  return [...customEntries, ...appServerEntries];
}

export function assertLargeCustomModelSupported(
  customModel: CustomModelConfig,
  appServerModels: MobileModelOption[]
): void {
  if (customModel.contextWindow <= CODEX_UNKNOWN_MODEL_MAX_CONTEXT_WINDOW) {
    return;
  }
  if (!appServerModels.some((model) => model.model === customModel.model)) {
    throw new ModelCatalogPrerequisiteError(customModel.model);
  }
}
