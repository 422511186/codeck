import { describe, expect, it } from "vitest";
import { collaborationModeForChatMode } from "../../src/web/api/types";

describe("collaborationModeForChatMode", () => {
  it("ignores unsupported Ask presets and uses the generated Plan protocol mode", () => {
    const payload = collaborationModeForChatMode("plan", null, null, [
      { name: "Code", mode: "default", model: "gpt-5-codex", reasoningEffort: "medium" },
      { name: "Ask", mode: "ask", model: null, reasoningEffort: null }
    ]);

    expect(payload).toMatchObject({
      mode: "plan",
      settings: {
        model: "gpt-5-codex",
        reasoning_effort: null,
        developer_instructions: null
      }
    });
  });

  it("falls back to the generated protocol Plan mode when no preset is available", () => {
    expect(collaborationModeForChatMode("plan").mode).toBe("plan");
  });

  it("uses app-server built-in Plan instructions", () => {
    const payload = collaborationModeForChatMode("plan");

    expect(payload.settings.developer_instructions).toBeNull();
  });

  it("keeps default mode on built-in instructions", () => {
    const payload = collaborationModeForChatMode("build");

    expect(payload).toMatchObject({
      mode: "default",
      settings: {
        developer_instructions: null
      }
    });
  });
});
