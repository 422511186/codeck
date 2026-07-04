"use client";

import { useRouter, usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { setSessionInvalidHandler } from "../api/client";
import { auth } from "../api/endpoints";
import { connectBrowserEventStream } from "../events/client";
import { useStore } from "../state/store";
import { applyTheme, settingsStore } from "../storage/settings";

export function AppProviders({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const setWsState = useStore((s) => s.setWsState);
  const setAppServer = useStore((s) => s.setAppServer);
  const dispatchEvent = useStore((s) => s.dispatchEvent);
  const resolvePendingRequest = useStore((s) => s.resolvePendingRequest);
  const wsState = useStore((s) => s.wsState);

  useEffect(() => {
    setSessionInvalidHandler(() => {
      const next = encodeURIComponent(pathname || "/projects");
      router.replace(`/login?next=${next}`);
    });
    return () => setSessionInvalidHandler(null);
  }, [pathname, router]);

  useEffect(() => {
    const settings = settingsStore.load();
    applyTheme(settings.theme);
    if (typeof window === "undefined") return;
    if (pathname?.startsWith("/login")) return;

    const conn = connectBrowserEventStream({
      onState: setWsState,
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
        }
      }
    });

    return () => conn.close();
  }, [dispatchEvent, pathname, resolvePendingRequest, setAppServer, setWsState]);

  useEffect(() => {
    if (pathname?.startsWith("/login")) return;
    if (wsState === "open" || wsState === "idle") return;

    let cancelled = false;
    auth
      .session()
      .then((res) => {
        if (cancelled || res.authenticated) return;
        const next = encodeURIComponent(pathname || "/projects");
        router.replace(`/login?next=${next}`);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [pathname, router, wsState]);

  const showOffline = useMemo(
    () => wsState !== "open" && wsState !== "idle" && !pathname?.startsWith("/login"),
    [pathname, wsState]
  );

  return (
    <>
      {showOffline ? <OfflineBanner /> : null}
      {children}
    </>
  );
}

function OfflineBanner() {
  const [dots, setDots] = useState("");
  useEffect(() => {
    const id = setInterval(() => setDots((d) => (d.length >= 3 ? "" : d + ".")), 500);
    return () => clearInterval(id);
  }, []);
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        background: "var(--warning-bg)",
        color: "var(--warning)",
        padding: "6px 12px",
        fontSize: "13px",
        textAlign: "center"
      }}
    >
      网络已断开，重连中{dots}
    </div>
  );
}
