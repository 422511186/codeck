"use client";

import { type FormEvent, useState } from "react";

type ComposerProps = {
  disabled: boolean;
  sending: boolean;
  onSend(text: string): Promise<void>;
};

export function Composer({ disabled, sending, onSend }: ComposerProps) {
  const [text, setText] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = text.trim();
    if (!message || disabled || sending) {
      return;
    }

    try {
      await onSend(message);
      setText("");
    } catch {
      return;
    }
  }

  return (
    <form className="composer" onSubmit={handleSubmit}>
      <input
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="给 Codex 发送消息"
        disabled={disabled || sending}
      />
      <button type="submit" disabled={!text.trim() || disabled || sending}>
        {sending ? "发送中" : "发送"}
      </button>
    </form>
  );
}
