import { describe, expect, it } from "vitest";
import { createTextUserInput } from "../../src/server/app-server/user-input";

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
});
