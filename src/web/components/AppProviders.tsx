"use client";

import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";
import { setSessionInvalidHandler } from "../api/client";
import { auth } from "../api/endpoints";
import { connectBrowserEventStream } from "../events/client";
import { useStore } from "../state/store";
import { applyTheme, settingsStore } from "../storage/settings";
import { ReconnectStatus } from "./ReconnectStatus";

export function AppProviders({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const setWsState = useStore((s) => s.setWsState);
  const setReconnectAttempt = useStore((s) => s.setReconnectAttempt);
  const setAppServer = useStore((s) => s.setAppServer);
  const dispatchEvent = useStore((s) => s.dispatchEvent);
  const resolvePendingRequest = useStore((s) => s.resolvePendingRequest);
  const wsState = useStore((s) => s.wsState);
  const reconnectAttempt = useStore((s) => s.reconnectAttempt);

  useEffect(() => {
    setSessionInvalidHandler(() => {
      const next = encodeURIComponent(pathname || "/projects");
      router.replace(`/login?return=${next}`);
    });
    return () => setSessionInvalidHandler(null);
  }, [pathname, router]);

  useEffect(() => {
    const settings = settingsStore.load();
    applyTheme(settings.theme);
    if (typeof window === "undefined") return;
    if (pathname?.startsWith("/login")) return;

    const conn = connectBrowserEventStream({
      onState: (state, attempt) => {
        setWsState(state);
        setReconnectAttempt(attempt);
      },
      onMessage: (event) => {
        switch (event.type) {
          case "health":
            setAppServer({ state: event.appServer, message: event.detail });
            break;
          case "codex-event":
            dispatchEvent(event);
            break;
          case "codex-event-batch":
            dispatchEvent(event);
            break;
          case "server-request":
            dispatchEvent(event);
            break;
          case "server-request-resolved":
            resolvePendingRequest(event.requestId);
            break;
          case "timeline-gap":
            dispatchEvent(event);
            break;
          case "timeline-baseline-required":
            dispatchEvent(event);
            break;
        }
      }
    });

    return () => conn.close();
  }, [dispatchEvent, pathname, resolvePendingRequest, setAppServer, setReconnectAttempt, setWsState]);

  useEffect(() => {
    if (pathname?.startsWith("/login")) return;
    if (wsState === "open" || wsState === "idle") return;

    let cancelled = false;
    auth
      .session()
      .then((res) => {
        if (cancelled || res.authenticated) return;
        const next = encodeURIComponent(pathname || "/projects");
        router.replace(`/login?return=${next}`);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [pathname, router, wsState]);

  const showReconnect =
    (wsState === "reconnecting" || wsState === "closed") &&
    !pathname?.startsWith("/login") &&
    !pathname?.startsWith("/threads/");

  return (
    <>
      {showReconnect ? <ReconnectStatus attempt={reconnectAttempt} floating /> : null}
      {children}
    </>
  );
}
