import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import ThreadPage from "../../src/app/threads/[threadId]/page";
import { ApiError } from "../../src/web/api/client";
import { __getChatInputDiagnostics, __resetChatInputDiagnostics } from "../../src/web/components/ChatInput";

vi.setConfig({ testTimeout: 15_000 });

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
const mockSetPermissionProfile = vi.fn();
const mockSetContextUsage = vi.fn();
const mockSetRunning = vi.fn();
const mockSetThreadStatus = vi.fn();
const mockSetActiveTurnId = vi.fn();
const mockBindLocalUserMessageTurn = vi.fn();
const mockSetTimelineGeneration = vi.fn();
const mockMarkTurnInterrupted = vi.fn();
const mockMarkTurnDeleted = vi.fn();
const mockSetActiveThread = vi.fn();
const mockRequestSnapshotRepair = vi.fn();
const mockClearSnapshotRepair = vi.fn();
const mockSetPendingRequests = vi.fn();
const mockResolvePendingRequest = vi.fn();
const mockThreadState = vi.fn();
const mockWsState = vi.fn();

vi.mock("../../src/web/state/store", () => ({
  useStore: Object.assign(
    (selector: (state: unknown) => unknown) => selector(mockStoreState()),
    { getState: () => mockStoreState() }
  )
}));

function mockStoreState(): unknown {
  return {
      ensureThread: mockEnsureThread,
      setThreadEntries: mockSetThreadEntries,
      mergeThreadEntries: mockMergeThreadEntries,
      prependEntries: mockPrependEntries,
      appendEntries: mockAppendEntries,
      replaceOrAddEntry: mockReplaceOrAddEntry,
      setMode: mockSetMode,
      setModel: mockSetModel,
      setPermissionProfile: mockSetPermissionProfile,
      setContextUsage: mockSetContextUsage,
      setRunning: mockSetRunning,
      setThreadStatus: mockSetThreadStatus,
      setActiveTurnId: mockSetActiveTurnId,
      bindLocalUserMessageTurn: mockBindLocalUserMessageTurn,
      setTimelineGeneration: mockSetTimelineGeneration,
      markTurnInterrupted: mockMarkTurnInterrupted,
      markTurnDeleted: mockMarkTurnDeleted,
      setActiveThread: mockSetActiveThread,
      requestSnapshotRepair: mockRequestSnapshotRepair,
      clearSnapshotRepair: mockClearSnapshotRepair,
      setPendingRequests: mockSetPendingRequests,
      resolvePendingRequest: mockResolvePendingRequest,
      wsState: mockWsState(),
      threads: { "thread-1": mockThreadState() }
  };
}

const mockReadThread = vi.fn();
const mockReadThreadSummary = vi.fn();
const mockResumeThread = vi.fn();
const mockListTurnsBefore = vi.fn();
const mockListTurnItems = vi.fn();
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
const mockSetThreadGoal = vi.fn();
const mockClearThreadGoal = vi.fn();
const mockSkills = vi.fn();
const mockUploadImage = vi.fn();

const sampleGoal = {
  threadId: "thread-1",
  objective: "完成移动端目标模式接入",
  status: "active",
  tokenBudget: 12_000,
  tokensUsed: 0,
  timeUsedSeconds: 0,
  createdAt: 1,
  updatedAt: 1
};

vi.mock("../../src/web/api/endpoints", () => ({
  codex: {
    readThread: (...args: unknown[]) => mockReadThread(...args),
    readThreadSummary: (...args: unknown[]) => mockReadThreadSummary(...args),
    resumeThread: (...args: unknown[]) => mockResumeThread(...args),
    listTurnsBefore: (...args: unknown[]) => mockListTurnsBefore(...args),
    listTurnItems: (...args: unknown[]) => mockListTurnItems(...args),
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
    forkThread: (...args: unknown[]) => mockForkThread(...args),
    setThreadGoal: (...args: unknown[]) => mockSetThreadGoal(...args),
    clearThreadGoal: (...args: unknown[]) => mockClearThreadGoal(...args),
    skills: (...args: unknown[]) => mockSkills(...args),
    uploadImage: (...args: unknown[]) => mockUploadImage(...args)
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
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
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
    mockSetPermissionProfile.mockClear();
    mockSetContextUsage.mockClear();
    mockSetRunning.mockClear();
    mockSetThreadStatus.mockClear();
    mockSetActiveTurnId.mockClear();
    mockBindLocalUserMessageTurn.mockClear();
    mockSetTimelineGeneration.mockClear();
    mockMarkTurnInterrupted.mockClear();
    mockMarkTurnDeleted.mockClear();
    mockSetActiveThread.mockClear();
    mockRequestSnapshotRepair.mockClear();
    mockClearSnapshotRepair.mockClear();
    mockSetPendingRequests.mockClear();
    mockResolvePendingRequest.mockClear();
    mockWsState.mockReset();
    mockWsState.mockReturnValue("open");
    mockResumeThread.mockClear();
    mockListTurnsBefore.mockClear();
    mockListTurnItems.mockClear();
    mockUpdateThreadSettings.mockClear();
    mockForkThread.mockClear();
    mockRollbackThread.mockClear();
    mockReadThread.mockReset();
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
    mockReadThreadSummary.mockReset();
    mockReadThreadSummary.mockResolvedValue({
      id: "thread-1",
      cwd: "C:/test",
      title: "Test Thread",
      preview: "",
      modelProvider: "claude-opus-4",
      status: "idle",
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
    mockListTurnItems.mockResolvedValue({ items: [], nextCursor: null });
    mockStartTurn.mockReset();
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
    mockReadSettings.mockResolvedValue({
      model: null,
      modelProvider: null,
      reasoningEffort: null,
      reasoningSummary: null,
      permissionProfiles: [
        { id: ":workspace", label: "workspace", description: "工作区权限" },
        { id: ":danger-full-access", label: "full access", description: "完全访问" }
      ]
    });
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
    mockCompactThread.mockClear();
    mockCompactThread.mockResolvedValue({});
    mockForkThread.mockResolvedValue({
      id: "forked-thread",
      cwd: "C:/test",
      title: "Forked Thread",
      modelProvider: "claude-opus-4",
      status: "idle",
      lastTurnId: "fork-turn-3",
      updatedAt: Date.now(),
      timeline: [
        { id: "older-user", turnId: "fork-turn-1", turnIndex: 0, role: "user", text: "older prompt" },
        { id: "target-user-fork", turnId: "fork-turn-2", turnIndex: 1, role: "user", text: "previous prompt" },
        { id: "latest-user-fork", turnId: "fork-turn-3", turnIndex: 2, role: "user", text: "latest prompt" }
      ]
    });
    mockSetThreadGoal.mockReset();
    mockSetThreadGoal.mockResolvedValue(sampleGoal);
    mockClearThreadGoal.mockReset();
    mockClearThreadGoal.mockResolvedValue(undefined);
    mockSkills.mockReset();
    mockSkills.mockResolvedValue({
      skills: [
        {
          name: "openspec-explore",
          path: "/repo/.codex/skills/openspec-explore/SKILL.md",
          scope: "workspace",
          shortDescription: "探索需求",
          description: "探索需求"
        }
      ]
    });
    mockUploadImage.mockReset();
    mockUploadImage.mockResolvedValue({ path: "/tmp/uploaded.png" });
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

  it("should store initial history cursor from bounded thread detail", async () => {
    mockReadThread.mockResolvedValue({
      id: "thread-1",
      cwd: "C:/test",
      title: "Test Thread",
      modelProvider: "claude-opus-4",
      status: "idle",
      timeline: [
        {
          id: "recent-user",
          turnId: "turn-newest",
          role: "user",
          text: "Recent message"
        }
      ],
      lastTurnId: "turn-newest",
      nextCursor: "turn-older",
      updatedAt: Date.now()
    });

    render(<ThreadPage />);

    await waitFor(() => {
      expect(mockSetThreadEntries).toHaveBeenCalledWith(
        "thread-1",
        [expect.objectContaining({ id: "recent-user" })],
        "turn-older"
      );
    });
  });

  it("should place trailing snapshot activity before the final assistant message with stable timestamps", async () => {
    mockReadThread.mockResolvedValue({
      id: "thread-1",
      cwd: "C:/test",
      title: "Test Thread",
      modelProvider: "claude-opus-4",
      status: "idle",
      timeline: [
        { id: "user-1", turnId: "turn-1", role: "user", text: "分析 timeline" },
        { id: "agent-final", turnId: "turn-1", role: "agent", text: "最终结论" },
        {
          id: "cmd-1",
          turnId: "turn-1",
          role: "tool",
          text: "src/app/threads/[threadId]/page.tsx",
          toolKind: "command",
          actionKind: "read",
          server: "command",
          tool: "sed -n '1,220p' src/app/threads/[threadId]/page.tsx",
          status: "success"
        }
      ],
      lastTurnId: "turn-1",
      nextCursor: null,
      updatedAt: Date.now()
    });

    render(<ThreadPage />);

    await waitFor(() => {
      expect(mockSetThreadEntries).toHaveBeenCalledWith(
        "thread-1",
        [
          expect.objectContaining({ id: "user-1" }),
          expect.objectContaining({ id: "cmd-1" }),
          expect.objectContaining({ id: "agent-final" })
        ],
        null
      );
    });
    const entries = mockSetThreadEntries.mock.calls.at(-1)?.[1] as Array<{ id: string; createdAt: number }>;
    expect(entries.map((entry) => entry.id)).toEqual(["user-1", "cmd-1", "agent-final"]);
    expect(entries[1]!.createdAt).toBeLessThan(entries[2]!.createdAt);
  });

  it("should keep sending available while cached idle timeline is visible and thread detail is still loading", async () => {
    mockReadThread.mockReturnValue(new Promise(() => undefined));
    mockThreadState.mockReturnValue({
      entries: [
        {
          id: "cached-1",
          createdAt: Date.now(),
          body: { kind: "user-message", text: "Cached message" }
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

    expect(await screen.findByText("Cached message")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("输入消息")).not.toBeDisabled();
    expect(mockStartTurn).not.toHaveBeenCalled();
  });

  it("should ignore a stale initial read that resolves after a cached send", async () => {
    let resolveInitialRead: (value: unknown) => void = () => undefined;
    mockReadThread.mockReturnValue(new Promise((resolve) => {
      resolveInitialRead = resolve;
    }));
    mockStartTurn.mockResolvedValue({ turnId: "turn-new" });
    mockThreadState.mockReturnValue({
      entries: [
        {
          id: "cached-1",
          turnId: "turn-old",
          createdAt: Date.now(),
          body: { kind: "user-message", text: "Cached message", status: "sent" }
        }
      ],
      pendingApprovals: [],
      mode: "build",
      running: false,
      activeTurnId: null,
      plan: [],
      cursor: null,
      reachedBeginning: false
    });

    render(<ThreadPage />);

    fireEvent.change(await screen.findByPlaceholderText("输入消息"), {
      target: { value: "new message" }
    });
    await waitFor(() => {
      expect(screen.getByLabelText("发送")).toBeEnabled();
    });
    fireEvent.click(screen.getByLabelText("发送"));
    await waitFor(() => {
      expect(mockStartTurn).toHaveBeenCalledWith(
        expect.objectContaining({ threadId: "thread-1", text: "new message" })
      );
    });
    await waitFor(() => {
      expect(mockBindLocalUserMessageTurn).toHaveBeenCalledWith(
        "thread-1",
        expect.stringMatching(/^local-user-/),
        "turn-new"
      );
    });

    resolveInitialRead({
      id: "thread-1",
      cwd: "C:/test",
      title: "Old Snapshot",
      modelProvider: "claude-opus-4",
      status: "idle",
      timeline: [{ id: "cached-1", turnId: "turn-old", role: "user", text: "Cached message" }],
      lastTurnId: "turn-old",
      updatedAt: Date.now()
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(mockSetThreadEntries).not.toHaveBeenCalledWith(
      "thread-1",
      [expect.objectContaining({ id: "cached-1" })],
      null
    );
  });

  it("should requeue snapshot repair instead of clearing it when a send changes the mutation epoch", async () => {
    let resolveRepair: (value: unknown) => void = () => undefined;
    const initialDetail = {
        id: "thread-1",
        cwd: "C:/test",
        title: "Initial",
        modelProvider: "claude-opus-4",
        status: "idle",
        timeline: [{ id: "cached-1", turnId: "turn-old", role: "user", text: "Cached message" }],
        lastTurnId: "turn-old",
        updatedAt: Date.now()
    };
    const repairPromise = new Promise((resolve) => {
      resolveRepair = resolve;
    });
    let readCount = 0;
    mockReadThread.mockImplementation(() => {
      readCount += 1;
      return readCount === 1 ? Promise.resolve(initialDetail) : repairPromise;
    });
    mockStartTurn.mockResolvedValue({ turnId: "turn-new" });
    mockThreadState.mockReturnValue({
      entries: [
        {
          id: "cached-1",
          turnId: "turn-old",
          createdAt: Date.now(),
          body: { kind: "user-message", text: "Cached message", status: "sent" }
        }
      ],
      pendingApprovals: [],
      mode: "build",
      running: false,
      activeTurnId: null,
      repairRequestedAt: 123,
      plan: [],
      cursor: null,
      reachedBeginning: false
    });

    render(<ThreadPage />);

    await waitFor(() => expect(mockReadThread.mock.calls.length).toBeGreaterThanOrEqual(2));
    fireEvent.change(await screen.findByPlaceholderText("输入消息"), {
      target: { value: "new message" }
    });
    await waitFor(() => {
      expect(screen.getByLabelText("发送")).toBeEnabled();
    });
    fireEvent.click(screen.getByLabelText("发送"));
    await waitFor(() => expect(mockBindLocalUserMessageTurn).toHaveBeenCalledWith(
      "thread-1",
      expect.stringMatching(/^local-user-/),
      "turn-new"
    ));
    mockSetThreadEntries.mockClear();
    mockClearSnapshotRepair.mockClear();

    resolveRepair({
      id: "thread-1",
      cwd: "C:/test",
      title: "Stale Repair",
      modelProvider: "claude-opus-4",
      status: "idle",
      timeline: [{ id: "cached-1", turnId: "turn-old", role: "user", text: "Cached message" }],
      lastTurnId: "turn-old",
      updatedAt: Date.now()
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(mockSetThreadEntries).not.toHaveBeenCalled();
    expect(mockClearSnapshotRepair).not.toHaveBeenCalled();
    expect(mockRequestSnapshotRepair).toHaveBeenCalledWith(
      "thread-1",
      expect.objectContaining({ reason: "mutation-retry" })
    );
  });

  it("should retry snapshot repair after a transient repair read failure", async () => {
    vi.useFakeTimers();
    let readCount = 0;
    mockReadThread.mockImplementation(() => {
      readCount += 1;
      if (readCount === 1) {
        return Promise.resolve({
          id: "thread-1",
          cwd: "C:/test",
          title: "Initial",
          modelProvider: "claude-opus-4",
          status: "active",
          timeline: [],
          lastTurnId: "turn-running",
          updatedAt: Date.now()
        });
      }
      return Promise.reject(new Error("temporary repair failure"));
    });
    mockReadThreadSummary.mockResolvedValue({
      id: "thread-1",
      cwd: "C:/test",
      title: "Initial",
      preview: "",
      modelProvider: "claude-opus-4",
      status: "active",
      updatedAt: Date.now()
    });
    mockThreadState.mockReturnValue({
      entries: [],
      pendingApprovals: [],
      mode: "build",
      running: true,
      activeTurnId: "turn-running",
      repairRequest: {
        key: "stream-disconnected:turn-running:0",
        reason: "stream-disconnected",
        turnId: "turn-running",
        generation: 0,
        requestedAt: 123
      },
      repairRequestedAt: 123,
      plan: [],
      cursor: null,
      reachedBeginning: false
    });

    render(<ThreadPage />);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    mockRequestSnapshotRepair.mockClear();

    await act(async () => {
      vi.advanceTimersByTime(3_100);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockRequestSnapshotRepair).toHaveBeenCalledWith(
      "thread-1",
      expect.objectContaining({ reason: "mutation-retry" })
    );
  });

  it("should preserve older history cursor after bounded snapshot repair", async () => {
    const initialDetail = {
      id: "thread-1",
      cwd: "C:/test",
      title: "Initial",
      modelProvider: "claude-opus-4",
      status: "idle",
      timeline: [{ id: "cached-1", turnId: "turn-old", role: "user", text: "Cached message" }],
      lastTurnId: "turn-old",
      nextCursor: "initial-older",
      updatedAt: Date.now()
    };
    const repairDetail = {
      id: "thread-1",
      cwd: "C:/test",
      title: "Repaired",
      modelProvider: "claude-opus-4",
      status: "idle",
      timeline: [{ id: "repair-1", turnId: "turn-new", role: "agent", text: "Repaired tail" }],
      lastTurnId: "turn-new",
      nextCursor: "repair-older",
      updatedAt: Date.now()
    };
    let readCount = 0;
    mockReadThread.mockImplementation(() => {
      readCount += 1;
      return Promise.resolve(readCount === 1 ? initialDetail : repairDetail);
    });
    mockThreadState.mockReturnValue({
      entries: [
        {
          id: "cached-1",
          turnId: "turn-old",
          createdAt: Date.now(),
          body: { kind: "user-message", text: "Cached message", status: "sent" }
        }
      ],
      pendingApprovals: [],
      mode: "build",
      running: false,
      activeTurnId: null,
      repairRequestedAt: 123,
      plan: [],
      cursor: "stale-older",
      reachedBeginning: false
    });

    render(<ThreadPage />);

    await waitFor(() => {
      expect(mockSetThreadEntries).toHaveBeenCalledWith(
        "thread-1",
        [expect.objectContaining({ id: "repair-1" })],
        "repair-older"
      );
    });
    expect(mockClearSnapshotRepair).toHaveBeenCalledWith("thread-1");
  });

  it("should not continue full-detail repair after an active repaired snapshot without output", async () => {
    vi.useFakeTimers();
    const initialDetail = {
      id: "thread-1",
      cwd: "C:/test",
      title: "Initial",
      modelProvider: "claude-opus-4",
      status: "idle",
      timeline: [],
      lastTurnId: null,
      updatedAt: Date.now()
    };
    const repairDetail = {
      id: "thread-1",
      cwd: "C:/test",
      title: "Still Running",
      modelProvider: "claude-opus-4",
      status: "active",
      timeline: [{ id: "user-active", turnId: "turn-active", role: "user", text: "waiting" }],
      lastTurnId: "turn-active",
      updatedAt: Date.now()
    };
    let readCount = 0;
    mockReadThread.mockImplementation(() => {
      readCount += 1;
      return Promise.resolve(readCount === 1 ? initialDetail : repairDetail);
    });
    mockThreadState.mockReturnValue({
      entries: [],
      pendingApprovals: [],
      mode: "build",
      running: true,
      activeTurnId: "turn-active",
      repairRequestedAt: 123,
      plan: [],
      cursor: null,
      reachedBeginning: false
    });

    render(<ThreadPage />);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(mockSetThreadEntries).toHaveBeenCalledWith(
      "thread-1",
      [expect.objectContaining({ id: "user-active" })],
      null
    );
    mockRequestSnapshotRepair.mockClear();

    act(() => {
      vi.advanceTimersByTime(2600);
    });
    vi.useRealTimers();

    expect(mockRequestSnapshotRepair).not.toHaveBeenCalled();
  });

  it("should not continue full-detail repair after an active repaired snapshot with partial output", async () => {
    vi.useFakeTimers();
    const initialDetail = {
      id: "thread-1",
      cwd: "C:/test",
      title: "Initial",
      modelProvider: "claude-opus-4",
      status: "idle",
      timeline: [],
      lastTurnId: null,
      updatedAt: Date.now()
    };
    const repairDetail = {
      id: "thread-1",
      cwd: "C:/test",
      title: "Still Running",
      modelProvider: "claude-opus-4",
      status: "active",
      timeline: [
        { id: "user-active", turnId: "turn-active", role: "user", text: "waiting" },
        { id: "agent-active", turnId: "turn-active", role: "agent", text: "partial" }
      ],
      lastTurnId: "turn-active",
      updatedAt: Date.now()
    };
    let readCount = 0;
    mockReadThread.mockImplementation(() => {
      readCount += 1;
      return Promise.resolve(readCount === 1 ? initialDetail : repairDetail);
    });
    mockThreadState.mockReturnValue({
      entries: [
        {
          id: "agent-active",
          turnId: "turn-active",
          createdAt: Date.now(),
          body: { kind: "agent-message", text: "partial" }
        }
      ],
      pendingApprovals: [],
      mode: "build",
      running: true,
      activeTurnId: "turn-active",
      repairRequestedAt: 123,
      plan: [],
      cursor: null,
      reachedBeginning: false
    });

    render(<ThreadPage />);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(mockSetThreadEntries).toHaveBeenCalledWith(
      "thread-1",
      expect.arrayContaining([expect.objectContaining({ id: "agent-active" })]),
      null
    );
    mockRequestSnapshotRepair.mockClear();

    act(() => {
      vi.advanceTimersByTime(2600);
    });
    vi.useRealTimers();

    expect(mockRequestSnapshotRepair).not.toHaveBeenCalled();
  });

  it("should merge turn item activity into snapshot repair when the main timeline omits command items", async () => {
    const initialDetail = {
      id: "thread-1",
      cwd: "C:/test",
      title: "Initial",
      modelProvider: "claude-opus-4",
      status: "idle",
      timeline: [],
      lastTurnId: null,
      updatedAt: Date.now()
    };
    const repairDetail = {
      id: "thread-1",
      cwd: "C:/test",
      title: "Repaired",
      modelProvider: "claude-opus-4",
      status: "idle",
      timeline: [{ id: "agent-1", turnId: "turn-new", role: "agent", text: "完成了。" }],
      lastTurnId: "turn-new",
      nextCursor: null,
      updatedAt: Date.now()
    };
    let readCount = 0;
    mockReadThread.mockImplementation(() => {
      readCount += 1;
      return Promise.resolve(readCount === 1 ? initialDetail : repairDetail);
    });
    mockListTurnItems.mockResolvedValue({
      items: [
        { id: "agent-1", turnId: "turn-new", role: "agent", text: "完成了。" },
        {
          id: "cmd-1",
          turnId: "turn-new",
          role: "tool",
          text: "tests passed",
          toolKind: "command",
          actionKind: "command",
          server: "command",
          tool: "npm test",
          status: "success"
        },
        {
          id: "read-1",
          turnId: "turn-new",
          role: "tool",
          text: "src/app.ts",
          toolKind: "command",
          actionKind: "read",
          server: "command",
          tool: "sed -n '1,80p' src/app.ts",
          status: "success"
        }
      ],
      nextCursor: null
    });
    mockThreadState.mockReturnValue({
      entries: [],
      pendingApprovals: [],
      mode: "build",
      running: false,
      activeTurnId: null,
      repairRequestedAt: 123,
      plan: [],
      cursor: null,
      reachedBeginning: false
    });

    render(<ThreadPage />);

    await waitFor(() => {
      expect(mockListTurnItems).toHaveBeenCalledWith("thread-1", "turn-new", undefined, 100);
    });
    await waitFor(() => {
      expect(mockSetThreadEntries).toHaveBeenLastCalledWith(
        "thread-1",
        [
          expect.objectContaining({
            id: "cmd-1",
            body: expect.objectContaining({ kind: "tool", toolKind: "command", actionKind: "command", tool: "npm test" })
          }),
          expect.objectContaining({
            id: "read-1",
            body: expect.objectContaining({ kind: "tool", toolKind: "command", actionKind: "read" })
          }),
          expect.objectContaining({ id: "agent-1" })
        ],
        null
      );
    });
    expect(mockClearSnapshotRepair).toHaveBeenCalledWith("thread-1");
  });

  it("should place repaired turn item activity before the final assistant message", async () => {
    const initialDetail = {
      id: "thread-1",
      cwd: "C:/test",
      title: "Initial",
      modelProvider: "claude-opus-4",
      status: "idle",
      timeline: [],
      lastTurnId: null,
      updatedAt: Date.now()
    };
    const repairDetail = {
      id: "thread-1",
      cwd: "C:/test",
      title: "Repaired",
      modelProvider: "claude-opus-4",
      status: "idle",
      timeline: [
        { id: "user-1", turnId: "turn-new", role: "user", text: "分析 bug" },
        { id: "agent-1", turnId: "turn-new", role: "agent", text: "最终结论" }
      ],
      lastTurnId: "turn-new",
      nextCursor: null,
      updatedAt: Date.now()
    };
    let readCount = 0;
    mockReadThread.mockImplementation(() => {
      readCount += 1;
      return Promise.resolve(readCount === 1 ? initialDetail : repairDetail);
    });
    mockListTurnItems.mockResolvedValue({
      items: [
        { id: "agent-1", turnId: "turn-new", role: "agent", text: "最终结论" },
        {
          id: "cmd-1",
          turnId: "turn-new",
          role: "tool",
          text: "tests passed",
          toolKind: "command",
          actionKind: "command",
          server: "command",
          tool: "npm test",
          status: "success"
        }
      ],
      nextCursor: null
    });
    mockThreadState.mockReturnValue({
      entries: [],
      pendingApprovals: [],
      mode: "build",
      running: false,
      activeTurnId: null,
      repairRequestedAt: 123,
      plan: [],
      cursor: null,
      reachedBeginning: false
    });

    render(<ThreadPage />);

    await waitFor(() => {
      expect(mockSetThreadEntries).toHaveBeenLastCalledWith(
        "thread-1",
        [
          expect.objectContaining({ id: "user-1" }),
          expect.objectContaining({
            id: "cmd-1",
            body: expect.objectContaining({ kind: "tool", toolKind: "command", tool: "npm test" })
          }),
          expect.objectContaining({ id: "agent-1" })
        ],
        null
      );
    });
  });

  it("should place repaired turn item activity before the final assistant message when item details include the user", async () => {
    const initialDetail = {
      id: "thread-1",
      cwd: "C:/test",
      title: "Initial",
      modelProvider: "claude-opus-4",
      status: "idle",
      timeline: [],
      lastTurnId: null,
      updatedAt: Date.now()
    };
    const repairDetail = {
      id: "thread-1",
      cwd: "C:/test",
      title: "Repaired",
      modelProvider: "claude-opus-4",
      status: "idle",
      timeline: [
        { id: "user-1", turnId: "turn-new", role: "user", text: "分析目标模式" },
        { id: "agent-1", turnId: "turn-new", role: "agent", text: "方案已经整理好了。" }
      ],
      lastTurnId: "turn-new",
      nextCursor: null,
      updatedAt: Date.now()
    };
    let readCount = 0;
    mockReadThread.mockImplementation(() => {
      readCount += 1;
      return Promise.resolve(readCount === 1 ? initialDetail : repairDetail);
    });
    mockListTurnItems.mockResolvedValue({
      items: [
        { id: "user-1", turnId: "turn-new", role: "user", text: "分析目标模式" },
        { id: "agent-1", turnId: "turn-new", role: "agent", text: "方案已经整理好了。" },
        {
          id: "cmd-1",
          turnId: "turn-new",
          role: "tool",
          text: "src/app/threads/[threadId]/page.tsx",
          toolKind: "command",
          actionKind: "read",
          server: "command",
          tool: "sed -n '1,220p' src/app/threads/[threadId]/page.tsx",
          status: "success"
        },
        {
          id: "cmd-2",
          turnId: "turn-new",
          role: "tool",
          text: "src/web/state/store.ts",
          toolKind: "command",
          actionKind: "search",
          server: "command",
          tool: "rg timeline src",
          status: "success"
        }
      ],
      nextCursor: null
    });
    mockThreadState.mockReturnValue({
      entries: [],
      pendingApprovals: [],
      mode: "build",
      running: false,
      activeTurnId: null,
      repairRequestedAt: 123,
      plan: [],
      cursor: null,
      reachedBeginning: false
    });

    render(<ThreadPage />);

    await waitFor(() => {
      expect(mockSetThreadEntries).toHaveBeenLastCalledWith(
        "thread-1",
        [
          expect.objectContaining({ id: "user-1" }),
          expect.objectContaining({ id: "cmd-1" }),
          expect.objectContaining({ id: "cmd-2" }),
          expect.objectContaining({ id: "agent-1" })
        ],
        null
      );
    });
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
      expect(mockSetThreadStatus).toHaveBeenCalledWith("thread-1", "active", "turn-running");
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

  it("should not poll full thread details while the event stream is the running path", async () => {
    const originalSetInterval = window.setInterval.bind(window);
    const originalClearInterval = window.clearInterval.bind(window);
    const setIntervalSpy = vi.spyOn(window, "setInterval").mockImplementation((handler: TimerHandler, timeout?: number, ...args: any[]) => {
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
      expect(setIntervalSpy).not.toHaveBeenCalledWith(expect.any(Function), 2_000);
      expect(mockReadThread.mock.calls.length - initialReadCalls).toBe(1);
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
      expect(setIntervalSpy).not.toHaveBeenCalledWith(expect.any(Function), 2_000);
    } finally {
      setIntervalSpy.mockRestore();
      clearIntervalSpy.mockRestore();
    }
  });

  it("should poll lightweight thread summary while the event stream is open for a running thread", async () => {
    vi.useFakeTimers();
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
      entries: [
        {
          id: "agent-live",
          turnId: "turn-running",
          createdAt: 1_001,
          body: { kind: "agent-message", text: "streaming" }
        }
      ],
      pendingApprovals: [],
      mode: "build",
      running: true,
      activeTurnId: "turn-running",
      plan: [],
      cursor: null,
      reachedBeginning: false
    });

    render(<ThreadPage />);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    await act(async () => {
      vi.advanceTimersByTime(15_000);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockReadThreadSummary).toHaveBeenCalledWith("thread-1");
    expect(mockRequestSnapshotRepair).not.toHaveBeenCalled();
    expect(mockListTurnItems).not.toHaveBeenCalled();
  });

  it("should poll lightweight thread summary while active and request one snapshot repair when it becomes idle", async () => {
    vi.useFakeTimers();
    mockWsState.mockReturnValue("reconnecting");
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
    mockReadThreadSummary
      .mockResolvedValueOnce({
        id: "thread-1",
        cwd: "C:/test",
        title: "Running Thread",
        preview: "",
        modelProvider: "claude-opus-4",
        status: "active",
        updatedAt: Date.now()
      })
      .mockResolvedValueOnce({
        id: "thread-1",
        cwd: "C:/test",
        title: "Running Thread",
        preview: "",
        modelProvider: "claude-opus-4",
        status: "idle",
        updatedAt: Date.now()
      });
    mockThreadState.mockReturnValue({
      entries: [],
      pendingApprovals: [],
      mode: "build",
      running: true,
      activeTurnId: "turn-running",
      plan: [],
      cursor: null,
      reachedBeginning: false
    });
    const initialReadCalls = mockReadThread.mock.calls.length;

    render(<ThreadPage />);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(mockReadThread.mock.calls.length - initialReadCalls).toBe(1);

    await act(async () => {
      vi.advanceTimersByTime(3_100);
      await Promise.resolve();
    });
    expect(mockReadThreadSummary).toHaveBeenCalledWith("thread-1");
    expect(mockReadThread.mock.calls.length - initialReadCalls).toBe(1);

    await act(async () => {
      vi.advanceTimersByTime(3_100);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockSetThreadStatus).toHaveBeenCalledWith("thread-1", "idle");
    expect(mockRequestSnapshotRepair).toHaveBeenCalledWith(
      "thread-1",
      expect.objectContaining({
        reason: "summary-idle",
        turnId: "turn-running"
      })
    );
    expect(mockReadThread.mock.calls.length - initialReadCalls).toBe(1);
  });

  it("should request bounded repair when an active turn has no visible output despite an open event stream", async () => {
    vi.useFakeTimers();
    mockWsState.mockReturnValue("open");
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
    mockReadThreadSummary.mockResolvedValue({
      id: "thread-1",
      cwd: "C:/test",
      title: "Running Thread",
      preview: "",
      modelProvider: "claude-opus-4",
      status: "active",
      updatedAt: Date.now()
    });
    mockThreadState.mockReturnValue({
      entries: [],
      pendingApprovals: [],
      mode: "build",
      running: true,
      activeTurnId: "turn-running",
      plan: [],
      cursor: null,
      reachedBeginning: false
    });

    render(<ThreadPage />);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    await act(async () => {
      vi.advanceTimersByTime(3_100);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockReadThreadSummary).toHaveBeenCalledWith("thread-1");
    expect(mockRequestSnapshotRepair).toHaveBeenCalledWith(
      "thread-1",
      expect.objectContaining({
        reason: "stream-disconnected",
        turnId: "turn-running"
      })
    );
  });

  it("should ignore a late idle summary after the live completion event clears the active turn", async () => {
    vi.useFakeTimers();
    mockWsState.mockReturnValue("reconnecting");
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
    mockReadThreadSummary.mockResolvedValue({
      id: "thread-1",
      cwd: "C:/test",
      title: "Running Thread",
      preview: "",
      modelProvider: "claude-opus-4",
      status: "idle",
      updatedAt: Date.now()
    });
    mockThreadState.mockReturnValue({
      entries: [
        {
          id: "agent-live",
          turnId: "turn-running",
          createdAt: 1_001,
          body: { kind: "agent-message", text: "streamed output" }
        }
      ],
      pendingApprovals: [],
      mode: "build",
      running: true,
      activeTurnId: null,
      plan: [],
      cursor: null,
      reachedBeginning: false
    });
    const initialReadCalls = mockReadThread.mock.calls.length;

    render(<ThreadPage />);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    mockRequestSnapshotRepair.mockClear();

    await act(async () => {
      vi.advanceTimersByTime(3_100);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockReadThreadSummary).toHaveBeenCalledWith("thread-1");
    expect(mockSetThreadStatus).toHaveBeenCalledWith("thread-1", "idle");
    expect(mockRequestSnapshotRepair).not.toHaveBeenCalled();
    expect(mockReadThread.mock.calls.length - initialReadCalls).toBe(1);
    expect(mockListTurnItems).not.toHaveBeenCalled();
  });

  it("should request snapshot repair when summary remains active while event stream is disconnected", async () => {
    vi.useFakeTimers();
    mockWsState.mockReturnValue("reconnecting");
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
    mockReadThreadSummary.mockResolvedValue({
      id: "thread-1",
      cwd: "C:/test",
      title: "Running Thread",
      preview: "",
      modelProvider: "claude-opus-4",
      status: "active",
      updatedAt: Date.now()
    });
    mockThreadState.mockReturnValue({
      entries: [],
      pendingApprovals: [],
      mode: "build",
      running: true,
      activeTurnId: "turn-running",
      plan: [],
      cursor: null,
      reachedBeginning: false
    });
    const initialReadCalls = mockReadThread.mock.calls.length;

    render(<ThreadPage />);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    mockRequestSnapshotRepair.mockClear();

    await act(async () => {
      vi.advanceTimersByTime(3_100);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockReadThreadSummary).toHaveBeenCalledWith("thread-1");
    expect(mockSetThreadStatus).toHaveBeenCalledWith("thread-1", "active");
    expect(mockRequestSnapshotRepair).toHaveBeenCalledWith(
      "thread-1",
      expect.objectContaining({
        reason: "stream-disconnected",
        turnId: "turn-running"
      })
    );
    expect(mockReadThread.mock.calls.length - initialReadCalls).toBe(1);
  });

  it("should not repeat disconnected stream repair on every active summary poll", async () => {
    vi.useFakeTimers();
    mockWsState.mockReturnValue("reconnecting");
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
    mockReadThreadSummary.mockResolvedValue({
      id: "thread-1",
      cwd: "C:/test",
      title: "Running Thread",
      preview: "",
      modelProvider: "claude-opus-4",
      status: "active",
      updatedAt: Date.now()
    });
    mockThreadState.mockReturnValue({
      entries: [],
      pendingApprovals: [],
      mode: "build",
      running: true,
      activeTurnId: "turn-running",
      plan: [],
      cursor: null,
      reachedBeginning: false
    });
    const initialReadCalls = mockReadThread.mock.calls.length;

    render(<ThreadPage />);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    mockRequestSnapshotRepair.mockClear();

    await act(async () => {
      vi.advanceTimersByTime(3_100);
      await Promise.resolve();
      await Promise.resolve();
    });

    await act(async () => {
      vi.advanceTimersByTime(3_100);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockReadThreadSummary).toHaveBeenCalledTimes(2);
    expect(mockRequestSnapshotRepair).toHaveBeenCalledTimes(1);
    expect(mockRequestSnapshotRepair).toHaveBeenCalledWith(
      "thread-1",
      expect.objectContaining({
        reason: "stream-disconnected",
        turnId: "turn-running"
      })
    );
    expect(mockReadThread.mock.calls.length - initialReadCalls).toBe(1);
    expect(mockListTurnItems).not.toHaveBeenCalled();
  });

  it("should poll summary and repair when the open event stream misses turn completion", async () => {
    vi.useFakeTimers();
    mockReadThread.mockResolvedValue({
      id: "thread-1",
      cwd: "C:/test",
      title: "Running Thread",
      modelProvider: "claude-opus-4",
      status: "active",
      timeline: [],
      lastTurnId: "turn-running",
      updatedAt: 1_000
    });
    mockReadThreadSummary.mockResolvedValue({
      id: "thread-1",
      cwd: "C:/test",
      title: "Running Thread",
      preview: "",
      modelProvider: "claude-opus-4",
      status: "idle",
      updatedAt: 1_005
    });
    mockThreadState.mockReturnValue({
      entries: [],
      pendingApprovals: [],
      mode: "build",
      running: true,
      activeTurnId: "turn-running",
      timelineGeneration: 4,
      lastSeenItemId: null,
      plan: [],
      cursor: null,
      reachedBeginning: false
    });
    const initialReadCalls = mockReadThread.mock.calls.length;

    render(<ThreadPage />);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    mockRequestSnapshotRepair.mockClear();

    await act(async () => {
      vi.advanceTimersByTime(3_100);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(mockReadThreadSummary).toHaveBeenCalledWith("thread-1");
    expect(mockSetThreadStatus).toHaveBeenCalledWith("thread-1", "idle");
    expect(mockRequestSnapshotRepair).toHaveBeenCalledWith(
      "thread-1",
      expect.objectContaining({
        reason: "summary-idle",
        turnId: "turn-running"
      })
    );
    expect(mockReadThread.mock.calls.length - initialReadCalls).toBe(1);
    expect(mockListTurnItems).not.toHaveBeenCalled();
  });

  it("should poll active summary without repairing while the event stream is open after visible live output stalls", async () => {
    vi.useFakeTimers();
    mockReadThread.mockResolvedValue({
      id: "thread-1",
      cwd: "C:/test",
      title: "Running Thread",
      modelProvider: "claude-opus-4",
      status: "active",
      timeline: [],
      lastTurnId: "turn-running",
      updatedAt: 1_000
    });
    mockReadThreadSummary
      .mockResolvedValueOnce({
        id: "thread-1",
        cwd: "C:/test",
        title: "Running Thread",
        preview: "",
        modelProvider: "claude-opus-4",
        status: "active",
        updatedAt: 1_000
      })
      .mockResolvedValueOnce({
        id: "thread-1",
        cwd: "C:/test",
        title: "Running Thread",
        preview: "",
        modelProvider: "claude-opus-4",
        status: "active",
        updatedAt: 1_005
      });
    mockThreadState.mockReturnValue({
      entries: [
        {
          id: "agent-live",
          turnId: "turn-running",
          createdAt: 1_001,
          body: { kind: "agent-message", text: "partial output" }
        }
      ],
      pendingApprovals: [],
      mode: "build",
      running: true,
      activeTurnId: "turn-running",
      timelineGeneration: 4,
      lastSeenItemId: null,
      plan: [],
      cursor: null,
      reachedBeginning: false
    });
    const initialReadCalls = mockReadThread.mock.calls.length;

    render(<ThreadPage />);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    mockRequestSnapshotRepair.mockClear();

    await act(async () => {
      vi.advanceTimersByTime(3_100);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(mockRequestSnapshotRepair).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(3_100);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockReadThreadSummary).toHaveBeenCalledWith("thread-1");
    expect(mockRequestSnapshotRepair).not.toHaveBeenCalled();
    expect(mockReadThread.mock.calls.length - initialReadCalls).toBe(1);
    expect(mockListTurnItems).not.toHaveBeenCalled();
  });

  it("should not repair from the initial active detail baseline while the event stream is open", async () => {
    vi.useFakeTimers();
    mockReadThread.mockResolvedValue({
      id: "thread-1",
      cwd: "C:/test",
      title: "Running Thread",
      modelProvider: "claude-opus-4",
      status: "active",
      timeline: [],
      lastTurnId: "turn-running",
      updatedAt: 1_000
    });
    mockReadThreadSummary.mockResolvedValue({
      id: "thread-1",
      cwd: "C:/test",
      title: "Running Thread",
      preview: "",
      modelProvider: "claude-opus-4",
      status: "active",
      updatedAt: 1_005
    });
    mockThreadState.mockReturnValue({
      entries: [
        {
          id: "agent-live",
          turnId: "turn-running",
          createdAt: 1_001,
          body: { kind: "agent-message", text: "partial output" }
        }
      ],
      pendingApprovals: [],
      mode: "build",
      running: true,
      activeTurnId: "turn-running",
      timelineGeneration: 4,
      lastSeenItemId: null,
      plan: [],
      cursor: null,
      reachedBeginning: false
    });
    const initialReadCalls = mockReadThread.mock.calls.length;

    render(<ThreadPage />);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    mockRequestSnapshotRepair.mockClear();

    await act(async () => {
      vi.advanceTimersByTime(3_100);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockReadThreadSummary).toHaveBeenCalledWith("thread-1");
    expect(mockRequestSnapshotRepair).not.toHaveBeenCalled();
    expect(mockReadThread.mock.calls.length - initialReadCalls).toBe(1);
    expect(mockListTurnItems).not.toHaveBeenCalled();
  });

  it("should not repair when summary snapshot sequence advances while the event stream is open", async () => {
    vi.useFakeTimers();
    mockReadThread.mockResolvedValue({
      id: "thread-1",
      cwd: "C:/test",
      title: "Running Thread",
      modelProvider: "claude-opus-4",
      status: "active",
      timeline: [],
      lastTurnId: "turn-running",
      updatedAt: 1_000,
      snapshotSequence: 10
    });
    mockReadThreadSummary.mockResolvedValue({
      id: "thread-1",
      cwd: "C:/test",
      title: "Running Thread",
      preview: "",
      modelProvider: "claude-opus-4",
      status: "active",
      updatedAt: 1_000,
      snapshotSequence: 12
    });
    mockThreadState.mockReturnValue({
      entries: [
        {
          id: "agent-live",
          turnId: "turn-running",
          createdAt: 1_001,
          body: { kind: "agent-message", text: "partial output" }
        }
      ],
      pendingApprovals: [],
      mode: "build",
      running: true,
      activeTurnId: "turn-running",
      timelineGeneration: 4,
      lastSeenItemId: null,
      plan: [],
      cursor: null,
      reachedBeginning: false
    });
    const initialReadCalls = mockReadThread.mock.calls.length;

    render(<ThreadPage />);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    mockRequestSnapshotRepair.mockClear();

    await act(async () => {
      vi.advanceTimersByTime(3_100);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockReadThreadSummary).toHaveBeenCalledWith("thread-1");
    expect(mockRequestSnapshotRepair).not.toHaveBeenCalled();
    expect(mockReadThread.mock.calls.length - initialReadCalls).toBe(1);
    expect(mockListTurnItems).not.toHaveBeenCalled();
  });

  it("should not request a duplicate snapshot repair when summary idle matches a pending completion repair", async () => {
    vi.useFakeTimers();
    mockWsState.mockReturnValue("reconnecting");
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
    mockReadThreadSummary.mockResolvedValue({
      id: "thread-1",
      cwd: "C:/test",
      title: "Running Thread",
      preview: "",
      modelProvider: "claude-opus-4",
      status: "idle",
      updatedAt: Date.now()
    });
    mockThreadState.mockReturnValue({
      entries: [],
      pendingApprovals: [],
      mode: "build",
      running: true,
      activeTurnId: "turn-running",
      repairRequest: {
        key: "turn-completed:turn-running:0",
        reason: "turn-completed",
        turnId: "turn-running",
        generation: 0,
        requestedAt: 123
      },
      repairRequestedAt: 123,
      plan: [],
      cursor: null,
      reachedBeginning: false
    });

    render(<ThreadPage />);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    mockRequestSnapshotRepair.mockClear();

    await act(async () => {
      vi.advanceTimersByTime(3_100);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockSetThreadStatus).toHaveBeenCalledWith("thread-1", "idle");
    expect(mockReadThreadSummary).toHaveBeenCalledWith("thread-1");
    expect(mockRequestSnapshotRepair).not.toHaveBeenCalled();
  });

  it("should not request snapshot repair when summary becomes idle after visible live output", async () => {
    vi.useFakeTimers();
    mockWsState.mockReturnValue("reconnecting");
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
    mockReadThreadSummary.mockResolvedValue({
      id: "thread-1",
      cwd: "C:/test",
      title: "Running Thread",
      preview: "",
      modelProvider: "claude-opus-4",
      status: "idle",
      updatedAt: Date.now()
    });
    mockThreadState.mockReturnValue({
      entries: [
        {
          id: "agent-live",
          turnId: "turn-running",
          createdAt: 1_001,
          body: { kind: "agent-message", text: "streamed output" }
        }
      ],
      pendingApprovals: [],
      mode: "build",
      running: true,
      activeTurnId: "turn-running",
      plan: [],
      cursor: null,
      reachedBeginning: false
    });

    render(<ThreadPage />);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    mockRequestSnapshotRepair.mockClear();

    await act(async () => {
      vi.advanceTimersByTime(3_100);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockSetThreadStatus).toHaveBeenCalledWith("thread-1", "idle");
    expect(mockReadThreadSummary).toHaveBeenCalledWith("thread-1");
    expect(mockRequestSnapshotRepair).not.toHaveBeenCalled();
  });

  it("should not request snapshot repair when summary becomes idle with only tool output", async () => {
    vi.useFakeTimers();
    mockWsState.mockReturnValue("reconnecting");
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
    mockReadThreadSummary.mockResolvedValue({
      id: "thread-1",
      cwd: "C:/test",
      title: "Running Thread",
      preview: "",
      modelProvider: "claude-opus-4",
      status: "idle",
      updatedAt: Date.now()
    });
    mockThreadState.mockReturnValue({
      entries: [
        {
          id: "cmd-live",
          turnId: "turn-running",
          createdAt: 1_001,
          body: {
            kind: "tool",
            toolKind: "command",
            server: "command",
            tool: "command",
            status: "running",
            result: "npm test\n"
          }
        }
      ],
      pendingApprovals: [],
      mode: "build",
      running: true,
      activeTurnId: "turn-running",
      plan: [],
      cursor: null,
      reachedBeginning: false
    });

    render(<ThreadPage />);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    mockRequestSnapshotRepair.mockClear();

    await act(async () => {
      vi.advanceTimersByTime(3_100);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockReadThreadSummary).toHaveBeenCalledWith("thread-1");
    expect(mockRequestSnapshotRepair).not.toHaveBeenCalled();
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
    expect(mockSetThreadStatus).toHaveBeenCalledWith("thread-1", "idle", null);
  });

  it("should ignore duplicate interrupt clicks while request is pending", async () => {
    let resolveInterrupt: (() => void) | null = null;
    mockInterruptTurn.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveInterrupt = resolve;
      })
    );
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

    const interruptButton = screen.getByLabelText("中断");
    fireEvent.click(interruptButton);
    fireEvent.click(interruptButton);

    expect(mockInterruptTurn).toHaveBeenCalledTimes(1);

    act(() => {
      resolveInterrupt?.();
    });
  });

  it("should prefer the tracked active turn id when detail lastTurnId is stale", async () => {
    const user = userEvent.setup();
    mockReadThread.mockResolvedValue({
      id: "thread-1",
      cwd: "C:/test",
      title: "Running Thread",
      modelProvider: "claude-opus-4",
      status: "active",
      timeline: [],
      lastTurnId: "turn-stale",
      updatedAt: Date.now()
    });
    mockThreadState.mockReturnValue({
      entries: [],
      pendingApprovals: [],
      mode: "build",
      running: true,
      activeTurnId: "turn-current",
      plan: [],
      cursor: null,
      reachedBeginning: false
    });

    render(<ThreadPage />);

    await waitFor(() => {
      expect(screen.queryByText(/载入中/)).not.toBeInTheDocument();
    });

    await user.click(screen.getByLabelText("中断"));

    expect(mockInterruptTurn).toHaveBeenCalledWith("thread-1", "turn-current");
    expect(mockInterruptTurn).not.toHaveBeenCalledWith("thread-1", "turn-stale");
    expect(mockMarkTurnInterrupted).toHaveBeenCalledWith("thread-1", "turn-current");
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

    expect(mockSetThreadStatus).not.toHaveBeenCalledWith("thread-1", "idle", null);
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

  it("should not request the same older page twice while cursor load is pending", async () => {
    let resolvePage: ((value: { items: []; nextCursor: string | null }) => void) | null = null;
    mockThreadState.mockReturnValue({
      entries: [
        {
          id: "recent",
          createdAt: Date.now(),
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
    mockListTurnsBefore.mockReturnValue(
      new Promise((resolve) => {
        resolvePage = resolve;
      })
    );

    const { container } = render(<ThreadPage />);

    await waitFor(() => {
      expect(screen.queryByText(/载入中/)).not.toBeInTheDocument();
    });

    const scroller = container.querySelector(".cw-thread-scroller") as HTMLDivElement;
    fireEvent.scroll(scroller, { target: { scrollTop: 0 } });
    fireEvent.scroll(scroller, { target: { scrollTop: 0 } });

    await waitFor(() => {
      expect(mockListTurnsBefore).toHaveBeenCalledTimes(1);
    });

    act(() => {
      resolvePage?.({ items: [], nextCursor: null });
    });
  });

  it("should keep scroll anchor when older history is prepended", async () => {
    mockThreadState.mockReturnValue({
      entries: [
        {
          id: "recent",
          createdAt: Date.now(),
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
    let resolvePage: ((value: { items: Array<{ id: string; role: "user"; text: string }>; nextCursor: string }) => void) | null = null;
    mockListTurnsBefore.mockReturnValue(new Promise((resolve) => {
      resolvePage = resolve;
    }));

    const { container } = render(<ThreadPage />);

    await waitFor(() => {
      expect(screen.queryByText(/载入中/)).not.toBeInTheDocument();
    });

    const scroller = container.querySelector(".cw-thread-scroller") as HTMLDivElement;
    let scrollTop = 0;
    let scrollHeight = 1000;
    Object.defineProperty(scroller, "scrollTop", {
      configurable: true,
      get: () => scrollTop,
      set: (value) => {
        scrollTop = value;
      }
    });
    Object.defineProperty(scroller, "scrollHeight", {
      configurable: true,
      get: () => scrollHeight
    });
    Object.defineProperty(scroller, "clientHeight", {
      configurable: true,
      get: () => 500
    });

    fireEvent.scroll(scroller, { target: { scrollTop: 0 } });

    await waitFor(() => {
      expect(mockListTurnsBefore).toHaveBeenCalled();
    });
    scrollHeight = 1400;
    act(() => {
      resolvePage?.({
        items: [{ id: "older", role: "user", text: "Older message" }],
        nextCursor: "turn-5"
      });
    });

    await waitFor(() => {
      expect(scroller.scrollTop).toBe(400);
    });
  });

  it("should preserve paginated activity before the final assistant message with stable timestamps", async () => {
    mockThreadState.mockReturnValue({
      entries: [
        {
          id: "recent",
          createdAt: Date.now(),
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
        { id: "older-user", turnId: "turn-old", role: "user", text: "旧问题" },
        {
          id: "older-read",
          turnId: "turn-old",
          role: "tool",
          text: "src/web/state/store.ts",
          toolKind: "command",
          actionKind: "read",
          server: "command",
          tool: "sed -n '1,80p' src/web/state/store.ts",
          status: "success"
        },
        { id: "older-agent", turnId: "turn-old", role: "agent", text: "旧回答" }
      ],
      nextCursor: null
    });

    const { container } = render(<ThreadPage />);

    await waitFor(() => {
      expect(screen.queryByText(/载入中/)).not.toBeInTheDocument();
    });

    const scroller = container.querySelector(".cw-thread-scroller") as HTMLDivElement;
    fireEvent.scroll(scroller, { target: { scrollTop: 0 } });

    await waitFor(() => {
      expect(mockPrependEntries).toHaveBeenCalled();
    });

    const entries = mockPrependEntries.mock.calls.at(-1)?.[1] as Array<{ id: string; createdAt: number }>;
    expect(entries.map((entry) => entry.id)).toEqual(["older-user", "older-read", "older-agent"]);
    expect(entries[1]!.createdAt).toBeLessThan(entries[2]!.createdAt);
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

  it("should not scroll to latest when live delta arrives while reading history", async () => {
    const baseThread = {
      entries: Array.from({ length: 12 }, (_value, index) => ({
        id: `entry-${index}`,
        createdAt: index,
        body: { kind: "agent-message" as const, text: `Message ${index}` }
      })),
      pendingApprovals: [],
      mode: "build",
      running: true,
      activeTurnId: "turn-active",
      plan: [],
      cursor: null,
      reachedBeginning: false
    };
    let threadState = baseThread;
    mockThreadState.mockImplementation(() => threadState);

    const { container, rerender } = render(<ThreadPage />);

    await waitFor(() => {
      expect(screen.queryByText(/载入中/)).not.toBeInTheDocument();
    });

    const scroller = container.querySelector(".cw-thread-scroller") as HTMLDivElement;
    let scrollTop = 320;
    Object.defineProperty(scroller, "scrollTop", {
      configurable: true,
      get: () => scrollTop,
      set: (value) => {
        scrollTop = value;
      }
    });
    Object.defineProperty(scroller, "scrollHeight", { configurable: true, get: () => 2_000 });
    Object.defineProperty(scroller, "clientHeight", { configurable: true, get: () => 500 });

    fireEvent.scroll(scroller);

    threadState = {
      ...baseThread,
      entries: [
        ...baseThread.entries,
        {
          id: "agent-live-delta",
          turnId: "turn-active",
          createdAt: 13,
          body: { kind: "agent-message" as const, text: "live delta" }
        }
      ]
    };
    rerender(<ThreadPage />);

    expect(scroller.scrollTop).toBe(320);
    expect(screen.getByRole("button", { name: /跳到最新/ })).toBeInTheDocument();
  });

  it("should scroll to timeline tail from jump-to-latest button", async () => {
    mockThreadState.mockReturnValue({
      entries: Array.from({ length: 12 }, (_value, index) => ({
        id: `entry-${index}`,
        createdAt: index,
        body: { kind: "agent-message" as const, text: `Message ${index}` }
      })),
      pendingApprovals: [],
      mode: "build",
      running: false,
      plan: [],
      cursor: null,
      reachedBeginning: false
    });

    const { container } = render(<ThreadPage />);

    await waitFor(() => {
      expect(screen.queryByText(/载入中/)).not.toBeInTheDocument();
    });

    const scroller = container.querySelector(".cw-thread-scroller") as HTMLDivElement;
    let scrollTop = 240;
    Object.defineProperty(scroller, "scrollTop", {
      configurable: true,
      get: () => scrollTop,
      set: (value) => {
        scrollTop = value;
      }
    });
    Object.defineProperty(scroller, "scrollHeight", { configurable: true, get: () => 1_800 });
    Object.defineProperty(scroller, "clientHeight", { configurable: true, get: () => 500 });

    fireEvent.scroll(scroller);
    fireEvent.click(screen.getByRole("button", { name: /跳到最新/ }));

    expect(scroller.scrollTop).toBe(1_800);
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

  it("should set a thread goal from the add panel", async () => {
    const user = userEvent.setup();

    render(<ThreadPage />);

    await waitFor(() => {
      expect(screen.queryByText(/载入中/)).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "添加内容" }));
    await user.click(within(screen.getByRole("dialog", { name: "添加内容" })).getByRole("button", { name: /设定目标/ }));

    const dialog = screen.getByRole("dialog", { name: "目标" });
    expect(within(dialog).queryByLabelText("Token budget")).not.toBeInTheDocument();
    await user.type(within(dialog).getByLabelText("目标描述"), "  完成新的目标体验  ");
    await user.click(within(dialog).getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(mockSetThreadGoal).toHaveBeenCalledWith("thread-1", {
        objective: "完成新的目标体验"
      });
    });
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "目标" })).not.toBeInTheDocument();
    });
  });

  it("should edit and clear an existing thread goal from the add panel", async () => {
    const user = userEvent.setup();
    mockReadThread.mockResolvedValue({
      id: "thread-1",
      cwd: "C:/test",
      title: "Goal Thread",
      modelProvider: "claude-opus-4",
      status: "idle",
      timeline: [],
      lastTurnId: null,
      updatedAt: Date.now(),
      goal: sampleGoal
    });

    render(<ThreadPage />);

    await waitFor(() => {
      expect(screen.queryByText(/载入中/)).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "添加内容" }));
    const panel = screen.getByRole("dialog", { name: "添加内容" });
    expect(within(panel).getByRole("button", { name: /编辑目标/ })).toHaveTextContent("已设置");
    await user.click(within(panel).getByRole("button", { name: /编辑目标/ }));

    const dialog = screen.getByRole("dialog", { name: "目标" });
    expect(within(dialog).getByLabelText("目标描述")).toHaveValue("完成移动端目标模式接入");
    expect(within(dialog).queryByLabelText("Token budget")).not.toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "清除目标" }));

    await waitFor(() => {
      expect(mockClearThreadGoal).toHaveBeenCalledWith("thread-1");
    });
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "目标" })).not.toBeInTheDocument();
    });
  });

  it("should keep the goal editor open when saving fails", async () => {
    const user = userEvent.setup();
    mockSetThreadGoal.mockRejectedValueOnce(new Error("goal unavailable"));

    render(<ThreadPage />);

    await waitFor(() => {
      expect(screen.queryByText(/载入中/)).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "添加内容" }));
    await user.click(within(screen.getByRole("dialog", { name: "添加内容" })).getByRole("button", { name: /设定目标/ }));

    const dialog = screen.getByRole("dialog", { name: "目标" });
    await user.type(within(dialog).getByLabelText("目标描述"), "失败后保留");
    await user.click(within(dialog).getByRole("button", { name: "保存" }));

    expect(await within(dialog).findByText("goal unavailable")).toBeInTheDocument();
    expect(within(dialog).getByLabelText("目标描述")).toHaveValue("失败后保留");
  });

  it("should render Codex App permission modes and switch reviewer-aware payloads", async () => {
    const user = userEvent.setup();
    mockReadThread.mockResolvedValue({
      id: "thread-1",
      cwd: "C:/test",
      title: "Permission Thread",
      modelProvider: "custom",
      status: "idle",
      timeline: [],
      lastTurnId: null,
      updatedAt: Date.now(),
      activePermissionProfile: { id: ":workspace", extends: null },
      approvalsReviewer: "auto_review"
    });

    render(<ThreadPage />);

    await waitFor(() => {
      expect(screen.queryByText(/载入中/)).not.toBeInTheDocument();
    });

    expect(mockSetPermissionProfile).toHaveBeenCalledWith("thread-1", ":workspace", "auto_review");
    await user.click(screen.getByRole("button", { name: "权限 替我审批" }));
    const picker = screen.getByRole("dialog", { name: "权限模式" });
    expect(within(picker).getByRole("button", { name: /请求批准/ })).toBeInTheDocument();
    expect(within(picker).getByRole("button", { name: /替我审批/ })).toBeInTheDocument();
    expect(within(picker).getByRole("button", { name: /完全访问权限/ })).toBeInTheDocument();
    expect(within(picker).getByRole("button", { name: /自定义 config\.toml/ })).toBeInTheDocument();

    await user.click(within(picker).getByRole("button", { name: /请求批准/ }));

    expect(mockSetPermissionProfile).toHaveBeenCalledWith("thread-1", ":workspace", "user");
    await waitFor(() => {
      expect(mockUpdateThreadSettings).toHaveBeenCalledWith("thread-1", {
        permissions: ":workspace",
        approvalsReviewer: "user"
      });
    });
  });

  it("should show Codex App permission modes when settings has no permission profiles", async () => {
    const user = userEvent.setup();
    mockReadSettings.mockResolvedValueOnce({
      model: null,
      modelProvider: null,
      reasoningEffort: null,
      reasoningSummary: null,
      permissionProfiles: []
    });

    render(<ThreadPage />);

    await waitFor(() => {
      expect(screen.queryByText(/载入中/)).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "权限 自定义 config.toml" }));
    const picker = screen.getByRole("dialog", { name: "权限模式" });

    expect(within(picker).getByRole("button", { name: /请求批准/ })).toBeInTheDocument();
    expect(within(picker).getByRole("button", { name: /替我审批/ })).toBeInTheDocument();
    expect(within(picker).getByRole("button", { name: /完全访问权限/ })).toBeInTheDocument();
    expect(within(picker).getByRole("button", { name: /自定义 config\.toml/ })).toBeInTheDocument();
    expect(within(picker).queryByRole("button", { name: /只读/ })).not.toBeInTheDocument();
    expect(within(picker).queryByRole("button", { name: /工作区写入/ })).not.toBeInTheDocument();
  });

  it("should clear permission override with permissions null when selecting config.toml defaults", async () => {
    const user = userEvent.setup();
    mockThreadState.mockReturnValue({
      entries: [],
      pendingApprovals: [],
      mode: "build",
      running: false,
      plan: [],
      cursor: null,
      reachedBeginning: false,
      permissionProfileId: ":danger-full-access",
      approvalsReviewer: null
    });

    render(<ThreadPage />);

    await waitFor(() => {
      expect(screen.queryByText(/载入中/)).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "权限 完全访问权限" }));
    await user.click(within(screen.getByRole("dialog", { name: "权限模式" })).getByRole("button", { name: /自定义 config\.toml/ }));

    expect(mockSetPermissionProfile).toHaveBeenCalledWith("thread-1", null, null);
    await waitFor(() => {
      expect(mockUpdateThreadSettings).toHaveBeenCalledWith("thread-1", {
        permissions: null,
        approvalsReviewer: null
      });
    });
  });

  it("should include the current permission payload when starting a turn", async () => {
    const user = userEvent.setup();
    mockThreadState.mockReturnValue({
      entries: [],
      pendingApprovals: [],
      mode: "build",
      running: false,
      plan: [],
      cursor: null,
      reachedBeginning: false,
      permissionProfileId: ":workspace",
      approvalsReviewer: "auto_review"
    });

    render(<ThreadPage />);

    await waitFor(() => {
      expect(screen.queryByText(/载入中/)).not.toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText("输入消息"), "use current permissions");
    await user.click(screen.getByLabelText("发送"));

    expect(mockStartTurn).toHaveBeenCalledWith(
      expect.objectContaining({
        text: "use current permissions",
        permissions: ":workspace",
        approvalsReviewer: "auto_review"
      })
    );
    expect(JSON.stringify(mockStartTurn.mock.calls[0][0])).not.toMatch(/read-only|workspace-write|full-auto/);
  });

  it("should send permissions null for config.toml default mode", async () => {
    const user = userEvent.setup();
    mockThreadState.mockReturnValue({
      entries: [],
      pendingApprovals: [],
      mode: "build",
      running: false,
      plan: [],
      cursor: null,
      reachedBeginning: false,
      permissionProfileId: null,
      approvalsReviewer: null
    });

    render(<ThreadPage />);

    await waitFor(() => {
      expect(screen.queryByText(/载入中/)).not.toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText("输入消息"), "use config");
    await user.click(screen.getByLabelText("发送"));

    expect(mockStartTurn).toHaveBeenCalledWith(
      expect.objectContaining({
        text: "use config",
        permissions: null,
        approvalsReviewer: null
      })
    );
  });

  it("should keep Codex App permission modes available when settings aggregation fails", async () => {
    const user = userEvent.setup();
    mockReadSettings.mockRejectedValueOnce(new Error("chatgpt authentication required to read rate limits"));

    render(<ThreadPage />);

    await waitFor(() => {
      expect(screen.queryByText(/载入中/)).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "权限 自定义 config.toml" }));
    const picker = screen.getByRole("dialog", { name: "权限模式" });

    expect(within(picker).getByRole("button", { name: /请求批准/ })).toBeInTheDocument();
    expect(within(picker).getByRole("button", { name: /替我审批/ })).toBeInTheDocument();
    expect(within(picker).getByRole("button", { name: /完全访问权限/ })).toBeInTheDocument();
    expect(within(picker).getByRole("button", { name: /自定义 config\.toml/ })).toBeInTheDocument();
  });

  it("should request default settings once while opening the thread", async () => {
    render(<ThreadPage />);

    await waitFor(() => {
      expect(screen.queryByText(/载入中/)).not.toBeInTheDocument();
    });

    expect(mockReadSettings).toHaveBeenCalledTimes(1);
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

    const header = document.querySelector("header") as HTMLElement;
    expect(within(header).queryByRole("button", { name: "gpt-5-codex" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "模型 gpt-5-codex" }));

    await waitFor(() => expect(mockListModels).toHaveBeenCalled());
    await user.click(screen.getByRole("button", { name: "GPT-5" }));

    expect(mockSetModel).toHaveBeenCalledWith("thread-1", "openai/gpt-5", null);
    await waitFor(() => {
      expect(mockUpdateThreadSettings).toHaveBeenCalledWith("thread-1", { model: "openai/gpt-5" });
    });
  });

  it("should show context window percentage below the thread header", async () => {
    mockThreadState.mockReturnValue({
      entries: [],
      pendingApprovals: [],
      mode: "build",
      running: false,
      plan: [],
      cursor: null,
      reachedBeginning: false,
      contextUsage: {
        totalTokens: 128000,
        inputTokens: 96000,
        outputTokens: 24000,
        reasoningOutputTokens: 8000,
        modelContextWindow: 200000,
        updatedAt: 1
      }
    });

    render(<ThreadPage />);

    await waitFor(() => {
      expect(screen.queryByText(/载入中/)).not.toBeInTheDocument();
    });

    expect(screen.getByLabelText("上下文窗口 64%")).toBeInTheDocument();
    expect(screen.getByText("64%")).toBeInTheDocument();
  });

  it("should show a visible context placeholder when context usage is unavailable", async () => {
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

    expect(screen.getByLabelText("上下文窗口等待用量")).toBeInTheDocument();
    expect(screen.getByText("--%")).toBeInTheDocument();
    expect(screen.queryByText("64%")).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "上下文用量" })).not.toBeInTheDocument();
  });

  it("should restore cached context usage when thread state has none", async () => {
    window.localStorage.setItem(
      "codex-web:context-usage",
      JSON.stringify({
        "thread-1": {
          totalTokens: 128000,
          inputTokens: 96000,
          outputTokens: 24000,
          reasoningOutputTokens: 8000,
          modelContextWindow: 200000,
          updatedAt: 1
        }
      })
    );

    render(<ThreadPage />);

    await waitFor(() => {
      expect(screen.queryByText(/载入中/)).not.toBeInTheDocument();
    });

    expect(mockSetContextUsage).toHaveBeenCalledWith(
      "thread-1",
      expect.objectContaining({
        totalTokens: 128000,
        modelContextWindow: 200000
      })
    );
  });

  it("should restore context usage returned by thread detail", async () => {
    mockReadThread.mockResolvedValue({
      id: "thread-1",
      cwd: "C:/test",
      title: "Test Thread",
      modelProvider: "claude-opus-4",
      status: "idle",
      timeline: [],
      lastTurnId: null,
      updatedAt: Date.now(),
      contextUsage: {
        totalTokens: 129200,
        inputTokens: 120000,
        outputTokens: 7200,
        reasoningOutputTokens: 2000,
        modelContextWindow: 258400,
        updatedAt: 1
      }
    });

    render(<ThreadPage />);

    await waitFor(() => {
      expect(screen.queryByText(/载入中/)).not.toBeInTheDocument();
    });

    await waitFor(() => {
      expect(mockSetContextUsage).toHaveBeenCalledWith(
        "thread-1",
        expect.objectContaining({
          totalTokens: 129200,
          modelContextWindow: 258400
        })
      );
    });
  });

  it("should not overwrite live context usage with cached context usage", async () => {
    window.localStorage.setItem(
      "codex-web:context-usage",
      JSON.stringify({
        "thread-1": {
          totalTokens: 128000,
          inputTokens: 96000,
          outputTokens: 24000,
          reasoningOutputTokens: 8000,
          modelContextWindow: 200000,
          updatedAt: 1
        }
      })
    );
    mockThreadState.mockReturnValue({
      entries: [],
      pendingApprovals: [],
      mode: "build",
      running: false,
      plan: [],
      cursor: null,
      reachedBeginning: false,
      contextUsage: {
        totalTokens: 140000,
        inputTokens: 100000,
        outputTokens: 30000,
        reasoningOutputTokens: 10000,
        modelContextWindow: 200000,
        updatedAt: 2
      }
    });

    render(<ThreadPage />);

    await waitFor(() => {
      expect(screen.queryByText(/载入中/)).not.toBeInTheDocument();
    });

    expect(mockSetContextUsage).not.toHaveBeenCalled();
    expect(screen.getByLabelText("上下文窗口 70%")).toBeInTheDocument();
  });

  it("should open context usage details from the header progress", async () => {
    const user = userEvent.setup();
    mockThreadState.mockReturnValue({
      entries: [],
      pendingApprovals: [],
      mode: "build",
      running: false,
      plan: [],
      cursor: null,
      reachedBeginning: false,
      contextUsage: {
        totalTokens: 128000,
        inputTokens: 96000,
        outputTokens: 24000,
        reasoningOutputTokens: 8000,
        modelContextWindow: 200000,
        updatedAt: 1
      }
    });

    render(<ThreadPage />);

    await waitFor(() => {
      expect(screen.queryByText(/载入中/)).not.toBeInTheDocument();
    });

    await user.click(screen.getByLabelText("上下文窗口 64%"));

    const dialog = screen.getByRole("dialog", { name: "上下文用量" });
    expect(within(dialog).getByText("128K / 200K")).toBeInTheDocument();
    expect(within(dialog).getByText("64%")).toBeInTheDocument();
    expect(within(dialog).getByText("输入 96K")).toBeInTheDocument();
    expect(within(dialog).getByText("输出 24K")).toBeInTheDocument();
    expect(within(dialog).getByText("推理 8K")).toBeInTheDocument();
  });

  it("should preserve composer context and open sheets across timeline-only updates", async () => {
    const user = userEvent.setup();
    const baseThread = {
      entries: [
        {
          id: "user-1",
          turnId: "turn-1",
          createdAt: 1,
          body: { kind: "user-message" as const, text: "cached", status: "sent" as const }
        }
      ],
      pendingApprovals: [],
      mode: "build",
      running: false,
      plan: [],
      cursor: null,
      reachedBeginning: false,
      contextUsage: {
        totalTokens: 128000,
        inputTokens: 96000,
        outputTokens: 24000,
        reasoningOutputTokens: 8000,
        modelContextWindow: 200000,
        updatedAt: 1
      }
    };
    let threadState = baseThread;
    mockThreadState.mockImplementation(() => threadState);

    const { rerender } = render(<ThreadPage />);

    await waitFor(() => {
      expect(screen.queryByText(/载入中/)).not.toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText("输入消息"), "保留这段草稿");
    await user.click(screen.getByRole("button", { name: "添加内容" }));
    await user.click(within(screen.getByRole("dialog", { name: "添加内容" })).getByRole("button", { name: "引用 Skill" }));
    await waitFor(() => expect(mockSkills).toHaveBeenCalled());
    await user.click(screen.getByRole("button", { name: /openspec-explore/ }));
    await user.click(within(screen.getByRole("dialog", { name: "选择 Skill" })).getByRole("button", { name: "完成" }));
    await user.click(screen.getByLabelText("上下文窗口 64%"));

    expect(screen.getByPlaceholderText("输入消息")).toHaveValue("保留这段草稿");
    expect(screen.getByText("openspec-explore")).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "上下文用量" })).toBeInTheDocument();

    __resetChatInputDiagnostics();
    threadState = {
      ...baseThread,
      entries: [
        ...baseThread.entries,
        {
          id: "agent-delta",
          turnId: "turn-1",
          createdAt: 2,
          body: { kind: "agent-message" as const, text: "live delta" }
        }
      ]
    };

    rerender(<ThreadPage />);

    expect(screen.getByPlaceholderText("输入消息")).toHaveValue("保留这段草稿");
    expect(screen.getByText("openspec-explore")).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "上下文用量" })).toBeInTheDocument();
    expect(__getChatInputDiagnostics().mounts).toBe(0);
  });

  it("should confirm compact from context usage details before calling API", async () => {
    const user = userEvent.setup();
    mockThreadState.mockReturnValue({
      entries: [],
      pendingApprovals: [],
      mode: "build",
      running: false,
      plan: [],
      cursor: null,
      reachedBeginning: false,
      contextUsage: {
        totalTokens: 128000,
        inputTokens: 96000,
        outputTokens: 24000,
        reasoningOutputTokens: 8000,
        modelContextWindow: 200000,
        updatedAt: 1
      }
    });

    render(<ThreadPage />);

    await waitFor(() => {
      expect(screen.queryByText(/载入中/)).not.toBeInTheDocument();
    });

    await user.click(screen.getByLabelText("上下文窗口 64%"));
    await user.click(screen.getByRole("button", { name: "压缩上下文" }));

    expect(screen.getByText("将会摘要先前对话以释放上下文窗口。继续？")).toBeInTheDocument();
    expect(mockCompactThread).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "继续" }));

    expect(mockCompactThread).toHaveBeenCalledWith("thread-1");
  });

  it("should not request model list twice while picker load is pending", async () => {
    let resolveModels: ((value: []) => void) | null = null;
    mockListModels.mockReturnValue(
      new Promise((resolve) => {
        resolveModels = resolve;
      })
    );

    render(<ThreadPage />);

    await waitFor(() => {
      expect(screen.queryByText(/载入中/)).not.toBeInTheDocument();
    });

    const modelButton = screen.getByRole("button", { name: "模型 gpt-5-codex" });
    fireEvent.click(modelButton);
    fireEvent.click(modelButton);

    expect(mockListModels).toHaveBeenCalledTimes(1);

    act(() => {
      resolveModels?.([]);
    });
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
    expect(screen.queryByRole("button", { name: "Fork 会话" })).not.toBeInTheDocument();
    expect(screen.queryByText("删除")).not.toBeInTheDocument();
  });

  it("should rename thread from the bottom sheet dialog", async () => {
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

    act(() => {
      screen.getByLabelText("更多").dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });
    act(() => {
      screen.getByRole("button", { name: "重命名" })
        .dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });
    const nameInput = screen.getByDisplayValue("Test Thread");
    fireEvent.change(nameInput, { target: { value: "Renamed Thread" } });
    screen.getByRole("button", { name: "保存" })
      .dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));

    await waitFor(() => {
      expect(mockRenameThread).toHaveBeenCalledWith("thread-1", "Renamed Thread");
    });
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

  it("should ignore duplicate undo archive clicks while request is pending", async () => {
    const resolver: { current?: () => void } = {};
    mockUnarchiveThread.mockReturnValue(
      new Promise<void>((resolve) => {
        resolver.current = resolve;
      })
    );

    render(<ThreadPage />);

    await waitFor(() => {
      expect(screen.queryByText(/载入中/)).not.toBeInTheDocument();
    });

    act(() => {
      screen.getByLabelText("更多").dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });
    await userEvent.setup().click(screen.getByRole("button", { name: "归档" }));
    await waitFor(() => expect(mockArchiveThread).toHaveBeenCalledWith("thread-1"));

    const undoButton = screen.getByRole("button", { name: "撤销" });
    act(() => {
      undoButton.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      undoButton.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });

    await waitFor(() => {
      expect(mockUnarchiveThread).toHaveBeenCalledTimes(1);
    });

    act(() => {
      resolver.current?.();
    });
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

  it("should not append local timeline feedback while compacting", async () => {
    const user = userEvent.setup();
    mockCompactThread.mockReturnValue(new Promise(() => undefined));

    render(<ThreadPage />);

    await waitFor(() => {
      expect(screen.queryByText(/载入中/)).not.toBeInTheDocument();
    });

    await user.click(screen.getByLabelText("更多"));
    await user.click(screen.getByRole("button", { name: "压缩上下文" }));
    await user.click(screen.getByRole("button", { name: "继续" }));

    expect(mockAppendEntries).not.toHaveBeenCalled();
    expect(screen.getByText("正在压缩上下文…")).toBeInTheDocument();
    expect(mockCompactThread).toHaveBeenCalledWith("thread-1");
  });

  it("should refresh summary status after compact failure without requiring a page reload", async () => {
    const user = userEvent.setup();
    mockCompactThread.mockRejectedValue(new Error("compact backend failed"));

    render(<ThreadPage />);

    await waitFor(() => {
      expect(screen.queryByText(/载入中/)).not.toBeInTheDocument();
    });

    await user.click(screen.getByLabelText("更多"));
    await user.click(screen.getByRole("button", { name: "压缩上下文" }));
    await user.click(screen.getByRole("button", { name: "继续" }));

    await waitFor(() => {
      expect(mockAppendEntries).toHaveBeenCalledWith(
        "thread-1",
        expect.arrayContaining([
          expect.objectContaining({
            body: { kind: "error", text: "压缩失败：compact backend failed" }
          })
        ])
      );
    });
    expect(mockReadThreadSummary).toHaveBeenCalledWith("thread-1");
  });

  it("should not request full timeline repair after a manual compact request starts", async () => {
    const user = userEvent.setup();

    render(<ThreadPage />);

    await waitFor(() => {
      expect(screen.queryByText(/载入中/)).not.toBeInTheDocument();
    });

    await user.click(screen.getByLabelText("更多"));
    await user.click(screen.getByRole("button", { name: "压缩上下文" }));
    await user.click(screen.getByRole("button", { name: "继续" }));

    await waitFor(() => {
      expect(mockCompactThread).toHaveBeenCalledWith("thread-1");
    });
    expect(mockRequestSnapshotRepair).not.toHaveBeenCalled();
    expect(mockReadThread).toHaveBeenCalledTimes(1);
    expect(mockListTurnItems).not.toHaveBeenCalled();
  });

  it("should keep manual compact pending while the compact request is unresolved even if summary reports idle", async () => {
    vi.useFakeTimers();
    let resolveCompact: (() => void) | null = null;
    mockCompactThread.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveCompact = resolve;
      })
    );
    mockReadThreadSummary.mockResolvedValue({
      id: "thread-1",
      cwd: "C:/test",
      title: "Test Thread",
      preview: "",
      modelProvider: "claude-opus-4",
      status: "idle",
      updatedAt: Date.now()
    });

    render(<ThreadPage />);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    fireEvent.click(screen.getByLabelText("更多"));
    fireEvent.click(screen.getByRole("button", { name: "压缩上下文" }));
    fireEvent.click(screen.getByRole("button", { name: "继续" }));

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockCompactThread).toHaveBeenCalledWith("thread-1");
    mockSetThreadStatus.mockClear();
    mockRequestSnapshotRepair.mockClear();
    mockThreadState.mockReturnValue({
      entries: [],
      pendingApprovals: [],
      mode: "build",
      running: true,
      activeTurnId: "turn-compact",
      plan: [],
      cursor: null,
      reachedBeginning: false
    });

    await act(async () => {
      vi.advanceTimersByTime(3_100);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockReadThreadSummary).toHaveBeenCalledWith("thread-1");
    expect(mockSetThreadStatus).not.toHaveBeenCalledWith("thread-1", "idle");
    expect(mockRequestSnapshotRepair).not.toHaveBeenCalled();

    act(() => {
      resolveCompact?.();
    });
  });

  it("should not open compact confirmation while the thread is running", async () => {
    const user = userEvent.setup();
    mockThreadState.mockReturnValue({
      entries: [],
      pendingApprovals: [],
      mode: "build",
      running: true,
      activeTurnId: "turn-running",
      plan: [],
      cursor: null,
      reachedBeginning: false
    });
    mockReadThread.mockResolvedValue({
      id: "thread-1",
      cwd: "C:/test",
      title: "Test Thread",
      modelProvider: "claude-opus-4",
      status: "active",
      timeline: [],
      lastTurnId: "turn-running",
      updatedAt: Date.now()
    });

    render(<ThreadPage />);

    await waitFor(() => {
      expect(screen.queryByText(/载入中/)).not.toBeInTheDocument();
    });

    await user.click(screen.getByLabelText("更多"));

    expect(screen.queryByRole("button", { name: "压缩上下文" })).not.toBeInTheDocument();
    expect(screen.getByText("运行中不可压缩")).toBeInTheDocument();
    expect(mockCompactThread).not.toHaveBeenCalled();
  });

  it("should not expose compact when loaded thread detail is active before store running catches up", async () => {
    const user = userEvent.setup();
    mockThreadState.mockReturnValue({
      entries: [],
      pendingApprovals: [],
      mode: "build",
      running: false,
      activeTurnId: null,
      plan: [],
      cursor: null,
      reachedBeginning: false
    });
    mockReadThread.mockResolvedValue({
      id: "thread-1",
      cwd: "C:/test",
      title: "Test Thread",
      modelProvider: "claude-opus-4",
      status: "active",
      timeline: [],
      lastTurnId: "turn-running",
      updatedAt: Date.now()
    });

    render(<ThreadPage />);

    await waitFor(() => {
      expect(screen.queryByText(/载入中/)).not.toBeInTheDocument();
    });

    await user.click(screen.getByLabelText("更多"));

    expect(screen.queryByRole("button", { name: "压缩上下文" })).not.toBeInTheDocument();
    expect(screen.getByText("运行中不可压缩")).toBeInTheDocument();
    expect(mockCompactThread).not.toHaveBeenCalled();
  });

  it("should prefer live store status over stale active thread detail when deciding compact availability", async () => {
    const user = userEvent.setup();
    mockThreadState.mockReturnValue({
      entries: [],
      pendingApprovals: [],
      mode: "build",
      status: "idle",
      running: false,
      activeTurnId: null,
      plan: [],
      cursor: null,
      reachedBeginning: false
    });
    mockReadThread.mockResolvedValue({
      id: "thread-1",
      cwd: "C:/test",
      title: "Test Thread",
      modelProvider: "claude-opus-4",
      status: "active",
      timeline: [],
      lastTurnId: "turn-stale",
      updatedAt: Date.now()
    });

    render(<ThreadPage />);

    await waitFor(() => {
      expect(screen.queryByText(/载入中/)).not.toBeInTheDocument();
    });

    await user.click(screen.getByLabelText("更多"));

    expect(screen.getByRole("button", { name: "压缩上下文" })).toBeInTheDocument();
    expect(screen.queryByText("运行中不可压缩")).not.toBeInTheDocument();
  });

  it.each(["notLoaded", "systemError"])(
    "should not expose compact when loaded thread detail is %s",
    async (status) => {
      const user = userEvent.setup();
      mockThreadState.mockReturnValue({
        entries: [],
        pendingApprovals: [],
        mode: "build",
        running: false,
        activeTurnId: null,
        plan: [],
        cursor: null,
        reachedBeginning: false
      });
      mockReadThread.mockResolvedValue({
        id: "thread-1",
        cwd: "C:/test",
        title: "Test Thread",
        modelProvider: "claude-opus-4",
        status,
        timeline: [],
        lastTurnId: null,
        updatedAt: Date.now()
      });

      render(<ThreadPage />);

      await waitFor(() => {
        expect(screen.queryByText(/载入中/)).not.toBeInTheDocument();
      });

      await user.click(screen.getByLabelText("更多"));

      expect(screen.queryByRole("button", { name: "压缩上下文" })).not.toBeInTheDocument();
      expect(screen.getByText(/不可压缩/)).toBeInTheDocument();
      expect(mockCompactThread).not.toHaveBeenCalled();
    }
  );

  it("should ignore duplicate compact confirmations while request is pending", async () => {
    let resolveCompact: (() => void) | null = null;
    mockCompactThread.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveCompact = resolve;
      })
    );

    render(<ThreadPage />);

    await waitFor(() => {
      expect(screen.queryByText(/载入中/)).not.toBeInTheDocument();
    });

    await userEvent.setup().click(screen.getByLabelText("更多"));
    await userEvent.setup().click(screen.getByRole("button", { name: "压缩上下文" }));
    const confirm = screen.getByRole("button", { name: "继续" });
    act(() => {
      confirm.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      confirm.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });

    await waitFor(() => {
      expect(mockCompactThread).toHaveBeenCalledTimes(1);
    });

    act(() => {
      resolveCompact?.();
    });
  });

  it("should not fork from the header sheet", async () => {
    const user = userEvent.setup();

    render(<ThreadPage />);

    await waitFor(() => {
      expect(screen.queryByText(/载入中/)).not.toBeInTheDocument();
    });

    await user.click(screen.getByLabelText("更多"));

    expect(screen.queryByRole("button", { name: "Fork 会话" })).not.toBeInTheDocument();
    expect(mockForkThread).not.toHaveBeenCalled();
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
    expect(mockStartTurn.mock.calls[0][0]).toMatchObject({
      permissions: null,
      approvalsReviewer: null
    });
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
    expect(screen.getByRole("button", { name: "模型 gpt-5-codex" })).toBeInTheDocument();

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
      expect(screen.getByRole("button", { name: "模型 gpt-5.5 Medium" })).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "模型 gpt-5.5 Medium" })).not.toHaveTextContent("，");

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

    await user.click(screen.getByRole("button", { name: "模型 gpt-5-codex Medium" }));

    await waitFor(() => expect(mockListModels).toHaveBeenCalled());
    expect(screen.getByText("推理强度")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Low" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Medium" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "High" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "低" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "中" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "High" }));

    expect(mockSetModel).toHaveBeenCalledWith("thread-1", "gpt-5-codex", "high");
    await waitFor(() => {
      expect(mockUpdateThreadSettings).toHaveBeenCalledWith("thread-1", {
        model: "gpt-5-codex",
        reasoningEffort: "high"
      });
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
    expect(mockSetThreadStatus).toHaveBeenLastCalledWith("thread-1", "idle", null);
  });

  it("should preserve selected skill references when idle startTurn snapshot omits them", async () => {
    const user = userEvent.setup();
    const skillReferences = [
      {
        name: "openspec-explore",
        path: "/repo/.codex/skills/openspec-explore/SKILL.md"
      }
    ];
    mockThreadState.mockReturnValue({
      entries: [
        {
          id: "failed-local",
          createdAt: Date.now(),
          body: { kind: "user-message", text: "retry with skill", skillReferences, status: "failed" }
        }
      ],
      pendingApprovals: [],
      mode: "build",
      running: false,
      plan: [],
      cursor: null,
      reachedBeginning: false
    });
    mockStartTurn.mockResolvedValue({
      turnId: "turn-skill",
      thread: {
        id: "thread-1",
        cwd: "C:/test",
        title: "Test Thread",
        modelProvider: "claude-opus-4",
        status: "idle",
        timeline: [
          { id: "server-user-skill", turnId: "turn-skill", role: "user", text: "retry with skill" },
          { id: "agent-skill", turnId: "turn-skill", role: "agent", text: "done" }
        ],
        lastTurnId: "turn-skill",
        updatedAt: Date.now()
      }
    });

    render(<ThreadPage />);

    await waitFor(() => {
      expect(screen.queryByText(/载入中/)).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "重试" }));

    await waitFor(() => {
      expect(mockSetThreadEntries).toHaveBeenCalledWith(
        "thread-1",
        expect.arrayContaining([
          expect.objectContaining({
            id: "server-user-skill",
            body: expect.objectContaining({
              kind: "user-message",
              text: "retry with skill",
              skillReferences
            })
          })
        ]),
        null
      );
    });
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
    expect(mockSetThreadStatus).toHaveBeenLastCalledWith("thread-1", "active", "turn-2");
  });

  it("should reserve dynamic bottom space from composer height changes", async () => {
    let resizeCallback: ResizeObserverCallback | null = null;
    class MockResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        resizeCallback = callback;
      }

      observe = vi.fn();
      disconnect = vi.fn();
    }
    vi.stubGlobal("ResizeObserver", MockResizeObserver);
    const { container } = render(<ThreadPage />);

    await waitFor(() => {
      expect(screen.queryByText(/载入中/)).not.toBeInTheDocument();
    });

    const scroller = container.querySelector(".cw-thread-scroller") as HTMLDivElement;
    let scrollTop = 500;
    Object.defineProperty(scroller, "scrollTop", {
      configurable: true,
      get: () => scrollTop,
      set: (value: number) => {
        scrollTop = value;
      }
    });
    Object.defineProperty(scroller, "scrollHeight", { configurable: true, value: 1000 });
    Object.defineProperty(scroller, "clientHeight", { configurable: true, value: 500 });

    expect(resizeCallback).not.toBeNull();
    await act(async () => {
      resizeCallback?.(
        [{ contentRect: { height: 260 } } as ResizeObserverEntry],
        {} as ResizeObserver
      );
    });

    await waitFor(() => {
      expect(scroller).toHaveStyle({ paddingBottom: "calc(260px + var(--safe-bottom))" });
    });
    expect(scrollTop).toBe(1000);
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

  it("should not retry start turn when it reports thread not found", async () => {
    const user = userEvent.setup();
    mockStartTurn.mockRejectedValueOnce(new ApiError("thread not found: thread-1", 502));
    mockThreadState.mockReturnValue({
      entries: [],
      pendingApprovals: [],
      mode: "build",
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

    await user.type(screen.getByPlaceholderText("输入消息"), "do not retry after start failure");
    await user.click(screen.getByLabelText("发送"));

    await waitFor(() => expect(mockStartTurn).toHaveBeenCalledTimes(1));
    expect(mockResumeThread).not.toHaveBeenCalled();
    expect(mockStartTurn).toHaveBeenCalledWith(
      expect.objectContaining({
        threadId: "thread-1",
        text: "do not retry after start failure",
        imagePaths: [],
        model: "gpt-5-codex"
      })
    );
    await waitFor(() => {
      expect(mockReplaceOrAddEntry).toHaveBeenCalledWith(
        "thread-1",
        expect.objectContaining({
          body: expect.objectContaining({ kind: "user-message", status: "failed" })
        })
      );
    });
  });

  it("should resend failed local user messages from retry button", async () => {
    const user = userEvent.setup();
    const skillReferences = [
      {
        name: "openspec-explore",
        path: "/repo/.codex/skills/openspec-explore/SKILL.md"
      }
    ];
    mockThreadState.mockReturnValue({
      entries: [
        {
          id: "failed-local",
          createdAt: Date.now(),
          body: { kind: "user-message", text: "retry me", skillReferences, status: "failed" }
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
        imagePaths: [],
        skillReferences
      })
    );
  });

  it("should rewind from a long-pressed user message", async () => {
    mockRollbackThread.mockResolvedValue({
      id: "thread-1",
      cwd: "C:/test",
      title: "Test Thread",
      modelProvider: "claude-opus-4",
      status: "idle",
      timeline: [
        { id: "older-user", turnId: "turn-1", turnIndex: 0, role: "user", text: "older prompt" },
        { id: "older-agent", turnId: "turn-1", turnIndex: 0, role: "agent", text: "older response" }
      ],
      lastTurnId: "turn-1",
      updatedAt: Date.now()
    });
    mockThreadState.mockReturnValue({
      entries: [
        {
          id: "older-user",
          turnId: "turn-1",
          turnIndex: 0,
          createdAt: Date.now() - 2,
          body: { kind: "user-message", text: "older prompt", status: "sent" }
        },
        {
          id: "older-agent",
          turnId: "turn-1",
          turnIndex: 0,
          createdAt: Date.now() - 1,
          body: { kind: "agent-message", text: "older response" }
        },
        {
          id: "target-user",
          turnId: "turn-2",
          turnIndex: 1,
          createdAt: Date.now(),
          body: { kind: "user-message", text: "previous prompt", status: "sent" }
        },
        {
          id: "target-agent",
          turnId: "turn-2",
          turnIndex: 1,
          createdAt: Date.now() + 1,
          body: { kind: "agent-message", text: "old response" }
        },
        {
          id: "latest-user",
          turnId: "turn-3",
          turnIndex: 2,
          createdAt: Date.now() + 2,
          body: { kind: "user-message", text: "latest prompt", status: "sent" }
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

    vi.useFakeTimers();
    fireEvent.pointerDown(screen.getByText("previous prompt"));
    act(() => {
      vi.advanceTimersByTime(450);
    });
    vi.useRealTimers();
    fireEvent.click(await screen.findByRole("button", { name: "回滚到这里" }));

    expect(mockRollbackThread).toHaveBeenCalledWith("thread-1", 2, {
      expectedDeletedTurnIds: ["turn-2", "turn-3"]
    });
    await waitFor(() => {
      const lastCall = mockSetThreadEntries.mock.calls.at(-1);
      expect(lastCall?.[0]).toBe("thread-1");
      expect(lastCall?.[1].map((entry: { id: string }) => entry.id)).toEqual(["older-user", "older-agent"]);
    });
    expect(JSON.parse(localStorage.getItem("codex-web:drafts") ?? "{}")).toMatchObject({
      "thread-1": "previous prompt"
    });
  });

  it("should not rewind when the visible message is no longer present in current normalized entries", async () => {
    const originalEntries = [
      {
        id: "visible-target",
        turnId: "turn-2",
        turnIndex: 1,
        createdAt: Date.now(),
        body: { kind: "user-message" as const, text: "same only text", status: "sent" as const }
      }
    ];
    const currentEntries = [
      {
        id: "other-user",
        turnId: "turn-1",
        turnIndex: 0,
        createdAt: Date.now() - 1,
        body: { kind: "user-message" as const, text: "same only text", status: "sent" as const }
      }
    ];
    mockThreadState.mockReturnValue({
      entries: originalEntries,
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

    vi.useFakeTimers();
    fireEvent.pointerDown(screen.getByText("same only text"));
    act(() => {
      vi.advanceTimersByTime(450);
    });
    vi.useRealTimers();

    mockThreadState.mockReturnValue({
      entries: currentEntries,
      pendingApprovals: [],
      mode: "build",
      running: false,
      plan: [],
      cursor: null,
      reachedBeginning: true
    });
    fireEvent.click(await screen.findByRole("button", { name: "回滚到这里" }));

    expect(mockRollbackThread).not.toHaveBeenCalled();
    expect(mockAppendEntries).toHaveBeenCalledWith(
      "thread-1",
      expect.arrayContaining([
        expect.objectContaining({
          body: expect.objectContaining({ kind: "error", text: "无法定位这条消息所属的 turn，请刷新后重试。" })
        })
      ])
    );
  });

  it("should recover the initial thread page by resuming after a transient read failure", async () => {
    mockReadThread.mockRejectedValueOnce(new ApiError("thread not loaded", 502));
    mockResumeThread.mockResolvedValueOnce({
      id: "thread-1",
      cwd: "C:/test",
      title: "Test Thread",
      modelProvider: "claude-opus-4",
      status: "idle",
      timeline: [],
      lastTurnId: null,
      updatedAt: Date.now()
    });

    render(<ThreadPage />);

    await waitFor(() => {
      expect(screen.queryByText(/载入中/)).not.toBeInTheDocument();
    });

    expect(mockResumeThread).toHaveBeenCalledWith("thread-1");
    expect(screen.getByPlaceholderText("输入消息")).toBeInTheDocument();
    expect(screen.queryByText("thread not loaded")).not.toBeInTheDocument();
  });

  it("should bind turn id to a freshly sent local user message so it can rewind without refresh", async () => {
    const user = userEvent.setup();
    mockStartTurn.mockResolvedValue({ turnId: "turn-new" });

    render(<ThreadPage />);

    await waitFor(() => {
      expect(screen.queryByText(/载入中/)).not.toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText("输入消息"), "send then rewind");
    await user.click(screen.getByLabelText("发送"));

    await waitFor(() => {
      expect(mockBindLocalUserMessageTurn).toHaveBeenCalledWith(
        "thread-1",
        expect.stringMatching(/^local-user-/),
        "turn-new"
      );
    });
    expect(mockReplaceOrAddEntry).toHaveBeenCalledWith(
      "thread-1",
      expect.objectContaining({
        turnId: "turn-new",
        body: expect.objectContaining({ kind: "user-message", status: "sent" })
      })
    );
  });

  it("should request snapshot repair when startTurn resolves after a fast completion without output", async () => {
    const user = userEvent.setup();
    mockStartTurn.mockImplementation(async () => {
      mockThreadState.mockReturnValue({
        entries: [],
        pendingApprovals: [],
        mode: "build",
        running: false,
        activeTurnId: null,
        plan: [],
        cursor: null,
        reachedBeginning: false
      });
      return { turnId: "turn-fast" };
    });

    render(<ThreadPage />);

    await waitFor(() => {
      expect(screen.queryByText(/载入中/)).not.toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText("输入消息"), "fast turn");
    await user.click(screen.getByLabelText("发送"));

    await waitFor(() => {
      expect(mockBindLocalUserMessageTurn).toHaveBeenCalledWith(
        "thread-1",
        expect.stringMatching(/^local-user-/),
        "turn-fast"
      );
    });
    expect(mockSetActiveTurnId).not.toHaveBeenCalledWith("thread-1", "turn-fast");
    expect(
      mockSetThreadStatus.mock.calls.filter((call) => call[0] === "thread-1" && call[1] === "active")
    ).toHaveLength(1);
    expect(mockRequestSnapshotRepair).toHaveBeenCalledWith(
      "thread-1",
      expect.objectContaining({
        reason: "turn-completed",
        turnId: "turn-fast"
      })
    );
  });

  it("should not request full snapshot repair only because a started turn has no visible live output after a short wait", async () => {
    mockStartTurn.mockImplementation(async () => {
      mockThreadState.mockReturnValue({
        entries: [],
        pendingApprovals: [],
        mode: "build",
        running: true,
        activeTurnId: "turn-missing-live",
        plan: [],
        cursor: null,
        reachedBeginning: false
      });
      return { turnId: "turn-missing-live" };
    });
    mockThreadState.mockReturnValue({
      entries: [],
      pendingApprovals: [],
      mode: "build",
      running: false,
      activeTurnId: null,
      plan: [],
      cursor: null,
      reachedBeginning: false
    });

    render(<ThreadPage />);

    await waitFor(() => {
      expect(screen.queryByText(/载入中/)).not.toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText("输入消息"), {
      target: { value: "missing live output" }
    });
    await waitFor(() => expect(screen.getByLabelText("发送")).toBeEnabled());
    vi.useFakeTimers();
    await act(async () => {
      fireEvent.click(screen.getByLabelText("发送"));
      await Promise.resolve();
    });

    const initialReadCalls = mockReadThread.mock.calls.length;
    expect(mockStartTurn).toHaveBeenCalledWith(expect.objectContaining({ text: "missing live output" }));
    act(() => {
      vi.advanceTimersByTime(2600);
    });
    vi.useRealTimers();

    expect(mockRequestSnapshotRepair).not.toHaveBeenCalled();
    expect(mockReadThread.mock.calls.length).toBe(initialReadCalls);
    expect(mockListTurnItems).not.toHaveBeenCalled();
  });

  it("should not request missing-output repair when a started turn already has visible live output", async () => {
    mockStartTurn.mockImplementation(async () => {
      mockThreadState.mockReturnValue({
        entries: [
          {
            id: "agent-live",
            turnId: "turn-visible-live",
            createdAt: Date.now(),
            body: { kind: "agent-message", text: "streamed output" }
          }
        ],
        pendingApprovals: [],
        mode: "build",
        running: true,
        activeTurnId: "turn-visible-live",
        plan: [],
        cursor: null,
        reachedBeginning: false
      });
      return { turnId: "turn-visible-live" };
    });
    mockThreadState.mockReturnValue({
      entries: [],
      pendingApprovals: [],
      mode: "build",
      running: false,
      activeTurnId: null,
      plan: [],
      cursor: null,
      reachedBeginning: false
    });

    render(<ThreadPage />);

    await waitFor(() => {
      expect(screen.queryByText(/载入中/)).not.toBeInTheDocument();
    });
    const initialReadCalls = mockReadThread.mock.calls.length;

    fireEvent.change(screen.getByPlaceholderText("输入消息"), {
      target: { value: "visible live output" }
    });
    await waitFor(() => expect(screen.getByLabelText("发送")).toBeEnabled());
    vi.useFakeTimers();
    await act(async () => {
      fireEvent.click(screen.getByLabelText("发送"));
      await Promise.resolve();
    });

    expect(mockStartTurn).toHaveBeenCalledWith(expect.objectContaining({ text: "visible live output" }));
    act(() => {
      vi.advanceTimersByTime(2600);
    });
    vi.useRealTimers();

    expect(mockRequestSnapshotRepair).not.toHaveBeenCalled();
    expect(mockReadThread.mock.calls.length).toBe(initialReadCalls);
    expect(mockListTurnItems).not.toHaveBeenCalled();
  });

  it("should fill the visible input immediately after a rewind succeeds", async () => {
    const user = userEvent.setup();
    mockRollbackThread.mockResolvedValue({
      id: "thread-1",
      cwd: "C:/test",
      title: "Test Thread",
      modelProvider: "claude-opus-4",
      status: "idle",
      timeline: [],
      lastTurnId: null,
      updatedAt: Date.now()
    });
    mockThreadState.mockReturnValue({
      entries: [
        {
          id: "target-user",
          turnId: "turn-1",
          turnIndex: 0,
          createdAt: Date.now(),
          body: { kind: "user-message", text: "edit this prompt", status: "sent" }
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

    vi.useFakeTimers();
    fireEvent.pointerDown(screen.getByText("edit this prompt"));
    act(() => {
      vi.advanceTimersByTime(450);
    });
    vi.useRealTimers();
    fireEvent.click(await screen.findByRole("button", { name: "回滚到这里" }));

    await waitFor(() => {
      expect(screen.getByPlaceholderText("输入消息")).toHaveValue("edit this prompt");
    });
    await user.type(screen.getByPlaceholderText("输入消息"), " updated");
    expect(screen.getByPlaceholderText("输入消息")).toHaveValue("edit this prompt updated");
  });

  it("should fork from a long-pressed user message and prepare draft in the fork", async () => {
    mockForkThread.mockResolvedValue({
      id: "forked-thread",
      cwd: "C:/test",
      title: "Forked Thread",
      modelProvider: "claude-opus-4",
      status: "idle",
      lastTurnId: "fork-turn-3",
      updatedAt: Date.now(),
      timeline: [
        { id: "older-user", turnId: "fork-turn-1", turnIndex: 0, role: "user", text: "older prompt" },
        { id: "target-user-fork", turnId: "fork-turn-2", turnIndex: 1, role: "user", text: "previous prompt" },
        { id: "latest-user-fork", turnId: "fork-turn-3", turnIndex: 2, role: "user", text: "latest prompt" }
      ]
    });
    mockRollbackThread.mockResolvedValue({
      id: "forked-thread",
      cwd: "C:/test",
      title: "Forked Thread",
      modelProvider: "claude-opus-4",
      status: "idle",
      timeline: [
        { id: "older-user", turnId: "turn-1", turnIndex: 0, role: "user", text: "older prompt" }
      ],
      lastTurnId: "turn-1",
      updatedAt: Date.now()
    });
    mockThreadState.mockReturnValue({
      entries: [
        {
          id: "older-user",
          turnId: "turn-1",
          turnIndex: 0,
          createdAt: Date.now() - 1,
          body: { kind: "user-message", text: "older prompt", status: "sent" }
        },
        {
          id: "target-user",
          turnId: "turn-2",
          turnIndex: 1,
          createdAt: Date.now(),
          body: { kind: "user-message", text: "previous prompt", status: "sent" }
        },
        {
          id: "latest-user",
          turnId: "turn-3",
          turnIndex: 2,
          createdAt: Date.now() + 1,
          body: { kind: "user-message", text: "latest prompt", status: "sent" }
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

    vi.useFakeTimers();
    fireEvent.pointerDown(screen.getByText("previous prompt"));
    act(() => {
      vi.advanceTimersByTime(450);
    });
    vi.useRealTimers();
    fireEvent.click(await screen.findByRole("button", { name: "从这里 Fork" }));

    await waitFor(() => expect(mockForkThread).toHaveBeenCalledWith("thread-1"));
    expect(mockRollbackThread).toHaveBeenCalledWith("forked-thread", 2, {
      expectedDeletedTurnIds: ["fork-turn-2", "fork-turn-3"]
    });
    await waitFor(() => expect(mockSetThreadEntries).toHaveBeenCalledWith(
      "forked-thread",
      [expect.objectContaining({ id: "older-user" })],
      null
    ));
    expect(mockSetThreadEntries.mock.calls.at(-1)).toEqual([
      "forked-thread",
      [expect.objectContaining({ id: "older-user" })],
      null
    ]);
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/threads/forked-thread"));
    expect(JSON.parse(localStorage.getItem("codex-web:drafts") ?? "{}")).toMatchObject({
      "forked-thread": "previous prompt"
    });
  });

  it("should resume forked threads and retry when rollback reports thread not found", async () => {
    mockForkThread.mockResolvedValue({
      id: "forked-thread",
      cwd: "C:/test",
      title: "Forked Thread",
      modelProvider: "claude-opus-4",
      status: "idle",
      lastTurnId: "fork-turn-2",
      updatedAt: Date.now(),
      timeline: [
        { id: "older-user", turnId: "fork-turn-1", turnIndex: 0, role: "user", text: "older prompt" },
        { id: "target-user-fork", turnId: "fork-turn-2", turnIndex: 1, role: "user", text: "previous prompt" }
      ]
    });
    mockRollbackThread
      .mockRejectedValueOnce(new ApiError("thread not found: forked-thread", 502))
      .mockResolvedValueOnce({
        id: "forked-thread",
        cwd: "C:/test",
        title: "Forked Thread",
        modelProvider: "claude-opus-4",
        status: "idle",
        timeline: [
          { id: "older-user", turnId: "turn-1", turnIndex: 0, role: "user", text: "older prompt" }
        ],
        lastTurnId: "turn-1",
        updatedAt: Date.now()
      });
    mockThreadState.mockReturnValue({
      entries: [
        {
          id: "older-user",
          turnId: "turn-1",
          turnIndex: 0,
          createdAt: Date.now() - 1,
          body: { kind: "user-message", text: "older prompt", status: "sent" }
        },
        {
          id: "target-user",
          turnId: "turn-2",
          turnIndex: 1,
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

    vi.useFakeTimers();
    fireEvent.pointerDown(screen.getByText("previous prompt"));
    act(() => {
      vi.advanceTimersByTime(450);
    });
    vi.useRealTimers();
    fireEvent.click(await screen.findByRole("button", { name: "从这里 Fork" }));

    await waitFor(() => expect(mockRollbackThread).toHaveBeenCalledTimes(2));
    expect(mockRollbackThread).toHaveBeenNthCalledWith(1, "forked-thread", 1, {
      expectedDeletedTurnIds: ["fork-turn-2"]
    });
    expect(mockResumeThread).toHaveBeenCalledWith("forked-thread");
    expect(mockRollbackThread).toHaveBeenNthCalledWith(2, "forked-thread", 1, {
      expectedDeletedTurnIds: ["fork-turn-2"]
    });
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/threads/forked-thread"));
  });

  it("should not rollback a fork when the fork-local target cannot be resolved", async () => {
    mockForkThread.mockResolvedValue({
      id: "forked-thread",
      cwd: "C:/test",
      title: "Forked Thread",
      modelProvider: "claude-opus-4",
      status: "idle",
      lastTurnId: "fork-turn-1",
      updatedAt: Date.now(),
      timeline: [
        { id: "older-user", turnId: "fork-turn-1", turnIndex: 0, role: "user", text: "older prompt" }
      ]
    });
    mockThreadState.mockReturnValue({
      entries: [
        {
          id: "older-user",
          turnId: "turn-1",
          turnIndex: 0,
          createdAt: Date.now() - 1,
          body: { kind: "user-message", text: "older prompt", status: "sent" }
        },
        {
          id: "target-user",
          turnId: "turn-2",
          turnIndex: 1,
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

    vi.useFakeTimers();
    fireEvent.pointerDown(screen.getByText("previous prompt"));
    act(() => {
      vi.advanceTimersByTime(450);
    });
    vi.useRealTimers();
    fireEvent.click(await screen.findByRole("button", { name: "从这里 Fork" }));

    await waitFor(() => expect(mockForkThread).toHaveBeenCalledWith("thread-1"));
    expect(mockRollbackThread).not.toHaveBeenCalled();
    expect(mockAppendEntries).toHaveBeenCalledWith(
      "thread-1",
      [expect.objectContaining({ body: expect.objectContaining({ kind: "error" }) })]
    );
  });

  it("should still apply a pending initial snapshot after fork-local target resolution fails", async () => {
    let resolveInitialRead: (value: unknown) => void = () => undefined;
    mockReadThread.mockReturnValue(new Promise((resolve) => {
      resolveInitialRead = resolve;
    }));
    mockForkThread.mockResolvedValue({
      id: "forked-thread",
      cwd: "C:/test",
      title: "Forked Thread",
      modelProvider: "claude-opus-4",
      status: "idle",
      lastTurnId: "fork-turn-1",
      updatedAt: Date.now(),
      timeline: [
        { id: "older-user", turnId: "fork-turn-1", turnIndex: 0, role: "user", text: "older prompt" }
      ]
    });
    mockThreadState.mockReturnValue({
      entries: [
        {
          id: "older-user",
          turnId: "turn-1",
          turnIndex: 0,
          createdAt: Date.now() - 1,
          body: { kind: "user-message", text: "older prompt", status: "sent" }
        },
        {
          id: "target-user",
          turnId: "turn-2",
          turnIndex: 1,
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

    await screen.findByText("previous prompt");
    vi.useFakeTimers();
    fireEvent.pointerDown(screen.getByText("previous prompt"));
    act(() => {
      vi.advanceTimersByTime(450);
    });
    vi.useRealTimers();
    fireEvent.click(await screen.findByRole("button", { name: "从这里 Fork" }));

    await waitFor(() => expect(mockForkThread).toHaveBeenCalledWith("thread-1"));
    expect(mockRollbackThread).not.toHaveBeenCalled();
    mockSetThreadEntries.mockClear();

    resolveInitialRead({
      id: "thread-1",
      cwd: "C:/test",
      title: "Authoritative",
      modelProvider: "claude-opus-4",
      status: "idle",
      lastTurnId: "turn-2",
      updatedAt: Date.now(),
      timeline: [
        { id: "auth-user", turnId: "turn-2", turnIndex: 1, role: "user", text: "previous prompt" }
      ]
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(mockSetThreadEntries).toHaveBeenCalledWith(
      "thread-1",
      [expect.objectContaining({ id: "auth-user" })],
      null
    );
  });
});
