import {
  audit,
  getAppServerGateway,
  isRecord,
  ok,
  readJsonRecord,
  RouteValidationError,
  serverError,
  unauthorized
} from "../../../_route-helpers";

type ThreadGitInfoInput = { sha?: string | null; branch?: string | null; originUrl?: string | null };

export async function POST(
  request: Request,
  context: { params: Promise<{ threadId: string }> }
): Promise<Response> {
  const auth = unauthorized(request);
  if (auth) {
    return auth;
  }

  try {
    const { threadId } = await context.params;
    const body = await readJsonRecord(request);
    const gitInfo = readGitInfo(body.gitInfo);
    await audit("thread.metadata.update", { threadId, gitInfo: gitInfo ?? null });
    const thread = await getAppServerGateway().updateThreadMetadata({ threadId, gitInfo });
    return ok({ thread });
  } catch (error) {
    return serverError(error, "无法更新会话 metadata");
  }
}

function readGitInfo(value: unknown): ThreadGitInfoInput | null | undefined {
  if (value === undefined || value === null) {
    return value;
  }

  if (!isRecord(value)) {
    throw new RouteValidationError("gitInfo 必须是对象");
  }

  return {
    sha: readNullableStringField(value.sha, "gitInfo.sha"),
    branch: readNullableStringField(value.branch, "gitInfo.branch"),
    originUrl: readNullableStringField(value.originUrl, "gitInfo.originUrl")
  };
}

function readNullableStringField(value: unknown, fieldName: string): string | null | undefined {
  if (value === undefined || value === null) {
    return value;
  }

  if (typeof value !== "string") {
    throw new RouteValidationError(`${fieldName} 必须是字符串`);
  }

  return value;
}
