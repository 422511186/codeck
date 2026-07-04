"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { codex } from "../api/endpoints";
import { ApiError } from "../api/client";
import { getDraft, setDraft } from "../storage/drafts";
import type { SkillOption, SkillReference } from "../api/types";
import { useStore } from "../state/store";

export type ChatInputProps = {
  threadId: string;
  cwd?: string;
  running: boolean;
  disabled?: boolean;
  draftOverride?: { text: string; version: number };
  permissionLabel?: string;
  permissionDescription?: string;
  modelLabel?: string;
  reasoningEffortLabel?: string;
  onOpenPermissionPicker?: () => void;
  onOpenModelPicker?: () => void;
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
  const [addPanelOpen, setAddPanelOpen] = useState(false);
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
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const skillsCacheVersion = useStore((s) => s.skillsCacheVersion);

  useEffect(() => {
    setText(getDraft(props.threadId));
    setImage(null);
    setAddPanelOpen(false);
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
    setSkillOptions([]);
    setSkillsError(null);
    loadedSkillKeyRef.current = null;
    skillLoadRef.current = null;
  }, [skillsCacheVersion]);

  useEffect(() => {
    setDraft(props.threadId, text);
  }, [props.threadId, text]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight || 38, 220)}px`;
  }, [text]);

  function pickImage(): void {
    setAddPanelOpen(false);
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
    setAddPanelOpen(false);
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
      setAddPanelOpen(false);
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
        {addPanelOpen ? (
          <>
            <div aria-hidden="true" style={addPanelScrimStyle} onClick={() => setAddPanelOpen(false)} />
            <AddPanel onPickImage={pickImage} onOpenSkillPicker={openSkillPicker} />
          </>
        ) : null}

        <div style={composerCardStyle}>
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="输入消息"
            rows={1}
            style={textareaStyle}
            disabled={disabled}
          />

          {image || selectedSkills.length ? (
            <div aria-label="已选上下文" style={selectedContextStyle}>
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
            </div>
          ) : null}

          <div style={composerToolbarStyle}>
            <button
              type="button"
              onClick={() => setAddPanelOpen((open) => !open)}
              aria-label="添加内容"
              style={addBtnStyle}
              disabled={disabled}
            >
              +
            </button>
            <div style={statusChipRowStyle}>
              {props.permissionLabel && props.onOpenPermissionPicker ? (
                <button
                  type="button"
                  onClick={props.onOpenPermissionPicker}
                  aria-label={`权限 ${props.permissionLabel}`}
                  title={props.permissionDescription}
                  style={stateChipStyle}
                  disabled={disabled}
                >
                  {props.permissionLabel}
                </button>
              ) : null}
              {props.modelLabel && props.onOpenModelPicker ? (
                <button
                  type="button"
                  onClick={props.onOpenModelPicker}
                  aria-label={`模型 ${modelChipText(props.modelLabel, props.reasoningEffortLabel)}`}
                  style={stateChipStyle}
                  disabled={disabled}
                >
                  {modelChipText(props.modelLabel, props.reasoningEffortLabel)}
                </button>
              ) : null}
            </div>
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
        </div>
      </div>

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

function modelChipText(modelLabel: string, effortLabel?: string): string {
  return effortLabel ? `${modelLabel} ${effortLabel}` : modelLabel;
}

function AddPanel({
  onPickImage,
  onOpenSkillPicker
}: {
  onPickImage: () => void;
  onOpenSkillPicker: () => void;
}): JSX.Element {
  return (
    <section role="dialog" aria-label="添加内容" style={addPanelStyle}>
      <button type="button" onClick={onPickImage} style={addPanelItemStyle}>
        <span style={addPanelIconStyle}><ImageIcon /></span>
        <span style={addPanelTextStyle}>图片</span>
      </button>
      <button type="button" onClick={onOpenSkillPicker} style={addPanelItemStyle}>
        <span style={addPanelIconStyle}><SkillIcon /></span>
        <span style={addPanelTextStyle}>引用 Skill</span>
      </button>
      {["文件", "目标", "插件"].map((label) => (
        <button key={label} type="button" style={addPanelItemDisabledStyle} disabled>
          <span style={addPanelIconStyle}>＋</span>
          <span style={addPanelTextStyle}>{label}</span>
        </button>
      ))}
    </section>
  );
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

const addPanelScrimStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 18,
  background: "transparent"
};

const addPanelStyle: React.CSSProperties = {
  position: "absolute",
  left: 10,
  right: 10,
  bottom: "calc(100% - 2px)",
  zIndex: 22,
  maxHeight: "50dvh",
  overflowY: "auto",
  padding: 8,
  borderRadius: 14,
  border: "1px solid var(--cw-border)",
  background: "var(--cw-card)",
  boxShadow: "0 -12px 34px rgba(0,0,0,0.18)",
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 8
};

const addPanelItemStyle: React.CSSProperties = {
  minHeight: 58,
  border: "1px solid var(--cw-border)",
  borderRadius: 10,
  background: "var(--cw-bg-elevated)",
  color: "var(--cw-fg)",
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "10px 12px",
  textAlign: "left",
  fontSize: 14
};

const addPanelItemDisabledStyle: React.CSSProperties = {
  ...addPanelItemStyle,
  opacity: 0.45
};

const addPanelIconStyle: React.CSSProperties = {
  width: 26,
  height: 26,
  flex: "0 0 26px",
  borderRadius: 8,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  color: "var(--cw-accent)",
  background: "color-mix(in srgb, var(--cw-accent) 12%, transparent)"
};

const addPanelTextStyle: React.CSSProperties = {
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap"
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

const composerCardStyle: React.CSSProperties = {
  position: "relative",
  display: "flex",
  flexDirection: "column",
  gap: 8,
  padding: 8,
  borderRadius: 16,
  border: "1px solid var(--cw-border)",
  background: "var(--cw-bg-elevated)",
  boxShadow: "0 1px 0 rgba(255,255,255,0.05) inset"
};

const composerToolbarStyle: React.CSSProperties = {
  minHeight: 38,
  display: "flex",
  alignItems: "center",
  gap: 8
};

const addBtnStyle: React.CSSProperties = {
  width: 36,
  height: 36,
  flex: "0 0 36px",
  borderRadius: 18,
  border: "none",
  background: "var(--cw-card)",
  color: "var(--cw-fg)",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  touchAction: "manipulation",
  fontSize: 24,
  lineHeight: 1
};

const statusChipRowStyle: React.CSSProperties = {
  minWidth: 0,
  flex: 1,
  display: "flex",
  alignItems: "center",
  gap: 6,
  overflowX: "auto"
};

const stateChipStyle: React.CSSProperties = {
  maxWidth: 156,
  height: 32,
  flex: "0 1 auto",
  minWidth: 0,
  padding: "0 10px",
  borderRadius: 16,
  border: "1px solid var(--cw-border)",
  background: "var(--cw-card)",
  color: "var(--cw-fg)",
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  fontSize: 13,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis"
};

const selectedContextStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  overflowX: "auto",
  padding: "0 2px"
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
  width: "100%",
  minHeight: 44,
  maxHeight: "min(220px, 35dvh)",
  padding: "8px 4px",
  border: "none",
  background: "transparent",
  color: "var(--cw-fg)",
  fontSize: 15,
  lineHeight: "21px",
  resize: "none",
  outline: "none",
  overflowY: "auto"
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
