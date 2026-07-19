import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import ProjectThreadsPage from "../../src/app/projects/[projectId]/page";
import { ApiError } from "../../src/web/api/client";

vi.setConfig({ testTimeout: 15_000 });

const mockPush = vi.fn();
const mockReplace = vi.fn();
const mockUseParams = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  useParams: () => mockUseParams()
}));

const mockGetProject = vi.fn();
const mockTouchProjectLastUsed = vi.fn();
vi.mock("../../src/web/storage/projects", () => ({
  getProject: (...args: unknown[]) => mockGetProject(...args),
  touchProjectLastUsed: (...args: unknown[]) => mockTouchProjectLastUsed(...args)
}));

const mockLoadSettings = vi.fn();
const mockUpdateSettings = vi.fn();
const mockMigrateLegacyDefaultModel = vi.fn();
vi.mock("../../src/web/storage/settings", () => ({
  settingsStore: {
    load: () => mockLoadSettings(),
    update: (...args: unknown[]) => mockUpdateSettings(...args)
  },
  migrateLegacyDefaultModel: (...args: unknown[]) => mockMigrateLegacyDefaultModel(...args)
}));

const mockSaveJson = vi.fn();
vi.mock("../../src/web/storage/localStore", () => ({
  saveJson: (...args: unknown[]) => mockSaveJson(...args),
  threadModeKey: (threadId: string) => `thread-mode:${threadId}`
}));

const mockListThreadsForCwd = vi.fn();
const mockStartThread = vi.fn();
const mockUpdateThreadSettings = vi.fn();
const mockReadSettings = vi.fn();
const mockCollaborationModes = vi.fn();
const mockArchiveThread = vi.fn();
const mockUnarchiveThread = vi.fn();
const mockModelCatalog = vi.fn();
vi.mock("../../src/web/api/endpoints", () => ({
  codex: {
    listThreadsForCwd: (...args: unknown[]) => mockListThreadsForCwd(...args),
    startThread: (...args: unknown[]) => mockStartThread(...args),
    settings: () => mockReadSettings(),
    collaborationModes: () => mockCollaborationModes(),
    updateThreadSettings: (...args: unknown[]) => mockUpdateThreadSettings(...args),
    archiveThread: (...args: unknown[]) => mockArchiveThread(...args),
    unarchiveThread: (...args: unknown[]) => mockUnarchiveThread(...args),
    modelCatalog: (...args: unknown[]) => mockModelCatalog(...args)
  }
}));

describe("ProjectThreadsPage", () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockReplace.mockClear();
    mockUseParams.mockReturnValue({ projectId: "proj-1" });
    mockGetProject.mockReturnValue({
      id: "proj-1",
      path: "C:/test",
      name: "Test Project",
      addedAt: Date.now(),
      lastUsedAt: Date.now()
    });
    mockTouchProjectLastUsed.mockClear();
    mockListThreadsForCwd.mockResolvedValue([]);
    mockStartThread.mockClear();
    mockUpdateThreadSettings.mockClear();
    mockUpdateThreadSettings.mockResolvedValue(undefined);
    mockReadSettings.mockClear();
    mockReadSettings.mockResolvedValue({ model: null, modelProvider: null, reasoningEffort: null });
    mockCollaborationModes.mockClear();
    mockCollaborationModes.mockResolvedValue([
      { name: "Code", mode: "default", model: "gpt-5-codex", reasoningEffort: "medium" },
      { name: "Ask", mode: "ask", model: null, reasoningEffort: null }
    ]);
    mockArchiveThread.mockClear();
    mockArchiveThread.mockResolvedValue(undefined);
    mockUnarchiveThread.mockClear();
    mockUnarchiveThread.mockResolvedValue({});
    mockSaveJson.mockClear();
    mockLoadSettings.mockReturnValue({ defaultMode: "build", defaultModel: null });
    mockMigrateLegacyDefaultModel.mockImplementation(() => mockLoadSettings());
    mockUpdateSettings.mockReset();
    mockModelCatalog.mockResolvedValue({
      catalogRevision: 3,
      appServerModelNames: ["openai/gpt-5"],
      models: [
        {
          source: "app-server",
          model: "openai/gpt-5",
          label: "GPT-5",
          contextWindow: null,
          inputModalities: ["text"],
          supportedReasoningEfforts: [],
          defaultReasoningEffort: null,
          isDefault: false
        }
      ]
    });
  });

  it("should redirect to /projects if project not found", () => {
    mockGetProject.mockReturnValue(null);

    mockUseParams.mockReturnValue({ projectId: "unknown" });

    render(<ProjectThreadsPage />);

    expect(mockReplace).toHaveBeenCalledWith("/projects");
  });

  it("should render project name and path", async () => {
    render(<ProjectThreadsPage />);

    expect(screen.getByText("Test Project")).toBeInTheDocument();
    expect(screen.getByText("C:/test")).toBeInTheDocument();
  });

  it("should switch between active and archived tabs", async () => {
    const user = userEvent.setup();
    mockListThreadsForCwd.mockResolvedValue([]);

    render(<ProjectThreadsPage />);

    const activeTab = screen.getByRole("tab", { name: "进行中" });
    const archivedTab = screen.getByRole("tab", { name: "已归档" });

    expect(activeTab).toHaveAttribute("aria-selected", "true");
    expect(archivedTab).toHaveAttribute("aria-selected", "false");

    await user.click(archivedTab);

    await waitFor(() => {
      expect(mockListThreadsForCwd).toHaveBeenCalledWith("C:/test", true);
    });

    expect(archivedTab).toHaveAttribute("aria-selected", "true");
    expect(activeTab).toHaveAttribute("aria-selected", "false");
  });

  it("should render thread list with text truncation", async () => {
    mockListThreadsForCwd.mockResolvedValue([
      {
        id: "t1",
        title: "Very long thread title that should be truncated with ellipsis when it exceeds the container width",
        preview: "Very long preview text that should also be truncated with ellipsis when it exceeds one line",
        updatedAt: Date.now() - 120_000,
        status: "idle"
      }
    ]);

    render(<ProjectThreadsPage />);

    await waitFor(() => {
      expect(screen.getByText(/Very long thread title/)).toBeInTheDocument();
    });

    const titleElement = screen.getByText(/Very long thread title/);
    const previewElement = screen.getByText(/Very long preview text/);

    expect(titleElement).toHaveStyle({ whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden" });
    expect(previewElement).toHaveStyle({ whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden" });
  });

  it("should keep long project thread lists scrollable inside the mobile viewport", async () => {
    mockListThreadsForCwd.mockResolvedValue(
      Array.from({ length: 24 }, (_, i) => ({
        id: `t${i}`,
        title: `Thread ${i}`,
        preview: `Preview ${i}`,
        updatedAt: Date.now() - i * 60_000,
        status: "idle"
      }))
    );

    const { container } = render(<ProjectThreadsPage />);

    await waitFor(() => {
      expect(screen.getByText("Thread 23")).toBeInTheDocument();
    });

    const main = container.querySelector("main");
    expect(main).toHaveStyle({
      display: "flex",
      flexDirection: "column",
      height: "100dvh",
      overflow: "hidden"
    });

    expect(screen.getByTestId("project-thread-scroll")).toHaveStyle({
      flex: "1 1 0%",
      minHeight: "0",
      overflowY: "auto"
    });
  });

  it("should format second-based updatedAt values as real dates", async () => {
    mockListThreadsForCwd.mockResolvedValue([
      {
        id: "t-seconds",
        title: "Seconds timestamp",
        preview: "Preview",
        updatedAt: Math.floor((Date.now() - 120_000) / 1000),
        status: "idle"
      }
    ]);

    render(<ProjectThreadsPage />);

    await waitFor(() => {
      expect(screen.getByText("2 分钟前")).toBeInTheDocument();
    });
    expect(screen.queryByText(/1970/)).not.toBeInTheDocument();
  });

  it("should show empty state for active tab", async () => {
    mockListThreadsForCwd.mockResolvedValue([]);

    render(<ProjectThreadsPage />);

    await waitFor(() => {
      expect(screen.getByText("这个项目还没有会话")).toBeInTheDocument();
    });

    expect(screen.getByText("开始第一个会话")).toBeInTheDocument();
  });

  it("should show empty state for archived tab", async () => {
    const user = userEvent.setup();
    mockListThreadsForCwd.mockResolvedValue([]);

    render(<ProjectThreadsPage />);

    const archivedTab = screen.getByRole("tab", { name: "已归档" });
    await user.click(archivedTab);

    await waitFor(() => {
      expect(screen.getByText("暂无归档会话")).toBeInTheDocument();
    });

    expect(screen.queryByText("开始第一个会话")).not.toBeInTheDocument();
  });

  it("should show running indicator for active threads", async () => {
    mockListThreadsForCwd.mockResolvedValue([
      {
        id: "t1",
        title: "Running thread",
        preview: "Some text",
        updatedAt: Date.now(),
        status: "running"
      }
    ]);

    render(<ProjectThreadsPage />);

    await waitFor(() => {
      expect(screen.getByText("正在运行")).toBeInTheDocument();
    });
  });

  it("should navigate to thread on click", async () => {
    const user = userEvent.setup();
    mockListThreadsForCwd.mockResolvedValue([
      {
        id: "t1",
        title: "Test thread",
        preview: "Preview",
        updatedAt: Date.now(),
        status: "idle"
      }
    ]);

    render(<ProjectThreadsPage />);

    await waitFor(() => {
      expect(screen.getByText("Test thread")).toBeInTheDocument();
    });

    const threadRow = screen.getByText("Test thread").closest("li");
    await user.click(threadRow!);

    expect(mockPush).toHaveBeenCalledWith("/threads/t1");
  });

  it("should open thread action sheet on long press without navigating", async () => {
    mockListThreadsForCwd.mockResolvedValue([
      {
        id: "t1",
        title: "Long press thread",
        preview: "Preview",
        updatedAt: Date.now(),
        status: "idle"
      }
    ]);

    render(<ProjectThreadsPage />);

    await waitFor(() => {
      expect(screen.getByText("Long press thread")).toBeInTheDocument();
    });

    const threadRow = screen.getByText("Long press thread").closest("li");
    triggerLongPress(threadRow!);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "归档" })).toBeInTheDocument();
    });

    threadRow!.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("should cancel thread long press when pointer moves like list scrolling", async () => {
    mockListThreadsForCwd.mockResolvedValue([
      {
        id: "t-scroll",
        title: "Scroll cancel target",
        preview: "Preview",
        updatedAt: Date.now(),
        status: "idle"
      }
    ]);

    render(<ProjectThreadsPage />);

    await waitFor(() => {
      expect(screen.getByText("Scroll cancel target")).toBeInTheDocument();
    });

    const threadRow = screen.getByText("Scroll cancel target").closest("li")!;
    vi.useFakeTimers();
    threadRow.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        cancelable: true,
        clientX: 10,
        clientY: 10
      })
    );
    threadRow.dispatchEvent(
      new PointerEvent("pointermove", {
        bubbles: true,
        cancelable: true,
        clientX: 10,
        clientY: 30
      })
    );
    act(() => {
      vi.advanceTimersByTime(501);
    });
    vi.useRealTimers();

    expect(screen.queryByRole("button", { name: "归档" })).not.toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("should archive active thread from long press sheet and remove it from current list", async () => {
    const user = userEvent.setup();
    mockListThreadsForCwd.mockResolvedValue([
      {
        id: "t-active",
        title: "Active archive target",
        preview: "Preview",
        updatedAt: Date.now(),
        status: "idle"
      }
    ]);

    render(<ProjectThreadsPage />);

    await waitFor(() => {
      expect(screen.getByText("Active archive target")).toBeInTheDocument();
    });

    triggerLongPress(screen.getByText("Active archive target").closest("li")!);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "归档" })).toBeInTheDocument();
    });
    expect(screen.queryByRole("button", { name: "移出归档" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "归档" }));

    await waitFor(() => {
      expect(mockArchiveThread).toHaveBeenCalledWith("t-active");
      expect(screen.queryByText("Active archive target")).not.toBeInTheDocument();
    });
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("should unarchive archived thread from long press sheet and remove it from current list", async () => {
    const user = userEvent.setup();
    mockListThreadsForCwd.mockImplementation((_cwd: string, archived: boolean) =>
      Promise.resolve(
        archived
          ? [
              {
                id: "t-archived",
                title: "Archived restore target",
                preview: "Preview",
                updatedAt: Date.now(),
                status: "idle"
              }
            ]
          : []
      )
    );

    render(<ProjectThreadsPage />);

    await user.click(screen.getByRole("tab", { name: "已归档" }));

    await waitFor(() => {
      expect(screen.getByText("Archived restore target")).toBeInTheDocument();
    });

    triggerLongPress(screen.getByText("Archived restore target").closest("li")!);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "移出归档" })).toBeInTheDocument();
    });
    expect(screen.queryByRole("button", { name: "归档" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "移出归档" }));

    await waitFor(() => {
      expect(mockUnarchiveThread).toHaveBeenCalledWith("t-archived");
      expect(screen.queryByText("Archived restore target")).not.toBeInTheDocument();
    });
    expect(screen.getByRole("tab", { name: "已归档" })).toHaveAttribute("aria-selected", "true");
  });

  it("should keep thread in list and show error when archive action fails", async () => {
    const user = userEvent.setup();
    mockArchiveThread.mockRejectedValueOnce(new Error("归档失败"));
    mockListThreadsForCwd.mockResolvedValue([
      {
        id: "t-fail",
        title: "Archive failure target",
        preview: "Preview",
        updatedAt: Date.now(),
        status: "idle"
      }
    ]);

    render(<ProjectThreadsPage />);

    await waitFor(() => {
      expect(screen.getByText("Archive failure target")).toBeInTheDocument();
    });

    triggerLongPress(screen.getByText("Archive failure target").closest("li")!);
    await user.click(await screen.findByRole("button", { name: "归档" }));

    await waitFor(() => {
      expect(screen.getByText("归档失败")).toBeInTheDocument();
    });
    expect(screen.getByText("Archive failure target")).toBeInTheDocument();
  });

  it("should keep archived thread in list and show error when unarchive action fails", async () => {
    const user = userEvent.setup();
    mockUnarchiveThread.mockRejectedValueOnce(new Error("移出归档失败"));
    mockListThreadsForCwd.mockImplementation((_cwd: string, archived: boolean) =>
      Promise.resolve(
        archived
          ? [
              {
                id: "t-unarchive-fail",
                title: "Unarchive failure target",
                preview: "Preview",
                updatedAt: Date.now(),
                status: "idle"
              }
            ]
          : []
      )
    );

    render(<ProjectThreadsPage />);

    await user.click(screen.getByRole("tab", { name: "已归档" }));

    await waitFor(() => {
      expect(screen.getByText("Unarchive failure target")).toBeInTheDocument();
    });

    triggerLongPress(screen.getByText("Unarchive failure target").closest("li")!);
    await user.click(await screen.findByRole("button", { name: "移出归档" }));

    await waitFor(() => {
      expect(screen.getByText("移出归档失败")).toBeInTheDocument();
    });
    expect(screen.getByText("Unarchive failure target")).toBeInTheDocument();
  });

  it("should ignore duplicate archive submissions while request is pending", async () => {
    const user = userEvent.setup();
    let resolveArchive: (() => void) | null = null;
    mockArchiveThread.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveArchive = resolve;
      })
    );
    mockListThreadsForCwd.mockResolvedValue([
      {
        id: "t-pending",
        title: "Pending archive target",
        preview: "Preview",
        updatedAt: Date.now(),
        status: "idle"
      }
    ]);

    render(<ProjectThreadsPage />);

    await waitFor(() => {
      expect(screen.getByText("Pending archive target")).toBeInTheDocument();
    });

    triggerLongPress(screen.getByText("Pending archive target").closest("li")!);
    const archiveButton = await screen.findByRole("button", { name: "归档" });

    await user.click(archiveButton);
    await user.click(archiveButton);

    expect(mockArchiveThread).toHaveBeenCalledTimes(1);

    act(() => {
      resolveArchive?.();
    });

    await waitFor(() => {
      expect(screen.queryByText("Pending archive target")).not.toBeInTheDocument();
    });
  });

  it("should start new thread from FAB", async () => {
    const user = userEvent.setup();
    mockStartThread.mockResolvedValue({ id: "new-thread" });

    render(<ProjectThreadsPage />);

    const fab = screen.getByLabelText("新建会话");
    await user.click(fab);

    await waitFor(() => {
      expect(mockStartThread).toHaveBeenCalledWith(
        expect.objectContaining({ cwd: "C:/test", clientOperationId: expect.any(String) })
      );
      expect(mockPush).toHaveBeenCalledWith("/threads/new-thread");
    });
  });

  it("should start new thread from empty state button", async () => {
    const user = userEvent.setup();
    mockListThreadsForCwd.mockResolvedValue([]);
    mockStartThread.mockResolvedValue({ id: "new-thread" });

    render(<ProjectThreadsPage />);

    await waitFor(() => {
      expect(screen.getByText("开始第一个会话")).toBeInTheDocument();
    });

    const startButton = screen.getByText("开始第一个会话");
    await user.click(startButton);

    await waitFor(() => {
      expect(mockStartThread).toHaveBeenCalledWith(
        expect.objectContaining({ cwd: "C:/test", clientOperationId: expect.any(String) })
      );
      expect(mockPush).toHaveBeenCalledWith("/threads/new-thread");
    });
  });

  it("should use settings defaults when starting a new thread", async () => {
    const user = userEvent.setup();
    mockLoadSettings.mockReturnValue({
      defaultMode: "plan",
      defaultModel: { source: "app-server", model: "openai/gpt-5" }
    });
    mockStartThread.mockResolvedValue({ id: "new-thread" });

    render(<ProjectThreadsPage />);

    const fab = screen.getByLabelText("新建会话");
    await user.click(fab);

    await waitFor(() => {
      expect(mockStartThread).toHaveBeenCalledWith({
        cwd: "C:/test",
        modelSelection: { source: "app-server", model: "openai/gpt-5" },
        catalogRevision: 3,
        clientOperationId: expect.any(String)
      });
      expect(mockSaveJson).toHaveBeenCalledWith("thread-mode:new-thread", "plan");
      expect(mockUpdateThreadSettings).toHaveBeenCalledWith(
        "new-thread",
        expect.objectContaining({
          collaborationMode: expect.objectContaining({
            mode: "plan",
            settings: expect.objectContaining({
              developer_instructions: null
            })
          })
        })
      );
    });
  });

  it("失效自定义默认会清除并直接回退服务端默认创建", async () => {
    const user = userEvent.setup();
    mockLoadSettings.mockReturnValue({
      defaultMode: "build",
      defaultModel: { source: "custom", customModelId: "deleted-custom" }
    });
    mockStartThread
      .mockRejectedValueOnce(
        new ApiError("自定义模型不存在", 409, {
          ok: false,
          code: "CUSTOM_MODEL_NOT_FOUND"
        })
      )
      .mockResolvedValueOnce({ id: "thread-fallback" });

    render(<ProjectThreadsPage />);
    await user.click(screen.getByLabelText("新建会话"));

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/threads/thread-fallback"));
    expect(mockStartThread).toHaveBeenCalledTimes(2);
    expect(mockStartThread.mock.calls[0][0]).toMatchObject({
      modelSelection: { source: "custom", customModelId: "deleted-custom" },
      catalogRevision: 3
    });
    expect(mockStartThread.mock.calls[1][0]).not.toHaveProperty("modelSelection");
    expect(mockUpdateSettings).toHaveBeenCalledWith({ defaultModel: null });
  });

  it("should still sync default Plan when collaboration mode presets fail", async () => {
    const user = userEvent.setup();
    mockLoadSettings.mockReturnValue({
      defaultMode: "plan",
      defaultModel: { source: "app-server", model: "openai/gpt-5" }
    });
    mockStartThread.mockResolvedValue({ id: "new-thread" });
    mockCollaborationModes.mockRejectedValueOnce(new Error("preset request failed"));

    render(<ProjectThreadsPage />);

    await user.click(screen.getByLabelText("新建会话"));

    await waitFor(() => {
      expect(mockUpdateThreadSettings).toHaveBeenCalledWith(
        "new-thread",
        expect.objectContaining({
          collaborationMode: expect.objectContaining({ mode: "plan" })
        })
      );
    });
    expect(mockPush).toHaveBeenCalledWith("/threads/new-thread");
  });

  it("should use Codex CLI defaults for new Plan threads when web default model follows backend", async () => {
    const user = userEvent.setup();
    mockLoadSettings.mockReturnValue({ defaultMode: "plan", defaultModel: null });
    mockReadSettings.mockResolvedValue({
      model: "gpt-5.5",
      modelProvider: "custom",
      reasoningEffort: "medium"
    });
    mockStartThread.mockResolvedValue({ id: "new-thread" });

    render(<ProjectThreadsPage />);

    await user.click(screen.getByLabelText("新建会话"));

    await waitFor(() => {
      expect(mockStartThread).toHaveBeenCalledWith(
        expect.objectContaining({ cwd: "C:/test", clientOperationId: expect.any(String) })
      );
      expect(mockUpdateThreadSettings).toHaveBeenCalledWith(
        "new-thread",
        expect.objectContaining({
          collaborationMode: expect.objectContaining({
            mode: "plan",
            settings: expect.objectContaining({
              model: "gpt-5.5",
              reasoning_effort: "medium"
            })
          })
        })
      );
    });
  });

  it("should still navigate when default mode sync fails after thread creation", async () => {
    const user = userEvent.setup();
    mockLoadSettings.mockReturnValue({
      defaultMode: "plan",
      defaultModel: { source: "app-server", model: "openai/gpt-5" }
    });
    mockStartThread.mockResolvedValue({ id: "new-thread" });
    mockUpdateThreadSettings.mockRejectedValueOnce(new Error("settings unavailable"));

    render(<ProjectThreadsPage />);

    await user.click(screen.getByLabelText("新建会话"));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/threads/new-thread");
    });
  });

  it("should ignore duplicate new thread clicks while request is pending", async () => {
    const user = userEvent.setup();
    let resolveStart: ((value: { id: string }) => void) | null = null;
    mockStartThread.mockReturnValue(
      new Promise((resolve) => {
        resolveStart = resolve;
      })
    );

    render(<ProjectThreadsPage />);

    const fab = screen.getByLabelText("新建会话");
    await user.click(fab);
    await user.click(fab);

    expect(mockStartThread).toHaveBeenCalledTimes(1);

    act(() => {
      resolveStart?.({ id: "new-thread" });
    });

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/threads/new-thread");
    });
    expect(mockPush).toHaveBeenCalledTimes(1);
  });

  it("should allow retrying new thread creation after a failure", async () => {
    const user = userEvent.setup();
    mockStartThread
      .mockRejectedValueOnce(new Error("start failed"))
      .mockResolvedValueOnce({ id: "new-thread-after-retry" });

    render(<ProjectThreadsPage />);

    const fab = screen.getByLabelText("新建会话");
    await user.click(fab);

    await waitFor(() => {
      expect(screen.getByText("start failed")).toBeInTheDocument();
    });

    await user.click(fab);

    await waitFor(() => {
      expect(mockStartThread).toHaveBeenCalledTimes(2);
      expect(mockPush).toHaveBeenCalledWith("/threads/new-thread-after-retry");
    });
  });
});

function triggerLongPress(target: Element): void {
  vi.useFakeTimers();
  target.dispatchEvent(
    new PointerEvent("pointerdown", {
      bubbles: true,
      cancelable: true,
      clientX: 10,
      clientY: 10
    })
  );
  act(() => {
    vi.advanceTimersByTime(501);
  });
  vi.useRealTimers();
}
