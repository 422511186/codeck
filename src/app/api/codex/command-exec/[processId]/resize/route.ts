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
  context: { params: Promise<{ processId: string }> }
): Promise<Response> {
  const auth = unauthorized(request);
  if (auth) {
    return auth;
  }

  try {
    const { processId } = await context.params;
    const body = await readJsonRecord(request);
    const cols = positiveInteger(body.cols, 80);
    const rows = positiveInteger(body.rows, 24);
    await audit("commandExec.resize", { processId, cols, rows });
    await getAppServerGateway().resizeCommandExecSession(processId, cols, rows);
    return ok();
  } catch (error) {
    return serverError(error, "无法调整 command exec 尺寸");
  }
}
