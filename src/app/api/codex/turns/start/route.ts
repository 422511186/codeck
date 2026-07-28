import type { StartTurnInput } from "../../../../../server/app-server/client";
import { NextResponse } from "next/server";
import { getThreadModelLifecycleService } from "../../../../../server/custom-models/runtime";
import type { MobileSkillReference } from "../../../../../shared/codex";
import { validateFileReferences } from "../../../../../shared/file-attachments";
import { inspectCanonicalRegularFile } from "../../../../../server/uploads";
import { getRuntimeConfig } from "../../../../../server/runtime";
import {
  assertAllowedPath,
  audit,
  getAppServerGateway,
  isRecord,
  ok,
  optionalApprovalPolicy,
  optionalStrictBoolean,
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

class StartRejectedError extends Error {
  readonly code = "START_REJECTED" as const;
  constructor(readonly cause: unknown) {
    super(cause instanceof Error ? cause.message : "发送前置条件不满足");
    this.name = "StartRejectedError";
  }
}

const START_TURN_CACHE_TTL_MS = 10 * 60_000;
type StartTurnOperation = {
  expiresAt: number;
  bootId: string;
  payloadFingerprint: string;
  state: "pending" | "resolved" | "ambiguous";
  inFlight: Promise<StartTurnRouteResult> | null;
  result?: StartTurnRouteResult;
};

const startTurnCache = new Map<string, StartTurnOperation>();

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
    let fileReferences;
    try {
      fileReferences = validateFileReferences(body.fileReferences, { allowUnknownSize: true });
    } catch (error) {
      throw new RouteValidationError(error instanceof Error ? error.message : "fileReferences 无效");
    }
    const fileBytes = fileReferences.reduce((sum, file) => sum + file.size, 0);
    if (fileBytes > 50 * 1024 * 1024) {
      throw new RouteValidationError("普通文件总大小超过限制");
    }
    const clientUserMessageId = optionalStrictNonEmptyString(body.clientUserMessageId, "clientUserMessageId");
    const startBootId = optionalStrictNonEmptyString(body.startBootId, "startBootId");
    const retryAmbiguousStart = optionalStrictBoolean(body.retryAmbiguousStart, "retryAmbiguousStart") ?? false;
    if (retryAmbiguousStart && !clientUserMessageId) {
      throw new RouteValidationError("retryAmbiguousStart 需要 clientUserMessageId");
    }
    const model = optionalStrictNonEmptyString(body.model, "model");
    const reasoningEffort = optionalStrictNonEmptyString(body.reasoningEffort, "reasoningEffort");
    const reasoningSummary = normalizeReasoningSummary(body.reasoningSummary);
    const permissions = optionalStrictNullableString(body.permissions, "permissions");
    const approvalPolicy = optionalApprovalPolicy(body.approvalPolicy);
    const approvalsReviewer = readApprovalsReviewer(body.approvalsReviewer);
    const additionalContext = readAdditionalContext(body.additionalContext);
    const collaborationMode = readCollaborationMode(body.collaborationMode);
    const auditDetail = {
      threadId,
      textLength: text.length,
      imageCount: imagePaths?.length || 0,
      fileCount: fileReferences.length,
      fileBytes,
      skillCount: skillReferences.length,
      clientUserMessageId,
      model,
      reasoningEffort,
      reasoningSummary,
      permissions,
      approvalPolicy,
      approvalsReviewer,
      additionalContext,
      collaborationMode
    };
    const normalizedStartInput: StartTurnInput = {
      threadId,
      text,
      imagePaths,
      skillReferences,
      fileReferences,
      clientUserMessageId,
      model,
      reasoningEffort,
      reasoningSummary,
      permissions,
      approvalPolicy,
      approvalsReviewer,
      additionalContext,
      collaborationMode
    };
    const start = async () => {
      let preparedFileReferences: NonNullable<StartTurnInput["fileReferences"]>;
      try {
        await audit("turn.start", auditDetail);
        await getThreadModelLifecycleService().ensureThreadReady(threadId);
        preparedFileReferences = await prepareFileReferences(fileReferences, config.uploadDir);
        if (skillReferences.length) {
          await assertSkillReferencesAllowed(threadId, skillReferences);
        }
      } catch (error) {
        throw new StartRejectedError(error);
      }
      return startTurnOnly({
        ...normalizedStartInput,
        fileReferences: preparedFileReferences
      });
    };
    const cacheKey = startTurnCacheKey(threadId, clientUserMessageId);
    const gateway = getAppServerGateway();
    const bootId = typeof gateway.getTimelineBootId === "function" ? gateway.getTimelineBootId() : "legacy-gateway";
    const payloadFingerprint = startTurnPayloadFingerprint(normalizedStartInput);
    const { turnId } = cacheKey
      ? await cachedStartTurn(
          cacheKey,
          bootId,
          payloadFingerprint,
          start,
          () => findTurnByClientUserMessageId(threadId, clientUserMessageId!),
          { retryAmbiguousStart, startBootId }
        )
      : await start();

    return ok({ turnId });
  } catch (error) {
    if (error instanceof StartRejectedError) {
      const cause = typeof error.cause === "object" && error.cause !== null
        ? error.cause as { code?: unknown; httpStatus?: unknown; result?: Record<string, unknown> }
        : null;
      const isSwitchRecoveryFailure = cause?.code === "SWITCH_RECOVERY_FAILED" && cause.httpStatus === 500;
      return NextResponse.json(
        {
          ok: false,
          code: "START_REJECTED",
          error: error.message,
          ...(isSwitchRecoveryFailure
            ? { recoveryCode: cause.code, ...(cause.result ?? {}) }
            : {})
        },
        { status: isSwitchRecoveryFailure ? 500 : 502 }
      );
    }
    const structured = typeof error === "object" && error !== null
      ? error as { code?: unknown; httpStatus?: unknown; result?: Record<string, unknown> }
      : null;
    if (structured?.code === "SWITCH_RECOVERY_FAILED" && structured.httpStatus === 500) {
      return NextResponse.json(
        { ok: false, code: structured.code, ...(structured.result ?? {}) },
        { status: 500 }
      );
    }
    return serverError(error, "无法发送消息");
  }
}

async function startTurnOnly(input: StartTurnInput): Promise<StartTurnRouteResult> {
  const gateway = getAppServerGateway();
  const result = await gateway.startTurn(input);
  return { turnId: result.turnId };
}

async function prepareFileReferences(
  fileReferences: NonNullable<StartTurnInput["fileReferences"]>,
  uploadDir: string
): Promise<NonNullable<StartTurnInput["fileReferences"]>> {
  return Promise.all(fileReferences.map(async (file) => {
    try {
      const inspected = await inspectCanonicalRegularFile(file.path, uploadDir);
      if (file.size > 0 && inspected.size !== file.size) {
        throw new Error("附件大小不一致");
      }
      return { ...file, path: inspected.path, size: inspected.size };
    } catch {
      throw new RouteValidationError("附件已过期或不可访问，请重新上传");
    }
  }));
}

async function cachedStartTurn(
  cacheKey: string,
  bootId: string,
  payloadFingerprint: string,
  start: () => Promise<StartTurnRouteResult>,
  recover: () => Promise<StartTurnRouteResult | null>,
  options: { retryAmbiguousStart: boolean; startBootId?: string }
): Promise<StartTurnRouteResult> {
  purgeExpiredStartTurns();
  const existing = startTurnCache.get(cacheKey);
  if (existing) {
    if (existing.payloadFingerprint !== payloadFingerprint) {
      throw new Error("clientUserMessageId payload 不一致");
    }
    if (existing.bootId !== bootId) {
      return recoverAmbiguousStart(existing, bootId, recover);
    }
    if (existing.result) {
      return existing.result;
    }
    if (existing.inFlight) {
      return existing.inFlight;
    }
    return recoverAmbiguousStart(existing, bootId, recover);
  }

  if (options.retryAmbiguousStart) {
    const operation: StartTurnOperation = {
      expiresAt: Date.now() + START_TURN_CACHE_TTL_MS,
      bootId: options.startBootId ?? bootId,
      payloadFingerprint,
      state: "ambiguous",
      inFlight: null
    };
    startTurnCache.set(cacheKey, operation);
    return recoverAmbiguousStart(operation, bootId, recover);
  }

  const operation: StartTurnOperation = {
    expiresAt: Number.POSITIVE_INFINITY,
    bootId,
    payloadFingerprint,
    state: "pending",
    inFlight: null
  };
  let promise: Promise<StartTurnRouteResult>;
  promise = start()
    .then((result) => {
      if (operation.inFlight === promise) {
        operation.state = "resolved";
        operation.result = result;
        operation.inFlight = null;
        operation.expiresAt = Date.now() + START_TURN_CACHE_TTL_MS;
        return result;
      }
      return currentStartTurnResult(operation, promise);
    })
    .catch((error) => {
      if (operation.inFlight === promise) {
        if (error instanceof StartRejectedError) {
          startTurnCache.delete(cacheKey);
          operation.inFlight = null;
          operation.expiresAt = 0;
          throw error;
        }
        operation.state = "ambiguous";
        operation.inFlight = null;
        operation.expiresAt = Date.now() + START_TURN_CACHE_TTL_MS;
        throw error;
      }
      return currentStartTurnResult(operation, promise);
    });
  operation.inFlight = promise;
  startTurnCache.set(cacheKey, operation);
  return promise;
}

function currentStartTurnResult(
  operation: StartTurnOperation,
  stalePromise: Promise<StartTurnRouteResult>
): Promise<StartTurnRouteResult> | StartTurnRouteResult {
  if (operation.result) {
    return operation.result;
  }
  if (operation.inFlight && operation.inFlight !== stalePromise) {
    return operation.inFlight;
  }
  throw new Error("ambiguous-start-unresolved：原发送动作已被新的恢复流程取代，但尚无可确认结果");
}

function recoverAmbiguousStart(
  operation: StartTurnOperation,
  currentBootId: string,
  recover: () => Promise<StartTurnRouteResult | null>
): Promise<StartTurnRouteResult> {
  const previousBootId = operation.bootId;
  operation.bootId = currentBootId;
  operation.result = undefined;
  operation.state = "ambiguous";
  let recoveryPromise: Promise<StartTurnRouteResult>;
  recoveryPromise = recover()
    .then((result) => {
      if (!result) {
        const reason = previousBootId === currentBootId
          ? "尚无法确认原发送动作是否已创建 turn"
          : "服务已重启，无法确认原发送动作是否已创建 turn";
        throw new Error(`ambiguous-start-unresolved：${reason}`);
      }
      if (operation.inFlight === recoveryPromise) {
        operation.state = "resolved";
        operation.result = result;
        operation.expiresAt = Date.now() + START_TURN_CACHE_TTL_MS;
        return result;
      }
      return currentStartTurnResult(operation, recoveryPromise);
    })
    .catch((error) => {
      if (operation.inFlight === recoveryPromise) {
        operation.state = "ambiguous";
        operation.expiresAt = Date.now() + START_TURN_CACHE_TTL_MS;
        throw error;
      }
      return currentStartTurnResult(operation, recoveryPromise);
    })
    .finally(() => {
      if (operation.inFlight === recoveryPromise) {
        operation.inFlight = null;
      }
    });
  operation.inFlight = recoveryPromise;
  return recoveryPromise;
}

async function findTurnByClientUserMessageId(
  threadId: string,
  clientUserMessageId: string
): Promise<StartTurnRouteResult | null> {
  const gateway = getAppServerGateway();
  let page: Awaited<ReturnType<typeof gateway.listThreadTurns>>;
  try {
    page = await gateway.listThreadTurns({ threadId, limit: 50 });
  } catch {
    return null;
  }
  const turnIds = new Set(
    page.items.flatMap((item) =>
      item.role === "user" &&
      item.clientUserMessageId === clientUserMessageId &&
      typeof item.turnId === "string" &&
      item.turnId
        ? [item.turnId]
        : []
    )
  );
  return turnIds.size === 1 ? { turnId: [...turnIds][0]! } : null;
}

function startTurnPayloadFingerprint(input: StartTurnInput): string {
  return JSON.stringify({
    text: input.text,
    imagePaths: input.imagePaths ?? [],
    skillReferences: input.skillReferences ?? [],
    fileReferences: [...(input.fileReferences ?? [])]
      .sort((left, right) => `${left.id}\u0000${left.path}`.localeCompare(`${right.id}\u0000${right.path}`)),
    model: input.model ?? null,
    reasoningEffort: input.reasoningEffort ?? null,
    reasoningSummary: input.reasoningSummary ?? null,
    permissions: input.permissions ?? null,
    approvalPolicy: input.approvalPolicy ?? null,
    approvalsReviewer: input.approvalsReviewer ?? null,
    additionalContext: input.additionalContext ?? null,
    collaborationMode: input.collaborationMode ?? null
  });
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
