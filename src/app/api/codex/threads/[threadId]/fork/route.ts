import { NextResponse } from "next/server";
import { getThreadModelLifecycleService } from "../../../../../../server/custom-models/runtime";
import { isRequestAuthenticated } from "../../../../../../server/auth";
import {
  audit,
  optionalStrictBoolean,
  optionalStrictNonEmptyString,
  readOptionalJsonRecord,
  RouteValidationError,
  serverError
} from "../../../_route-helpers";

type ForkResult = Awaited<ReturnType<ReturnType<typeof getThreadModelLifecycleService>["forkThread"]>>;

class ForkRejectedError extends Error {
  constructor(readonly cause: unknown) {
    super(cause instanceof Error ? cause.message : "Fork 前置条件不满足");
    this.name = "ForkRejectedError";
  }
}

class ForkUnresolvedError extends Error {
  readonly code = "FORK_UNRESOLVED" as const;
  constructor() {
    super("fork-unresolved：原 Fork 操作结果无法确认");
    this.name = "ForkUnresolvedError";
  }
}

type ForkOperation = {
  expiresAt: number;
  state: "pending" | "resolved" | "ambiguous";
  inFlight: Promise<ForkResult> | null;
  result?: ForkResult;
};

const FORK_OPERATION_TTL_MS = 10 * 60_000;
const MAX_FORK_OPERATIONS = 1_000;
const forkOperations = new Map<string, ForkOperation>();

export async function POST(
  request: Request,
  context: { params: Promise<{ threadId: string }> }
): Promise<Response> {
  if (!isRequestAuthenticated(request)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  try {
    const { threadId } = await context.params;
    const body = await readOptionalJsonRecord(request);
    const operationId = optionalStrictNonEmptyString(body.operationId, "operationId");
    const retryAmbiguousFork = optionalStrictBoolean(body.retryAmbiguousFork, "retryAmbiguousFork") ?? false;
    if (retryAmbiguousFork && !operationId) {
      throw new RouteValidationError("retryAmbiguousFork 需要 operationId");
    }
    const start = async (): Promise<ForkResult> => {
      try {
        await audit("thread.fork", { threadId, ...(operationId ? { operationId } : {}) });
      } catch (error) {
        throw new ForkRejectedError(error);
      }
      return getThreadModelLifecycleService().forkThread(threadId);
    };
    const thread = operationId
      ? await cachedForkOperation(`${threadId}\u0000${operationId}`, start, retryAmbiguousFork)
      : await start();
    return NextResponse.json({ ok: true, thread });
  } catch (error) {
    if (error instanceof ForkRejectedError) {
      return NextResponse.json(
        { ok: false, code: "FORK_REJECTED", error: error.message },
        { status: 502 }
      );
    }
    if (error instanceof ForkUnresolvedError) {
      return NextResponse.json(
        { ok: false, code: error.code, error: error.message },
        { status: 409 }
      );
    }
    return serverError(error, "无法 fork 会话");
  }
}

async function cachedForkOperation(
  key: string,
  start: () => Promise<ForkResult>,
  retryAmbiguousFork: boolean
): Promise<ForkResult> {
  purgeForkOperations();
  const existing = forkOperations.get(key);
  if (existing) {
    if (existing.result) return existing.result;
    if (existing.inFlight) return existing.inFlight;
    throw new ForkUnresolvedError();
  }
  if (retryAmbiguousFork) {
    throw new ForkUnresolvedError();
  }
  if (forkOperations.size >= MAX_FORK_OPERATIONS) {
    throw new ForkRejectedError(new Error("Fork operation cache 已满，请稍后重试"));
  }

  const operation: ForkOperation = {
    expiresAt: Number.POSITIVE_INFINITY,
    state: "pending",
    inFlight: null
  };
  let promise: Promise<ForkResult>;
  promise = start()
    .then((result) => {
      if (operation.inFlight === promise) {
        operation.state = "resolved";
        operation.result = result;
        operation.inFlight = null;
        operation.expiresAt = Date.now() + FORK_OPERATION_TTL_MS;
        return result;
      }
      return operation.result ?? operation.inFlight!;
    })
    .catch((error) => {
      if (operation.inFlight === promise) {
        if (error instanceof ForkRejectedError) {
          forkOperations.delete(key);
          operation.inFlight = null;
          operation.expiresAt = 0;
          throw error;
        }
        operation.state = "ambiguous";
        operation.inFlight = null;
        operation.expiresAt = Date.now() + FORK_OPERATION_TTL_MS;
        throw error;
      }
      return operation.result ?? operation.inFlight!;
    });
  operation.inFlight = promise;
  forkOperations.set(key, operation);
  return promise;
}

function purgeForkOperations(): void {
  const now = Date.now();
  for (const [key, operation] of forkOperations) {
    if (operation.expiresAt <= now) {
      forkOperations.delete(key);
    }
  }
}
