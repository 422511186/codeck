import { NextResponse } from "next/server";
import { getAppServerGateway } from "../../../../../server/app-server/runtime";
import { isRequestAuthenticated } from "../../../../../server/auth";
import type { MobileThreadSummary } from "../../../../../shared/codex";
import {
  assertRuntimePathAllowed,
  assertRuntimeWorkspaceRootsAllowed,
  audit
} from "../../../../../server/security";

type StartThreadRouteResult = {
  thread: MobileThreadSummary;
};

const START_THREAD_CACHE_TTL_MS = 60_000;
const startThreadCache = new Map<string, { expiresAt: number; promise: Promise<StartThreadRouteResult> }>();

export async function POST(request: Request): Promise<Response> {
  if (!isRequestAuthenticated(request)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      cwd?: string;
      workspaceRoots?: string[];
      model?: string;
      permissions?: string | null;
      clientOperationId?: string;
    };
    const input = {
      ...body,
      cwd: body.cwd ? assertRuntimePathAllowed(body.cwd) : undefined,
      workspaceRoots: assertRuntimeWorkspaceRootsAllowed(body.workspaceRoots)
    };
    await audit("thread.start", {
      cwd: input.cwd,
      workspaceRoots: input.workspaceRoots,
      model: input.model,
      permissions: input.permissions,
      clientOperationId: body.clientOperationId
    });
    const start = () => startThreadOnly(input);
    const result = body.clientOperationId
      ? await cachedStartThread(body.clientOperationId, start)
      : await start();
    const thread = result.thread;
    return NextResponse.json({ ok: true, thread });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "无法启动会话" },
      { status: 502 }
    );
  }
}

async function startThreadOnly(input: {
  cwd?: string;
  workspaceRoots?: string[];
  model?: string;
  permissions?: string | null;
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
