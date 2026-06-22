"use client";

import { useEffect, useState } from "react";
import { LoginScreen } from "../components/LoginScreen";
import { MobileWorkbench } from "../components/MobileWorkbench";
import { readSession } from "../lib/client-api";

export default function HomePage() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    readSession().then((session) => setAuthenticated(session.authenticated));
  }, []);

  if (authenticated === null) {
    return <main className="loading-screen">正在检查登录状态</main>;
  }

  if (!authenticated) {
    return <LoginScreen onLoggedIn={() => setAuthenticated(true)} />;
  }

  return <MobileWorkbench />;
}
