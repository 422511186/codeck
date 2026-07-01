import { NextResponse } from "next/server";
import { getAppServerGateway } from "../../../../../server/app-server/runtime";
import type { StartTurnInput } from "../../../../../server/app-server/client";
import type { MobileSkillReference } from "../../../../../shared/codex";
import { isRequestAuthenticated } from "../../../../../server/auth";
import { getRuntimeConfig } from "../../../../../server/runtime";
import { assertRuntimePathAllowed, audit } from "../../../../../server/security";

type StartTurnRouteResult = {
  turnId: string;
};

const START_TURN_CACHE_TTL_MS = 60_000;
const startTurnCache = new Map<string, { expiresAt: number; promise: Promise<StartTurnRouteResult> }>();

export async function POST(request: Request): Promise<Response> {
  if (!isRequestAuthenticated(request)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      threadId?: string;
      text?: string;
      imagePaths?: string[];
      skillReferences?: unknown;
      clientUserMessageId?: string;
      model?: string;
      reasoningEffort?: string;
      reasoningSummary?: string;
      permissions?: string;
      additionalContext?: StartTurnInput["additionalContext"];
      collaborationMode?: StartTurnInput["collaborationMode"];
    };

    if (!body.threadId) {
      return NextResponse.json({ ok: false, error: "threadId 不能为空" }, { status: 400 });
    }

    if (!body.text?.trim()) {
      return NextResponse.json({ ok: false, error: "消息不能为空" }, { status: 400 });
    }

    const config = getRuntimeConfig();
    const imagePaths = body.imagePaths?.map((imagePath) => assertRuntimePathAllowed(imagePath, [config.uploadDir]));
    const skillReferences = normalizeSkillReferences(body.skillReferences);
    if (skillReferences.length) {
      await assertSkillReferencesAllowed(body.threadId, skillReferences);
    }
    await audit("turn.start", {
      threadId: body.threadId,
      textLength: body.text.length,
      imageCount: imagePaths?.length || 0,
      skillCount: skillReferences.length,
      clientUserMessageId: body.clientUserMessageId,
      model: body.model,
      reasoningEffort: body.reasoningEffort,
      reasoningSummary: body.reasoningSummary,
      permissions: body.permissions,
      additionalContext: body.additionalContext,
      collaborationMode: body.collaborationMode
    });
    const start = () => startTurnOnly({
      threadId: body.threadId!,
      text: body.text!,
      imagePaths,
      skillReferences,
      clientUserMessageId: body.clientUserMessageId,
      model: body.model,
      reasoningEffort: body.reasoningEffort,
      reasoningSummary: normalizeReasoningSummary(body.reasoningSummary),
      permissions: body.permissions,
      additionalContext: body.additionalContext,
      collaborationMode: body.collaborationMode
    });
    const cacheKey = startTurnCacheKey(body.threadId, body.clientUserMessageId);
    const { turnId } = cacheKey ? await cachedStartTurn(cacheKey, start) : await start();

    return NextResponse.json({ ok: true, turnId });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "无法发送消息" },
      { status: 502 }
    );
  }
}

async function startTurnOnly(input: StartTurnInput): Promise<StartTurnRouteResult> {
  const gateway = getAppServerGateway();
  const result = await gateway.startTurn(input);
  return { turnId: result.turnId };
}

async function cachedStartTurn(
  cacheKey: string,
  start: () => Promise<StartTurnRouteResult>
): Promise<StartTurnRouteResult> {
  purgeExpiredStartTurns();
  const existing = startTurnCache.get(cacheKey);
  if (existing) {
    return existing.promise;
  }

  const promise = start()
    .then((result) => {
      const cached = startTurnCache.get(cacheKey);
      if (cached) {
        cached.expiresAt = Date.now() + START_TURN_CACHE_TTL_MS;
      }
      return result;
    })
    .catch((error) => {
      startTurnCache.delete(cacheKey);
      throw error;
    });
  startTurnCache.set(cacheKey, { expiresAt: Number.POSITIVE_INFINITY, promise });
  return promise;
}

function purgeExpiredStartTurns(): void {
  const now = Date.now();
  for (const [key, entry] of startTurnCache) {
    if (entry.expiresAt <= now) {
      startTurnCache.delete(key);
    }
  }
}

function startTurnCacheKey(threadId: string, clientUserMessageId: string | undefined): string | null {
  return clientUserMessageId ? `${threadId}\u0001${clientUserMessageId}` : null;
}

function normalizeReasoningSummary(value: unknown): StartTurnInput["reasoningSummary"] {
  return value === "auto" || value === "concise" || value === "detailed" || value === "none"
    ? value
    : undefined;
}

function normalizeSkillReferences(value: unknown): MobileSkillReference[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item) => {
    const candidate = item as { name?: unknown; path?: unknown };
    return {
      name: typeof candidate.name === "string" ? candidate.name.trim() : "",
      path: typeof candidate.path === "string" ? candidate.path.trim() : ""
    };
  });
}

async function assertSkillReferencesAllowed(threadId: string, skillReferences: MobileSkillReference[]): Promise<void> {
  if (skillReferences.some((skill) => !skill.name || !skill.path)) {
    throw new Error("Skill 引用不能为空");
  }

  const gateway = getAppServerGateway();
  const thread = await gateway.readThreadSummary(threadId);
  const available = await gateway.listSkills({ enabledOnly: true, cwds: [thread.cwd] });
  const allowed = new Set(available.skills.map((skill) => `${skill.name}\u0001${skill.path}`));
  for (const skill of skillReferences) {
    if (!allowed.has(`${skill.name}\u0001${skill.path}`)) {
      throw new Error(`Skill 不可用：${skill.name || skill.path}`);
    }
  }
}
