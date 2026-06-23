import type { MobileConfigEditInput } from "../../../../shared/codex";

const writableConfigKeys = new Set(["model", "model_reasoning_effort", "approval_policy", "sandbox_mode"]);

function isConfigValue(value: unknown): value is MobileConfigEditInput["value"] {
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return true;
  }

  return Array.isArray(value) && value.every((item) => item === null || ["string", "number", "boolean"].includes(typeof item));
}

export function assertConfigEdit(value: unknown): MobileConfigEditInput {
  const edit = value as { keyPath?: unknown; value?: unknown };
  if (typeof edit.keyPath !== "string" || !edit.keyPath.trim()) {
    throw new Error("keyPath 不能为空");
  }
  if (!writableConfigKeys.has(edit.keyPath)) {
    throw new Error("该配置项暂不支持在移动端写入");
  }
  if (!isConfigValue(edit.value)) {
    throw new Error("value 必须是 JSON 基础值");
  }

  return {
    keyPath: edit.keyPath,
    value: edit.value
  };
}
