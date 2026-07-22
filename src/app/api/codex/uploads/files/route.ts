import { NextResponse } from "next/server";
import { getRuntimeConfig } from "../../../../../server/runtime";
import { isRequestAuthenticated } from "../../../../../server/auth";
import { audit } from "../../../../../server/security";
import { cleanupExpiredUploads, saveUploadedFile } from "../../../../../server/uploads";
import { MAX_FILE_SIZE } from "../../../../../shared/file-attachments";

export async function POST(request: Request): Promise<Response> {
  if (!isRequestAuthenticated(request)) return NextResponse.json({ ok: false }, { status: 401 });
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > MAX_FILE_SIZE + 1024 * 1024) {
    return NextResponse.json({ ok: false, error: "文件大小不能超过 20 MiB" }, { status: 400 });
  }
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) return NextResponse.json({ ok: false, error: "请选择文件" }, { status: 400 });
    const config = getRuntimeConfig();
    await cleanupExpiredUploads(config.uploadDir, { maxAgeMs: 24 * 60 * 60 * 1000 });
    const saved = await saveUploadedFile({ uploadDir: config.uploadDir, bytes: Buffer.from(await file.arrayBuffer()), mimeType: file.type, originalName: file.name });
    await audit("upload.file", { id: saved.id, path: saved.path, mimeType: saved.mimeType, size: saved.size });
    return NextResponse.json({ ok: true, file: saved });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "无法上传文件" }, { status: 400 });
  }
}
