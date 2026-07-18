import { lstat, readFile, realpath } from "node:fs/promises";
import { extname } from "node:path";
import { getRuntimeConfig } from "./runtime";
import { assertPathAllowed, normalizeWorkspaceRoots } from "./workspace-policy";

const imageTypes: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif"
};

export async function readPreviewImage(candidatePath: string): Promise<{ bytes: Buffer; mimeType: string }> {
  assertSupportedImagePath(candidatePath);

  const config = getRuntimeConfig();
  const roots = normalizeWorkspaceRoots([...config.workspaceRoots, config.uploadDir]);
  const lexicalPath = assertPathAllowed(candidatePath, roots);
  const canonicalRootResults = await Promise.allSettled(roots.map((root) => realpath(root.path)));
  const canonicalRootPaths = canonicalRootResults.flatMap((result) =>
    result.status === "fulfilled" ? [result.value] : []
  );
  const canonicalRoots = normalizeWorkspaceRoots(canonicalRootPaths);
  const canonicalPath = await realpath(lexicalPath);
  const allowedPath = assertPathAllowed(canonicalPath, canonicalRoots);
  const fileInfo = await lstat(allowedPath);
  if (!fileInfo.isFile()) {
    throw new Error("图片预览路径必须是普通文件");
  }
  const mimeType = assertSupportedImagePath(allowedPath);
  const bytes = await readFile(allowedPath);

  return { bytes, mimeType };
}

function assertSupportedImagePath(candidatePath: string): string {
  const mimeType = imageTypes[extname(candidatePath).toLowerCase()];
  if (!mimeType) {
    throw new Error("只支持图片预览");
  }
  return mimeType;
}
