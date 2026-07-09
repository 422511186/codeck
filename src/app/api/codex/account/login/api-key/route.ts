import {
  audit,
  getAppServerGateway,
  ok,
  readJsonRecord,
  requireNonEmptyString,
  serverError,
  unauthorized
} from "../../../_route-helpers";

export async function POST(request: Request): Promise<Response> {
  const auth = unauthorized(request);
  if (auth) {
    return auth;
  }

  try {
    const body = await readJsonRecord(request);
    const apiKey = requireNonEmptyString(body.apiKey, "apiKey");

    await audit("account.login.apiKey", { keyLength: apiKey.length });
    const login = await getAppServerGateway().loginWithApiKey(apiKey);
    return ok({ login });
  } catch (error) {
    return serverError(error, "无法使用 API Key 登录");
  }
}
