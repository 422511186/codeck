"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Check, Search, Settings2, X } from "lucide-react";
import { codex } from "../api/endpoints";
import type {
  ModelSelection,
  SelectableModel,
  ThreadModelStateView,
  UnifiedModelCatalog
} from "../../shared/custom-models";
import { modelSelectionsEqual } from "../../shared/custom-models";

type UnifiedModelPickerProps = {
  current: ThreadModelStateView;
  onSelect: (selection: ModelSelection, catalogRevision: number) => void | Promise<void>;
  onReapply: (catalogRevision: number) => void | Promise<void>;
  onClose: () => void;
  loadCatalog?: () => Promise<UnifiedModelCatalog>;
};

export function UnifiedModelPicker({
  current,
  onSelect,
  onReapply,
  onClose,
  loadCatalog
}: UnifiedModelPickerProps): JSX.Element {
  const [catalog, setCatalog] = useState<UnifiedModelCatalog | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const loadCatalogRef = useRef(loadCatalog);

  useEffect(() => {
    loadCatalogRef.current = loadCatalog;
  }, [loadCatalog]);

  const load = useCallback(async () => {
    setCatalog(null);
    setError(null);
    try {
      const loader = loadCatalogRef.current;
      setCatalog(await (loader ? loader() : codex.modelCatalog()));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "无法读取模型目录");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const representedCurrent = catalog?.models.find((model) =>
    modelSelectionsEqual(selectionFor(model), current.selection)
  ) ?? null;
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const matches = (model: Pick<SelectableModel, "label" | "model">): boolean =>
    !normalizedQuery || `${model.label}\n${model.model}`.toLocaleLowerCase().includes(normalizedQuery);
  const customModels = useMemo(
    () => catalog?.models.filter(
      (model): model is Extract<SelectableModel, { source: "custom" }> =>
        model.source === "custom" && matches(model)
    ) ?? [],
    [catalog, normalizedQuery]
  );
  const appServerModels = useMemo(
    () => catalog?.models.filter(
      (model): model is Extract<SelectableModel, { source: "app-server" }> =>
        model.source === "app-server" && matches(model)
    ) ?? [],
    [catalog, normalizedQuery]
  );
  const showTemporaryCurrent = Boolean(!representedCurrent && matches(current));
  const currentCustomModelId = current.selection.source === "custom"
    ? current.selection.customModelId
    : null;
  const updatedCustom = currentCustomModelId
    ? catalog?.models.find(
        (model) => model.source === "custom" && model.customModelId === currentCustomModelId
      ) ?? null
    : null;
  const hasConfigurationUpdate = Boolean(
    updatedCustom?.source === "custom" &&
      current.sourceUpdatedAt &&
      updatedCustom.updatedAt !== current.sourceUpdatedAt
  );

  async function run(action: () => void | Promise<void>): Promise<void> {
    if (pending) return;
    setPending(true);
    try {
      await action();
    } finally {
      setPending(false);
    }
  }

  return (
    <div style={overlayStyle} role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section role="dialog" aria-label="选择模型" aria-modal="true" style={sheetStyle}>
        <header style={headerStyle}>
          <div style={{ fontSize: 17, fontWeight: 650 }}>选择模型</div>
          <div style={headerActionsStyle}>
            <Link href="/settings/custom-models" aria-label="管理自定义模型" style={iconLinkStyle}>
              <Settings2 size={19} />
            </Link>
            <button type="button" aria-label="关闭模型选择器" onClick={onClose} style={iconButtonStyle}>
              <X size={20} />
            </button>
          </div>
        </header>

        <label style={searchStyle}>
          <Search size={17} aria-hidden="true" />
          <input
            type="search"
            aria-label="搜索模型"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索名称或模型标识"
            style={searchInputStyle}
          />
        </label>

        <div style={contentStyle}>
          {error ? (
            <div role="alert" style={statusStyle}>
              <span>{error}</span>
              <button type="button" onClick={() => void load()} style={textButtonStyle}>重试</button>
            </div>
          ) : catalog === null ? (
            <div style={statusStyle}>正在刷新模型目录</div>
          ) : (
            <>
              {showTemporaryCurrent ? (
                <ModelGroup title="当前会话" testId="current-thread-models">
                  <CurrentTemporaryModel current={current} />
                </ModelGroup>
              ) : null}

              {customModels.length > 0 ? (
                <ModelGroup title="自定义" testId="custom-models">
                  {customModels.map((model) => (
                    <ModelRow
                      key={model.customModelId}
                      model={model}
                      current={current}
                      pending={pending}
                      onSelect={() => void run(() => onSelect(selectionFor(model), catalog.catalogRevision))}
                    >
                      {modelSelectionsEqual(selectionFor(model), current.selection) && hasConfigurationUpdate ? (
                        <div style={updatedStyle}>
                          <span>配置有更新</span>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              void run(() => onReapply(catalog.catalogRevision));
                            }}
                            disabled={pending}
                            style={textButtonStyle}
                          >
                            重新应用
                          </button>
                        </div>
                      ) : null}
                    </ModelRow>
                  ))}
                </ModelGroup>
              ) : null}

              {appServerModels.length > 0 ? (
                <ModelGroup title="Codex" testId="codex-models">
                  {appServerModels.map((model) => (
                    <ModelRow
                      key={model.model}
                      model={model}
                      current={current}
                      pending={pending}
                      onSelect={() => void run(() => onSelect(selectionFor(model), catalog.catalogRevision))}
                    />
                  ))}
                </ModelGroup>
              ) : null}

              {!showTemporaryCurrent && customModels.length === 0 && appServerModels.length === 0 ? (
                <div style={statusStyle}>没有匹配的模型</div>
              ) : null}
            </>
          )}
        </div>
      </section>
    </div>
  );
}

function ModelGroup({
  title,
  testId,
  children
}: {
  title: string;
  testId: string;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <section data-testid={testId} style={groupStyle}>
      <h2 style={groupTitleStyle}>{title}</h2>
      <div style={groupRowsStyle}>{children}</div>
    </section>
  );
}

function CurrentTemporaryModel({ current }: { current: ThreadModelStateView }): JSX.Element {
  return (
    <div aria-label={`${current.label} ${current.model} 当前会话`} style={modelRowStyle}>
      <ModelIdentity label={current.label} model={current.model} />
      <span style={temporaryStyle}>仅当前会话</span>
    </div>
  );
}

function ModelRow({
  model,
  current,
  pending,
  onSelect,
  children
}: {
  model: SelectableModel;
  current: ThreadModelStateView;
  pending: boolean;
  onSelect: () => void;
  children?: React.ReactNode;
}): JSX.Element {
  const active = modelSelectionsEqual(selectionFor(model), current.selection);
  return (
    <div style={modelItemStyle}>
      <button
        type="button"
        aria-label={`${model.label} ${model.model}`}
        aria-current={active ? "true" : undefined}
        disabled={pending || active}
        onClick={onSelect}
        style={modelRowButtonStyle}
      >
        <ModelIdentity label={model.label} model={model.model} />
        <span style={modelMetaStyle}>
          {model.isDefault ? "默认" : model.contextWindow ? formatContextWindow(model.contextWindow) : ""}
        </span>
        {active ? <Check size={18} color="var(--cw-accent)" aria-hidden="true" /> : null}
      </button>
      {children}
    </div>
  );
}

function ModelIdentity({ label, model }: { label: string; model: string }): JSX.Element {
  return (
    <span style={{ minWidth: 0, flex: 1 }}>
      <span style={modelLabelStyle}>{label}</span>
      <span style={modelIdStyle}>{model}</span>
    </span>
  );
}

function selectionFor(model: SelectableModel): ModelSelection {
  return model.source === "custom"
    ? { source: "custom", customModelId: model.customModelId }
    : { source: "app-server", model: model.model };
}

function formatContextWindow(value: number): string {
  return value >= 1_000_000 ? `${value / 1_000_000}M` : `${Math.round(value / 1_000)}k`;
}

const overlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 100,
  display: "flex",
  alignItems: "flex-end",
  justifyContent: "center",
  background: "rgba(0, 0, 0, 0.46)"
};

const sheetStyle: React.CSSProperties = {
  width: "100%",
  maxHeight: "88dvh",
  display: "flex",
  flexDirection: "column",
  background: "var(--cw-bg)",
  border: "1px solid var(--cw-border)",
  borderBottom: "none",
  borderRadius: "16px 16px 0 0",
  paddingBottom: "var(--safe-bottom)"
};

const headerStyle: React.CSSProperties = {
  minHeight: 52,
  padding: "8px 12px 6px 16px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between"
};

const headerActionsStyle: React.CSSProperties = { display: "flex", alignItems: "center", gap: 4 };
const iconButtonStyle: React.CSSProperties = { width: 40, height: 40, border: "none", background: "transparent", color: "var(--cw-fg)", display: "grid", placeItems: "center" };
const iconLinkStyle: React.CSSProperties = { ...iconButtonStyle, textDecoration: "none" };
const searchStyle: React.CSSProperties = { margin: "0 12px 8px", height: 42, padding: "0 12px", display: "flex", alignItems: "center", gap: 8, border: "1px solid var(--cw-border)", borderRadius: 8, background: "var(--cw-bg-elevated)", color: "var(--cw-fg-muted)" };
const searchInputStyle: React.CSSProperties = { minWidth: 0, flex: 1, border: "none", outline: "none", background: "transparent", color: "var(--cw-fg)", fontSize: 15 };
const contentStyle: React.CSSProperties = { minHeight: 120, overflowY: "auto", padding: "0 12px 16px" };
const groupStyle: React.CSSProperties = { marginTop: 8 };
const groupTitleStyle: React.CSSProperties = { margin: 0, padding: "8px 4px 6px", fontSize: 12, fontWeight: 600, color: "var(--cw-fg-muted)" };
const groupRowsStyle: React.CSSProperties = { borderTop: "1px solid var(--cw-border)" };
const modelItemStyle: React.CSSProperties = { borderBottom: "1px solid var(--cw-border)" };
const modelRowStyle: React.CSSProperties = { minHeight: 58, display: "flex", alignItems: "center", gap: 10, padding: "9px 4px" };
const modelRowButtonStyle: React.CSSProperties = { ...modelRowStyle, width: "100%", border: "none", background: "transparent", color: "var(--cw-fg)", textAlign: "left" };
const modelLabelStyle: React.CSSProperties = { display: "block", fontSize: 15, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
const modelIdStyle: React.CSSProperties = { display: "block", marginTop: 3, fontSize: 12, color: "var(--cw-fg-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
const modelMetaStyle: React.CSSProperties = { flex: "0 0 auto", fontSize: 12, color: "var(--cw-fg-subtle)" };
const temporaryStyle: React.CSSProperties = { flex: "0 0 auto", fontSize: 12, color: "var(--cw-fg-muted)" };
const updatedStyle: React.CSSProperties = { margin: "0 4px 8px", minHeight: 34, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, color: "var(--cw-warning, #d38a22)", fontSize: 13 };
const textButtonStyle: React.CSSProperties = { minHeight: 32, padding: "4px 10px", border: "1px solid var(--cw-border)", borderRadius: 8, background: "transparent", color: "var(--cw-accent)", fontSize: 13 };
const statusStyle: React.CSSProperties = { minHeight: 100, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 10, color: "var(--cw-fg-muted)", fontSize: 14 };
