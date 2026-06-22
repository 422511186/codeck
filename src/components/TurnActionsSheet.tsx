import { type FormEvent, useState } from "react";
import type { MobileThreadDetail } from "../shared/codex";

type TurnActionsSheetProps = {
  thread: MobileThreadDetail;
  busy: boolean;
  onFork(): Promise<void>;
  onEditResend(text: string): Promise<void>;
  onInterrupt(): Promise<void>;
  onSteer(text: string): Promise<void>;
};

export function TurnActionsSheet({
  thread,
  busy,
  onFork,
  onEditResend,
  onInterrupt,
  onSteer
}: TurnActionsSheetProps) {
  const [editText, setEditText] = useState("");
  const [steerText, setSteerText] = useState("");

  async function submitEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = editText.trim();
    if (!text || busy) {
      return;
    }

    await onEditResend(text);
    setEditText("");
  }

  async function submitSteer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = steerText.trim();
    if (!text || busy) {
      return;
    }

    await onSteer(text);
    setSteerText("");
  }

  return (
    <section className="turn-actions" aria-label="会话操作">
      <div className="turn-actions-row">
        <button type="button" onClick={onFork} disabled={busy}>
          Fork
        </button>
        <button type="button" onClick={onInterrupt} disabled={busy || !thread.lastTurnId}>
          Interrupt
        </button>
      </div>
      <form className="turn-action-form" onSubmit={submitEdit}>
        <input
          value={editText}
          onChange={(event) => setEditText(event.target.value)}
          placeholder="编辑重发"
          disabled={busy}
        />
        <button type="submit" disabled={busy || !editText.trim()}>
          重发
        </button>
      </form>
      <form className="turn-action-form" onSubmit={submitSteer}>
        <input
          value={steerText}
          onChange={(event) => setSteerText(event.target.value)}
          placeholder="追加指令"
          disabled={busy || !thread.lastTurnId}
        />
        <button type="submit" disabled={busy || !steerText.trim() || !thread.lastTurnId}>
          追加
        </button>
      </form>
    </section>
  );
}
