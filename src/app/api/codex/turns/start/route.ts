import type { StartTurnInput } from "../../../../../server/app-server/client";
import type { MobileSkillReference } from "../../../../../shared/codex";
import { getRuntimeConfig } from "../../../../../server/runtime";
import {
  assertAllowedPath,
  audit,
  getAppServerGateway,
  isRecord,
  ok,
  optionalStrictNonEmptyString,
  optionalStrictNullableString,
  optionalStrictString,
  optionalStrictStringArray,
  readJsonRecord,
  requireNonEmptyString,
  RouteValidationError,
  serverError,
  unauthorized
} from "../../_route-helpers";

type StartTurnRouteResult = {
  turnId: string;
};

const START_TURN_CACHE_TTL_MS = 60_000;
const startTurnCache = new Map<string, { expiresAt: number; promise: Promise<StartTurnRouteResult> }>();

export async function POST(request: Request): Promise<Response> {
  const auth = unauthorized(request);
  if (auth) {
    return auth;
  }

  try {
    const body = await readJsonRecord(request);
    const threadId = requireNonEmptyString(body.threadId, "threadId");
    const text = requireNonEmptyString(body.text, "消息");

    const config = getRuntimeConfig();
    const imagePaths = optionalStrictStringArray(body.imagePaths, "imagePaths")?.map((imagePath) =>
      assertAllowedPath(imagePath, "imagePath", [config.uploadDir])
    );
    const skillReferences = normalizeSkillReferences(body.skillReferences);
    if (skillReferences.length) {
      await assertSkillReferencesAllowed(threadId, skillReferences);
    }
    const clientUserMessageId = optionalStrictNonEmptyString(body.clientUserMessageId, "clientUserMessageId");
    const model = optionalStrictNonEmptyString(body.model, "model");
    const reasoningEffort = optionalStrictNonEmptyString(body.reasoningEffort, "reasoningEffort");
    const reasoningSummary = normalizeReasoningSummary(body.reasoningSummary);
    const permissions = optionalStrictNullableString(body.permissions, "permissions");
    const approvalsReviewer = readApprovalsReviewer(body.approvalsReviewer);
    const additionalContext = readAdditionalContext(body.additionalContext);
    const collaborationMode = readCollaborationMode(body.collaborationMode);
    await audit("turn.start", {
      threadId,
      textLength: text.length,
      imageCount: imagePaths?.length || 0,
      skillCount: skillReferences.length,
      clientUserMessageId,
      model,
      reasoningEffort,
      reasoningSummary,
      permissions,
      approvalsReviewer,
      additionalContext,
      collaborationMode
    });
    const start = () => startTurnOnly({
      threadId,
      text,
      imagePaths,
      skillReferences,
      clientUserMessageId,
      model,
      reasoningEffort,
      reasoningSummary,
      permissions,
      approvalsReviewer,
      additionalContext,
      collaborationMode
    });
    const cacheKey = startTurnCacheKey(threadId, clientUserMessageId);
    const { turnId } = cacheKey ? await cachedStartTurn(cacheKey, start) : await start();

    return ok({ turnId });
  } catch (error) {
    return serverError(error, "无法发送消息");
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
  if (value === undefined) {
    return undefined;
  }

  const summary = optionalStrictString(value, "reasoningSummary");
  if (summary === "auto" || summary === "concise" || summary === "detailed" || summary === "none") {
    return summary;
  }

  throw new RouteValidationError("reasoningSummary 无效");
}

function normalizeSkillReferences(value: unknown): MobileSkillReference[] {
  if (value === undefined || value === null) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new RouteValidationError("skillReferences 必须是数组");
  }

  return value.map((item) => {
    if (typeof item !== "object" || item === null || Array.isArray(item)) {
      throw new RouteValidationError("skillReferences 必须是对象数组");
    }
    const candidate = item as { name?: unknown; path?: unknown };
    if (typeof candidate.name !== "string" || typeof candidate.path !== "string") {
      throw new RouteValidationError("skillReferences 必须包含 name 和 path");
    }
    return {
      name: candidate.name.trim(),
      path: candidate.path.trim()
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

function readApprovalsReviewer(value: unknown): StartTurnInput["approvalsReviewer"] {
  if (value === undefined || value === null) {
    return value;
  }

  if (value === "user" || value === "auto_review" || value === "guardian_subagent") {
    return value;
  }

  throw new RouteValidationError("approvalsReviewer 无效");
}

function readAdditionalContext(value: unknown): StartTurnInput["additionalContext"] {
  if (value === undefined || value === null) {
    return value;
  }

  if (!isRecord(value)) {
    throw new RouteValidationError("additionalContext 必须是对象");
  }

  return value as StartTurnInput["additionalContext"];
}

function readCollaborationMode(value: unknown): StartTurnInput["collaborationMode"] {
  if (value === undefined || value === null) {
    return value;
  }

  if (!isRecord(value) || typeof value.mode !== "string" || !isRecord(value.settings)) {
    throw new RouteValidationError("collaborationMode 无效");
  }

  return value as StartTurnInput["collaborationMode"];
}
