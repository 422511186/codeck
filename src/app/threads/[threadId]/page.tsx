"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { codex, type UpdateThreadSettingsInput } from "../../../web/api/endpoints";
import { ApiError } from "../../../web/api/client";
import { createRequestCoordinator, isRequestAbort } from "../../../web/api/requestCoordinator";
import { useStore } from "../../../web/state/store";
import { hasVisibleTurnOutput, rollbackMetadataForEntry, timelineItemToEntry, type TimelineEntry } from "../../../web/state/timeline";
import { Timeline } from "../../../web/components/Timeline";
import { PlanBar } from "../../../web/components/cards/PlanBar";
import { ChatInput } from "../../../web/components/ChatInput";
import {
  repairReconstructedTimelineEntries,
  threadDetailEntries
} from "../../../web/state/timeline-adapter";
import {
  DEFAULT_COLLABORATION_MODEL,
  collaborationModeForChatMode,
  type ApprovalsReviewer,
  type ChatMode,
  type ModelOption,
  type PendingServerRequest,
  type SkillReference,
  type ThreadDetail,
  type ThreadSummary,
  type ThreadGoal
} from "../../../web/api/types";
import { loadJson, saveJson, threadModeKey, threadPermissionProfileKey } from "../../../web/storage/localStore";
import { setDraft } from "../../../web/storage/drafts";
import { getContextUsage, type ContextUsageSnapshot } from "../../../web/storage/contextUsage";
import { settingsStore } from "../../../web/storage/settings";
import { invalidateTimelineEventThread } from "../../../web/events/client";

const EMPTY_ENTRIES: TimelineEntry[] = [];
const EMPTY_APPROVALS: PendingServerRequest[] = [];
const EMPTY_PLAN: Array<{ text: string; completed: boolean }> = [];
const ACTIVE_THREAD_SUMMARY_POLL_DELAY_MS = 3_000;
const SNAPSHOT_REPAIR_RETRY_DELAY_MS = 3_000;
const MAX_COMPLETION_REPAIR_ATTEMPTS = 4;
const DEFAULT_COMPOSER_HEIGHT = 144;
const COMPACTING_CONTEXT_TEXT = "正在压缩上下文…";

type SnapshotRepairRetryInput = {
  reason: "turn-completed" | "summary-idle" | "mutation-retry";
  turnId?: string;
  generation?: number;
};

export default function ThreadPage(): JSX.Element {
  const params = useParams<{ threadId: string }>();
  const router = useRouter();
  const threadId = String(params?.threadId ?? "");

  const ensureThread = useStore((s) => s.ensureThread);
  const setThreadEntries = useStore((s) => s.setThreadEntries);
  const mergeThreadEntries = useStore((s) => s.mergeThreadEntries);
  const prependEntries = useStore((s) => s.prependEntries);
  const appendEntries = useStore((s) => s.appendEntries);
  const replaceOrAddEntry = useStore((s) => s.replaceOrAddEntry);
  const setMode = useStore((s) => s.setMode);
  const setModel = useStore((s) => s.setModel);
  const setPermissionProfile = useStore((s) => s.setPermissionProfile);
  const setContextUsage = useStore((s) => s.setContextUsage);
  const setThreadStatus = useStore((s) => s.setThreadStatus);
  const setActiveTurnId = useStore((s) => s.setActiveTurnId);
  const bindLocalUserMessageTurn = useStore((s) => s.bindLocalUserMessageTurn);
  const setTimelineGeneration = useStore((s) => s.setTimelineGeneration);
  const invalidateTimelineDelivery = useStore((s) => s.invalidateTimelineDelivery);
  const markTurnInterrupted = useStore((s) => s.markTurnInterrupted);
  const markTurnDeleted = useStore((s) => s.markTurnDeleted);
  const setActiveThread = useStore((s) => s.setActiveThread);
  const requestSnapshotRepair = useStore((s) => s.requestSnapshotRepair);
  const clearSnapshotRepair = useStore((s) => s.clearSnapshotRepair);
  const setPendingRequests = useStore((s) => s.setPendingRequests);
  const resolvePendingRequest = useStore((s) => s.resolvePendingRequest);
  const threadRunning = useStore((s) => s.threads[threadId]?.running ?? false);
  const threadStatus = useStore((s) => s.threads[threadId]?.status ?? null);
  const threadActiveTurnId = useStore((s) => s.threads[threadId]?.activeTurnId ?? null);
  const threadMode = useStore((s) => s.threads[threadId]?.mode ?? "build");
  const threadModel = useStore((s) => s.threads[threadId]?.model ?? null);
  const threadModelEffort = useStore((s) => s.threads[threadId]?.modelEffort ?? null);
  const threadPermissionProfileId = useStore((s) => s.threads[threadId]?.permissionProfileId);
  const threadApprovalsReviewer = useStore((s) => s.threads[threadId]?.approvalsReviewer);
  const threadContextUsage = useStore((s) => s.threads[threadId]?.contextUsage ?? null);
  const repairRequestedAt = useStore((s) => s.threads[threadId]?.repairRequestedAt ?? null);
  const hasCachedEntries = useStore((s) => Boolean(s.threads[threadId]?.entries.length));
  const compactCompletionSeen = useStore((s) => threadHasCompactCompletion(s.threads[threadId]));
  const repairRequest = useStore((s) => s.threads[threadId]?.repairRequest ?? null);
  const wsState = useStore((s) => s.wsState);
  const webSettings = settingsStore.get();

  const [detail, setDetail] = useState<ThreadDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSheet, setShowSheet] = useState(false);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [showPermissionPicker, setShowPermissionPicker] = useState(false);
  const [models, setModels] = useState<ModelOption[] | null>(null);
  const [serverDefaults, setServerDefaults] = useState<{
    model: string | null;
    reasoningEffort: string | null;
    reasoningSummary: string | null;
  }>({
    model: null,
    reasoningEffort: null,
    reasoningSummary: null
  });
  const [renameOpen, setRenameOpen] = useState(false);
  const [compactOpen, setCompactOpen] = useState(false);
  const [compactPending, setCompactPending] = useState(false);
  const [archiveToast, setArchiveToast] = useState<{ visible: boolean } | null>(null);
  const [showJumpLatest, setShowJumpLatest] = useState(false);
  const [draftOverride, setDraftOverride] = useState<{ text: string; version: number } | null>(null);
  const [goalEditorOpen, setGoalEditorOpen] = useState(false);
  const [contextUsageOpen, setContextUsageOpen] = useState(false);
  const [composerHeight, setComposerHeight] = useState(DEFAULT_COMPOSER_HEIGHT);

  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const atBottomRef = useRef(true);
  const pendingSendKeysRef = useRef(new Set<string>());
  const mutationEpochRef = useRef(0);
  const requestCoordinatorRef = useRef(createRequestCoordinator());
  const invalidatedRepairSignalsRef = useRef(new Set<string>());
  const loadingPageCursorsRef = useRef(new Set<string>());
  const pendingSettingsRef = useRef<UpdateThreadSettingsInput | null>(null);
  const settingsFlushRef = useRef<Promise<void> | null>(null);
  const compactActionPendingRef = useRef(false);
  const streamDisconnectedRepairKeysRef = useRef(new Set<string>());
  const repairRetryTimerRef = useRef<number | null>(null);
  const completionRepairAttemptsRef = useRef(new Map<string, number>());

  const configuredModel = threadModel ?? detail?.model ?? webSettings.defaultModel ?? null;
  const effectiveModel = configuredModel ?? serverDefaults.model ?? DEFAULT_COLLABORATION_MODEL;
  const configuredReasoningEffort = threadModelEffort ?? detail?.reasoningEffort ?? null;
  const effectiveReasoningEffort = configuredReasoningEffort ?? serverDefaults.reasoningEffort ?? null;
  const effectiveReasoningSummary = serverDefaults.reasoningSummary ?? "detailed";
  const detailPermissionProfileId =
    detail && "activePermissionProfile" in detail
      ? detail.activePermissionProfile?.id ?? null
      : undefined;
  const detailApprovalsReviewer =
    detail && "approvalsReviewer" in detail
      ? detail.approvalsReviewer ?? null
      : undefined;
  const effectivePermissionPayload = resolveEffectivePermissionPayload({
    localProfileId: threadPermissionProfileId,
    localApprovalsReviewer: threadApprovalsReviewer,
    detailProfileId: detailPermissionProfileId,
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

  useEffect(() => {
    compactActionPendingRef.current = false;
    streamDisconnectedRepairKeysRef.current.clear();
    completionRepairAttemptsRef.current.clear();
    setCompactPending(false);
    clearRepairRetryTimer();
    return clearRepairRetryTimer;
  }, [threadId, clearRepairRetryTimer]);

  useEffect(() => {
    if (wsState === "open" || wsState === "idle") {
      streamDisconnectedRepairKeysRef.current.clear();
    }
  }, [wsState]);

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
    return () => {
      cancelled = true;
    };
  }, []);

  const applyThreadDetail = useCallback(
    (
      td: ThreadDetail,
      mode: "replace" | "merge" = "replace",
      targetThreadId = threadId,
      entriesOverride?: TimelineEntry[],
      detailEntries: TimelineEntry[] = []
    ) => {
      if (targetThreadId === threadId) {
        setDetail(td);
      }
      const entries: TimelineEntry[] =
        entriesOverride ??
        threadDetailEntries(td);
      const nextCursor = td.nextCursor ?? null;
      if (mode === "merge") {
        mergeThreadEntries(targetThreadId, entries, nextCursor);
      } else {
        if (detailEntries.length) {
          setThreadEntries(targetThreadId, entries, nextCursor, detailEntries);
        } else {
          setThreadEntries(targetThreadId, entries, nextCursor);
        }
      }
      if (typeof td.generation === "number") {
        setTimelineGeneration(targetThreadId, td.generation);
      }
      if (td.model) {
        setModel(targetThreadId, td.model, td.reasoningEffort ?? null);
      }
      if (td.contextUsage) {
        setContextUsage(targetThreadId, td.contextUsage);
      }
      if ("activePermissionProfile" in td) {
        const profileId = td.activePermissionProfile?.id ?? null;
        const approvalsReviewer = "approvalsReviewer" in td ? td.approvalsReviewer ?? null : undefined;
        setPermissionProfile(targetThreadId, profileId, approvalsReviewer);
        if (approvalsReviewer !== undefined) {
          savePermissionSelection(targetThreadId, {
            permissions: profileId,
            approvalsReviewer
          });
        }
      }
      setThreadStatus(targetThreadId, td.status, isThreadRunningStatus(td.status) ? td.lastTurnId : null);
    },
    [
      threadId,
      setThreadEntries,
      mergeThreadEntries,
      setTimelineGeneration,
      setModel,
      setContextUsage,
      setPermissionProfile,
      setThreadStatus
    ]
  );

  const applyThreadSummaryStatus = useCallback(
    (summary: ThreadSummary) => {
      setThreadStatus(summary.id, summary.status);
      if (summary.id !== threadId) return;
      setDetail((prev) =>
        prev
          ? {
              ...prev,
              ...summary,
              lastTurnId: isThreadRunningStatus(summary.status) ? prev.lastTurnId : null,
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
      setPermissionProfile(threadId, savedPermissionProfile.permissions, savedPermissionProfile.approvalsReviewer);
    }
    let cancelled = false;
    const requestEpoch = mutationEpochRef.current;
    setLoading(true);
    (async () => {
      try {
        const td = await requestCoordinatorRef.current.dedupeRequest(
          `thread:${threadId}:detail`,
          () => codex.readThread(threadId)
        ).catch((err) => recoverInitialThreadDetail(threadId, err));
        const initialPage = await requestCoordinatorRef.current.dedupeRequest(
          `thread:${threadId}:turns:initial`,
          () => codex.listTurnsBefore(threadId, null)
        );
        if (cancelled) return;
        if (requestEpoch !== mutationEpochRef.current) return;
        applyThreadDetail({
          ...td,
          timeline: initialPage.items,
          nextCursor: initialPage.nextCursor ?? null
        }, "replace");
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
  }, [threadId, ensureThread, applyThreadDetail, setMode, setPermissionProfile, setActiveThread]);

  const repairSignal = repairRequest?.key ?? (repairRequestedAt ? String(repairRequestedAt) : null);

  useEffect(() => {
    if (!repairSignal) return;
    if (!invalidatedRepairSignalsRef.current.has(repairSignal)) {
      invalidatedRepairSignalsRef.current.add(repairSignal);
      const clientEpoch = invalidateTimelineEventThread(threadId);
      invalidateTimelineDelivery?.(threadId, clientEpoch || undefined);
    }
    let cancelled = false;
    const requestEpoch = mutationEpochRef.current;
    (async () => {
      try {
        const [td, page] = await Promise.all([
          requestCoordinatorRef.current.dedupeRequest(
            `thread:${threadId}:repair:metadata`,
            () => codex.readThread(threadId)
          ),
          requestCoordinatorRef.current.dedupeRequest(
            `thread:${threadId}:repair:items`,
            () => codex.listTurnsBefore(threadId, null)
          )
        ]);
        if (cancelled) return;
        if (requestEpoch !== mutationEpochRef.current) {
          requestSnapshotRepair(threadId, repairRequest ?? { reason: "mutation-retry" });
          return;
        }
        const currentThread = useStore.getState().threads[threadId];
        const currentCursor = currentThread ? currentThread.cursor : (page.nextCursor ?? null);
        applyThreadDetail({ ...td, timeline: page.items, nextCursor: currentCursor }, "merge");
        const completionRetry = completionRepairRetryInput(repairRequest);
        if (completionRetry && !timelinePageHasVisibleTurnOutput(page.items, completionRetry.turnId)) {
          const attemptKey = `${completionRetry.turnId}:${completionRetry.generation ?? "legacy"}`;
          const nextAttempt = (completionRepairAttemptsRef.current.get(attemptKey) ?? 0) + 1;
          if (nextAttempt <= MAX_COMPLETION_REPAIR_ATTEMPTS) {
            completionRepairAttemptsRef.current.set(attemptKey, nextAttempt);
            clearSnapshotRepair(threadId);
            scheduleSnapshotRepairRetry(completionRetry);
            return;
          }
          completionRepairAttemptsRef.current.delete(attemptKey);
        } else if (completionRetry) {
          completionRepairAttemptsRef.current.delete(
            `${completionRetry.turnId}:${completionRetry.generation ?? "legacy"}`
          );
        }
        clearRepairRetryTimer();
        clearSnapshotRepair(threadId);
      } catch (err) {
        if (isRequestAbort(err)) return;
        scheduleSnapshotRepairRetry();
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
    clearRepairRetryTimer,
    scheduleSnapshotRepairRetry,
    invalidateTimelineDelivery
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
          const hasVisibleOutput = threadHasVisibleOutput(currentThread, activeTurnId);
          compactActionPendingRef.current = false;
          setCompactPending(false);
          if (
            activeTurnId &&
            !hasVisibleOutput &&
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

  const onScroll = useCallback(
    async (event: React.UIEvent<HTMLDivElement>) => {
      const el = event.currentTarget;
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      atBottomRef.current = distanceFromBottom < 64;
      setShowJumpLatest(!atBottomRef.current);

      const currentThread = useStore.getState().threads[threadId];
      if (el.scrollTop < 64 && currentThread && !currentThread.reachedBeginning && currentThread.cursor) {
        const cursor = currentThread.cursor;
        const pageKey = `${threadId}\u0001${cursor}`;
        if (loadingPageCursorsRef.current.has(pageKey)) return;
        loadingPageCursorsRef.current.add(pageKey);
        try {
          const page = await requestCoordinatorRef.current.dedupeRequest(
            `thread:${threadId}:turns:${cursor}`,
            () => codex.listTurnsBefore(threadId, cursor)
          );
          const pageCreatedAtBase = Date.now() - 10_000;
          const extra = repairReconstructedTimelineEntries(
            page.items.map((it, i) =>
              timelineItemToEntry(it, pageCreatedAtBase + i)
            ),
            "pagination"
          );
          prependEntries(threadId, extra, page.nextCursor ?? null, page.nextCursor === null);
        } catch {
          // ignore page load failure
        } finally {
          loadingPageCursorsRef.current.delete(pageKey);
        }
      }
    },
    [threadId, prependEntries]
  );

  const onSend = useCallback(
    async (text: string, imagePaths: string[], skillReferences: SkillReference[] = []) => {
      const currentDetail =
        detail ??
        (useStore.getState().threads[threadId]?.entries.length
          ? cachedThreadDetailFromState(threadId, useStore.getState().threads[threadId])
          : null);
      if (!currentDetail) return;
      const currentStatus = threadStatus ?? currentDetail.status;
      const sendKey = sendPayloadKey(text, imagePaths, skillReferences);
      if (pendingSendKeysRef.current.has(sendKey)) return;
      pendingSendKeysRef.current.add(sendKey);
      const localUserMessageId = uniqueTimelineId("local-user");
      const optimisticEntry: TimelineEntry = {
        id: localUserMessageId,
        clientUserMessageId: localUserMessageId,
        createdAt: Date.now(),
        body: {
          kind: "user-message",
          text,
          ...(imagePaths.length ? { imagePaths } : {}),
          ...(skillReferences.length ? { skillReferences } : {}),
          status: "sending"
        }
      };
      appendEntries(threadId, [optimisticEntry]);
      bumpMutationEpoch();
      setThreadStatus(threadId, "active");
      try {
        const clientUserMessageId = optimisticEntry.clientUserMessageId ?? optimisticEntry.id;
        if (currentStatus === "notLoaded") {
          await requestCoordinatorRef.current.dedupeRequest(
            `thread:${threadId}:resume`,
            () => codex.resumeThread(threadId)
          );
        }
        const currentMode = useStore.getState().threads[threadId]?.mode ?? "build";
        const collaborationMode =
          currentMode === "plan"
            ? collaborationModeForChatMode("plan", effectiveModel, effectiveReasoningEffort)
            : undefined;
        const startInput = {
          threadId,
          clientUserMessageId,
          text,
          imagePaths,
          ...(skillReferences.length ? { skillReferences } : {}),
          ...(currentMode === "build" && configuredModel ? { model: configuredModel } : {}),
          ...(currentMode === "build" && configuredReasoningEffort ? { reasoningEffort: configuredReasoningEffort } : {}),
          ...(effectiveReasoningSummary ? { reasoningSummary: effectiveReasoningSummary } : {}),
          permissions: effectivePermissionPayload.permissions,
          approvalsReviewer: effectivePermissionPayload.approvalsReviewer,
          ...(collaborationMode ? { collaborationMode } : {})
        };
        const started = await codex.startTurn(startInput);
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
          body: {
            kind: "user-message",
            text,
            ...(imagePaths.length ? { imagePaths } : {}),
            ...(skillReferences.length ? { skillReferences } : {}),
            status: "sent"
          }
        });
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
        replaceOrAddEntry(threadId, {
          ...optimisticEntry,
          body: {
            kind: "user-message",
            text,
            ...(imagePaths.length ? { imagePaths } : {}),
            ...(skillReferences.length ? { skillReferences } : {}),
            status: "failed"
          }
        });
        appendEntries(threadId, [
          {
            id: `${optimisticEntry.id}-error`,
            createdAt: Date.now(),
            body: { kind: "error", text: `发送失败：${errorMessage(err)}` }
          }
        ]);
        setThreadStatus(threadId, "idle", null);
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
      setThreadStatus,
      setActiveTurnId,
      bindLocalUserMessageTurn,
      bumpMutationEpoch,
      requestSnapshotRepair
    ]
  );

  const onInterrupt = useCallback(async () => {
    const turnId = threadActiveTurnId ?? detail?.lastTurnId ?? undefined;
    try {
      await requestCoordinatorRef.current.runLockedAction(`interrupt:${threadId}`, async () => {
        await codex.interruptTurn(threadId, turnId);
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
    detail?.lastTurnId,
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
      const rollbackMetadata = target ? rollbackMetadataForEntry(entries, target, { cursor: currentThread?.cursor ?? null }) : null;
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

      try {
        const clientEpoch = invalidateTimelineEventThread(threadId);
        invalidateTimelineDelivery?.(threadId, clientEpoch || undefined);
        bumpMutationEpoch();
        const rolledBack = await rollbackThreadWithResume(
          threadId,
          rollbackMetadata.numTurns,
          rollbackMetadata.expectedDeletedTurnIds
        );
        for (const turnId of rollbackMetadata.expectedDeletedTurnIds) {
          markTurnDeleted(threadId, turnId);
        }
        applyThreadDetail(rolledBack, "replace");
        const draftText = target.body.kind === "user-message" ? target.body.text : entry.body.text;
        setDraft(threadId, draftText);
        setDraftOverride({ text: draftText, version: Date.now() });
      } catch (err) {
        appendEntries(threadId, [
          {
            id: uniqueTimelineId("rewind-error"),
            createdAt: Date.now(),
            body: { kind: "error", text: `回滚失败：${errorMessage(err)}` }
          }
        ]);
      }
    },
    [threadId, applyThreadDetail, appendEntries, markTurnDeleted, bumpMutationEpoch, invalidateTimelineDelivery]
  );

  const forkFromMessage = useCallback(
    async (entry: TimelineEntry) => {
      const currentThread = useStore.getState().threads[threadId];
      if (currentThread?.running || entry.body.kind !== "user-message") return;
      const entries = currentThread?.entries ?? [];
      const target = resolveCurrentUserMessage(entries, entry);
      const rollbackMetadata = target ? rollbackMetadataForEntry(entries, target, { cursor: currentThread?.cursor ?? null }) : null;
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

      try {
        const forked = await codex.forkThread(threadId);
        const forkEntries = "timeline" in forked && Array.isArray(forked.timeline) ? threadDetailEntries(forked) : [];
        const forkTarget = forkEntries.length ? resolveEquivalentUserMessage(forkEntries, target) : null;
        if (!forkTarget) {
          appendEntries(threadId, [
            {
              id: uniqueTimelineId("fork-error"),
              createdAt: Date.now(),
              body: { kind: "error", text: "无法在 Fork 后的会话中定位这条消息，请刷新后重试。" }
            }
          ]);
          return;
        }
        const forkRollbackMetadata = rollbackMetadataForEntry(forkEntries, forkTarget);
        if (!forkRollbackMetadata) {
          appendEntries(threadId, [
            {
              id: uniqueTimelineId("fork-error"),
              createdAt: Date.now(),
              body: { kind: "error", text: "无法计算 Fork 后的回滚范围，请刷新后重试。" }
            }
          ]);
          return;
        }
        const clientEpoch = invalidateTimelineEventThread(forked.id);
        invalidateTimelineDelivery?.(forked.id, clientEpoch || undefined);
        bumpMutationEpoch();
        const rolledBack = await rollbackThreadWithResume(
          forked.id,
          forkRollbackMetadata.numTurns,
          forkRollbackMetadata.expectedDeletedTurnIds
        );
        for (const turnId of forkRollbackMetadata.expectedDeletedTurnIds) {
          markTurnDeleted(forked.id, turnId);
        }
        applyThreadDetail(rolledBack, "replace", forked.id);
        setDraft(forked.id, target.body.kind === "user-message" ? target.body.text : entry.body.text);
        router.push(`/threads/${forked.id}`);
      } catch (err) {
        appendEntries(threadId, [
          {
            id: uniqueTimelineId("fork-error"),
            createdAt: Date.now(),
            body: { kind: "error", text: `Fork 失败：${errorMessage(err)}` }
          }
        ]);
      }
    },
    [threadId, applyThreadDetail, appendEntries, markTurnDeleted, router, bumpMutationEpoch, invalidateTimelineDelivery]
  );

  const openModelPicker = useCallback(async () => {
    setShowModelPicker(true);
    setModels(null);
    try {
      setModels(await requestCoordinatorRef.current.dedupeRequest("codex:models", () => codex.models()));
    } catch {
      setModels([]);
    }
  }, []);

  const onSelectModel = useCallback(
    async (model: ModelOption) => {
      setShowModelPicker(false);
      const nextEffort =
        effectiveReasoningEffort && model.supportedReasoningEfforts.includes(effectiveReasoningEffort)
          ? effectiveReasoningEffort
          : null;
      setModel(threadId, model.id, nextEffort);
      try {
        await enqueueThreadSettings({
          model: model.id,
          ...(nextEffort ? { reasoningEffort: nextEffort } : {})
        });
      } catch (err) {
        // optimistic — surface error
        console.warn("update model failed", err);
      }
    },
    [threadId, effectiveReasoningEffort, setModel, enqueueThreadSettings]
  );

  const onSelectReasoningEffort = useCallback(
    async (effort: string) => {
      setModel(threadId, effectiveModel, effort);
      try {
        await enqueueThreadSettings({
          model: effectiveModel,
          reasoningEffort: effort
        });
      } catch (err) {
        console.warn("update reasoning effort failed", err);
      }
    },
    [threadId, effectiveModel, setModel, enqueueThreadSettings]
  );

  const onSelectPermissionMode = useCallback(
    async (modeId: PermissionModeId) => {
      const mode = permissionModeById(modeId);
      const previous = effectivePermissionPayload;
      setShowPermissionPicker(false);
      setPermissionProfile(threadId, mode.permissions, mode.approvalsReviewer);
      savePermissionSelection(threadId, mode);
      try {
        await enqueueThreadSettings({
          permissions: mode.permissions,
          approvalsReviewer: mode.approvalsReviewer
        });
      } catch (err) {
        setPermissionProfile(threadId, previous.permissions, previous.approvalsReviewer);
        savePermissionSelection(threadId, previous);
        appendEntries(threadId, [
          {
            id: uniqueTimelineId("permission-error"),
            createdAt: Date.now(),
            body: { kind: "error", text: `权限切换失败：${errorMessage(err)}` }
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
        <button type="button" onClick={() => router.back()} style={btnGhost}>
          返回
        </button>
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
        onBack={() => router.back()}
        onToggleMode={onToggleMode}
        onOpenContextUsage={() => setContextUsageOpen(true)}
        onOpenActions={() => setShowSheet(true)}
      />

      <ThreadPlanBar threadId={threadId} />

      <ThreadTimelineViewport
        threadId={threadId}
        scrollerRef={scrollerRef}
        followTail={atBottomRef.current}
        onScroll={onScroll}
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

      <ThreadComposerDock
        threadId={threadId}
        cwd={visibleDetail?.cwd}
        running={running}
        disabled={!visibleDetail}
        draftOverride={draftOverride ?? undefined}
        permissionLabel={effectivePermissionMode.label}
        permissionDescription={effectivePermissionMode.description}
        modelLabel={shortModel(modelId)}
        reasoningEffortLabel={effectiveReasoningEffort ? reasoningEffortLabel(effectiveReasoningEffort) : undefined}
        goal={currentGoal}
        onHeightChange={handleComposerHeightChange}
        onOpenPermissionPicker={() => setShowPermissionPicker(true)}
        onOpenModelPicker={openModelPicker}
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
        <ModelPicker
          models={models}
          current={modelId}
          currentEffort={effectiveReasoningEffort}
          onSelect={onSelectModel}
          onSelectEffort={onSelectReasoningEffort}
          onClose={() => setShowModelPicker(false)}
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
  onBack,
  onToggleMode,
  onOpenContextUsage,
  onOpenActions
}: {
  title: string;
  mode: ChatMode;
  contextUsage: ContextUsageSnapshot | null;
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
      <ContextUsageProgress usage={contextUsage} onOpen={onOpenContextUsage} />
    </div>
  );
}

function ContextUsageProgress({
  usage,
  onOpen
}: {
  usage: ContextUsageSnapshot | null;
  onOpen: () => void;
}): JSX.Element {
  const progress = contextUsageProgress(usage);
  if (!progress) {
    return (
      <div aria-label="上下文窗口等待用量" style={contextProgressUnavailableStyle}>
        <span aria-hidden="true" style={contextProgressTrackStyle} />
        <span style={contextProgressUnavailableLabelStyle}>--%</span>
      </div>
    );
  }
  return (
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
  onSend: (text: string, imagePaths: string[], skillReferences?: SkillReference[]) => Promise<void>;
  onRewindToMessage: (entry: TimelineEntry) => void | Promise<void>;
  onForkFromMessage: (entry: TimelineEntry) => void | Promise<void>;
  onResolveApproval: (req: PendingServerRequest) => void | Promise<void>;
  onExecutePlan: (entries: TimelineEntry[]) => void | Promise<void>;
  processing: boolean;
  processingLabel: string;
}): JSX.Element {
  const entries = useStore((s) => s.threads[threadId]?.entries ?? EMPTY_ENTRIES);
  const approvals = useStore((s) => s.threads[threadId]?.pendingApprovals ?? EMPTY_APPROVALS);
  const running = useStore((s) => s.threads[threadId]?.running ?? false);
  const activeTurnId = useStore((s) => s.threads[threadId]?.activeTurnId ?? null);
  const mode = useStore((s) => s.threads[threadId]?.mode ?? "build");
  const reachedBeginning = useStore((s) => s.threads[threadId]?.reachedBeginning ?? false);

  return (
    <div
      ref={scrollerRef}
      className="cw-thread-scroller"
      onScroll={onScroll}
      style={scrollStyle}
    >
      {reachedBeginning ? (
        <div style={{ textAlign: "center", color: "var(--cw-fg-subtle)", padding: 16, fontSize: 12 }}>会话开始</div>
      ) : null}
      <Timeline
        threadId={threadId}
        entries={entries}
        followTail={followTail}
        approvals={approvals}
        running={running}
        activeTurnId={activeTurnId}
        onResendUser={async (text, imagePaths, skillReferences) => {
          await onSend(text, imagePaths, skillReferences);
        }}
        onRewindToMessage={onRewindToMessage}
        onForkFromMessage={onForkFromMessage}
        onResolveApproval={async (req) => {
          await onResolveApproval(req);
        }}
      />
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
  );
}

function ThreadComposerDock({
  threadId,
  cwd,
  running,
  disabled,
  draftOverride,
  permissionLabel,
  permissionDescription,
  modelLabel,
  reasoningEffortLabel,
  goal,
  onHeightChange,
  onOpenPermissionPicker,
  onOpenModelPicker,
  onOpenGoalEditor,
  onSend,
  onInterrupt
}: {
  threadId: string;
  cwd?: string;
  running: boolean;
  disabled: boolean;
  draftOverride?: { text: string; version: number };
  permissionLabel: string;
  permissionDescription?: string;
  modelLabel: string;
  reasoningEffortLabel?: string;
  goal?: ThreadGoal | null;
  onHeightChange: (height: number) => void;
  onOpenPermissionPicker: () => void;
  onOpenModelPicker: () => void;
  onOpenGoalEditor: () => void;
  onSend: (text: string, imagePaths: string[], skillReferences?: SkillReference[]) => Promise<void>;
  onInterrupt: () => Promise<void>;
}): JSX.Element {
  return (
    <ChatInput
      threadId={threadId}
      cwd={cwd}
      running={running}
      disabled={disabled}
      draftOverride={draftOverride}
      permissionLabel={permissionLabel}
      permissionDescription={permissionDescription}
      modelLabel={modelLabel}
      reasoningEffortLabel={reasoningEffortLabel}
      goal={goal}
      onHeightChange={onHeightChange}
      onOpenPermissionPicker={onOpenPermissionPicker}
      onOpenModelPicker={onOpenModelPicker}
      onOpenGoalEditor={onOpenGoalEditor}
      onSend={onSend}
      onInterrupt={onInterrupt}
    />
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

function ModelPicker({
  models,
  current,
  currentEffort,
  onSelect,
  onSelectEffort,
  onClose
}: {
  models: ModelOption[] | null;
  current: string | null;
  currentEffort: string | null;
  onSelect: (m: ModelOption) => void;
  onSelectEffort: (effort: string) => void;
  onClose: () => void;
}): JSX.Element {
  const currentModel = models?.find((model) => model.id === current) ?? null;
  const efforts = currentModel?.supportedReasoningEfforts ?? [];

  return (
    <Overlay onClose={onClose} align="bottom">
      <div style={sheetStyle}>
        <div style={{ padding: "8px 12px", color: "var(--cw-fg-muted)", fontSize: 13 }}>选择模型</div>
        {models === null ? (
          <div style={{ padding: 16, color: "var(--cw-fg-muted)" }}>载入中…</div>
        ) : models.length === 0 ? (
          <div style={{ padding: 16, color: "var(--cw-fg-muted)" }}>暂无可用模型</div>
        ) : (
          models.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => onSelect(m)}
              style={{
                padding: "12px",
                border: "none",
                background: "transparent",
                textAlign: "left",
                fontSize: 15,
                color: current === m.id ? "var(--cw-accent)" : "var(--cw-fg)"
              }}
            >
              {m.label}
              {m.isDefault ? <span style={{ marginLeft: 6, fontSize: 12, color: "var(--cw-fg-subtle)" }}>· 默认</span> : null}
            </button>
          ))
        )}
        {efforts.length > 0 ? (
          <div
            style={{
              marginTop: 8,
              padding: "10px 12px 12px",
              borderTop: "1px solid var(--cw-border)",
              display: "flex",
              flexDirection: "column",
              gap: 8
            }}
          >
            <div style={{ color: "var(--cw-fg-muted)", fontSize: 13 }}>推理强度</div>
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${efforts.length}, 1fr)`, gap: 6 }}>
              {efforts.map((effort) => {
                const active = currentEffort === effort;
                return (
                  <button
                    key={effort}
                    type="button"
                    onClick={() => onSelectEffort(effort)}
                    style={{
                      padding: "9px 6px",
                      borderRadius: 8,
                      border: `1px solid ${active ? "var(--cw-accent)" : "var(--cw-border)"}`,
                      background: active ? "var(--cw-accent)" : "transparent",
                      color: active ? "#fff" : "var(--cw-fg)",
                      fontSize: 13
                    }}
                  >
                    {reasoningEffortLabel(effort)}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    </Overlay>
  );
}

function PermissionPicker({
  current,
  onSelect,
  onClose
}: {
  current: PermissionModeId;
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

type PermissionModeId = "request-approval" | "auto-approve" | "full-access" | "config-default";

type PermissionPayload = {
  permissions: string | null;
  approvalsReviewer: ApprovalsReviewer | null;
};

type PermissionMode = PermissionPayload & {
  id: PermissionModeId;
  label: string;
  description: string;
};

type StoredPermissionSelection = PermissionPayload | string | null;

const PERMISSION_MODES: PermissionMode[] = [
  {
    id: "request-approval",
    label: "请求批准",
    description: "编辑外部文件和使用互联网时始终询问",
    permissions: ":workspace",
    approvalsReviewer: "user"
  },
  {
    id: "auto-approve",
    label: "替我审批",
    description: "仅对检测到的风险操作请求批准",
    permissions: ":workspace",
    approvalsReviewer: "auto_review"
  },
  {
    id: "full-access",
    label: "完全访问权限",
    description: "可不受限制地访问互联网和电脑上的任何文件",
    permissions: ":danger-full-access",
    approvalsReviewer: null
  },
  {
    id: "config-default",
    label: "自定义 config.toml",
    description: "使用 config.toml 中定义的权限",
    permissions: null,
    approvalsReviewer: null
  }
];

const CONFIG_DEFAULT_PERMISSION_MODE = PERMISSION_MODES[3];

function permissionModeById(id: PermissionModeId): PermissionMode {
  return PERMISSION_MODES.find((mode) => mode.id === id) ?? CONFIG_DEFAULT_PERMISSION_MODE;
}

function permissionModeFromPayload(payload: PermissionPayload): PermissionMode {
  if (payload.permissions === ":workspace" && payload.approvalsReviewer === "auto_review") {
    return permissionModeById("auto-approve");
  }
  if (payload.permissions === ":workspace") {
    return permissionModeById("request-approval");
  }
  if (payload.permissions === ":danger-full-access") {
    return permissionModeById("full-access");
  }
  return CONFIG_DEFAULT_PERMISSION_MODE;
}

function resolveEffectivePermissionPayload({
  localProfileId,
  localApprovalsReviewer,
  detailProfileId,
  detailApprovalsReviewer
}: {
  localProfileId?: string | null;
  localApprovalsReviewer?: ApprovalsReviewer | null;
  detailProfileId?: string | null;
  detailApprovalsReviewer?: ApprovalsReviewer | null;
}): PermissionPayload {
  if (localProfileId !== undefined) {
    return normalizePermissionPayload(localProfileId, localApprovalsReviewer);
  }
  if (detailProfileId !== undefined) {
    return normalizePermissionPayload(detailProfileId, detailApprovalsReviewer);
  }
  return CONFIG_DEFAULT_PERMISSION_MODE;
}

function normalizePermissionPayload(
  permissions: string | null | undefined,
  approvalsReviewer: ApprovalsReviewer | null | undefined
): PermissionPayload {
  if (permissions === ":workspace" || permissions === "workspace-write" || permissions === "read-only") {
    return {
      permissions: ":workspace",
      approvalsReviewer: approvalsReviewer === "auto_review" ? "auto_review" : "user"
    };
  }
  if (
    permissions === ":danger-full-access" ||
    permissions === "danger-full-access" ||
    permissions === "full-auto"
  ) {
    return {
      permissions: ":danger-full-access",
      approvalsReviewer: null
    };
  }
  return CONFIG_DEFAULT_PERMISSION_MODE;
}

function savePermissionSelection(threadId: string, selection: PermissionPayload): void {
  saveJson(threadPermissionProfileKey(threadId), {
    permissions: selection.permissions,
    approvalsReviewer: selection.approvalsReviewer
  });
}

function normalizeStoredPermissionSelection(value: StoredPermissionSelection | undefined): PermissionPayload | undefined {
  if (value === undefined) return undefined;
  if (value === null) return CONFIG_DEFAULT_PERMISSION_MODE;
  if (typeof value === "string") {
    return normalizePermissionPayload(value, undefined);
  }
  if (typeof value === "object") {
    const rawPermissions = value.permissions;
    const permissions = typeof rawPermissions === "string" || rawPermissions === null ? rawPermissions : undefined;
    return normalizePermissionPayload(permissions, approvalsReviewerOrNull(value.approvalsReviewer));
  }
  return undefined;
}

function approvalsReviewerOrNull(value: unknown): ApprovalsReviewer | null {
  return value === "user" || value === "auto_review" || value === "guardian_subagent" ? value : null;
}

function isThreadNotFoundError(error: unknown): boolean {
  return error instanceof ApiError && /thread not found|找不到会话/i.test(error.message);
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

function sendPayloadKey(text: string, imagePaths: string[], skillReferences: SkillReference[] = []): string {
  const images = [...imagePaths].sort().join("\u0000");
  const skills = [...skillReferences].map((skill) => `${skill.name}\u0000${skill.path}`).sort().join("\u0000");
  return `${text.trim()}\u0001${images}\u0001${skills}`;
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

async function rollbackThreadWithResume(
  threadId: string,
  numTurns: number,
  expectedDeletedTurnIds: string[] = []
): Promise<ThreadDetail> {
  try {
    return await codex.rollbackThread(threadId, numTurns, { expectedDeletedTurnIds });
  } catch (err) {
    if (!isThreadNotFoundError(err)) {
      throw err;
    }
    await codex.resumeThread(threadId);
    return codex.rollbackThread(threadId, numTurns, { expectedDeletedTurnIds });
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
  const targetText = target.body.text.trim();
  const matches = entries.filter(
    (entry) => entry.body.kind === "user-message" && entry.body.text.trim() === targetText
  );
  return matches.length === 1 ? matches[0] : null;
}

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : "未知错误";
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
