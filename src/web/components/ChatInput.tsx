"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { codex } from "../api/endpoints";
import { ApiError } from "../api/client";
import { getDraft, setDraft } from "../storage/drafts";
import type { SkillOption, SkillReference } from "../api/types";

export type ChatInputProps = {
  threadId: string;
  cwd?: string;
  running: boolean;
  disabled?: boolean;
  draftOverride?: { text: string; version: number };
  onSend: (text: string, imagePaths: string[], skillReferences: SkillReference[]) => Promise<void>;
  onInterrupt: () => Promise<void>;
};

type ImageState = {
  file: File;
  previewUrl: string;
  serverPath?: string;
  status: "uploading" | "ready" | "failed";
};

export function ChatInput(props: ChatInputProps): JSX.Element {
  const [text, setText] = useState<string>(() => (typeof window === "undefined" ? "" : getDraft(props.threadId)));
  const [image, setImage] = useState<ImageState | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [skillPickerOpen, setSkillPickerOpen] = useState(false);
  const [skillOptions, setSkillOptions] = useState<SkillOption[]>([]);
  const [skillsLoading, setSkillsLoading] = useState(false);
  const [skillsError, setSkillsError] = useState<string | null>(null);
  const [selectedSkills, setSelectedSkills] = useState<SkillReference[]>([]);
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false);
  const loadedSkillKeyRef = useRef<string | null>(null);
  const skillLoadRef = useRef<{ key: string; promise: Promise<void> } | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setText(getDraft(props.threadId));
    setImage(null);
    setSelectedSkills([]);
    setSkillPickerOpen(false);
    setSkillOptions([]);
    setSkillsLoading(false);
    setSkillsError(null);
    loadedSkillKeyRef.current = null;
    skillLoadRef.current = null;
  }, [props.threadId]);

  useEffect(() => {
    const key = skillLoadKey(props.cwd);
    if (loadedSkillKeyRef.current && loadedSkillKeyRef.current !== key) {
      setSkillOptions([]);
      setSkillsError(null);
      loadedSkillKeyRef.current = null;
      skillLoadRef.current = null;
    }
  }, [props.cwd]);

  useEffect(() => {
    if (!props.draftOverride) {
      return;
    }
    setText(props.draftOverride.text);
  }, [props.draftOverride?.version]);

  useEffect(() => {
    setDraft(props.threadId, text);
  }, [props.threadId, text]);

  function pickImage(): void {
    fileInput.current?.click();
  }

  async function uploadImage(file: File): Promise<void> {
    const previewUrl = URL.createObjectURL(file);
    setImage({ file, previewUrl, status: "uploading" });
    try {
      const result = await codex.uploadImage(file);
      setImage({ file, previewUrl, status: "ready", serverPath: result.path });
    } catch {
      setImage({ file, previewUrl, status: "failed" });
    }
  }

  async function retryImage(): Promise<void> {
    if (!image) return;
    await uploadImage(image.file);
  }

  async function loadSkills(force = false): Promise<void> {
    const key = skillLoadKey(props.cwd);
    if (!force && loadedSkillKeyRef.current === key && !skillsError) {
      return;
    }

    const existing = skillLoadRef.current;
    if (existing?.key === key) {
      return existing.promise;
    }

    setSkillsLoading(true);
    setSkillsError(null);
    const entry: { key: string; promise: Promise<void> } = { key, promise: Promise.resolve() };
    const promise = codex.skills(true, props.cwd)
      .then((result) => {
        setSkillOptions(result.skills);
        loadedSkillKeyRef.current = key;
      })
      .catch((err) => {
        setSkillOptions([]);
        loadedSkillKeyRef.current = null;
        setSkillsError(err instanceof Error ? err.message : "无法读取 Skill");
      })
      .finally(() => {
        if (skillLoadRef.current === entry) {
          skillLoadRef.current = null;
          setSkillsLoading(false);
        }
      });
    entry.promise = promise;
    skillLoadRef.current = entry;
    return promise;
  }

  function openSkillPicker(): void {
    setSkillPickerOpen(true);
    void loadSkills();
  }

  async function send(value = text): Promise<void> {
    if (sendingRef.current || sending || props.running || props.disabled) return;
    const trimmed = value.trim();
    if (!trimmed) return;
    if (image && image.status !== "ready") return;
    sendingRef.current = true;
    setSending(true);
    try {
      const paths = image?.serverPath ? [image.serverPath] : [];
      await props.onSend(trimmed, paths, selectedSkills);
      setText("");
      setImage(null);
      setSelectedSkills([]);
      setDraft(props.threadId, "");
      setExpanded(false);
    } catch (err) {
      // surface left for caller via timeline (failed user msg); just keep input contents
      if (err instanceof ApiError) {
        console.warn("send failed", err.message);
      }
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  }

  const disabled = Boolean(props.disabled) || sending || props.running || image?.status === "uploading";
  const canSend = !disabled && text.trim().length > 0 && (!image || image.status === "ready");
  const sendButtonStyle = canSend ? sendBtnReady : sendBtnDisabled;
  const selectedSkillKeys = new Set(selectedSkills.map(skillKey));

  if (props.running) {
    return (
      <div style={barStyle}>
        <div style={runningRowStyle}>
          <div style={runningStatusStyle} role="status" aria-live="polite">
            <span style={pulseDotStyle} aria-hidden="true" />
            <span>正在生成…</span>
          </div>
          <button type="button" onClick={() => props.onInterrupt()} style={interruptBtn} aria-label="中断">
            <StopIcon />
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div style={barStyle}>
        {image ? <ImageThumb image={image} onRemove={() => setImage(null)} onRetry={retryImage} /> : null}
        {selectedSkills.length ? (
          <div style={skillChipRowStyle}>
            {selectedSkills.map((skill) => (
              <span key={skillKey(skill)} style={skillChipStyle}>
                <span style={skillChipLabelStyle}>{skill.name}</span>
                <button
                  type="button"
                  onClick={() => setSelectedSkills((items) => items.filter((item) => skillKey(item) !== skillKey(skill)))}
                  aria-label={`移除 Skill ${skill.name}`}
                  style={skillChipRemoveStyle}
                  disabled={disabled}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        ) : null}

        <div style={composerRowStyle}>
          <button type="button" onClick={pickImage} aria-label="添加图片" style={iconBtn} disabled={disabled}>
            <ImageIcon />
          </button>
          <button
            type="button"
            onClick={openSkillPicker}
            aria-label="引用 Skill"
            style={iconBtn}
            disabled={disabled}
          >
            <SkillIcon />
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) uploadImage(f);
              e.target.value = "";
            }}
          />
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="输入消息"
            rows={1}
            style={textareaStyle}
            disabled={disabled}
          />
          <button type="button" onClick={() => setExpanded(true)} aria-label="展开编辑" style={iconBtn} disabled={disabled}>
            <ExpandIcon />
          </button>
          <button
            type="button"
            onClick={() => send()}
            disabled={!canSend}
            style={sendButtonStyle}
            aria-label="发送"
          >
            <SendIcon />
          </button>
        </div>
      </div>

      {expanded ? (
        <HalfScreenEditor
          initial={text}
          onCancel={() => setExpanded(false)}
          onSubmit={async (value) => {
            setText(value);
            await send(value);
          }}
        />
      ) : null}

      {skillPickerOpen ? (
        <SkillPickerSheet
          skills={skillOptions}
          loading={skillsLoading}
          error={skillsError}
          selectedKeys={selectedSkillKeys}
          onClose={() => setSkillPickerOpen(false)}
          onRetry={() => void loadSkills(true)}
          onSelect={(skill) => {
            setSelectedSkills((items) =>
              items.some((item) => skillKey(item) === skillKey(skill))
                ? items.filter((item) => skillKey(item) !== skillKey(skill))
                : [...items, { name: skill.name, path: skill.path }]
            );
          }}
        />
      ) : null}
    </>
  );
}

function skillKey(skill: SkillReference): string {
  return `${skill.name}\u0001${skill.path}`;
}

function skillLoadKey(cwd?: string): string {
  const normalized = cwd?.trim();
  return normalized || "__default__";
}

function ImageThumb({
  image,
  onRemove,
  onRetry
}: {
  image: ImageState;
  onRemove: () => void;
  onRetry: () => void;
}): JSX.Element {
  return (
    <div style={{ position: "relative", width: 64, height: 64 }}>
      <img
        src={image.previewUrl}
        alt=""
        style={{
          width: 64,
          height: 64,
          objectFit: "cover",
          borderRadius: 8,
          border: image.status === "failed" ? "2px solid var(--cw-danger)" : "1px solid var(--cw-border)"
        }}
      />
      {image.status === "uploading" ? (
        <div style={overlay}>↻</div>
      ) : image.status === "failed" ? (
        <button onClick={onRetry} style={{ ...overlay, color: "var(--cw-danger)" }}>
          重试
        </button>
      ) : null}
      <button
        type="button"
        onClick={onRemove}
        aria-label="移除图片"
        style={{
          position: "absolute",
          top: -6,
          right: -6,
          width: 20,
          height: 20,
          borderRadius: 10,
          border: "none",
          background: "var(--cw-fg)",
          color: "var(--cw-bg)",
          fontSize: 12
        }}
      >
        ×
      </button>
    </div>
  );
}

function HalfScreenEditor({
  initial,
  onCancel,
  onSubmit
}: {
  initial: string;
  onCancel: () => void;
  onSubmit: (value: string) => void | Promise<void>;
}): JSX.Element {
  const [value, setValue] = useState(initial);
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        alignItems: "flex-end",
        background: "rgba(0,0,0,0.28)",
        zIndex: 100
      }}
      onClick={onCancel}
    >
      <section
        role="dialog"
        aria-label="半屏编辑器"
        style={halfScreenPanelStyle}
        onClick={(e) => {
          e.stopPropagation();
        }}
      >
        <header style={halfScreenHeaderStyle}>
          <button type="button" onClick={onCancel} style={ghostBtn}>
            取消
          </button>
          <button type="button" onClick={() => onSubmit(value)} disabled={!value.trim()} style={primaryBtn}>
            发送
          </button>
        </header>
        <textarea
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              // 允许换行（不发送）
              e.stopPropagation();
            }
          }}
          style={halfScreenTextareaStyle}
        />
      </section>
    </div>
  );
}

function SkillPickerSheet({
  skills,
  loading,
  error,
  selectedKeys,
  onClose,
  onRetry,
  onSelect
}: {
  skills: SkillOption[];
  loading: boolean;
  error: string | null;
  selectedKeys: Set<string>;
  onClose: () => void;
  onRetry: () => void;
  onSelect: (skill: SkillOption) => void;
}): JSX.Element {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return skills;
    return skills.filter((skill) =>
      [skill.name, skill.shortDescription, skill.description, skill.scope]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(needle))
    );
  }, [query, skills]);

  return (
    <div style={sheetBackdropStyle} onClick={onClose}>
      <section
        role="dialog"
        aria-label="选择 Skill"
        style={skillSheetPanelStyle}
        onClick={(e) => {
          e.stopPropagation();
        }}
      >
        <header style={skillSheetHeaderStyle}>
          <div style={{ minWidth: 0 }}>
            <div style={sheetTitleStyle}>Skill</div>
            <div style={sheetSubtitleStyle}>选择本次消息要引用的能力</div>
          </div>
          <button type="button" onClick={onClose} style={ghostBtn}>
            完成
          </button>
        </header>
        <div style={skillSearchWrapStyle}>
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索 Skill"
            style={skillSearchInputStyle}
          />
        </div>
        <div style={skillListStyle}>
          {loading ? (
            <div style={skillStateStyle}>载入中…</div>
          ) : error ? (
            <div style={skillStateStyle}>
              <div style={{ color: "var(--cw-danger)", marginBottom: 10 }}>{error}</div>
              <button type="button" onClick={onRetry} style={retryBtnStyle}>
                重试
              </button>
            </div>
          ) : filtered.length ? (
            filtered.map((skill) => {
              const selected = selectedKeys.has(skillKey(skill));
              return (
                <button
                  type="button"
                  key={skillKey(skill)}
                  onClick={() => onSelect(skill)}
                  style={selected ? skillRowSelectedStyle : skillRowStyle}
                >
                  <span style={skillRowMainStyle}>
                    <span style={skillNameStyle}>{skill.name}</span>
                    <span style={skillDescStyle}>{skill.shortDescription || skill.description || skill.scope}</span>
                  </span>
                  <span style={selected ? skillSelectedBadgeStyle : skillScopeStyle}>
                    {selected ? "已选" : skill.scope}
                  </span>
                </button>
              );
            })
          ) : (
            <div style={skillStateStyle}>没有匹配的 Skill</div>
          )}
        </div>
      </section>
    </div>
  );
}

const halfScreenPanelStyle: React.CSSProperties = {
  width: "100%",
  height: "50dvh",
  background: "var(--cw-bg)",
  borderTop: "1px solid var(--cw-border)",
  borderTopLeftRadius: 18,
  borderTopRightRadius: 18,
  boxShadow: "0 -14px 34px rgba(0,0,0,0.18)",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden"
};

const sheetBackdropStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  display: "flex",
  alignItems: "flex-end",
  background: "rgba(0,0,0,0.28)",
  zIndex: 110
};

const skillSheetPanelStyle: React.CSSProperties = {
  width: "100%",
  height: "58dvh",
  maxHeight: "70dvh",
  background: "var(--cw-bg)",
  borderTop: "1px solid var(--cw-border)",
  borderTopLeftRadius: 18,
  borderTopRightRadius: 18,
  boxShadow: "0 -14px 34px rgba(0,0,0,0.18)",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden"
};

const skillSheetHeaderStyle: React.CSSProperties = {
  minHeight: 58,
  padding: "10px 14px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  borderBottom: "1px solid var(--cw-border)"
};

const sheetTitleStyle: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 650,
  color: "var(--cw-fg)"
};

const sheetSubtitleStyle: React.CSSProperties = {
  marginTop: 2,
  fontSize: 12,
  color: "var(--cw-fg-muted)",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis"
};

const skillSearchWrapStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderBottom: "1px solid var(--cw-border)"
};

const skillSearchInputStyle: React.CSSProperties = {
  width: "100%",
  height: 38,
  padding: "0 12px",
  borderRadius: 10,
  border: "1px solid var(--cw-border)",
  background: "var(--cw-bg-elevated)",
  color: "var(--cw-fg)",
  outline: "none",
  fontSize: 15
};

const skillListStyle: React.CSSProperties = {
  flex: 1,
  overflowY: "auto",
  padding: "6px 10px calc(10px + var(--safe-bottom))"
};

const skillStateStyle: React.CSSProperties = {
  minHeight: 110,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  color: "var(--cw-fg-muted)",
  fontSize: 14,
  textAlign: "center"
};

const skillRowStyle: React.CSSProperties = {
  width: "100%",
  minHeight: 58,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  padding: "10px 8px",
  border: "none",
  borderBottom: "1px solid var(--cw-border)",
  background: "transparent",
  color: "var(--cw-fg)",
  textAlign: "left"
};

const skillRowSelectedStyle: React.CSSProperties = {
  ...skillRowStyle,
  background: "color-mix(in srgb, var(--cw-accent) 10%, transparent)"
};

const skillRowMainStyle: React.CSSProperties = {
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
  gap: 3
};

const skillNameStyle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 620,
  color: "var(--cw-fg)",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap"
};

const skillDescStyle: React.CSSProperties = {
  fontSize: 12,
  lineHeight: "16px",
  color: "var(--cw-fg-muted)",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap"
};

const skillScopeStyle: React.CSSProperties = {
  flex: "0 0 auto",
  fontSize: 12,
  color: "var(--cw-fg-muted)"
};

const skillSelectedBadgeStyle: React.CSSProperties = {
  ...skillScopeStyle,
  color: "var(--cw-accent)",
  fontWeight: 650
};

const retryBtnStyle: React.CSSProperties = {
  border: "1px solid var(--cw-border)",
  background: "var(--cw-bg-elevated)",
  color: "var(--cw-fg)",
  borderRadius: 10,
  padding: "7px 14px",
  fontSize: 14
};

const halfScreenHeaderStyle: React.CSSProperties = {
  height: 52,
  padding: "0 12px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  borderBottom: "1px solid var(--cw-border)"
};

const halfScreenTextareaStyle: React.CSSProperties = {
  flex: 1,
  width: "100%",
  padding: 14,
  background: "transparent",
  color: "var(--cw-fg)",
  border: "none",
  fontSize: 16,
  resize: "none",
  outline: "none"
};

const barStyle: React.CSSProperties = {
  position: "fixed",
  left: 0,
  right: 0,
  bottom: 0,
  padding: "8px 10px calc(10px + var(--safe-bottom))",
  background: "var(--cw-bg)",
  borderTop: "1px solid var(--cw-border)",
  display: "flex",
  flexDirection: "column",
  gap: 6,
  zIndex: 20,
  boxShadow: "0 -10px 26px rgba(0,0,0,0.08)"
};

const runningStatusStyle: React.CSSProperties = {
  minHeight: 40,
  display: "flex",
  alignItems: "center",
  gap: 10,
  paddingLeft: 12,
  color: "var(--cw-fg-muted)",
  fontSize: 14
};

const runningRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12
};

const pulseDotStyle: React.CSSProperties = {
  width: 8,
  height: 8,
  borderRadius: 4,
  background: "var(--cw-accent)",
  boxShadow: "0 0 0 4px color-mix(in srgb, var(--cw-accent) 16%, transparent)"
};

const iconBtn: React.CSSProperties = {
  width: 34,
  height: 34,
  flex: "0 0 34px",
  borderRadius: 17,
  border: "none",
  background: "transparent",
  color: "var(--cw-fg-muted)",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  touchAction: "manipulation"
};

const composerRowStyle: React.CSSProperties = {
  minHeight: 48,
  display: "flex",
  alignItems: "flex-end",
  gap: 6,
  padding: 5,
  borderRadius: 24,
  border: "1px solid var(--cw-border)",
  background: "var(--cw-bg-elevated)",
  boxShadow: "0 1px 0 rgba(255,255,255,0.05) inset"
};

const skillChipRowStyle: React.CSSProperties = {
  display: "flex",
  gap: 6,
  overflowX: "auto",
  padding: "0 2px 2px"
};

const skillChipStyle: React.CSSProperties = {
  height: 28,
  maxWidth: 180,
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  flex: "0 0 auto",
  padding: "0 6px 0 9px",
  borderRadius: 14,
  border: "1px solid color-mix(in srgb, var(--cw-accent) 40%, var(--cw-border))",
  background: "color-mix(in srgb, var(--cw-accent) 12%, var(--cw-bg-elevated))",
  color: "var(--cw-fg)",
  fontSize: 12
};

const skillChipLabelStyle: React.CSSProperties = {
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap"
};

const skillChipRemoveStyle: React.CSSProperties = {
  width: 20,
  height: 20,
  flex: "0 0 20px",
  borderRadius: 10,
  border: "none",
  background: "transparent",
  color: "var(--cw-fg-muted)",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 14,
  lineHeight: 1
};

const sendBtnBase: React.CSSProperties = {
  width: 38,
  height: 38,
  flex: "0 0 38px",
  borderRadius: 19,
  border: "none",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  touchAction: "manipulation",
  transition: "opacity 120ms ease, transform 120ms ease, box-shadow 120ms ease"
};

const sendBtnReady: React.CSSProperties = {
  ...sendBtnBase,
  background: "var(--cw-accent)",
  color: "var(--cw-accent-fg)",
  boxShadow: "0 8px 18px color-mix(in srgb, var(--cw-accent) 32%, transparent)"
};

const sendBtnDisabled: React.CSSProperties = {
  ...sendBtnBase,
  background: "color-mix(in srgb, var(--cw-fg-subtle) 18%, var(--cw-bg-elevated))",
  color: "var(--cw-fg-subtle)",
  opacity: 0.72,
  boxShadow: "none"
};

const interruptBtn: React.CSSProperties = {
  width: 40,
  height: 40,
  borderRadius: 20,
  border: "none",
  background: "var(--cw-danger)",
  color: "#fff",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center"
};

const textareaStyle: React.CSSProperties = {
  flex: 1,
  minHeight: 38,
  maxHeight: 96,
  padding: "9px 2px",
  border: "none",
  background: "transparent",
  color: "var(--cw-fg)",
  fontSize: 15,
  lineHeight: "20px",
  resize: "none",
  outline: "none"
};

const overlay: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  background: "rgba(0,0,0,0.35)",
  color: "#fff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 8,
  border: "none",
  fontSize: 13
};

const ghostBtn: React.CSSProperties = {
  background: "transparent",
  border: "none",
  color: "var(--cw-fg-muted)",
  fontSize: 15
};

const primaryBtn: React.CSSProperties = {
  background: "var(--cw-accent)",
  border: "none",
  color: "#fff",
  fontSize: 15,
  padding: "6px 14px",
  borderRadius: 10
};

function ImageIcon(): JSX.Element {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4" y="5" width="16" height="14" rx="3" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="9" cy="10" r="1.6" fill="currentColor" />
      <path d="M7 17l4.2-4.2 2.8 2.8 1.4-1.4L19 17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SkillIcon(): JSX.Element {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M8 5.5h8a2.5 2.5 0 0 1 2.5 2.5v8a2.5 2.5 0 0 1-2.5 2.5H8A2.5 2.5 0 0 1 5.5 16V8A2.5 2.5 0 0 1 8 5.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M9.3 12h5.4M12 9.3v5.4"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
      <path
        d="M4 9h2M4 15h2M18 9h2M18 15h2M9 4v2M15 4v2M9 18v2M15 18v2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.7"
      />
    </svg>
  );
}

function ExpandIcon(): JSX.Element {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 18h12" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" opacity="0.45" />
      <path
        d="M7.3 15.6l1.2-4 6.8-6.8a1.7 1.7 0 0 1 2.4 0l1.5 1.5a1.7 1.7 0 0 1 0 2.4l-6.8 6.8-4 1.2a.9.9 0 0 1-1.1-1.1Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M14.3 5.8l3.9 3.9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function SendIcon(): JSX.Element {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 19V6M6.5 11.5 12 6l5.5 5.5" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function StopIcon(): JSX.Element {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <rect x="7" y="7" width="10" height="10" rx="2" />
    </svg>
  );
}
