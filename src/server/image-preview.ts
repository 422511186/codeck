import { readFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
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
  const extension = extname(candidatePath).toLowerCase();
  const mimeType = imageTypes[extension];
  if (!mimeType) {
    throw new Error("只支持图片预览");
  }

  const config = getRuntimeConfig();
  const roots = normalizeWorkspaceRoots([...config.workspaceRoots, config.uploadDir]);
  const allowedPath = assertPathAllowed(candidatePath, roots);
  const bytes = await readFile(resolve(allowedPath));

  return { bytes, mimeType };
}
