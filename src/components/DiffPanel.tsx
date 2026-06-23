"use client";

import { useState } from "react";
import { gitDiffToRemote } from "../lib/client-api";
import type { MobileTimelineItem } from "../shared/codex";

type DiffPanelProps = {
  timeline: MobileTimelineItem[];
  cwd: string;
};

export function DiffPanel({ timeline, cwd }: DiffPanelProps) {
  const diffItem = [...timeline].reverse().find((item) => item.id.startsWith("diff-") || item.text.startsWith("diff --git"));
  const [remoteDiff, setRemoteDiff] = useState<{ sha: string; diff: string } | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleReadRemoteDiff() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const diff = await gitDiffToRemote(cwd);
      setRemoteDiff(diff);
      setNotice(`远端基准：${diff.sha}`);
    } catch (readError) {
      setError(readError instanceof Error ? readError.message : "无法读取远端 Git diff");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel-view" aria-label="Diff 面板">
      <div className="section-title">
        <h2>Diff</h2>
        <span>{remoteDiff || diffItem ? "最新" : "暂无"}</span>
      </div>
      {error ? <p className="form-error">{error}</p> : null}
      {notice ? <p className="form-success">{notice}</p> : null}
      <div className="turn-actions-row">
        <button type="button" onClick={handleReadRemoteDiff} disabled={busy}>
          读取远端 Diff
        </button>
      </div>
      <article className="diff-preview">
        <pre>{remoteDiff?.diff || diffItem?.text || "暂无 Diff"}</pre>
      </article>
    </section>
  );
}
