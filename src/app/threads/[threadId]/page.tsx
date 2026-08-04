"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  codex,
  type ModelSwitchApiResult,
  type UpdateThreadSettingsInput
} from "../../../web/api/endpoints";
import { ApiError } from "../../../web/api/client";
import { createRequestCoordinator, isRequestAbort } from "../../../web/api/requestCoordinator";
import { useStore, type ThreadNotice } from "../../../web/state/store";
import { hasVisibleTurnOutput, rollbackMetadataForEntry, timelineItemToEntry, type TimelineEntry } from "../../../web/state/timeline";
import { mergeTimelineEntryMetadata } from "../../../web/state/timeline-engine";
import { Timeline } from "../../../web/components/Timeline";
import { PlanBar } from "../../../web/components/cards/PlanBar";
import { ChatInput } from "../../../web/components/ChatInput";
import { UnifiedModelPicker } from "../../../web/components/UnifiedModelPicker";
import { ReasoningEffortPicker } from "../../../web/components/ReasoningEffortPicker";
import { ReconnectStatus } from "../../../web/components/ReconnectStatus";
import { ThreadNotices } from "../../../web/components/ThreadNotices";
import {
  extractLegacyWarningNotices,
  repairReconstructedTimelineEntries,
  threadDetailEntries
} from "../../../web/state/timeline-adapter";
import {
  DEFAULT_COLLABORATION_MODEL,
  collaborationModeForChatMode,
  type ApprovalPolicy,
  type ApprovalsReviewer,
  type ChatMode,
  type FileReference,
  type PendingServerRequest,
  type PermissionSelection,
  type SkillReference,
  type ThreadDetail,
  type ThreadSummary,
  type ThreadGoal
} from "../../../web/api/types";
import {
  loadJson,
  removeKey,
  saveJson,
  threadModeKey,
  threadPermissionProfileKey
} from "../../../web/storage/localStore";
import { setDraft } from "../../../web/storage/drafts";
import { getContextUsage, type ContextUsageSnapshot } from "../../../web/storage/contextUsage";
import { settingsStore } from "../../../web/storage/settings";
import { invalidateTimelineEventThread } from "../../../web/events/client";
import { repairWindowFrom, type HistoryStamp } from "../../../shared/timeline-protocol";
import type {
  ModelInputModality,
  ModelSelection,
  ThreadModelStateView,
  UnifiedModelCatalog
} from "../../../shared/custom-models";
import {
  captureTimelineDomScrollAnchor,
  restoreTimelineDomScrollAnchor
} from "../../../web/state/timeline-scroll";

const EMPTY_ENTRIES: TimelineEntry[] = [];
const EMPTY_APPROVALS: PendingServerRequest[] = [];
const EMPTY_PLAN: Array<{ text: string; completed: boolean }> = [];
const EMPTY_NOTICES: ThreadNotice[] = [];
const DEFAULT_MODEL_INPUT_MODALITIES: ModelInputModality[] = ["text"];
const ACTIVE_THREAD_SUMMARY_POLL_DELAY_MS = 3_000;
const SNAPSHOT_REPAIR_RETRY_DELAY_MS = 3_000;
const MAX_COMPLETION_REPAIR_ATTEMPTS = 4;
const MAX_INITIAL_BASELINE_REPAIR_ATTEMPTS = 3;
const DEFAULT_COMPOSER_HEIGHT = 144;
const COMPACTING_CONTEXT_TEXT = "正在压缩上下文…";
const FORK_ACTION_SESSION_PREFIX = "codex-web:fork-action:";
const forkActionAttemptOwners = new Map<string, symbol>();

type SnapshotRepairRetryInput = {
  reason: "turn-completed" | "summary-idle" | "mutation-retry";
  turnId?: string;
  generation?: number;
};

type ForkActionOperation = {
  forkOperationId: string;
  rollbackOperationId: string;
  forkState: "pending" | "ambiguous" | "resolved";
  forkedThread?: ThreadDetail;
  forkedThreadId?: string;
  needsForkRefresh?: boolean;
};

export default function ThreadPage(): JSX.Element {
  const params = useParams<{ threadId: string }>();
  const router = useRouter();
  const threadId = String(params?.threadId ?? "");

  const ensureThread = useStore((s) => s.ensureThread);
  const setThreadEntries = useStore((s) => s.setThreadEntries);
  const mergeThreadEntries = useStore((s) => s.mergeThreadEntries);
  const replaceLatestWindow = useStore((s) => s.replaceLatestWindow);
  const prependEntries = useStore((s) => s.prependEntries);
  const appendEntries = useStore((s) => s.appendEntries);
  const upsertThreadNotice = useStore((s) => s.upsertThreadNotice);
  const dismissThreadNotice = useStore((s) => s.dismissThreadNotice);
  const replaceOrAddEntry = useStore((s) => s.replaceOrAddEntry);
  const removeEntry = useStore((s) => s.removeEntry);
  const setMode = useStore((s) => s.setMode);
  const setModel = useStore((s) => s.setModel);
  const setModelState = useStore((s) => s.setModelState);
  const beginModelSwitch = useStore((s) => s.beginModelSwitch);
  const applyModelSwitchResult = useStore((s) => s.applyModelSwitchResult);
  const clearModelSwitchPending = useStore((s) => s.clearModelSwitchPending);
  const setPermissionProfile = useStore((s) => s.setPermissionProfile);
  const setRuntimePermissionProfile = useStore((s) => s.setRuntimePermissionProfile);
  const setContextUsage = useStore((s) => s.setContextUsage);
  const setThreadStatus = useStore((s) => s.setThreadStatus);
  const setActiveTurnId = useStore((s) => s.setActiveTurnId);
  const bindLocalUserMessageTurn = useStore((s) => s.bindLocalUserMessageTurn);
  const setTimelineGeneration = useStore((s) => s.setTimelineGeneration);
  const setAuthoritativeTurnManifest = useStore((s) => s.setAuthoritativeTurnManifest);
  const registerAuthoritativeTurn = useStore((s) => s.registerAuthoritativeTurn);
  const invalidateTimelineDelivery = useStore((s) => s.invalidateTimelineDelivery);
  const markTurnInterrupted = useStore((s) => s.markTurnInterrupted);
  const markTurnDeleted = useStore((s) => s.markTurnDeleted);
  const setActiveThread = useStore((s) => s.setActiveThread);
  const requestSnapshotRepair = useStore((s) => s.requestSnapshotRepair);
  const clearSnapshotRepair = useStore((s) => s.clearSnapshotRepair);
  const terminateFinalReconcile = useStore((s) => s.terminateFinalReconcile);
  const setPendingRequests = useStore((s) => s.setPendingRequests);
  const resolvePendingRequest = useStore((s) => s.resolvePendingRequest);
  const threadRunning = useStore((s) => s.threads[threadId]?.running ?? false);
  const threadStatus = useStore((s) => s.threads[threadId]?.status ?? null);
  const threadActiveTurnId = useStore((s) => s.threads[threadId]?.activeTurnId ?? null);
  const threadMode = useStore((s) => s.threads[threadId]?.mode ?? "build");
  const threadModel = useStore((s) => s.threads[threadId]?.model ?? null);
  const threadModelEffort = useStore((s) => s.threads[threadId]?.modelEffort ?? null);
  const threadModelSelection = useStore((s) => s.threads[threadId]?.modelSelection ?? null);
  const threadModelBindingVersion = useStore((s) => s.threads[threadId]?.modelBindingVersion ?? null);
  const threadModelSourceUpdatedAt = useStore((s) => s.threads[threadId]?.modelSourceUpdatedAt ?? null);
  const threadModelContextWindow = useStore((s) => s.threads[threadId]?.modelContextWindow ?? null);
  const threadModelInputModalities = useStore(
    (s) => s.threads[threadId]?.modelInputModalities ?? DEFAULT_MODEL_INPUT_MODALITIES
  );
  const threadModelSwitchStatus = useStore((s) => s.threads[threadId]?.modelSwitchStatus ?? "idle");
  const threadPermissionProfileId = useStore((s) => s.threads[threadId]?.permissionProfileId);
  const threadApprovalPolicy = useStore((s) => s.threads[threadId]?.approvalPolicy);
  const threadApprovalsReviewer = useStore((s) => s.threads[threadId]?.approvalsReviewer);
  const threadContextUsage = useStore((s) => s.threads[threadId]?.contextUsage ?? null);
  const threadNotices = useStore((s) => s.threads[threadId]?.notices ?? EMPTY_NOTICES);
  const repairRequestedAt = useStore((s) => s.threads[threadId]?.repairRequestedAt ?? null);
  const hasCachedEntries = useStore((s) => Boolean(s.threads[threadId]?.entries.length));
  const compactCompletionSeen = useStore((s) => threadHasCompactCompletion(s.threads[threadId]));
  const repairRequest = useStore((s) => s.threads[threadId]?.repairRequest ?? null);
  const wsState = useStore((s) => s.wsState);
  const webSettings = settingsStore.get();

  const [detail, setDetail] = useState<ThreadDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [initialLoadAttempt, setInitialLoadAttempt] = useState(0);
  const [showSheet, setShowSheet] = useState(false);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [showReasoningPicker, setShowReasoningPicker] = useState(false);
  const [showPermissionPicker, setShowPermissionPicker] = useState(false);
  const [serverDefaults, setServerDefaults] = useState<{
    model: string | null;
    reasoningEffort: string | null;
    reasoningSummary: string | null;
  }>({
    model: null,
    reasoningEffort: null,
    reasoningSummary: null
  });
  const [modelCatalog, setModelCatalog] = useState<UnifiedModelCatalog | null>(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const [compactOpen, setCompactOpen] = useState(false);
  const [compactPending, setCompactPending] = useState(false);
  const [archiveToast, setArchiveToast] = useState<{ visible: boolean } | null>(null);
  const [showJumpLatest, setShowJumpLatest] = useState(false);
  const [draftOverride, setDraftOverride] = useState<{ threadId: string; text: string; version: number; fileReferences?: FileReference[] } | null>(null);
  const [goalEditorOpen, setGoalEditorOpen] = useState(false);
  const [contextUsageOpen, setContextUsageOpen] = useState(false);
  const [composerHeight, setComposerHeight] = useState(DEFAULT_COMPOSER_HEIGHT);
  const [modelRecoveryPending, setModelRecoveryPending] = useState(false);

  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const atBottomRef = useRef(true);
  const pendingSendKeysRef = useRef(new Set<string>());
  const mutationEpochRef = useRef(0);
  const requestCoordinatorRef = useRef(createRequestCoordinator());
  const invalidatedRepairSignalsRef = useRef(new Set<string>());
  const loadingPageCursorsRef = useRef(new Set<string>());
  const historyPageLoadingRef = useRef(false);
  const pendingSettingsRef = useRef<UpdateThreadSettingsInput | null>(null);
  const settingsFlushRef = useRef<Promise<void> | null>(null);
  const compactActionPendingRef = useRef(false);
  const streamDisconnectedRepairKeysRef = useRef(new Set<string>());
  const repairRetryTimerRef = useRef<number | null>(null);
  const completionRepairAttemptsRef = useRef(new Map<string, number>());
  const initialBaselineRepairAttemptsRef = useRef(new Map<string, number>());
  const requestTokenSequenceRef = useRef(0);
  const activeRepairTokenRef = useRef<number | null>(null);
  const rollbackOperationIdsRef = useRef(new Map<string, string>());
  const forkActionOperationsRef = useRef(new Map<string, ForkActionOperation>());
  const destructiveActionKeysRef = useRef(new Set<string>());

  const configuredModel = threadModel ?? detail?.model ?? appServerDefaultModel(webSettings.defaultModel);
  const effectiveModel = configuredModel ?? serverDefaults.model ?? DEFAULT_COLLABORATION_MODEL;
  const configuredReasoningEffort = threadModelEffort ?? detail?.reasoningEffort ?? null;
  const effectiveReasoningEffort = configuredReasoningEffort ?? serverDefaults.reasoningEffort ?? null;
  const effectiveReasoningSummary = serverDefaults.reasoningSummary ?? "detailed";
  const currentModelState = detail?.modelState ?? modelStateFromCurrentThread({
    selection: threadModelSelection,
    model: effectiveModel,
    reasoningEffort: effectiveReasoningEffort,
    bindingVersion: threadModelBindingVersion,
    sourceUpdatedAt: threadModelSourceUpdatedAt,
    contextWindow: threadModelContextWindow,
    inputModalities: threadModelInputModalities,
    catalog: modelCatalog
  });
  const detailPermissionProfileId =
    detail && "activePermissionProfile" in detail
      ? detail.activePermissionProfile?.id ?? null
      : undefined;
  const detailApprovalsReviewer =
    detail && "approvalsReviewer" in detail
      ? detail.approvalsReviewer ?? null
      : undefined;
  const detailApprovalPolicy =
    detail && "approvalPolicy" in detail
      ? detail.approvalPolicy ?? null
      : undefined;
  const effectivePermissionPayload = resolveEffectivePermissionPayload({
    localProfileId: threadPermissionProfileId,
    localApprovalPolicy: threadApprovalPolicy,
    localApprovalsReviewer: threadApprovalsReviewer,
    detailProfileId: detailPermissionProfileId,
    detailApprovalPolicy,
    detailApprovalsReviewer
  });

  useEffect(() => {
    if (!threadId || threadContextUsage) return;
    const cached = getContextUsage(threadId);
    if (cached) {
      setContextUsage(threadId, cached);
    }
  }, [threadId, threadContextUsage, setContextUsage]);

  const clearRepairRetryTimer = useCallback(() => {
    if (repairRetryTimerRef.current !== null) {
      window.clearTimeout(repairRetryTimerRef.current);
      repairRetryTimerRef.current = null;
    }
  }, []);

  const scheduleSnapshotRepairRetry = useCallback((input: SnapshotRepairRetryInput = { reason: "mutation-retry" }) => {
    clearRepairRetryTimer();
    repairRetryTimerRef.current = window.setTimeout(() => {
      repairRetryTimerRef.current = null;
      requestSnapshotRepair(threadId, input);
    }, SNAPSHOT_REPAIR_RETRY_DELAY_MS);
  }, [clearRepairRetryTimer, requestSnapshotRepair, threadId]);

  const scheduleInitialBaselineRepair = useCallback((generation?: number) => {
    const key = `${threadId}:${typeof generation === "number" ? generation : "legacy"}`;
    const attempts = initialBaselineRepairAttemptsRef.current.get(key) ?? 0;
    if (attempts >= MAX_INITIAL_BASELINE_REPAIR_ATTEMPTS) {
      return;
    }
    initialBaselineRepairAttemptsRef.current.set(key, attempts + 1);
    scheduleSnapshotRepairRetry({
      reason: "mutation-retry",
      ...(typeof generation === "number" ? { generation } : {})
    });
  }, [scheduleSnapshotRepairRetry, threadId]);

  useEffect(() => {
    compactActionPendingRef.current = false;
    streamDisconnectedRepairKeysRef.current.clear();
    completionRepairAttemptsRef.current.clear();
    initialBaselineRepairAttemptsRef.current.clear();
    setCompactPending(false);
    clearRepairRetryTimer();
    return clearRepairRetryTimer;
  }, [threadId, clearRepairRetryTimer]);

  useEffect(() => {
    if (wsState === "open" || wsState === "idle") {
      streamDisconnectedRepairKeysRef.current.clear();
    }
  }, [wsState]);

  useEffect(() => {
    const recoverFromPageRestore = () => {
      if (document.visibilityState === "hidden") {
        return;
      }
      const current = useStore.getState().threads[threadId];
      if (!current) {
        return;
      }
      if (
        wsState !== "open" ||
        current.running ||
        current.status === "active" ||
        current.status === "unknown"
      ) {
        requestSnapshotRepair(threadId, { reason: "baseline-required" });
      }
    };

    window.addEventListener("pageshow", recoverFromPageRestore);
    document.addEventListener("visibilitychange", recoverFromPageRestore);
    return () => {
      window.removeEventListener("pageshow", recoverFromPageRestore);
      document.removeEventListener("visibilitychange", recoverFromPageRestore);
    };
  }, [requestSnapshotRepair, threadId, wsState]);

  const effectivePermissionMode = permissionModeFromPayload(effectivePermissionPayload);

  const handleComposerHeightChange = useCallback((height: number) => {
    setComposerHeight((current) => (current === height ? current : height));
    const scroller = scrollerRef.current;
    if (scroller && atBottomRef.current) {
      scroller.scrollTop = scroller.scrollHeight;
    }
  }, []);

  const bumpMutationEpoch = useCallback(() => {
    mutationEpochRef.current += 1;
    return mutationEpochRef.current;
  }, []);

  const enqueueThreadSettings = useCallback(
    (input: UpdateThreadSettingsInput) => {
      pendingSettingsRef.current = input;
      if (!settingsFlushRef.current) {
        settingsFlushRef.current = (async () => {
          while (pendingSettingsRef.current) {
            const next = pendingSettingsRef.current;
            pendingSettingsRef.current = null;
            await codex.updateThreadSettings(threadId, next);
          }
        })().finally(() => {
          settingsFlushRef.current = null;
        });
      }
      return settingsFlushRef.current;
    },
    [threadId]
  );

  const loadModelCatalog = useCallback(
    () => requestCoordinatorRef.current.dedupeRequest("codex:model-catalog", () => codex.modelCatalog()),
    []
  );

  useEffect(() => {
    let cancelled = false;
    requestCoordinatorRef.current.dedupeRequest("codex:settings", () => codex.settings())
      .then((settings) => {
        if (!cancelled) {
          setServerDefaults({
            model: settings.model,
            reasoningEffort: settings.reasoningEffort,
            reasoningSummary: settings.reasoningSummary
          });
        }
      })
      .catch((err) => {
        if (isRequestAbort(err)) return;
        // Keep the protocol fallback when app-server settings are temporarily unavailable.
      });
    loadModelCatalog()
      .then((catalog) => {
        if (!cancelled) setModelCatalog(catalog);
      })
      .catch((err) => {
        if (isRequestAbort(err)) return;
        // The selected value remains available when the catalog is temporarily unavailable.
      });
    return () => {
      cancelled = true;
    };
  }, [loadModelCatalog]);

  const applyThreadDetail = useCallback(
    (
      td: ThreadDetail,
      mode: "replace" | "merge" | "metadata" = "replace",
      targetThreadId = threadId,
      entriesOverride?: TimelineEntry[],
      detailEntries: TimelineEntry[] = []
    ) => {
      if (targetThreadId === threadId) {
        setDetail(td);
      }
      const rawEntries: TimelineEntry[] =
        mode === "metadata"
          ? []
          : entriesOverride ??
            threadDetailEntries(td);
      const extractedEntries = extractLegacyWarningNotices(rawEntries);
      const extractedDetailEntries = extractLegacyWarningNotices(mode === "metadata" ? [] : detailEntries);
      for (const notice of [...extractedEntries.notices, ...extractedDetailEntries.notices]) {
        upsertThreadNotice(targetThreadId, notice);
      }
      const entries = extractedEntries.entries;
      const cleanedDetailEntries = extractedDetailEntries.entries;
      const nextCursor = td.nextCursor ?? null;
      if (mode === "metadata") {
        // Timeline already committed via replaceLatestWindow or another ingress path.
      } else if (mode === "merge") {
        mergeThreadEntries(targetThreadId, entries, nextCursor);
      } else {
        if (cleanedDetailEntries.length) {
          setThreadEntries(targetThreadId, entries, nextCursor, cleanedDetailEntries);
        } else {
          setThreadEntries(targetThreadId, entries, nextCursor);
        }
      }
      if (typeof td.generation === "number") {
        setTimelineGeneration(targetThreadId, td.generation);
      }
      if (td.turnManifest) {
        setAuthoritativeTurnManifest(targetThreadId, td.turnManifest);
      }
      if (td.modelState) {
        setModelState(targetThreadId, td.modelState);
      } else if (td.model) {
        setModel(targetThreadId, td.model, td.reasoningEffort ?? null);
      }
      if (td.contextUsage) {
        setContextUsage(targetThreadId, td.contextUsage);
      }
      if ("activePermissionProfile" in td) {
        const profileId = td.activePermissionProfile?.id ?? null;
        const approvalPolicy = "approvalPolicy" in td ? td.approvalPolicy ?? null : undefined;
        const approvalsReviewer = "approvalsReviewer" in td ? td.approvalsReviewer ?? null : undefined;
        const selection = normalizePermissionSelection(profileId, approvalPolicy, approvalsReviewer);
        if (selection) {
          setPermissionProfile(
            targetThreadId,
            selection.permissions,
            selection.approvalPolicy,
            selection.approvalsReviewer
          );
          savePermissionSelection(targetThreadId, selection);
        }
      }
      if (td.runtimePermissionObservation) {
        setRuntimePermissionProfile(
          targetThreadId,
          td.runtimePermissionObservation.permissions,
          td.runtimePermissionObservation.approvalPolicy,
          td.runtimePermissionObservation.approvalsReviewer
        );
      }
      setThreadStatus(
        targetThreadId,
        td.status,
        isThreadRunningStatus(td.status) ? td.activeTurnId : null
      );
    },
    [
      threadId,
      setThreadEntries,
      mergeThreadEntries,
      setTimelineGeneration,
      setAuthoritativeTurnManifest,
      setModel,
      setModelState,
      setContextUsage,
      setPermissionProfile,
      setRuntimePermissionProfile,
      setThreadStatus,
      upsertThreadNotice
    ]
  );

  const applyThreadSummaryStatus = useCallback(
    (summary: ThreadSummary) => {
      if (isThreadRunningStatus(summary.status) && summary.activeTurnId) {
        setThreadStatus(summary.id, summary.status, summary.activeTurnId);
      } else {
        setThreadStatus(summary.id, summary.status);
      }
      if (summary.id !== threadId) return;
      setDetail((prev) =>
        prev
          ? {
              ...prev,
              ...summary,
              lastTurnId: isThreadRunningStatus(summary.status)
                ? (summary.activeTurnId ?? prev.lastTurnId)
                : null,
              nextCursor: prev.nextCursor,
              timeline: prev.timeline
            }
          : prev
      );
    },
    [threadId, setThreadStatus]
  );

  useEffect(() => {
    setActiveThread(threadId);
    ensureThread(threadId);
    const savedMode = loadJson<ChatMode | null>(threadModeKey(threadId), null);
    if (savedMode) {
      setMode(threadId, savedMode);
    }
    const savedPermissionProfile = normalizeStoredPermissionSelection(
      loadJson<StoredPermissionSelection | undefined>(
        threadPermissionProfileKey(threadId),
        undefined
      )
    );
    if (savedPermissionProfile !== undefined) {
      setPermissionProfile(
        threadId,
        savedPermissionProfile.permissions,
        savedPermissionProfile.approvalPolicy,
        savedPermissionProfile.approvalsReviewer
      );
    }
    let cancelled = false;
    const requestGuard = captureTimelineRequestGuard(threadId, mutationEpochRef.current);
    const requestToken = ++requestTokenSequenceRef.current;
    const requestStampKey = historyStampKey(requestGuard.historyStamp);
    setError(null);
    setLoading(true);
    (async () => {
      try {
        const td = await requestCoordinatorRef.current.dedupeRequest(
          `thread:${threadId}:detail:${requestStampKey}`,
          () => codex.readThread(threadId)
        ).catch((err) => {
          const blocked = recoveryFailedThreadRead(err);
          if (blocked) {
            applyModelSwitchResult(threadId, {
              outcome: "recovery_failed",
              operationId: blocked.operationId,
              latestState: blocked.latestState
            });
            return blocked.thread;
          }
          return recoverInitialThreadDetail(threadId, err);
        });
        const initialPage = await requestCoordinatorRef.current.dedupeRequest(
          `thread:${threadId}:turns:initial:${requestStampKey}`,
          () => codex.listTurnsBefore(threadId, null)
        );
        if (cancelled) return;
        if (requestToken !== requestTokenSequenceRef.current) return;
        if (!timelineRequestGuardIsCurrent(threadId, requestGuard, mutationEpochRef.current)) {
          scheduleInitialBaselineRepair(useStore.getState().threads[threadId]?.timelineGeneration);
          return;
        }
        if (!responseHistoryStampsAreCompatible(td.historyStamp, initialPage.historyStamp, !requestGuard.hasEntries)) {
          if (td.historyStamp || initialPage.historyStamp || requestGuard.historyStamp) {
            scheduleInitialBaselineRepair(initialPage.generation ?? td.generation);
          }
          return;
        }
        const pageDetail = {
          ...td,
          bootId: initialPage.bootId ?? td.bootId,
          generation: initialPage.generation ?? td.generation,
          historyStamp: initialPage.historyStamp ?? td.historyStamp,
          turnManifest: initialPage.turnManifest ?? td.turnManifest,
          timeline: initialPage.items,
          nextCursor: initialPage.nextCursor ?? null
        };
        applyThreadDetail(pageDetail, "replace", threadId, mergeTimelineEntryMetadata(
          threadDetailEntries(pageDetail),
          threadDetailEntries(td)
        ));
      } catch (err) {
        if (isRequestAbort(err)) return;
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : (err as Error).message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      setActiveThread(null);
    };
  }, [
    threadId,
    ensureThread,
    applyThreadDetail,
    applyModelSwitchResult,
    setMode,
    setPermissionProfile,
    setActiveThread,
    scheduleInitialBaselineRepair,
    initialLoadAttempt
  ]);

  const repairSignal = repairRequest?.key ?? (repairRequestedAt ? String(repairRequestedAt) : null);

  useEffect(() => {
    if (!repairSignal) return;
    if (!invalidatedRepairSignalsRef.current.has(repairSignal)) {
      invalidatedRepairSignalsRef.current.add(repairSignal);
      const clientEpoch = invalidateTimelineEventThread(threadId);
      invalidateTimelineDelivery?.(threadId, clientEpoch || undefined);
    }
    let cancelled = false;
    const requestGuard = captureTimelineRequestGuard(threadId, mutationEpochRef.current);
    const repairToken = ++requestTokenSequenceRef.current;
    activeRepairTokenRef.current = repairToken;
    const repairIdentity = repairRequestIdentity(repairRequest, requestGuard.historyStamp);
    (async () => {
      try {
        const [td, page] = await Promise.all([
          requestCoordinatorRef.current.dedupeRequest(
            `thread:${threadId}:repair:metadata:${repairIdentity}`,
            () => codex.readThread(threadId, {
              repairReason: repairRequest?.reason ?? "mutation-retry"
            })
          ),
          requestCoordinatorRef.current.dedupeRequest(
            `thread:${threadId}:repair:items:${repairIdentity}`,
            () => codex.listTurnsBefore(threadId, null, undefined, {
              repairReason: repairRequest?.reason ?? "mutation-retry"
            })
          )
        ]);
        if (cancelled) return;
        if (activeRepairTokenRef.current !== repairToken) return;
        if (!timelineRequestGuardIsCurrent(threadId, requestGuard, mutationEpochRef.current)) {
          requestSnapshotRepair(threadId, repairRequest ?? { reason: "mutation-retry" });
          return;
        }
        if (!responseHistoryStampsAreCompatible(td.historyStamp, page.historyStamp, !requestGuard.hasEntries)) {
          requestSnapshotRepair(threadId, repairRequest ?? { reason: "mutation-retry" });
          return;
        }
        const repairWindow = repairWindowFrom(page);
        if (repairWindow) {
          const repairEntries = repairReconstructedTimelineEntries(
            page.items.map((item, index) => timelineItemToEntry(item, td.updatedAt - page.items.length + index)),
            "snapshot"
          );
          if (!replaceLatestWindow(threadId, repairEntries, page.nextCursor ?? null, repairWindow)) {
            scheduleSnapshotRepairRetry({
              reason: "mutation-retry",
              ...(typeof repairRequest?.generation === "number" ? { generation: repairRequest.generation } : {})
            });
            return;
          }
        } else if (requestGuard.hasEntries) {
          scheduleSnapshotRepairRetry({
            reason: "mutation-retry",
            ...(typeof repairRequest?.generation === "number" ? { generation: repairRequest.generation } : {})
          });
          return;
        }
        applyThreadDetail({
          ...td,
          bootId: page.bootId ?? td.bootId,
          generation: page.generation ?? td.generation,
          historyStamp: page.historyStamp ?? td.historyStamp,
          turnManifest: page.turnManifest ?? td.turnManifest,
          // Keep detail timeline for UI state, but do not re-ingress page.items.
          timeline: page.items,
          nextCursor: page.nextCursor ?? null
        }, repairWindow ? "metadata" : "merge");
        const completionRetry = completionRepairRetryInput(repairRequest);
        if (completionRetry && !timelinePageHasVisibleTurnOutput(page.items, completionRetry.turnId)) {
          const attemptKey = `${completionRetry.turnId}:${completionRetry.generation ?? "legacy"}`;
          const nextAttempt = (completionRepairAttemptsRef.current.get(attemptKey) ?? 0) + 1;
          if (nextAttempt <= MAX_COMPLETION_REPAIR_ATTEMPTS) {
            completionRepairAttemptsRef.current.set(attemptKey, nextAttempt);
            if (activeRepairTokenRef.current === repairToken) clearSnapshotRepair(threadId);
            scheduleSnapshotRepairRetry(completionRetry);
            return;
          }
          completionRepairAttemptsRef.current.delete(attemptKey);
          if (repairRequest?.key) {
            terminateFinalReconcile(threadId, repairRequest.key);
          }
        } else if (completionRetry) {
          completionRepairAttemptsRef.current.delete(
            `${completionRetry.turnId}:${completionRetry.generation ?? "legacy"}`
          );
          if (repairRequest?.key) {
            terminateFinalReconcile(threadId, repairRequest.key);
          }
        } else if (repairRequest?.key && (repairRequest.reason === "turn-completed" || repairRequest.reason === "summary-idle")) {
          terminateFinalReconcile(threadId, repairRequest.key);
        }
        clearRepairRetryTimer();
        if (activeRepairTokenRef.current === repairToken) clearSnapshotRepair(threadId);
      } catch (err) {
        if (cancelled || isRequestAbort(err)) return;
        if (activeRepairTokenRef.current === repairToken) scheduleSnapshotRepairRetry(
          completionRepairRetryInput(repairRequest) ?? { reason: "mutation-retry" }
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    threadId,
    repairSignal,
    repairRequest,
    applyThreadDetail,
    requestSnapshotRepair,
    clearSnapshotRepair,
    terminateFinalReconcile,
    clearRepairRetryTimer,
    scheduleSnapshotRepairRetry,
    invalidateTimelineDelivery,
    replaceLatestWindow
  ]);

  useEffect(() => {
    if (!threadRunning && !compactPending) return;
    let cancelled = false;
    let timer: number | null = null;

    const pollSummary = async () => {
      try {
        const summary = await requestCoordinatorRef.current.dedupeRequest(
          `thread:${threadId}:summary`,
          () => codex.readThreadSummary(threadId)
        );
        if (cancelled) return;
        const summaryRunning = isThreadRunningStatus(summary.status);
        const currentThread = useStore.getState().threads[threadId];
        if (compactPending && compactActionPendingRef.current && !summaryRunning) {
          if (!cancelled) {
            timer = window.setTimeout(pollSummary, ACTIVE_THREAD_SUMMARY_POLL_DELAY_MS);
          }
          return;
        }
        applyThreadSummaryStatus(summary);
        if (summaryRunning) {
          const disconnectedRepairKey = `${currentThread?.activeTurnId ?? "thread"}`;
          const activeTurnId = currentThread?.activeTurnId ?? null;
          const hasVisibleOutput = threadHasVisibleOutput(currentThread, activeTurnId);
          if (
            (shouldRepairRunningSummaryFromEventStreamState(wsState) || Boolean(activeTurnId && !hasVisibleOutput)) &&
            !currentThread?.repairRequest &&
            !streamDisconnectedRepairKeysRef.current.has(disconnectedRepairKey)
          ) {
            streamDisconnectedRepairKeysRef.current.add(disconnectedRepairKey);
            requestSnapshotRepair(threadId, {
              reason: "stream-disconnected",
              turnId: currentThread?.activeTurnId ?? null
            });
          }
        } else {
          const activeTurnId = currentThread?.activeTurnId ?? null;
          compactActionPendingRef.current = false;
          setCompactPending(false);
          if (
            activeTurnId &&
            !hasEquivalentPendingCompletionRepair(currentThread?.repairRequest, activeTurnId)
          ) {
            requestSnapshotRepair(threadId, {
              reason: "summary-idle",
              turnId: activeTurnId
            });
          }
          return;
        }
      } catch (err) {
        if (isRequestAbort(err)) return;
        // Event stream remains the primary live path; summary polling is only a bounded recovery path.
      }
      if (!cancelled) {
        timer = window.setTimeout(pollSummary, ACTIVE_THREAD_SUMMARY_POLL_DELAY_MS);
      }
    };

    timer = window.setTimeout(pollSummary, ACTIVE_THREAD_SUMMARY_POLL_DELAY_MS);
    return () => {
      cancelled = true;
      if (timer !== null) {
        window.clearTimeout(timer);
      }
    };
  }, [threadId, threadRunning, compactPending, wsState, applyThreadSummaryStatus, requestSnapshotRepair]);

  useEffect(() => {
    if (!compactPending || !compactCompletionSeen) return;
    compactActionPendingRef.current = false;
    setCompactPending(false);
  }, [compactPending, compactCompletionSeen]);

  useEffect(() => {
    let cancelled = false;
    requestCoordinatorRef.current.dedupeRequest("pendingRequests:list", () => codex.listPendingRequests())
      .then((requests) => {
        if (!cancelled) {
          setPendingRequests(requests);
        }
      })
      .catch((err) => {
        if (isRequestAbort(err)) return;
        // WebSocket remains the live path; this is only a reload recovery path.
      });
    return () => {
      cancelled = true;
    };
  }, [threadId, setPendingRequests]);

  const loadOlderHistory = useCallback(async () => {
    if (historyPageLoadingRef.current) {
      return;
    }
    const currentThread = useStore.getState().threads[threadId];
    if (!currentThread || currentThread.reachedBeginning || !currentThread.cursor) {
      return;
    }
    const cursor = currentThread.cursor;
    const requestGuard = captureTimelineRequestGuard(threadId, mutationEpochRef.current);
    const pageKey = `${threadId}\u0001${historyStampKey(requestGuard.historyStamp)}\u0001${cursor}`;
    if (loadingPageCursorsRef.current.has(pageKey)) {
      return;
    }
    loadingPageCursorsRef.current.add(pageKey);
    historyPageLoadingRef.current = true;
    try {
      const page = await requestCoordinatorRef.current.dedupeRequest(
        `thread:${threadId}:turns:${historyStampKey(requestGuard.historyStamp)}:${cursor}`,
        () => codex.listTurnsBefore(threadId, cursor)
      );
      if (!timelineRequestGuardIsCurrent(threadId, requestGuard, mutationEpochRef.current)) return;
      if (!sameHistoryStamp(requestGuard.historyStamp, page.historyStamp)) return;
      const pageCreatedAtBase = Date.now() - 10_000;
      const extra = repairReconstructedTimelineEntries(
        page.items.map((it, i) => timelineItemToEntry(it, pageCreatedAtBase + i)),
        "pagination"
      );
      const scroller = scrollerRef.current;
      const timelineManagesAnchor = scroller?.dataset.timelineAnchorManaged === "true";
      const scrollAnchor = scroller && !timelineManagesAnchor
        ? captureTimelineDomScrollAnchor(scroller)
        : null;
      prependEntries(threadId, extra, page.nextCursor ?? null, page.nextCursor === null);
      if (scroller && scrollAnchor && !timelineManagesAnchor) {
        window.requestAnimationFrame(() => {
          if (scrollerRef.current !== scroller) return;
          restoreTimelineDomScrollAnchor(scroller, scrollAnchor);
        });
      }
    } catch {
      // The current page remains usable; a later resize or top scroll can retry.
    } finally {
      loadingPageCursorsRef.current.delete(pageKey);
      historyPageLoadingRef.current = false;
    }
  }, [threadId, prependEntries]);

  const onScroll = useCallback(
    async (event: React.UIEvent<HTMLDivElement>) => {
      const el = event.currentTarget;
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      atBottomRef.current = distanceFromBottom < 64;
      setShowJumpLatest(!atBottomRef.current);
      if (el.scrollTop < 64) {
        await loadOlderHistory();
      }
    },
    [loadOlderHistory]
  );

  const onSend = useCallback(
    async (
      text: string,
      imagePaths: string[],
      skillReferences: SkillReference[] = [],
      fileReferences: FileReference[] = [],
      retryEntry?: TimelineEntry
    ) => {
      const currentDetail =
        detail ??
        (useStore.getState().threads[threadId]?.entries.length
          ? cachedThreadDetailFromState(threadId, useStore.getState().threads[threadId])
          : null);
      if (!currentDetail) return;
      const currentStatus = threadStatus ?? currentDetail.status;
      const sendKey = sendPayloadKey(text, imagePaths, skillReferences, fileReferences);
      if (pendingSendKeysRef.current.has(sendKey)) return;
      pendingSendKeysRef.current.add(sendKey);
      const retryAmbiguousStart = retryEntry?.sendOperation?.outcome === "ambiguous";
      const localUserMessageId = retryAmbiguousStart
        ? retryEntry.clientUserMessageId ?? retryEntry.id
        : uniqueTimelineId("local-user");
      const payloadFingerprint = sendPayloadKey(text, imagePaths, skillReferences, fileReferences);
      const optimisticEntry: TimelineEntry = {
        ...(retryAmbiguousStart ? retryEntry : {}),
        id: retryAmbiguousStart ? retryEntry.id : localUserMessageId,
        clientUserMessageId: localUserMessageId,
        createdAt: Date.now(),
        sendOperation: {
          payloadFingerprint,
          ...(retryAmbiguousStart && retryEntry.sendOperation?.bootId
            ? { bootId: retryEntry.sendOperation.bootId }
            : detail?.bootId
              ? { bootId: detail.bootId }
              : {}),
          outcome: "pending"
        },
        body: {
          kind: "user-message",
          text,
          ...(imagePaths.length ? { imagePaths } : {}),
          ...(skillReferences.length ? { skillReferences } : {}),
          ...(fileReferences.length ? { fileReferences } : {}),
          status: "sending"
        }
      };
      if (retryAmbiguousStart) replaceOrAddEntry(threadId, optimisticEntry);
      else appendEntries(threadId, [optimisticEntry]);
      bumpMutationEpoch();
      setThreadStatus(threadId, "active");
      let startRequested = false;
      try {
        const clientUserMessageId = optimisticEntry.clientUserMessageId ?? optimisticEntry.id;
        const latestThread = useStore.getState().threads[threadId];
        const latestPermissionSelection = normalizePermissionSelection(
          latestThread?.permissionProfileId,
          latestThread?.approvalPolicy,
          latestThread?.approvalsReviewer
        );
        let permissionSelection = latestPermissionSelection ?? effectivePermissionPayload;
        if (currentStatus === "notLoaded") {
          const resumed = await requestCoordinatorRef.current.dedupeRequest(
            `thread:${threadId}:resume`,
            () => codex.resumeThread(threadId, permissionSelection)
          );
          const resumedSelection = permissionSelectionFromDetail(resumed);
          if (resumedSelection) {
            setPermissionProfile(
              threadId,
              resumedSelection.permissions,
              resumedSelection.approvalPolicy,
              resumedSelection.approvalsReviewer
            );
            savePermissionSelection(threadId, resumedSelection);
            permissionSelection = resumedSelection;
          }
        }
        const currentMode = useStore.getState().threads[threadId]?.mode ?? "build";
        const collaborationMode =
          currentMode === "plan"
            ? collaborationModeForChatMode("plan", effectiveModel, effectiveReasoningEffort)
            : undefined;
        const startInput = {
          threadId,
          clientUserMessageId,
          ...(retryAmbiguousStart
            ? {
                retryAmbiguousStart: true,
                ...(retryEntry.sendOperation?.bootId ? { startBootId: retryEntry.sendOperation.bootId } : {})
              }
            : {}),
          text,
          imagePaths,
          ...(skillReferences.length ? { skillReferences } : {}),
          ...(fileReferences.length ? { fileReferences } : {}),
          ...(currentMode === "build" && configuredModel ? { model: configuredModel } : {}),
          ...(currentMode === "build" && configuredReasoningEffort ? { reasoningEffort: configuredReasoningEffort } : {}),
          ...(effectiveReasoningSummary ? { reasoningSummary: effectiveReasoningSummary } : {}),
          ...(permissionSelection ?? {}),
          ...(collaborationMode ? { collaborationMode } : {})
        };
        startRequested = true;
        const started = await codex.startTurn(startInput);
        registerAuthoritativeTurn(threadId, started.turnId);
        bindLocalUserMessageTurn(threadId, clientUserMessageId, started.turnId);
        const currentThread = useStore.getState().threads[threadId];
        if (currentThread?.running) {
          setActiveTurnId(threadId, started.turnId);
        } else if (!threadHasVisibleOutput(currentThread, started.turnId)) {
          requestSnapshotRepair(threadId, {
            reason: "turn-completed",
            turnId: started.turnId
          });
        }
        replaceOrAddEntry(threadId, {
          ...optimisticEntry,
          turnId: started.turnId,
          clientUserMessageId,
          sendOperation: { ...optimisticEntry.sendOperation!, outcome: "accepted" },
          body: {
            kind: "user-message",
            text,
            ...(imagePaths.length ? { imagePaths } : {}),
            ...(skillReferences.length ? { skillReferences } : {}),
            ...(fileReferences.length ? { fileReferences } : {}),
            status: "sent"
          }
        });
        if (retryAmbiguousStart) {
          removeEntry(threadId, `${optimisticEntry.id}-error`);
        }
        // Auto-name thread after first user message
        if ((!currentDetail.title || currentDetail.title === "新会话") && text.trim()) {
          try {
            const firstLine = text.split("\n")[0].slice(0, 80);
            const updated = await codex.renameThread(threadId, firstLine);
            setDetail(updated);
          } catch {
            // ignore auto-name failure
          }
        }
      } catch (err) {
        const ambiguous = startRequested && isAmbiguousStartError(err);
        replaceOrAddEntry(threadId, {
          ...optimisticEntry,
          sendOperation: {
            ...optimisticEntry.sendOperation!,
            outcome: ambiguous ? "ambiguous" : "rejected"
          },
          body: {
            kind: "user-message",
            text,
            ...(imagePaths.length ? { imagePaths } : {}),
            ...(skillReferences.length ? { skillReferences } : {}),
            ...(fileReferences.length ? { fileReferences } : {}),
            status: "failed"
          }
        });
        appendEntries(threadId, [
          {
            id: `${optimisticEntry.id}-error`,
            createdAt: Date.now(),
            body: {
              kind: "error",
              text: ambiguous
                ? `发送结果未确认：${errorMessage(err)}。请先刷新恢复，或重试同一发送动作。`
                : `发送失败：${errorMessage(err)}`
            }
          }
        ]);
        if (!ambiguous) {
          setThreadStatus(threadId, "idle", null);
        }
        throw err;
      } finally {
        pendingSendKeysRef.current.delete(sendKey);
      }
    },
    [
      detail,
      threadStatus,
      threadId,
      effectiveModel,
      effectiveReasoningEffort,
      effectiveReasoningSummary,
      effectivePermissionPayload,
      configuredModel,
      configuredReasoningEffort,
      appendEntries,
      applyThreadDetail,
      replaceOrAddEntry,
      removeEntry,
      setThreadStatus,
      setActiveTurnId,
      registerAuthoritativeTurn,
      bindLocalUserMessageTurn,
      bumpMutationEpoch,
      requestSnapshotRepair,
      setPermissionProfile
    ]
  );

  const onInterrupt = useCallback(async () => {
    const turnId = threadActiveTurnId ?? undefined;
    try {
      await requestCoordinatorRef.current.runLockedAction(`interrupt:${threadId}`, async () => {
        if (turnId) {
          await codex.interruptTurn(threadId, turnId);
        } else {
          await codex.interruptTurn(threadId);
        }
        if (turnId) {
          markTurnInterrupted(threadId, turnId);
        }
        setThreadStatus(threadId, "idle", null);
      });
    } catch (err) {
      appendEntries(threadId, [
        {
          id: uniqueTimelineId("interrupt-error"),
          createdAt: Date.now(),
          body: { kind: "error", text: `中断失败：${errorMessage(err)}` }
        }
      ]);
    }
  }, [
    threadId,
    threadActiveTurnId,
    appendEntries,
    setThreadStatus,
    markTurnInterrupted
  ]);

  const rewindToMessage = useCallback(
    async (entry: TimelineEntry) => {
      const currentThread = useStore.getState().threads[threadId];
      if (currentThread?.running || entry.body.kind !== "user-message") return;
      const entries = currentThread?.entries ?? [];
      const target = resolveCurrentUserMessage(entries, entry);
      const rollbackMetadata = target
        ? rollbackMetadataForEntry(entries, target, {
            cursor: currentThread?.cursor ?? null,
            turnManifest: currentThread?.turnManifest
          })
        : null;
      if (!target || !rollbackMetadata) {
        appendEntries(threadId, [
          {
            id: uniqueTimelineId("rewind-error"),
            createdAt: Date.now(),
            body: { kind: "error", text: "无法定位这条消息所属的 turn，请刷新后重试。" }
          }
        ]);
        return;
      }

      const operationKey = `${threadId}\u0000${rollbackMetadata.targetTurnId}`;
      if (destructiveActionKeysRef.current.has(operationKey)) {
        return;
      }
      destructiveActionKeysRef.current.add(operationKey);

      try {
        const clientEpoch = invalidateTimelineEventThread(threadId);
        invalidateTimelineDelivery?.(threadId, clientEpoch || undefined);
        bumpMutationEpoch();
        const operationId = rollbackOperationIdsRef.current.get(operationKey) ?? uniqueTimelineId("rollback");
        rollbackOperationIdsRef.current.set(operationKey, operationId);
        const rolledBack = await rollbackThreadWithResume(
          threadId,
          {
            operationId,
            targetTurnId: rollbackMetadata.targetTurnId,
            historyStamp: rollbackMetadata.historyStamp,
            expectedTailTurnIds: rollbackMetadata.expectedTailTurnIds
          }
        );
        rollbackOperationIdsRef.current.delete(operationKey);
        for (const turnId of rollbackMetadata.expectedTailTurnIds) {
          markTurnDeleted(threadId, turnId);
        }
        applyThreadDetail(rolledBack, "replace");
        const draftText = target.body.kind === "user-message" ? target.body.text : entry.body.text;
        setDraft(threadId, draftText);
        setDraftOverride({
          threadId,
          text: draftText,
          version: Date.now(),
          ...(target.body.kind === "user-message" && target.body.fileReferences?.length
            ? { fileReferences: target.body.fileReferences }
            : {})
        });
      } catch (err) {
        const failure = rollbackFailure(err);
        if (failure.code === "ROLLBACK_CONFLICT") {
          rollbackOperationIdsRef.current.delete(operationKey);
        }
        if (failure.repairReason) {
          requestSnapshotRepair(threadId, {
            reason: failure.repairReason,
            generation: rollbackMetadata.historyStamp.generation
          });
        }
        appendEntries(threadId, [
          {
            id: uniqueTimelineId("rewind-error"),
            createdAt: Date.now(),
            body: { kind: "error", text: failure.message }
          }
        ]);
      } finally {
        destructiveActionKeysRef.current.delete(operationKey);
      }
    },
    [
      threadId,
      applyThreadDetail,
      appendEntries,
      markTurnDeleted,
      bumpMutationEpoch,
      invalidateTimelineDelivery,
      requestSnapshotRepair
    ]
  );

  const forkFromMessage = useCallback(
    async (entry: TimelineEntry) => {
      const currentThread = useStore.getState().threads[threadId];
      if (currentThread?.running || entry.body.kind !== "user-message") return;
      const entries = currentThread?.entries ?? [];
      const target = resolveCurrentUserMessage(entries, entry);
      const rollbackMetadata = target
        ? rollbackMetadataForEntry(entries, target, {
            cursor: currentThread?.cursor ?? null,
            turnManifest: currentThread?.turnManifest
          })
        : null;
      if (!target || !rollbackMetadata) {
        appendEntries(threadId, [
          {
            id: uniqueTimelineId("fork-error"),
            createdAt: Date.now(),
            body: { kind: "error", text: "无法定位这条消息所属的 turn，请刷新后重试。" }
          }
        ]);
        return;
      }

      const actionKey = `${threadId}\u0000fork\u0000${rollbackMetadata.targetTurnId}`;
      if (destructiveActionKeysRef.current.has(actionKey)) {
        return;
      }
      destructiveActionKeysRef.current.add(actionKey);
      const attemptOwner = Symbol(actionKey);
      forkActionAttemptOwners.set(actionKey, attemptOwner);
      const isCurrentAttempt = () => forkActionAttemptOwners.get(actionKey) === attemptOwner;

      let repairThreadId = threadId;
      let repairGeneration = rollbackMetadata.historyStamp.generation;
      const rememberOperation = (next: ForkActionOperation) => {
        forkActionOperationsRef.current.set(actionKey, next);
        saveForkActionOperation(actionKey, next);
      };
      const forgetOperation = () => {
        forkActionOperationsRef.current.delete(actionKey);
        removeForkActionOperation(actionKey);
      };
      const existingOperation = forkActionOperationsRef.current.get(actionKey) ?? loadForkActionOperation(actionKey);
      const operation: ForkActionOperation = existingOperation ?? {
        forkOperationId: uniqueTimelineId("fork"),
        rollbackOperationId: uniqueTimelineId("fork-rollback"),
        forkState: "pending"
      };
      rememberOperation(operation);
      let forkResolved = operation.forkState === "resolved";
      let resolvedForkThread = operation.forkedThread;
      let rollbackRequested = false;

      try {
        const restoredForkRead = !resolvedForkThread && operation.forkState === "resolved" && operation.forkedThreadId;
        let forked = resolvedForkThread
          ?? (restoredForkRead
            ? await codex.readThread(operation.forkedThreadId!)
            : await codex.forkThread(threadId, {
                operationId: operation.forkOperationId,
                ...(operation.forkState === "ambiguous" ? { retryAmbiguousFork: true } : {})
              }));
        if (!isCurrentAttempt()) return;
        forkResolved = true;
        if (operation.needsForkRefresh && !restoredForkRead) {
          forked = await codex.readThread(forked.id);
          if (!isCurrentAttempt()) return;
        }
        resolvedForkThread = forked;
        rememberOperation({
          ...operation,
          forkState: "resolved",
          forkedThread: forked,
          forkedThreadId: forked.id,
          needsForkRefresh: false
        });
        repairThreadId = forked.id;
        const forkEntries = "timeline" in forked && Array.isArray(forked.timeline) ? threadDetailEntries(forked) : [];
        const forkTarget = forkEntries.length ? resolveEquivalentUserMessage(forkEntries, target) : null;
        if (!forkTarget) {
          rememberOperation({
            ...operation,
            forkState: "resolved",
            forkedThread: forked,
            forkedThreadId: forked.id,
            needsForkRefresh: true
          });
          appendEntries(threadId, [
            {
              id: uniqueTimelineId("fork-error"),
              createdAt: Date.now(),
              body: { kind: "error", text: "无法在 Fork 后的会话中定位这条消息，请刷新后重试。" }
            }
          ]);
          return;
        }
        const forkRollbackMetadata = rollbackMetadataForEntry(forkEntries, forkTarget, {
          turnManifest: forked.turnManifest
        });
        if (!forkRollbackMetadata) {
          rememberOperation({
            ...operation,
            forkState: "resolved",
            forkedThread: forked,
            forkedThreadId: forked.id,
            needsForkRefresh: true
          });
          appendEntries(threadId, [
            {
              id: uniqueTimelineId("fork-error"),
              createdAt: Date.now(),
              body: { kind: "error", text: "无法计算 Fork 后的回滚范围，请刷新后重试。" }
            }
          ]);
          return;
        }
        repairGeneration = forkRollbackMetadata.historyStamp.generation;
        const clientEpoch = invalidateTimelineEventThread(forked.id);
        invalidateTimelineDelivery?.(forked.id, clientEpoch || undefined);
        bumpMutationEpoch();
        rollbackRequested = true;
        const rolledBack = await rollbackThreadWithResume(
          forked.id,
          {
            operationId: operation.rollbackOperationId,
            targetTurnId: forkRollbackMetadata.targetTurnId,
            historyStamp: forkRollbackMetadata.historyStamp,
            expectedTailTurnIds: forkRollbackMetadata.expectedTailTurnIds
          }
        );
        if (!isCurrentAttempt()) return;
        for (const turnId of forkRollbackMetadata.expectedTailTurnIds) {
          markTurnDeleted(forked.id, turnId);
        }
        applyThreadDetail(rolledBack, "replace", forked.id);
        const draftText = target.body.kind === "user-message" ? target.body.text : entry.body.text;
        setDraft(forked.id, draftText);
        setDraftOverride({
          threadId: forked.id,
          text: draftText,
          version: Date.now(),
          ...(target.body.kind === "user-message" && target.body.fileReferences?.length
            ? { fileReferences: target.body.fileReferences }
            : {})
        });
        forgetOperation();
        router.push(`/threads/${forked.id}`);
      } catch (err) {
        if (!isCurrentAttempt()) return;
        if (!forkResolved) {
          if (isAmbiguousForkError(err)) {
            rememberOperation({ ...operation, forkState: "ambiguous" });
          } else {
            forgetOperation();
          }
        } else {
          const ambiguousRollback = rollbackRequested && isAmbiguousRollbackError(err);
          rememberOperation({
            ...operation,
            rollbackOperationId: ambiguousRollback
              ? operation.rollbackOperationId
              : uniqueTimelineId("fork-rollback"),
            forkState: "resolved",
            ...(resolvedForkThread ? { forkedThread: resolvedForkThread } : {}),
            ...(resolvedForkThread?.id || operation.forkedThreadId
              ? { forkedThreadId: resolvedForkThread?.id ?? operation.forkedThreadId }
              : {}),
            needsForkRefresh: !ambiguousRollback
          });
        }
        const failure = forkResolved ? rollbackFailure(err, "fork") : forkFailure(err);
        if (failure.repairReason) {
          requestSnapshotRepair(repairThreadId, {
            reason: failure.repairReason,
            generation: repairGeneration
          });
        }
        appendEntries(threadId, [
          {
            id: uniqueTimelineId("fork-error"),
            createdAt: Date.now(),
            body: { kind: "error", text: failure.message }
          }
        ]);
      } finally {
        if (isCurrentAttempt()) {
          forkActionAttemptOwners.delete(actionKey);
        }
        destructiveActionKeysRef.current.delete(actionKey);
      }
    },
    [
      threadId,
      applyThreadDetail,
      appendEntries,
      markTurnDeleted,
      router,
      bumpMutationEpoch,
      invalidateTimelineDelivery,
      requestSnapshotRepair
    ]
  );

  const openModelPicker = useCallback(() => {
    setShowReasoningPicker(false);
    setShowModelPicker(true);
  }, []);

  const openReasoningPicker = useCallback(() => {
    setShowModelPicker(false);
    setShowReasoningPicker(true);
  }, []);

  const reportModelError = useCallback((message: string) => {
    appendEntries(threadId, [{
      id: uniqueTimelineId("model-error"),
      createdAt: Date.now(),
      body: { kind: "error", text: message }
    }]);
  }, [appendEntries, threadId]);

  const reportModelWarning = useCallback((message: string) => {
    upsertThreadNotice(threadId, {
      id: `model-operation-warning:${message}`,
      kind: "warning",
      source: "model-operation",
      text: message
    });
  }, [threadId, upsertThreadNotice]);

  const adoptModelState = useCallback((modelState: ThreadModelStateView) => {
    setModelState(threadId, modelState);
    setDetail((previous) => previous ? {
      ...previous,
      model: modelState.model,
      reasoningEffort: modelState.reasoningEffort,
      modelState
    } : previous);
  }, [setModelState, threadId]);

  const onSelectModel = useCallback(
    async (target: ModelSelection, catalogRevision: number, kind: "switch" | "reapply" = "switch") => {
      if (!currentModelState || threadModelSwitchStatus !== "idle") return;
      beginModelSwitch(threadId, target);
      try {
        const result = await codex.switchThreadModel(threadId, {
          target,
          expectedCatalogRevision: catalogRevision,
          expectedCurrent: {
            selection: currentModelState.selection,
            reasoningEffort: currentModelState.reasoningEffort,
            bindingVersion: currentModelState.bindingVersion
          },
          kind
        });
        if (isModelSwitchTerminal(result)) {
          applyModelSwitchResult(threadId, {
            outcome: result.outcome,
            operationId: result.operationId,
            latestState: result.latestState
          });
          adoptModelState(result.latestState);
          if (result.outcome === "recovered") {
            reportModelWarning(result.error ?? "目标模型不可用，已恢复原模型");
          } else if (result.outcome === "recovery_failed") {
            reportModelError(result.error ?? "会话模型恢复失败，需要先恢复运行时");
          }
        } else {
          clearModelSwitchPending(threadId);
          if (result.latestState) {
            adoptModelState(result.latestState);
          }
          reportModelWarning(result.error ?? modelSwitchCodeMessage(result.code));
        }
      } catch (switchError) {
        clearModelSwitchPending(threadId);
        reportModelError(`模型切换失败：${errorMessage(switchError)}`);
      } finally {
        setShowModelPicker(false);
      }
    },
    [
      adoptModelState,
      applyModelSwitchResult,
      beginModelSwitch,
      clearModelSwitchPending,
      currentModelState,
      reportModelError,
      reportModelWarning,
      threadId,
      threadModelSwitchStatus
    ]
  );

  const onSelectReasoningEffort = useCallback(
    async (effort: string) => {
      try {
        await enqueueThreadSettings({ reasoningEffort: effort });
        const refreshed = await codex.readThread(threadId);
        if (refreshed.modelState) {
          adoptModelState(refreshed.modelState);
        } else if (refreshed.model) {
          setModel(threadId, refreshed.model, refreshed.reasoningEffort ?? effort);
        }
      } catch (err) {
        reportModelWarning(`推理强度更新失败：${errorMessage(err)}`);
        console.warn("update reasoning effort failed", err);
      }
    },
    [adoptModelState, enqueueThreadSettings, reportModelWarning, setModel, threadId]
  );

  const recoverThreadModel = useCallback(async (action: "restore-old" | "retry-target") => {
    if (modelRecoveryPending) return;
    setModelRecoveryPending(true);
    try {
      const result = await codex.recoverThreadModel(threadId, action);
      if (isModelSwitchTerminal(result)) {
        applyModelSwitchResult(threadId, {
          outcome: result.outcome,
          operationId: result.operationId,
          latestState: result.latestState
        });
        adoptModelState(result.latestState);
        if (result.outcome === "recovery_failed") {
          reportModelError(result.error ?? "模型恢复仍未成功");
        }
      } else {
        reportModelWarning(result.error ?? modelSwitchCodeMessage(result.code));
      }
    } catch (recoverError) {
      reportModelError(`模型恢复失败：${errorMessage(recoverError)}`);
    } finally {
      setModelRecoveryPending(false);
    }
  }, [
    adoptModelState,
    applyModelSwitchResult,
    modelRecoveryPending,
    reportModelError,
    reportModelWarning,
    threadId
  ]);

  const onSelectPermissionMode = useCallback(
    async (modeId: PermissionModeId) => {
      const mode = permissionModeById(modeId);
      const previous = effectivePermissionPayload;
      setShowPermissionPicker(false);
      setPermissionProfile(threadId, mode.permissions, mode.approvalPolicy, mode.approvalsReviewer);
      savePermissionSelection(threadId, mode);
      try {
        await enqueueThreadSettings({
          permissions: mode.permissions,
          approvalPolicy: mode.approvalPolicy,
          approvalsReviewer: mode.approvalsReviewer
        });
      } catch (err) {
        setPermissionProfile(
          threadId,
          previous?.permissions,
          previous?.approvalPolicy,
          previous?.approvalsReviewer
        );
        if (previous) {
          savePermissionSelection(threadId, previous);
        } else {
          removeKey(threadPermissionProfileKey(threadId));
        }
        appendEntries(threadId, [
          {
            id: uniqueTimelineId("permission-warning"),
            createdAt: Date.now(),
            body: {
              kind: "system",
              systemKind: "warning",
              text: `权限切换失败：${errorMessage(err)}`
            }
          }
        ]);
        console.warn("update permission profile failed", err);
      }
    },
    [threadId, effectivePermissionPayload, setPermissionProfile, enqueueThreadSettings, appendEntries]
  );

  const onToggleMode = useCallback(
    async (next: ChatMode) => {
      setMode(threadId, next);
      saveJson(threadModeKey(threadId), next);
      try {
        await enqueueThreadSettings({
          collaborationMode: collaborationModeForChatMode(
            next,
            effectiveModel,
            effectiveReasoningEffort
          )
        });
      } catch (err) {
        console.warn("update mode failed", err);
      }
    },
    [threadId, setMode, effectiveModel, effectiveReasoningEffort, enqueueThreadSettings]
  );

  const visibleDetail =
    detail ??
    (hasCachedEntries
      ? cachedThreadDetailFromState(threadId, useStore.getState().threads[threadId])
      : null);

  if (error && !visibleDetail) {
    return (
      <main style={{ padding: 24 }}>
        <p style={{ color: "var(--cw-danger)" }}>{error}</p>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            onClick={() => {
              setError(null);
              setInitialLoadAttempt((attempt) => attempt + 1);
            }}
            style={btnGhost}
          >
            重试
          </button>
          <button type="button" onClick={() => router.back()} style={btnGhost}>
            返回
          </button>
        </div>
      </main>
    );
  }

  if (!visibleDetail) {
    return (
      <main style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100dvh" }}>
        <span style={{ color: "var(--cw-fg-muted)" }}>载入中…</span>
      </main>
    );
  }

  const mode = threadMode;
  const modelId = effectiveModel;
  const effectiveThreadStatus = threadStatus ?? (threadRunning ? "active" : visibleDetail.status);
  const running = isThreadRunningStatus(effectiveThreadStatus);
  const compactAllowed = isThreadCompactableStatus(effectiveThreadStatus) && !running && !compactPending;
  const compactDisabled = !compactAllowed;
  const compactDisabledLabel = compactPending
    ? COMPACTING_CONTEXT_TEXT
    : running
      ? "运行中不可压缩"
      : effectiveThreadStatus === "notLoaded" || effectiveThreadStatus === "systemError"
        ? "当前状态不可压缩，请恢复会话后重试"
        : "当前状态不可压缩";
  const currentGoal = visibleDetail.goal ?? null;

  return (
    <main style={{ display: "flex", flexDirection: "column", height: "100dvh" }}>
      <ThreadHeader
        title={visibleDetail.title || "新会话"}
        mode={mode}
        contextUsage={threadContextUsage}
        configuredContextWindow={
          currentModelState?.selection.source === "custom" ? currentModelState.contextWindow : null
        }
        onBack={() => router.back()}
        onToggleMode={onToggleMode}
        onOpenContextUsage={() => setContextUsageOpen(true)}
        onOpenActions={() => setShowSheet(true)}
      />

      <ThreadPlanBar threadId={threadId} />

      <ThreadNotices
        notices={threadNotices}
        onDismiss={(noticeId) => dismissThreadNotice(threadId, noticeId)}
      />

      <ThreadTimelineViewport
        threadId={threadId}
        scrollerRef={scrollerRef}
        followTail={atBottomRef.current}
        onScroll={onScroll}
        onRequestOlder={loadOlderHistory}
        onSend={onSend}
        onRewindToMessage={rewindToMessage}
        onForkFromMessage={forkFromMessage}
        onResolveApproval={(req) => resolvePendingRequest(req.requestId)}
        onExecutePlan={async (entries) => {
          onToggleMode("build");
          const lastUserMsg = entries
            .slice()
            .reverse()
            .find((entry) => entry.body.kind === "user-message");
          const text =
            lastUserMsg && lastUserMsg.body.kind === "user-message"
              ? lastUserMsg.body.text
              : "请按上面的计划开始执行";
          await onSend(text, []);
        }}
        processing={running || compactPending}
        processingLabel={compactPending ? COMPACTING_CONTEXT_TEXT : "正在处理…"}
      />

      {showJumpLatest ? (
        <button
          type="button"
          onClick={() => {
            if (scrollerRef.current) {
              scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
            }
          }}
          style={jumpBtn}
        >
          ↓ 跳到最新
        </button>
      ) : null}

      {threadModelSwitchStatus === "recovery_failed" ? (
        <ModelRecoveryBanner
          pending={modelRecoveryPending}
          onRestore={() => void recoverThreadModel("restore-old")}
          onRetry={() => void recoverThreadModel("retry-target")}
        />
      ) : null}

      <ThreadComposerDock
        threadId={threadId}
        cwd={visibleDetail?.cwd}
        running={running}
        disabled={!visibleDetail}
        imageInputSupported={currentModelState?.inputModalities.includes("image") ?? false}
        sendBlockedReason={
          threadModelSwitchStatus === "recovery_failed"
            ? "会话模型恢复失败，请先恢复模型"
            : threadModelSwitchStatus === "pending"
              ? "正在切换模型"
              : undefined
        }
        draftOverride={draftOverride ?? undefined}
        permissionLabel={effectivePermissionMode.label}
        permissionDescription={effectivePermissionMode.description}
        permissionPending={effectivePermissionMode.id === "pending"}
        modelLabel={shortModel(modelId)}
        reasoningEffortLabel={effectiveReasoningEffort ? reasoningEffortLabel(effectiveReasoningEffort) : undefined}
        goal={currentGoal}
        onHeightChange={handleComposerHeightChange}
        onOpenPermissionPicker={() => setShowPermissionPicker(true)}
        onOpenModelPicker={openModelPicker}
        onOpenReasoningPicker={
          currentModelState && (
            currentModelState.supportedReasoningEfforts.length > 0 || currentModelState.reasoningEffort
          )
            ? openReasoningPicker
            : undefined
        }
        onOpenGoalEditor={() => setGoalEditorOpen(true)}
        onSend={onSend}
        onInterrupt={onInterrupt}
      />

      {showPermissionPicker ? (
        <PermissionPicker
          current={effectivePermissionMode.id}
          onSelect={onSelectPermissionMode}
          onClose={() => setShowPermissionPicker(false)}
        />
      ) : null}

      {goalEditorOpen ? (
        <GoalEditor
          goal={currentGoal}
          onClose={() => setGoalEditorOpen(false)}
          onSave={async (input) => {
            const goal = await codex.setThreadGoal(threadId, input);
            setDetail((prev) => (prev ? { ...prev, goal } : prev));
          }}
          onClear={async () => {
            await codex.clearThreadGoal(threadId);
            setDetail((prev) => (prev ? { ...prev, goal: null } : prev));
          }}
        />
      ) : null}

      {contextUsageOpen ? (
        <ContextUsageSheet
          usage={threadContextUsage}
          compactDisabled={compactDisabled}
          compactDisabledLabel={compactDisabledLabel}
          onClose={() => setContextUsageOpen(false)}
          onCompact={() => {
            if (compactDisabled) return;
            setContextUsageOpen(false);
            setCompactOpen(true);
          }}
        />
      ) : null}

      {showSheet ? (
        <ActionSheet
          onClose={() => setShowSheet(false)}
          onRename={() => {
            setShowSheet(false);
            setRenameOpen(true);
          }}
          onArchive={async () => {
            setShowSheet(false);
            try {
              const result = await requestCoordinatorRef.current.runLockedAction(`archive:${threadId}`, async () => {
                await codex.archiveThread(threadId);
              });
              if (result.started) {
                setArchiveToast({ visible: true });
                setTimeout(() => setArchiveToast(null), 4500);
              }
            } catch (err) {
              console.warn("archive failed", err);
            }
          }}
          onCompact={() => {
            setShowSheet(false);
            setCompactOpen(true);
          }}
          compactDisabled={compactDisabled}
          compactDisabledLabel={compactDisabledLabel}
        />
      ) : null}

      {showModelPicker ? (
        currentModelState ? (
        <UnifiedModelPicker
          current={currentModelState}
          onSelect={(selection, catalogRevision) => onSelectModel(selection, catalogRevision, "switch")}
          onReapply={(catalogRevision) => onSelectModel(currentModelState.selection, catalogRevision, "reapply")}
          onClose={() => setShowModelPicker(false)}
          loadCatalog={loadModelCatalog}
        />
        ) : null
      ) : null}

      {showReasoningPicker && currentModelState ? (
        <ReasoningEffortPicker
          current={currentModelState}
          onSelect={onSelectReasoningEffort}
          onClose={() => setShowReasoningPicker(false)}
        />
      ) : null}

      {renameOpen ? (
        <RenameDialog
          initial={visibleDetail.title || ""}
          onClose={() => setRenameOpen(false)}
          onSubmit={async (name) => {
            try {
              const result = await requestCoordinatorRef.current.runLockedAction(
                `rename:${threadId}`,
                () => codex.renameThread(threadId, name)
              );
              if (result.started) {
                setDetail(result.value);
              }
            } catch (err) {
              console.warn("rename failed", err);
            } finally {
              setRenameOpen(false);
            }
          }}
        />
      ) : null}

      {compactOpen ? (
        <ConfirmDialog
          title="压缩上下文"
          body="将会摘要先前对话以释放上下文窗口。继续？"
          onClose={() => setCompactOpen(false)}
          onConfirm={async () => {
            if (compactActionPendingRef.current) return;
            compactActionPendingRef.current = true;
            setCompactOpen(false);
            setCompactPending(true);
            try {
              await requestCoordinatorRef.current.runLockedAction(
                `compact:${threadId}`,
                () => codex.compactThread(threadId)
              );
            } catch (err) {
              setCompactPending(false);
              compactActionPendingRef.current = false;
              appendEntries(threadId, [
                {
                  id: uniqueTimelineId("compact-error"),
                  createdAt: Date.now(),
                  body: { kind: "error", text: `压缩失败：${errorMessage(err)}` }
                }
              ]);
              try {
                const summary = await requestCoordinatorRef.current.dedupeRequest(
                  `thread:${threadId}:summary`,
                  () => codex.readThreadSummary(threadId)
                );
                applyThreadSummaryStatus(summary);
              } catch (summaryError) {
                if (!isRequestAbort(summaryError)) {
                  console.warn("compact status refresh failed", summaryError);
                }
              }
              console.warn("compact failed", err);
            } finally {
              compactActionPendingRef.current = false;
            }
          }}
        />
      ) : null}

      {archiveToast ? (
        <div style={toastStyle}>
          已归档 ·{" "}
          <button
            type="button"
            onClick={async () => {
              setArchiveToast(null);
              try {
                await requestCoordinatorRef.current.runLockedAction(
                  `unarchive:${threadId}`,
                  () => codex.unarchiveThread(threadId)
                );
              } catch (err) {
                console.warn("unarchive failed", err);
              }
            }}
            style={{ background: "transparent", color: "var(--cw-accent)", border: "none" }}
          >
            撤销
          </button>
        </div>
      ) : null}
    </main>
  );
}

function ThreadHeader({
  title,
  mode,
  contextUsage,
  configuredContextWindow,
  onBack,
  onToggleMode,
  onOpenContextUsage,
  onOpenActions
}: {
  title: string;
  mode: ChatMode;
  contextUsage: ContextUsageSnapshot | null;
  configuredContextWindow: number | null;
  onBack: () => void;
  onToggleMode: (mode: ChatMode) => void;
  onOpenContextUsage: () => void;
  onOpenActions: () => void;
}): JSX.Element {
  return (
    <div style={headerShellStyle}>
      <header style={headerStyle}>
        <button type="button" onClick={onBack} style={iconBtn} aria-label="返回">
          ‹
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden"
            }}
          >
            {title}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <ModeSegmented value={mode} onChange={onToggleMode} />
          <button type="button" onClick={onOpenActions} style={iconBtn} aria-label="更多">
            ⋮
          </button>
        </div>
      </header>
      <ContextUsageProgress
        usage={contextUsage}
        configuredContextWindow={configuredContextWindow}
        onOpen={onOpenContextUsage}
      />
    </div>
  );
}

function ContextUsageProgress({
  usage,
  configuredContextWindow,
  onOpen
}: {
  usage: ContextUsageSnapshot | null;
  configuredContextWindow: number | null;
  onOpen: () => void;
}): JSX.Element {
  const progress = contextUsageProgress(usage);
  const mismatch = contextWindowMismatch(usage, configuredContextWindow);
  if (!progress) {
    return (
      <div aria-label="上下文窗口等待用量" style={contextProgressUnavailableStyle}>
        <span aria-hidden="true" style={contextProgressTrackStyle} />
        <span style={contextProgressUnavailableLabelStyle}>--%</span>
      </div>
    );
  }
  return (
    <div style={contextProgressShellStyle}>
    <button
      type="button"
      aria-label={`上下文窗口 ${progress.percent}%`}
      onClick={onOpen}
      style={contextProgressButtonStyle}
    >
      <span style={contextProgressTrackStyle}>
        <span
          aria-hidden="true"
          style={{
            ...contextProgressFillStyle,
            width: `${progress.fillPercent}%`,
            background: progress.color
          }}
        />
      </span>
      <span style={{ ...contextProgressLabelStyle, color: progress.color }}>{progress.percent}%</span>
    </button>
      {mismatch ? <div style={contextMismatchStyle}>{mismatch}</div> : null}
    </div>
  );
}

function ThreadPlanBar({ threadId }: { threadId: string }): JSX.Element | null {
  const plan = useStore((s) => s.threads[threadId]?.plan ?? EMPTY_PLAN);
  return plan.length > 0 ? <PlanBar steps={plan} /> : null;
}

function ThreadTimelineViewport({
  threadId,
  scrollerRef,
  followTail,
  onScroll,
  onRequestOlder,
  onSend,
  onRewindToMessage,
  onForkFromMessage,
  onResolveApproval,
  onExecutePlan,
  processing,
  processingLabel
}: {
  threadId: string;
  scrollerRef: RefObject<HTMLDivElement | null>;
  followTail: boolean;
  onScroll: (event: React.UIEvent<HTMLDivElement>) => void | Promise<void>;
  onRequestOlder: () => void | Promise<void>;
  onSend: (
    text: string,
    imagePaths: string[],
    skillReferences?: SkillReference[],
    fileReferences?: FileReference[],
    retryEntry?: TimelineEntry
  ) => Promise<void>;
  onRewindToMessage: (entry: TimelineEntry) => void | Promise<void>;
  onForkFromMessage: (entry: TimelineEntry) => void | Promise<void>;
  onResolveApproval: (req: PendingServerRequest) => void | Promise<void>;
  onExecutePlan: (entries: TimelineEntry[]) => void | Promise<void>;
  processing: boolean;
  processingLabel: string;
}): JSX.Element {
  const entries = useStore((s) => s.threads[threadId]?.entries ?? EMPTY_ENTRIES);
  const eventStream = useStore((s) => s.threads[threadId]?.eventStream);
  const approvals = useStore((s) => s.threads[threadId]?.pendingApprovals ?? EMPTY_APPROVALS);
  const running = useStore((s) => s.threads[threadId]?.running ?? false);
  const activeTurnId = useStore((s) => s.threads[threadId]?.activeTurnId ?? null);
  const mode = useStore((s) => s.threads[threadId]?.mode ?? "build");
  const viewportWsState = useStore((s) => s.wsState);
  const reconnectAttempt = useStore((s) => s.reconnectAttempt);
  const reachedBeginning = useStore((s) => s.threads[threadId]?.reachedBeginning ?? false);
  const cursor = useStore((s) => s.threads[threadId]?.cursor ?? null);
  const contentRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const scroller = scrollerRef.current;
    const content = contentRef.current;
    if (!scroller || !content || reachedBeginning || !cursor) {
      return;
    }

    const requestIfUnderfilled = () => {
      if (scroller.clientHeight > 0 && scroller.scrollHeight <= scroller.clientHeight + 1) {
        void onRequestOlder();
      }
    };

    requestIfUnderfilled();
    if (typeof ResizeObserver === "undefined") {
      return;
    }
    const observer = new ResizeObserver(requestIfUnderfilled);
    observer.observe(content);
    return () => observer.disconnect();
  }, [cursor, onRequestOlder, reachedBeginning, scrollerRef]);

  return (
    <div
      ref={scrollerRef}
      className="cw-thread-scroller"
      onScroll={onScroll}
      style={scrollStyle}
    >
      <div ref={contentRef} data-thread-timeline-content="true" style={threadTimelineContentStyle}>
      {reachedBeginning ? (
        <div style={{ textAlign: "center", color: "var(--cw-fg-subtle)", padding: 16, fontSize: 12 }}>会话开始</div>
      ) : null}
      <Timeline
        threadId={threadId}
        entries={entries}
        eventStream={eventStream}
        followTail={followTail}
        approvals={approvals}
        running={running}
        activeTurnId={activeTurnId}
        onResendUser={async (entry) => {
          if (entry.body.kind !== "user-message") return;
          await onSend(entry.body.text, entry.body.imagePaths ?? [], entry.body.skillReferences ?? [], entry.body.fileReferences ?? [], entry);
        }}
        onRewindToMessage={onRewindToMessage}
        onForkFromMessage={onForkFromMessage}
        onResolveApproval={async (req) => {
          await onResolveApproval(req);
        }}
      />
      {viewportWsState === "reconnecting" || viewportWsState === "closed" ? (
        <ReconnectStatus attempt={reconnectAttempt} />
      ) : null}
      {processing ? (
        <div style={{ textAlign: "center", padding: 12, color: "var(--cw-fg-muted)", fontSize: 12 }}>
          {processingLabel}
        </div>
      ) : null}
      {mode === "plan" && !running && entries.length > 0 ? (
        <div style={{ textAlign: "center", padding: 16 }}>
          <button
            type="button"
            onClick={async () => {
              try {
                await onExecutePlan(entries);
              } catch (err) {
                console.warn("execute plan failed", err);
              }
            }}
            style={{
              padding: "10px 20px",
              borderRadius: 12,
              border: "none",
              background: "var(--cw-accent)",
              color: "#fff",
              fontSize: 15
            }}
          >
            转 Build 执行
          </button>
        </div>
      ) : null}
      </div>
    </div>
  );
}

function ThreadComposerDock({
  threadId,
  cwd,
  running,
  disabled,
  imageInputSupported,
  sendBlockedReason,
  draftOverride,
  permissionLabel,
  permissionDescription,
  permissionPending,
  modelLabel,
  reasoningEffortLabel,
  goal,
  onHeightChange,
  onOpenPermissionPicker,
  onOpenModelPicker,
  onOpenReasoningPicker,
  onOpenGoalEditor,
  onSend,
  onInterrupt
}: {
  threadId: string;
  cwd?: string;
  running: boolean;
  disabled: boolean;
  imageInputSupported: boolean;
  sendBlockedReason?: string;
  draftOverride?: { threadId: string; text: string; version: number; fileReferences?: FileReference[] };
  permissionLabel: string;
  permissionDescription?: string;
  permissionPending?: boolean;
  modelLabel: string;
  reasoningEffortLabel?: string;
  goal?: ThreadGoal | null;
  onHeightChange: (height: number) => void;
  onOpenPermissionPicker: () => void;
  onOpenModelPicker: () => void;
  onOpenReasoningPicker?: () => void;
  onOpenGoalEditor: () => void;
  onSend: (
    text: string,
    imagePaths: string[],
    skillReferences?: SkillReference[],
    fileReferences?: FileReference[],
    retryEntry?: TimelineEntry
  ) => Promise<void>;
  onInterrupt: () => Promise<void>;
}): JSX.Element {
  return (
    <ChatInput
      threadId={threadId}
      cwd={cwd}
      running={running}
      disabled={disabled}
      imageInputSupported={imageInputSupported}
      sendBlockedReason={sendBlockedReason}
      draftOverride={draftOverride}
      permissionLabel={permissionLabel}
      permissionDescription={permissionDescription}
      permissionPending={permissionPending}
      modelLabel={modelLabel}
      reasoningEffortLabel={reasoningEffortLabel}
      goal={goal}
      onHeightChange={onHeightChange}
      onOpenPermissionPicker={onOpenPermissionPicker}
      onOpenModelPicker={onOpenModelPicker}
      onOpenReasoningPicker={onOpenReasoningPicker}
      onOpenGoalEditor={onOpenGoalEditor}
      onSend={onSend}
      onInterrupt={onInterrupt}
    />
  );
}

function ModelRecoveryBanner({
  pending,
  onRestore,
  onRetry
}: {
  pending: boolean;
  onRestore: () => void;
  onRetry: () => void;
}): JSX.Element {
  return (
    <section role="alert" style={modelRecoveryStyle}>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={modelRecoveryTitleStyle}>会话模型恢复失败</div>
        <div style={modelRecoveryDescriptionStyle}>运行时状态不确定，恢复成功前不能发送新消息。</div>
      </div>
      <div style={modelRecoveryActionsStyle}>
        <button type="button" onClick={onRestore} disabled={pending} style={modelRecoveryPrimaryStyle}>
          恢复原模型
        </button>
        <button type="button" onClick={onRetry} disabled={pending} style={modelRecoverySecondaryStyle}>
          重试目标模型
        </button>
      </div>
    </section>
  );
}

function GoalEditor({
  goal,
  onClose,
  onSave,
  onClear
}: {
  goal: ThreadGoal | null;
  onClose: () => void;
  onSave: (input: { objective: string }) => Promise<void>;
  onClear: () => Promise<void>;
}): JSX.Element {
  const [objective, setObjective] = useState(goal?.objective ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canSave = objective.trim().length > 0 && !pending;

  async function submit(): Promise<void> {
    if (!canSave) return;
    setPending(true);
    setError(null);
    try {
      await onSave({
        objective: objective.trim()
      });
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  async function clear(): Promise<void> {
    if (!goal || pending) return;
    setPending(true);
    setError(null);
    try {
      await onClear();
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <Overlay onClose={pending ? () => undefined : onClose} align="bottom">
      <section role="dialog" aria-label="目标" style={goalSheetStyle}>
        <header style={goalSheetHeaderStyle}>
          <div>
            <div style={goalSheetTitleStyle}>目标</div>
            <div style={goalSheetSubtitleStyle}>{goal ? "编辑当前会话目标" : "设定当前会话目标"}</div>
          </div>
          <button type="button" onClick={onClose} disabled={pending} style={btnGhost}>
            取消
          </button>
        </header>
        <label style={goalFieldStyle}>
          <span style={goalLabelStyle}>目标描述</span>
          <textarea
            value={objective}
            onChange={(event) => setObjective(event.target.value)}
            rows={3}
            style={goalTextareaStyle}
            autoFocus
          />
        </label>
        {error ? <div style={goalErrorStyle}>{error}</div> : null}
        <div style={goalActionsStyle}>
          {goal ? (
            <button type="button" onClick={clear} disabled={pending} style={btnDangerGhost}>
              清除目标
            </button>
          ) : null}
          <div style={{ flex: 1 }} />
          <button type="button" onClick={submit} disabled={!canSave} style={canSave ? btnPrimary : btnPrimaryDisabled}>
            保存
          </button>
        </div>
      </section>
    </Overlay>
  );
}

function ContextUsageSheet({
  usage,
  compactDisabled,
  compactDisabledLabel,
  onClose,
  onCompact
}: {
  usage: ContextUsageSnapshot | null;
  compactDisabled: boolean;
  compactDisabledLabel: string;
  onClose: () => void;
  onCompact: () => void;
}): JSX.Element | null {
  const progress = contextUsageProgress(usage);
  if (!usage || !progress || !usage.modelContextWindow) {
    return null;
  }

  return (
    <Overlay onClose={onClose} align="bottom">
      <section role="dialog" aria-label="上下文用量" style={contextUsageSheetStyle}>
        <header style={contextUsageSheetHeaderStyle}>
          <div>
            <div style={contextUsageTitleStyle}>上下文用量</div>
            <div style={contextUsageSubtitleStyle}>最近一次已知窗口占用</div>
          </div>
          <button type="button" onClick={onClose} style={btnGhost}>
            关闭
          </button>
        </header>
        <div style={contextUsageSummaryStyle}>
          <span>{formatTokenCount(usage.totalTokens)} / {formatTokenCount(usage.modelContextWindow)}</span>
          <span style={{ color: progress.color }}>{progress.percent}%</span>
        </div>
        <div style={contextUsageMetricsStyle}>
          <span>输入 {formatTokenCount(usage.inputTokens)}</span>
          <span>输出 {formatTokenCount(usage.outputTokens)}</span>
          <span>推理 {formatTokenCount(usage.reasoningOutputTokens)}</span>
        </div>
        {compactDisabled ? (
          <div style={sheetMutedItemStyle}>{compactDisabledLabel}</div>
        ) : (
          <button type="button" onClick={onCompact} style={btnPrimary}>
            压缩上下文
          </button>
        )}
      </section>
    </Overlay>
  );
}

function ModeSegmented({ value, onChange }: { value: ChatMode; onChange: (m: ChatMode) => void }): JSX.Element {
  return (
    <div style={{ display: "inline-flex", border: "1px solid var(--cw-border)", borderRadius: 8, overflow: "hidden" }}>
      {(["plan", "build"] as ChatMode[]).map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => onChange(m)}
          style={{
            padding: "4px 10px",
            fontSize: 12,
            border: "none",
            background: value === m ? "var(--cw-accent)" : "transparent",
            color: value === m ? "#fff" : "var(--cw-fg)"
          }}
        >
          {m === "plan" ? "Plan" : "Build"}
        </button>
      ))}
    </div>
  );
}

function ActionSheet(props: {
  onClose: () => void;
  onRename: () => void;
  onArchive: () => void;
  onCompact: () => void;
  compactDisabled: boolean;
  compactDisabledLabel: string;
}): JSX.Element {
  return (
    <Overlay onClose={props.onClose} align="bottom">
      <div style={sheetStyle}>
        <SheetItem label="重命名" onClick={props.onRename} />
        <SheetItem label="归档" divided onClick={props.onArchive} />
        {props.compactDisabled ? (
          <div style={sheetMutedItemStyle}>{props.compactDisabledLabel}</div>
        ) : (
          <SheetItem label="压缩上下文" divided onClick={props.onCompact} />
        )}
        <SheetItem label="取消" divided onClick={props.onClose} />
      </div>
    </Overlay>
  );
}

function SheetItem({
  label,
  divided = false,
  onClick
}: {
  label: string;
  divided?: boolean;
  onClick: () => void;
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "14px 12px",
        border: "none",
        background: "transparent",
        textAlign: "left",
        fontSize: 16,
        color: "var(--cw-fg)",
        ...(divided ? { borderTop: "1px solid var(--cw-border)" } : {})
      }}
    >
      {label}
    </button>
  );
}

function PermissionPicker({
  current,
  onSelect,
  onClose
}: {
  current: PermissionDisplayModeId;
  onSelect: (modeId: PermissionModeId) => void;
  onClose: () => void;
}): JSX.Element {
  return (
    <Overlay onClose={onClose} align="bottom">
      <div role="dialog" aria-label="权限模式" style={sheetStyle}>
        <div style={{ padding: "8px 12px", color: "var(--cw-fg-muted)", fontSize: 13 }}>权限模式</div>
        {PERMISSION_MODES.map((mode) => (
          <button
            key={mode.id}
            type="button"
            aria-label={mode.label}
            onClick={() => onSelect(mode.id)}
            style={permissionRowStyle(current === mode.id)}
          >
            <span style={{ fontWeight: 650 }}>{mode.label}</span>
            <span style={permissionRowDescStyle}>{mode.description}</span>
          </button>
        ))}
      </div>
    </Overlay>
  );
}

function reasoningEffortLabel(effort: string): string {
  if (effort === "low") return "Low";
  if (effort === "medium") return "Medium";
  if (effort === "high") return "High";
  return effort
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ") || effort;
}

function RenameDialog({
  initial,
  onClose,
  onSubmit
}: {
  initial: string;
  onClose: () => void;
  onSubmit: (name: string) => void;
}): JSX.Element {
  const [name, setName] = useState(initial);
  return (
    <Overlay onClose={onClose}>
      <div style={dialogStyle}>
        <h3 style={{ margin: 0, fontSize: 16 }}>重命名会话</h3>
        <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} autoFocus />
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button type="button" onClick={onClose} style={btnGhost}>
            取消
          </button>
          <button type="button" onClick={() => name.trim() && onSubmit(name.trim())} style={btnPrimary}>
            保存
          </button>
        </div>
      </div>
    </Overlay>
  );
}

function ConfirmDialog({
  title,
  body,
  onClose,
  onConfirm
}: {
  title: string;
  body: string;
  onClose: () => void;
  onConfirm: () => void;
}): JSX.Element {
  return (
    <Overlay onClose={onClose}>
      <div style={dialogStyle}>
        <h3 style={{ margin: 0, fontSize: 16 }}>{title}</h3>
        <p style={{ margin: 0, color: "var(--cw-fg-muted)", fontSize: 14 }}>{body}</p>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button type="button" onClick={onClose} style={btnGhost}>
            取消
          </button>
          <button type="button" onClick={onConfirm} style={btnPrimary}>
            继续
          </button>
        </div>
      </div>
    </Overlay>
  );
}

function Overlay({
  onClose,
  align = "center",
  children
}: {
  onClose: () => void;
  align?: "center" | "bottom";
  children: React.ReactNode;
}): JSX.Element {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.45)",
        display: "flex",
        alignItems: align === "bottom" ? "flex-end" : "center",
        justifyContent: "center",
        zIndex: 70
      }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 480 }}>
        {children}
      </div>
    </div>
  );
}

function shortModel(id: string | null): string {
  if (!id) return "模型";
  const last = id.split("/").pop() || id;
  return last.length > 14 ? last.slice(0, 12) + "…" : last;
}

function appServerDefaultModel(selection: ModelSelection | null): string | null {
  return selection?.source === "app-server" ? selection.model : null;
}

type PermissionModeId = "request-approval" | "auto-approve" | "full-access" | "config-default";
type PermissionDisplayModeId = PermissionModeId | "pending";

type PermissionMode = PermissionSelection & {
  id: PermissionModeId;
  label: string;
  description: string;
};

type PermissionDisplayMode = Pick<PermissionMode, "label" | "description"> & {
  id: PermissionDisplayModeId;
};

type StoredPermissionSelection = PermissionSelection | string | null;

const PERMISSION_MODES: PermissionMode[] = [
  {
    id: "request-approval",
    label: "请求批准",
    description: "编辑外部文件和使用互联网时始终询问",
    permissions: ":workspace",
    approvalPolicy: "on-request",
    approvalsReviewer: "user"
  },
  {
    id: "auto-approve",
    label: "替我审批",
    description: "仅对检测到的风险操作请求批准",
    permissions: ":workspace",
    approvalPolicy: "on-request",
    approvalsReviewer: "auto_review"
  },
  {
    id: "full-access",
    label: "完全访问权限",
    description: "可不受限制地访问互联网和电脑上的任何文件",
    permissions: ":danger-full-access",
    approvalPolicy: "never",
    approvalsReviewer: null
  },
  {
    id: "config-default",
    label: "自定义 config.toml",
    description: "使用 config.toml 中定义的权限",
    permissions: null,
    approvalPolicy: null,
    approvalsReviewer: null
  }
];

const CONFIG_DEFAULT_PERMISSION_MODE = PERMISSION_MODES[3];

function permissionModeById(id: PermissionModeId): PermissionMode {
  return PERMISSION_MODES.find((mode) => mode.id === id) ?? CONFIG_DEFAULT_PERMISSION_MODE;
}

function permissionModeFromPayload(payload: PermissionSelection | undefined): PermissionDisplayMode {
  if (
    payload?.permissions === ":workspace" &&
    payload.approvalPolicy === "on-request" &&
    payload.approvalsReviewer === "auto_review"
  ) {
    return permissionModeById("auto-approve");
  }
  if (
    payload?.permissions === ":workspace" &&
    payload.approvalPolicy === "on-request" &&
    payload.approvalsReviewer === "user"
  ) {
    return permissionModeById("request-approval");
  }
  if (payload?.permissions === ":danger-full-access" && payload.approvalPolicy === "never") {
    return permissionModeById("full-access");
  }
  if (
    payload?.permissions === null &&
    payload.approvalPolicy === null &&
    payload.approvalsReviewer === null
  ) {
    return CONFIG_DEFAULT_PERMISSION_MODE;
  }
  return {
    id: "pending",
    label: "权限状态待确认",
    description: "后端尚未返回完整权限状态，当前不会覆盖 config.toml"
  };
}

function resolveEffectivePermissionPayload({
  localProfileId,
  localApprovalPolicy,
  localApprovalsReviewer,
  detailProfileId,
  detailApprovalPolicy,
  detailApprovalsReviewer
}: {
  localProfileId?: string | null;
  localApprovalPolicy?: ApprovalPolicy | null;
  localApprovalsReviewer?: ApprovalsReviewer | null;
  detailProfileId?: string | null;
  detailApprovalPolicy?: ApprovalPolicy | null;
  detailApprovalsReviewer?: ApprovalsReviewer | null;
}): PermissionSelection | undefined {
  const local = normalizePermissionSelection(
    localProfileId,
    localApprovalPolicy,
    localApprovalsReviewer
  );
  if (local) {
    return local;
  }
  return normalizePermissionSelection(
    detailProfileId,
    detailApprovalPolicy,
    detailApprovalsReviewer
  );
}

function normalizePermissionSelection(
  permissions: string | null | undefined,
  approvalPolicy: ApprovalPolicy | null | undefined,
  approvalsReviewer: ApprovalsReviewer | null | undefined
): PermissionSelection | undefined {
  if (permissions === undefined || approvalPolicy === undefined || approvalsReviewer === undefined) {
    return undefined;
  }
  if (permissions === ":workspace" || permissions === "workspace-write" || permissions === "read-only") {
    return {
      permissions: ":workspace",
      approvalPolicy,
      approvalsReviewer
    };
  }
  if (
    permissions === ":danger-full-access" ||
    permissions === "danger-full-access" ||
    permissions === "full-auto"
  ) {
    return {
      permissions: ":danger-full-access",
      approvalPolicy,
      approvalsReviewer
    };
  }
  if (permissions === null) {
    return { permissions, approvalPolicy, approvalsReviewer };
  }
  return undefined;
}

function savePermissionSelection(threadId: string, selection: PermissionSelection): void {
  saveJson(threadPermissionProfileKey(threadId), {
    permissions: selection.permissions,
    approvalPolicy: selection.approvalPolicy,
    approvalsReviewer: selection.approvalsReviewer
  });
}

function normalizeStoredPermissionSelection(value: StoredPermissionSelection | undefined): PermissionSelection | undefined {
  if (value === undefined) return undefined;
  if (value === null || typeof value === "string") return undefined;
  if (typeof value === "object") {
    const stored = value as Record<string, unknown>;
    const rawPermissions = stored.permissions;
    const permissions = typeof rawPermissions === "string" || rawPermissions === null ? rawPermissions : undefined;
    return normalizePermissionSelection(
      permissions,
      approvalPolicyOrUndefined(stored.approvalPolicy),
      approvalsReviewerOrUndefined(stored.approvalsReviewer)
    );
  }
  return undefined;
}

function permissionSelectionFromDetail(detail: ThreadDetail): PermissionSelection | undefined {
  if (!("activePermissionProfile" in detail)) return undefined;
  return normalizePermissionSelection(
    detail.activePermissionProfile?.id ?? null,
    "approvalPolicy" in detail ? detail.approvalPolicy ?? null : undefined,
    "approvalsReviewer" in detail ? detail.approvalsReviewer ?? null : undefined
  );
}

function approvalsReviewerOrUndefined(value: unknown): ApprovalsReviewer | null | undefined {
  if (value === null) return null;
  return value === "user" || value === "auto_review" || value === "guardian_subagent" ? value : undefined;
}

function approvalPolicyOrUndefined(value: unknown): ApprovalPolicy | null | undefined {
  if (value === null) return null;
  return value === "untrusted" || value === "on-request" || value === "never" ? value : undefined;
}

function isThreadNotFoundError(error: unknown): boolean {
  return error instanceof ApiError && /thread not found|找不到会话/i.test(error.message);
}

function rollbackFailure(
  error: unknown,
  action: "rollback" | "fork" = "rollback"
): {
  code: string | null;
  message: string;
  repairReason: "mutation-retry" | "baseline-required" | null;
} {
  const body = error instanceof ApiError && error.body && typeof error.body === "object"
    ? error.body as Record<string, unknown>
    : null;
  const code = typeof body?.code === "string" ? body.code : null;
  const label = action === "fork" ? "Fork 后回滚" : "回滚";
  if (code === "ROLLBACK_CONFLICT") {
    return {
      code,
      message: `${label}位置已过期：会话记录已在其他设备更新，正在刷新，请重新选择。`,
      repairReason: "mutation-retry"
    };
  }
  if (code === "ROLLBACK_UNRESOLVED") {
    return {
      code,
      message: `${label}结果无法确认：服务进程已变化，正在重新建立基线。`,
      repairReason: "baseline-required"
    };
  }
  if (code === "REPAIR_EXHAUSTED") {
    return {
      code,
      message: `${label}已提交，但最新记录尚未收敛，正在重新建立基线。`,
      repairReason: "baseline-required"
    };
  }
  return {
    code,
    message: `${label}失败：${errorMessage(error)}`,
    repairReason: null
  };
}

type TimelineRequestGuard = {
  mutationEpoch: number;
  deliveryEpoch: number;
  engine: object | null;
  historyStamp: HistoryStamp | null;
  hasEntries: boolean;
};

function captureTimelineRequestGuard(threadId: string, mutationEpoch: number): TimelineRequestGuard {
  const thread = useStore.getState().threads[threadId];
  let historyStamp: HistoryStamp | null = null;
  for (let index = (thread?.entries.length ?? 0) - 1; index >= 0; index -= 1) {
    const candidate = thread?.entries[index]?.historyStamp;
    if (candidate) {
      historyStamp = candidate;
      break;
    }
  }
  return {
    mutationEpoch,
    deliveryEpoch: thread?.deliveryEpoch ?? 0,
    engine: thread?.timelineEngine ?? null,
    historyStamp,
    hasEntries: Boolean(thread?.entries.length)
  };
}

function timelineRequestGuardIsCurrent(
  threadId: string,
  guard: TimelineRequestGuard,
  mutationEpoch: number
): boolean {
  const thread = useStore.getState().threads[threadId];
  return (
    mutationEpoch === guard.mutationEpoch &&
    (thread?.deliveryEpoch ?? 0) === guard.deliveryEpoch &&
    (thread?.timelineEngine ?? null) === guard.engine
  );
}

function sameHistoryStamp(left: HistoryStamp | null | undefined, right: HistoryStamp | null | undefined): boolean {
  if (!left || !right) return !left && !right;
  return left.bootId === right.bootId && left.generation === right.generation;
}

function responseHistoryStampsAreCompatible(
  metadataStamp: HistoryStamp | null | undefined,
  pageStamp: HistoryStamp | null | undefined,
  emptyBaseline: boolean
): boolean {
  if (!metadataStamp || !pageStamp) {
    return emptyBaseline && !metadataStamp && !pageStamp;
  }
  return sameHistoryStamp(metadataStamp, pageStamp);
}

function historyStampKey(stamp: HistoryStamp | null | undefined): string {
  return stamp ? `${stamp.bootId}:${stamp.generation}` : "legacy";
}

function repairRequestIdentity(
  request: { key?: string; reason?: string; turnId?: string | null; itemId?: string | null } | null,
  historyStamp: HistoryStamp | null
): string {
  return [
    historyStampKey(historyStamp),
    request?.reason ?? "repair",
    request?.turnId ?? "thread",
    request?.itemId ?? "item",
    request?.key ?? "request"
  ].map(encodeURIComponent).join(":");
}

function completionRepairRetryInput(
  repairRequest: { reason?: string; turnId?: string; generation?: number } | null | undefined
): SnapshotRepairRetryInput & { turnId: string } | null {
  if (
    !repairRequest?.turnId ||
    (repairRequest.reason !== "turn-completed" && repairRequest.reason !== "summary-idle")
  ) {
    return null;
  }
  return {
    reason: repairRequest.reason,
    turnId: repairRequest.turnId,
    ...(typeof repairRequest.generation === "number" ? { generation: repairRequest.generation } : {})
  };
}

function timelinePageHasVisibleTurnOutput(
  items: ThreadDetail["timeline"],
  turnId: string
): boolean {
  const fallbackBase = Date.now() - items.length;
  return hasVisibleTurnOutput(
    items.map((item, index) => timelineItemToEntry(item, fallbackBase + index)),
    turnId
  );
}

function isThreadRunningStatus(status: string): boolean {
  return status === "active";
}

function isThreadCompactableStatus(status: string): boolean {
  return status === "idle";
}

function threadHasVisibleOutput(
  thread:
    | {
        entries?: TimelineEntry[];
        entryIndexes?: { visibleOutputTurnIds?: Set<string> };
      }
    | undefined,
  turnId: string | null
): boolean {
  if (!thread || !turnId) {
    return false;
  }
  if (thread.entryIndexes?.visibleOutputTurnIds) {
    return thread.entryIndexes.visibleOutputTurnIds.has(turnId);
  }
  return hasVisibleTurnOutput(thread.entries ?? [], turnId);
}

function threadHasCompactCompletion(
  thread:
    | {
        entries?: TimelineEntry[];
        entryIndexes?: { compactCompletionSeen?: boolean };
      }
    | undefined
): boolean {
  if (!thread) {
    return false;
  }
  if (typeof thread.entryIndexes?.compactCompletionSeen === "boolean") {
    return thread.entryIndexes.compactCompletionSeen;
  }
  return Boolean(
    thread.entries?.some((entry) => entry.body.kind === "system" && entry.body.text === "压缩上下文已完成")
  );
}

function hasEquivalentPendingCompletionRepair(
  repairRequest: { reason?: string; turnId?: string } | null | undefined,
  turnId: string | null
): boolean {
  return Boolean(
    turnId &&
    repairRequest?.turnId === turnId &&
    (repairRequest.reason === "turn-completed" || repairRequest.reason === "summary-idle")
  );
}

function shouldRepairRunningSummaryFromEventStreamState(state: string | null | undefined): boolean {
  return Boolean(state && state !== "open" && state !== "idle");
}

function sendPayloadKey(text: string, imagePaths: string[], skillReferences: SkillReference[] = [], fileReferences: FileReference[] = []): string {
  const images = [...imagePaths].sort().join("\u0000");
  const skills = [...skillReferences].map((skill) => `${skill.name}\u0000${skill.path}`).sort().join("\u0000");
  const files = [...fileReferences].map((file) => `${file.id}\u0000${file.path}\u0000${file.size}`).sort().join("\u0000");
  return `${text.trim()}\u0001${images}\u0001${skills}\u0001${files}`;
}

function cachedThreadDetailFromState(
  threadId: string,
  thread: { status?: string; running?: boolean; activeTurnId?: string | null } | undefined
): ThreadDetail {
  const status = thread?.status ?? (thread?.running ? "active" : "idle");
  return {
    id: threadId,
    title: "会话",
    preview: "",
    cwd: "",
    modelProvider: "",
    status,
    updatedAt: Date.now(),
    lastTurnId: thread?.activeTurnId ?? null,
    generation: 0,
    nextCursor: null,
    timeline: []
  };
}

function uniqueTimelineId(prefix: string): string {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${random}`;
}

function forkActionSessionKey(actionKey: string): string {
  return `${FORK_ACTION_SESSION_PREFIX}${encodeURIComponent(actionKey)}`;
}

function loadForkActionOperation(actionKey: string): ForkActionOperation | null {
  if (typeof window === "undefined") return null;
  const key = forkActionSessionKey(actionKey);
  try {
    const stored = window.sessionStorage.getItem(key);
    if (!stored) return null;
    const value: unknown = JSON.parse(stored);
    if (!value || typeof value !== "object") {
      window.sessionStorage.removeItem(key);
      return null;
    }
    const candidate = value as Record<string, unknown>;
    const forkState = candidate.forkState;
    const validForkedThreadId = candidate.forkedThreadId === undefined
      || (typeof candidate.forkedThreadId === "string" && candidate.forkedThreadId.length > 0);
    const validRefreshFlag = candidate.needsForkRefresh === undefined
      || typeof candidate.needsForkRefresh === "boolean";
    if (
      typeof candidate.forkOperationId !== "string"
      || candidate.forkOperationId.length === 0
      || typeof candidate.rollbackOperationId !== "string"
      || candidate.rollbackOperationId.length === 0
      || (forkState !== "pending" && forkState !== "ambiguous" && forkState !== "resolved")
      || !validForkedThreadId
      || !validRefreshFlag
      || (forkState === "resolved" && typeof candidate.forkedThreadId !== "string")
    ) {
      window.sessionStorage.removeItem(key);
      return null;
    }
    return {
      forkOperationId: candidate.forkOperationId,
      rollbackOperationId: candidate.rollbackOperationId,
      forkState: forkState === "pending" ? "ambiguous" : forkState,
      ...(typeof candidate.forkedThreadId === "string" ? { forkedThreadId: candidate.forkedThreadId } : {}),
      ...(typeof candidate.needsForkRefresh === "boolean"
        ? { needsForkRefresh: candidate.needsForkRefresh }
        : {})
    };
  } catch {
    try {
      window.sessionStorage.removeItem(key);
    } catch {
      // Storage can be unavailable in privacy-restricted browser contexts.
    }
    return null;
  }
}

function saveForkActionOperation(actionKey: string, operation: ForkActionOperation): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(forkActionSessionKey(actionKey), JSON.stringify({
      forkOperationId: operation.forkOperationId,
      rollbackOperationId: operation.rollbackOperationId,
      forkState: operation.forkState,
      ...(operation.forkedThreadId ? { forkedThreadId: operation.forkedThreadId } : {}),
      ...(typeof operation.needsForkRefresh === "boolean"
        ? { needsForkRefresh: operation.needsForkRefresh }
        : {})
    }));
  } catch {
    // The in-memory operation still protects the current component instance.
  }
}

function removeForkActionOperation(actionKey: string): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(forkActionSessionKey(actionKey));
  } catch {
    // A storage failure must not turn a completed destructive action into an error.
  }
}

async function rollbackThreadWithResume(
  threadId: string,
  input: {
    operationId: string;
    targetTurnId: string;
    historyStamp: NonNullable<ThreadDetail["historyStamp"]>;
    expectedTailTurnIds: string[];
  }
): Promise<ThreadDetail> {
  try {
    return await codex.rollbackThread(threadId, input);
  } catch (err) {
    if (!isThreadNotFoundError(err)) {
      throw err;
    }
    await codex.resumeThread(threadId);
    return codex.rollbackThread(threadId, input);
  }
}

function resolveCurrentUserMessage(entries: TimelineEntry[], candidate: TimelineEntry): TimelineEntry | null {
  const byId = entries.find((entry) => entry.id === candidate.id && entry.body.kind === "user-message");
  if (byId) {
    return byId;
  }

  const candidateText = candidate.body.kind === "user-message" ? candidate.body.text.trim() : "";
  if (candidate.turnId) {
    const byTurn = entries.find(
      (entry) =>
        entry.turnId === candidate.turnId &&
        entry.body.kind === "user-message" &&
        (!candidateText || entry.body.text.trim() === candidateText)
    );
    if (byTurn) {
      return byTurn;
    }
  }

  return null;
}

async function recoverInitialThreadDetail(threadId: string, error: unknown): Promise<ThreadDetail> {
  if (!isRecoverableThreadReadError(error)) {
    throw error;
  }
  return codex.resumeThread(threadId);
}

function recoveryFailedThreadRead(error: unknown): {
  operationId: string;
  latestState: ThreadModelStateView;
  thread: ThreadDetail;
} | null {
  if (!(error instanceof ApiError) || !error.body || typeof error.body !== "object") return null;
  const body = error.body as Record<string, unknown>;
  if (
    body.outcome !== "recovery_failed" ||
    typeof body.operationId !== "string" ||
    !body.latestState || typeof body.latestState !== "object" ||
    !body.thread || typeof body.thread !== "object"
  ) {
    return null;
  }
  return {
    operationId: body.operationId,
    latestState: body.latestState as ThreadModelStateView,
    thread: body.thread as ThreadDetail
  };
}

function isRecoverableThreadReadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /not loaded|not materialized|before first user message|thread not found/i.test(message);
}

function resolveEquivalentUserMessage(entries: TimelineEntry[], target: TimelineEntry): TimelineEntry | null {
  if (target.clientUserMessageId) {
    const byClientId = entries.find(
      (entry) => entry.clientUserMessageId === target.clientUserMessageId && entry.body.kind === "user-message"
    );
    if (byClientId) {
      return byClientId;
    }
  }

  if (target.turnIndex !== undefined) {
    const byTurnIndex = entries.find(
      (entry) =>
        entry.turnIndex === target.turnIndex &&
        entry.body.kind === "user-message" &&
        target.body.kind === "user-message" &&
        entry.body.text.trim() === target.body.text.trim()
    );
    if (byTurnIndex) {
      return byTurnIndex;
    }
  }

  if (target.body.kind !== "user-message") {
    return null;
  }
  return null;
}

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : "未知错误";
}

function isAmbiguousStartError(error: unknown): boolean {
  if (isRequestAbort(error)) return true;
  if (error instanceof ApiError) {
    if (
      typeof error.body === "object" &&
      error.body !== null &&
      "code" in error.body &&
      error.body.code === "START_REJECTED"
    ) {
      return false;
    }
    return error.status >= 500 || error.message.includes("ambiguous-start-unresolved");
  }
  return error instanceof TypeError || (error instanceof Error && /timeout|network|connection|响应/i.test(error.message));
}

function isAmbiguousForkError(error: unknown): boolean {
  if (isRequestAbort(error)) return true;
  if (error instanceof ApiError) {
    const body = typeof error.body === "object" && error.body !== null
      ? error.body as Record<string, unknown>
      : null;
    if (body?.code === "FORK_REJECTED") return false;
    if (body?.code === "FORK_UNRESOLVED") return true;
    return error.status >= 500;
  }
  return error instanceof TypeError || (error instanceof Error && /timeout|network|connection|响应/i.test(error.message));
}

function isAmbiguousRollbackError(error: unknown): boolean {
  if (isRequestAbort(error)) return true;
  if (error instanceof ApiError) {
    const body = typeof error.body === "object" && error.body !== null
      ? error.body as Record<string, unknown>
      : null;
    if (
      body?.code === "ROLLBACK_CONFLICT" ||
      body?.code === "ROLLBACK_UNRESOLVED" ||
      body?.code === "REPAIR_EXHAUSTED"
    ) {
      return false;
    }
    return error.status >= 500;
  }
  return error instanceof TypeError || (error instanceof Error && /timeout|network|connection|响应/i.test(error.message));
}

function forkFailure(error: unknown): {
  code: string | null;
  message: string;
  repairReason: "mutation-retry" | "baseline-required" | null;
} {
  const body = error instanceof ApiError && error.body && typeof error.body === "object"
    ? error.body as Record<string, unknown>
    : null;
  const code = typeof body?.code === "string" ? body.code : null;
  if (code === "FORK_UNRESOLVED" || isAmbiguousForkError(error)) {
    return {
      code,
      message: `Fork 结果未确认：${errorMessage(error)}。请先刷新确认新会话，再重试。`,
      repairReason: null
    };
  }
  return {
    code,
    message: `Fork 创建失败：${errorMessage(error)}`,
    repairReason: null
  };
}

function modelStateFromCurrentThread(input: {
  selection: ModelSelection | null;
  model: string | null;
  reasoningEffort: string | null;
  bindingVersion: string | null;
  sourceUpdatedAt: string | null;
  contextWindow: number | null;
  inputModalities: ModelInputModality[];
  catalog: UnifiedModelCatalog | null;
}): ThreadModelStateView | null {
  if (!input.model) return null;
  const selection = input.selection ?? { source: "app-server" as const, model: input.model };
  const catalogModel = selection.source === "app-server"
    ? input.catalog?.models.find((model) => model.source === "app-server" && model.model === input.model)
    : undefined;
  return {
    selection,
    model: input.model,
    label: catalogModel?.label ?? input.model,
    contextWindow: catalogModel?.contextWindow ?? input.contextWindow,
    inputModalities: catalogModel ? [...catalogModel.inputModalities] : [...input.inputModalities],
    supportedReasoningEfforts: catalogModel ? [...catalogModel.supportedReasoningEfforts] : [],
    defaultReasoningEffort: catalogModel?.defaultReasoningEffort ?? null,
    reasoningEffort: input.reasoningEffort,
    bindingVersion: input.bindingVersion,
    sourceUpdatedAt: input.sourceUpdatedAt,
    blocked: false,
    operationId: null
  };
}

function isModelSwitchTerminal(result: ModelSwitchApiResult): result is ModelSwitchApiResult & {
  outcome: "switched" | "recovered" | "recovery_failed";
  operationId: string;
  latestState: ThreadModelStateView;
} {
  return Boolean(result.outcome && result.operationId && result.latestState);
}

function modelSwitchCodeMessage(code?: string): string {
  if (code === "CATALOG_REVISION_CONFLICT") return "模型目录已更新，请重新选择";
  if (code === "CURRENT_MODEL_STALE") return "当前模型状态已变化，请重新选择";
  if (code === "THREAD_BUSY") return "会话正在运行，暂时不能切换模型";
  if (code === "CONTEXT_COMPACTION_REQUIRED") return "当前上下文过大，请先手动压缩";
  return "模型切换未开始，请刷新状态后重试";
}

function contextUsageProgress(
  usage: ContextUsageSnapshot | null
): { percent: number; fillPercent: number; color: string } | null {
  const windowSize = usage?.modelContextWindow ?? null;
  if (!usage || !windowSize || windowSize <= 0) {
    return null;
  }
  const rawPercent = (usage.totalTokens / windowSize) * 100;
  const percent = Math.max(0, Math.round(rawPercent));
  return {
    percent,
    fillPercent: Math.max(0, Math.min(100, rawPercent)),
    color: contextUsageColor(percent)
  };
}

function contextWindowMismatch(
  usage: ContextUsageSnapshot | null,
  configuredContextWindow: number | null
): string | null {
  const actual = usage?.modelContextWindow ?? null;
  if (!actual || !configuredContextWindow || actual === configuredContextWindow) return null;
  return `实际 ${formatContextWindow(actual)} / 配置 ${formatContextWindow(configuredContextWindow)}`;
}

function formatContextWindow(value: number): string {
  if (value >= 1_000_000) return `${formatCompactNumber(value / 1_000_000)}M`;
  return `${formatCompactNumber(value / 1_000)}k`;
}

function contextUsageColor(percent: number): string {
  if (percent >= 95) return "var(--cw-danger)";
  if (percent >= 80) return "#ea580c";
  if (percent >= 60) return "#d97706";
  return "var(--cw-success)";
}

function formatTokenCount(value: number): string {
  if (value >= 1_000_000) {
    return `${formatCompactNumber(value / 1_000_000)}M`;
  }
  if (value >= 1_000) {
    return `${formatCompactNumber(value / 1_000)}K`;
  }
  return String(Math.max(0, Math.round(value)));
}

function formatCompactNumber(value: number): string {
  const rounded = value >= 10 ? Math.round(value) : Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

const headerShellStyle: React.CSSProperties = {
  position: "sticky",
  top: 0,
  zIndex: 30,
  background: "var(--cw-bg)"
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  padding: "8px 10px",
  background: "var(--cw-bg)"
};

const contextProgressButtonStyle: React.CSSProperties = {
  width: "100%",
  height: 16,
  padding: "0 10px",
  border: "none",
  borderTop: "1px solid var(--cw-border)",
  background: "var(--cw-bg)",
  display: "grid",
  gridTemplateColumns: "1fr 44px",
  alignItems: "center",
  gap: 8,
  cursor: "pointer",
  font: "inherit"
};

const contextProgressShellStyle: React.CSSProperties = {
  borderTop: "1px solid var(--cw-border)",
  background: "var(--cw-bg)"
};

const contextMismatchStyle: React.CSSProperties = {
  minHeight: 20,
  padding: "0 10px 4px",
  color: "var(--cw-warning, #d97706)",
  fontSize: 11,
  lineHeight: "16px",
  textAlign: "right"
};

const contextProgressUnavailableStyle: React.CSSProperties = {
  width: "100%",
  height: 16,
  padding: "0 10px",
  borderTop: "1px solid var(--cw-border)",
  background: "var(--cw-bg)",
  display: "grid",
  gridTemplateColumns: "1fr 44px",
  alignItems: "center",
  gap: 8
};

const modelRecoveryStyle: React.CSSProperties = {
  flex: "0 0 auto",
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "10px 12px",
  borderTop: "1px solid var(--cw-danger)",
  background: "color-mix(in srgb, var(--cw-danger) 9%, var(--cw-bg))"
};

const modelRecoveryTitleStyle: React.CSSProperties = {
  color: "var(--cw-danger)",
  fontSize: 13,
  fontWeight: 650
};

const modelRecoveryDescriptionStyle: React.CSSProperties = {
  marginTop: 2,
  color: "var(--cw-fg-muted)",
  fontSize: 11,
  lineHeight: "16px"
};

const modelRecoveryActionsStyle: React.CSSProperties = {
  flex: "0 0 auto",
  display: "flex",
  flexDirection: "column",
  gap: 4
};

const modelRecoveryPrimaryStyle: React.CSSProperties = {
  minHeight: 32,
  padding: "5px 10px",
  border: "none",
  borderRadius: 8,
  background: "var(--cw-danger)",
  color: "#fff",
  fontSize: 12
};

const modelRecoverySecondaryStyle: React.CSSProperties = {
  ...modelRecoveryPrimaryStyle,
  border: "1px solid var(--cw-border)",
  background: "transparent",
  color: "var(--cw-fg)"
};

const contextProgressTrackStyle: React.CSSProperties = {
  position: "relative",
  display: "block",
  height: 2,
  background: "color-mix(in srgb, var(--cw-border) 70%, transparent)",
  overflow: "hidden"
};

const contextProgressFillStyle: React.CSSProperties = {
  position: "absolute",
  inset: "0 auto 0 0",
  height: "100%"
};

const contextProgressLabelStyle: React.CSSProperties = {
  fontSize: 11,
  lineHeight: "16px",
  fontWeight: 650,
  textAlign: "right",
  fontVariantNumeric: "tabular-nums"
};

const contextProgressUnavailableLabelStyle: React.CSSProperties = {
  ...contextProgressLabelStyle,
  color: "var(--cw-fg-muted)"
};

const iconBtn: React.CSSProperties = {
  width: 36,
  height: 36,
  border: "none",
  background: "transparent",
  color: "var(--cw-fg)",
  fontSize: 20,
  borderRadius: 8
};

const scrollStyle: React.CSSProperties = {
  flex: 1,
  minHeight: 0,
  overflowY: "auto",
  padding: "12px",
  display: "flex",
  flexDirection: "column",
  gap: 10
};

const threadTimelineContentStyle: React.CSSProperties = {
  width: "100%",
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
  gap: 10
};

const jumpBtn: React.CSSProperties = {
  position: "absolute",
  right: 16,
  bottom: "calc(128px + var(--safe-bottom))",
  background: "var(--cw-card)",
  border: "1px solid var(--cw-border)",
  color: "var(--cw-fg)",
  borderRadius: 18,
  padding: "6px 12px",
  fontSize: 13,
  boxShadow: "0 4px 12px rgba(0,0,0,0.2)"
};

const sheetStyle: React.CSSProperties = {
  background: "var(--cw-card)",
  borderTop: "1px solid var(--cw-border)",
  borderTopLeftRadius: 18,
  borderTopRightRadius: 18,
  padding: "8px 8px calc(8px + var(--safe-bottom))",
  display: "flex",
  flexDirection: "column",
  maxHeight: "50dvh",
  overflowY: "auto",
  boxShadow: "0 -12px 32px rgba(0,0,0,0.28)"
};

const sheetMutedItemStyle: React.CSSProperties = {
  padding: "14px 12px",
  borderTop: "1px solid var(--cw-border)",
  fontSize: 16,
  color: "var(--cw-fg-muted)"
};

const goalSheetStyle: React.CSSProperties = {
  background: "var(--cw-card)",
  borderTop: "1px solid var(--cw-border)",
  borderTopLeftRadius: 18,
  borderTopRightRadius: 18,
  padding: "0 14px calc(14px + var(--safe-bottom))",
  display: "flex",
  flexDirection: "column",
  gap: 12,
  maxHeight: "76dvh",
  overflowY: "auto",
  boxShadow: "0 -12px 32px rgba(0,0,0,0.28)"
};

const contextUsageSheetStyle: React.CSSProperties = {
  background: "var(--cw-card)",
  borderTop: "1px solid var(--cw-border)",
  borderTopLeftRadius: 18,
  borderTopRightRadius: 18,
  padding: "0 14px calc(14px + var(--safe-bottom))",
  display: "flex",
  flexDirection: "column",
  gap: 14,
  maxHeight: "60dvh",
  overflowY: "auto",
  boxShadow: "0 -12px 32px rgba(0,0,0,0.28)"
};

const contextUsageSheetHeaderStyle: React.CSSProperties = {
  minHeight: 58,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  borderBottom: "1px solid var(--cw-border)"
};

const contextUsageTitleStyle: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 650,
  color: "var(--cw-fg)"
};

const contextUsageSubtitleStyle: React.CSSProperties = {
  marginTop: 2,
  fontSize: 12,
  color: "var(--cw-fg-muted)"
};

const contextUsageSummaryStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
  gap: 12,
  fontSize: 22,
  fontWeight: 700,
  fontVariantNumeric: "tabular-nums",
  color: "var(--cw-fg)"
};

const contextUsageMetricsStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: 8,
  color: "var(--cw-fg-muted)",
  fontSize: 13,
  fontVariantNumeric: "tabular-nums"
};

const goalSheetHeaderStyle: React.CSSProperties = {
  minHeight: 58,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  borderBottom: "1px solid var(--cw-border)"
};

const goalSheetTitleStyle: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 650,
  color: "var(--cw-fg)"
};

const goalSheetSubtitleStyle: React.CSSProperties = {
  marginTop: 2,
  fontSize: 12,
  color: "var(--cw-fg-muted)"
};

const goalFieldStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6
};

const goalLabelStyle: React.CSSProperties = {
  fontSize: 13,
  color: "var(--cw-fg-muted)"
};

const goalTextareaStyle: React.CSSProperties = {
  minHeight: 92,
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid var(--cw-border)",
  background: "var(--cw-bg)",
  color: "var(--cw-fg)",
  resize: "vertical",
  outline: "none",
  fontSize: 15,
  lineHeight: "21px"
};

const goalErrorStyle: React.CSSProperties = {
  color: "var(--cw-danger)",
  fontSize: 13
};

const goalActionsStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10
};

function permissionRowStyle(active: boolean): React.CSSProperties {
  return {
    padding: "12px",
    border: "none",
    borderTop: "1px solid var(--cw-border)",
    background: active ? "color-mix(in srgb, var(--cw-accent) 12%, transparent)" : "transparent",
    color: active ? "var(--cw-accent)" : "var(--cw-fg)",
    textAlign: "left",
    display: "flex",
    flexDirection: "column",
    gap: 4
  };
}

const permissionRowDescStyle: React.CSSProperties = {
  fontSize: 12,
  color: "var(--cw-fg-muted)"
};

const dialogStyle: React.CSSProperties = {
  background: "var(--cw-card)",
  border: "1px solid var(--cw-border)",
  borderRadius: 14,
  padding: 16,
  margin: 16,
  display: "flex",
  flexDirection: "column",
  gap: 12
};

const inputStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid var(--cw-border)",
  background: "var(--cw-bg)",
  color: "var(--cw-fg)",
  fontSize: 15
};

const btnGhost: React.CSSProperties = {
  padding: "8px 14px",
  borderRadius: 10,
  border: "1px solid var(--cw-border)",
  background: "transparent",
  color: "var(--cw-fg)"
};

const btnPrimary: React.CSSProperties = {
  padding: "8px 14px",
  borderRadius: 10,
  border: "none",
  background: "var(--cw-accent)",
  color: "#fff"
};

const btnPrimaryDisabled: React.CSSProperties = {
  ...btnPrimary,
  background: "color-mix(in srgb, var(--cw-fg-subtle) 18%, var(--cw-bg-elevated))",
  color: "var(--cw-fg-subtle)"
};

const btnDangerGhost: React.CSSProperties = {
  padding: "8px 0",
  border: "none",
  background: "transparent",
  color: "var(--cw-danger)",
  fontSize: 14
};

const toastStyle: React.CSSProperties = {
  position: "fixed",
  left: "50%",
  transform: "translateX(-50%)",
  bottom: "calc(128px + var(--safe-bottom))",
  background: "var(--cw-card)",
  border: "1px solid var(--cw-border)",
  borderRadius: 10,
  padding: "8px 14px",
  fontSize: 14,
  boxShadow: "0 6px 18px rgba(0,0,0,0.25)",
  zIndex: 80
};
