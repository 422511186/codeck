"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { auth } from "../../web/api/endpoints";
import { ApiError } from "../../web/api/client";
import { replaceDocumentLocation } from "../../web/navigation/location";

function safeLoginReturnPath(value: string | null): string | null {
  if (!value) {
    return null;
  }

  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\") || /[\u0000-\u001f]/.test(value)) {
    return null;
  }

  return value;
}

export default function LoginPage(): JSX.Element {
  return (
    <Suspense fallback={<LoginShell />}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm(): JSX.Element {
  const params = useSearchParams();
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const returnPath = safeLoginReturnPath(params.get("return")) ?? safeLoginReturnPath(params.get("next")) ?? "/projects";

  const navigateAfterAuth = useCallback((): void => {
    replaceDocumentLocation(returnPath);
  }, [returnPath]);

  useEffect(() => {
    let cancelled = false;
    auth
      .session()
      .then((res) => {
        if (cancelled) return;
        if (res.authenticated) {
          navigateAfterAuth();
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [navigateAfterAuth]);

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!token.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await auth.login(token.trim());
      navigateAfterAuth();
    } catch (err) {
      const msg = err instanceof ApiError && err.status === 401 ? "Token 不正确" : (err as Error).message;
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <LoginShell>
      <form
        onSubmit={onSubmit}
        style={{
          width: "100%",
          maxWidth: 360,
          display: "flex",
          flexDirection: "column",
          gap: "var(--cw-space-4)"
        }}
      >
        <h1
          style={{
            fontSize: 24,
            fontWeight: 600,
            textAlign: "center",
            margin: 0
          }}
        >
          Codex Web
        </h1>
        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ fontSize: 13, color: "var(--cw-fg-muted)" }}>登录 Token</span>
          <input
            type="password"
            inputMode="text"
            autoComplete="current-password"
            placeholder="粘贴你的 access token"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            disabled={submitting}
            style={{
              padding: "12px 14px",
              borderRadius: 12,
              border: "1px solid var(--cw-border)",
              background: "var(--cw-card)",
              color: "var(--cw-fg)",
              fontSize: 16
            }}
          />
          {error ? <span style={{ color: "var(--cw-danger)", fontSize: 13 }}>{error}</span> : null}
        </label>
        <button
          type="submit"
          disabled={!token.trim() || submitting}
          style={{
            padding: "12px 16px",
            borderRadius: 12,
            border: "none",
            background: "var(--cw-accent)",
            color: "#fff",
            fontSize: 16,
            opacity: !token.trim() || submitting ? 0.5 : 1
          }}
        >
          {submitting ? "登录中…" : "登录"}
        </button>
      </form>
    </LoginShell>
  );
}

function LoginShell({ children }: { children?: ReactNode }): JSX.Element {
  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "var(--cw-space-6)"
      }}
    >
      {children}
    </main>
  );
}
