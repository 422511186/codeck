import { NextResponse } from "next/server";
import { getAppServerGateway } from "../../../../../server/app-server/runtime";
import { isRequestAuthenticated } from "../../../../../server/auth";
import { audit } from "../../../../../server/security";
import { readJsonRecord } from "../../_route-helpers";
import { assertConfigEdit } from "../config-write-policy";

export async function GET(request: Request): Promise<Response> {
  if (!isRequestAuthenticated(request)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  try {
    const result = await getAppServerGateway().readConfig();
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "无法读取全局配置" },
      { status: 502 }
    );
  }
}

export async function POST(request: Request): Promise<Response> {
  if (!isRequestAuthenticated(request)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  try {
    const edit = assertConfigEdit(await readJsonRecord(request));
    await audit("config.value.write", { keyPath: edit.keyPath });
    const result = await getAppServerGateway().writeConfigValue(edit.keyPath, edit.value);
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "无法写入全局配置" },
      { status: 400 }
    );
  }
}
