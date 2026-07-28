import { describe, expect, it } from "vitest";
import {
  createLocalImageUserInput,
  createSkillUserInput,
  createTurnUserInput,
  createTextUserInput
} from "../../src/server/app-server/user-input";

describe("createTextUserInput", () => {
  it("把文本消息映射为 app-server UserInput", () => {
    expect(createTextUserInput("  帮我继续开发  ")).toEqual({
      type: "text",
      text: "帮我继续开发",
      text_elements: []
    });
  });

  it("拒绝空文本消息", () => {
    expect(() => createTextUserInput("   ")).toThrow("消息不能为空");
  });

  it("把本地图片路径映射为 localImage 输入", () => {
    expect(createLocalImageUserInput("C:/repo/uploads/shot.png")).toEqual({
      type: "localImage",
      path: "C:/repo/uploads/shot.png"
    });
  });

  it("turn 输入支持文本和图片同时发送", () => {
    expect(createTurnUserInput("  看图  ", ["C:/repo/uploads/shot.png"])).toEqual([
      { type: "text", text: "看图", text_elements: [] },
      { type: "localImage", path: "C:/repo/uploads/shot.png" }
    ]);
  });

  it("turn 输入支持结构化 Skill 引用", () => {
    expect(
      createTurnUserInput(
        "  查文档  ",
        ["C:/repo/uploads/shot.png"],
        [{ name: " openai-docs ", path: " C:/Users/huang/.codex/skills/openai-docs/SKILL.md " }]
      )
    ).toEqual([
      { type: "text", text: "查文档", text_elements: [] },
      { type: "skill", name: "openai-docs", path: "C:/Users/huang/.codex/skills/openai-docs/SKILL.md" },
      { type: "localImage", path: "C:/repo/uploads/shot.png" }
    ]);
  });

  it("拒绝空 Skill 引用", () => {
    expect(() => createSkillUserInput({ name: " ", path: "C:/skill/SKILL.md" })).toThrow("Skill 引用不能为空");
    expect(() => createSkillUserInput({ name: "openai-docs", path: " " })).toThrow("Skill 引用不能为空");
  });

  it("普通文件只进入受控文本包装", () => {
    const result = createTurnUserInput("hello", [], [], [{ id: "abc", name: "notes.txt", path: "C:/uploads/abc.txt", mimeType: "text/plain", size: 12 }]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ type: "text" });
    expect((result[0] as { text: string }).text).toContain("# Files mentioned by the user:");
    expect(result.some((item) => (item as { type: string }).type === "localFile")).toBe(false);
  });
});
