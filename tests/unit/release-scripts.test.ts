import { describe, expect, it } from "vitest";

// @ts-expect-error 脚本是运行时 ESM，测试只需要验证导出的实际行为。
const releaseUtils = await import("../../scripts/release-utils.mjs");

describe("release scripts", () => {
  it("生成带版本号的 release 名称", () => {
    expect(releaseUtils.releaseName("0.1.0")).toBe("codex-web-v0.1.0");
  });

  it("release allowlist 包含运行和文档必需文件", () => {
    expect(releaseUtils.releaseEntries).toEqual(
      expect.arrayContaining([
        ".next",
        "dist/server",
        "public",
        "scripts",
        "package.json",
        "package-lock.json",
        "next.config.mjs",
        ".env.example",
        ".env.docker.example",
        "Dockerfile",
        ".dockerignore",
        "compose.yaml",
        "README.md",
        "docs/release.md",
        "docs/docker-deployment.md"
      ])
    );
  });

  it("release allowlist 不包含本地或敏感文件", () => {
    for (const excluded of releaseUtils.excludedReleaseEntries) {
      expect(releaseUtils.releaseEntries).not.toContain(excluded);
    }
  });

  it("Docker 部署文档引用的通用部署文件会进入 release 包", () => {
    expect(releaseUtils.releaseEntries).toEqual(
      expect.arrayContaining(["Dockerfile", ".dockerignore", "compose.yaml", ".env.docker.example"])
    );
  });

  it("release 打包会剪掉 Next 本地缓存目录", () => {
    expect(releaseUtils.releasePruneEntries).toEqual(expect.arrayContaining([".next/cache", ".next/dev"]));
  });

  it("禁止 smoke test 使用当前服务端口 23000", () => {
    expect(() => releaseUtils.assertSafeSmokePort(23000)).toThrow(/23000/);
    expect(() => releaseUtils.parseSmokePort("23000")).toThrow(/23000/);
  });

  it("允许 smoke test 使用非当前服务端口", () => {
    expect(releaseUtils.parseSmokePort("23001")).toBe(23001);
    expect(() => releaseUtils.assertSafeSmokePort(23001)).not.toThrow();
  });
});
