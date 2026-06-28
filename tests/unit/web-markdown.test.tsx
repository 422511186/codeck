import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { Markdown } from "../../src/web/components/Markdown";

describe("Markdown", () => {
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
});
