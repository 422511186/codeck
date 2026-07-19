import { describe, expect, it } from "vitest";
import {
  CustomModelValidationError,
  assertUniqueCustomModel,
  normalizeCustomModelInput
} from "../../src/server/custom-models/validation";
import type { CustomModelConfig } from "../../src/shared/custom-models";

function validInput(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    model: "mimo-v2.5-pro",
    label: "MIMO 2.5 Pro",
    contextWindow: 200_000,
    inputModalities: ["text"],
    supportedReasoningEfforts: [],
    defaultReasoningEffort: null,
    ...overrides
  };
}

function expectInvalid(value: unknown, field: string): void {
  try {
    normalizeCustomModelInput(value);
    throw new Error("expected validation failure");
  } catch (error) {
    expect(error).toBeInstanceOf(CustomModelValidationError);
    expect((error as CustomModelValidationError).issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ field })])
    );
  }
}

describe("normalizeCustomModelInput", () => {
  it("创建时使用保守默认值并修剪 model/label", () => {
    expect(normalizeCustomModelInput({ model: " mimo-v2.5-pro ", label: " MIMO " })).toEqual({
      model: "mimo-v2.5-pro",
      label: "MIMO",
      contextWindow: 200_000,
      inputModalities: ["text"],
      supportedReasoningEfforts: [],
      defaultReasoningEffort: null
    });
  });

  it("完整替换时拒绝缺失的可修改字段", () => {
    expect(() =>
      normalizeCustomModelInput(
        { model: "mimo-v2.5-pro", label: "MIMO" },
        { requireComplete: true }
      )
    ).toThrow(CustomModelValidationError);
  });

  it.each([1, 1_000_000])("接受上下文窗口边界 %s", (contextWindow) => {
    expect(normalizeCustomModelInput(validInput({ contextWindow })).contextWindow).toBe(contextWindow);
  });

  it.each([0, 1_000_001, 1.5, Number.MAX_SAFE_INTEGER + 1])(
    "拒绝非法上下文窗口 %s",
    (contextWindow) => expectInvalid(validInput({ contextWindow }), "contextWindow")
  );

  it("校验 model 与 label 的长度和控制字符", () => {
    expectInvalid(validInput({ model: "" }), "model");
    expectInvalid(validInput({ model: "x".repeat(257) }), "model");
    expectInvalid(validInput({ model: "bad\nmodel" }), "model");
    expectInvalid(validInput({ label: "x".repeat(101) }), "label");
    expectInvalid(validInput({ label: "bad\u0000label" }), "label");
  });

  it("要求唯一 text 模态且只允许显式 image", () => {
    expect(normalizeCustomModelInput(validInput({ inputModalities: ["image", "text"] })).inputModalities)
      .toEqual(["text", "image"]);
    expectInvalid(validInput({ inputModalities: [] }), "inputModalities");
    expectInvalid(validInput({ inputModalities: ["text", "text"] }), "inputModalities");
    expectInvalid(validInput({ inputModalities: ["text", "audio"] }), "inputModalities");
  });

  it("接受开放且区分大小写的 reasoning 档位", () => {
    const result = normalizeCustomModelInput(
      validInput({
        supportedReasoningEfforts: [" Medium ", "medium", "vendor-ultra"],
        defaultReasoningEffort: "vendor-ultra"
      })
    );

    expect(result.supportedReasoningEfforts).toEqual(["Medium", "medium", "vendor-ultra"]);
    expect(result.defaultReasoningEffort).toBe("vendor-ultra");
  });

  it("拒绝重复、过多、过长或含控制字符的 reasoning 档位", () => {
    expectInvalid(validInput({ supportedReasoningEfforts: ["medium", " medium "] }), "supportedReasoningEfforts");
    expectInvalid(
      validInput({ supportedReasoningEfforts: Array.from({ length: 17 }, (_, index) => `level-${index}`) }),
      "supportedReasoningEfforts"
    );
    expectInvalid(validInput({ supportedReasoningEfforts: ["x".repeat(65)] }), "supportedReasoningEfforts");
    expectInvalid(validInput({ supportedReasoningEfforts: ["bad\neffort"] }), "supportedReasoningEfforts");
  });

  it("强制默认 reasoning 与支持列表交叉一致", () => {
    expectInvalid(
      validInput({ supportedReasoningEfforts: ["medium"], defaultReasoningEffort: null }),
      "defaultReasoningEffort"
    );
    expectInvalid(
      validInput({ supportedReasoningEfforts: ["medium"], defaultReasoningEffort: "Medium" }),
      "defaultReasoningEffort"
    );
    expectInvalid(
      validInput({ supportedReasoningEfforts: [], defaultReasoningEffort: "medium" }),
      "defaultReasoningEffort"
    );
  });

  it("拒绝 provider、URL、凭据和所有未知字段", () => {
    for (const field of ["provider", "baseUrl", "apiKey", "authorization", "environmentValue"]) {
      expectInvalid(validInput({ [field]: "secret" }), field);
    }
  });
});

describe("assertUniqueCustomModel", () => {
  const existing: CustomModelConfig = {
    ...normalizeCustomModelInput(validInput()),
    customModelId: "custom-1",
    createdAt: "2026-07-18T00:00:00.000Z",
    updatedAt: "2026-07-18T00:00:00.000Z"
  };

  it("按区分大小写的精确 model 拒绝重复", () => {
    expect(() => assertUniqueCustomModel([existing], "mimo-v2.5-pro")).toThrow("CUSTOM_MODEL_DUPLICATE");
    expect(() => assertUniqueCustomModel([existing], "MIMO-V2.5-PRO")).not.toThrow();
  });

  it("完整替换时排除当前 customModelId", () => {
    expect(() => assertUniqueCustomModel([existing], existing.model, existing.customModelId)).not.toThrow();
  });
});
