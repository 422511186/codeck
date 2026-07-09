import type { MobileThreadSummary } from "../../../../../shared/codex";
import {
  assertAllowedPath,
  assertAllowedWorkspaceRoots,
  audit,
  getAppServerGateway,
  ok,
  optionalStrictNonEmptyString,
  optionalStrictNullableString,
  readJsonRecord,
  RouteValidationError,
  serverError,
  unauthorized
} from "../../_route-helpers";

type StartThreadRouteResult = {
  thread: MobileThreadSummary;
};

const START_THREAD_CACHE_TTL_MS = 60_000;
const startThreadCache = new Map<string, { expiresAt: number; promise: Promise<StartThreadRouteResult> }>();

export async function POST(request: Request): Promise<Response> {
  const auth = unauthorized(request);
  if (auth) {
    return auth;
  }

  try {
    const body = await readJsonRecord(request);
    const input = {
      cwd: body.cwd === undefined ? undefined : assertAllowedPath(body.cwd, "cwd"),
      workspaceRoots: assertAllowedWorkspaceRoots(body.workspaceRoots),
      model: optionalStrictNonEmptyString(body.model, "model"),
      permissions: optionalStrictNullableString(body.permissions, "permissions"),
      approvalsReviewer: readApprovalsReviewer(body.approvalsReviewer),
      clientOperationId: optionalStrictNonEmptyString(body.clientOperationId, "clientOperationId")
    };
    await audit("thread.start", {
      cwd: input.cwd,
      workspaceRoots: input.workspaceRoots,
      model: input.model,
      permissions: input.permissions,
      approvalsReviewer: input.approvalsReviewer,
      clientOperationId: input.clientOperationId
    });
    const start = () => startThreadOnly(input);
    const result = input.clientOperationId
      ? await cachedStartThread(input.clientOperationId, start)
      : await start();
    const thread = result.thread;
    return ok({ thread });
  } catch (error) {
    return serverError(error, "无法启动会话");
  }
}

async function startThreadOnly(input: {
  cwd?: string;
  workspaceRoots?: string[];
  model?: string;
  permissions?: string | null;
  approvalsReviewer?: "user" | "auto_review" | "guardian_subagent" | null;
}): Promise<StartThreadRouteResult> {
  const thread = await getAppServerGateway().startThread(input);
  return { thread };
}

async function cachedStartThread(
  cacheKey: string,
  start: () => Promise<StartThreadRouteResult>
): Promise<StartThreadRouteResult> {
  purgeExpiredStartThreads();
  const existing = startThreadCache.get(cacheKey);
  if (existing) {
    return existing.promise;
  }

  const promise = start()
    .then((result) => {
      const cached = startThreadCache.get(cacheKey);
      if (cached) {
        cached.expiresAt = Date.now() + START_THREAD_CACHE_TTL_MS;
      }
      return result;
    })
    .catch((error) => {
      startThreadCache.delete(cacheKey);
      throw error;
    });
  startThreadCache.set(cacheKey, { expiresAt: Number.POSITIVE_INFINITY, promise });
  return promise;
}

function purgeExpiredStartThreads(): void {
  const now = Date.now();
  for (const [key, entry] of startThreadCache) {
    if (entry.expiresAt <= now) {
      startThreadCache.delete(key);
    }
  }
}

function readApprovalsReviewer(value: unknown): "user" | "auto_review" | "guardian_subagent" | null | undefined {
  if (value === undefined || value === null) {
    return value;
  }

  if (value === "user" || value === "auto_review" || value === "guardian_subagent") {
    return value;
  }

  throw new RouteValidationError("approvalsReviewer 无效");
}
