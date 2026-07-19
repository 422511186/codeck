import {
  DEFAULT_CUSTOM_MODEL_CONTEXT_WINDOW,
  MAX_CUSTOM_MODEL_CONTEXT_WINDOW,
  type CustomModelConfig,
  type CustomModelInput,
  type ModelInputModality
} from "../../shared/custom-models";

export type CustomModelValidationIssue = {
  field: string;
  message: string;
};

export class CustomModelValidationError extends Error {
  readonly code: "CUSTOM_MODEL_VALIDATION_FAILED" | "CUSTOM_MODEL_DUPLICATE";
  readonly issues: CustomModelValidationIssue[];

  constructor(
    issues: CustomModelValidationIssue[],
    code: "CUSTOM_MODEL_VALIDATION_FAILED" | "CUSTOM_MODEL_DUPLICATE" = "CUSTOM_MODEL_VALIDATION_FAILED"
  ) {
    super(`${code}: ${issues.map((issue) => `${issue.field} ${issue.message}`).join("；")}`);
    this.name = "CustomModelValidationError";
    this.code = code;
    this.issues = issues;
  }
}

const MUTABLE_FIELDS = new Set([
  "model",
  "label",
  "contextWindow",
  "inputModalities",
  "supportedReasoningEfforts",
  "defaultReasoningEffort"
]);
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f]/u;

function fail(field: string, message: string): never {
  throw new CustomModelValidationError([{ field, message }]);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringLength(value: string): number {
  return Array.from(value).length;
}

function normalizeBoundedString(value: unknown, field: string, maximum: number): string {
  if (typeof value !== "string") {
    fail(field, "必须是字符串");
  }
  const normalized = value.trim();
  const length = stringLength(normalized);
  if (length < 1 || length > maximum) {
    fail(field, `长度必须在 1..${maximum} 之间`);
  }
  if (CONTROL_CHARACTERS.test(normalized)) {
    fail(field, "不能包含控制字符");
  }
  return normalized;
}

function normalizeContextWindow(value: unknown): number {
  if (!Number.isSafeInteger(value) || (value as number) < 1 || (value as number) > MAX_CUSTOM_MODEL_CONTEXT_WINDOW) {
    fail("contextWindow", `必须是 1..${MAX_CUSTOM_MODEL_CONTEXT_WINDOW} 的安全整数`);
  }
  return value as number;
}

function normalizeModalities(value: unknown): ModelInputModality[] {
  if (!Array.isArray(value)) {
    fail("inputModalities", "必须是数组");
  }
  if (value.some((entry) => entry !== "text" && entry !== "image")) {
    fail("inputModalities", "只允许 text 和 image");
  }
  if (!value.includes("text")) {
    fail("inputModalities", "必须包含 text");
  }
  if (new Set(value).size !== value.length) {
    fail("inputModalities", "不能包含重复值");
  }
  return value.includes("image") ? ["text", "image"] : ["text"];
}

function normalizeReasoningEfforts(value: unknown): string[] {
  if (!Array.isArray(value)) {
    fail("supportedReasoningEfforts", "必须是数组");
  }
  if (value.length > 16) {
    fail("supportedReasoningEfforts", "最多允许 16 个档位");
  }
  const efforts = value.map((entry) =>
    normalizeBoundedString(entry, "supportedReasoningEfforts", 64)
  );
  if (new Set(efforts).size !== efforts.length) {
    fail("supportedReasoningEfforts", "不能包含区分大小写后完全相同的重复值");
  }
  return efforts;
}

export function normalizeCustomModelInput(
  value: unknown,
  options: { requireComplete?: boolean } = {}
): CustomModelInput {
  if (!isRecord(value)) {
    fail("model", "模型配置必须是对象");
  }
  for (const field of Object.keys(value)) {
    if (!MUTABLE_FIELDS.has(field)) {
      fail(field, "不是允许的自定义模型字段");
    }
  }

  const requireValue = (field: keyof CustomModelInput, fallback: unknown): unknown => {
    const current = value[field];
    if (current === undefined && options.requireComplete) {
      fail(field, "完整替换时不能为空");
    }
    return current === undefined ? fallback : current;
  };

  const supportedReasoningEfforts = normalizeReasoningEfforts(
    requireValue("supportedReasoningEfforts", [])
  );
  const rawDefault = requireValue("defaultReasoningEffort", null);
  const defaultReasoningEffort = rawDefault === null
    ? null
    : normalizeBoundedString(rawDefault, "defaultReasoningEffort", 64);

  if (supportedReasoningEfforts.length === 0 && defaultReasoningEffort !== null) {
    fail("defaultReasoningEffort", "无 reasoning 档位时必须为 null");
  }
  if (supportedReasoningEfforts.length > 0 && defaultReasoningEffort === null) {
    fail("defaultReasoningEffort", "存在 reasoning 档位时必须选择默认值");
  }
  if (defaultReasoningEffort !== null && !supportedReasoningEfforts.includes(defaultReasoningEffort)) {
    fail("defaultReasoningEffort", "必须精确匹配 supportedReasoningEfforts 中的值");
  }

  return {
    model: normalizeBoundedString(value.model, "model", 256),
    label: normalizeBoundedString(value.label, "label", 100),
    contextWindow: normalizeContextWindow(
      requireValue("contextWindow", DEFAULT_CUSTOM_MODEL_CONTEXT_WINDOW)
    ),
    inputModalities: normalizeModalities(requireValue("inputModalities", ["text"])),
    supportedReasoningEfforts,
    defaultReasoningEffort
  };
}

export function assertUniqueCustomModel(
  models: CustomModelConfig[],
  model: string,
  excludedCustomModelId?: string
): void {
  const duplicate = models.some(
    (entry) => entry.customModelId !== excludedCustomModelId && entry.model === model
  );
  if (duplicate) {
    throw new CustomModelValidationError(
      [{ field: "model", message: "已存在完全相同的模型标识" }],
      "CUSTOM_MODEL_DUPLICATE"
    );
  }
}
