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
      expect(screen.getByText("+console.log('test');")).toBeInTheDocument();
    });
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

    expect(screen.getByText("思考中…")).toBeInTheDocument();
  });

  it("should show streamed reasoning text while running", async () => {
    const user = userEvent.setup();
    const fullText = "先检查 timeline 数据流\n再定位 UI 渲染问题";
    render(
      <ReasoningCard
        entry={{
          text: fullText,
          done: false
        }}
      />
    );

    expect(screen.getByText(/思考中/)).toBeInTheDocument();
    expect(screen.getByText(/先检查 timeline 数据流/)).toBeInTheDocument();

    const card = screen.getByText(/思考中/).closest("button");
    await user.click(card!);

    await waitFor(() => {
      expect(screen.getByText(/再定位 UI 渲染问题/)).toBeInTheDocument();
    });
  });

  it("should show a recognizable reasoning title when completed", () => {
    render(
      <ReasoningCard
        entry={{
          text: "Analysis of the problem and potential solutions",
          done: true
        }}
      />
    );

    expect(screen.getByText("推理过程")).toBeInTheDocument();
    expect(screen.getByText(/Analysis of the problem/)).toBeInTheDocument();
  });

  it("should expand and show full reasoning content", async () => {
    const user = userEvent.setup();
    const fullText = "First, I need to check the structure\nThen analyze the dependencies";
    render(
      <ReasoningCard
        entry={{
          text: fullText,
          done: true
        }}
      />
    );

    const card = screen.getByText("推理过程").closest("button");
    expect(screen.queryByText(/Then analyze the dependencies/)).not.toBeInTheDocument();

    await user.click(card!);

    await waitFor(() => {
      expect(screen.getByText(/Then analyze the dependencies/)).toBeInTheDocument();
    });
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
