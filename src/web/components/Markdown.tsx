"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github-dark.css";

type Props = { text: string };

export function Markdown({ text }: Props): JSX.Element {
  return (
    <div className="cw-markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          code({ inline, className, children, ...rest }) {
            const lang = (className ?? "").replace(/^language-/, "");
            if (inline) {
              return (
                <code className={className} {...rest}>
                  {children}
                </code>
              );
            }
            if (lang === "mermaid") {
              return <MermaidBlock code={String(children).trim()} />;
            }
            return <CodeBlock code={String(children).replace(/\n$/, "")} className={className} />;
          },
          pre({ children }) {
            return <>{children}</>;
          }
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}

function CodeBlock({ code, className }: { code: string; className?: string }): JSX.Element {
  const [copied, setCopied] = useState(false);

  function copy(): void {
    navigator.clipboard?.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    });
  }

  return (
    <div style={{ position: "relative", margin: "8px 0" }}>
      <button
        type="button"
        onClick={copy}
        aria-label="复制代码"
        style={{
          position: "absolute",
          top: 6,
          right: 6,
          padding: "2px 8px",
          fontSize: 11,
          borderRadius: 6,
          border: "1px solid var(--cw-border)",
          background: "var(--cw-bg-overlay)",
          color: "var(--cw-fg)"
        }}
      >
        {copied ? "已复制" : "复制"}
      </button>
      <pre
        style={{
          margin: 0,
          padding: 12,
          background: "#0d1117",
          color: "#c9d1d9",
          borderRadius: 10,
          fontFamily: "var(--font-mono)",
          fontSize: 12,
          overflowX: "auto"
        }}
      >
        <code className={className}>{code}</code>
      </pre>
    </div>
  );
}

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
  return <div ref={ref} style={{ overflowX: "auto" }} />;
}
