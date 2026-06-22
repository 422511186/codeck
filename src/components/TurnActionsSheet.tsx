import { type FormEvent, useState } from "react";
import type { MobileThreadDetail } from "../shared/codex";

type TurnActionsSheetProps = {
  thread: MobileThreadDetail;
  busy: boolean;
  onFork(): Promise<void>;
  onRename(name: string): Promise<void>;
  onArchive(): Promise<void>;
  onDelete(): Promise<void>;
  onCompact(): Promise<void>;
  onSetGoal(objective: string, tokenBudget?: number | null): Promise<void>;
  onClearGoal(): Promise<void>;
  onEditResend(text: string): Promise<void>;
  onInterrupt(): Promise<void>;
  onSteer(text: string): Promise<void>;
};

export function TurnActionsSheet({
  thread,
  busy,
  onFork,
  onRename,
  onArchive,
  onDelete,
  onCompact,
  onSetGoal,
  onClearGoal,
  onEditResend,
  onInterrupt,
  onSteer
}: TurnActionsSheetProps) {
  const [nameText, setNameText] = useState("");
  const [goalText, setGoalText] = useState("");
  const [goalBudgetText, setGoalBudgetText] = useState("");
  const [editText, setEditText] = useState("");
  const [steerText, setSteerText] = useState("");

  async function submitRename(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = nameText.trim();
    if (!name || busy) {
      return;
    }

    await onRename(name);
    setNameText("");
  }

  async function submitGoal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const objective = goalText.trim();
    if (!objective || busy) {
      return;
    }

    const budget = goalBudgetText.trim() ? Number(goalBudgetText.trim()) : undefined;
    await onSetGoal(objective, Number.isFinite(budget) ? budget : undefined);
    setGoalText("");
    setGoalBudgetText("");
  }

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
      <div className="turn-actions-row">
        <button type="button" onClick={onCompact} disabled={busy || !thread.lastTurnId}>
          压缩上下文
        </button>
        <button type="button" onClick={onArchive} disabled={busy}>
          归档
        </button>
      </div>
      <div className="turn-actions-row">
        <button type="button" onClick={onDelete} disabled={busy}>
          删除
        </button>
      </div>
      <form className="turn-action-form" onSubmit={submitRename}>
        <input
          value={nameText}
          onChange={(event) => setNameText(event.target.value)}
          placeholder="重命名会话"
          disabled={busy}
        />
        <button type="submit" disabled={busy || !nameText.trim()}>
          改名
        </button>
      </form>
      {thread.goal ? (
        <div className="turn-goal" aria-label="会话目标">
          <p>目标：{thread.goal.objective}</p>
          <span>
            {thread.goal.status}
            {thread.goal.tokenBudget ? ` · 预算 ${thread.goal.tokenBudget}` : ""}
          </span>
          <button type="button" onClick={onClearGoal} disabled={busy}>
            清除目标
          </button>
        </div>
      ) : null}
      <form className="turn-action-form" onSubmit={submitGoal}>
        <input
          value={goalText}
          onChange={(event) => setGoalText(event.target.value)}
          placeholder="设置会话目标"
          disabled={busy}
        />
        <input
          value={goalBudgetText}
          onChange={(event) => setGoalBudgetText(event.target.value)}
          placeholder="Token 预算"
          inputMode="numeric"
          disabled={busy}
        />
        <button type="submit" disabled={busy || !goalText.trim()}>
          设为目标
        </button>
      </form>
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
