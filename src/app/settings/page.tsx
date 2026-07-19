"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bot, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { codex, auth } from "../../web/api/endpoints";
import { resetTimelineEventStreamClient } from "../../web/events/client";
import {
  applyTheme,
  migrateLegacyDefaultModel,
  settingsStore,
  themeLabel,
  type ThemeMode
} from "../../web/storage/settings";
import type { ChatMode } from "../../web/api/types";
import { modelSelectionKey, type ModelSelection, type SelectableModel } from "../../shared/custom-models";

export default function SettingsPage(): JSX.Element {
  const router = useRouter();
  const [mode, setMode] = useState<ChatMode>("build");
  const [model, setModel] = useState<ModelSelection | null>(null);
  const [theme, setTheme] = useState<ThemeMode>("system");
  const [models, setModels] = useState<SelectableModel[]>([]);
  const [authStatus, setAuthStatus] = useState<{ authMethod: string | null; hasAuthToken: boolean } | null>(null);
  const [tokenUsage, setTokenUsage] = useState<{ lifetimeTokens: number | null; peakDailyTokens: number | null } | null>(null);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(true);
  const [usageLoading, setUsageLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [usageError, setUsageError] = useState<string | null>(null);

  useEffect(() => {
    const settings = settingsStore.load();
    setMode(settings.defaultMode);
    setModel(settings.defaultModel);
    setTheme(settings.theme);

    let cancelled = false;
    codex
      .modelCatalog()
      .then((catalog) => {
        if (!cancelled) {
          const migrated = migrateLegacyDefaultModel(catalog.models, catalog.appServerModelNames);
          setModels(catalog.models);
          setModel(migrated.defaultModel);
        }
      })
      .catch(() => {
        if (!cancelled) setModels([]);
      })
      .finally(() => {
        if (!cancelled) setModelsLoading(false);
      });

    codex
      .authStatus()
      .then((a) => {
        if (!cancelled) {
          setAuthStatus(a);
          setAuthError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) setAuthError(errorMessage(err, "无法读取账号状态"));
      })
      .finally(() => {
        if (!cancelled) setAuthLoading(false);
      });

    codex
      .tokenUsage()
      .then((t) => {
        if (!cancelled) {
          setTokenUsage(t.summary);
          setUsageError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) setUsageError(errorMessage(err, "无法读取用量统计"));
      })
      .finally(() => {
        if (!cancelled) setUsageLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  function updateMode(next: ChatMode): void {
    setMode(next);
    settingsStore.update({ defaultMode: next });
  }

  function updateModel(nextKey: string): void {
    const selected = models.find(
      (entry) => modelSelectionKey(selectionForModel(entry)) === nextKey
    );
    const next = selected ? selectionForModel(selected) : null;
    setModel(next);
    settingsStore.update({ defaultModel: next });
  }

  function updateTheme(next: ThemeMode): void {
    setTheme(next);
    settingsStore.update({ theme: next });
    applyTheme(next);
  }

  async function logout(): Promise<void> {
    try {
      await auth.logout();
    } catch {
      // 登出失败时也关闭本地已认证事件流，避免旧连接继续接收事件。
    } finally {
      resetTimelineEventStreamClient();
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
          {modelsLoading ? (
            <span style={{ color: "var(--cw-fg-muted)", fontSize: 14 }}>载入中…</span>
          ) : (
            <select
              value={model ? modelSelectionKey(model) : ""}
              onChange={(e) => updateModel(e.target.value)}
              style={selectStyle}
            >
              <option value="">（跟随后端默认）</option>
              {models.map((m) => (
                <option
                  key={modelSelectionKey(selectionForModel(m))}
                  value={modelSelectionKey(selectionForModel(m))}
                >
                  {m.label}
                </option>
              ))}
            </select>
          )}
        </Row>
      </Section>

      <Section title="自定义模型">
        <Link
          href="/settings/custom-models"
          aria-label="自定义模型"
          style={{
            minHeight: 48,
            display: "flex",
            alignItems: "center",
            gap: 10,
            color: "var(--cw-fg)",
            textDecoration: "none"
          }}
        >
          <Bot size={18} aria-hidden="true" />
          <span style={{ flex: 1, fontSize: 15 }}>自定义模型</span>
          <ChevronRight size={18} color="var(--cw-fg-muted)" aria-hidden="true" />
        </Link>
      </Section>

      <Section title="主题">
        <Row label="主题">
          <select value={theme} onChange={(e) => updateTheme(e.target.value as ThemeMode)} style={selectStyle}>
            <option value="system">{themeLabel("system")}</option>
            <option value="light">{themeLabel("light")}</option>
            <option value="dark">{themeLabel("dark")}</option>
          </select>
        </Row>
      </Section>

      <Section title="账号">
        {authLoading ? (
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
            <span style={{ color: "var(--cw-danger)", fontSize: 14 }}>
              账号暂不可用：{authError ?? "获取失败"}
            </span>
          </Row>
        )}
      </Section>

      <Section title="Token 用量">
        {usageLoading ? (
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
            <span style={{ color: "var(--cw-danger)", fontSize: 14 }}>
              用量暂不可用：{usageError ?? "获取失败"}
            </span>
          </Row>
        )}
      </Section>

      <Section title="登出 Web" framed={false}>
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

function selectionForModel(model: SelectableModel): ModelSelection {
  return model.source === "custom"
    ? { source: "custom", customModelId: model.customModelId }
    : { source: "app-server", model: model.model };
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function Section({
  title,
  children,
  framed = true
}: {
  title: string;
  children: React.ReactNode;
  framed?: boolean;
}): JSX.Element {
  return (
    <section style={{ marginTop: 24 }}>
      <h2 style={{ fontSize: 13, fontWeight: 600, color: "var(--cw-fg-muted)", margin: "0 0 8px" }}>{title}</h2>
      {framed ? (
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
      ) : (
        children
      )}
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
