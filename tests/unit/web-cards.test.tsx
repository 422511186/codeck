import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { CommandCard } from "../../src/web/components/cards/CommandCard";
import { DiffCard } from "../../src/web/components/cards/DiffCard";
import { ReasoningCard } from "../../src/web/components/cards/ReasoningCard";
import { ToolCard } from "../../src/web/components/cards/ToolCard";

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

  it("should show reasoning preview when completed", () => {
    render(
      <ReasoningCard
        entry={{
          text: "Analysis of the problem and potential solutions",
          done: true
        }}
      />
    );

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

    const card = screen.getByText(/First, I need to check/).closest("button");
    expect(screen.queryByText(/Then analyze the dependencies/)).not.toBeInTheDocument();

    await user.click(card!);

    await waitFor(() => {
      expect(screen.getByText(/Then analyze the dependencies/)).toBeInTheDocument();
    });
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
