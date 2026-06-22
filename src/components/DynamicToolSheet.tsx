"use client";

import { type FormEvent, useState } from "react";
import type { PendingServerRequestView } from "../server/app-server/pending-requests";

type DynamicToolSheetProps = {
  request: PendingServerRequestView;
  onResolve(request: PendingServerRequestView, value: string): Promise<void>;
};

export function DynamicToolSheet({ request, onResolve }: DynamicToolSheetProps) {
  const [result, setResult] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = result.trim();
    if (!value || submitting) {
      return;
    }

    setSubmitting(true);
    try {
      await onResolve(request, value);
    } finally {
      setSubmitting(false);
    }
  }

  async function fail() {
    if (submitting) {
      return;
    }

    setSubmitting(true);
    try {
      await onResolve(request, "__failure__");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="approval-sheet" aria-label="动态工具调用">
      <div>
        <h2>动态工具调用</h2>
        <p>{request.description}</p>
      </div>
      <form className="dynamic-tool-form" onSubmit={submit}>
        <textarea
          placeholder="输入工具执行结果"
          value={result}
          onChange={(event) => setResult(event.target.value)}
          disabled={submitting}
        />
        <div className="approval-actions">
          <button type="submit" disabled={submitting || !result.trim()}>
            回传结果
          </button>
          <button type="button" onClick={fail} disabled={submitting}>
            标记失败
          </button>
        </div>
      </form>
    </section>
  );
}
