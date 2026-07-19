"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import { codex } from "../api/endpoints";
import { ApiError } from "../api/client";
import { getDraft, setDraft } from "../storage/drafts";
import type { SkillOption, SkillReference, ThreadGoal } from "../api/types";
import { useStore } from "../state/store";

export type ChatInputProps = {
  threadId: string;
  cwd?: string;
  running: boolean;
  disabled?: boolean;
  imageInputSupported?: boolean;
  sendBlockedReason?: string;
  draftOverride?: { text: string; version: number };
  permissionLabel?: string;
  permissionDescription?: string;
  permissionPending?: boolean;
  modelLabel?: string;
  reasoningEffortLabel?: string;
  goal?: ThreadGoal | null;
  onOpenPermissionPicker?: () => void;
  onOpenModelPicker?: () => void;
  onOpenReasoningPicker?: () => void;
  onOpenGoalEditor?: () => void;
  onHeightChange?: (height: number) => void;
  onSend: (text: string, imagePaths: string[], skillReferences: SkillReference[]) => Promise<void>;
  onInterrupt: () => Promise<void>;
};

type ImageState = {
  id: string;
  file: File;
  previewUrl: string;
  serverPath?: string;
  status: "uploading" | "ready" | "failed";
};

type ChatInputDiagnostics = {
  mounts: number;
};

const chatInputDiagnostics: ChatInputDiagnostics = {
  mounts: 0
};

export function __getChatInputDiagnostics(): ChatInputDiagnostics {
  return { ...chatInputDiagnostics };
}

export function __resetChatInputDiagnostics(): void {
  chatInputDiagnostics.mounts = 0;
}

function ChatInputImpl(props: ChatInputProps): JSX.Element {
  const [text, setText] = useState<string>(() => (typeof window === "undefined" ? "" : getDraft(props.threadId)));
  const [images, setImages] = useState<ImageState[]>([]);
  const [addPanelOpen, setAddPanelOpen] = useState(false);
  const [skillPickerOpen, setSkillPickerOpen] = useState(false);
  const [skillOptions, setSkillOptions] = useState<SkillOption[]>([]);
  const [skillsLoading, setSkillsLoading] = useState(false);
  const [skillsError, setSkillsError] = useState<string | null>(null);
  const [selectedSkills, setSelectedSkills] = useState<SkillReference[]>([]);
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false);
  const nextImageIdRef = useRef(0);
  const loadedSkillKeyRef = useRef<string | null>(null);
  const skillLoadRef = useRef<{ key: string; promise: Promise<void> } | null>(null);
  const barRef = useRef<HTMLDivElement | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const skillsCacheVersion = useStore((s) => s.skillsCacheVersion);

  useEffect(() => {
    chatInputDiagnostics.mounts += 1;
  }, []);

  useEffect(() => {
    setText(getDraft(props.threadId));
    setImages([]);
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

  useEffect(() => {
    const bar = barRef.current;
    if (!bar || !props.onHeightChange) return;

    let lastHeight = -1;
    const report = (height: number): void => {
      const rounded = Math.ceil(height);
      if (rounded <= 0 || rounded === lastHeight) return;
      lastHeight = rounded;
      props.onHeightChange?.(rounded);
    };

    report(bar.getBoundingClientRect().height || bar.offsetHeight);
    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      report(entries[0]?.contentRect.height ?? bar.getBoundingClientRect().height);
    });
    observer.observe(bar);
    return () => observer.disconnect();
  }, [props.onHeightChange]);

  function pickImage(): void {
    setAddPanelOpen(false);
    fileInput.current?.click();
  }

  function addImage(file: File): void {
    const id = `image-${Date.now()}-${nextImageIdRef.current++}`;
    const previewUrl = URL.createObjectURL(file);
    setImages((items) => [...items, { id, file, previewUrl, status: "uploading" }]);
    void uploadImage(id, file);
  }

  async function uploadImage(id: string, file: File): Promise<void> {
    setImages((items) =>
      items.map((image) => (image.id === id ? { ...image, status: "uploading", serverPath: undefined } : image))
    );
    try {
      const result = await codex.uploadImage(file);
      setImages((items) =>
        items.map((image) => (image.id === id ? { ...image, status: "ready", serverPath: result.path } : image))
      );
    } catch {
      setImages((items) => items.map((image) => (image.id === id ? { ...image, status: "failed" } : image)));
    }
  }

  function removeImage(id: string): void {
    setImages((items) => items.filter((image) => image.id !== id));
  }

  async function retryImage(image: ImageState): Promise<void> {
    await uploadImage(image.id, image.file);
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

  function openGoalEditor(): void {
    if (!props.onOpenGoalEditor) return;
    setAddPanelOpen(false);
    props.onOpenGoalEditor();
  }

  async function send(value = text): Promise<void> {
    if (sendingRef.current || sending || props.running || props.disabled) return;
    const trimmed = value.trim();
    if (!trimmed) return;
    if (images.some((image) => image.status !== "ready" || !image.serverPath)) return;
    sendingRef.current = true;
    setSending(true);
    try {
      const paths = images.map((image) => image.serverPath).filter((path): path is string => Boolean(path));
      await props.onSend(trimmed, paths, selectedSkills);
      setText("");
      setImages([]);
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

  const hasPendingImages = images.some((image) => image.status !== "ready");
  const imageCompatibilityError = images.length > 0 && props.imageInputSupported === false
    ? "当前模型不支持图片，请移除草稿图片或切换模型"
    : null;
  const sendBlockedReason = props.sendBlockedReason ?? imageCompatibilityError;
  const disabled = Boolean(props.disabled) || sending || images.some((image) => image.status === "uploading");
  const canSend = !disabled && !props.running && !sendBlockedReason && text.trim().length > 0 && !hasPendingImages;
  const sendButtonStyle = canSend ? sendBtnReady : sendBtnDisabled;
  const selectedSkillKeys = new Set(selectedSkills.map(skillKey));

  return (
    <>
      <div ref={barRef} style={barStyle}>
        {addPanelOpen ? (
          <>
            <div aria-hidden="true" style={addPanelScrimStyle} onClick={() => setAddPanelOpen(false)} />
            <AddPanel
              selectedSkillCount={selectedSkills.length}
              hasGoal={Boolean(props.goal)}
              showGoal={Boolean(props.onOpenGoalEditor)}
              onClose={() => setAddPanelOpen(false)}
              onPickImage={pickImage}
              onOpenSkillPicker={openSkillPicker}
              onOpenGoalEditor={openGoalEditor}
            />
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

          {images.length || selectedSkills.length ? (
            <div aria-label="已选上下文" style={selectedContextStyle}>
              {images.map((image) => (
                <ImageThumb
                  key={image.id}
                  image={image}
                  onRemove={() => removeImage(image.id)}
                  onRetry={() => void retryImage(image)}
                />
              ))}
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

          {sendBlockedReason ? (
            <div role="status" style={compatibilityErrorStyle}>{sendBlockedReason}</div>
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
                  style={props.permissionPending ? pendingStateChipStyle : stateChipStyle}
                  disabled={disabled}
                >
                  {props.permissionLabel}
                </button>
              ) : null}
              {props.modelLabel && props.onOpenModelPicker ? (
                <button
                  type="button"
                  onClick={props.onOpenModelPicker}
                  aria-label={`模型 ${props.modelLabel}`}
                  style={stateChipStyle}
                  disabled={disabled}
                >
                  {props.modelLabel}
                </button>
              ) : null}
              {props.reasoningEffortLabel && props.onOpenReasoningPicker ? (
                <button
                  type="button"
                  onClick={props.onOpenReasoningPicker}
                  aria-label={`推理强度 ${props.reasoningEffortLabel}`}
                  style={effortChipStyle}
                  disabled={disabled}
                >
                  {props.reasoningEffortLabel}
                </button>
              ) : null}
            </div>
            {props.running ? (
              <button type="button" onClick={() => props.onInterrupt()} style={interruptBtn} aria-label="中断">
                <StopIcon />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => send()}
                disabled={!canSend}
                style={sendButtonStyle}
                aria-label="发送"
              >
                <SendIcon />
              </button>
            )}
          </div>
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            multiple
            style={{ display: "none" }}
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              files.forEach(addImage);
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

export const ChatInput = memo(ChatInputImpl);

function skillKey(skill: SkillReference): string {
  return `${skill.name}\u0001${skill.path}`;
}

function skillLoadKey(cwd?: string): string {
  const normalized = cwd?.trim();
  return normalized || "__default__";
}

function AddPanel({
  selectedSkillCount,
  hasGoal,
  showGoal,
  onClose,
  onPickImage,
  onOpenSkillPicker,
  onOpenGoalEditor
}: {
  selectedSkillCount: number;
  hasGoal: boolean;
  showGoal: boolean;
  onClose: () => void;
  onPickImage: () => void;
  onOpenSkillPicker: () => void;
  onOpenGoalEditor: () => void;
}): JSX.Element {
  return (
    <section role="dialog" aria-label="添加内容" style={addPanelStyle}>
      <header style={addPanelHeaderStyle}>
        <div style={addPanelTitleStyle}>添加内容</div>
        <button type="button" onClick={onClose} style={addPanelDoneStyle}>
          完成
        </button>
      </header>
      <div style={addPanelListStyle}>
        <AddPanelAction
          label="图片"
          description="上传图片到本轮消息"
          icon={<ImageIcon />}
          onClick={onPickImage}
        />
        <AddPanelAction
          label="引用 Skill"
          description="管理本次消息引用的 Skill"
          icon={<SkillIcon />}
          badge={selectedSkillCount > 0 ? `已选 ${selectedSkillCount}` : undefined}
          onClick={onOpenSkillPicker}
        />
        {showGoal ? (
          <AddPanelAction
            label={hasGoal ? "编辑目标" : "设定目标"}
            description={hasGoal ? "编辑当前会话目标" : "设置当前会话目标"}
            icon={<TargetIcon />}
            badge={hasGoal ? "已设置" : undefined}
            onClick={onOpenGoalEditor}
            isLast
          />
        ) : null}
      </div>
    </section>
  );
}

function AddPanelAction({
  label,
  description,
  icon,
  badge,
  onClick,
  isLast = false
}: {
  label: string;
  description: string;
  icon: React.ReactNode;
  badge?: string;
  onClick: () => void;
  isLast?: boolean;
}): JSX.Element {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      style={isLast ? addPanelActionLastStyle : addPanelActionStyle}
    >
      <span style={addPanelIconStyle}>{icon}</span>
      <span style={addPanelActionTextStyle}>
        <span style={addPanelActionTitleStyle}>{label}</span>
        <span style={addPanelActionDescStyle}>{description}</span>
      </span>
      {badge ? <span style={addPanelBadgeStyle}>{badge}</span> : null}
    </button>
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
  position: "relative",
  flex: "0 0 auto",
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
  padding: 0,
  borderRadius: 14,
  border: "1px solid var(--cw-border)",
  background: "var(--cw-card)",
  boxShadow: "0 -12px 34px rgba(0,0,0,0.18)",
  display: "flex",
  flexDirection: "column"
};

const addPanelHeaderStyle: React.CSSProperties = {
  minHeight: 48,
  padding: "8px 12px 8px 14px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  borderBottom: "1px solid var(--cw-border)"
};

const addPanelTitleStyle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 650,
  color: "var(--cw-fg)"
};

const addPanelDoneStyle: React.CSSProperties = {
  border: "none",
  background: "transparent",
  color: "var(--cw-accent)",
  fontSize: 14,
  padding: "6px 4px"
};

const addPanelListStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column"
};

const addPanelActionStyle: React.CSSProperties = {
  minHeight: 64,
  border: "none",
  borderBottom: "1px solid var(--cw-border)",
  background: "transparent",
  color: "var(--cw-fg)",
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "10px 14px",
  textAlign: "left",
  fontSize: 14,
  width: "100%"
};

const addPanelActionLastStyle: React.CSSProperties = {
  ...addPanelActionStyle,
  borderBottom: "none"
};

const addPanelIconStyle: React.CSSProperties = {
  width: 32,
  height: 32,
  flex: "0 0 32px",
  borderRadius: 8,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  color: "var(--cw-accent)",
  background: "color-mix(in srgb, var(--cw-accent) 12%, transparent)"
};

const addPanelActionTextStyle: React.CSSProperties = {
  minWidth: 0,
  flex: 1,
  display: "flex",
  flexDirection: "column",
  gap: 3
};

const addPanelActionTitleStyle: React.CSSProperties = {
  color: "var(--cw-fg)",
  fontSize: 15,
  fontWeight: 620,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap"
};

const addPanelActionDescStyle: React.CSSProperties = {
  color: "var(--cw-fg-muted)",
  fontSize: 12,
  lineHeight: "16px",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap"
};

const addPanelBadgeStyle: React.CSSProperties = {
  flex: "0 0 auto",
  border: "1px solid color-mix(in srgb, var(--cw-accent) 28%, var(--cw-border))",
  borderRadius: 999,
  background: "color-mix(in srgb, var(--cw-accent) 10%, transparent)",
  color: "var(--cw-accent)",
  padding: "3px 7px",
  fontSize: 12,
  fontWeight: 620,
  whiteSpace: "nowrap"
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
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "var(--cw-border)",
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

const pendingStateChipStyle: React.CSSProperties = {
  ...stateChipStyle,
  borderColor: "color-mix(in srgb, var(--cw-warning) 38%, var(--cw-border))",
  color: "var(--cw-fg-muted)"
};

const effortChipStyle: React.CSSProperties = {
  ...stateChipStyle,
  maxWidth: 92,
  flex: "0 0 auto"
};

const selectedContextStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  overflowX: "auto",
  padding: "0 2px"
};

const compatibilityErrorStyle: React.CSSProperties = {
  padding: "0 4px",
  color: "var(--cw-danger)",
  fontSize: 12,
  lineHeight: "18px"
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

function TargetIcon(): JSX.Element {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="7" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="3.2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
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
