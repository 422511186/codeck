import { NextResponse } from "next/server";
import { getAppServerGateway } from "../../../../../server/app-server/runtime";
import { isRequestAuthenticated } from "../../../../../server/auth";

const emptyDefaults = {
  model: null,
  modelProvider: null,
  reasoningEffort: null,
  reasoningSummary: null
};

export async function GET(request: Request): Promise<Response> {
  if (!isRequestAuthenticated(request)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  try {
    const settings = await getAppServerGateway().readModelDefaults();
    return NextResponse.json({ ok: true, settings });
  } catch {
    return NextResponse.json({ ok: true, settings: emptyDefaults });
  }
}
