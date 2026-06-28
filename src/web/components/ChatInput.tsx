"use client";

import { useEffect, useRef, useState } from "react";
import { codex } from "../api/endpoints";
import { ApiError } from "../api/client";
import { getDraft, setDraft } from "../storage/drafts";

export type ChatInputProps = {
  threadId: string;
  running: boolean;
  onSend: (text: string, imagePaths: string[]) => Promise<void>;
  onInterrupt: () => Promise<void>;
  onResendLast: () => Promise<string | null | void>;
  canResendLast?: boolean;
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
  const [fullscreen, setFullscreen] = useState(false);
  const [sending, setSending] = useState(false);
  const fileInput = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setText(getDraft(props.threadId));
    setImage(null);
  }, [props.threadId]);

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
    if (sending || props.running) return;
    const trimmed = value.trim();
    if (!trimmed) return;
    if (image && image.status !== "ready") return;
    setSending(true);
    try {
      const paths = image?.serverPath ? [image.serverPath] : [];
      await props.onSend(trimmed, paths);
      setText("");
      setImage(null);
      setDraft(props.threadId, "");
      setFullscreen(false);
    } catch (err) {
      // surface left for caller via timeline (failed user msg); just keep input contents
      if (err instanceof ApiError) {
        console.warn("send failed", err.message);
      }
    } finally {
      setSending(false);
    }
  }

  const disabled = sending || props.running || image?.status === "uploading";
  const canSend = !disabled && text.trim().length > 0 && (!image || image.status === "ready");

  async function resendLast(): Promise<void> {
    if (props.running) return;
    const value = await props.onResendLast();
    if (typeof value === "string") {
      setText(value);
      setDraft(props.threadId, value);
    }
  }

  return (
    <>
      <div
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          padding: "8px 10px calc(8px + var(--safe-bottom))",
          background: "var(--cw-bg)",
          borderTop: "1px solid var(--cw-border)",
          display: "flex",
          flexDirection: "column",
          gap: 6,
          zIndex: 20
        }}
      >
        {image ? <ImageThumb image={image} onRemove={() => setImage(null)} onRetry={retryImage} /> : null}

        <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
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
            placeholder={props.running ? "agent 正在运行…" : "输入消息"}
            rows={1}
            style={textareaStyle}
            disabled={disabled}
          />
          <button type="button" onClick={() => setFullscreen(true)} aria-label="全屏编辑" style={iconBtn}>
            <ExpandIcon />
          </button>
          {props.canResendLast ? (
            <button
              type="button"
              onClick={resendLast}
              aria-label="重发上一条"
              style={{ ...iconBtn, opacity: props.running ? 0.3 : 1 }}
              disabled={props.running}
            >
              <RefreshIcon />
            </button>
          ) : null}
          {props.running ? (
            <button type="button" onClick={() => props.onInterrupt()} style={interruptBtn} aria-label="中断">
              <StopIcon />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => send()}
              disabled={!canSend}
              style={{ ...sendBtn, opacity: canSend ? 1 : 0.4 }}
              aria-label="发送"
            >
              <SendIcon />
            </button>
          )}
        </div>
      </div>

      {fullscreen ? (
        <FullscreenEditor
          initial={text}
          onCancel={() => setFullscreen(false)}
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

function FullscreenEditor({
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
        background: "var(--cw-bg)",
        display: "flex",
        flexDirection: "column",
        zIndex: 100
      }}
    >
      <header
        style={{
          height: 56,
          padding: "0 12px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "1px solid var(--cw-border)"
        }}
      >
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
        style={{
          flex: 1,
          width: "100%",
          padding: 14,
          background: "transparent",
          color: "var(--cw-fg)",
          border: "none",
          fontSize: 16,
          resize: "none",
          outline: "none"
        }}
      />
    </div>
  );
}

const iconBtn: React.CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 18,
  border: "none",
  background: "transparent",
  color: "var(--cw-fg)",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center"
};

const sendBtn: React.CSSProperties = {
  width: 40,
  height: 40,
  borderRadius: 20,
  border: "none",
  background: "var(--cw-accent)",
  color: "#fff",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center"
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
  minHeight: 36,
  maxHeight: 96,
  padding: "8px 12px",
  borderRadius: 18,
  border: "1px solid var(--cw-border)",
  background: "var(--cw-bg-elevated)",
  color: "var(--cw-fg)",
  fontSize: 15,
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
      <path d="M9 5H5v4M15 5h4v4M9 19H5v-4M15 19h4v-4" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 9l5-5M19 9l-5-5M5 15l5 5M19 15l-5 5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  );
}

function RefreshIcon(): JSX.Element {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M20 12a8 8 0 1 1-2.3-5.6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      <path d="M20 5v5h-5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SendIcon(): JSX.Element {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 12h13M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
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
