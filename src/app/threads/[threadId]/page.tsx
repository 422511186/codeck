"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { codex, type UpdateThreadSettingsInput } from "../../../web/api/endpoints";
import { ApiError } from "../../../web/api/client";
import { createRequestCoordinator, isRequestAbort } from "../../../web/api/requestCoordinator";
import { useStore } from "../../../web/state/store";
import { rollbackTurnsForEntry, timelineItemToEntry, type TimelineEntry } from "../../../web/state/timeline";
import { Timeline } from "../../../web/components/Timeline";
import { PlanBar } from "../../../web/components/cards/PlanBar";
import { ChatInput } from "../../../web/components/ChatInput";
import {
  DEFAULT_COLLABORATION_MODEL,
  collaborationModeForChatMode,
  type ApprovalsReviewer,
  type ChatMode,
  type ModelOption,
  type PendingServerRequest,
  type SkillReference,
  type ThreadDetail,
  type ThreadGoal
} from "../../../web/api/types";
import { loadJson, saveJson, threadModeKey, threadPermissionProfileKey } from "../../../web/storage/localStore";
import { setDraft } from "../../../web/storage/drafts";
import { getContextUsage, type ContextUsageSnapshot } from "../../../web/storage/contextUsage";
import { settingsStore } from "../../../web/storage/settings";

const EMPTY_ENTRIES: TimelineEntry[] = [];
const EMPTY_APPROVALS: PendingServerRequest[] = [];
const EMPTY_PLAN: Array<{ text: string; completed: boolean }> = [];
const STARTED_TURN_EMPTY_OUTPUT_REPAIR_DELAY_MS = 2_500;
const DEFAULT_COMPOSER_HEIGHT = 144;

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
  const setRunning = useStore((s) => s.setRunning);
  const setActiveTurnId = useStore((s) => s.setActiveTurnId);
  const bindLocalUserMessageTurn = useStore((s) => s.bindLocalUserMessageTurn);
  const setTimelineGeneration = useStore((s) => s.setTimelineGeneration);
  const markTurnInterrupted = useStore((s) => s.markTurnInterrupted);
  const markTurnDeleted = useStore((s) => s.markTurnDeleted);
  const setActiveThread = useStore((s) => s.setActiveThread);
  const requestSnapshotRepair = useStore((s) => s.requestSnapshotRepair);
  const clearSnapshotRepair = useStore((s) => s.clearSnapshotRepair);
  const setPendingRequests = useStore((s) => s.setPendingRequests);
  const resolvePendingRequest = useStore((s) => s.resolvePendingRequest);
  const threadRunning = useStore((s) => s.threads[threadId]?.running ?? false);
  const threadActiveTurnId = useStore((s) => s.threads[threadId]?.activeTurnId ?? null);
  const threadMode = useStore((s) => s.threads[threadId]?.mode ?? "build");
  const threadModel = useStore((s) => s.threads[threadId]?.model ?? null);
  const threadModelEffort = useStore((s) => s.threads[threadId]?.modelEffort ?? null);
  const threadPermissionProfileId = useStore((s) => s.threads[threadId]?.permissionProfileId);
  const threadApprovalsReviewer = useStore((s) => s.threads[threadId]?.approvalsReviewer);
  const threadContextUsage = useStore((s) => s.threads[threadId]?.contextUsage ?? null);
  const repairRequestedAt = useStore((s) => s.threads[threadId]?.repairRequestedAt ?? null);
  const hasCachedEntries = useStore((s) => Boolean(s.threads[threadId]?.entries.length));
  const entryCount = useStore((s) => s.threads[threadId]?.entries.length ?? 0);
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
  const loadingPageCursorsRef = useRef(new Set<string>());
  const pendingSettingsRef = useRef<UpdateThreadSettingsInput | null>(null);
  const settingsFlushRef = useRef<Promise<void> | null>(null);
  const startedTurnRepairTimersRef = useRef(new Map<string, number>());

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

  const scheduleStartedTurnRepair = useCallback(
    (turnId: string, requireMissingOutput = true) => {
      const key = `${threadId}\u0001${turnId}`;
      const existingTimer = startedTurnRepairTimersRef.current.get(key);
      if (existingTimer !== undefined) {
        window.clearTimeout(existingTimer);
      }
      const timer = window.setTimeout(() => {
        startedTurnRepairTimersRef.current.delete(key);
        const currentThread = useStore.getState().threads[threadId];
        if (!currentThread?.running || currentThread.activeTurnId !== turnId) {
          return;
        }
        if (requireMissingOutput && hasVisibleServerOutputForStartedTurn(currentThread.entries, turnId)) {
          return;
        }
        requestSnapshotRepair(threadId);
      }, STARTED_TURN_EMPTY_OUTPUT_REPAIR_DELAY_MS);
      startedTurnRepairTimersRef.current.set(key, timer);
    },
    [threadId, requestSnapshotRepair]
  );

  useEffect(() => {
    return () => {
      for (const timer of startedTurnRepairTimersRef.current.values()) {
        window.clearTimeout(timer);
      }
      startedTurnRepairTimersRef.current.clear();
    };
  }, [threadId]);

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
      entriesOverride?: TimelineEntry[]
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
        setThreadEntries(targetThreadId, entries, nextCursor);
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
      setActiveTurnId(targetThreadId, isThreadRunningStatus(td.status) ? td.lastTurnId : null);
    },
    [
      threadId,
      setThreadEntries,
      mergeThreadEntries,
      setTimelineGeneration,
      setModel,
      setContextUsage,
      setPermissionProfile,
      setActiveTurnId
    ]
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
        );
        if (cancelled) return;
        if (requestEpoch !== mutationEpochRef.current) return;
        applyThreadDetail(td, "replace");
        setRunning(threadId, isThreadRunningStatus(td.status));
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
  }, [threadId, ensureThread, applyThreadDetail, setMode, setPermissionProfile, setRunning, setActiveThread]);

  useEffect(() => {
    if (!repairRequestedAt) return;
    let cancelled = false;
    const requestEpoch = mutationEpochRef.current;
    (async () => {
      try {
        const td = await requestCoordinatorRef.current.dedupeRequest(
          `thread:${threadId}:repair`,
          () => codex.readThread(threadId)
        );
        if (cancelled) return;
        if (requestEpoch !== mutationEpochRef.current) {
          requestSnapshotRepair(threadId);
          return;
        }
        const entries = await threadDetailEntriesWithTurnItems(td, threadId);
        if (cancelled) return;
        applyThreadDetail(td, "replace", threadId, entries);
        setRunning(threadId, isThreadRunningStatus(td.status));
        clearSnapshotRepair(threadId);
        if (isThreadRunningStatus(td.status) && td.lastTurnId) {
          scheduleStartedTurnRepair(td.lastTurnId, false);
        }
      } catch (err) {
        if (isRequestAbort(err)) return;
        // Keep the current cache visible; the next stream gap or manual refresh can retry.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    threadId,
    repairRequestedAt,
    applyThreadDetail,
    setRunning,
    requestSnapshotRepair,
    clearSnapshotRepair,
    scheduleStartedTurnRepair
  ]);

  useEffect(() => {
    if (loading || !scrollerRef.current) return;
    if (atBottomRef.current) {
      scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
    }
  }, [loading, entryCount]);

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
        const previousScrollHeight = el.scrollHeight;
        const previousScrollTop = el.scrollTop;
        try {
          const page = await requestCoordinatorRef.current.dedupeRequest(
            `thread:${threadId}:turns:${cursor}`,
            () => codex.listTurnsBefore(threadId, cursor)
          );
          const pageCreatedAtBase = Date.now() - 10_000;
          const extra = repairReconstructedTimelineEntries(
            page.items.map((it, i) =>
              timelineItemToEntry(it, pageCreatedAtBase + i)
            )
          );
          prependEntries(threadId, extra, page.nextCursor ?? null, page.nextCursor === null);
          restorePrependScrollAnchor(el, previousScrollHeight, previousScrollTop);
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
          ? cachedThreadDetail(
              threadId,
              useStore.getState().threads[threadId]?.running ?? false,
              useStore.getState().threads[threadId]?.activeTurnId ?? null
            )
          : null);
      if (!currentDetail) return;
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
      setRunning(threadId, true);
      try {
        const clientUserMessageId = optimisticEntry.clientUserMessageId ?? optimisticEntry.id;
        if (currentDetail.status === "notLoaded") {
          const resumed = await requestCoordinatorRef.current.dedupeRequest(
            `thread:${threadId}:resume`,
            () => codex.resumeThread(threadId)
          );
          setDetail(resumed);
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
        if (started.thread) {
          const threadWithLocalContext = mergeSentUserContextIntoThreadDetail(started.thread, {
            clientUserMessageId,
            turnId: started.turnId,
            text,
            imagePaths,
            skillReferences
          });
          applyThreadDetail(
            threadWithLocalContext,
            isThreadRunningStatus(threadWithLocalContext.status) ? "merge" : "replace"
          );
          setActiveTurnId(threadId, isThreadRunningStatus(threadWithLocalContext.status) ? started.turnId : null);
        } else {
          const currentThread = useStore.getState().threads[threadId];
          if (currentThread?.running) {
            setActiveTurnId(threadId, started.turnId);
            scheduleStartedTurnRepair(started.turnId);
          } else if (!hasVisibleServerOutputForStartedTurn(currentThread?.entries ?? [], started.turnId)) {
            requestSnapshotRepair(threadId);
          }
        }
        const serverHasUserMessage = started.thread?.timeline.some(
          (item) => item.role === "user" && item.text.trim() === text.trim()
        ) ?? false;
        if (!serverHasUserMessage) {
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
        }
        if (started.thread) {
          setRunning(threadId, isThreadRunningStatus(started.thread.status));
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
        setRunning(threadId, false);
        throw err;
      } finally {
        pendingSendKeysRef.current.delete(sendKey);
      }
    },
    [
      detail,
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
      setRunning,
      setActiveTurnId,
      bindLocalUserMessageTurn,
      bumpMutationEpoch,
      requestSnapshotRepair,
      scheduleStartedTurnRepair
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
        setRunning(threadId, false);
        setActiveTurnId(threadId, null);
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
    setRunning,
    setActiveTurnId,
    markTurnInterrupted
  ]);

  const rewindToMessage = useCallback(
    async (entry: TimelineEntry) => {
      const currentThread = useStore.getState().threads[threadId];
      if (currentThread?.running || entry.body.kind !== "user-message") return;
      const entries = currentThread?.entries ?? [];
      const target = resolveCurrentUserMessage(entries, entry);
      const numTurns = target ? rollbackTurnsForEntry(entries, target) : null;
      if (!target || !numTurns) {
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
        bumpMutationEpoch();
        const expectedDeletedTurnIds = tailTurnIdsForRollback(entries, target, numTurns);
        const rolledBack = await rollbackThreadWithResume(threadId, numTurns, expectedDeletedTurnIds);
        for (const turnId of expectedDeletedTurnIds) {
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
    [threadId, applyThreadDetail, appendEntries, markTurnDeleted, bumpMutationEpoch]
  );

  const forkFromMessage = useCallback(
    async (entry: TimelineEntry) => {
      const currentThread = useStore.getState().threads[threadId];
      if (currentThread?.running || entry.body.kind !== "user-message") return;
      const entries = currentThread?.entries ?? [];
      const target = resolveCurrentUserMessage(entries, entry);
      const numTurns = target ? rollbackTurnsForEntry(entries, target) : null;
      if (!target || !numTurns) {
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
        const forkNumTurns = rollbackTurnsForEntry(forkEntries, forkTarget);
        if (!forkNumTurns) {
          appendEntries(threadId, [
            {
              id: uniqueTimelineId("fork-error"),
              createdAt: Date.now(),
              body: { kind: "error", text: "无法计算 Fork 后的回滚范围，请刷新后重试。" }
            }
          ]);
          return;
        }
        const expectedDeletedTurnIds = tailTurnIdsForRollback(forkEntries, forkTarget, forkNumTurns);
        bumpMutationEpoch();
        const rolledBack = await rollbackThreadWithResume(forked.id, forkNumTurns, expectedDeletedTurnIds);
        for (const turnId of expectedDeletedTurnIds) {
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
    [threadId, applyThreadDetail, appendEntries, markTurnDeleted, router, bumpMutationEpoch]
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
      ? cachedThreadDetail(threadId, threadRunning, threadActiveTurnId)
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
  const running = threadRunning;
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
        composerHeight={composerHeight}
        scrollerRef={scrollerRef}
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
      />

      {showJumpLatest ? (
        <button
          type="button"
          onClick={() => {
            if (scrollerRef.current) {
              scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
            }
          }}
          style={{ ...jumpBtn, bottom: composerBottomOffset(composerHeight) }}
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
          onClose={() => setContextUsageOpen(false)}
          onCompact={() => {
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
            setCompactOpen(false);
            try {
              await requestCoordinatorRef.current.runLockedAction(
                `compact:${threadId}`,
                () => codex.compactThread(threadId)
              );
            } catch (err) {
              console.warn("compact failed", err);
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
  composerHeight,
  scrollerRef,
  onScroll,
  onSend,
  onRewindToMessage,
  onForkFromMessage,
  onResolveApproval,
  onExecutePlan
}: {
  threadId: string;
  composerHeight: number;
  scrollerRef: RefObject<HTMLDivElement | null>;
  onScroll: (event: React.UIEvent<HTMLDivElement>) => void | Promise<void>;
  onSend: (text: string, imagePaths: string[], skillReferences?: SkillReference[]) => Promise<void>;
  onRewindToMessage: (entry: TimelineEntry) => void | Promise<void>;
  onForkFromMessage: (entry: TimelineEntry) => void | Promise<void>;
  onResolveApproval: (req: PendingServerRequest) => void | Promise<void>;
  onExecutePlan: (entries: TimelineEntry[]) => void | Promise<void>;
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
      style={{ ...scrollStyle, paddingBottom: composerBottomOffset(composerHeight) }}
    >
      {reachedBeginning ? (
        <div style={{ textAlign: "center", color: "var(--cw-fg-subtle)", padding: 16, fontSize: 12 }}>会话开始</div>
      ) : null}
      <Timeline
        entries={entries}
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
      {running ? (
        <div style={{ textAlign: "center", padding: 12, color: "var(--cw-fg-muted)", fontSize: 12 }}>正在生成…</div>
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
  onClose,
  onCompact
}: {
  usage: ContextUsageSnapshot | null;
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
        <button type="button" onClick={onCompact} style={btnPrimary}>
          压缩上下文
        </button>
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
}): JSX.Element {
  return (
    <Overlay onClose={props.onClose} align="bottom">
      <div style={sheetStyle}>
        <SheetItem label="重命名" onClick={props.onRename} />
        <SheetItem label="归档" divided onClick={props.onArchive} />
        <SheetItem label="压缩上下文" divided onClick={props.onCompact} />
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

function isThreadRunningStatus(status: string): boolean {
  return status === "active";
}

function sendPayloadKey(text: string, imagePaths: string[], skillReferences: SkillReference[] = []): string {
  const images = [...imagePaths].sort().join("\u0000");
  const skills = [...skillReferences].map((skill) => `${skill.name}\u0000${skill.path}`).sort().join("\u0000");
  return `${text.trim()}\u0001${images}\u0001${skills}`;
}

function mergeSentUserContextIntoThreadDetail(
  thread: ThreadDetail,
  context: {
    clientUserMessageId: string;
    turnId: string;
    text: string;
    imagePaths: string[];
    skillReferences: SkillReference[];
  }
): ThreadDetail {
  if (!context.imagePaths.length && !context.skillReferences.length) {
    return thread;
  }

  const userIndexes = thread.timeline
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item.role === "user");
  const text = context.text.trim();
  const byClientId = userIndexes.find(
    ({ item }) => item.clientUserMessageId && item.clientUserMessageId === context.clientUserMessageId
  );
  const byTurnId = byClientId
    ? null
    : userIndexes.find(({ item }) => item.turnId && item.turnId === context.turnId && item.text.trim() === text);
  const textMatches =
    byClientId || byTurnId ? [] : userIndexes.filter(({ item }) => item.text.trim() === text);
  const match = byClientId ?? byTurnId ?? (textMatches.length === 1 ? textMatches[0] : null);
  if (!match) {
    return thread;
  }

  return {
    ...thread,
    timeline: thread.timeline.map((item, index) => {
      if (index !== match.index) {
        return item;
      }
      return {
        ...item,
        clientUserMessageId: item.clientUserMessageId ?? context.clientUserMessageId,
        ...(item.imagePaths?.length || !context.imagePaths.length ? {} : { imagePaths: context.imagePaths }),
        ...(item.skillReferences?.length || !context.skillReferences.length
          ? {}
          : { skillReferences: context.skillReferences })
      };
    })
  };
}

function threadDetailEntries(td: ThreadDetail): TimelineEntry[] {
  return repairReconstructedTimelineEntries(
    td.timeline.map((item, idx) =>
      timelineItemToEntry(
        {
          ...item,
          ...(typeof item.generation !== "number" && typeof td.generation === "number" ? { generation: td.generation } : {}),
          ...(typeof item.snapshotSequence !== "number" && typeof td.snapshotSequence === "number"
            ? { snapshotSequence: td.snapshotSequence }
            : {})
        },
        td.updatedAt - (td.timeline.length - idx)
      )
    )
  );
}

const TURN_ITEM_DETAIL_PAGE_LIMIT = 100;
const TURN_ITEM_DETAIL_MAX_PAGES = 5;

async function threadDetailEntriesWithTurnItems(td: ThreadDetail, threadId: string): Promise<TimelineEntry[]> {
  const baseEntries = threadDetailEntries(td);
  const turnId = td.lastTurnId ?? lastTurnIdFromEntries(baseEntries);
  if (!turnId) {
    return baseEntries;
  }

  try {
    const itemEntries: TimelineEntry[] = [];
    let cursor: string | null | undefined;
    for (let pageIndex = 0; pageIndex < TURN_ITEM_DETAIL_MAX_PAGES; pageIndex += 1) {
      const page = await codex.listTurnItems(threadId, turnId, cursor, TURN_ITEM_DETAIL_PAGE_LIMIT);
      itemEntries.push(
        ...page.items.map((item, idx) =>
          timelineItemToEntry(
            {
              ...item,
              turnId: item.turnId ?? turnId,
              ...(typeof item.generation !== "number" && typeof td.generation === "number"
                ? { generation: td.generation }
                : {}),
              ...(typeof item.snapshotSequence !== "number" && typeof td.snapshotSequence === "number"
                ? { snapshotSequence: td.snapshotSequence }
                : {})
            },
            td.updatedAt - itemEntries.length - page.items.length + idx
          )
        )
      );
      cursor = page.nextCursor ?? null;
      if (!cursor) {
        break;
      }
    }

    return mergeTurnItemDetailsIntoTimeline(baseEntries, itemEntries, turnId);
  } catch {
    return baseEntries;
  }
}

function lastTurnIdFromEntries(entries: TimelineEntry[]): string | null {
  for (let idx = entries.length - 1; idx >= 0; idx -= 1) {
    const turnId = entries[idx]?.turnId;
    if (turnId) {
      return turnId;
    }
  }
  return null;
}

function mergeTurnItemDetailsIntoTimeline(
  baseEntries: TimelineEntry[],
  itemEntries: TimelineEntry[],
  turnId: string
): TimelineEntry[] {
  if (!itemEntries.length) {
    return baseEntries;
  }
  const turnItemEntries = itemEntries.filter((entry) => entry.turnId === turnId);
  if (!turnItemEntries.length) {
    return baseEntries;
  }

  const baseEntriesById = new Map(baseEntries.map((entry) => [entry.id, entry]));
  const turnItemIds = new Set(turnItemEntries.map((entry) => entry.id));
  const orderedTurnEntries = turnItemEntries.map((entry) =>
    mergeTurnDetailEntry(baseEntriesById.get(entry.id), entry)
  );
  const baseOnlyTurnEntries = baseEntries.filter((entry) => entry.turnId === turnId && !turnItemIds.has(entry.id));
  const mergedTurnEntries = mergeBaseOnlyTurnEntries(orderedTurnEntries, baseOnlyTurnEntries);
  const firstTurnIndex = baseEntries.findIndex((entry) => entry.turnId === turnId);
  if (firstTurnIndex < 0) {
    return [...baseEntries, ...mergedTurnEntries];
  }

  const beforeTurn = baseEntries.slice(0, firstTurnIndex);
  const afterTurn = baseEntries.slice(firstTurnIndex).filter((entry) => entry.turnId !== turnId);
  return [
    ...beforeTurn,
    ...mergedTurnEntries,
    ...afterTurn
  ];
}

function mergeBaseOnlyTurnEntries(
  orderedTurnEntries: TimelineEntry[],
  baseOnlyTurnEntries: TimelineEntry[]
): TimelineEntry[] {
  if (!baseOnlyTurnEntries.length) {
    return repairReconstructedTurnEntries(orderedTurnEntries);
  }

  const detailHasUser = orderedTurnEntries.some((entry) => entry.body.kind === "user-message");
  const baseOnlyUsers = baseOnlyTurnEntries.filter((entry) => entry.body.kind === "user-message");
  const baseOnlyOtherEntries = baseOnlyTurnEntries.filter((entry) => entry.body.kind !== "user-message");
  if (!detailHasUser && baseOnlyUsers.length) {
    return repairReconstructedTurnEntries([
      ...baseOnlyUsers,
      ...orderedTurnEntries,
      ...baseOnlyOtherEntries
    ]);
  }

  return repairReconstructedTurnEntries([...orderedTurnEntries, ...baseOnlyTurnEntries]);
}

function repairReconstructedTimelineEntries(entries: TimelineEntry[]): TimelineEntry[] {
  const repaired: TimelineEntry[] = [];
  let index = 0;
  while (index < entries.length) {
    const entry = entries[index]!;
    if (!entry.turnId) {
      repaired.push(entry);
      index += 1;
      continue;
    }

    const turnId = entry.turnId;
    const turnEntries: TimelineEntry[] = [];
    while (index < entries.length && entries[index]?.turnId === turnId) {
      turnEntries.push(entries[index]!);
      index += 1;
    }
    repaired.push(...repairReconstructedTurnEntries(turnEntries));
  }
  return repaired;
}

function repairReconstructedTurnEntries(entries: TimelineEntry[]): TimelineEntry[] {
  return withCreatedAtFollowingEntryOrder(moveTrailingActivityBeforeFinalAssistant(entries));
}

function moveTrailingActivityBeforeFinalAssistant(entries: TimelineEntry[]): TimelineEntry[] {
  const finalAssistantIndex = findLastAgentMessageIndex(entries);
  if (finalAssistantIndex < 0 || finalAssistantIndex === entries.length - 1) {
    return entries;
  }

  const beforeFinalAssistant = entries.slice(0, finalAssistantIndex);
  const finalAssistant = entries[finalAssistantIndex]!;
  const afterFinalAssistant = entries.slice(finalAssistantIndex + 1);
  const trailingActivity = afterFinalAssistant.filter(isInlineActivityEntry);
  if (!trailingActivity.length) {
    return entries;
  }
  const trailingOtherEntries = afterFinalAssistant.filter((entry) => !isInlineActivityEntry(entry));
  return [...beforeFinalAssistant, ...trailingActivity, finalAssistant, ...trailingOtherEntries];
}

function withCreatedAtFollowingEntryOrder(entries: TimelineEntry[]): TimelineEntry[] {
  if (entries.length < 2 || hasMonotonicCreatedAt(entries)) {
    return entries;
  }

  const baseCreatedAt = Math.min(...entries.map((entry) => entry.createdAt));
  return entries.map((entry, index) => ({
    ...entry,
    createdAt: baseCreatedAt + index * 0.001
  }));
}

function hasMonotonicCreatedAt(entries: TimelineEntry[]): boolean {
  for (let index = 1; index < entries.length; index += 1) {
    if (entries[index]!.createdAt < entries[index - 1]!.createdAt) {
      return false;
    }
  }
  return true;
}

function findLastAgentMessageIndex(entries: TimelineEntry[]): number {
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    if (entries[index]?.body.kind === "agent-message") {
      return index;
    }
  }
  return -1;
}

function isInlineActivityEntry(entry: TimelineEntry): boolean {
  return (
    entry.body.kind === "reasoning" ||
    entry.body.kind === "tool" ||
    entry.body.kind === "command" ||
    entry.body.kind === "diff"
  );
}

function mergeTurnDetailEntry(baseEntry: TimelineEntry | undefined, detailEntry: TimelineEntry): TimelineEntry {
  if (!baseEntry) {
    return detailEntry;
  }
  return {
    ...detailEntry,
    createdAt: baseEntry.createdAt,
    turnIndex: detailEntry.turnIndex ?? baseEntry.turnIndex,
    generation: detailEntry.generation ?? baseEntry.generation,
    snapshotSequence: detailEntry.snapshotSequence ?? baseEntry.snapshotSequence,
    clientUserMessageId: detailEntry.clientUserMessageId ?? baseEntry.clientUserMessageId
  };
}

function cachedThreadDetail(threadId: string, running: boolean, activeTurnId: string | null): ThreadDetail {
  return {
    id: threadId,
    title: "会话",
    preview: "",
    cwd: "",
    modelProvider: "",
    status: running ? "active" : "idle",
    updatedAt: Date.now(),
    lastTurnId: activeTurnId,
    generation: 0,
    nextCursor: null,
    timeline: []
  };
}

function hasVisibleServerOutputForStartedTurn(entries: TimelineEntry[], turnId: string): boolean {
  return entries.some((entry) => {
    if (entry.turnId !== turnId) {
      return false;
    }
    switch (entry.body.kind) {
      case "agent-message":
        return entry.body.text.trim().length > 0;
      case "reasoning":
        return entry.body.text.trim().length > 0;
      case "tool":
        return Boolean((entry.body.result ?? entry.body.arguments ?? entry.body.tool).trim());
      case "command":
        return Boolean((entry.body.output ?? entry.body.command).trim());
      case "diff":
      case "error":
        return true;
      default:
        return false;
    }
  });
}

function restorePrependScrollAnchor(
  scroller: HTMLDivElement,
  previousScrollHeight: number,
  previousScrollTop: number
): void {
  const win = scroller.ownerDocument.defaultView;
  const schedule =
    win && typeof win.requestAnimationFrame === "function"
      ? (callback: () => void) => win.requestAnimationFrame(() => callback())
      : (callback: () => void) => (win ?? window).setTimeout(callback, 0);
  schedule(() => {
    const addedHeight = scroller.scrollHeight - previousScrollHeight;
    if (addedHeight > 0) {
      scroller.scrollTop = previousScrollTop + addedHeight;
    }
  });
}

function uniqueTimelineId(prefix: string): string {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${random}`;
}

function composerBottomOffset(height: number): string {
  return `calc(${Math.max(DEFAULT_COMPOSER_HEIGHT, Math.ceil(height))}px + var(--safe-bottom))`;
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

  if (!candidateText) {
    return null;
  }
  const matches = entries.filter(
    (entry) => entry.body.kind === "user-message" && entry.body.text.trim() === candidateText
  );
  return matches.length === 1 ? matches[0] : null;
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

function tailTurnIdsForRollback(entries: TimelineEntry[], target: TimelineEntry, numTurns: number): string[] {
  if (!target.turnId) {
    return [];
  }
  const turnIds: string[] = [];
  const seen = new Set<string>();
  for (const entry of entries) {
    if (!entry.turnId || seen.has(entry.turnId)) {
      continue;
    }
    seen.add(entry.turnId);
    turnIds.push(entry.turnId);
  }
  const targetIndex = turnIds.indexOf(target.turnId);
  if (targetIndex < 0) {
    return [];
  }
  return turnIds.slice(targetIndex, targetIndex + numTurns);
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
  overflowY: "auto",
  padding: "12px",
  paddingBottom: "calc(144px + var(--safe-bottom))",
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
