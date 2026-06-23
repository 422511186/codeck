import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const excludedMethodPattern =
  /^(plugin\/|marketplace\/|mcpServer\/|thread\/realtime\/|environment\/|feedback\/)|^externalAgentConfig\//;

function readSourceFiles(dir: string): string[] {
  if (!existsSync(dir)) {
    return [];
  }

  return readdirSync(dir).flatMap((entry) => {
    const fullPath = path.join(dir, entry);
    const stats = statSync(fullPath);

    if (stats.isDirectory()) {
      return readSourceFiles(fullPath);
    }

    if (fullPath.endsWith(".ts") || fullPath.endsWith(".tsx")) {
      return [readFileSync(fullPath, "utf8")];
    }

    return [];
  });
}

describe("app-server 协议覆盖", () => {
  it("除本次明确排除项外，ClientRequest 方法都已接入源码", () => {
    const clientRequestPath = path.join(process.cwd(), "docs", "generated", "app-server-ts", "ClientRequest.ts");
    const clientRequest = readFileSync(clientRequestPath, "utf8");
    const methods = Array.from(clientRequest.matchAll(/"method":\s*"([^"]+)"/g), (match) => match[1]!).sort();
    const source = readSourceFiles(path.join(process.cwd(), "src")).join("\n");

    const missing = methods.filter((method) => !source.includes(`"${method}"`));
    const remaining = missing.filter((method) => !excludedMethodPattern.test(method));

    expect(remaining).toEqual([]);
  });
});
