"use client";

import { useState } from "react";
import { ImageOff, RotateCcw } from "lucide-react";

export function imagePreviewSrc(src: string): string {
  if (/^(blob:|data:|https?:)/i.test(src) || src.startsWith("/api/")) {
    return src;
  }
  return `/api/codex/images/preview?path=${encodeURIComponent(src)}`;
}

export function ImageThumb({
  src,
  label = "预览图片",
  onPreview
}: {
  src: string;
  label?: string;
  onPreview: (src: string) => void;
}): JSX.Element {
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const preview = retryImageSrc(imagePreviewSrc(src), retry);
  return (
    <button
      type="button"
      aria-label={failed ? "图片加载失败，点击重试" : label}
      onClick={() => {
        if (failed) {
          setFailed(false);
          setRetry((value) => value + 1);
          return;
        }
        onPreview(src);
      }}
      style={{
        width: 80,
        height: 80,
        padding: 0,
        border: "1px solid var(--cw-border)",
        background: "transparent",
        borderRadius: 8,
        overflow: "hidden",
        cursor: "zoom-in"
      }}
    >
      {failed ? (
        <span style={imageFailureStyle}>
          <ImageOff aria-hidden="true" size={20} strokeWidth={1.6} />
          <span>加载失败</span>
        </span>
      ) : (
        <img
          src={preview}
          alt={label}
          onError={() => setFailed(true)}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      )}
    </button>
  );
}

export function ImagePreviewDialog({
  src,
  onClose
}: {
  src: string;
  onClose: () => void;
}): JSX.Element {
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const preview = retryImageSrc(imagePreviewSrc(src), retry);
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="图片预览"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 90,
        background: "rgba(0,0,0,0.82)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 14
      }}
    >
      <button
        type="button"
        aria-label="关闭预览"
        onClick={onClose}
        style={{
          position: "absolute",
          top: 12,
          right: 12,
          width: 38,
          height: 38,
          borderRadius: 19,
          border: "1px solid rgba(255,255,255,0.35)",
          background: "rgba(0,0,0,0.35)",
          color: "#fff",
          fontSize: 22
        }}
      >
        ×
      </button>
      {failed ? (
        <div onClick={(event) => event.stopPropagation()} style={dialogFailureStyle}>
          <ImageOff aria-hidden="true" size={28} strokeWidth={1.5} />
          <span>图片加载失败</span>
          <button
            type="button"
            onClick={() => {
              setFailed(false);
              setRetry((value) => value + 1);
            }}
            style={retryButtonStyle}
          >
            <RotateCcw aria-hidden="true" size={15} strokeWidth={1.8} />
            重试
          </button>
        </div>
      ) : (
        <img
          src={preview}
          alt="图片预览"
          onError={() => setFailed(true)}
          onClick={(event) => event.stopPropagation()}
          style={{
            maxWidth: "100%",
            maxHeight: "86dvh",
            objectFit: "contain",
            borderRadius: 8
          }}
        />
      )}
    </div>
  );
}

function retryImageSrc(src: string, retry: number): string {
  if (retry === 0 || src.startsWith("data:") || src.startsWith("blob:")) {
    return src;
  }
  return `${src}${src.includes("?") ? "&" : "?"}cw_retry=${retry}`;
}

const imageFailureStyle: React.CSSProperties = {
  width: "100%",
  height: "100%",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 5,
  color: "var(--cw-fg-muted)",
  fontSize: 11,
  lineHeight: 1.2
};

const dialogFailureStyle: React.CSSProperties = {
  width: "min(320px, 100%)",
  minHeight: 180,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 10,
  border: "1px solid rgba(255,255,255,0.24)",
  borderRadius: 8,
  color: "#fff",
  background: "rgba(0,0,0,0.28)"
};

const retryButtonStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "6px 10px",
  border: "1px solid rgba(255,255,255,0.35)",
  borderRadius: 6,
  background: "transparent",
  color: "#fff",
  fontSize: 12
};
