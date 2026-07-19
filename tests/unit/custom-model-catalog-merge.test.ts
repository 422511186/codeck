import { describe, expect, it } from "vitest";
import {
  ModelCatalogPrerequisiteError,
  assertLargeCustomModelSupported,
  mergeSelectableModels
} from "../../src/server/custom-models/model-catalog";
import type { CustomModelConfig } from "../../src/shared/custom-models";
import type { MobileModelOption } from "../../src/shared/codex";

function appModel(overrides: Partial<MobileModelOption> = {}): MobileModelOption {
  return {
    id: "picker-id",
    model: "mimo-v2.5-pro",
    label: "Codex MIMO",
    isDefault: true,
    supportedReasoningEfforts: ["medium"],
    defaultReasoningEffort: "medium",
    inputModalities: ["text"],
    ...overrides
  };
}

function customModel(overrides: Partial<CustomModelConfig> = {}): CustomModelConfig {
  return {
    customModelId: "custom-1",
    model: "mimo-v2.5-pro",
    label: "My MIMO",
    contextWindow: 200_000,
    inputModalities: ["text", "image"],
    supportedReasoningEfforts: ["xhigh"],
    defaultReasoningEffort: "xhigh",
    createdAt: "2026-07-18T00:00:00.000Z",
    updatedAt: "2026-07-18T00:00:00.000Z",
    ...overrides
  };
}

describe("mergeSelectableModels", () => {
  it("精确同名时自定义条目完整胜出且排在 Codex 组之前", () => {
    const original = appModel();
    const result = mergeSelectableModels([original], [customModel()]);

    expect(result).toEqual([
      {
        source: "custom",
        customModelId: "custom-1",
        model: "mimo-v2.5-pro",
        label: "My MIMO",
        contextWindow: 200_000,
        inputModalities: ["text", "image"],
        supportedReasoningEfforts: ["xhigh"],
        defaultReasoningEffort: "xhigh",
        isDefault: false,
        updatedAt: "2026-07-18T00:00:00.000Z"
      }
    ]);
    expect(original).toEqual(appModel());
  });

  it("大小写不同视为不同模型，并保留 app-server 真实 model", () => {
    const result = mergeSelectableModels(
      [appModel({ id: "ui-alias", model: "MIMO-V2.5-PRO" })],
      [customModel()]
    );

    expect(result.map((entry) => [entry.source, entry.model])).toEqual([
      ["custom", "mimo-v2.5-pro"],
      ["app-server", "MIMO-V2.5-PRO"]
    ]);
  });
});

describe("assertLargeCustomModelSupported", () => {
  it("不超过 272000 时允许未知模型", () => {
    expect(() => assertLargeCustomModelSupported(customModel({ contextWindow: 272_000 }), [])).not.toThrow();
  });

  it("超过 272000 的未知模型返回稳定前置错误", () => {
    expect(() =>
      assertLargeCustomModelSupported(customModel({ contextWindow: 1_000_000 }), [])
    ).toThrow(ModelCatalogPrerequisiteError);
    try {
      assertLargeCustomModelSupported(customModel({ contextWindow: 1_000_000 }), []);
    } catch (error) {
      expect(error).toMatchObject({ code: "MODEL_CATALOG_ENTRY_REQUIRED" });
    }
  });

  it("超过 272000 但 app-server 权威目录精确包含时放行", () => {
    expect(() =>
      assertLargeCustomModelSupported(
        customModel({ contextWindow: 1_000_000 }),
        [appModel({ model: "mimo-v2.5-pro" })]
      )
    ).not.toThrow();
  });
});
