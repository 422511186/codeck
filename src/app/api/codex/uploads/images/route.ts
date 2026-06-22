import { NextResponse } from "next/server";
import { getRuntimeConfig } from "../../../../../server/runtime";
import { isRequestAuthenticated } from "../../../../../server/auth";
import { cleanupExpiredUploads, saveUploadedImage } from "../../../../../server/uploads";

export async function POST(request: Request): Promise<Response> {
  if (!isRequestAuthenticated(request)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("image");
    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: "请选择图片" }, { status: 400 });
    }

    const config = getRuntimeConfig();
    await cleanupExpiredUploads(config.uploadDir, { maxAgeMs: 24 * 60 * 60 * 1000 });
    const saved = await saveUploadedImage({
      uploadDir: config.uploadDir,
      bytes: Buffer.from(await file.arrayBuffer()),
      mimeType: file.type,
      originalName: file.name
    });

    return NextResponse.json({ ok: true, image: saved });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "无法上传图片" },
      { status: 400 }
    );
  }
}
