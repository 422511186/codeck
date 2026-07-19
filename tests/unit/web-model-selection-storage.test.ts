import { beforeEach, describe, expect, it } from "vitest";
import {
  loadWebSettings,
  migrateLegacyDefaultModel,
  saveWebSettings
} from "../../src/web/storage/settings";
import type { SelectableModel } from "../../src/shared/custom-models";

const appModel: SelectableModel = {
  source: "app-server",
  model: "gpt-5.6-sol",
  label: "GPT-5.6",
  contextWindow: null,
  inputModalities: ["text", "image"],
  supportedReasoningEfforts: ["high"],
  defaultReasoningEffort: "high",
  isDefault: true
};

const customModel: SelectableModel = {
  source: "custom",
  customModelId: "custom-1",
  model: "gpt-5.6-sol",
  label: "Custom GPT",
  contextWindow: 200_000,
  inputModalities: ["text"],
  supportedReasoningEfforts: [],
  defaultReasoningEffort: null,
  isDefault: false,
  updatedAt: "2026-07-18T00:00:00.000Z"
};

describe("设备默认模型来源身份存储", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("用 schemaVersion 保存并恢复 customModelId，而不是配置副本", () => {
    saveWebSettings({
      defaultModel: { source: "custom", customModelId: "custom-1" },
      defaultMode: "build",
      theme: "system"
    });

    expect(JSON.parse(window.localStorage.getItem("codex-web:settings") ?? "null")).toEqual({
      schemaVersion: 1,
      defaultModel: { source: "custom", customModelId: "custom-1" },
      defaultMode: "build",
      theme: "system"
    });
    expect(loadWebSettings().defaultModel).toEqual({ source: "custom", customModelId: "custom-1" });
  });

  it("旧字符串仅在 app-server 原始目录精确存在时迁移为 app-server 身份", () => {
    window.localStorage.setItem(
      "codex-web:settings",
      JSON.stringify({ defaultModel: "gpt-5.6-sol", defaultMode: "plan", theme: "dark" })
    );

    const migrated = migrateLegacyDefaultModel([customModel], ["gpt-5.6-sol"]);

    expect(migrated.defaultModel).toEqual({ source: "app-server", model: "gpt-5.6-sol" });
    expect(migrated).toMatchObject({ defaultMode: "plan", theme: "dark" });
  });

  it("不可解析旧字符串会清除，同名 custom 不会被自动认领", () => {
    window.localStorage.setItem(
      "codex-web:settings",
      JSON.stringify({ defaultModel: "gpt-5.6-sol", defaultMode: "build", theme: "system" })
    );

    expect(migrateLegacyDefaultModel([customModel], []).defaultModel).toBeNull();
    expect(loadWebSettings().defaultModel).toBeNull();
  });

  it("已是版本化身份时迁移函数不改变来源", () => {
    saveWebSettings({
      defaultModel: { source: "custom", customModelId: "custom-1" },
      defaultMode: "build",
      theme: "system"
    });

    expect(migrateLegacyDefaultModel([appModel, customModel], ["gpt-5.6-sol"]).defaultModel).toEqual({
      source: "custom",
      customModelId: "custom-1"
    });
  });
});
