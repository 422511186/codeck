import { NextResponse } from "next/server";
import { isRequestAuthenticated } from "../../../../../server/auth";
import { readPreviewImage } from "../../../../../server/image-preview";

export async function GET(request: Request): Promise<Response> {
  if (!isRequestAuthenticated(request)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const url = new URL(request.url);
  const imagePath = url.searchParams.get("path");
  if (!imagePath) {
    return NextResponse.json({ ok: false, error: "path 不能为空" }, { status: 400 });
  }

  try {
    const image = await readPreviewImage(imagePath);
    const body = new Uint8Array(image.bytes).buffer;
    return new Response(body, {
      headers: {
        "content-type": image.mimeType,
        "cache-control": "private, max-age=300",
        "x-content-type-options": "nosniff"
      }
    });
  } catch {
    return NextResponse.json({ ok: false, error: "无法读取图片" }, { status: 404 });
  }
}
