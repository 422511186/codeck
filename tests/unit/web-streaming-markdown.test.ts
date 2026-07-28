import { describe, expect, it } from "vitest";
import { splitStreamingMarkdown } from "../../src/web/streaming-markdown";

describe("splitStreamingMarkdown", () => {
  it("keeps incomplete text in the pending plain tail", () => {
    expect(splitStreamingMarkdown("正在写第一段")).toEqual({
      stableMarkdown: "",
      pendingPlain: "正在写第一段"
    });
  });

  it("promotes completed paragraphs into stable markdown", () => {
    expect(splitStreamingMarkdown("第一段已经完成。\n\n第二段还在写")).toEqual({
      stableMarkdown: "第一段已经完成。",
      pendingPlain: "第二段还在写"
    });
  });

  it("keeps an unclosed fenced code block in the pending plain tail", () => {
    const text = "说明文字\n\n```ts\nconst streaming = true;\n";
    expect(splitStreamingMarkdown(text)).toEqual({
      stableMarkdown: "说明文字",
      pendingPlain: "```ts\nconst streaming = true;\n"
    });
  });

  it("promotes a closed fenced code block into stable markdown", () => {
    const text = "说明文字\n\n```ts\nconst streaming = true;\n```\n\n继续写尾巴";
    expect(splitStreamingMarkdown(text)).toEqual({
      stableMarkdown: "说明文字\n\n```ts\nconst streaming = true;\n```",
      pendingPlain: "继续写尾巴"
    });
  });
});
