import { describe, expect, it } from "vitest";
import { assertPathAllowed, normalizeWorkspaceRoots } from "../../src/server/workspace-policy";

describe("workspace-policy", () => {
  it("规范化 workspace roots 并允许 root 内路径", () => {
    const roots = normalizeWorkspaceRoots(["C:\\Users\\huang\\workspace", "/home/huang/workspace"]);

    expect(assertPathAllowed("C:\\Users\\huang\\workspace\\demo\\README.md", roots)).toBe(
      "C:\\Users\\huang\\workspace\\demo\\README.md"
    );
    expect(assertPathAllowed("/home/huang/workspace/demo/README.md", roots)).toBe(
      "/home/huang/workspace/demo/README.md"
    );
  });

  it("拒绝 workspace roots 外的路径和相似前缀路径", () => {
    const roots = normalizeWorkspaceRoots(["C:\\Users\\huang\\workspace", "/home/huang/workspace"]);

    expect(() => assertPathAllowed("C:\\Users\\huang\\workspace-old\\secret.txt", roots)).toThrow(
      "路径不在允许的工作区范围内"
    );
    expect(() => assertPathAllowed("/home/huang/workspace-old/secret.txt", roots)).toThrow(
      "路径不在允许的工作区范围内"
    );
  });

  it("拒绝空 workspace roots", () => {
    expect(() => normalizeWorkspaceRoots([])).toThrow("至少需要配置一个工作区根目录");
  });
});
