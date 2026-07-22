import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("settings route layout", () => {
  it("owns a mobile scroll viewport with safe-area spacing", async () => {
    const layoutPath = join(process.cwd(), "src/app/settings/layout.tsx");
    const source = await readFile(layoutPath, "utf8").catch(() => null);

    expect(source).not.toBeNull();
    if (source === null) return;

    expect(source).toContain('height: "100dvh"');
    expect(source).toContain('overflowY: "auto"');
    expect(source).toContain('overscrollBehaviorY: "contain"');
    expect(source).toContain("var(--safe-bottom)");
  });
});
