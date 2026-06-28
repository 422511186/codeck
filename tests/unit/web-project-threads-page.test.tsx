import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import ProjectThreadsPage from "../../src/app/projects/[projectId]/page";

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
vi.mock("../../src/web/storage/settings", () => ({
  settingsStore: {
    load: () => mockLoadSettings()
  }
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
vi.mock("../../src/web/api/endpoints", () => ({
  codex: {
    listThreadsForCwd: (...args: unknown[]) => mockListThreadsForCwd(...args),
    startThread: (...args: unknown[]) => mockStartThread(...args),
    settings: () => mockReadSettings(),
    collaborationModes: () => mockCollaborationModes(),
    updateThreadSettings: (...args: unknown[]) => mockUpdateThreadSettings(...args)
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
    mockSaveJson.mockClear();
    mockLoadSettings.mockReturnValue({ defaultMode: "build", defaultModel: null });
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

  it("should start new thread from FAB", async () => {
    const user = userEvent.setup();
    mockStartThread.mockResolvedValue({ id: "new-thread" });

    render(<ProjectThreadsPage />);

    const fab = screen.getByLabelText("新建会话");
    await user.click(fab);

    await waitFor(() => {
      expect(mockStartThread).toHaveBeenCalledWith({ cwd: "C:/test" });
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
      expect(mockStartThread).toHaveBeenCalledWith({ cwd: "C:/test" });
      expect(mockPush).toHaveBeenCalledWith("/threads/new-thread");
    });
  });

  it("should use settings defaults when starting a new thread", async () => {
    const user = userEvent.setup();
    mockLoadSettings.mockReturnValue({ defaultMode: "plan", defaultModel: "openai/gpt-5" });
    mockStartThread.mockResolvedValue({ id: "new-thread" });

    render(<ProjectThreadsPage />);

    const fab = screen.getByLabelText("新建会话");
    await user.click(fab);

    await waitFor(() => {
      expect(mockStartThread).toHaveBeenCalledWith({
        cwd: "C:/test",
        model: "openai/gpt-5"
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

  it("should still sync default Plan when collaboration mode presets fail", async () => {
    const user = userEvent.setup();
    mockLoadSettings.mockReturnValue({ defaultMode: "plan", defaultModel: "openai/gpt-5" });
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
      expect(mockStartThread).toHaveBeenCalledWith({ cwd: "C:/test" });
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
    mockLoadSettings.mockReturnValue({ defaultMode: "plan", defaultModel: "openai/gpt-5" });
    mockStartThread.mockResolvedValue({ id: "new-thread" });
    mockUpdateThreadSettings.mockRejectedValueOnce(new Error("settings unavailable"));

    render(<ProjectThreadsPage />);

    await user.click(screen.getByLabelText("新建会话"));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/threads/new-thread");
    });
  });
});
