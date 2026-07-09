import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { CommandCard } from "../../src/web/components/cards/CommandCard";
import { DiffCard } from "../../src/web/components/cards/DiffCard";
import { ReasoningCard } from "../../src/web/components/cards/ReasoningCard";
import { ToolCard } from "../../src/web/components/cards/ToolCard";
import { imagePreviewSrc } from "../../src/web/components/ImagePreview";

describe("CommandCard", () => {
  it("should render command text", () => {
    render(
      <CommandCard
        entry={{
          command: "npm test",
          output: "",
          status: "idle"
        }}
      />
    );

    expect(screen.getByText("npm test")).toBeInTheDocument();
  });

  it("should show output when expanded", async () => {
    const user = userEvent.setup();
    render(
      <CommandCard
        entry={{
          command: "echo hello",
          output: "hello\nworld",
          status: "completed"
        }}
      />
    );

    const card = screen.getByText("echo hello").closest("div[role='button']");
    await user.click(card!);

    await waitFor(() => {
      expect(screen.getByText(/hello/)).toBeInTheDocument();
    });
  });

  it("should display running status", () => {
    render(
      <CommandCard
        entry={{
          command: "npm install",
          output: "",
          status: "running"
        }}
      />
    );

    expect(screen.getByText("npm install")).toBeInTheDocument();
  });

  it("should display failed status", () => {
    render(
      <CommandCard
        entry={{
          command: "npm test",
          output: "Error: test failed",
          status: "failed"
        }}
      />
    );

    expect(screen.getByText("npm test")).toBeInTheDocument();
  });

  it("should cap expanded long output and copy the complete output", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText }
    });
    const output = Array.from({ length: 220 }, (_value, index) => `line-${index}`).join("\n");
    render(
      <CommandCard
        entry={{
          command: "npm run noisy",
          output,
          status: "completed"
        }}
      />
    );

    await user.click(screen.getByText("npm run noisy").closest("button")!);

    expect(screen.getByText(/line-0/)).toBeInTheDocument();
    expect(screen.queryByText("line-219")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "复制完整输出" }));
    expect(writeText).toHaveBeenCalledWith(output);
  });
});

describe("DiffCard", () => {
  it("should render file path", () => {
    render(
      <DiffCard
        entry={{
          path: "src/app.ts",
          diff: "--- a/src/app.ts\n+++ b/src/app.ts\n@@ -1,1 +1,2 @@\n+new line",
          added: 1,
          removed: 0
        }}
      />
    );

    expect(screen.getByText("src/app.ts")).toBeInTheDocument();
  });

  it("should show diff stats", () => {
    render(
      <DiffCard
        entry={{
          path: "src/app.ts",
          diff: "--- a/src/app.ts\n+++ b/src/app.ts",
          added: 3,
          removed: 1
        }}
      />
    );

    expect(screen.getByText("src/app.ts")).toBeInTheDocument();
    expect(screen.getByText("+3")).toBeInTheDocument();
    expect(screen.getByText("-1")).toBeInTheDocument();
  });

  it("should expand and show diff content", async () => {
    const user = userEvent.setup();
    render(
      <DiffCard
        entry={{
          path: "src/app.ts",
          diff: "--- a/src/app.ts\n+++ b/src/app.ts\n@@ -1,1 +1,2 @@\n+console.log('test');",
          added: 1,
          removed: 0
        }}
      />
    );

    const card = screen.getByText("src/app.ts").closest("button");
    expect(screen.queryByText("+console.log('test');")).not.toBeInTheDocument();

    await user.click(card!);

    await waitFor(() => {
      expect(screen.getByText("console.log('test');")).toBeInTheDocument();
      expect(screen.getByText("@@ -1,1 +1,2 @@")).toBeInTheDocument();
    });
  });

  it("should use one compact line number gutter for mobile diffs", async () => {
    const user = userEvent.setup();
    render(
      <DiffCard
        entry={{
          path: "src/app.ts",
          diff: "--- a/src/app.ts\n+++ b/src/app.ts\n@@ -15,4 +15,4 @@\n-old\n+new",
          added: 1,
          removed: 1
        }}
      />
    );

    await user.click(screen.getByText("src/app.ts").closest("button")!);

    const row = screen.getByText("old").closest("div");
    expect(row).not.toBeNull();
    expect(row!.style.gridTemplateColumns).toBe("32px 16px minmax(0, 1fr)");
  });

  it("should cap expanded long diff and copy the complete diff", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText }
    });
    const diff = [
      "--- a/src/app.ts",
      "+++ b/src/app.ts",
      "@@ -1,220 +1,220 @@",
      ...Array.from({ length: 220 }, (_value, index) => `+added-${index}`)
    ].join("\n");
    render(
      <DiffCard
        entry={{
          path: "src/app.ts",
          diff,
          added: 220,
          removed: 0
        }}
      />
    );

    await user.click(screen.getByText("src/app.ts").closest("button")!);

    expect(screen.getByText("added-0")).toBeInTheDocument();
    expect(screen.queryByText("added-219")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "复制完整 diff" }));
    expect(writeText).toHaveBeenCalledWith(diff);
  });
});

describe("ReasoningCard", () => {
  it("should show thinking indicator when running", () => {
    render(
      <ReasoningCard
        entry={{
          text: "",
          done: false
        }}
      />
    );

    expect(screen.getByText("Thinking...")).toBeInTheDocument();
  });

  it("should hide streamed reasoning text while running", () => {
    const fullText = "先检查 timeline 数据流\n再定位 UI 渲染问题";
    render(
      <ReasoningCard
        entry={{
          text: fullText,
          done: false
        }}
      />
    );

    expect(screen.getByText(/Thinking\.\.\./)).toBeInTheDocument();
    expect(screen.queryByText(/先检查 timeline 数据流/)).not.toBeInTheDocument();
    expect(screen.queryByText(/再定位 UI 渲染问题/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "复制完整推理" })).not.toBeInTheDocument();
  });

  it("should show a recognizable reasoning title when completed without reasoning text", () => {
    render(
      <ReasoningCard
        entry={{
          text: "Analysis of the problem and potential solutions",
          done: true
        }}
      />
    );

    expect(screen.getByText("Thinking")).toBeInTheDocument();
    expect(screen.queryByText(/Analysis of the problem/)).not.toBeInTheDocument();
  });

  it("should not expand completed reasoning content", () => {
    const fullText = "First, I need to check the structure\nThen analyze the dependencies";
    render(
      <ReasoningCard
        entry={{
          text: fullText,
          done: true
        }}
      />
    );

    expect(screen.getByText("Thinking")).toBeInTheDocument();
    expect(screen.queryByText(/First, I need to check/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Then analyze the dependencies/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "复制完整推理" })).not.toBeInTheDocument();
  });
});

describe("imagePreviewSrc", () => {
  it("should route local paths through the preview API", () => {
    expect(imagePreviewSrc("/home/hzy/workspace/codex-web-1/uploads/shot.jpg")).toBe(
      "/api/codex/images/preview?path=%2Fhome%2Fhzy%2Fworkspace%2Fcodex-web-1%2Fuploads%2Fshot.jpg"
    );
    expect(imagePreviewSrc("C:/Users/huang/AppData/Local/Temp/shot.png")).toBe(
      "/api/codex/images/preview?path=C%3A%2FUsers%2Fhuang%2FAppData%2FLocal%2FTemp%2Fshot.png"
    );
    expect(imagePreviewSrc("uploads/shot.webp")).toBe("/api/codex/images/preview?path=uploads%2Fshot.webp");
  });

  it("should keep browser-native image URLs unchanged", () => {
    expect(imagePreviewSrc("blob:http://localhost/blob-id")).toBe("blob:http://localhost/blob-id");
    expect(imagePreviewSrc("data:image/png;base64,abc")).toBe("data:image/png;base64,abc");
    expect(imagePreviewSrc("http://example.test/shot.png")).toBe("http://example.test/shot.png");
    expect(imagePreviewSrc("https://example.test/shot.png")).toBe("https://example.test/shot.png");
  });
});

describe("ToolCard", () => {
  it("should prioritize command text over cwd for command tools", () => {
    render(
      <ToolCard
        entry={{
          kind: "tool",
          toolKind: "command",
          server: "/home/hzy/workspace/codex-web-1",
          tool: "npm test",
          status: "success",
          result: "ok"
        }}
      />
    );

    expect(screen.getByText("npm test")).toBeInTheDocument();
    expect(screen.queryByText("/home/hzy/workspace/codex-web-1 · npm test")).not.toBeInTheDocument();
  });

  it("should render file tool line stats", () => {
    render(
      <ToolCard
        entry={{
          kind: "tool",
          server: "file",
          tool: "src/app.ts",
          diffPath: "src/app.ts",
          added: 2,
          removed: 1,
          status: "success",
          result: "--- a/src/app.ts\n+++ b/src/app.ts\n-old\n+new\n+added"
        }}
      />
    );

    expect(screen.getByText("file · src/app.ts")).toBeInTheDocument();
    expect(screen.getByText("+2")).toBeInTheDocument();
    expect(screen.getByText("-1")).toBeInTheDocument();
  });

  it("should render image tool results as thumbnails", async () => {
    const user = userEvent.setup();
    render(
      <ToolCard
        entry={{
          kind: "tool",
          server: "image",
          tool: "view",
          status: "success",
          result: "C:/Users/huang/AppData/Local/Temp/shot.png",
          imagePaths: ["C:/Users/huang/AppData/Local/Temp/shot.png"]
        }}
      />
    );

    await user.click(screen.getByText("image · view"));

    const image = screen.getByRole("img", { name: "工具图片预览" });
    expect(image).toHaveAttribute(
      "src",
      "/api/codex/images/preview?path=C%3A%2FUsers%2Fhuang%2FAppData%2FLocal%2FTemp%2Fshot.png"
    );
  });
});
