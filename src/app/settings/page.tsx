"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { codex, auth } from "../../../web/api/endpoints";
import { settingsStore } from "../../../web/storage/settings";
import type { ChatMode, ModelOption } from "../../../web/api/types";

export default function SettingsPage(): JSX.Element {
  const router = useRouter();
  const [mode, setMode] = useState<ChatMode>("build");
  const [model, setModel] = useState<string | null>(null);
  const [models, setModels] = useState<ModelOption[]>([]);
  const [authStatus, setAuthStatus] = useState<{ authMethod: string | null; hasAuthToken: boolean } | null>(null);
  const [tokenUsage, setTokenUsage] = useState<{ lifetimeTokens: number | null; peakDailyTokens: number | null } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const settings = settingsStore.load();
    setMode(settings.defaultMode);
    setModel(settings.defaultModel);

    let cancelled = false;
    (async () => {
      try {
        const [m, a, t] = await Promise.all([
          codex.models(),
          codex.authStatus(),
          codex.tokenUsage()
        ]);
        if (!cancelled) {
          setModels(m);
          setAuthStatus(a);
          setTokenUsage(t.summary);
          setLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function updateMode(next: ChatMode): void {
    setMode(next);
    settingsStore.update({ defaultMode: next });
  }

  function updateModel(next: string): void {
    setModel(next);
    settingsStore.update({ defaultModel: next });
  }

  async function logout(): Promise<void> {
    try {
      await auth.logout();
      router.replace("/login");
    } catch {
      router.replace("/login");
    }
  }

  return (
    <main style={{ padding: "var(--cw-space-4)", paddingBottom: 40 }}>
      <header style={{ display: "flex", alignItems: "center", gap: 10, padding: "var(--cw-space-2) 0" }}>
        <Link href="/projects" aria-label="返回" style={{ fontSize: 22, textDecoration: "none" }}>
          ‹
        </Link>
        <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>设置</h1>
      </header>

      <Section title="默认模型与模式">
        <Row label="默认模式">
          <select value={mode} onChange={(e) => updateMode(e.target.value as ChatMode)} style={selectStyle}>
            <option value="plan">Plan</option>
            <option value="build">Build</option>
          </select>
        </Row>
        <Row label="默认模型">
          {loading ? (
            <span style={{ color: "var(--cw-fg-muted)", fontSize: 14 }}>载入中…</span>
          ) : (
            <select value={model ?? ""} onChange={(e) => updateModel(e.target.value || null)} style={selectStyle}>
              <option value="">（跟随后端默认）</option>
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          )}
        </Row>
      </Section>

      <Section title="账号">
        {loading ? (
          <Row label="账号状态">
            <span style={{ color: "var(--cw-fg-muted)", fontSize: 14 }}>载入中…</span>
          </Row>
        ) : authStatus ? (
          <>
            <Row label="登录方式">
              <span style={{ color: "var(--cw-fg-muted)", fontSize: 14 }}>
                {authStatus.authMethod || "未登录"}
              </span>
            </Row>
            <Row label="Token 状态">
              <span style={{ color: "var(--cw-fg-muted)", fontSize: 14 }}>
                {authStatus.hasAuthToken ? "已配置" : "未配置"}
              </span>
            </Row>
          </>
        ) : (
          <Row label="账号状态">
            <span style={{ color: "var(--cw-danger)", fontSize: 14 }}>获取失败</span>
          </Row>
        )}
      </Section>

      <Section title="Token 用量">
        {loading ? (
          <Row label="用量统计">
            <span style={{ color: "var(--cw-fg-muted)", fontSize: 14 }}>载入中…</span>
          </Row>
        ) : tokenUsage ? (
          <>
            <Row label="总用量">
              <span style={{ color: "var(--cw-fg-muted)", fontSize: 14 }}>
                {tokenUsage.lifetimeTokens != null
                  ? `${(tokenUsage.lifetimeTokens / 1_000_000).toFixed(2)}M tokens`
                  : "—"}
              </span>
            </Row>
            <Row label="单日峰值">
              <span style={{ color: "var(--cw-fg-muted)", fontSize: 14 }}>
                {tokenUsage.peakDailyTokens != null
                  ? `${(tokenUsage.peakDailyTokens / 1_000_000).toFixed(2)}M tokens`
                  : "—"}
              </span>
            </Row>
          </>
        ) : (
          <Row label="用量统计">
            <span style={{ color: "var(--cw-danger)", fontSize: 14 }}>获取失败</span>
          </Row>
        )}
      </Section>

      <Section title="登出 Web">
        <button
          type="button"
          onClick={logout}
          style={{
            width: "100%",
            padding: "12px 16px",
            borderRadius: 12,
            border: "none",
            background: "var(--cw-danger)",
            color: "#fff",
            fontSize: 15
          }}
        >
          登出
        </button>
      </Section>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }): JSX.Element {
  return (
    <section style={{ marginTop: 24 }}>
      <h2 style={{ fontSize: 13, fontWeight: 600, color: "var(--cw-fg-muted)", margin: "0 0 8px" }}>{title}</h2>
      <div
        style={{
          background: "var(--cw-card)",
          border: "1px solid var(--cw-border)",
          borderRadius: 14,
          padding: "0 14px",
          display: "flex",
          flexDirection: "column"
        }}
      >
        {children}
      </div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }): JSX.Element {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "12px 0",
        borderBottom: "1px solid var(--cw-border)"
      }}
    >
      <span style={{ fontSize: 15, color: "var(--cw-fg)" }}>{label}</span>
      <div>{children}</div>
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  padding: "6px 10px",
  borderRadius: 8,
  border: "1px solid var(--cw-border)",
  background: "var(--cw-bg-elevated)",
  color: "var(--cw-fg)",
  fontSize: 14
};
