"use client";

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
  const preview = imagePreviewSrc(src);
  return (
    <button
      type="button"
      aria-label={label}
      onClick={() => onPreview(src)}
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
      <img src={preview} alt={label} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
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
  const preview = imagePreviewSrc(src);
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
      <img
        src={preview}
        alt="图片预览"
        onClick={(event) => event.stopPropagation()}
        style={{
          maxWidth: "100%",
          maxHeight: "86dvh",
          objectFit: "contain",
          borderRadius: 8
        }}
      />
    </div>
  );
}
