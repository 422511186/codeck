import {
  getAppServerGateway,
  ok,
  optionalStrictNullableString,
  readJsonRecord,
  serverError,
  unauthorized
} from "../../_route-helpers";

export async function POST(request: Request): Promise<Response> {
  const auth = unauthorized(request);
  if (auth) {
    return auth;
  }

  try {
    const body = await readJsonRecord(request);
    const value = optionalStrictNullableString(body.value, "value") ?? null;
    const result = await getAppServerGateway().mockExperimentalMethod(value);
    return ok({ result });
  } catch (error) {
    return serverError(error, "无法调用 mock 探针");
  }
}
