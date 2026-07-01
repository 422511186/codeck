"use client";

import { useEffect, useRef, useState } from "react";
import { codex } from "../api/endpoints";
import { ApiError } from "../api/client";
import { getDraft, setDraft } from "../storage/drafts";

export type ChatInputProps = {
  threadId: string;
  running: boolean;
  disabled?: boolean;
  draftOverride?: { text: string; version: number };
  onSend: (text: string, imagePaths: string[]) => Promise<void>;
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
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false);
  const fileInput = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setText(getDraft(props.threadId));
    setImage(null);
  }, [props.threadId]);

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

  async function send(value = text): Promise<void> {
    if (sendingRef.current || sending || props.running || props.disabled) return;
    const trimmed = value.trim();
    if (!trimmed) return;
    if (image && image.status !== "ready") return;
    sendingRef.current = true;
    setSending(true);
    try {
      const paths = image?.serverPath ? [image.serverPath] : [];
      await props.onSend(trimmed, paths);
      setText("");
      setImage(null);
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

        <div style={composerRowStyle}>
          <button type="button" onClick={pickImage} aria-label="添加图片" style={iconBtn} disabled={disabled}>
            <ImageIcon />
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
    </>
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
