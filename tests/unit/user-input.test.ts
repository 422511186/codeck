import { describe, expect, it } from "vitest";
import { createLocalImageUserInput, createTurnUserInput, createTextUserInput } from "../../src/server/app-server/user-input";

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
});
