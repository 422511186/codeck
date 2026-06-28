import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { Markdown } from "../../src/web/components/Markdown";

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
});
