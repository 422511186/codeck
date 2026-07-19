"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Pencil, Plus, RotateCw, Trash2, X } from "lucide-react";
import { codex } from "../../../web/api/endpoints";
import { ApiError } from "../../../web/api/client";
import type {
  CustomModelCatalog,
  CustomModelConfig,
  CustomModelInput
} from "../../../shared/custom-models";

type FormState = {
  customModelId: string | null;
  model: string;
  label: string;
  contextWindow: string;
  imageEnabled: boolean;
  reasoningEfforts: string[];
  defaultReasoningEffort: string;
};

type FormErrors = Partial<Record<
  "model" | "label" | "contextWindow" | "supportedReasoningEfforts" | "defaultReasoningEffort",
  string
>>;

const EMPTY_FORM: FormState = {
  customModelId: null,
  model: "",
  label: "",
  contextWindow: "200000",
  imageEnabled: false,
  reasoningEfforts: [],
  defaultReasoningEffort: ""
};

export default function CustomModelsPage(): JSX.Element {
  const [catalog, setCatalog] = useState<CustomModelCatalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CustomModelConfig | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setCatalog(await codex.customModels());
    } catch (error) {
      setLoadError(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate(): void {
    setForm({ ...EMPTY_FORM, reasoningEfforts: [] });
    setFormErrors({});
    setFormError(null);
  }

  function openEdit(model: CustomModelConfig): void {
    setForm({
      customModelId: model.customModelId,
      model: model.model,
      label: model.label,
      contextWindow: String(model.contextWindow),
      imageEnabled: model.inputModalities.includes("image"),
      reasoningEfforts: [...model.supportedReasoningEfforts],
      defaultReasoningEffort: model.defaultReasoningEffort ?? ""
    });
    setFormErrors({});
    setFormError(null);
  }

  async function submitForm(): Promise<void> {
    if (!form || !catalog || saving) {
      return;
    }
    const validation = validateForm(form);
    setFormErrors(validation.errors);
    if (!validation.input) {
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const next = form.customModelId
        ? await codex.replaceCustomModel(form.customModelId, validation.input, catalog.revision)
        : await codex.createCustomModel(validation.input, catalog.revision);
      setCatalog(next);
      setForm(null);
    } catch (error) {
      applyMutationError(error, setCatalog, setFormErrors, setFormError);
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete(): Promise<void> {
    if (!deleteTarget || !catalog || deleting) {
      return;
    }
    setDeleting(true);
    try {
      setCatalog(await codex.deleteCustomModel(deleteTarget.customModelId, catalog.revision));
      setDeleteTarget(null);
    } catch (error) {
      applyMutationError(error, setCatalog, () => undefined, setLoadError);
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <main style={pageStyle}>
      <header style={headerStyle}>
        <Link href="/settings" aria-label="返回设置" style={iconLinkStyle}>
          <ChevronLeft size={22} />
        </Link>
        <h1 style={{ margin: 0, fontSize: 19, fontWeight: 650, flex: 1 }}>自定义模型</h1>
        <button type="button" aria-label="新增自定义模型" onClick={openCreate} style={iconButtonStyle}>
          <Plus size={20} />
        </button>
      </header>

      {loading ? (
        <Status text="正在读取目录" />
      ) : loadError ? (
        <Status text={loadError} danger>
          <button type="button" onClick={() => void load()} style={retryButtonStyle}>
            <RotateCw size={16} />
            重试
          </button>
        </Status>
      ) : catalog && catalog.models.length > 0 ? (
        <div style={listStyle}>
          {catalog.models.map((model) => (
            <div key={model.customModelId} style={rowStyle}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={modelLabelStyle}>{model.label}</div>
                <div style={modelIdStyle}>{model.model}</div>
                <div style={summaryStyle}>{capabilitySummary(model)}</div>
              </div>
              <button
                type="button"
                aria-label={`编辑 ${model.label}`}
                onClick={() => openEdit(model)}
                style={iconButtonStyle}
              >
                <Pencil size={17} />
              </button>
              <button
                type="button"
                aria-label={`删除 ${model.label}`}
                onClick={() => setDeleteTarget(model)}
                style={{ ...iconButtonStyle, color: "var(--cw-danger)" }}
              >
                <Trash2 size={17} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <Status text="还没有自定义模型">
          <button type="button" onClick={openCreate} style={primaryButtonStyle}>
            <Plus size={17} />
            新增模型
          </button>
        </Status>
      )}

      {form ? (
        <ModelForm
          form={form}
          errors={formErrors}
          error={formError}
          saving={saving}
          onChange={setForm}
          onClose={() => setForm(null)}
          onSubmit={() => void submitForm()}
        />
      ) : null}

      {deleteTarget ? (
        <div style={overlayStyle}>
          <section role="dialog" aria-modal="true" aria-label="确认删除自定义模型" style={confirmStyle}>
            <h2 style={{ margin: 0, fontSize: 17 }}>删除 {deleteTarget.label}？</h2>
            <p style={{ margin: 0, color: "var(--cw-fg-muted)", fontSize: 14, lineHeight: "20px" }}>
              将从共享目录删除 {deleteTarget.model}。已有会话绑定不受影响。
            </p>
            <div style={actionsStyle}>
              <button type="button" onClick={() => setDeleteTarget(null)} style={secondaryButtonStyle}>
                取消
              </button>
              <button
                type="button"
                onClick={() => void confirmDelete()}
                disabled={deleting}
                style={{ ...primaryButtonStyle, background: "var(--cw-danger)" }}
              >
                确认删除
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}

function ModelForm({
  form,
  errors,
  error,
  saving,
  onChange,
  onClose,
  onSubmit
}: {
  form: FormState;
  errors: FormErrors;
  error: string | null;
  saving: boolean;
  onChange: (form: FormState) => void;
  onClose: () => void;
  onSubmit: () => void;
}): JSX.Element {
  const title = form.customModelId ? "编辑自定义模型" : "新增自定义模型";
  return (
    <div style={formOverlayStyle}>
      <section role="dialog" aria-modal="true" aria-label={title} style={formStyle}>
        <header style={headerStyle}>
          <button type="button" aria-label="关闭" onClick={onClose} style={iconButtonStyle}>
            <X size={20} />
          </button>
          <h2 style={{ margin: 0, fontSize: 18, flex: 1 }}>{title}</h2>
          <button type="button" onClick={onSubmit} disabled={saving} style={saveButtonStyle}>
            保存
          </button>
        </header>
        <div style={fieldsStyle}>
          <Field label="显示名称" error={errors.label}>
            <input
              aria-label="显示名称"
              value={form.label}
              maxLength={100}
              onChange={(event) => onChange({ ...form, label: event.target.value })}
              style={inputStyle}
            />
          </Field>
          <Field label="模型标识" error={errors.model}>
            <input
              aria-label="模型标识"
              value={form.model}
              maxLength={256}
              onChange={(event) => onChange({ ...form, model: event.target.value })}
              style={inputStyle}
            />
          </Field>
          <Field label="上下文窗口" error={errors.contextWindow}>
            <input
              aria-label="上下文窗口"
              type="number"
              min={1}
              max={1_000_000}
              value={form.contextWindow}
              onChange={(event) => onChange({ ...form, contextWindow: event.target.value })}
              style={inputStyle}
            />
          </Field>
          <fieldset style={fieldsetStyle}>
            <legend style={legendStyle}>输入能力</legend>
            <label style={checkRowStyle}>
              <input aria-label="文本输入" type="checkbox" checked disabled />
              文本
            </label>
            <label style={checkRowStyle}>
              <input
                aria-label="图片输入"
                type="checkbox"
                checked={form.imageEnabled}
                onChange={(event) => onChange({ ...form, imageEnabled: event.target.checked })}
              />
              图片
            </label>
          </fieldset>
          <fieldset style={fieldsetStyle}>
            <legend style={legendStyle}>Reasoning 档位</legend>
            {form.reasoningEfforts.map((effort, index) => (
              <div key={index} style={{ display: "flex", gap: 8 }}>
                <input
                  aria-label={`Reasoning 档位 ${index + 1}`}
                  value={effort}
                  maxLength={64}
                  onChange={(event) => {
                    const reasoningEfforts = [...form.reasoningEfforts];
                    reasoningEfforts[index] = event.target.value;
                    onChange({ ...form, reasoningEfforts });
                  }}
                  style={{ ...inputStyle, flex: 1 }}
                />
                <button
                  type="button"
                  aria-label={`删除 reasoning 档位 ${index + 1}`}
                  onClick={() => {
                    const reasoningEfforts = form.reasoningEfforts.filter((_, itemIndex) => itemIndex !== index);
                    onChange({
                      ...form,
                      reasoningEfforts,
                      defaultReasoningEffort: reasoningEfforts.includes(form.defaultReasoningEffort)
                        ? form.defaultReasoningEffort
                        : ""
                    });
                  }}
                  style={iconButtonStyle}
                >
                  <Trash2 size={17} />
                </button>
              </div>
            ))}
            <button
              type="button"
              aria-label="新增 reasoning 档位"
              onClick={() => onChange({ ...form, reasoningEfforts: [...form.reasoningEfforts, ""] })}
              style={secondaryButtonStyle}
            >
              <Plus size={16} />
              新增档位
            </button>
            {errors.supportedReasoningEfforts ? <ErrorText text={errors.supportedReasoningEfforts} /> : null}
          </fieldset>
          <Field label="默认 reasoning" error={errors.defaultReasoningEffort}>
            <select
              aria-label="默认 reasoning"
              value={form.defaultReasoningEffort}
              disabled={form.reasoningEfforts.length === 0}
              onChange={(event) => onChange({ ...form, defaultReasoningEffort: event.target.value })}
              style={inputStyle}
            >
              <option value="">{form.reasoningEfforts.length ? "请选择" : "无"}</option>
              {form.reasoningEfforts.filter(Boolean).map((effort, index) => (
                <option key={`${effort}-${index}`} value={effort.trim()}>{effort.trim()}</option>
              ))}
            </select>
          </Field>
          {error ? <ErrorText text={error} /> : null}
        </div>
      </section>
    </div>
  );
}

function Field({
  label,
  error,
  children
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={legendStyle}>{label}</span>
      {children}
      {error ? <ErrorText text={error} /> : null}
    </label>
  );
}

function ErrorText({ text }: { text: string }): JSX.Element {
  return <span style={{ color: "var(--cw-danger)", fontSize: 13 }}>{text}</span>;
}

function Status({
  text,
  danger = false,
  children
}: {
  text: string;
  danger?: boolean;
  children?: React.ReactNode;
}): JSX.Element {
  return (
    <div style={statusStyle}>
      <span style={{ color: danger ? "var(--cw-danger)" : "var(--cw-fg-muted)", fontSize: 14 }}>{text}</span>
      {children}
    </div>
  );
}

function validateForm(form: FormState): { input: CustomModelInput | null; errors: FormErrors } {
  const errors: FormErrors = {};
  const model = form.model.trim();
  const label = form.label.trim();
  const contextWindow = Number(form.contextWindow);
  const reasoningEfforts = form.reasoningEfforts.map((effort) => effort.trim());
  if (!model) errors.model = "模型标识不能为空";
  if (!label) errors.label = "显示名称不能为空";
  if (!Number.isSafeInteger(contextWindow) || contextWindow < 1 || contextWindow > 1_000_000) {
    errors.contextWindow = "上下文窗口必须在 1 到 1,000,000 之间";
  }
  if (
    reasoningEfforts.some((effort) => !effort || effort.length > 64) ||
    new Set(reasoningEfforts).size !== reasoningEfforts.length ||
    reasoningEfforts.length > 16
  ) {
    errors.supportedReasoningEfforts = "Reasoning 档位必须非空、唯一，且最多 16 个";
  }
  const defaultReasoningEffort = reasoningEfforts.length === 0 ? null : form.defaultReasoningEffort.trim();
  if (reasoningEfforts.length > 0 && !reasoningEfforts.includes(defaultReasoningEffort ?? "")) {
    errors.defaultReasoningEffort = "请选择支持列表中的默认 reasoning";
  }
  return {
    input: Object.keys(errors).length > 0 ? null : {
      model,
      label,
      contextWindow,
      inputModalities: form.imageEnabled ? ["text", "image"] : ["text"],
      supportedReasoningEfforts: reasoningEfforts,
      defaultReasoningEffort
    },
    errors
  };
}

function applyMutationError(
  error: unknown,
  setCatalog: (catalog: CustomModelCatalog) => void,
  setErrors: (errors: FormErrors) => void,
  setError: (error: string) => void
): void {
  if (error instanceof ApiError && typeof error.body === "object" && error.body !== null) {
    const body = error.body as {
      code?: unknown;
      revision?: unknown;
      models?: unknown;
      issues?: unknown;
    };
    if (typeof body.revision === "number" && Array.isArray(body.models)) {
      setCatalog({ revision: body.revision, models: body.models as CustomModelConfig[] });
    }
    if (body.code === "CATALOG_REVISION_CONFLICT") {
      setError("目录已在其他设备更新，请检查后重试");
      return;
    }
    if (Array.isArray(body.issues)) {
      const errors = Object.fromEntries(
        body.issues.flatMap((issue) => {
          if (typeof issue !== "object" || issue === null) return [];
          const field = (issue as { field?: unknown }).field;
          const message = (issue as { message?: unknown }).message;
          return typeof field === "string" && typeof message === "string" ? [[field, message]] : [];
        })
      ) as FormErrors;
      setErrors(errors);
    }
  }
  setError(errorMessage(error));
}

function capabilitySummary(model: CustomModelConfig): string {
  const modalities = model.inputModalities.includes("image") ? "文本 · 图片" : "文本";
  const reasoning = model.supportedReasoningEfforts.length
    ? ` · reasoning ${model.supportedReasoningEfforts.length}`
    : "";
  return `${model.contextWindow.toLocaleString()} · ${modalities}${reasoning}`;
}

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : "操作失败";
}

const pageStyle: React.CSSProperties = {
  minHeight: "100dvh",
  padding: "0 var(--cw-space-4) calc(28px + var(--safe-bottom))"
};
const headerStyle: React.CSSProperties = {
  height: 56,
  display: "flex",
  alignItems: "center",
  gap: 8,
  borderBottom: "1px solid var(--cw-border)"
};
const iconButtonStyle: React.CSSProperties = {
  width: 40,
  height: 40,
  flex: "0 0 40px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  border: "none",
  background: "transparent",
  color: "var(--cw-fg)",
  padding: 0
};
const iconLinkStyle: React.CSSProperties = { ...iconButtonStyle, textDecoration: "none" };
const listStyle: React.CSSProperties = { borderBottom: "1px solid var(--cw-border)" };
const rowStyle: React.CSSProperties = {
  minHeight: 82,
  display: "flex",
  alignItems: "center",
  gap: 4,
  borderTop: "1px solid var(--cw-border)",
  padding: "10px 0"
};
const modelLabelStyle: React.CSSProperties = { fontSize: 15, fontWeight: 600, lineHeight: "20px" };
const modelIdStyle: React.CSSProperties = {
  fontSize: 13,
  lineHeight: "18px",
  color: "var(--cw-fg-muted)",
  overflowWrap: "anywhere"
};
const summaryStyle: React.CSSProperties = { fontSize: 12, color: "var(--cw-fg-subtle)", marginTop: 3 };
const statusStyle: React.CSSProperties = {
  minHeight: "60dvh",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 14
};
const overlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 80,
  display: "flex",
  alignItems: "flex-end",
  background: "rgba(0, 0, 0, 0.5)"
};
const formOverlayStyle: React.CSSProperties = { ...overlayStyle, alignItems: "stretch", background: "var(--cw-bg)" };
const formStyle: React.CSSProperties = { width: "100%", minHeight: "100dvh", overflowY: "auto" };
const fieldsStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 18,
  padding: "18px var(--cw-space-4) calc(36px + var(--safe-bottom))"
};
const inputStyle: React.CSSProperties = {
  width: "100%",
  minHeight: 42,
  boxSizing: "border-box",
  padding: "9px 10px",
  borderRadius: 6,
  border: "1px solid var(--cw-border)",
  background: "var(--cw-bg-elevated)",
  color: "var(--cw-fg)",
  fontSize: 15
};
const fieldsetStyle: React.CSSProperties = {
  border: 0,
  padding: 0,
  margin: 0,
  display: "flex",
  flexDirection: "column",
  gap: 8
};
const legendStyle: React.CSSProperties = { fontSize: 13, color: "var(--cw-fg-muted)", padding: 0 };
const checkRowStyle: React.CSSProperties = { display: "flex", alignItems: "center", gap: 8, minHeight: 32 };
const primaryButtonStyle: React.CSSProperties = {
  minHeight: 40,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  padding: "8px 14px",
  border: 0,
  borderRadius: 6,
  background: "var(--cw-accent)",
  color: "#fff"
};
const secondaryButtonStyle: React.CSSProperties = {
  ...primaryButtonStyle,
  border: "1px solid var(--cw-border)",
  background: "transparent",
  color: "var(--cw-fg)"
};
const retryButtonStyle: React.CSSProperties = { ...secondaryButtonStyle };
const saveButtonStyle: React.CSSProperties = { ...primaryButtonStyle, minHeight: 36 };
const actionsStyle: React.CSSProperties = { display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 };
const confirmStyle: React.CSSProperties = {
  width: "100%",
  padding: "18px var(--cw-space-4) calc(18px + var(--safe-bottom))",
  background: "var(--cw-card)",
  borderTop: "1px solid var(--cw-border)",
  display: "flex",
  flexDirection: "column",
  gap: 12
};
