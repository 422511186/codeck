import {
  audit,
  assertAllowedPath,
  badRequest,
  getAppServerGateway,
  nonEmptyString,
  ok,
  optionalString,
  optionalStrictStringArray,
  optionalStringRecord,
  readJsonRecord,
  serverError,
  unauthorized
} from "../../_route-helpers";
import { getRuntimeConfig } from "../../../../../server/runtime";

export async function POST(request: Request): Promise<Response> {
  const auth = unauthorized(request);
  if (auth) {
    return auth;
  }

  try {
    const body = await readJsonRecord(request);
    const classification = nonEmptyString(body.classification);
    if (!classification) {
      return badRequest("classification 不能为空");
    }

    const input = {
      classification,
      reason: optionalString(body.reason),
      threadId: optionalString(body.threadId),
      includeLogs: typeof body.includeLogs === "boolean" ? body.includeLogs : undefined,
      extraLogFiles: optionalStrictStringArray(body.extraLogFiles, "extraLogFiles")?.map((path) =>
        assertAllowedPath(path, "extraLogFiles", [getRuntimeConfig().uploadDir])
      ),
      tags: optionalStringRecord(body.tags)
    };

    await audit("feedback.upload", {
      classification,
      threadId: input.threadId,
      includeLogs: input.includeLogs ?? null,
      extraLogFileCount: input.extraLogFiles?.length ?? 0
    });
    const result = await getAppServerGateway().uploadFeedback(input);
    return ok({ result });
  } catch (error) {
    return serverError(error, "无法上传 feedback");
  }
}
