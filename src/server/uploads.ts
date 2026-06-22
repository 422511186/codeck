import { mkdir, readdir, rm, stat, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { extname, join, resolve } from "node:path";

const imageExtensions: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
  "image/gif": ".gif"
};

export type SavedUpload = {
  id: string;
  path: string;
  mimeType: string;
  size: number;
};

export async function saveUploadedImage(input: {
  uploadDir: string;
  bytes: Buffer;
  mimeType: string;
  originalName?: string;
}): Promise<SavedUpload> {
  const extension = imageExtensions[input.mimeType] || extname(input.originalName || "").toLowerCase();
  if (!Object.values(imageExtensions).includes(extension)) {
    throw new Error("只支持图片上传");
  }

  const root = resolve(/*turbopackIgnore: true*/ input.uploadDir);
  await mkdir(/*turbopackIgnore: true*/ root, { recursive: true });

  const id = randomUUID();
  const filePath = resolve(/*turbopackIgnore: true*/ join(/*turbopackIgnore: true*/ root, `${id}${extension}`));
  if (!filePath.startsWith(`${root}\\`) && filePath !== root) {
    throw new Error("上传路径越界");
  }

  await writeFile(/*turbopackIgnore: true*/ filePath, input.bytes);
  return {
    id,
    path: filePath,
    mimeType: input.mimeType,
    size: input.bytes.byteLength
  };
}

export async function cleanupExpiredUploads(
  uploadDir: string,
  options: { maxAgeMs: number; now?: number }
): Promise<number> {
  const root = resolve(/*turbopackIgnore: true*/ uploadDir);
  const now = options.now ?? Date.now();
  await mkdir(/*turbopackIgnore: true*/ root, { recursive: true });

  let removed = 0;
  for (const entry of await readdir(/*turbopackIgnore: true*/ root)) {
    const filePath = resolve(/*turbopackIgnore: true*/ join(/*turbopackIgnore: true*/ root, entry));
    if (!filePath.startsWith(`${root}\\`)) {
      continue;
    }

    const info = await stat(/*turbopackIgnore: true*/ filePath);
    if (!info.isFile()) {
      continue;
    }

    if (now - info.mtimeMs > options.maxAgeMs) {
      await rm(/*turbopackIgnore: true*/ filePath);
      removed += 1;
    }
  }

  return removed;
}
