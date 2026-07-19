import type { MobileThreadSummary } from "../../../../../shared/codex";
import type { ModelSelection } from "../../../../../shared/custom-models";
import { NextResponse } from "next/server";
import { getThreadModelLifecycleService } from "../../../../../server/custom-models/runtime";
import {
  assertAllowedPath,
  assertAllowedWorkspaceRoots,
  audit,
  ok,
  optionalApprovalPolicy,
  optionalStrictNonEmptyString,
  optionalStrictNullableString,
  readJsonRecord,
  RouteValidationError,
  serverError,
  unauthorized
} from "../../_route-helpers";
import { readModelSelection } from "../[threadId]/model/_helpers";

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
    if (Object.hasOwn(body, "model")) {
      throw new RouteValidationError("model 不能用于创建会话，请使用 modelSelection");
    }
    const modelSelection = body.modelSelection === undefined
      ? undefined
      : readModelSelection(body.modelSelection, "modelSelection");
    const catalogRevision = readCatalogRevision(body.catalogRevision, modelSelection);
    const input = {
      cwd: body.cwd === undefined ? undefined : assertAllowedPath(body.cwd, "cwd"),
      workspaceRoots: assertAllowedWorkspaceRoots(body.workspaceRoots),
      permissions: optionalStrictNullableString(body.permissions, "permissions"),
      approvalPolicy: optionalApprovalPolicy(body.approvalPolicy),
      approvalsReviewer: readApprovalsReviewer(body.approvalsReviewer),
      clientOperationId: optionalStrictNonEmptyString(body.clientOperationId, "clientOperationId")
    };
    await audit("thread.start", {
      cwd: input.cwd,
      workspaceRoots: input.workspaceRoots,
      modelSelection,
      catalogRevision,
      permissions: input.permissions,
      approvalPolicy: input.approvalPolicy,
      approvalsReviewer: input.approvalsReviewer,
      clientOperationId: input.clientOperationId
    });
    const start = () => startThreadOnly(input, modelSelection, catalogRevision);
    const result = input.clientOperationId
      ? await cachedStartThread(input.clientOperationId, start)
      : await start();
    const thread = result.thread;
    return ok({ thread });
  } catch (error) {
    const structured = typeof error === "object" && error !== null
      ? error as { httpStatus?: unknown; code?: unknown; latestCatalog?: unknown; message?: unknown }
      : null;
    if (structured?.httpStatus === 409 && typeof structured.code === "string") {
      return NextResponse.json(
        {
          ok: false,
          code: structured.code,
          error: error instanceof Error ? error.message : "模型选择已失效",
          catalog: structured.latestCatalog ?? null
        },
        { status: 409 }
      );
    }
    return serverError(error, "无法启动会话");
  }
}

async function startThreadOnly(input: {
  cwd?: string;
  workspaceRoots?: string[];
  permissions?: string | null;
  approvalPolicy?: "untrusted" | "on-request" | "never" | null;
  approvalsReviewer?: "user" | "auto_review" | "guardian_subagent" | null;
  clientOperationId?: string;
}, modelSelection?: ModelSelection, catalogRevision?: number): Promise<StartThreadRouteResult> {
  const { clientOperationId: _clientOperationId, ...startInput } = input;
  const thread = await getThreadModelLifecycleService().startThread(
    startInput,
    modelSelection,
    catalogRevision
  );
  return { thread };
}

function readCatalogRevision(value: unknown, selection: ModelSelection | undefined): number | undefined {
  if (!selection) {
    if (value !== undefined) {
      throw new RouteValidationError("没有 modelSelection 时不能提供 catalogRevision");
    }
    return undefined;
  }
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new RouteValidationError("catalogRevision 必须是非负安全整数");
  }
  return value as number;
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
