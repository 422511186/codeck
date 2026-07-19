import { describe, expect, it } from "vitest";
import {
  CUSTOM_MODEL_CATALOG_SCHEMA_VERSION,
  MODEL_SWITCH_ERROR_CODES,
  THREAD_MODEL_BINDING_SCHEMA_VERSION,
  modelSelectionKey,
  type BindingOperation,
  type CustomModelConfig,
  type ModelSelection,
  type RuntimeModelSnapshot,
  type SelectableModel,
  type ThreadModelBinding
} from "../../src/shared/custom-models";

const customModel: CustomModelConfig = {
  customModelId: "custom-1",
  model: "mimo-v2.5-pro",
  label: "MIMO 2.5 Pro",
  contextWindow: 200_000,
  inputModalities: ["text", "image"],
  supportedReasoningEfforts: ["medium", "xhigh"],
  defaultReasoningEffort: "medium",
  createdAt: "2026-07-18T00:00:00.000Z",
  updatedAt: "2026-07-18T00:00:00.000Z"
};

const customSelection: ModelSelection = {
  source: "custom",
  customModelId: customModel.customModelId
};

const appServerSelection: ModelSelection = {
  source: "app-server",
  model: customModel.model
};

const binding: ThreadModelBinding = {
  bindingVersion: "binding-1",
  customModelId: customModel.customModelId,
  model: customModel.model,
  label: customModel.label,
  contextWindow: customModel.contextWindow,
  inputModalities: customModel.inputModalities,
  supportedReasoningEfforts: customModel.supportedReasoningEfforts,
  defaultReasoningEffort: customModel.defaultReasoningEffort,
  reasoningEffort: "xhigh",
  sourceUpdatedAt: customModel.updatedAt,
  boundAt: "2026-07-18T01:00:00.000Z"
};

const oldState: RuntimeModelSnapshot = {
  selection: appServerSelection,
  model: customModel.model,
  label: customModel.label,
  contextWindow: null,
  inputModalities: ["text"],
  supportedReasoningEfforts: ["medium"],
  defaultReasoningEffort: "medium",
  reasoningEffort: "medium",
  binding: null
};

const targetState: RuntimeModelSnapshot = {
  selection: customSelection,
  model: customModel.model,
  label: customModel.label,
  contextWindow: customModel.contextWindow,
  inputModalities: customModel.inputModalities,
  supportedReasoningEfforts: customModel.supportedReasoningEfforts,
  defaultReasoningEffort: customModel.defaultReasoningEffort,
  reasoningEffort: binding.reasoningEffort,
  binding
};

const operation: BindingOperation = {
  operationId: "operation-1",
  kind: "switch",
  oldState,
  targetState,
  startedAt: "2026-07-18T01:00:00.000Z"
};

const selectableModels: SelectableModel[] = [
  {
    source: "custom",
    customModelId: customModel.customModelId,
    model: customModel.model,
    label: customModel.label,
    contextWindow: customModel.contextWindow,
    inputModalities: customModel.inputModalities,
    supportedReasoningEfforts: customModel.supportedReasoningEfforts,
    defaultReasoningEffort: customModel.defaultReasoningEffort,
    isDefault: false,
    updatedAt: customModel.updatedAt
  },
  {
    source: "app-server",
    model: customModel.model,
    label: customModel.label,
    contextWindow: null,
    inputModalities: ["text"],
    supportedReasoningEfforts: ["medium"],
    defaultReasoningEffort: "medium",
    isDefault: true
  }
];

describe("自定义模型共享契约", () => {
  it("同名但不同来源的模型具有不同选择身份", () => {
    expect(modelSelectionKey(customSelection)).toBe("custom:custom-1");
    expect(modelSelectionKey(appServerSelection)).toBe("app-server:mimo-v2.5-pro");
    expect(modelSelectionKey(customSelection)).not.toBe(modelSelectionKey(appServerSelection));
  });

  it("固定目录和绑定 schema version", () => {
    expect(CUSTOM_MODEL_CATALOG_SCHEMA_VERSION).toBe(1);
    expect(THREAD_MODEL_BINDING_SCHEMA_VERSION).toBe(1);
  });

  it("共享 fixture 不包含 provider 且 operation 保存完整旧目标快照", () => {
    expect(customModel).not.toHaveProperty("provider");
    expect(binding).not.toHaveProperty("provider");
    expect(operation.oldState.selection.source).toBe("app-server");
    expect(operation.targetState.binding).toEqual(binding);
    expect(selectableModels.map((entry) => entry.source)).toEqual(["custom", "app-server"]);
  });

  it("稳定错误码覆盖前置冲突、容量和恢复失败", () => {
    expect(MODEL_SWITCH_ERROR_CODES).toEqual(
      expect.arrayContaining([
        "CATALOG_REVISION_CONFLICT",
        "THREAD_BUSY",
        "CONTEXT_COMPACTION_REQUIRED",
        "MODEL_CATALOG_ENTRY_REQUIRED",
        "SWITCH_RECOVERY_FAILED"
      ])
    );
  });
});
