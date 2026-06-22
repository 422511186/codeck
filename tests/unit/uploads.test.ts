import { mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { cleanupExpiredUploads, saveUploadedImage } from "../../src/server/uploads";

describe("uploads", () => {
  it("把图片保存到 uploads 目录并返回 localImage 可用路径", async () => {
    const uploadDir = await mkdtemp(join(tmpdir(), "codex-web-upload-"));

    const saved = await saveUploadedImage({
      uploadDir,
      bytes: Buffer.from("fake-png"),
      mimeType: "image/png",
      originalName: "shot.png"
    });

    expect(saved.path.startsWith(resolve(uploadDir))).toBe(true);
    expect(saved.mimeType).toBe("image/png");
    expect(saved.size).toBe(8);
    await expect(readFile(saved.path, "utf8")).resolves.toBe("fake-png");
  });

  it("拒绝非图片上传", async () => {
    const uploadDir = await mkdtemp(join(tmpdir(), "codex-web-upload-"));

    await expect(
      saveUploadedImage({
        uploadDir,
        bytes: Buffer.from("hello"),
        mimeType: "text/plain",
        originalName: "note.txt"
      })
    ).rejects.toThrow("只支持图片上传");
  });

  it("只清理 uploads 目录内的过期文件", async () => {
    const uploadDir = await mkdtemp(join(tmpdir(), "codex-web-upload-"));
    const oldFile = join(uploadDir, "old.png");
    const freshFile = join(uploadDir, "fresh.png");
    await writeFile(oldFile, "old");
    await writeFile(freshFile, "fresh");

    const now = Date.now();
    await cleanupExpiredUploads(uploadDir, { maxAgeMs: 1, now: now + 10_000 });

    await expect(stat(oldFile)).rejects.toThrow();
    await expect(stat(freshFile)).rejects.toThrow();
  });
});
