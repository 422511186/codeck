"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ApiError } from "../../web/api/client";
import { codex } from "../../web/api/endpoints";
import { findProjectByPath, mergeProjectCatalog, type ProjectPathConflict } from "../../web/projects/catalog";
import {
  addProject,
  listProjects,
  removeProject,
  touchProjectLastUsed,
  type Project
} from "../../web/storage/projects";
import type { ProjectCatalog, ProjectStorage } from "../../shared/projects";

export default function ProjectsPage(): JSX.Element {
  const router = useRouter();
  const [localProjects, setLocalProjects] = useState<Project[]>([]);
  const [serverCatalog, setServerCatalog] = useState<ProjectCatalog | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [serverLoading, setServerLoading] = useState(true);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [showAdd, setShowAdd] = useState(false);
  const [conflictFor, setConflictFor] = useState<ProjectPathConflict | null>(null);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [operationPending, setOperationPending] = useState(false);

  const merged = useMemo(
    () => mergeProjectCatalog(localProjects, serverCatalog?.projects ?? []),
    [localProjects, serverCatalog]
  );

  useEffect(() => {
    refreshLocal();
    void refreshServer();
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const next: Record<string, number> = {};
      for (const project of merged.projects) {
        try {
          const response = await codex.listThreads({ cwd: project.path });
          next[project.id] = response.threads?.length ?? 0;
        } catch {
          next[project.id] = 0;
        }
      }
      if (!cancelled) setCounts(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [merged.projects]);

  function refreshLocal(): void {
    setLocalProjects(listProjects());
  }

  async function refreshServer(): Promise<void> {
    setServerLoading(true);
    try {
      setServerCatalog(await codex.projectCatalog());
      setServerError(null);
    } catch (error) {
      setServerCatalog(null);
      setServerError(errorMessage(error, "服务端项目加载失败"));
    } finally {
      setServerLoading(false);
    }
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

  function enterProject(project: Project): void {
    const now = Date.now();
    if (storageOf(project) === "client") {
      touchProjectLastUsed(project.id);
      refreshLocal();
    } else {
      void codex.touchServerProject(project.id, now).then(setServerCatalog).catch(() => undefined);
    }
    router.push(`/projects/${project.id}`);
  }

  async function addNewProject(input: { path: string; name: string; storage: ProjectStorage }): Promise<void> {
    await codex.listThreads({ cwd: input.path, limit: 1 });
    if (findProjectByPath(merged.projects, input.path)) {
      throw new Error("该工作区已在项目列表中");
    }
    if (input.storage === "client") {
      addProject(input.path, input.name);
      refreshLocal();
      return;
    }
    if (!serverCatalog) throw new Error("服务端项目目录当前不可用");
    setServerCatalog(await codex.createServerProject({ name: input.name, path: input.path }, serverCatalog.revision));
  }




  async function resolveConflict(keep: "client" | "server"): Promise<void> {
    if (!conflictFor || !serverCatalog) return;
    setOperationPending(true);
    setOperationError(null);
    try {
      if (keep === "server") {
        removeProject(conflictFor.local.id);
        refreshLocal();
      } else {
        setServerCatalog(await codex.deleteServerProject(conflictFor.server.id, serverCatalog.revision));
      }
      setConflictFor(null);
    } catch (error) {
      acceptCatalogFromError(error);
      setOperationError(errorMessage(error, "处理项目冲突失败"));
    } finally {
      setOperationPending(false);
    }
  }

  const showEmpty = !serverLoading && !serverError && merged.projects.length === 0;

  return (
    <main style={{ padding: "var(--cw-space-4)", paddingBottom: 96 }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "var(--cw-space-2) 0" }}>
        <h1 style={{ fontSize: 20, margin: 0 }}>项目</h1>
        <Link href="/settings" aria-label="设置" style={{ fontSize: 22, textDecoration: "none" }}>⚙️</Link>
      </header>

      {serverError ? (
        <div role="alert" style={alertStyle}>
          <span style={{ flex: 1 }}>{serverError}</span>
          <button type="button" onClick={() => void refreshServer()} style={btnGhost}>重试</button>
        </div>
      ) : null}

      {operationError ? <div role="alert" style={alertStyle}>{operationError}</div> : null}

      {merged.conflicts.map((conflict) => (
        <button
          key={`${conflict.local.id}:${conflict.server.id}`}
          type="button"
          onClick={() => setConflictFor(conflict)}
          style={{ ...alertStyle, width: "100%", textAlign: "left", color: "var(--cw-danger)" }}
        >
          {conflict.server.name} 存在存储冲突，点击处理
        </button>
      ))}

      {showEmpty ? (
        <EmptyState onAdd={() => setShowAdd(true)} />
      ) : serverLoading && merged.projects.length === 0 ? (
        <div style={{ padding: 16, color: "var(--cw-fg-muted)" }}>加载项目中…</div>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
          {merged.projects.map((project) => (
            <li
              key={project.id}
              onClick={() => enterProject(project)}
              style={{
                background: "var(--cw-card)",
                border: "1px solid var(--cw-border)",
                borderRadius: 8,
                padding: 14,
                display: "flex",
                flexDirection: "column",
                gap: 6,
                userSelect: "none"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0, fontWeight: 600, fontSize: 16 }}>{project.name}</div>
                <span style={storageBadgeStyle}>{storageOf(project) === "server" ? "服务端" : "当前设备"}</span>
              </div>
              <div style={{ fontSize: 13, color: "var(--cw-fg-muted)", wordBreak: "break-all" }}>{project.path}</div>
              <div style={{ fontSize: 12, color: "var(--cw-fg-muted)" }}>
                {formatRelativeShort(project.lastUsedAt)} · {counts[project.id] ?? "—"} 个会话
              </div>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={() => setShowAdd(true)}
        aria-label="添加项目"
        disabled={serverLoading}
        style={{ ...fabStyle, opacity: serverLoading ? 0.6 : 1 }}
      >
        +
      </button>

      {showAdd ? (
        <AddProjectModal
          defaultStorage={serverCatalog?.defaultStorage ?? "client"}
          serverAvailable={Boolean(serverCatalog)}
          onClose={() => setShowAdd(false)}
          onSubmit={addNewProject}
        />
      ) : null}
      {conflictFor ? (
        <ConflictModal
          conflict={conflictFor}
          pending={operationPending}
          onClose={() => setConflictFor(null)}
          onKeepClient={() => void resolveConflict("client")}
          onKeepServer={() => void resolveConflict("server")}
        />
      ) : null}
    </main>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }): JSX.Element {
  return (
    <div style={{ marginTop: 80, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 16, color: "var(--cw-fg-muted)" }}>
      <div style={{ fontSize: 64 }}>📂</div>
      <div style={{ fontSize: 16 }}>还没有项目</div>
      <button type="button" onClick={onAdd} style={btnPrimary}>添加项目</button>
    </div>
  );
}

function AddProjectModal({
  defaultStorage,
  serverAvailable,
  onClose,
  onSubmit
}: {
  defaultStorage: ProjectStorage;
  serverAvailable: boolean;
  onClose: () => void;
  onSubmit: (input: { path: string; name: string; storage: ProjectStorage }) => Promise<void>;
}): JSX.Element {
  const [path, setPath] = useState("");
  const [name, setName] = useState("");
  const [storage, setStorage] = useState<ProjectStorage>(serverAvailable ? defaultStorage : "client");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(): Promise<void> {
    if (!path.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({ path: path.trim(), name: name.trim() || lastSegment(path.trim()), storage });
      onClose();
    } catch (submitError) {
      setError(errorMessage(submitError, "添加项目失败"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Backdrop onClose={onClose}>
      <div style={modalStyle}>
        <h2 style={{ margin: 0, fontSize: 18 }}>添加项目</h2>
        <label style={fieldStyle}>
          <span style={fieldLabelStyle}>工作区路径</span>
          <input value={path} onChange={(event) => setPath(event.target.value)} placeholder="C:/Users/xxx/workspace/proj" style={inputStyle} autoFocus />
        </label>
        <label style={fieldStyle}>
          <span style={fieldLabelStyle}>别名（可选）</span>
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="留空默认取目录名" style={inputStyle} />
        </label>
        <label style={fieldStyle}>
          <span style={fieldLabelStyle}>保存位置</span>
          <select value={storage} onChange={(event) => setStorage(event.target.value as ProjectStorage)} style={inputStyle}>
            <option value="client">仅当前设备</option>
            <option value="server" disabled={!serverAvailable}>保存到服务端</option>
          </select>
        </label>
        {error ? <span style={{ color: "var(--cw-danger)", fontSize: 13 }}>{error}</span> : null}
        <div style={dialogActionsStyle}>
          <button type="button" onClick={onClose} style={btnGhost}>取消</button>
          <button type="button" onClick={() => void submit()} disabled={!path.trim() || submitting} style={btnPrimary}>
            {submitting ? "保存中…" : "添加"}
          </button>
        </div>
      </div>
    </Backdrop>
  );
}



function ConflictModal({
  conflict,
  pending,
  onClose,
  onKeepClient,
  onKeepServer
}: {
  conflict: ProjectPathConflict;
  pending: boolean;
  onClose: () => void;
  onKeepClient: () => void;
  onKeepServer: () => void;
}): JSX.Element {
  return (
    <Backdrop onClose={onClose}>
      <div style={modalStyle}>
        <h2 style={{ margin: 0, fontSize: 18 }}>处理项目冲突</h2>
        <div style={{ fontSize: 14, color: "var(--cw-fg-muted)", wordBreak: "break-all" }}>{conflict.server.path}</div>
        <button type="button" disabled={pending} style={sheetItem} onClick={onKeepServer}>保留服务端记录</button>
        <button type="button" disabled={pending} style={sheetItem} onClick={onKeepClient}>保留当前设备记录</button>
        <button type="button" disabled={pending} style={sheetItem} onClick={onClose}>取消</button>
      </div>
    </Backdrop>
  );
}

function Backdrop({ onClose, align = "center", children }: { onClose: () => void; align?: "center" | "bottom"; children: React.ReactNode }): JSX.Element {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: align === "bottom" ? "flex-end" : "center", justifyContent: "center", zIndex: 50 }}>
      <div onClick={(event) => event.stopPropagation()} style={{ width: "100%", maxWidth: 420 }}>{children}</div>
    </div>
  );
}


function storageOf(project: Project): ProjectStorage {
  return project.storage === "server" ? "server" : "client";
}

function lastSegment(path: string): string {
  const cleaned = path.replace(/[\\/]+$/, "");
  const parts = cleaned.split(/[\\/]/);
  return parts[parts.length - 1] || cleaned;
}

function formatRelativeShort(timestamp: number): string {
  const diff = Date.now() - timestamp;
  if (diff < 60_000) return "刚刚";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`;
  return `${Math.floor(diff / 86_400_000)} 天前`;
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

const fieldStyle: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 6 };
const fieldLabelStyle: React.CSSProperties = { fontSize: 13, color: "var(--cw-fg-muted)" };
const dialogActionsStyle: React.CSSProperties = { display: "flex", gap: 10, justifyContent: "flex-end" };
const modalStyle: React.CSSProperties = { background: "var(--cw-card)", border: "1px solid var(--cw-border)", borderRadius: 8, padding: 18, margin: 16, display: "flex", flexDirection: "column", gap: 12 };
const inputStyle: React.CSSProperties = { padding: "10px 12px", borderRadius: 8, border: "1px solid var(--cw-border)", background: "var(--cw-bg)", color: "var(--cw-fg)", fontSize: 15 };
const btnGhost: React.CSSProperties = { padding: "8px 14px", borderRadius: 8, border: "1px solid var(--cw-border)", background: "transparent", color: "var(--cw-fg)" };
const btnPrimary: React.CSSProperties = { padding: "8px 14px", borderRadius: 8, border: "none", background: "var(--cw-accent)", color: "#fff" };
const sheetItem: React.CSSProperties = { padding: "12px 8px", borderRadius: 8, border: "none", background: "transparent", color: "var(--cw-fg)", fontSize: 16, textAlign: "left" };
const alertStyle: React.CSSProperties = { display: "flex", alignItems: "center", gap: 8, padding: 10, marginBottom: 10, border: "1px solid var(--cw-border)", borderRadius: 8, background: "var(--cw-bg-elevated)", color: "var(--cw-danger)", fontSize: 13 };
const storageBadgeStyle: React.CSSProperties = { flexShrink: 0, padding: "2px 6px", border: "1px solid var(--cw-border)", borderRadius: 4, color: "var(--cw-fg-muted)", fontSize: 11 };
const fabStyle: React.CSSProperties = { position: "fixed", right: 20, bottom: 24, width: 56, height: 56, borderRadius: 28, border: "none", background: "var(--cw-accent)", color: "#fff", fontSize: 28, boxShadow: "0 6px 18px rgba(0,0,0,0.25)" };
