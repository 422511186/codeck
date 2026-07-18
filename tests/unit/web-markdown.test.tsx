import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { Markdown, markdownUrlTransform } from "../../src/web/components/Markdown";

describe("Markdown", () => {
  beforeEach(() => {
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: vi.fn().mockResolvedValue(undefined)
      },
      configurable: true
    });
  });

  it("renders inline code without block wrappers inside paragraphs", () => {
    const { container } = render(<Markdown text="使用 `cwd` 精确匹配。" />);

    expect(container.querySelector("p pre")).toBeNull();
    expect(container.querySelector("p div")).toBeNull();
    expect(container.querySelector("p code")?.textContent).toBe("cwd");
  });

  it("renders fenced code as a block", () => {
    const { container } = render(<Markdown text={"```ts\nconst cwd = 'C:/Users/huang';\n```"} />);

    expect(container.querySelector("pre code")?.textContent).toContain("const cwd");
  });

  it("keeps highlighted block code background controlled by the theme wrapper", () => {
    const { container } = render(<Markdown text={"```ts\nconst cwd = 'C:/Users/huang';\n```"} />);

    const pre = container.querySelector("pre");
    const code = container.querySelector("pre code");

    expect(pre?.getAttribute("style")).toContain("background: var(--cw-code-bg)");
    expect(pre?.getAttribute("style")).toContain("color: var(--cw-code-fg)");
    expect(pre?.getAttribute("style")).toContain("border: 1px solid var(--cw-code-border)");
    expect(code?.getAttribute("style")).toContain("background: transparent");
    expect(code?.getAttribute("style")).toContain("color: inherit");
  });

  it("renders a theme-visible copy button and shows copied state", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true
    });
    render(<Markdown text={"```bash\nssh e3.vm\n```"} />);

    const button = screen.getByRole("button", { name: "复制代码" });

    expect(button.getAttribute("style")).toContain("background: var(--cw-bg-overlay)");
    expect(button.getAttribute("style")).toContain("color: var(--cw-fg)");
    expect(button.getAttribute("style")).toContain("border: 1px solid var(--cw-border-strong)");
    expect(button.getAttribute("style")).toContain("min-height: 28px");

    await user.click(button);

    expect(writeText).toHaveBeenCalledWith("ssh e3.vm");
    await waitFor(() => expect(button).toHaveTextContent("已复制"));
  });

  it("defines the overlay theme token used by the code copy button", () => {
    const tokens = readFileSync("src/web/theme/tokens.css", "utf8");

    expect(tokens).toContain("--cw-bg-overlay: var(--bg-overlay);");
  });

  it("routes POSIX absolute Markdown images through the preview API", () => {
    render(<Markdown text="![桌面动作列表](/Users/huangzy/Workspace/shot.png)" />);

    expect(screen.getByRole("img", { name: "桌面动作列表" })).toHaveAttribute(
      "src",
      "/api/codex/images/preview?path=%2FUsers%2Fhuangzy%2FWorkspace%2Fshot.png"
    );
  });

  it("normalizes Windows image paths once and preserves supported browser image URLs", () => {
    expect(markdownUrlTransform("C:%5CUsers%5Chuang%5CMy%20Shot.png", "src")).toBe(
      "/api/codex/images/preview?path=C%3A%5CUsers%5Chuang%5CMy%20Shot.png"
    );
    expect(markdownUrlTransform("https://example.com/shot.png", "src")).toBe("https://example.com/shot.png");
    expect(markdownUrlTransform("//cdn.example.com/shot.png", "src")).toBe("//cdn.example.com/shot.png");
    expect(markdownUrlTransform("/api/codex/images/preview?path=shot", "src")).toBe(
      "/api/codex/images/preview?path=shot"
    );
    expect(markdownUrlTransform("blob:http://localhost/asset", "src")).toBe("blob:http://localhost/asset");
    expect(markdownUrlTransform("data:image/png;base64,AA==", "src")).toBe("data:image/png;base64,AA==");
    expect(markdownUrlTransform("./shot.png", "src")).toBe("./shot.png");
    expect(markdownUrlTransform("/Users/huangzy/notes/readme.md", "href")).toBe(
      "/Users/huangzy/notes/readme.md"
    );
    expect(markdownUrlTransform("javascript:alert(1)", "src")).toBe("");
    expect(markdownUrlTransform("data:text/html;base64,AA==", "src")).toBe("");
  });

  it("shows a retryable failure state and opens Markdown images in the existing preview dialog", async () => {
    const user = userEvent.setup();
    const { container } = render(<Markdown text="![手机动作列表](/Users/huangzy/shot.png)" />);

    const image = screen.getByRole("img", { name: "手机动作列表" });
    expect(image).toHaveStyle({ maxWidth: "100%", height: "auto" });

    fireEvent.error(image);

    expect(screen.queryByRole("img", { name: "手机动作列表" })).not.toBeInTheDocument();
    const retry = screen.getByRole("button", { name: "图片加载失败，点击重试" });
    expect(retry).toHaveTextContent("图片加载失败");
    expect(container).not.toHaveTextContent("/Users/huangzy/shot.png");

    await user.click(retry);
    const retriedImage = screen.getByRole("img", { name: "手机动作列表" });
    expect(retriedImage.getAttribute("src")).toContain("cw_retry=1");

    await user.click(retriedImage);
    expect(screen.getByRole("dialog", { name: "图片预览" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "关闭预览" }));
    expect(screen.queryByRole("dialog", { name: "图片预览" })).not.toBeInTheDocument();
  });

  it("opens linked Markdown images without following the surrounding link", () => {
    render(
      <Markdown text="[![验收截图](/Users/huangzy/shot.png)](https://example.com/original.png)" />
    );

    const clickResult = fireEvent.click(screen.getByRole("img", { name: "验收截图" }));

    expect(clickResult).toBe(false);
    expect(screen.getByRole("dialog", { name: "图片预览" })).toBeInTheDocument();
  });
});
