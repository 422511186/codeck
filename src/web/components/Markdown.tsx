"use client";

import { memo, useEffect, useRef, useState } from "react";
import { isValidElement, type CSSProperties, type ReactNode } from "react";
import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { ImageOff, RotateCcw } from "lucide-react";
import { createPortal } from "react-dom";
import { ImagePreviewDialog, imagePreviewSrc } from "./ImagePreview";
import { copyText } from "../clipboard";

type Props = { text: string; cacheKey?: string };

type MarkdownDiagnostics = {
  renderRuns: number;
};

const markdownDiagnostics: MarkdownDiagnostics = {
  renderRuns: 0
};

export function __getMarkdownDiagnostics(): MarkdownDiagnostics {
  return { ...markdownDiagnostics };
}

export function __resetMarkdownDiagnostics(): void {
  markdownDiagnostics.renderRuns = 0;
}

function MarkdownImpl({ text }: Props): JSX.Element {
  markdownDiagnostics.renderRuns += 1;
  return (
    <div className="cw-markdown" style={markdownRootStyle}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        urlTransform={markdownUrlTransform}
        components={{
          code({ inline, className, children }) {
            const lang = (className ?? "").replace(/^language-/, "");
            const code = textFromChildren(children);
            const isInline = inline ?? (!className && !code.includes("\n"));
            if (isInline) {
              return <code className={className}>{children}</code>;
            }
            if (lang === "mermaid") {
              return <MermaidBlock code={code.trim()} />;
            }
            return <CodeBlock code={code.replace(/\n$/, "")} className={className} />;
          },
          pre({ children }) {
            return <>{children}</>;
          },
          table({ children }) {
            return (
              <div
                className="cw-markdown-table-scroll"
                data-markdown-table-scroll="true"
                style={markdownTableScrollStyle}
              >
                <table className="cw-markdown-table" style={markdownTableStyle}>
                  {children}
                </table>
              </div>
            );
          },
          img({ src, alt }) {
            return <MarkdownImage src={typeof src === "string" ? src : ""} alt={alt ?? "图片"} />;
          }
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}

export const Markdown = memo(MarkdownImpl);

export function markdownUrlTransform(url: string, key: string): string {
  const decoded = decodeUrlOnce(url);
  if (key === "src" && isAbsoluteLocalPath(decoded)) {
    return imagePreviewSrc(decoded);
  }
  if (key === "src" && (/^blob:/i.test(url) || /^data:image\/(?:png|jpe?g|webp|gif)[;,]/i.test(url))) {
    return url;
  }
  return defaultUrlTransform(url);
}

function isAbsoluteLocalPath(value: string): boolean {
  return /^\/(?!\/)/.test(value) || /^[A-Za-z]:[\\/]/.test(value);
}

function decodeUrlOnce(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function MarkdownImage({ src, alt }: { src: string; alt: string }): JSX.Element {
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    setFailed(false);
    setRetry(0);
    setPreviewOpen(false);
  }, [src]);

  function retryLoad(): void {
    setFailed(false);
    setRetry((value) => value + 1);
  }

  function activate(): void {
    if (failed) {
      retryLoad();
      return;
    }
    setPreviewOpen(true);
  }

  return (
    <>
      <span
        role="button"
        tabIndex={0}
        aria-label={failed ? "图片加载失败，点击重试" : `预览图片：${alt}`}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          activate();
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            event.stopPropagation();
            activate();
          }
        }}
        style={markdownImageFrameStyle}
      >
        {failed ? (
          <span style={markdownImageFailureStyle}>
            <ImageOff aria-hidden="true" size={22} strokeWidth={1.6} />
            <span>图片加载失败</span>
            <span style={markdownImageRetryStyle}>
              <RotateCcw aria-hidden="true" size={14} strokeWidth={1.8} />
              重试
            </span>
          </span>
        ) : (
          <img
            key={retry}
            src={retryMarkdownImageSrc(src, retry)}
            alt={alt}
            loading="lazy"
            decoding="async"
            onError={() => setFailed(true)}
            style={markdownImageStyle}
          />
        )}
      </span>
      {previewOpen
        ? createPortal(<ImagePreviewDialog src={src} onClose={() => setPreviewOpen(false)} />, document.body)
        : null}
    </>
  );
}

function retryMarkdownImageSrc(src: string, retry: number): string {
  if (retry === 0 || src.startsWith("data:") || src.startsWith("blob:")) {
    return src;
  }
  return `${src}${src.includes("?") ? "&" : "?"}cw_retry=${retry}`;
}

const markdownImageFrameStyle: CSSProperties = {
  display: "block",
  width: "fit-content",
  maxWidth: "100%",
  minWidth: 0,
  margin: "8px 0",
  cursor: "zoom-in",
  outlineOffset: 3
};

const markdownImageStyle: CSSProperties = {
  display: "block",
  maxWidth: "100%",
  height: "auto",
  borderRadius: 6
};

const markdownImageFailureStyle: CSSProperties = {
  width: "min(100%, 360px)",
  minWidth: 180,
  minHeight: 112,
  boxSizing: "border-box",
  padding: 16,
  border: "1px solid var(--cw-border)",
  borderRadius: 6,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 7,
  color: "var(--cw-fg-muted)",
  background: "var(--cw-bg-elevated)",
  fontSize: 12,
  lineHeight: 1.4,
  cursor: "pointer"
};

const markdownImageRetryStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  color: "var(--cw-fg)"
};

const markdownRootStyle: CSSProperties = {
  maxWidth: "100%",
  minWidth: 0,
  overflowX: "hidden",
  overflowWrap: "anywhere"
};

const markdownTableScrollStyle: CSSProperties = {
  maxWidth: "100%",
  minWidth: 0,
  overflowX: "auto"
};

const markdownTableStyle: CSSProperties = {
  width: "max-content",
  minWidth: "100%",
  borderCollapse: "collapse"
};

function textFromChildren(children: ReactNode): string {
  if (typeof children === "string" || typeof children === "number") {
    return String(children);
  }
  if (Array.isArray(children)) {
    return children.map(textFromChildren).join("");
  }
  if (isValidElement<{ children?: ReactNode }>(children)) {
    return textFromChildren(children.props.children);
  }
  return "";
}

function CodeBlock({ code, className }: { code: string; className?: string }): JSX.Element {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");

  async function copy(): Promise<void> {
    const result = await copyText(code);
    setCopyState(result.ok ? "copied" : "failed");
    window.setTimeout(() => setCopyState("idle"), 1200);
  }

  const copyLabel = copyState === "copied" ? "已复制" : copyState === "failed" ? "复制失败" : "复制";

  return (
    <div data-code-block="true" style={codeBlockShellStyle}>
      <div data-code-block-toolbar="true" style={codeBlockToolbarStyle}>
        <button type="button" onClick={() => void copy()} aria-label="复制代码" style={codeBlockCopyButtonStyle}>
          {copyLabel}
        </button>
      </div>
      <pre style={codeBlockPreStyle}>
        <code
          className={className}
          style={{
            background: "transparent",
            color: "inherit"
          }}
        >
          {code}
        </code>
      </pre>
    </div>
  );
}

const codeBlockShellStyle: CSSProperties = {
  margin: "8px 0",
  maxWidth: "100%",
  minWidth: 0,
  borderRadius: 10,
  border: "1px solid var(--cw-code-border)",
  background: "var(--cw-code-bg)",
  overflow: "hidden"
};

const codeBlockToolbarStyle: CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  alignItems: "center",
  gap: 8,
  padding: "6px 8px",
  borderBottom: "1px solid var(--cw-code-border)",
  background: "color-mix(in srgb, var(--cw-code-bg) 88%, var(--cw-bg-overlay))"
};

const codeBlockCopyButtonStyle: CSSProperties = {
  minHeight: 28,
  padding: "3px 9px",
  fontSize: 12,
  borderRadius: 6,
  border: "1px solid var(--cw-border-strong)",
  background: "var(--cw-bg-overlay)",
  color: "var(--cw-fg)",
  boxShadow: "0 1px 4px rgba(0,0,0,0.12)"
};

const codeBlockPreStyle: CSSProperties = {
  margin: 0,
  padding: 12,
  background: "transparent",
  color: "var(--cw-code-fg)",
  fontFamily: "var(--font-mono)",
  fontSize: 12,
  maxWidth: "100%",
  overflowX: "auto"
};

function MermaidBlock({ code }: { code: string }): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({ startOnLoad: false, theme: "dark", securityLevel: "strict" });
        const { svg } = await mermaid.render(`mmd-${Math.random().toString(36).slice(2)}`, code);
        if (!cancelled && ref.current) ref.current.innerHTML = svg;
      } catch (e) {
        if (!cancelled) setErr((e as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code]);
  if (err)
    return (
      <pre style={{ background: "var(--cw-danger-bg)", color: "var(--cw-danger)", padding: 8, borderRadius: 8 }}>
        {err}
      </pre>
    );
  return <div ref={ref} style={{ maxWidth: "100%", minWidth: 0, overflowX: "auto" }} />;
}
