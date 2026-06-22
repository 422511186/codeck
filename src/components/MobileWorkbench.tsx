"use client";

import { useEffect, useState } from "react";
import type { BrowserCodexEventEnvelope } from "../server/app-server/events";
import {
  buildPendingServerRequestResponse,
  type BrowserServerRequestEnvelope,
  type PendingServerRequestView
} from "../server/app-server/pending-requests";
import type { AppServerStatusView, MobileModelOption, MobileThreadDetail, MobileThreadSummary } from "../shared/codex";
import {
  listModels,
  listPendingServerRequests,
  listThreads,
  readCodexStatus,
  readThread,
  resolveServerRequest,
  startThread,
  startTurn
} from "../lib/client-api";
import { applyCodexTimelineEvent } from "../lib/timeline-reducer";
import { createBrowserSocket } from "../lib/ws-client";
import { ApprovalSheet } from "./ApprovalSheet";
import { Composer } from "./Composer";
import { ConnectionBadge } from "./ConnectionBadge";
import { QuestionSheet } from "./QuestionSheet";

export function MobileWorkbench() {
  const [connected, setConnected] = useState(false);
  const [appServerStatus, setAppServerStatus] = useState<AppServerStatusView>({ state: "idle" });
  const [threads, setThreads] = useState<MobileThreadSummary[]>([]);
  const [selectedThread, setSelectedThread] = useState<MobileThreadDetail | null>(null);
  const [models, setModels] = useState<MobileModelOption[]>([]);
  const [pendingRequests, setPendingRequests] = useState<PendingServerRequestView[]>([]);
  const [loadError, setLoadError] = useState("");
  const [sending, setSending] = useState(false);

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
        if ((event as { type: string }).type === "codex-event") {
          const codexEvent = event as BrowserCodexEventEnvelope;
          if (codexEvent.event?.kind && codexEvent.event.threadId) {
            setSelectedThread((current) => {
              if (!current || current.id !== codexEvent.event?.threadId) {
                return current;
              }

              return applyCodexTimelineEvent(current, codexEvent.event);
            });
          }
        }
        if ((event as { type: string }).type === "server-request") {
          const serverRequestEvent = event as BrowserServerRequestEnvelope;
          setPendingRequests((current) => [
            serverRequestEvent.request,
            ...current.filter((request) => request.requestId !== serverRequestEvent.request.requestId)
          ]);
        }
        if ((event as { type: string }).type === "server-request-resolved") {
          const resolvedEvent = event as { requestId?: number };
          setPendingRequests((current) => current.filter((request) => request.requestId !== resolvedEvent.requestId));
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
        const requests = await listPendingServerRequests();
        const status = await readCodexStatus();

        if (!cancelled) {
          setAppServerStatus(status);
          setThreads(threadPage.threads);
          setModels(modelOptions);
          setPendingRequests(requests);
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

  async function handleSend(text: string) {
    if (!selectedThread) {
      setLoadError("请先选择一个会话");
      return;
    }

    setSending(true);
    setLoadError("");
    try {
      const thread = await startTurn({
        threadId: selectedThread.id,
        text,
        model: defaultModel?.id,
        reasoningEffort: defaultModel?.supportedReasoningEfforts.includes("medium") ? "medium" : undefined
      });
      setSelectedThread(thread);
      setThreads((current) =>
        current.map((summary) =>
          summary.id === thread.id
            ? {
                id: thread.id,
                title: thread.title,
                preview: thread.preview,
                cwd: thread.cwd,
                modelProvider: thread.modelProvider,
                status: thread.status,
                updatedAt: thread.updatedAt
              }
            : summary
        )
      );
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "无法发送消息");
      throw error;
    } finally {
      setSending(false);
    }
  }

  async function handleStartThread() {
    setSending(true);
    setLoadError("");
    try {
      const thread = await startThread({ model: defaultModel?.id });
      setSelectedThread(thread);
      setThreads((current) => [
        {
          id: thread.id,
          title: thread.title,
          preview: thread.preview,
          cwd: thread.cwd,
          modelProvider: thread.modelProvider,
          status: thread.status,
          updatedAt: thread.updatedAt
        },
        ...current.filter((summary) => summary.id !== thread.id)
      ]);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "无法新建会话");
    } finally {
      setSending(false);
    }
  }

  async function handleResolveRequest(request: PendingServerRequestView, value: string) {
    setLoadError("");
    try {
      await resolveServerRequest(request.requestId, buildPendingServerRequestResponse(request, value));
      setPendingRequests((current) => current.filter((item) => item.requestId !== request.requestId));
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "无法处理请求");
    }
  }

  const activeRequest = pendingRequests[0] || null;

  return (
    <main className="workbench">
      <header className="top-bar">
        <div>
          <p className="eyebrow">当前会话</p>
          <h1>{selectedThread?.title || threads[0]?.title || "新会话"}</h1>
        </div>
        <div className="status-stack">
          <button className="new-thread-button" type="button" aria-label="新会话" title="新会话" onClick={handleStartThread}>
            +
          </button>
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

      {activeRequest?.kind === "question" || activeRequest?.kind === "mcp_elicitation" ? (
        <QuestionSheet request={activeRequest} onResolve={handleResolveRequest} />
      ) : activeRequest ? (
        <ApprovalSheet request={activeRequest} onResolve={handleResolveRequest} />
      ) : null}

      <Composer disabled={!selectedThread} sending={sending} onSend={handleSend} />

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
