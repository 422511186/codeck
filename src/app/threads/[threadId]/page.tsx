"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { codex } from "../../../web/api/endpoints";
import { ApiError } from "../../../web/api/client";
import { useStore } from "../../../web/state/store";
import { timelineItemToEntry, type TimelineEntry } from "../../../web/state/timeline";
import { Timeline } from "../../../web/components/Timeline";
import { PlanBar } from "../../../web/components/cards/PlanBar";
import { ChatInput } from "../../../web/components/ChatInput";
import {
  DEFAULT_COLLABORATION_MODEL,
  collaborationModeForChatMode,
  type ChatMode,
  type ModelOption,
  type ThreadDetail
} from "../../../web/api/types";
import { loadJson, saveJson, threadModeKey } from "../../../web/storage/localStore";
import { settingsStore } from "../../../web/storage/settings";

export default function ThreadPage(): JSX.Element {
  const params = useParams<{ threadId: string }>();
  const router = useRouter();
  const threadId = String(params?.threadId ?? "");

  const ensureThread = useStore((s) => s.ensureThread);
  const setThreadEntries = useStore((s) => s.setThreadEntries);
  const prependEntries = useStore((s) => s.prependEntries);
  const appendEntries = useStore((s) => s.appendEntries);
  const replaceOrAddEntry = useStore((s) => s.replaceOrAddEntry);
  const setMode = useStore((s) => s.setMode);
  const setModel = useStore((s) => s.setModel);
  const setRunning = useStore((s) => s.setRunning);
  const setPendingRequests = useStore((s) => s.setPendingRequests);
  const resolvePendingRequest = useStore((s) => s.resolvePendingRequest);
  const threadState = useStore((s) => s.threads[threadId]);
  const webSettings = settingsStore.get();

  const [detail, setDetail] = useState<ThreadDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSheet, setShowSheet] = useState(false);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [models, setModels] = useState<ModelOption[] | null>(null);
  const [serverDefaults, setServerDefaults] = useState<{ model: string | null; reasoningEffort: string | null }>({
    model: null,
    reasoningEffort: null
  });
  const [renameOpen, setRenameOpen] = useState(false);
  const [compactOpen, setCompactOpen] = useState(false);
  const [archiveToast, setArchiveToast] = useState<{ visible: boolean } | null>(null);
  const [showJumpLatest, setShowJumpLatest] = useState(false);

  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const atBottomRef = useRef(true);

  const configuredModel = threadState?.model ?? detail?.model ?? webSettings.defaultModel ?? null;
  const effectiveModel = configuredModel ?? serverDefaults.model ?? DEFAULT_COLLABORATION_MODEL;
  const configuredReasoningEffort = threadState?.modelEffort ?? detail?.reasoningEffort ?? null;
  const effectiveReasoningEffort = configuredReasoningEffort ?? serverDefaults.reasoningEffort ?? null;

  useEffect(() => {
    let cancelled = false;
    codex
      .settings()
      .then((settings) => {
        if (!cancelled) {
          setServerDefaults({
            model: settings.model,
            reasoningEffort: settings.reasoningEffort
          });
        }
      })
      .catch(() => {
        // Keep the protocol fallback when app-server settings are temporarily unavailable.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const applyThreadDetail = useCallback(
    (td: ThreadDetail) => {
      setDetail(td);
      const entries: TimelineEntry[] = td.timeline.map((item, idx) =>
        timelineItemToEntry(item, td.updatedAt - (td.timeline.length - idx))
      );
      setThreadEntries(threadId, entries, null);
      if (td.model) {
        setModel(threadId, td.model, td.reasoningEffort ?? null);
      }
    },
    [threadId, setThreadEntries, setModel]
  );

  useEffect(() => {
    ensureThread(threadId);
    const savedMode = loadJson<ChatMode | null>(threadModeKey(threadId), null);
    if (savedMode) {
      setMode(threadId, savedMode);
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const td = await codex.readThread(threadId);
        if (cancelled) return;
        applyThreadDetail(td);
        setRunning(threadId, isThreadRunningStatus(td.status));
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : (err as Error).message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [threadId, ensureThread, applyThreadDetail, setMode, setRunning]);

  useEffect(() => {
    if (loading || !scrollerRef.current) return;
    if (atBottomRef.current) {
      scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
    }
  }, [loading, threadState?.entries.length]);

  useEffect(() => {
    let cancelled = false;
    codex
      .listPendingRequests()
      .then((requests) => {
        if (!cancelled) {
          setPendingRequests(requests);
        }
      })
      .catch(() => {
        // WebSocket remains the live path; this is only a reload recovery path.
      });
    return () => {
      cancelled = true;
    };
  }, [threadId, setPendingRequests]);

  useEffect(() => {
    if (!threadState?.running) return;

    let cancelled = false;
    const refresh = async () => {
      try {
        const td = await codex.readThread(threadId);
        if (cancelled) return;
        applyThreadDetail(td);
        setRunning(threadId, isThreadRunningStatus(td.status));
      } catch {
        // WebSocket remains the primary live path; polling is only a fallback.
      }
    };

    void refresh();
    const interval = window.setInterval(refresh, 2_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [threadId, threadState?.running, applyThreadDetail, setRunning]);

  const onScroll = useCallback(
    async (event: React.UIEvent<HTMLDivElement>) => {
      const el = event.currentTarget;
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      atBottomRef.current = distanceFromBottom < 64;
      setShowJumpLatest(!atBottomRef.current);

      if (el.scrollTop < 64 && threadState && !threadState.reachedBeginning && threadState.cursor) {
        try {
          const page = await codex.listTurnsBefore(threadId, threadState.cursor);
          const extra = page.items.map((it, i) =>
            timelineItemToEntry(it, Date.now() - 10_000 - i)
          );
          prependEntries(threadId, extra, page.nextCursor ?? null, page.nextCursor === null);
        } catch {
          // ignore page load failure
        }
      }
    },
    [threadId, threadState, prependEntries]
  );

  const onSend = useCallback(
    async (text: string, imagePaths: string[]) => {
      if (!detail) return;
      const optimisticEntry: TimelineEntry = {
        id: `local-user-${Date.now()}`,
        createdAt: Date.now(),
        body: {
          kind: "user-message",
          text,
          ...(imagePaths.length ? { imagePaths } : {}),
          status: "sending"
        }
      };
      appendEntries(threadId, [optimisticEntry]);
      setRunning(threadId, true);
      try {
        if (detail.status === "notLoaded") {
          const resumed = await codex.resumeThread(threadId);
          setDetail(resumed);
        }
        const currentMode = threadState?.mode ?? "build";
        const collaborationMode =
          currentMode === "plan"
            ? collaborationModeForChatMode("plan", effectiveModel, effectiveReasoningEffort)
            : undefined;
        const startInput = {
          threadId,
          text,
          imagePaths,
          ...(currentMode === "build" && configuredModel ? { model: configuredModel } : {}),
          ...(currentMode === "build" && configuredReasoningEffort ? { reasoningEffort: configuredReasoningEffort } : {}),
          ...(collaborationMode ? { collaborationMode } : {})
        };
        let started: Awaited<ReturnType<typeof codex.startTurn>>;
        try {
          started = await codex.startTurn(startInput);
        } catch (err) {
          if (!isThreadNotFoundError(err)) {
            throw err;
          }
          const resumed = await codex.resumeThread(threadId);
          setDetail(resumed);
          started = await codex.startTurn(startInput);
        }
        applyThreadDetail(started.thread);
        const serverHasUserMessage = started.thread.timeline.some(
          (item) => item.role === "user" && item.text.trim() === text.trim()
        );
        if (!serverHasUserMessage) {
          replaceOrAddEntry(threadId, {
            ...optimisticEntry,
            body: {
              kind: "user-message",
              text,
              ...(imagePaths.length ? { imagePaths } : {}),
              status: "sent"
            }
          });
        }
        setRunning(threadId, isThreadRunningStatus(started.thread.status));
        // Auto-name thread after first user message
        if ((!detail.title || detail.title === "新会话") && text.trim()) {
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
      }
    },
    [
      detail,
      threadId,
      effectiveModel,
      effectiveReasoningEffort,
      configuredModel,
      configuredReasoningEffort,
      threadState?.mode,
      appendEntries,
      applyThreadDetail,
      replaceOrAddEntry,
      setRunning
    ]
  );

  const onInterrupt = useCallback(async () => {
    try {
      await codex.interruptTurn(threadId, detail?.lastTurnId ?? undefined);
      setRunning(threadId, false);
    } catch (err) {
      appendEntries(threadId, [
        {
          id: `interrupt-error-${Date.now()}`,
          createdAt: Date.now(),
          body: { kind: "error", text: `中断失败：${errorMessage(err)}` }
        }
      ]);
    }
  }, [threadId, detail?.lastTurnId, appendEntries, setRunning]);

  const openModelPicker = useCallback(async () => {
    setShowModelPicker(true);
    setModels(null);
    try {
      setModels(await codex.models());
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
        await codex.updateThreadSettings(threadId, {
          model: model.id,
          ...(nextEffort ? { reasoningEffort: nextEffort } : {})
        });
      } catch (err) {
        // optimistic — surface error
        console.warn("update model failed", err);
      }
    },
    [threadId, effectiveReasoningEffort, setModel]
  );

  const onSelectReasoningEffort = useCallback(
    async (effort: string) => {
      setModel(threadId, effectiveModel, effort);
      try {
        await codex.updateThreadSettings(threadId, {
          model: effectiveModel,
          reasoningEffort: effort
        });
      } catch (err) {
        console.warn("update reasoning effort failed", err);
      }
    },
    [threadId, effectiveModel, setModel]
  );

  const onToggleMode = useCallback(
    async (next: ChatMode) => {
      setMode(threadId, next);
      saveJson(threadModeKey(threadId), next);
      try {
        await codex.updateThreadSettings(threadId, {
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
    [threadId, setMode, effectiveModel, effectiveReasoningEffort]
  );

  if (error) {
    return (
      <main style={{ padding: 24 }}>
        <p style={{ color: "var(--cw-danger)" }}>{error}</p>
        <button type="button" onClick={() => router.back()} style={btnGhost}>
          返回
        </button>
      </main>
    );
  }

  if (loading || !detail) {
    return (
      <main style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100dvh" }}>
        <span style={{ color: "var(--cw-fg-muted)" }}>载入中…</span>
      </main>
    );
  }

  const mode = threadState?.mode ?? "build";
  const modelId = effectiveModel;
  const running = threadState?.running ?? false;
  const plan = threadState?.plan ?? [];
  const entries = threadState?.entries ?? [];
  const lastUserEntry = entries.slice().reverse().find((item) => item.body.kind === "user-message");
  const lastUserMessageText = lastUserEntry?.body.kind === "user-message" ? lastUserEntry.body.text : null;

  return (
    <main style={{ display: "flex", flexDirection: "column", height: "100dvh" }}>
      <header style={headerStyle}>
        <button type="button" onClick={() => router.back()} style={iconBtn} aria-label="返回">
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
            {detail.title || "新会话"}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <ModeSegmented value={mode} onChange={onToggleMode} />
          <button type="button" onClick={openModelPicker} style={modelBtn}>
            {shortModel(modelId)}
          </button>
          <button type="button" onClick={() => setShowSheet(true)} style={iconBtn} aria-label="更多">
            ⋮
          </button>
        </div>
      </header>

      {plan.length > 0 ? <PlanBar steps={plan} /> : null}

      <div ref={scrollerRef} className="cw-thread-scroller" onScroll={onScroll} style={scrollStyle}>
        {threadState?.reachedBeginning ? (
          <div style={{ textAlign: "center", color: "var(--cw-fg-subtle)", padding: 16, fontSize: 12 }}>会话开始</div>
        ) : null}
        <Timeline
          entries={entries}
          approvals={threadState?.pendingApprovals ?? []}
          onResendUser={async (text) => {
            await onSend(text, []);
          }}
          onResolveApproval={async (req) => {
            resolvePendingRequest(req.requestId);
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
                onToggleMode("build");
                try {
                  const lastUserMsg = entries
                    .slice()
                    .reverse()
                    .find((e) => e.body.kind === "user-message");
                  const text = lastUserMsg ? (lastUserMsg.body as any).text : "请按上面的计划开始执行";
                  await onSend(text, []);
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

      <ChatInput
        threadId={threadId}
        running={running}
        canResendLast={Boolean(lastUserMessageText)}
        onSend={onSend}
        onInterrupt={onInterrupt}
        onResendLast={async () => {
          if (!lastUserMessageText) return null;
          try {
            await codex.rollbackThread(threadId, 1);
            return lastUserMessageText;
          } catch (err) {
            console.warn("rollback failed", err);
            return null;
          }
        }}
      />

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
              await codex.archiveThread(threadId);
              setArchiveToast({ visible: true });
              setTimeout(() => setArchiveToast(null), 4500);
            } catch (err) {
              console.warn("archive failed", err);
            }
          }}
          onCompact={() => {
            setShowSheet(false);
            setCompactOpen(true);
          }}
          onFork={async () => {
            setShowSheet(false);
            try {
              const forked = await codex.forkThread(threadId);
              router.push(`/threads/${forked.id}`);
            } catch (err) {
              console.warn("fork failed", err);
            }
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
          initial={detail.title || ""}
          onClose={() => setRenameOpen(false)}
          onSubmit={async (name) => {
            try {
              const updated = await codex.renameThread(threadId, name);
              setDetail(updated);
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
              await codex.compactThread(threadId);
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
                await codex.unarchiveThread(threadId);
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
  onFork: () => void;
}): JSX.Element {
  return (
    <Overlay onClose={props.onClose} align="bottom">
      <div style={sheetStyle}>
        <SheetItem label="重命名" onClick={props.onRename} />
        <SheetItem label="归档" onClick={props.onArchive} />
        <SheetItem label="压缩上下文" onClick={props.onCompact} />
        <SheetItem label="Fork 会话" onClick={props.onFork} />
        <SheetItem label="取消" onClick={props.onClose} />
      </div>
    </Overlay>
  );
}

function SheetItem({ label, onClick }: { label: string; onClick: () => void }): JSX.Element {
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
        color: "var(--cw-fg)"
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

function reasoningEffortLabel(effort: string): string {
  if (effort === "low") return "低";
  if (effort === "medium") return "中";
  if (effort === "high") return "高";
  return effort;
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

function isThreadNotFoundError(error: unknown): boolean {
  return error instanceof ApiError && /thread not found|找不到会话/i.test(error.message);
}

function isThreadRunningStatus(status: string): boolean {
  return status === "active";
}

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : "未知错误";
}

const headerStyle: React.CSSProperties = {
  position: "sticky",
  top: 0,
  zIndex: 30,
  display: "flex",
  alignItems: "center",
  gap: 6,
  padding: "8px 10px",
  background: "var(--cw-bg)",
  borderBottom: "1px solid var(--cw-border)"
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

const modelBtn: React.CSSProperties = {
  padding: "4px 8px",
  border: "1px solid var(--cw-border)",
  borderRadius: 8,
  background: "transparent",
  color: "var(--cw-fg)",
  fontSize: 12
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
  padding: 8,
  display: "flex",
  flexDirection: "column"
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
