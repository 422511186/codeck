import {
  audit,
  getAppServerGateway,
  ok,
  readJsonRecord,
  RouteValidationError,
  serverError,
  unauthorized
} from "../../../_route-helpers";

function positiveInteger(value: unknown, fallback: number): number {
  if (value === undefined) {
    return fallback;
  }

  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new RouteValidationError("尺寸必须是正整数");
  }

  return value;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ processHandle: string }> }
): Promise<Response> {
  const auth = unauthorized(request);
  if (auth) {
    return auth;
  }

  try {
    const { processHandle } = await context.params;
    const body = await readJsonRecord(request);
    const cols = positiveInteger(body.cols, 80);
    const rows = positiveInteger(body.rows, 24);
    await audit("process.resizePty", { processHandle, cols, rows });
    await getAppServerGateway().resizeProcessSession(processHandle, cols, rows);
    return ok();
  } catch (error) {
    return serverError(error, "无法调整终端尺寸");
  }
}
