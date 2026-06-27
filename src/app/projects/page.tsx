"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { listProjects, addProject, removeProject, renameProject, touchProjectLastUsed, type Project } from "../../web/storage/projects";
import { codex } from "../../web/api/endpoints";
import { ApiError } from "../../web/api/client";

export default function ProjectsPage(): JSX.Element {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [showAdd, setShowAdd] = useState(false);
  const [actionFor, setActionFor] = useState<Project | null>(null);
  const [renameFor, setRenameFor] = useState<Project | null>(null);

  useEffect(() => {
    refresh();
  }, []);

  function refresh(): void {
    const list = listProjects();
    setProjects(list);
    (async () => {
      const next: Record<string, number> = {};
      for (const p of list) {
        try {
          const res = await codex.listThreads({ cwd: p.path });
          next[p.id] = res.threads?.length || 0;
        } catch {
          next[p.id] = 0;
        }
      }
      setCounts(next);
    })();
  }

  function enterProject(p: Project): void {
    touchProjectLastUsed(p.id);
    router.push(`/projects/${p.id}`);
  }

  return (
    <main style={{ padding: "var(--cw-space-4)", paddingBottom: 96 }}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "var(--cw-space-2) 0"
        }}
      >
        <h1 style={{ fontSize: 20, margin: 0 }}>项目</h1>
        <Link href="/settings" aria-label="设置" style={{ fontSize: 22, textDecoration: "none" }}>
          ⚙️
        </Link>
      </header>

      {projects.length === 0 ? (
        <EmptyState onAdd={() => setShowAdd(true)} />
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
          {projects.map((p) => (
            <li
              key={p.id}
              onPointerDown={pressHandler(p, setActionFor)}
              onClick={() => enterProject(p)}
              style={{
                background: "var(--cw-card)",
                border: "1px solid var(--cw-border)",
                borderRadius: 14,
                padding: 14,
                display: "flex",
                flexDirection: "column",
                gap: 6,
                userSelect: "none"
              }}
            >
              <div style={{ fontWeight: 600, fontSize: 16 }}>{p.name}</div>
              <div style={{ fontSize: 13, color: "var(--cw-fg-muted)", wordBreak: "break-all" }}>{p.path}</div>
              <div style={{ fontSize: 12, color: "var(--cw-fg-muted)" }}>
                {formatRelativeShort(p.lastUsedAt)} · {counts[p.id] ?? "—"} 个会话
              </div>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={() => setShowAdd(true)}
        aria-label="添加项目"
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

      {showAdd ? <AddProjectModal onClose={() => setShowAdd(false)} onAdded={refresh} /> : null}
      {actionFor ? (
        <ActionSheet
          project={actionFor}
          onClose={() => setActionFor(null)}
          onRename={() => {
            setRenameFor(actionFor);
            setActionFor(null);
          }}
          onRemove={() => {
            removeProject(actionFor.id);
            setActionFor(null);
            refresh();
          }}
        />
      ) : null}
      {renameFor ? (
        <RenameModal
          project={renameFor}
          onClose={() => setRenameFor(null)}
          onSubmit={(name) => {
            renameProject(renameFor.id, name);
            setRenameFor(null);
            refresh();
          }}
        />
      ) : null}
    </main>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }): JSX.Element {
  return (
    <div
      style={{
        marginTop: 80,
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 16,
        color: "var(--cw-fg-muted)"
      }}
    >
      <div style={{ fontSize: 64 }}>📂</div>
      <div style={{ fontSize: 16 }}>还没有项目</div>
      <button
        type="button"
        onClick={onAdd}
        style={{
          padding: "10px 22px",
          borderRadius: 12,
          border: "none",
          background: "var(--cw-accent)",
          color: "#fff",
          fontSize: 15
        }}
      >
        添加项目
      </button>
    </div>
  );
}

function AddProjectModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }): JSX.Element {
  const [path, setPath] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(): Promise<void> {
    if (!path.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await codex.listThreads({ cwd: path.trim(), limit: 1 });
      const finalName = name.trim() || lastSegment(path.trim());
      addProject(path.trim(), finalName);
      onAdded();
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError((err as Error).message);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Backdrop onClose={onClose}>
      <div style={modalStyle}>
        <h2 style={{ margin: 0, fontSize: 18 }}>添加项目</h2>
        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ fontSize: 13, color: "var(--cw-fg-muted)" }}>工作区路径</span>
          <input
            value={path}
            onChange={(e) => setPath(e.target.value)}
            placeholder="C:/Users/xxx/workspace/proj"
            style={inputStyle}
            autoFocus
          />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ fontSize: 13, color: "var(--cw-fg-muted)" }}>别名（可选）</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="留空默认取目录名" style={inputStyle} />
        </label>
        {error ? <span style={{ color: "var(--cw-danger)", fontSize: 13 }}>{error}</span> : null}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button type="button" onClick={onClose} style={btnGhost}>
            取消
          </button>
          <button type="button" onClick={submit} disabled={!path.trim() || submitting} style={btnPrimary}>
            {submitting ? "校验中…" : "添加"}
          </button>
        </div>
      </div>
    </Backdrop>
  );
}

function ActionSheet({
  project,
  onClose,
  onRename,
  onRemove
}: {
  project: Project;
  onClose: () => void;
  onRename: () => void;
  onRemove: () => void;
}): JSX.Element {
  return (
    <Backdrop onClose={onClose} align="bottom">
      <div style={{ ...modalStyle, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}>
        <div style={{ fontSize: 13, color: "var(--cw-fg-muted)" }}>{project.name}</div>
        <button type="button" style={sheetItem} onClick={onRename}>
          重命名
        </button>
        <button type="button" style={{ ...sheetItem, color: "var(--cw-danger)" }} onClick={onRemove}>
          从列表移除
        </button>
        <button type="button" style={sheetItem} onClick={onClose}>
          取消
        </button>
      </div>
    </Backdrop>
  );
}

function RenameModal({
  project,
  onClose,
  onSubmit
}: {
  project: Project;
  onClose: () => void;
  onSubmit: (name: string) => void;
}): JSX.Element {
  const [name, setName] = useState(project.name);
  return (
    <Backdrop onClose={onClose}>
      <div style={modalStyle}>
        <h2 style={{ margin: 0, fontSize: 18 }}>重命名项目</h2>
        <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} autoFocus />
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button type="button" onClick={onClose} style={btnGhost}>
            取消
          </button>
          <button type="button" onClick={() => name.trim() && onSubmit(name.trim())} style={btnPrimary}>
            保存
          </button>
        </div>
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

const sheetItem: React.CSSProperties = {
  padding: "12px 8px",
  borderRadius: 10,
  border: "none",
  background: "transparent",
  color: "var(--cw-fg)",
  fontSize: 16,
  textAlign: "left"
};

function pressHandler(p: Project, set: (v: Project) => void) {
  return (event: React.PointerEvent) => {
    const timer = window.setTimeout(() => {
      set(p);
      event.preventDefault();
    }, 500);
    const cancel = () => window.clearTimeout(timer);
    event.currentTarget.addEventListener("pointerup", cancel, { once: true });
    event.currentTarget.addEventListener("pointermove", cancel, { once: true });
    event.currentTarget.addEventListener("pointercancel", cancel, { once: true });
  };
}

function lastSegment(p: string): string {
  const cleaned = p.replace(/[\\/]+$/, "");
  const parts = cleaned.split(/[\\/]/);
  return parts[parts.length - 1] || cleaned;
}

function formatRelativeShort(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return "刚刚";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`;
  return `${Math.floor(diff / 86_400_000)} 天前`;
}
