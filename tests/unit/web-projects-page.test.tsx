import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import ProjectsPage from "../../src/app/projects/page";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush })
}));

const mockListProjects = vi.fn();
const mockAddProject = vi.fn();
const mockRemoveProject = vi.fn();
const mockRenameProject = vi.fn();
const mockTouchProjectLastUsed = vi.fn();

vi.mock("../../src/web/storage/projects", () => ({
  listProjects: () => mockListProjects(),
  addProject: (...args: unknown[]) => mockAddProject(...args),
  removeProject: (...args: unknown[]) => mockRemoveProject(...args),
  renameProject: (...args: unknown[]) => mockRenameProject(...args),
  touchProjectLastUsed: (...args: unknown[]) => mockTouchProjectLastUsed(...args)
}));

const mockListThreads = vi.fn();
vi.mock("../../src/web/api/endpoints", () => ({
  codex: {
    listThreads: (...args: unknown[]) => mockListThreads(...args)
  }
}));

describe("ProjectsPage", () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockListProjects.mockReturnValue([]);
    mockAddProject.mockClear();
    mockRemoveProject.mockClear();
    mockRenameProject.mockClear();
    mockTouchProjectLastUsed.mockClear();
    mockListThreads.mockResolvedValue({ threads: [] });
  });

  it("should render empty state when no projects", () => {
    render(<ProjectsPage />);

    expect(screen.getByText("还没有项目")).toBeInTheDocument();
    expect(screen.getByText("添加项目")).toBeInTheDocument();
  });

  it("should render project list", async () => {
    mockListProjects.mockReturnValue([
      {
        id: "proj-1",
        path: "C:/test/project",
        name: "Test Project",
        addedAt: Date.now(),
        lastUsedAt: Date.now()
      }
    ]);
    mockListThreads.mockResolvedValue({ threads: [{ id: "t1" }, { id: "t2" }] });

    render(<ProjectsPage />);

    expect(screen.getByText("Test Project")).toBeInTheDocument();
    expect(screen.getByText("C:/test/project")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/2 个会话/)).toBeInTheDocument();
    });
  });

  it("should open add project modal", async () => {
    const user = userEvent.setup();
    render(<ProjectsPage />);

    const addButton = screen.getByLabelText("添加项目");
    await user.click(addButton);

    expect(screen.getByText("工作区路径")).toBeInTheDocument();
  });

  it("should add project successfully", async () => {
    const user = userEvent.setup();
    mockAddProject.mockReturnValue({
      id: "new-proj",
      path: "C:/new",
      name: "New",
      addedAt: Date.now(),
      lastUsedAt: Date.now()
    });

    render(<ProjectsPage />);

    const addButton = screen.getByLabelText("添加项目");
    await user.click(addButton);

    const pathInput = screen.getByPlaceholderText(/C:\/Users/);
    const submitButton = screen.getAllByRole("button").find((btn) => btn.textContent === "添加");

    await user.type(pathInput, "C:/new/project");
    await user.click(submitButton!);

    await waitFor(() => {
      expect(mockListThreads).toHaveBeenCalledWith({ cwd: "C:/new/project", limit: 1 });
      expect(mockAddProject).toHaveBeenCalledWith("C:/new/project", "project");
    });
  });

  it("should show error when adding invalid path", async () => {
    const user = userEvent.setup();
    const { ApiError } = await import("../../src/web/api/client");
    mockListThreads.mockRejectedValue(new ApiError("路径不在允许列表中", 400));

    render(<ProjectsPage />);

    const addButton = screen.getByLabelText("添加项目");
    await user.click(addButton);

    const pathInput = screen.getByPlaceholderText(/C:\/Users/);
    const submitButton = screen.getAllByRole("button").find((btn) => btn.textContent === "添加");

    await user.type(pathInput, "C:/invalid");
    await user.click(submitButton!);

    await waitFor(() => {
      expect(screen.getByText("路径不在允许列表中")).toBeInTheDocument();
    });
  });

  it("should remove project", async () => {
    const user = userEvent.setup();
    mockListProjects.mockReturnValue([
      {
        id: "proj-1",
        path: "C:/test",
        name: "Test",
        addedAt: Date.now(),
        lastUsedAt: Date.now()
      }
    ]);

    render(<ProjectsPage />);

    const projectCard = screen.getByText("Test").closest("li");
    expect(projectCard).toBeInTheDocument();

    // Simulate long press
    const pointerDownEvent = new PointerEvent("pointerdown", { bubbles: true, cancelable: true });
    projectCard!.dispatchEvent(pointerDownEvent);

    await waitFor(
      () => {
        expect(screen.getByText("从列表移除")).toBeInTheDocument();
      },
      { timeout: 600 }
    );

    const removeButton = screen.getByText("从列表移除");
    await user.click(removeButton);

    expect(mockRemoveProject).toHaveBeenCalledWith("proj-1");
  });

  it("should rename project", async () => {
    const user = userEvent.setup();
    mockListProjects.mockReturnValue([
      {
        id: "proj-1",
        path: "C:/test",
        name: "Old Name",
        addedAt: Date.now(),
        lastUsedAt: Date.now()
      }
    ]);

    render(<ProjectsPage />);

    const projectCard = screen.getByText("Old Name").closest("li");
    const pointerDownEvent = new PointerEvent("pointerdown", { bubbles: true, cancelable: true });
    projectCard!.dispatchEvent(pointerDownEvent);

    await waitFor(
      () => {
        expect(screen.getByText("重命名")).toBeInTheDocument();
      },
      { timeout: 600 }
    );

    const renameButton = screen.getByText("重命名");
    await user.click(renameButton);

    await waitFor(() => {
      expect(screen.getByText("重命名项目")).toBeInTheDocument();
    });

    const input = screen.getByDisplayValue("Old Name");
    await user.clear(input);
    await user.type(input, "New Name");

    const saveButton = screen.getByRole("button", { name: "保存" });
    await user.click(saveButton);

    expect(mockRenameProject).toHaveBeenCalledWith("proj-1", "New Name");
  });

  it("should navigate to project on click", async () => {
    const user = userEvent.setup();
    mockListProjects.mockReturnValue([
      {
        id: "proj-1",
        path: "C:/test",
        name: "Test",
        addedAt: Date.now(),
        lastUsedAt: Date.now()
      }
    ]);

    render(<ProjectsPage />);

    const projectCard = screen.getByText("Test").closest("li");
    await user.click(projectCard!);

    expect(mockTouchProjectLastUsed).toHaveBeenCalledWith("proj-1");
    expect(mockPush).toHaveBeenCalledWith("/projects/proj-1");
  });
});
