"use client";

import type { MobileTimelineItem } from "../shared/codex";

type DiffPanelProps = {
  timeline: MobileTimelineItem[];
};

export function DiffPanel({ timeline }: DiffPanelProps) {
  const diffItem = [...timeline].reverse().find((item) => item.id.startsWith("diff-") || item.text.startsWith("diff --git"));

  return (
    <section className="panel-view" aria-label="Diff 面板">
      <div className="section-title">
        <h2>Diff</h2>
        <span>{diffItem ? "最新" : "暂无"}</span>
      </div>
      <article className="diff-preview">
        <pre>{diffItem?.text || "暂无 Diff"}</pre>
      </article>
    </section>
  );
}
