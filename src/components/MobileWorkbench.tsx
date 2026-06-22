"use client";

import { useEffect, useState } from "react";
import type { AppServerStatusView, MobileModelOption, MobileThreadDetail, MobileThreadSummary } from "../shared/codex";
import { listModels, listThreads, readCodexStatus, readThread } from "../lib/client-api";
import { createBrowserSocket } from "../lib/ws-client";
import { ConnectionBadge } from "./ConnectionBadge";

export function MobileWorkbench() {
  const [connected, setConnected] = useState(false);
  const [appServerStatus, setAppServerStatus] = useState<AppServerStatusView>({ state: "idle" });
  const [threads, setThreads] = useState<MobileThreadSummary[]>([]);
  const [selectedThread, setSelectedThread] = useState<MobileThreadDetail | null>(null);
  const [models, setModels] = useState<MobileModelOption[]>([]);
  const [loadError, setLoadError] = useState("");

  const defaultModel = models.find((model) => model.isDefault) || models[0] || null;

  useEffect(() => {
    const socket = createBrowserSocket((event) => {
      if (typeof event === "object" && event && "type" in event) {
        if ((event as { type: string }).type === "hello") {
          setConnected(true);
        }
        if ((event as { type: string }).type === "health") {
          const health = event as unknown as { appServer: AppServerStatusView["state"]; detail?: string };
          setAppServerStatus({ state: health.appServer, message: health.detail });
        }
      }
    });

    socket.addEventListener("close", () => setConnected(false));
    return () => socket.close();
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadWorkbenchData() {
      setLoadError("");
      try {
        const [threadPage, modelOptions] = await Promise.all([listThreads(), listModels()]);
        const status = await readCodexStatus();

        if (!cancelled) {
          setAppServerStatus(status);
          setThreads(threadPage.threads);
          setModels(modelOptions);
        }

        if (!cancelled && threadPage.threads[0]) {
          const thread = await readThread(threadPage.threads[0].id);
          if (!cancelled) {
            setSelectedThread(thread);
          }
        }
      } catch (error) {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : "无法读取 Codex 数据");
        }
      }
    }

    loadWorkbenchData();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSelectThread(threadId: string) {
    setLoadError("");
    try {
      setSelectedThread(await readThread(threadId));
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "无法读取会话内容");
    }
  }

  return (
    <main className="workbench">
      <header className="top-bar">
        <div>
          <p className="eyebrow">当前会话</p>
          <h1>{selectedThread?.title || threads[0]?.title || "新会话"}</h1>
        </div>
        <div className="status-stack">
          <ConnectionBadge connected={connected} />
          <span className="app-server-state">{appServerStatus.state}</span>
        </div>
      </header>

      <section className="timeline">
        <div className="model-strip">
          <span>{defaultModel?.label || "模型加载中"}</span>
          <span>{defaultModel?.supportedReasoningEfforts.join(" / ") || "reasoning"}</span>
        </div>

        {loadError ? <p className="form-error">{loadError}</p> : null}

        <section className="thread-list" aria-label="会话历史">
          <div className="section-title">
            <h2>历史会话</h2>
            <span>{threads.length}</span>
          </div>
          {threads.length > 0 ? (
            threads.map((thread) => (
              <button className="thread-row" type="button" key={thread.id} onClick={() => handleSelectThread(thread.id)}>
                <span className="thread-title">{thread.title}</span>
                <span className="thread-preview">{thread.preview || thread.cwd}</span>
                <span className="thread-meta">
                  {thread.modelProvider} · {thread.status}
                </span>
              </button>
            ))
          ) : (
            <article className="empty-state">
              <h2>新会话</h2>
              <p>Codex</p>
            </article>
          )}
        </section>

        {selectedThread ? (
          <section className="message-list" aria-label="会话内容">
            <div className="section-title">
              <h2>会话内容</h2>
              <span>{selectedThread.timeline.length}</span>
            </div>
            {selectedThread.timeline.map((item) => (
              <article className={`message-bubble message-${item.role}`} key={item.id}>
                <span>{item.role}</span>
                <p>{item.text}</p>
              </article>
            ))}
          </section>
        ) : null}
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
