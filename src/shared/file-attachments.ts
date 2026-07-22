export const MAX_FILE_COUNT = 10;
export const MAX_FILE_SIZE = 20 * 1024 * 1024;
export const MAX_FILE_BYTES = 50 * 1024 * 1024;
export const MAX_FILE_NAME_LENGTH = 180;

export type FileReference = {
  id: string;
  name: string;
  path: string;
  mimeType: string;
  size: number;
};

export function sanitizeFileName(value: string): string {
  const cleaned = value.replace(/[\u0000-\u001f\u007f]/g, "").replace(/[\\/#:]/g, "_").trim();
  return (cleaned || "未命名文件").slice(0, MAX_FILE_NAME_LENGTH);
}

export function validateFileReferences(value: unknown, options: { allowUnknownSize?: boolean } = {}): FileReference[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new Error("fileReferences 必须是数组");
  if (value.length > MAX_FILE_COUNT) throw new Error(`普通文件最多 ${MAX_FILE_COUNT} 个`);
  let total = 0;
  const refs = value.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error("fileReferences 必须是对象数组");
    const candidate = item as Record<string, unknown>;
    if (typeof candidate.id !== "string" || !candidate.id.trim() || /[\u0000-\u001f\u007f]/.test(candidate.id) ||
      typeof candidate.name !== "string" || typeof candidate.path !== "string" || !candidate.path.trim() ||
      /[\u0000-\u001f\u007f]/.test(candidate.path) || typeof candidate.mimeType !== "string" || !candidate.mimeType.trim() ||
      /[\u0000-\u001f\u007f]/.test(candidate.mimeType) ||
      typeof candidate.size !== "number" || !Number.isSafeInteger(candidate.size) ||
      (options.allowUnknownSize ? candidate.size < 0 : candidate.size <= 0) || candidate.size > MAX_FILE_SIZE) {
      throw new Error("fileReferences 字段无效");
    }
    const name = sanitizeFileName(candidate.name);
    if (!name || name !== candidate.name || /[#\r\n]/.test(name)) throw new Error("文件名无效");
    total += candidate.size;
    return { id: candidate.id.trim(), name, path: candidate.path.trim(), mimeType: candidate.mimeType.trim(), size: candidate.size };
  });
  if (total > MAX_FILE_BYTES) throw new Error("普通文件总大小超过限制");
  return refs;
}

export function encodeFilesMentioned(text: string, files: FileReference[]): string {
  const body = text.trim();
  if (!files.length) return body;
  const lines = files.map((file) => `## ${sanitizeFileName(file.name).replace(/[#\r\n]/g, "_")}: ${file.path}`);
  return `# Files mentioned by the user:\n\n${lines.join("\n")}\n\n## My request for Codex:\n${body}`;
}

export function decodeFilesMentioned(text: string, uploadDir?: string): { text: string; fileReferences: FileReference[] } {
  const marker = "# Files mentioned by the user:\n\n";
  const requestMarker = "\n\n## My request for Codex:\n";
  if (!text.startsWith(marker)) return { text, fileReferences: [] };
  const split = text.indexOf(requestMarker, marker.length);
  if (split < 0) return { text, fileReferences: [] };
  const lines = text.slice(marker.length, split).split("\n");
  const refs: FileReference[] = [];
  const seenPaths = new Set<string>();
  for (const line of lines) {
    if (!line.startsWith("## ")) return { text, fileReferences: [] };
    const separator = line.indexOf(": ", 3);
    if (separator < 0) return { text, fileReferences: [] };
    const name = line.slice(3, separator);
    const path = line.slice(separator + 2);
    const normalizedPath = path.replace(/\\/g, "/");
    const fileName = normalizedPath.slice(normalizedPath.lastIndexOf("/") + 1);
    const id = fileName.replace(/\.[^.]+$/, "");
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
      return { text, fileReferences: [] };
    }
    const pathKey = normalizedPath.toLowerCase();
    if (seenPaths.has(pathKey)) return { text, fileReferences: [] };
    seenPaths.add(pathKey);
    if (uploadDir && !/^(?:[A-Za-z]:[\\/]|\/)/.test(path)) return { text, fileReferences: [] };
    if (uploadDir) {
      const root = uploadDir.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
      const candidate = path.replace(/\\/g, "/").toLowerCase();
      if (candidate !== root && !candidate.startsWith(`${root}/`)) return { text, fileReferences: [] };
    }
    refs.push({ id, name: sanitizeFileName(name), path, mimeType: "application/octet-stream", size: 0 });
  }
  return { text: text.slice(split + requestMarker.length), fileReferences: refs };
}
