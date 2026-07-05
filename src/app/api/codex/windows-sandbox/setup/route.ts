import {
  assertAllowedPath,
  audit,
  badRequest,
  getAppServerGateway,
  ok,
  readJsonRecord,
  serverError,
  unauthorized
} from "../../_route-helpers";

type WindowsSandboxSetupMode = "elevated" | "unelevated";

function isSetupMode(value: unknown): value is WindowsSandboxSetupMode {
  return value === "elevated" || value === "unelevated";
}

export async function POST(request: Request): Promise<Response> {
  const auth = unauthorized(request);
  if (auth) {
    return auth;
  }

  try {
    const body = await readJsonRecord(request);
    if (!isSetupMode(body.mode)) {
      return badRequest("mode 只能是 elevated 或 unelevated");
    }

    if (body.cwd !== undefined && typeof body.cwd !== "string") {
      return badRequest("cwd 必须是字符串");
    }

    const cwd = typeof body.cwd === "string" && body.cwd.trim() ? assertAllowedPath(body.cwd, "cwd") : null;
    await audit("windowsSandbox.setupStart", { mode: body.mode, cwd });
    const result = await getAppServerGateway().startWindowsSandboxSetup({ mode: body.mode, cwd });
    return ok({ result });
  } catch (error) {
    return serverError(error, "无法启动 Windows Sandbox 设置");
  }
}
