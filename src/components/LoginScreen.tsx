"use client";

import { FormEvent, useState } from "react";
import { loginWithToken } from "../lib/client-api";

export function LoginScreen({ onLoggedIn }: { onLoggedIn: () => void }) {
  const [token, setToken] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const ok = await loginWithToken(token);
    if (ok) {
      onLoggedIn();
    } else {
      setError("登录 token 不正确");
    }
  }

  return (
    <main className="login-screen">
      <section className="login-panel">
        <p className="eyebrow">Codex Mobile Web</p>
        <h1>连接你的 Codex</h1>
        <form onSubmit={handleSubmit} className="login-form">
          <input
            value={token}
            onChange={(event) => setToken(event.target.value)}
            placeholder="输入登录 token"
            autoComplete="off"
            inputMode="text"
          />
          <button type="submit">登录</button>
        </form>
        {error ? <p className="form-error">{error}</p> : null}
      </section>
    </main>
  );
}
