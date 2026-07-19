import { mkdtemp, mkdir, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/server/runtime", () => ({
  getRuntimeConfig: () => ({ workspaceRoots: [] })
}));

import {
  assertRuntimeSessionRolloutFileAllowed,
  assertRuntimeSessionRolloutPathAllowed
} from "../../src/server/security";

describe("session rollout path policy", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("只额外放行 CODEX_HOME/sessions 内的 app-server 会话文件", () => {
    const codexHome = join(tmpdir(), "codex-web-security-policy", "codex-home");
    const allowedPath = join(codexHome, "sessions", "2026", "07", "15", "rollout-thread-1.jsonl");
    vi.stubEnv("CODEX_HOME", codexHome);

    expect(assertRuntimeSessionRolloutPathAllowed(allowedPath)).toBe(resolve(allowedPath));
    expect(() => assertRuntimeSessionRolloutPathAllowed(join(codexHome, "config.toml"))).toThrow(
      "路径不在允许的工作区范围内"
    );
    expect(() => assertRuntimeSessionRolloutPathAllowed(join(tmpdir(), "codex-web-security-other", "session.jsonl"))).toThrow(
      "路径不在允许的工作区范围内"
    );
  });

  it("使用真实路径校验阻止 rollout 文件通过符号链接逃逸", async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), "codex-web-rollout-policy-"));
    const codexHome = join(tempRoot, "codex-home");
    const sessionsRoot = join(codexHome, "sessions");
    const outsideRoot = join(tempRoot, "outside");
    await mkdir(sessionsRoot, { recursive: true });
    await mkdir(outsideRoot, { recursive: true });
    const allowedFile = join(sessionsRoot, "allowed.jsonl");
    const outsideFile = join(outsideRoot, "outside.jsonl");
    await writeFile(allowedFile, "{}\n", "utf8");
    await writeFile(outsideFile, "{}\n", "utf8");
    await symlink(outsideFile, join(sessionsRoot, "file-link.jsonl"));
    await symlink(outsideRoot, join(sessionsRoot, "directory-link"));
    vi.stubEnv("CODEX_HOME", codexHome);

    try {
      await expect(assertRuntimeSessionRolloutFileAllowed(allowedFile)).resolves.toBe(await realpath(allowedFile));
      await expect(
        assertRuntimeSessionRolloutFileAllowed(join(sessionsRoot, "file-link.jsonl"))
      ).rejects.toThrow("会话历史路径不在允许的 sessions 目录内");
      await expect(
        assertRuntimeSessionRolloutFileAllowed(join(sessionsRoot, "directory-link", "outside.jsonl"))
      ).rejects.toThrow("会话历史路径不在允许的 sessions 目录内");
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });
});
