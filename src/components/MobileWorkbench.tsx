"use client";

import { useEffect, useState } from "react";
import { createBrowserSocket } from "../lib/ws-client";
import { ConnectionBadge } from "./ConnectionBadge";

export function MobileWorkbench() {
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const socket = createBrowserSocket((event) => {
      if (typeof event === "object" && event && "type" in event) {
        if ((event as { type: string }).type === "hello") {
          setConnected(true);
        }
      }
    });

    socket.addEventListener("close", () => setConnected(false));
    return () => socket.close();
  }, []);

  return (
    <main className="workbench">
      <header className="top-bar">
        <div>
          <p className="eyebrow">当前会话</p>
          <h1>新会话</h1>
        </div>
        <ConnectionBadge connected={connected} />
      </header>

      <section className="timeline">
        <article className="empty-state">
          <h2>Codex 已准备好</h2>
          <p>第一阶段先验证移动端壳子、登录和后端连接。下一阶段接入真实会话。</p>
        </article>
      </section>

      <form className="composer">
        <input placeholder="给 Codex 发送消息" disabled />
        <button type="button" disabled>
          发送
        </button>
      </form>

      <nav className="bottom-nav" aria-label="移动端导航">
        <button type="button">Chats</button>
        <button type="button">Run</button>
        <button type="button">Files</button>
        <button type="button">Terminal</button>
        <button type="button">Settings</button>
      </nav>
    </main>
  );
}
