import { lstat, mkdir, readdir, realpath, rm, stat, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { extname, isAbsolute, join, relative, resolve } from "node:path";
import { MAX_FILE_SIZE, sanitizeFileName, type FileReference } from "../shared/file-attachments";

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

export type SavedFileUpload = FileReference;

function isPathInside(root: string, candidate: string): boolean {
  const relativePath = relative(root, candidate);
  return relativePath === "" || (relativePath.length > 0 && !relativePath.startsWith("..") && !isAbsolute(relativePath));
}

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
  if (!isPathInside(root, filePath)) {
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

export async function saveUploadedFile(input: {
  uploadDir: string;
  bytes: Buffer;
  mimeType: string;
  originalName: string;
}): Promise<SavedFileUpload> {
  if (!input.bytes.byteLength) throw new Error("文件不能为空");
  if (input.bytes.byteLength > MAX_FILE_SIZE) throw new Error("文件大小不能超过 20 MiB");
  const originalExtension = extname(input.originalName).toLowerCase();
  if (imageExtensions[input.mimeType] === originalExtension ||
    (input.mimeType === "image/jpeg" && originalExtension === ".jpeg")) {
    throw new Error("图片请使用图片上传入口");
  }
  const extension = /^\.[a-z0-9]{1,12}$/.test(originalExtension) ? originalExtension : "";
  const root = resolve(/*turbopackIgnore: true*/ input.uploadDir);
  await mkdir(/*turbopackIgnore: true*/ root, { recursive: true });
  const id = randomUUID();
  const filePath = resolve(/*turbopackIgnore: true*/ join(/*turbopackIgnore: true*/ root, `${id}${extension}`));
  if (!isPathInside(root, filePath)) throw new Error("上传路径越界");
  await writeFile(/*turbopackIgnore: true*/ filePath, input.bytes, { flag: "wx" });
  return {
    id,
    name: sanitizeFileName(input.originalName),
    path: filePath,
    mimeType: input.mimeType || "application/octet-stream",
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
    if (!isPathInside(root, filePath)) {
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

export async function inspectCanonicalRegularFile(filePath: string, uploadDir: string): Promise<{ path: string; size: number }> {
  const root = resolve(uploadDir);
  const canonicalRoot = await realpath(root);
  const candidate = resolve(filePath);
  if (!isPathInside(root, candidate)) throw new Error("附件路径越界");
  const info = await lstat(candidate);
  if (!info.isFile() || info.isSymbolicLink()) throw new Error("附件不是普通文件");
  const canonical = await realpath(candidate);
  if (!isPathInside(canonicalRoot, canonical)) throw new Error("附件路径越界");
  const canonicalInfo = await lstat(canonical);
  if (!canonicalInfo.isFile() || canonicalInfo.isSymbolicLink()) throw new Error("附件不是普通文件");
  return { path: canonical, size: canonicalInfo.size };
}

export async function assertCanonicalRegularFile(filePath: string, uploadDir: string): Promise<string> {
  return (await inspectCanonicalRegularFile(filePath, uploadDir)).path;
}
