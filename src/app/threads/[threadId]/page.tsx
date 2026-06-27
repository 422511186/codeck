"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { codex } from "../../../web/api/endpoints";
import { ApiError } from "../../../web/api/client";
import { useStore } from "../../../web/state/store";
import { timelineItemToEntry, type TimelineEntry } from "../../../web/state/timeline";
import { Timeline } from "../../../web/components/Timeline";
import { PlanBar } from "../../../web/components/cards/PlanBar";
import { ChatInput } from "../../../web/components/ChatInput";
import { permissionsForMode, type ChatMode, type ModelOption, type ThreadDetail } from "../../../web/api/types";
import { settingsStore } from "../../../web/storage/settings";

export default function ThreadPage(): JSX.Element {
  const params = useParams<{ threadId: string }>();
  const router = useRouter();
  const threadId = String(params?.threadId ?? "");

  const ensureThread = useStore((s) => s.ensureThread);
  const setThreadEntries = useStore((s) => s.setThreadEntries);
  const prependEntries = useStore((s) => s.prependEntries);
  const setMode = useStore((s) => s.setMode);
  const setModel = useStore((s) => s.setModel);
  const setRunning = useStore((s) => s.setRunning);
  const threadState = useStore((s) => s.threads[threadId]);

  const [detail, setDetail] = useState<ThreadDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSheet, setShowSheet] = useState(false);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [models, setModels] = useState<ModelOption[] | null>(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const [compactOpen, setCompactOpen] = useState(false);
  const [archiveToast, setArchiveToast] = useState<{ visible: boolean } | null>(null);
  const [showJumpLatest, setShowJumpLatest] = useState(false);

  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const atBottomRef = useRef(true);

  useEffect(() => {
    ensureThread(threadId);
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const td = await codex.readThread(threadId);
        if (cancelled) return;
        setDetail(td);
        const entries: TimelineEntry[] = td.timeline.map((item, idx) =>
          timelineItemToEntry(item, td.updatedAt - (td.timeline.length - idx))
        );
        setThreadEntries(threadId, entries, null);
        if (td.lastTurnId) {
          try {
            const page = await codex.listTurnsBefore(threadId, td.lastTurnId);
            if (cancelled) return;
            const extra = page.items.map((it, i) => timelineItemToEntry(it, td.updatedAt - 1_000 - i));
            prependEntries(threadId, extra, page.nextCursor ?? null, page.nextCursor === null);
          } catch {
            // ignore initial back-fill failure
          }
        }
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
  }, [threadId, ensureThread, setThreadEntries, prependEntries]);

  useEffect(() => {
    if (loading || !scrollerRef.current) return;
    if (atBottomRef.current) {
      scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
    }
  }, [loading, threadState?.entries.length]);

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
      const mode: ChatMode = threadState?.mode ?? settingsStore.get().defaultMode;
      setRunning(threadId, true);
      try {
        await codex.startTurn({
          threadId,
          text,
          imagePaths,
          model: threadState?.model ?? detail.modelProvider,
          permissions: permissionsForMode(mode)
        });
      } catch (err) {
        setRunning(threadId, false);
        throw err;
      }
    },
    [detail, threadId, threadState, setRunning]
  );

  const onInterrupt = useCallback(async () => {
    try {
      await codex.interruptTurn(threadId);
    } catch {
      // surface via toast handled by caller
    } finally {
      setRunning(threadId, false);
    }
  }, [threadId, setRunning]);

  const openModelPicker = useCallback(async () => {
    setShowModelPicker(true);
    try {
      setModels(await codex.listModels());
    } catch {
      setModels([]);
    }
  }, []);

  const onSelectModel = useCallback(
    async (model: ModelOption) => {
      setShowModelPicker(false);
      setModel(threadId, model.id);
      try {
        await codex.updateThreadSettings(threadId, { model: model.id });
      } catch (err) {
        // optimistic — surface error
        console.warn("update model failed", err);
      }
    },
    [threadId, setModel]
  );

  const onToggleMode = useCallback(
    async (next: ChatMode) => {
      setMode(threadId, next);
      try {
        await codex.updateThreadSettings(threadId, { permissions: permissionsForMode(next) });
      } catch {
        // ignore
      }
    },
    [threadId, setMode]
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
  const modelId = threadState?.model ?? detail.modelProvider ?? null;
  const running = threadState?.running ?? false;
  const plan = threadState?.plan ?? [];
  const entries = threadState?.entries ?? [];

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

      <div ref={scrollerRef} onScroll={onScroll} style={scrollStyle}>
        {threadState?.reachedBeginning ? (
          <div style={{ textAlign: "center", color: "var(--cw-fg-subtle)", padding: 16, fontSize: 12 }}>会话开始</div>
        ) : null}
        <Timeline
          entries={entries}
          approvals={threadState?.pendingApprovals ?? []}
          onResolveApproval={async (req, decision) => {
            try {
              await codex.resolveRequest(req.requestId, { decision });
            } catch (err) {
              console.warn("resolve failed", err);
            }
          }}
        />
        {running ? (
          <div style={{ textAlign: "center", padding: 12, color: "var(--cw-fg-muted)", fontSize: 12 }}>正在生成…</div>
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
        onSend={onSend}
        onInterrupt={onInterrupt}
        onResendLast={async () => {
          try {
            await codex.rollbackThread(threadId, 1);
          } catch (err) {
            console.warn("rollback failed", err);
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
          onSelect={onSelectModel}
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
  onSelect,
  onClose
}: {
  models: ModelOption[] | null;
  current: string | null;
  onSelect: (m: ModelOption) => void;
  onClose: () => void;
}): JSX.Element {
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
      </div>
    </Overlay>
  );
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
  display: "flex",
  flexDirection: "column",
  gap: 10
};

const jumpBtn: React.CSSProperties = {
  position: "absolute",
  right: 16,
  bottom: 96,
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
  bottom: 92,
  background: "var(--cw-card)",
  border: "1px solid var(--cw-border)",
  borderRadius: 10,
  padding: "8px 14px",
  fontSize: 14,
  boxShadow: "0 6px 18px rgba(0,0,0,0.25)",
  zIndex: 80
};
