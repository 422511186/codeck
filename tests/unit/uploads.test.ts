import { mkdir, mkdtemp, readFile, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { assertCanonicalRegularFile, cleanupExpiredUploads, saveUploadedFile, saveUploadedImage } from "../../src/server/uploads";

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

  it("保存普通文件并返回展示元数据", async () => {
    const uploadDir = await mkdtemp(join(tmpdir(), "codex-web-upload-"));
    const saved = await saveUploadedFile({ uploadDir, bytes: Buffer.from("hello"), mimeType: "text/plain", originalName: "note.txt" });
    expect(saved.name).toBe("note.txt");
    expect(saved.path).not.toContain("note.txt");
    await expect(assertCanonicalRegularFile(saved.path, uploadDir)).resolves.toBe(saved.path);
  });

  it("拒绝空文件和图片误投", async () => {
    const uploadDir = await mkdtemp(join(tmpdir(), "codex-web-upload-"));
    await expect(saveUploadedFile({ uploadDir, bytes: Buffer.alloc(0), mimeType: "text/plain", originalName: "empty.txt" })).rejects.toThrow("文件不能为空");
    await expect(saveUploadedFile({ uploadDir, bytes: Buffer.from("x"), mimeType: "image/png", originalName: "a.png" })).rejects.toThrow("图片请使用图片上传入口");
  });

  it("拒绝目录、越界路径和符号链接", async () => {
    const uploadDir = await mkdtemp(join(tmpdir(), "codex-web-upload-"));
    const outsideDir = await mkdtemp(join(tmpdir(), "codex-web-outside-"));
    const outsideFile = join(outsideDir, "outside.txt");
    const linkPath = join(uploadDir, "linked.txt");
    const directoryPath = join(uploadDir, "folder");
    await writeFile(outsideFile, "outside");
    await mkdir(directoryPath);
    await symlink(outsideFile, linkPath, "file");
    await expect(assertCanonicalRegularFile(outsideFile, uploadDir)).rejects.toThrow("附件路径越界");
    await expect(assertCanonicalRegularFile(linkPath, uploadDir)).rejects.toThrow("附件不是普通文件");
    await expect(assertCanonicalRegularFile(directoryPath, uploadDir)).rejects.toThrow("附件不是普通文件");
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
