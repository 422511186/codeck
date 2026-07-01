"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { codex } from "../../../web/api/endpoints";
import { ApiError } from "../../../web/api/client";
import { getProject, touchProjectLastUsed, type Project } from "../../../web/storage/projects";
import { settingsStore } from "../../../web/storage/settings";
import { saveJson, threadModeKey } from "../../../web/storage/localStore";
import {
  DEFAULT_COLLABORATION_MODEL,
  collaborationModeForChatMode,
  type ThreadSummary
} from "../../../web/api/types";

type Tab = "active" | "archived";

export default function ProjectThreadsPage(): JSX.Element {
  const router = useRouter();
  const params = useParams<{ projectId: string }>();
  const projectId = String(params?.projectId ?? "");
  const [project, setProject] = useState<Project | null>(null);
  const [tab, setTab] = useState<Tab>("active");
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionFor, setActionFor] = useState<{ thread: ThreadSummary; tab: Tab } | null>(null);
  const [actionPendingId, setActionPendingId] = useState<string | null>(null);
  const suppressClickThreadId = useRef<string | null>(null);

  useEffect(() => {
    const p = getProject(projectId);
    if (!p) {
      router.replace("/projects");
      return;
    }
    setProject(p);
    touchProjectLastUsed(p.id);
  }, [projectId, router]);

  useEffect(() => {
    if (!project) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const list = await codex.listThreadsForCwd(project.path, tab === "archived");
        if (!cancelled) {
          setThreads(list);
          setLoading(false);
        }
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : (err as Error).message);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [project, tab]);

  async function startNewThread(): Promise<void> {
    if (!project) return;
    try {
      const settings = settingsStore.load();
      const serverDefaults = settings.defaultMode === "plan" ? await readServerDefaults() : null;
      const planModel = settings.defaultModel ?? serverDefaults?.model ?? DEFAULT_COLLABORATION_MODEL;
      const planEffort = serverDefaults?.reasoningEffort ?? null;
      const thread = await codex.startThread({
        cwd: project.path,
        ...(settings.defaultModel ? { model: settings.defaultModel } : {})
      });
      saveJson(threadModeKey(thread.id), settings.defaultMode);
      if (settings.defaultMode === "plan") {
        try {
          await codex.updateThreadSettings(thread.id, {
            collaborationMode: collaborationModeForChatMode("plan", planModel, planEffort)
          });
        } catch (err) {
          console.warn("sync default thread mode failed", err);
        }
      }
      router.push(`/threads/${thread.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : (err as Error).message);
    }
  }

  async function submitArchiveAction(): Promise<void> {
    if (!actionFor || actionPendingId) return;
    const { thread, tab: actionTab } = actionFor;
    setActionPendingId(thread.id);
    setError(null);
    try {
      if (actionTab === "archived") {
        await codex.unarchiveThread(thread.id);
      } else {
        await codex.archiveThread(thread.id);
      }
      setThreads((prev) => prev.filter((item) => item.id !== thread.id));
      setActionFor(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : (err as Error).message);
    } finally {
      setActionPendingId(null);
    }
  }

  if (!project) return <main style={{ padding: 16 }} />;

  return (
    <main
      style={{
        height: "100dvh",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        padding: "var(--cw-space-4)",
        paddingBottom: 0
      }}
    >
      <header style={{ display: "flex", alignItems: "center", gap: 10, padding: "var(--cw-space-2) 0", flexShrink: 0 }}>
        <Link href="/projects" aria-label="返回" style={{ fontSize: 22, textDecoration: "none" }}>
          ‹
        </Link>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {project.name}
          </div>
          <div style={{ fontSize: 12, color: "var(--cw-fg-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {project.path}
          </div>
        </div>
      </header>

      <div
        role="tablist"
        style={{
          display: "flex",
          gap: 4,
          padding: 4,
          background: "var(--cw-bg-elevated)",
          borderRadius: 10,
          margin: "12px 0",
          flexShrink: 0
        }}
      >
        <TabButton active={tab === "active"} onClick={() => setTab("active")}>
          进行中
        </TabButton>
        <TabButton active={tab === "archived"} onClick={() => setTab("archived")}>
          已归档
        </TabButton>
      </div>

      <div
        data-testid="project-thread-scroll"
        style={{
          flex: "1 1 0%",
          minHeight: 0,
          overflowY: "auto",
          paddingBottom: "calc(96px + var(--safe-bottom))"
        }}
      >
        {loading ? (
          <ThreadSkeleton />
        ) : error ? (
          <div style={{ color: "var(--cw-danger)", padding: 14, fontSize: 14 }}>{error}</div>
        ) : threads.length === 0 ? (
          <EmptyState tab={tab} onStart={startNewThread} />
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
            {threads.map((t) => (
              <ThreadRow
                key={t.id}
                thread={t}
                onClick={() => {
                  if (suppressClickThreadId.current === t.id) {
                    suppressClickThreadId.current = null;
                    return;
                  }
                  router.push(`/threads/${t.id}`);
                }}
                onLongPress={() => {
                  suppressClickThreadId.current = t.id;
                  setActionFor({ thread: t, tab });
                }}
              />
            ))}
          </ul>
        )}
      </div>

      <button
        type="button"
        onClick={startNewThread}
        aria-label="新建会话"
        style={{
          position: "fixed",
          right: 20,
          bottom: 24,
          width: 56,
          height: 56,
          borderRadius: 28,
          border: "none",
          background: "var(--cw-accent)",
          color: "#fff",
          fontSize: 28,
          boxShadow: "0 6px 18px rgba(0,0,0,0.25)"
        }}
      >
        +
      </button>

      {actionFor ? (
        <ThreadActionSheet
          action={actionFor}
          pending={actionPendingId === actionFor.thread.id}
          onClose={() => {
            if (!actionPendingId) setActionFor(null);
          }}
          onSubmit={submitArchiveAction}
        />
      ) : null}
    </main>
  );
}

async function readServerDefaults(): Promise<{ model: string | null; reasoningEffort: string | null } | null> {
  try {
    const settings = await codex.settings();
    return {
      model: settings.model,
      reasoningEffort: settings.reasoningEffort
    };
  } catch {
    return null;
  }
}

function TabButton({
  active,
  onClick,
  children
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      style={{
        flex: 1,
        padding: "8px 12px",
        borderRadius: 8,
        border: "none",
        background: active ? "var(--cw-card)" : "transparent",
        color: active ? "var(--cw-fg)" : "var(--cw-fg-muted)",
        fontSize: 14,
        boxShadow: active ? "var(--shadow-card)" : "none"
      }}
    >
      {children}
    </button>
  );
}

function ThreadRow({
  thread,
  onClick,
  onLongPress
}: {
  thread: ThreadSummary;
  onClick: () => void;
  onLongPress: () => void;
}): JSX.Element {
  const running = thread.status === "running";
  const title = thread.title || "新会话";
  const preview = thread.preview || "";
  const time = useMemo(() => formatRelative(thread.updatedAt), [thread.updatedAt]);
  const timerRef = useRef<number | null>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const longPressedRef = useRef(false);

  function clearPressTimer(): void {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  useEffect(() => clearPressTimer, []);

  function handlePointerDown(event: React.PointerEvent<HTMLLIElement>): void {
    if (event.button !== 0) return;
    clearPressTimer();
    longPressedRef.current = false;
    startRef.current = { x: event.clientX, y: event.clientY };
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      longPressedRef.current = true;
      onLongPress();
    }, 500);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLLIElement>): void {
    const start = startRef.current;
    if (!start) return;
    const dx = Math.abs(event.clientX - start.x);
    const dy = Math.abs(event.clientY - start.y);
    if (dx > 8 || dy > 8) {
      clearPressTimer();
      startRef.current = null;
    }
  }

  function handlePointerEnd(): void {
    clearPressTimer();
    startRef.current = null;
  }

  function handleClick(): void {
    if (longPressedRef.current) {
      longPressedRef.current = false;
      return;
    }
    onClick();
  }

  return (
    <li
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      onPointerLeave={handlePointerEnd}
      onClick={handleClick}
      style={{
        background: "var(--cw-card)",
        border: "1px solid var(--cw-border)",
        borderRadius: 12,
        padding: 12,
        display: "flex",
        flexDirection: "column",
        gap: 4,
        userSelect: "none"
      }}
    >
      <div
        style={{
          fontWeight: 600,
          fontSize: 15,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap"
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontSize: 13,
          color: "var(--cw-fg-muted)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap"
        }}
      >
        {preview || "（暂无消息）"}
      </div>
      <div style={{ fontSize: 12, color: running ? "var(--cw-accent)" : "var(--cw-fg-subtle)" }}>
        {running ? "正在运行" : time}
      </div>
    </li>
  );
}

function ThreadActionSheet({
  action,
  pending,
  onClose,
  onSubmit
}: {
  action: { thread: ThreadSummary; tab: Tab };
  pending: boolean;
  onClose: () => void;
  onSubmit: () => void;
}): JSX.Element {
  const isArchived = action.tab === "archived";
  const label = isArchived ? "移出归档" : "归档";
  const title = action.thread.title || "新会话";
  return (
    <Backdrop onClose={onClose} align="bottom">
      <div style={bottomSheetStyle}>
        <div style={{ fontSize: 13, color: "var(--cw-fg-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {title}
        </div>
        <button
          type="button"
          disabled={pending}
          style={{ ...sheetItem, color: isArchived ? "var(--cw-fg)" : "var(--cw-danger)", opacity: pending ? 0.6 : 1 }}
          onClick={onSubmit}
        >
          {pending ? `${label}中…` : label}
        </button>
        <button type="button" disabled={pending} style={{ ...sheetItem, opacity: pending ? 0.6 : 1 }} onClick={onClose}>
          取消
        </button>
      </div>
    </Backdrop>
  );
}

function Backdrop({
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
        background: "rgba(0,0,0,0.4)",
        display: "flex",
        alignItems: align === "bottom" ? "flex-end" : "center",
        justifyContent: "center",
        zIndex: 50
      }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 420 }}>
        {children}
      </div>
    </div>
  );
}

function ThreadSkeleton(): JSX.Element {
  return (
    <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <li
          key={i}
          style={{
            background: "var(--cw-card)",
            border: "1px solid var(--cw-border)",
            borderRadius: 12,
            padding: 12,
            display: "flex",
            flexDirection: "column",
            gap: 6
          }}
        >
          <div style={{ height: 14, width: "60%", background: "var(--bg-skeleton)", borderRadius: 4 }} />
          <div style={{ height: 12, width: "80%", background: "var(--bg-skeleton)", borderRadius: 4 }} />
          <div style={{ height: 10, width: "30%", background: "var(--bg-skeleton)", borderRadius: 4 }} />
        </li>
      ))}
    </ul>
  );
}

function EmptyState({ tab, onStart }: { tab: Tab; onStart: () => void }): JSX.Element {
  return (
    <div
      style={{
        marginTop: 80,
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 14,
        color: "var(--cw-fg-muted)"
      }}
    >
      <div style={{ fontSize: 56 }}>{tab === "archived" ? "🗃️" : "💬"}</div>
      <div style={{ fontSize: 15 }}>
        {tab === "archived" ? "暂无归档会话" : "这个项目还没有会话"}
      </div>
      {tab === "active" ? (
        <button
          type="button"
          onClick={onStart}
          style={{
            padding: "10px 22px",
            borderRadius: 12,
            border: "none",
            background: "var(--cw-accent)",
            color: "#fff",
            fontSize: 15
          }}
        >
          开始第一个会话
        </button>
      ) : null}
    </div>
  );
}

const modalStyle: React.CSSProperties = {
  background: "var(--cw-card)",
  border: "1px solid var(--cw-border)",
  borderRadius: 16,
  padding: 18,
  margin: 16,
  display: "flex",
  flexDirection: "column",
  gap: 12
};

const bottomSheetStyle: React.CSSProperties = {
  ...modalStyle,
  borderBottomLeftRadius: 0,
  borderBottomRightRadius: 0,
  margin: "0 16px",
  paddingBottom: "calc(18px + var(--safe-bottom))"
};

const sheetItem: React.CSSProperties = {
  padding: "12px 8px",
  borderRadius: 10,
  border: "none",
  background: "transparent",
  color: "var(--cw-fg)",
  fontSize: 16,
  textAlign: "left"
};

function formatRelative(ts: number): string {
  if (!ts) return "";
  const normalized = ts < 10_000_000_000 ? ts * 1000 : ts;
  const diff = Date.now() - normalized;
  if (diff < 60_000) return "刚刚";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`;
  if (diff < 86_400_000 * 7) return `${Math.floor(diff / 86_400_000)} 天前`;
  return new Date(normalized).toLocaleDateString();
}
