"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { codex } from "../../../web/api/endpoints";
import { ApiError } from "../../../web/api/client";
import { dedupeRequest, runLockedAction } from "../../../web/api/requestCoordinator";
import {
  getProject,
  listProjects,
  removeProject,
  renameProject,
  saveLocalProject,
  touchProjectLastUsed,
  type Project
} from "../../../web/storage/projects";
import type { ProjectCatalog, ProjectStorage } from "../../../shared/projects";
import { migrateLegacyDefaultModel, settingsStore } from "../../../web/storage/settings";
import { saveJson, threadModeKey } from "../../../web/storage/localStore";
import {
  DEFAULT_COLLABORATION_MODEL,
  collaborationModeForChatMode,
  type ThreadSummary
} from "../../../web/api/types";
import { modelSelectionsEqual, type ModelSelection, type SelectableModel } from "../../../shared/custom-models";
import { ActionSheet, ActionSheetItem, SwipeActionRow, UndoToast } from "../../../web/components/mobile";

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
  const [startPending, setStartPending] = useState(false);
  const [undoToast, setUndoToast] = useState<{ threadId: string; kind: "archive" | "unarchive" } | null>(null);
  const undoTimerRef = useRef<number | null>(null);
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [projectOpPending, setProjectOpPending] = useState(false);
  const [projectOpError, setProjectOpError] = useState<string | null>(null);
  const [serverCatalog, setServerCatalog] = useState<ProjectCatalog | null>(null);
  const listRequestSeq = useRef(0);

  useEffect(() => {
    let cancelled = false;
    const localProject = getProject(projectId);
    if (localProject) {
      setProject(localProject);
      touchProjectLastUsed(localProject.id);
      void codex.projectCatalog().then(setServerCatalog).catch(() => setServerCatalog(null));
      return () => {
        cancelled = true;
      };
    }
    (async () => {
      try {
        const catalog = await codex.projectCatalog();
        setServerCatalog(catalog);
        const serverProject = catalog.projects.find((entry) => entry.id === projectId);
        if (!serverProject) {
          router.replace("/projects");
          return;
        }
        if (cancelled) return;
        setProject(serverProject);
        void codex.touchServerProject(serverProject.id, Date.now()).catch(() => undefined);
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "无法读取服务端项目");
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, router]);

  useEffect(() => {
    if (!project) return;
    let cancelled = false;
    const requestSeq = ++listRequestSeq.current;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const list = await dedupeRequest(
          `projectThreads:${project.id}:${tab}`,
          () => codex.listThreadsForCwd(project.path, tab === "archived")
        );
        if (!cancelled && requestSeq === listRequestSeq.current) {
          setThreads(list);
          setLoading(false);
        }
      } catch (err) {
        if (cancelled || requestSeq !== listRequestSeq.current) return;
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
      setError(null);
      const clientOperationId = uniqueClientOperationId("start-thread");
      const result = await runLockedAction(`startThread:${project.id}`, async () => {
        setStartPending(true);
        try {
          const catalog = await codex.modelCatalog();
          const settings = migrateLegacyDefaultModel(catalog.models, catalog.appServerModelNames);
          const serverDefaults = settings.defaultMode === "plan" ? await readServerDefaults() : null;
          const selectedModel = findSelectedModel(catalog.models, settings.defaultModel);
          const planModel = selectedModel?.model ?? serverDefaults?.model ?? DEFAULT_COLLABORATION_MODEL;
          const planEffort = serverDefaults?.reasoningEffort ?? null;
          const startInput = {
            cwd: project.path,
            clientOperationId,
            ...(settings.defaultModel
              ? { modelSelection: settings.defaultModel, catalogRevision: catalog.catalogRevision }
              : {})
          };
          let thread;
          try {
            thread = await codex.startThread(startInput);
          } catch (startError) {
            if (!settings.defaultModel || !isInvalidDefaultModelError(startError)) {
              throw startError;
            }
            settingsStore.update({ defaultModel: null });
            thread = await codex.startThread({ cwd: project.path, clientOperationId });
          }
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
          return thread.id;
        } finally {
          setStartPending(false);
        }
      });
      if (result.started) {
        router.push(`/threads/${result.value}`);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : (err as Error).message);
    }
  }

  useEffect(() => {
    return () => {
      if (undoTimerRef.current !== null) {
        window.clearTimeout(undoTimerRef.current);
      }
    };
  }, []);

  function scheduleUndoClear(): void {
    if (undoTimerRef.current !== null) {
      window.clearTimeout(undoTimerRef.current);
    }
    undoTimerRef.current = window.setTimeout(() => {
      setUndoToast(null);
      undoTimerRef.current = null;
    }, 4500);
  }

  async function runThreadArchiveAction(thread: ThreadSummary, actionTab: Tab): Promise<void> {
    if (actionPendingId) return;
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
      setUndoToast({ threadId: thread.id, kind: actionTab === "archived" ? "unarchive" : "archive" });
      scheduleUndoClear();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : (err as Error).message);
    } finally {
      setActionPendingId(null);
    }
  }

  async function submitArchiveAction(): Promise<void> {
    if (!actionFor) return;
    await runThreadArchiveAction(actionFor.thread, actionFor.tab);
  }

  async function undoLastArchiveAction(): Promise<void> {
    if (!undoToast || actionPendingId) return;
    const { threadId, kind } = undoToast;
    setActionPendingId(threadId);
    setError(null);
    try {
      if (kind === "archive") {
        await codex.unarchiveThread(threadId);
      } else {
        await codex.archiveThread(threadId);
      }
      setUndoToast(null);
      if (project) {
        const list = await codex.listThreadsForCwd(project.path, tab === "archived");
        setThreads(list);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : (err as Error).message);
    } finally {
      setActionPendingId(null);
    }
  }


  function storageOf(p: Project): ProjectStorage {
    return p.storage === "server" ? "server" : "client";
  }

  function acceptCatalogFromError(error: unknown): void {
    if (!(error instanceof ApiError) || typeof error.body !== "object" || error.body === null) return;
    const body = error.body as Partial<ProjectCatalog>;
    if (
      typeof body.revision === "number" &&
      (body.defaultStorage === "client" || body.defaultStorage === "server") &&
      Array.isArray(body.projects)
    ) {
      setServerCatalog({
        revision: body.revision,
        defaultStorage: body.defaultStorage,
        projects: body.projects
      });
    }
  }

  async function renameCurrentProject(name: string): Promise<void> {
    if (!project || !name.trim()) return;
    setProjectOpPending(true);
    setProjectOpError(null);
    try {
      if (storageOf(project) === "client") {
        renameProject(project.id, name.trim());
        setProject({ ...project, name: name.trim() });
      } else {
        if (!serverCatalog) throw new Error("服务端项目目录当前不可用");
        const catalog = await codex.renameServerProject(project.id, name.trim(), serverCatalog.revision);
        setServerCatalog(catalog);
        const updated = catalog.projects.find((entry) => entry.id === project.id);
        if (updated) setProject(updated);
      }
      setRenameOpen(false);
      setProjectMenuOpen(false);
    } catch (error) {
      acceptCatalogFromError(error);
      setProjectOpError(error instanceof Error ? error.message : "重命名项目失败");
    } finally {
      setProjectOpPending(false);
    }
  }

  async function moveCurrentProject(): Promise<void> {
    if (!project || !serverCatalog) return;
    setProjectOpPending(true);
    setProjectOpError(null);
    try {
      if (storageOf(project) === "client") {
        const catalog = await codex.createServerProject(
          {
            id: project.id,
            name: project.name,
            path: project.path,
            addedAt: project.addedAt,
            lastUsedAt: project.lastUsedAt
          },
          serverCatalog.revision
        );
        removeProject(project.id);
        setServerCatalog(catalog);
        const updated = catalog.projects.find((entry) => entry.id === project.id);
        if (updated) setProject(updated);
      } else {
        saveLocalProject(project);
        try {
          const catalog = await codex.deleteServerProject(project.id, serverCatalog.revision);
          setServerCatalog(catalog);
          const local = listProjects().find((entry) => entry.id === project.id) ?? { ...project, storage: "client" as const };
          setProject(local);
        } catch (error) {
          removeProject(project.id);
          throw error;
        }
      }
      setProjectMenuOpen(false);
    } catch (error) {
      acceptCatalogFromError(error);
      setProjectOpError(error instanceof Error ? error.message : "修改存储位置失败");
    } finally {
      setProjectOpPending(false);
    }
  }

  async function removeCurrentProject(): Promise<void> {
    if (!project) return;
    const ok = window.confirm(`确定从列表移除「${project.name}」？不会删除工作区文件。`);
    if (!ok) return;
    setProjectOpPending(true);
    setProjectOpError(null);
    try {
      if (storageOf(project) === "client") {
        removeProject(project.id);
      } else {
        if (!serverCatalog) throw new Error("服务端项目目录当前不可用");
        await codex.deleteServerProject(project.id, serverCatalog.revision);
      }
      router.replace("/projects");
    } catch (error) {
      acceptCatalogFromError(error);
      setProjectOpError(error instanceof Error ? error.message : "移除项目失败");
    } finally {
      setProjectOpPending(false);
    }
  }

  if (!project) {
    return (
      <main style={{ padding: 16 }}>
        {error ? <div style={{ color: "var(--cw-danger)", fontSize: 14 }}>{error}</div> : null}
      </main>
    );
  }

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
      
        <button
          type="button"
          aria-label="项目设置"
          onClick={() => {
            setProjectOpError(null);
            setProjectMenuOpen(true);
          }}
          style={{
            border: "none",
            background: "transparent",
            color: "var(--cw-fg-muted)",
            fontSize: 14,
            padding: "6px 8px"
          }}
        >
          设置
        </button>
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
                tab={tab}
                actionPending={actionPendingId === t.id}
                onOpen={() => {
                  if (tab === "archived") {
                    setActionFor({ thread: t, tab });
                    return;
                  }
                  router.push(`/threads/${t.id}`);
                }}
                onSwipeAction={() => {
                  void runThreadArchiveAction(t, tab);
                }}
              />
            ))}
          </ul>
        )}
      </div>

      <button
        type="button"
        onClick={startNewThread}
        disabled={startPending}
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
      {undoToast ? (
        <UndoToast
          message={undoToast.kind === "archive" ? "已归档" : "已移出归档"}
          onUndo={() => {
            void undoLastArchiveAction();
          }}
          onDismiss={() => setUndoToast(null)}
        />
      ) : null}
    
      {projectMenuOpen ? (
        <ActionSheet
          title={project.name}
          onClose={() => {
            if (!projectOpPending) setProjectMenuOpen(false);
          }}
          aria-label="项目操作"
        >
          {projectOpError ? (
            <div style={{ color: "var(--cw-danger)", fontSize: 13, padding: "4px 8px 8px" }}>{projectOpError}</div>
          ) : null}
          <ActionSheetItem
            label="重命名"
            disabled={projectOpPending || (storageOf(project) === "server" && !serverCatalog)}
            onClick={() => {
              setRenameValue(project.name);
              setRenameOpen(true);
              setProjectMenuOpen(false);
            }}
          />
          <ActionSheetItem
            label={storageOf(project) === "server" ? "改为仅当前设备" : "保存到服务端"}
            disabled={projectOpPending || !serverCatalog}
            onClick={() => {
              void moveCurrentProject();
            }}
          />
          <ActionSheetItem
            label="从列表移除"
            tone="danger"
            divided
            disabled={projectOpPending || (storageOf(project) === "server" && !serverCatalog)}
            onClick={() => {
              void removeCurrentProject();
            }}
          />
          <ActionSheetItem
            label="取消"
            divided
            disabled={projectOpPending}
            onClick={() => setProjectMenuOpen(false)}
          />
        </ActionSheet>
      ) : null}
      {renameOpen ? (
        <ActionSheet
          title="重命名项目"
          align="center"
          onClose={() => {
            if (!projectOpPending) setRenameOpen(false);
          }}
        >
          <input
            value={renameValue}
            onChange={(event) => setRenameValue(event.target.value)}
            autoFocus
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid var(--cw-border)",
              background: "var(--cw-bg)",
              color: "var(--cw-fg)",
              fontSize: 16
            }}
          />
          {projectOpError ? (
            <div style={{ color: "var(--cw-danger)", fontSize: 13 }}>{projectOpError}</div>
          ) : null}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", paddingTop: 8 }}>
            <button
              type="button"
              disabled={projectOpPending}
              onClick={() => setRenameOpen(false)}
              style={{ padding: "8px 12px", border: "none", background: "transparent", color: "var(--cw-fg)" }}
            >
              取消
            </button>
            <button
              type="button"
              disabled={projectOpPending || !renameValue.trim()}
              onClick={() => {
                void renameCurrentProject(renameValue);
              }}
              style={{
                padding: "8px 14px",
                border: "none",
                borderRadius: 10,
                background: "var(--cw-accent)",
                color: "#fff"
              }}
            >
              保存
            </button>
          </div>
        </ActionSheet>
      ) : null}
    </main>
  );
}

function uniqueClientOperationId(prefix: string): string {
  const random =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  return `${prefix}-${Date.now()}-${random}`;
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

function findSelectedModel(
  models: SelectableModel[],
  selection: ModelSelection | null
): SelectableModel | null {
  if (!selection) {
    return null;
  }
  return models.find((model) =>
    modelSelectionsEqual(
      model.source === "custom"
        ? { source: "custom", customModelId: model.customModelId }
        : { source: "app-server", model: model.model },
      selection
    )
  ) ?? null;
}

function isInvalidDefaultModelError(error: unknown): boolean {
  if (!(error instanceof ApiError) || typeof error.body !== "object" || error.body === null) {
    return false;
  }
  const code = (error.body as { code?: unknown }).code;
  return code === "CUSTOM_MODEL_NOT_FOUND" || code === "MODEL_SELECTION_INVALID";
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
  tab,
  actionPending,
  onOpen,
  onSwipeAction
}: {
  thread: ThreadSummary;
  tab: Tab;
  actionPending: boolean;
  onOpen: () => void;
  onSwipeAction: () => void;
}): JSX.Element {
  const running = thread.status === "running";
  const title = thread.title || "新会话";
  const preview = thread.preview || "";
  const time = useMemo(() => formatRelative(thread.updatedAt), [thread.updatedAt]);
  const actionLabel = tab === "archived" ? "移出归档" : "归档";

  return (
    <li style={{ listStyle: "none" }}>
      <SwipeActionRow
        action={{
          label: actionLabel,
          onClick: onSwipeAction,
          tone: tab === "archived" ? "default" : "danger",
          disabled: actionPending
        }}
        onContentClick={onOpen}
        disabled={actionPending}
        style={{
          border: "1px solid var(--cw-border)",
          borderRadius: 12
        }}
        contentStyle={{
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
      </SwipeActionRow>
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
    <ActionSheet title={title} onClose={onClose} aria-label="会话操作">
      <ActionSheetItem
        label={pending ? `${label}中…` : label}
        tone={isArchived ? "default" : "danger"}
        disabled={pending}
        onClick={onSubmit}
      />
      <ActionSheetItem label="取消" divided disabled={pending} onClick={onClose} />
    </ActionSheet>
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
