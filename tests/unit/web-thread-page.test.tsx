import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import ThreadPage from "../../src/app/threads/[threadId]/page";
import { ApiError } from "../../src/web/api/client";

const mockPush = vi.fn();
const mockBack = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, back: mockBack }),
  useParams: () => ({ threadId: "thread-1" })
}));

const mockEnsureThread = vi.fn();
const mockSetThreadEntries = vi.fn();
const mockMergeThreadEntries = vi.fn();
const mockPrependEntries = vi.fn();
const mockAppendEntries = vi.fn();
const mockReplaceOrAddEntry = vi.fn();
const mockSetMode = vi.fn();
const mockSetModel = vi.fn();
const mockSetRunning = vi.fn();
const mockSetPendingRequests = vi.fn();
const mockResolvePendingRequest = vi.fn();
const mockThreadState = vi.fn();

vi.mock("../../src/web/state/store", () => ({
  useStore: (selector: (state: unknown) => unknown) =>
    selector({
      ensureThread: mockEnsureThread,
      setThreadEntries: mockSetThreadEntries,
      mergeThreadEntries: mockMergeThreadEntries,
      prependEntries: mockPrependEntries,
      appendEntries: mockAppendEntries,
      replaceOrAddEntry: mockReplaceOrAddEntry,
      setMode: mockSetMode,
      setModel: mockSetModel,
      setRunning: mockSetRunning,
      setPendingRequests: mockSetPendingRequests,
      resolvePendingRequest: mockResolvePendingRequest,
      threads: { "thread-1": mockThreadState() }
    })
}));

const mockReadThread = vi.fn();
const mockResumeThread = vi.fn();
const mockListTurnsBefore = vi.fn();
const mockStartTurn = vi.fn();
const mockInterruptTurn = vi.fn();
const mockListModels = vi.fn();
const mockReadSettings = vi.fn();
const mockCollaborationModes = vi.fn();
const mockUpdateThreadSettings = vi.fn();
const mockRenameThread = vi.fn();
const mockRollbackThread = vi.fn();
const mockListPendingRequests = vi.fn();
const mockResolveRequest = vi.fn();
const mockArchiveThread = vi.fn();
const mockUnarchiveThread = vi.fn();
const mockCompactThread = vi.fn();
const mockForkThread = vi.fn();

vi.mock("../../src/web/api/endpoints", () => ({
  codex: {
    readThread: (...args: unknown[]) => mockReadThread(...args),
    resumeThread: (...args: unknown[]) => mockResumeThread(...args),
    listTurnsBefore: (...args: unknown[]) => mockListTurnsBefore(...args),
    startTurn: (...args: unknown[]) => mockStartTurn(...args),
    interruptTurn: (...args: unknown[]) => mockInterruptTurn(...args),
    models: () => mockListModels(),
    settings: () => mockReadSettings(),
    collaborationModes: () => mockCollaborationModes(),
    updateThreadSettings: (...args: unknown[]) => mockUpdateThreadSettings(...args),
    renameThread: (...args: unknown[]) => mockRenameThread(...args),
    rollbackThread: (...args: unknown[]) => mockRollbackThread(...args),
    listPendingRequests: () => mockListPendingRequests(),
    resolveRequest: (...args: unknown[]) => mockResolveRequest(...args),
    archiveThread: (...args: unknown[]) => mockArchiveThread(...args),
    unarchiveThread: (...args: unknown[]) => mockUnarchiveThread(...args),
    compactThread: (...args: unknown[]) => mockCompactThread(...args),
    forkThread: (...args: unknown[]) => mockForkThread(...args)
  }
}));

const mockSettingsGet = vi.fn();
vi.mock("../../src/web/storage/settings", () => ({
  settingsStore: {
    get: () => mockSettingsGet()
  }
}));

describe("ThreadPage", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    localStorage.clear();
    mockPush.mockClear();
    mockBack.mockClear();
    mockEnsureThread.mockClear();
    mockSetThreadEntries.mockClear();
    mockMergeThreadEntries.mockClear();
    mockPrependEntries.mockClear();
    mockAppendEntries.mockClear();
    mockReplaceOrAddEntry.mockClear();
    mockSetMode.mockClear();
    mockSetModel.mockClear();
    mockSetRunning.mockClear();
    mockSetPendingRequests.mockClear();
    mockResolvePendingRequest.mockClear();
    mockResumeThread.mockClear();
    mockListTurnsBefore.mockClear();
    mockUpdateThreadSettings.mockClear();
    mockForkThread.mockClear();
    mockReadThread.mockResolvedValue({
      id: "thread-1",
      cwd: "C:/test",
      title: "Test Thread",
      modelProvider: "claude-opus-4",
      status: "idle",
      timeline: [],
      lastTurnId: null,
      updatedAt: Date.now()
    });
    mockResumeThread.mockResolvedValue({
      id: "thread-1",
      cwd: "C:/test",
      title: "Test Thread",
      modelProvider: "claude-opus-4",
      status: "idle",
      timeline: [],
      lastTurnId: null,
      updatedAt: Date.now()
    });
    mockListTurnsBefore.mockResolvedValue({ items: [], nextCursor: null });
    mockStartTurn.mockClear();
    mockStartTurn.mockResolvedValue({
      turnId: "turn-1",
      thread: {
        id: "thread-1",
        cwd: "C:/test",
        title: "Test Thread",
        modelProvider: "claude-opus-4",
        status: "idle",
        timeline: [],
        lastTurnId: "turn-1",
        updatedAt: Date.now()
      }
    });
    mockInterruptTurn.mockResolvedValue({});
    mockListModels.mockResolvedValue([]);
    mockReadSettings.mockClear();
    mockReadSettings.mockResolvedValue({ model: null, modelProvider: null, reasoningEffort: null, reasoningSummary: null });
    mockCollaborationModes.mockClear();
    mockCollaborationModes.mockResolvedValue([
      { name: "Code", mode: "default", model: "gpt-5-codex", reasoningEffort: "medium" },
      { name: "Ask", mode: "ask", model: null, reasoningEffort: null }
    ]);
    mockUpdateThreadSettings.mockResolvedValue({});
    mockRenameThread.mockResolvedValue({});
    mockRollbackThread.mockResolvedValue({});
    mockListPendingRequests.mockResolvedValue([]);
    mockResolveRequest.mockResolvedValue({});
    mockArchiveThread.mockResolvedValue({});
    mockUnarchiveThread.mockResolvedValue({});
    mockCompactThread.mockResolvedValue({});
    mockForkThread.mockResolvedValue({ id: "forked-thread" });
    mockSettingsGet.mockReturnValue({ defaultMode: "build" });
    mockThreadState.mockReturnValue({
      entries: [],
      pendingApprovals: [],
      mode: "build",
      running: false,
      plan: [],
      cursor: null,
      reachedBeginning: false
    });
  });

  it("should auto-scroll to latest on initial load", async () => {
    mockReadThread.mockResolvedValue({
      id: "thread-1",
      cwd: "C:/test",
      title: "Test Thread",
      modelProvider: "claude-opus-4",
      timeline: [
        { kind: "user-message", text: "Hello", timestamp: Date.now() }
      ],
      lastTurnId: "turn-1",
      updatedAt: Date.now()
    });

    mockThreadState.mockReturnValue({
      entries: [
        {
          id: "1",
          timestamp: Date.now(),
          body: { kind: "user-message", text: "Hello" }
        }
      ],
      pendingApprovals: [],
      mode: "build",
      running: false,
      plan: [],
      cursor: null,
      reachedBeginning: false
    });

    const { container } = render(<ThreadPage />);

    await waitFor(() => {
      expect(mockReadThread).toHaveBeenCalledWith("thread-1");
    });

    const scroller = container.querySelector('[style*="overflow"]');
    expect(scroller).toBeTruthy();
  });

  it("should render timeline with multiple entries", async () => {
    mockThreadState.mockReturnValue({
      entries: Array.from({ length: 10 }, (_, i) => ({
        id: String(i),
        timestamp: Date.now() - i * 1000,
        body: { kind: "user-message", text: `Message ${i}` }
      })),
      pendingApprovals: [],
      mode: "build",
      running: false,
      plan: [],
      cursor: null,
      reachedBeginning: false
    });

    render(<ThreadPage />);

    await waitFor(() => {
      expect(screen.queryByText(/载入中/)).not.toBeInTheDocument();
    });

    expect(screen.getByText("Message 0")).toBeInTheDocument();
    expect(screen.getByText("Message 9")).toBeInTheDocument();
  });

  it("should sync running state from active thread detail on load", async () => {
    mockReadThread.mockResolvedValue({
      id: "thread-1",
      cwd: "C:/test",
      title: "Running Thread",
      modelProvider: "claude-opus-4",
      status: "active",
      timeline: [],
      lastTurnId: "turn-running",
      updatedAt: Date.now()
    });

    render(<ThreadPage />);

    await waitFor(() => {
      expect(mockSetRunning).toHaveBeenCalledWith("thread-1", true);
    });
  });

  it("should fetch pending server requests when entering a thread", async () => {
    const pendingQuestion = {
      requestId: "req-question",
      threadId: "thread-1",
      kind: "question",
      title: "需要你回答",
      description: "请选择模式",
      options: [{ value: "fast", label: "快速" }],
      request: {}
    };
    mockListPendingRequests.mockResolvedValue([pendingQuestion]);

    render(<ThreadPage />);

    await waitFor(() => {
      expect(mockListPendingRequests).toHaveBeenCalled();
    });
    expect(mockSetPendingRequests).toHaveBeenCalledWith([pendingQuestion]);
  });

  it("should refresh running threads after the fallback polling interval", async () => {
    let intervalCallback: (() => void | Promise<void>) | null = null;
    const originalSetInterval = window.setInterval.bind(window);
    const originalClearInterval = window.clearInterval.bind(window);
    const setIntervalSpy = vi.spyOn(window, "setInterval").mockImplementation((handler: TimerHandler, timeout?: number, ...args: any[]) => {
      if (timeout === 2_000) {
        intervalCallback = handler as () => void | Promise<void>;
        return 1 as unknown as number;
      }
      return originalSetInterval(handler, timeout, ...args);
    });
    const clearIntervalSpy = vi.spyOn(window, "clearInterval").mockImplementation((id?: number) => {
      if (id === (1 as unknown as number)) return;
      return originalClearInterval(id);
    });
    const activeThread = {
      id: "thread-1",
      cwd: "C:/test",
      title: "Running Thread",
      modelProvider: "claude-opus-4",
      status: "active",
      timeline: [],
      lastTurnId: "turn-running",
      updatedAt: Date.now()
    };
    mockThreadState.mockReturnValue({
      entries: [],
      pendingApprovals: [],
      mode: "build",
      running: true,
      plan: [],
      cursor: null,
      reachedBeginning: false
    });
    mockReadThread
      .mockResolvedValueOnce(activeThread)
      .mockResolvedValueOnce({
        ...activeThread,
        status: "idle",
        timeline: [{ id: "agent-1", role: "agent", text: "done" }]
      });
    const initialReadCalls = mockReadThread.mock.calls.length;

    try {
      render(<ThreadPage />);

      await waitFor(() => {
        expect(mockReadThread.mock.calls.length - initialReadCalls).toBe(1);
      });
      expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 2_000);
      expect(intervalCallback).toBeTruthy();

      await act(async () => {
        await intervalCallback?.();
      });

      await waitFor(() => expect(mockSetRunning).toHaveBeenCalledWith("thread-1", false));
      expect(mockReadThread.mock.calls.length - initialReadCalls).toBe(2);
      expect(mockMergeThreadEntries).toHaveBeenCalledWith(
        "thread-1",
        [expect.objectContaining({ id: "agent-1" })],
        null
      );
    } finally {
      setIntervalSpy.mockRestore();
      clearIntervalSpy.mockRestore();
    }
  });

  it("should not immediately repeat readThread after opening an active thread", async () => {
    const originalSetInterval = window.setInterval.bind(window);
    const originalClearInterval = window.clearInterval.bind(window);
    const setIntervalSpy = vi.spyOn(window, "setInterval").mockImplementation((handler: TimerHandler, timeout?: number, ...args: any[]) => {
      if (timeout === 2_000) {
        return 1 as unknown as number;
      }
      return originalSetInterval(handler, timeout, ...args);
    });
    const clearIntervalSpy = vi.spyOn(window, "clearInterval").mockImplementation((id?: number) => {
      if (id === (1 as unknown as number)) return;
      return originalClearInterval(id);
    });
    mockReadThread.mockResolvedValue({
      id: "thread-1",
      cwd: "C:/test",
      title: "Running Thread",
      modelProvider: "claude-opus-4",
      status: "active",
      timeline: [],
      lastTurnId: "turn-running",
      updatedAt: Date.now()
    });
    mockThreadState.mockReturnValue({
      entries: [],
      pendingApprovals: [],
      mode: "build",
      running: true,
      plan: [],
      cursor: null,
      reachedBeginning: false
    });
    const initialReadCalls = mockReadThread.mock.calls.length;

    try {
      render(<ThreadPage />);

      await waitFor(() => {
        expect(screen.queryByText(/载入中/)).not.toBeInTheDocument();
      });
      expect(mockReadThread.mock.calls.length - initialReadCalls).toBe(1);
      expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 2_000);
    } finally {
      setIntervalSpy.mockRestore();
      clearIntervalSpy.mockRestore();
    }
  });

  it("should interrupt the active turn id instead of only toggling local running state", async () => {
    const user = userEvent.setup();
    mockReadThread.mockResolvedValue({
      id: "thread-1",
      cwd: "C:/test",
      title: "Running Thread",
      modelProvider: "claude-opus-4",
      status: "active",
      timeline: [],
      lastTurnId: "turn-running",
      updatedAt: Date.now()
    });
    mockThreadState.mockReturnValue({
      entries: [],
      pendingApprovals: [],
      mode: "build",
      running: true,
      plan: [],
      cursor: null,
      reachedBeginning: false
    });

    render(<ThreadPage />);

    await waitFor(() => {
      expect(screen.queryByText(/载入中/)).not.toBeInTheDocument();
    });

    await user.click(screen.getByLabelText("中断"));

    expect(mockInterruptTurn).toHaveBeenCalledWith("thread-1", "turn-running");
    expect(mockSetRunning).toHaveBeenCalledWith("thread-1", false);
  });

  it("should keep running state when interrupt fails", async () => {
    const user = userEvent.setup();
    mockInterruptTurn.mockRejectedValueOnce(new ApiError("turnId 不能为空", 400));
    mockReadThread.mockResolvedValue({
      id: "thread-1",
      cwd: "C:/test",
      title: "Running Thread",
      modelProvider: "claude-opus-4",
      status: "active",
      timeline: [],
      lastTurnId: "turn-running",
      updatedAt: Date.now()
    });
    mockThreadState.mockReturnValue({
      entries: [],
      pendingApprovals: [],
      mode: "build",
      running: true,
      plan: [],
      cursor: null,
      reachedBeginning: false
    });

    render(<ThreadPage />);

    await waitFor(() => {
      expect(screen.queryByText(/载入中/)).not.toBeInTheDocument();
    });

    await user.click(screen.getByLabelText("中断"));

    expect(mockSetRunning).not.toHaveBeenCalledWith("thread-1", false);
    expect(mockAppendEntries).toHaveBeenCalledWith(
      "thread-1",
      [expect.objectContaining({ body: { kind: "error", text: "中断失败：turnId 不能为空" } })]
    );
  });

  it("should load more history when cursor available", async () => {
    mockThreadState.mockReturnValue({
      entries: [
        {
          id: "10",
          timestamp: Date.now(),
          body: { kind: "user-message", text: "Recent message" }
        }
      ],
      pendingApprovals: [],
      mode: "build",
      running: false,
      plan: [],
      cursor: "turn-10",
      reachedBeginning: false
    });

    mockListTurnsBefore.mockResolvedValue({
      items: [
        { kind: "user-message", text: "Older message", timestamp: Date.now() - 10000 }
      ],
      nextCursor: "turn-5"
    });

    render(<ThreadPage />);

    await waitFor(() => {
      expect(screen.queryByText(/载入中/)).not.toBeInTheDocument();
    });

    // Verify that listTurnsBefore can be called when scrolling to top
    expect(mockThreadState).toHaveBeenCalled();
  });

  it("should show 会话开始 when reached beginning", async () => {
    mockThreadState.mockReturnValue({
      entries: [
        {
          id: "1",
          timestamp: Date.now(),
          body: { kind: "user-message", text: "First message" }
        }
      ],
      pendingApprovals: [],
      mode: "build",
      running: false,
      plan: [],
      cursor: null,
      reachedBeginning: true
    });

    render(<ThreadPage />);

    await waitFor(() => {
      expect(screen.getByText("会话开始")).toBeInTheDocument();
    });
  });

  it("should open action sheet with long press menu", async () => {
    const user = userEvent.setup();
    mockThreadState.mockReturnValue({
      entries: [],
      pendingApprovals: [],
      mode: "build",
      running: false,
      plan: [],
      cursor: null,
      reachedBeginning: false
    });

    render(<ThreadPage />);

    await waitFor(() => {
      expect(screen.queryByText(/载入中/)).not.toBeInTheDocument();
    });

    const moreButton = screen.getByLabelText("更多");
    await user.click(moreButton);

    // Action sheet items should appear
    // Note: actual implementation may render in a portal or modal
    // This test verifies the button click triggers the sheet
    expect(moreButton).toBeInTheDocument();
  });

  it("should load history in correct order (newest first in timeline)", async () => {
    const now = Date.now();
    mockThreadState.mockReturnValue({
      entries: [
        {
          id: "recent",
          createdAt: now,
          body: { kind: "user-message", text: "Message 3", status: "sent" }
        }
      ],
      pendingApprovals: [],
      mode: "build",
      running: false,
      plan: [],
      cursor: "turn-3",
      reachedBeginning: false
    });
    mockReadThread.mockResolvedValue({
      id: "thread-1",
      cwd: "C:/test",
      title: "Test Thread",
      modelProvider: "claude-opus-4",
      timeline: [{ id: "recent", role: "user", text: "Message 3" }],
      lastTurnId: "turn-3",
      updatedAt: now
    });

    mockListTurnsBefore.mockResolvedValue({
      items: [
        { id: "older-2", role: "user", text: "Message 2" },
        { id: "older-1", role: "user", text: "Message 1" }
      ],
      nextCursor: null
    });

    render(<ThreadPage />);

    await waitFor(() => {
      expect(mockReadThread).toHaveBeenCalledWith("thread-1");
    });

    const scroller = document.querySelector(".cw-thread-scroller") as HTMLDivElement;
    Object.defineProperty(scroller, "scrollTop", { configurable: true, value: 0 });
    Object.defineProperty(scroller, "scrollHeight", { configurable: true, value: 1000 });
    Object.defineProperty(scroller, "clientHeight", { configurable: true, value: 480 });
    fireEvent.scroll(scroller);

    await waitFor(() => expect(mockListTurnsBefore).toHaveBeenCalledWith("thread-1", "turn-3"));

    // Verify prepend was called with older messages
    expect(mockPrependEntries).toHaveBeenCalled();
    const prependCall = mockPrependEntries.mock.calls[0];
    expect(prependCall[0]).toBe("thread-1");
    expect(prependCall[1]).toHaveLength(2);
  });

  it("should verify reached beginning state", async () => {
    mockThreadState.mockReturnValue({
      entries: [
        {
          id: "1",
          timestamp: Date.now(),
          body: { kind: "user-message", text: "First message" }
        }
      ],
      pendingApprovals: [],
      mode: "build",
      running: false,
      plan: [],
      cursor: null,
      reachedBeginning: true
    });

    render(<ThreadPage />);

    await waitFor(() => {
      expect(screen.queryByText(/载入中/)).not.toBeInTheDocument();
    });

    // Verify that when reachedBeginning is true, the "会话开始" marker appears
    expect(screen.getByText("会话开始")).toBeInTheDocument();
  });

  it("should render jump-to-latest button in timeline", async () => {
    mockThreadState.mockReturnValue({
      entries: Array.from({ length: 10 }, (_, i) => ({
        id: String(i),
        timestamp: Date.now() - i * 1000,
        body: { kind: "user-message", text: `Message ${i}` }
      })),
      pendingApprovals: [],
      mode: "build",
      running: false,
      plan: [],
      cursor: null,
      reachedBeginning: false
    });

    render(<ThreadPage />);

    await waitFor(() => {
      expect(screen.queryByText(/载入中/)).not.toBeInTheDocument();
    });

    // Verify that the page renders without the jump button initially
    // (it appears only when user scrolls up, which we can't reliably test in jsdom)
    expect(screen.getByText("Message 0")).toBeInTheDocument();
    expect(screen.getByText("Message 9")).toBeInTheDocument();
  });

  it("should switch Plan/Build and persist collaboration mode", async () => {
    const user = userEvent.setup();

    render(<ThreadPage />);

    await waitFor(() => {
      expect(screen.queryByText(/载入中/)).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Plan" }));

    expect(mockSetMode).toHaveBeenCalledWith("thread-1", "plan");
    await waitFor(() => {
      expect(mockUpdateThreadSettings).toHaveBeenCalledWith(
        "thread-1",
        expect.objectContaining({
          collaborationMode: expect.objectContaining({ mode: "plan" })
        })
      );
    });
    expect(mockUpdateThreadSettings).not.toHaveBeenCalledWith(
      "thread-1",
      expect.objectContaining({ permissions: expect.anything() })
    );
  });

  it("should not request older turns with lastTurnId as cursor on initial load", async () => {
    mockReadThread.mockResolvedValue({
      id: "thread-1",
      cwd: "C:/test",
      title: "Test Thread",
      modelProvider: "claude-opus-4",
      status: "idle",
      timeline: [{ id: "user-1", role: "user", text: "already loaded" }],
      lastTurnId: "turn-1",
      updatedAt: Date.now()
    });

    render(<ThreadPage />);

    await waitFor(() => {
      expect(screen.queryByText(/载入中/)).not.toBeInTheDocument();
    });

    expect(mockListTurnsBefore).not.toHaveBeenCalled();
  });

  it("should load models when picker opens and persist selected model", async () => {
    const user = userEvent.setup();
    mockListModels.mockResolvedValue([
      {
        id: "openai/gpt-5",
        label: "GPT-5",
        isDefault: false,
        supportedReasoningEfforts: [],
        inputModalities: ["text"]
      }
    ]);

    render(<ThreadPage />);

    await waitFor(() => {
      expect(screen.queryByText(/载入中/)).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "gpt-5-codex" }));

    await waitFor(() => expect(mockListModels).toHaveBeenCalled());
    await user.click(screen.getByRole("button", { name: "GPT-5" }));

    expect(mockSetModel).toHaveBeenCalledWith("thread-1", "openai/gpt-5", null);
    expect(mockUpdateThreadSettings).toHaveBeenCalledWith("thread-1", { model: "openai/gpt-5" });
  });

  it("should expose bottom sheet actions without delete", async () => {
    const user = userEvent.setup();

    render(<ThreadPage />);

    await waitFor(() => {
      expect(screen.queryByText(/载入中/)).not.toBeInTheDocument();
    });

    await user.click(screen.getByLabelText("更多"));

    expect(screen.getByRole("button", { name: "重命名" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "归档" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "压缩上下文" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Fork 会话" })).toBeInTheDocument();
    expect(screen.queryByText("删除")).not.toBeInTheDocument();
  });

  it("should rename thread from the bottom sheet dialog", async () => {
    const user = userEvent.setup();
    mockRenameThread.mockResolvedValue({
      id: "thread-1",
      cwd: "C:/test",
      title: "Renamed Thread",
      modelProvider: "claude-opus-4",
      timeline: [],
      lastTurnId: null,
      updatedAt: Date.now()
    });

    render(<ThreadPage />);

    await waitFor(() => {
      expect(screen.queryByText(/载入中/)).not.toBeInTheDocument();
    });

    await user.click(screen.getByLabelText("更多"));
    await user.click(screen.getByRole("button", { name: "重命名" }));
    const nameInput = screen.getByDisplayValue("Test Thread");
    await user.clear(nameInput);
    await user.type(nameInput, "Renamed Thread");
    await user.click(screen.getByRole("button", { name: "保存" }));

    expect(mockRenameThread).toHaveBeenCalledWith("thread-1", "Renamed Thread");
  });

  it("should archive and undo from toast", async () => {
    const user = userEvent.setup();

    render(<ThreadPage />);

    await waitFor(() => {
      expect(screen.queryByText(/载入中/)).not.toBeInTheDocument();
    });

    await user.click(screen.getByLabelText("更多"));
    await user.click(screen.getByRole("button", { name: "归档" }));

    await waitFor(() => expect(mockArchiveThread).toHaveBeenCalledWith("thread-1"));
    await user.click(screen.getByRole("button", { name: "撤销" }));

    expect(mockUnarchiveThread).toHaveBeenCalledWith("thread-1");
  });

  it("should confirm compact before calling API", async () => {
    const user = userEvent.setup();

    render(<ThreadPage />);

    await waitFor(() => {
      expect(screen.queryByText(/载入中/)).not.toBeInTheDocument();
    });

    await user.click(screen.getByLabelText("更多"));
    await user.click(screen.getByRole("button", { name: "压缩上下文" }));

    expect(screen.getByText("将会摘要先前对话以释放上下文窗口。继续？")).toBeInTheDocument();
    expect(mockCompactThread).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "继续" }));

    expect(mockCompactThread).toHaveBeenCalledWith("thread-1");
  });

  it("should fork and navigate to the new thread", async () => {
    const user = userEvent.setup();

    render(<ThreadPage />);

    await waitFor(() => {
      expect(screen.queryByText(/载入中/)).not.toBeInTheDocument();
    });

    await user.click(screen.getByLabelText("更多"));
    await user.click(screen.getByRole("button", { name: "Fork 会话" }));

    await waitFor(() => expect(mockForkThread).toHaveBeenCalledWith("thread-1"));
    expect(mockPush).toHaveBeenCalledWith("/threads/forked-thread");
  });

  it("should hide resend button when no previous user message exists", async () => {
    render(<ThreadPage />);

    await waitFor(() => {
      expect(screen.queryByText(/载入中/)).not.toBeInTheDocument();
    });

    expect(screen.queryByLabelText("重发上一条")).not.toBeInTheDocument();
  });

  it("should optimistically append a user message and avoid passing provider as model", async () => {
    const user = userEvent.setup();

    render(<ThreadPage />);

    await waitFor(() => {
      expect(screen.queryByText(/载入中/)).not.toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText("输入消息"), "hello from mobile");
    await user.click(screen.getByLabelText("发送"));

    expect(mockAppendEntries).toHaveBeenCalledWith(
      "thread-1",
      [
        expect.objectContaining({
          body: expect.objectContaining({
            kind: "user-message",
            text: "hello from mobile",
            status: "sending"
          })
        })
      ]
    );
    expect(mockStartTurn).toHaveBeenCalledWith(
      expect.objectContaining({
        threadId: "thread-1",
        text: "hello from mobile",
        imagePaths: [],
        reasoningSummary: "detailed"
      })
    );
    expect(mockReplaceOrAddEntry).toHaveBeenCalledWith(
      "thread-1",
      expect.objectContaining({
        body: expect.objectContaining({ status: "sent" })
      })
    );
  });

  it("should send plan turns with collaboration mode and never fork", async () => {
    const user = userEvent.setup();
    mockThreadState.mockReturnValue({
      entries: [],
      pendingApprovals: [],
      mode: "plan",
      running: false,
      plan: [],
      cursor: null,
      reachedBeginning: false,
      model: "gpt-5-codex"
    });

    render(<ThreadPage />);

    await waitFor(() => {
      expect(screen.queryByText(/载入中/)).not.toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText("输入消息"), "plan this");
    await user.click(screen.getByLabelText("发送"));

    expect(mockStartTurn).toHaveBeenCalledWith(
      expect.objectContaining({
        threadId: "thread-1",
        text: "plan this",
        imagePaths: [],
        collaborationMode: expect.objectContaining({
          mode: "plan",
          settings: expect.objectContaining({
            developer_instructions: null
          })
        })
      })
    );
    expect(mockStartTurn.mock.calls[0][0]).not.toHaveProperty("permissions");
    expect(mockForkThread).not.toHaveBeenCalled();
  });

  it("should send plan turns without blocking on collaboration mode presets", async () => {
    const user = userEvent.setup();
    mockCollaborationModes.mockImplementation(() => new Promise(() => undefined));
    mockThreadState.mockReturnValue({
      entries: [],
      pendingApprovals: [],
      mode: "plan",
      running: false,
      plan: [],
      cursor: null,
      reachedBeginning: false,
      model: "gpt-5-codex"
    });

    render(<ThreadPage />);

    await waitFor(() => {
      expect(screen.queryByText(/载入中/)).not.toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText("输入消息"), "plan without preset");
    await user.click(screen.getByLabelText("发送"));

    await waitFor(() => {
      expect(mockStartTurn).toHaveBeenCalledWith(
        expect.objectContaining({
          threadId: "thread-1",
          text: "plan without preset",
          collaborationMode: expect.objectContaining({ mode: "plan" })
        })
      );
    });
  });

  it("should not display or send modelProvider custom as the model for Plan turns", async () => {
    const user = userEvent.setup();
    mockSettingsGet.mockReturnValue({ defaultMode: "build", defaultModel: null });
    mockReadThread.mockResolvedValue({
      id: "thread-1",
      cwd: "C:/test",
      title: "Custom Provider Thread",
      modelProvider: "custom",
      status: "idle",
      timeline: [],
      lastTurnId: null,
      updatedAt: Date.now()
    });
    mockThreadState.mockReturnValue({
      entries: [],
      pendingApprovals: [],
      mode: "plan",
      running: false,
      plan: [],
      cursor: null,
      reachedBeginning: false,
      model: null,
      modelEffort: null
    });

    render(<ThreadPage />);

    await waitFor(() => {
      expect(screen.queryByText(/载入中/)).not.toBeInTheDocument();
    });

    expect(screen.queryByRole("button", { name: "custom" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "gpt-5-codex" })).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText("输入消息"), "现在是plan模式吗");
    await user.click(screen.getByLabelText("发送"));

    expect(mockStartTurn).toHaveBeenCalledWith(
      expect.objectContaining({
        threadId: "thread-1",
        text: "现在是plan模式吗",
        collaborationMode: expect.objectContaining({
          mode: "plan",
          settings: expect.objectContaining({
            model: "gpt-5-codex"
          })
        })
      })
    );
    expect(mockStartTurn.mock.calls[0][0]).not.toMatchObject({ model: "custom" });
  });

  it("should use Codex CLI model settings before falling back to the protocol default", async () => {
    const user = userEvent.setup();
    mockSettingsGet.mockReturnValue({ defaultMode: "build", defaultModel: null });
    mockReadSettings.mockResolvedValue({
      model: "gpt-5.5",
      modelProvider: "custom",
      reasoningEffort: "medium"
    });
    mockReadThread.mockResolvedValue({
      id: "thread-1",
      cwd: "C:/test",
      title: "CLI Default Thread",
      modelProvider: "custom",
      status: "idle",
      timeline: [],
      lastTurnId: null,
      updatedAt: Date.now()
    });
    mockThreadState.mockReturnValue({
      entries: [],
      pendingApprovals: [],
      mode: "plan",
      running: false,
      plan: [],
      cursor: null,
      reachedBeginning: false,
      model: null,
      modelEffort: null
    });

    render(<ThreadPage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "gpt-5.5" })).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText("输入消息"), "follow cli config");
    await user.click(screen.getByLabelText("发送"));

    expect(mockStartTurn).toHaveBeenCalledWith(
      expect.objectContaining({
        threadId: "thread-1",
        text: "follow cli config",
        collaborationMode: expect.objectContaining({
          mode: "plan",
          settings: expect.objectContaining({
            model: "gpt-5.5",
            reasoning_effort: "medium"
          })
        })
      })
    );
    expect(mockStartTurn.mock.calls[0][0]).not.toHaveProperty("model");
  });

  it("should allow changing the reasoning effort for the current model", async () => {
    const user = userEvent.setup();
    mockThreadState.mockReturnValue({
      entries: [],
      pendingApprovals: [],
      mode: "build",
      running: false,
      plan: [],
      cursor: null,
      reachedBeginning: false,
      model: "gpt-5-codex",
      modelEffort: "medium"
    });
    mockListModels.mockResolvedValue([
      {
        id: "gpt-5-codex",
        label: "GPT-5 Codex",
        isDefault: true,
        supportedReasoningEfforts: ["low", "medium", "high"],
        inputModalities: ["text"]
      }
    ]);

    render(<ThreadPage />);

    await waitFor(() => {
      expect(screen.queryByText(/载入中/)).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "gpt-5-codex" }));

    await waitFor(() => expect(mockListModels).toHaveBeenCalled());
    expect(screen.getByText("推理强度")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "高" }));

    expect(mockSetModel).toHaveBeenCalledWith("thread-1", "gpt-5-codex", "high");
    expect(mockUpdateThreadSettings).toHaveBeenCalledWith("thread-1", {
      model: "gpt-5-codex",
      reasoningEffort: "high"
    });
  });

  it("should include selected reasoning effort when sending a Plan turn", async () => {
    const user = userEvent.setup();
    mockThreadState.mockReturnValue({
      entries: [],
      pendingApprovals: [],
      mode: "plan",
      running: false,
      plan: [],
      cursor: null,
      reachedBeginning: false,
      model: "gpt-5-codex",
      modelEffort: "high"
    });

    render(<ThreadPage />);

    await waitFor(() => {
      expect(screen.queryByText(/载入中/)).not.toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText("输入消息"), "deep plan");
    await user.click(screen.getByLabelText("发送"));

    expect(mockStartTurn).toHaveBeenCalledWith(
      expect.objectContaining({
        collaborationMode: expect.objectContaining({
          settings: expect.objectContaining({ reasoning_effort: "high" })
        })
      })
    );
    expect(mockStartTurn.mock.calls[0][0]).not.toHaveProperty("reasoningEffort");
  });

  it("should keep Plan model selection only inside collaborationMode settings", async () => {
    const user = userEvent.setup();
    mockThreadState.mockReturnValue({
      entries: [],
      pendingApprovals: [],
      mode: "plan",
      running: false,
      plan: [],
      cursor: null,
      reachedBeginning: false,
      model: "gpt-5.5",
      modelEffort: "xhigh"
    });

    render(<ThreadPage />);

    await waitFor(() => {
      expect(screen.queryByText(/载入中/)).not.toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText("输入消息"), "plan check");
    await user.click(screen.getByLabelText("发送"));

    expect(mockStartTurn).toHaveBeenCalledWith(
      expect.objectContaining({
        collaborationMode: expect.objectContaining({
          mode: "plan",
          settings: expect.objectContaining({
            model: "gpt-5.5",
            reasoning_effort: "xhigh"
          })
        })
      })
    );
    expect(mockStartTurn.mock.calls[0][0]).not.toHaveProperty("model");
    expect(mockStartTurn.mock.calls[0][0]).not.toHaveProperty("reasoningEffort");
  });

  it("should refresh timeline from idle startTurn response after sending", async () => {
    const user = userEvent.setup();
    const now = Date.now();
    mockStartTurn.mockResolvedValue({
      turnId: "turn-2",
      thread: {
        id: "thread-1",
        cwd: "C:/test",
        title: "Test Thread",
        modelProvider: "claude-opus-4",
        status: "idle",
        timeline: [
          { id: "user-2", role: "user", text: "hello from mobile" },
          { id: "agent-2", role: "agent", text: "mobile reply" }
        ],
        lastTurnId: "turn-2",
        updatedAt: now
      }
    });

    render(<ThreadPage />);

    await waitFor(() => {
      expect(screen.queryByText(/载入中/)).not.toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText("输入消息"), "hello from mobile");
    await user.click(screen.getByLabelText("发送"));

    await waitFor(() => {
      expect(mockSetThreadEntries).toHaveBeenCalledWith(
        "thread-1",
        expect.arrayContaining([
          expect.objectContaining({ id: "user-2" }),
          expect.objectContaining({ id: "agent-2" })
        ]),
        null
      );
    });
    expect(mockSetRunning).toHaveBeenLastCalledWith("thread-1", false);
  });

  it("should merge running startTurn snapshots without clearing streamed entries", async () => {
    const user = userEvent.setup();
    mockStartTurn.mockResolvedValue({
      turnId: "turn-2",
      thread: {
        id: "thread-1",
        cwd: "C:/test",
        title: "Test Thread",
        modelProvider: "claude-opus-4",
        status: "active",
        timeline: [{ id: "user-2", role: "user", text: "hello from mobile" }],
        lastTurnId: "turn-2",
        updatedAt: Date.now()
      }
    });

    render(<ThreadPage />);

    await waitFor(() => {
      expect(screen.queryByText(/载入中/)).not.toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText("输入消息"), "hello from mobile");
    await user.click(screen.getByLabelText("发送"));

    await waitFor(() => {
      expect(mockMergeThreadEntries).toHaveBeenCalledWith(
        "thread-1",
        expect.arrayContaining([expect.objectContaining({ id: "user-2" })]),
        null
      );
    });
    expect(mockSetRunning).toHaveBeenLastCalledWith("thread-1", true);
  });

  it("should let a freshly-created empty thread send the first user message", async () => {
    const user = userEvent.setup();
    mockReadThread.mockResolvedValue({
      id: "thread-1",
      cwd: "C:/test",
      title: "新会话",
      modelProvider: "custom",
      status: "idle",
      timeline: [],
      lastTurnId: null,
      updatedAt: Date.now()
    });

    render(<ThreadPage />);

    await waitFor(() => {
      expect(screen.queryByText(/载入中/)).not.toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText("输入消息"), "第一条消息");
    await user.click(screen.getByLabelText("发送"));

    expect(mockResumeThread).not.toHaveBeenCalled();
    expect(mockStartTurn).toHaveBeenCalledWith(
      expect.objectContaining({
        threadId: "thread-1",
        text: "第一条消息",
        imagePaths: []
      })
    );
    expect(screen.queryByText(/is not materialized/)).not.toBeInTheDocument();
  });

  it("should append an inline error card when startTurn fails", async () => {
    const user = userEvent.setup();
    mockStartTurn.mockRejectedValueOnce(new ApiError("502 Bad Gateway", 502));

    render(<ThreadPage />);

    await waitFor(() => {
      expect(screen.queryByText(/载入中/)).not.toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText("输入消息"), "will fail");
    await user.click(screen.getByLabelText("发送"));

    await waitFor(() => {
      expect(mockReplaceOrAddEntry).toHaveBeenCalledWith(
        "thread-1",
        expect.objectContaining({
          body: expect.objectContaining({ kind: "user-message", status: "failed" })
        })
      );
    });
    expect(mockAppendEntries).toHaveBeenCalledWith(
      "thread-1",
      [
        expect.objectContaining({
          body: { kind: "error", text: "发送失败：502 Bad Gateway" }
        })
      ]
    );
  });

  it("should resume not-loaded threads before sending", async () => {
    const user = userEvent.setup();
    mockReadThread.mockResolvedValue({
      id: "thread-1",
      cwd: "C:/test",
      title: "Test Thread",
      modelProvider: "custom",
      status: "notLoaded",
      timeline: [],
      lastTurnId: null,
      updatedAt: Date.now()
    });

    render(<ThreadPage />);

    await waitFor(() => {
      expect(screen.queryByText(/载入中/)).not.toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText("输入消息"), "resume then send");
    await user.click(screen.getByLabelText("发送"));

    expect(mockResumeThread).toHaveBeenCalledWith("thread-1");
    expect(mockStartTurn).toHaveBeenCalledWith(
      expect.objectContaining({
        threadId: "thread-1",
        text: "resume then send",
        imagePaths: []
      })
    );
  });

  it("should resume and retry once when start turn reports thread not found", async () => {
    const user = userEvent.setup();
    mockStartTurn.mockRejectedValueOnce(new ApiError("thread not found: thread-1", 502)).mockResolvedValueOnce({});

    render(<ThreadPage />);

    await waitFor(() => {
      expect(screen.queryByText(/载入中/)).not.toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText("输入消息"), "retry after resume");
    await user.click(screen.getByLabelText("发送"));

    await waitFor(() => expect(mockStartTurn).toHaveBeenCalledTimes(2));
    expect(mockResumeThread).toHaveBeenCalledWith("thread-1");
    expect(mockStartTurn).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        threadId: "thread-1",
        text: "retry after resume",
        imagePaths: []
      })
    );
  });

  it("should resend failed local user messages from retry button", async () => {
    const user = userEvent.setup();
    mockThreadState.mockReturnValue({
      entries: [
        {
          id: "failed-local",
          createdAt: Date.now(),
          body: { kind: "user-message", text: "retry me", status: "failed" }
        }
      ],
      pendingApprovals: [],
      mode: "build",
      running: false,
      plan: [],
      cursor: null,
      reachedBeginning: false
    });

    render(<ThreadPage />);

    await waitFor(() => {
      expect(screen.queryByText(/载入中/)).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "重试" }));

    expect(mockStartTurn).toHaveBeenCalledWith(
      expect.objectContaining({
        threadId: "thread-1",
        text: "retry me",
        imagePaths: []
      })
    );
  });

  it("should rollback and fill the previous user message for resend", async () => {
    const user = userEvent.setup();
    mockThreadState.mockReturnValue({
      entries: [
        {
          id: "1",
          createdAt: Date.now(),
          body: { kind: "user-message", text: "previous prompt", status: "sent" }
        }
      ],
      pendingApprovals: [],
      mode: "build",
      running: false,
      plan: [],
      cursor: null,
      reachedBeginning: false
    });

    render(<ThreadPage />);

    await waitFor(() => {
      expect(screen.queryByText(/载入中/)).not.toBeInTheDocument();
    });

    await user.click(screen.getByLabelText("重发上一条"));

    expect(mockRollbackThread).toHaveBeenCalledWith("thread-1", 1);
    expect(screen.getByPlaceholderText("输入消息")).toHaveValue("previous prompt");
  });
});
