"use client";

import { useEffect, useRef, useState } from "react";
import type { BrowserCodexEventEnvelope } from "../server/app-server/events";
import {
  buildPendingServerRequestResponse,
  type BrowserServerRequestEnvelope,
  type PendingServerRequestView
} from "../server/app-server/pending-requests";
import type { AppServerStatusView, MobileModelOption, MobileThreadDetail, MobileThreadSummary } from "../shared/codex";
import {
  archiveThread,
  deleteThread,
  forkThread,
  interruptTurn,
  listModels,
  listPendingServerRequests,
  listThreads,
  readCodexStatus,
  readThread,
  resumeThread,
  renameThread,
  resolveServerRequest,
  rollbackThread,
  steerTurn,
  startThread,
  startTurn,
  updateThreadSettings
} from "../lib/client-api";
import { applyCodexTimelineEvent } from "../lib/timeline-reducer";
import { appendPendingUserMessage } from "../lib/thread-state";
import { createReconnectingBrowserSocket } from "../lib/ws-client";
import { ApprovalSheet } from "./ApprovalSheet";
import { Composer } from "./Composer";
import { ConnectionBadge } from "./ConnectionBadge";
import { DiffPanel } from "./DiffPanel";
import { DynamicToolSheet } from "./DynamicToolSheet";
import { FilesPanel } from "./FilesPanel";
import { QuestionSheet } from "./QuestionSheet";
import { SettingsPanel } from "./SettingsPanel";
import { TerminalPanel } from "./TerminalPanel";
import { TurnActionsSheet } from "./TurnActionsSheet";

type ActivePanel = "chats" | "run" | "files" | "terminal" | "settings";

export function MobileWorkbench() {
  const [connected, setConnected] = useState(false);
  const [appServerStatus, setAppServerStatus] = useState<AppServerStatusView>({ state: "idle" });
  const [threads, setThreads] = useState<MobileThreadSummary[]>([]);
  const [selectedThread, setSelectedThread] = useState<MobileThreadDetail | null>(null);
  const [models, setModels] = useState<MobileModelOption[]>([]);
  const [pendingRequests, setPendingRequests] = useState<PendingServerRequestView[]>([]);
  const [loadError, setLoadError] = useState("");
  const [sending, setSending] = useState(false);
  const [activePanel, setActivePanel] = useState<ActivePanel>("chats");
  const [rollbackNoticeVisible, setRollbackNoticeVisible] = useState(false);
  const [selectedModelId, setSelectedModelId] = useState("");
  const [selectedReasoningEffort, setSelectedReasoningEffort] = useState("");
  const [selectedPermissions, setSelectedPermissions] = useState("default");
  const [threadSearchTerm, setThreadSearchTerm] = useState("");
  const [searchingThreads, setSearchingThreads] = useState(false);
  const selectedThreadIdRef = useRef<string | null>(null);
  const threadSearchRequestIdRef = useRef(0);

  const defaultModel = models.find((model) => model.isDefault) || models[0] || null;
  const selectedModel = models.find((model) => model.id === selectedModelId) || defaultModel;

  useEffect(() => {
    selectedThreadIdRef.current = selectedThread?.id || null;
  }, [selectedThread?.id]);

  useEffect(() => {
    if (!selectedModelId && defaultModel) {
      setSelectedModelId(defaultModel.id);
    }
  }, [defaultModel, selectedModelId]);

  useEffect(() => {
    if (!selectedModel) {
      return;
    }

    if (!selectedModel.supportedReasoningEfforts.includes(selectedReasoningEffort)) {
      setSelectedReasoningEffort(
        selectedModel.supportedReasoningEfforts.includes("medium")
          ? "medium"
          : selectedModel.supportedReasoningEfforts[0] || ""
      );
    }
  }, [selectedModel, selectedReasoningEffort]);

  useEffect(() => {
    const socket = createReconnectingBrowserSocket({
      onMessage: (event) => {
        if (typeof event === "object" && event && "type" in event) {
          if ((event as { type: string }).type === "hello") {
            setConnected(true);
            const threadId = selectedThreadIdRef.current;
            if (threadId) {
              resumeThread(threadId)
                .then((thread) => setSelectedThread(thread))
                .catch(() => undefined);
            }
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
          if (serverRequestEvent.request.kind === "dynamic_tool") {
            setSelectedThread((current) => {
              if (!current || current.id !== serverRequestEvent.request.threadId) {
                return current;
              }

              const itemId = `request-${serverRequestEvent.request.requestId}`;
              if (current.timeline.some((item) => item.id === itemId)) {
                return current;
              }

              return {
                ...current,
                timeline: [
                  ...current.timeline,
                  {
                    id: itemId,
                    role: "tool",
                    text: `工具调用：${serverRequestEvent.request.description.split("\n")[0]}`
                  }
                ]
              };
            });
          }
        }
        if ((event as { type: string }).type === "server-request-resolved") {
          const resolvedEvent = event as { requestId?: number };
          setPendingRequests((current) => current.filter((request) => request.requestId !== resolvedEvent.requestId));
        }
      }
      },
      onClose: () => setConnected(false)
    });

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
          const thread = await resumeThread(threadPage.threads[0].id);
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
      setSelectedThread(await resumeThread(threadId));
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "无法读取会话内容");
    }
  }

  async function persistThreadSettings(nextSettings: {
    model?: string;
    reasoningEffort?: string;
    permissions?: string;
  }) {
    if (!selectedThread) {
      return;
    }

    setLoadError("");
    try {
      await updateThreadSettings({
        threadId: selectedThread.id,
        ...nextSettings
      });
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "无法更新会话设置");
    }
  }

  function handleModelChange(modelId: string) {
    setSelectedModelId(modelId);
    void persistThreadSettings({ model: modelId });
  }

  function handleReasoningEffortChange(reasoningEffort: string) {
    setSelectedReasoningEffort(reasoningEffort);
    void persistThreadSettings({ reasoningEffort });
  }

  function handlePermissionsChange(permissions: string) {
    setSelectedPermissions(permissions);
    void persistThreadSettings({ permissions });
  }

  async function handleSearchThreads(searchTerm: string) {
    setThreadSearchTerm(searchTerm);
    setSearchingThreads(true);
    setLoadError("");
    const requestId = ++threadSearchRequestIdRef.current;

    try {
      const page = await listThreads(searchTerm);
      if (threadSearchRequestIdRef.current === requestId) {
        setThreads(page.threads);
      }
    } catch (error) {
      if (threadSearchRequestIdRef.current === requestId) {
        setLoadError(error instanceof Error ? error.message : "无法搜索会话历史");
      }
    } finally {
      if (threadSearchRequestIdRef.current === requestId) {
        setSearchingThreads(false);
      }
    }
  }

  async function handleSend(text: string, imagePaths: string[] = []) {
    if (!selectedThread) {
      setLoadError("请先选择一个会话");
      return;
    }

    setSending(true);
    setLoadError("");
    const pendingClientId = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now());
    setSelectedThread((current) =>
      current && current.id === selectedThread.id
        ? appendPendingUserMessage(current, text, imagePaths.length, pendingClientId)
        : current
    );
    try {
      const thread = await startTurn({
        threadId: selectedThread.id,
        text,
        imagePaths,
        model: selectedModel?.id,
        reasoningEffort: selectedReasoningEffort || undefined,
        permissions: selectedPermissions
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
      setSelectedThread(selectedThread);
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
      const thread = await startThread({ model: selectedModel?.id, permissions: selectedPermissions });
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

  function upsertThreadSummary(thread: MobileThreadDetail) {
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
  }

  async function refreshThreadsAfterRemoval() {
    const page = await listThreads(threadSearchTerm);
    setThreads(page.threads);
    if (page.threads[0]) {
      setSelectedThread(await resumeThread(page.threads[0].id));
      return;
    }

    setSelectedThread(null);
  }

  async function handleForkThread() {
    if (!selectedThread) {
      return;
    }

    setSending(true);
    setLoadError("");
    try {
      const thread = await forkThread(selectedThread.id);
      setSelectedThread(thread);
      upsertThreadSummary(thread);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "无法 fork 会话");
    } finally {
      setSending(false);
    }
  }

  async function handleRenameThread(name: string) {
    if (!selectedThread) {
      return;
    }

    setSending(true);
    setLoadError("");
    try {
      const thread = await renameThread(selectedThread.id, name);
      setSelectedThread(thread);
      upsertThreadSummary(thread);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "无法重命名会话");
    } finally {
      setSending(false);
    }
  }

  async function handleArchiveThread() {
    if (!selectedThread) {
      return;
    }

    setSending(true);
    setLoadError("");
    try {
      await archiveThread(selectedThread.id);
      await refreshThreadsAfterRemoval();
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "无法归档会话");
    } finally {
      setSending(false);
    }
  }

  async function handleDeleteThread() {
    if (!selectedThread) {
      return;
    }

    setSending(true);
    setLoadError("");
    try {
      await deleteThread(selectedThread.id);
      await refreshThreadsAfterRemoval();
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "无法删除会话");
    } finally {
      setSending(false);
    }
  }

  async function handleEditResend(text: string) {
    if (!selectedThread) {
      return;
    }

    setSending(true);
    setLoadError("");
    try {
      await rollbackThread(selectedThread.id, 1);
      const thread = await startTurn({
        threadId: selectedThread.id,
        text,
        model: selectedModel?.id,
        reasoningEffort: selectedReasoningEffort || undefined,
        permissions: selectedPermissions
      });
      setSelectedThread(thread);
      upsertThreadSummary(thread);
      setRollbackNoticeVisible(true);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "无法编辑重发");
    } finally {
      setSending(false);
    }
  }

  async function handleInterruptTurn() {
    if (!selectedThread?.lastTurnId) {
      return;
    }

    setSending(true);
    setLoadError("");
    try {
      await interruptTurn(selectedThread.id, selectedThread.lastTurnId);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "无法 interrupt turn");
    } finally {
      setSending(false);
    }
  }

  async function handleSteerTurn(text: string) {
    if (!selectedThread?.lastTurnId) {
      return;
    }

    setSending(true);
    setLoadError("");
    try {
      const thread = await steerTurn({
        threadId: selectedThread.id,
        expectedTurnId: selectedThread.lastTurnId,
        text
      });
      setSelectedThread(thread);
      upsertThreadSummary(thread);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "无法追加指令");
    } finally {
      setSending(false);
    }
  }

  const activeRequest = pendingRequests[0] || null;

  return (
    <main className="workbench">
      <header className="top-bar">
        <div>
          <p className="eyebrow">当前会话</p>
          <h1>{selectedThread?.title || threads[0]?.title || "新会话"}</h1>
          {selectedThread ? (
            <p className="thread-status-line">
              {[selectedThread.modelProvider, selectedThread.status, selectedThread.tokenUsageTotal ? `Tokens ${selectedThread.tokenUsageTotal}` : null]
                .filter(Boolean)
                .join(" · ")}
            </p>
          ) : null}
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
        {activePanel === "chats" ? (
          <>
            <div className="model-strip">
              <span>{selectedModel?.label || "模型加载中"}</span>
              <span>{selectedReasoningEffort || "reasoning"} · {selectedPermissions}</span>
            </div>

            {loadError ? <p className="form-error">{loadError}</p> : null}
            {rollbackNoticeVisible ? (
              <div className="inline-notice">
                <span>已回滚上一轮变更</span>
                <button
                  type="button"
                  onClick={() => {
                    setRollbackNoticeVisible(false);
                    setActivePanel("run");
                  }}
                >
                  查看 Diff
                </button>
              </div>
            ) : null}

            <section className="thread-list" aria-label="会话历史">
              <div className="section-title">
                <h2>历史会话</h2>
                <span>{searchingThreads ? "搜索中" : threads.length}</span>
              </div>
              <input
                className="thread-search-input"
                type="search"
                aria-label="搜索历史会话"
                placeholder="搜索历史会话"
                value={threadSearchTerm}
                onChange={(event) => void handleSearchThreads(event.target.value)}
              />
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
                  <h2>{threadSearchTerm.trim() ? "没有匹配的会话" : "新会话"}</h2>
                  <p>{threadSearchTerm.trim() ? threadSearchTerm.trim() : "Codex"}</p>
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
          </>
        ) : null}

        {activePanel === "run" && selectedThread ? <DiffPanel timeline={selectedThread.timeline} /> : null}
        {activePanel === "files" && selectedThread ? <FilesPanel rootPath={selectedThread.cwd} /> : null}
        {activePanel === "terminal" && selectedThread ? <TerminalPanel cwd={selectedThread.cwd} /> : null}
        {activePanel === "settings" ? (
          <SettingsPanel
            models={models}
            selectedModelId={selectedModel?.id || ""}
            selectedReasoningEffort={selectedReasoningEffort}
            selectedPermissions={selectedPermissions}
            onModelChange={handleModelChange}
            onReasoningEffortChange={handleReasoningEffortChange}
            onPermissionsChange={handlePermissionsChange}
          />
        ) : null}
      </section>

      {activeRequest?.kind === "dynamic_tool" ? (
        <DynamicToolSheet request={activeRequest} onResolve={handleResolveRequest} />
      ) : activeRequest?.kind === "question" || activeRequest?.kind === "mcp_elicitation" ? (
        <QuestionSheet request={activeRequest} onResolve={handleResolveRequest} />
      ) : activeRequest ? (
        <ApprovalSheet request={activeRequest} onResolve={handleResolveRequest} />
      ) : null}

      {activePanel === "chats" && selectedThread ? (
        <TurnActionsSheet
          thread={selectedThread}
          busy={sending}
          onFork={handleForkThread}
          onRename={handleRenameThread}
          onArchive={handleArchiveThread}
          onDelete={handleDeleteThread}
          onEditResend={handleEditResend}
          onInterrupt={handleInterruptTurn}
          onSteer={handleSteerTurn}
        />
      ) : null}

      {activePanel === "chats" ? <Composer disabled={!selectedThread} sending={sending} onSend={handleSend} /> : null}

      <nav className="bottom-nav" aria-label="移动端导航">
        <button type="button" className={activePanel === "chats" ? "active" : ""} onClick={() => setActivePanel("chats")}>
          Chats
        </button>
        <button type="button" className={activePanel === "run" ? "active" : ""} onClick={() => setActivePanel("run")}>
          Run
        </button>
        <button type="button" className={activePanel === "files" ? "active" : ""} onClick={() => setActivePanel("files")}>
          Files
        </button>
        <button type="button" className={activePanel === "terminal" ? "active" : ""} onClick={() => setActivePanel("terminal")}>
          Terminal
        </button>
        <button type="button" className={activePanel === "settings" ? "active" : ""} onClick={() => setActivePanel("settings")}>
          Settings
        </button>
      </nav>
    </main>
  );
}
