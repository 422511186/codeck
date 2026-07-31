import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import ProjectsPage from "../../src/app/projects/page";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mockPush }) }));

const mockListProjects = vi.fn();
const mockAddProject = vi.fn();
const mockRemoveProject = vi.fn();
const mockRenameProject = vi.fn();
const mockSaveLocalProject = vi.fn();
const mockTouchProjectLastUsed = vi.fn();

vi.mock("../../src/web/storage/projects", () => ({
  listProjects: () => mockListProjects(),
  addProject: (...args: unknown[]) => mockAddProject(...args),
  removeProject: (...args: unknown[]) => mockRemoveProject(...args),
  renameProject: (...args: unknown[]) => mockRenameProject(...args),
  saveLocalProject: (...args: unknown[]) => mockSaveLocalProject(...args),
  touchProjectLastUsed: (...args: unknown[]) => mockTouchProjectLastUsed(...args)
}));

const mockListThreads = vi.fn();
const mockProjectCatalog = vi.fn();
const mockCreateServerProject = vi.fn();
const mockRenameServerProject = vi.fn();
const mockDeleteServerProject = vi.fn();
const mockTouchServerProject = vi.fn();

vi.mock("../../src/web/api/endpoints", () => ({
  codex: {
    listThreads: (...args: unknown[]) => mockListThreads(...args),
    projectCatalog: (...args: unknown[]) => mockProjectCatalog(...args),
    createServerProject: (...args: unknown[]) => mockCreateServerProject(...args),
    renameServerProject: (...args: unknown[]) => mockRenameServerProject(...args),
    deleteServerProject: (...args: unknown[]) => mockDeleteServerProject(...args),
    touchServerProject: (...args: unknown[]) => mockTouchServerProject(...args)
  }
}));

const emptyCatalog = { revision: 0, defaultStorage: "server" as const, projects: [] };

function clientProject(overrides: Record<string, unknown> = {}) {
  return {
    id: "client-1",
    path: "C:/test/client",
    name: "Client Project",
    addedAt: 1,
    lastUsedAt: 10,
    storage: "client" as const,
    ...overrides
  };
}

function serverProject(overrides: Record<string, unknown> = {}) {
  return {
    id: "server-1",
    path: "C:/test/server",
    name: "Server Project",
    addedAt: 2,
    lastUsedAt: 20,
    storage: "server" as const,
    ...overrides
  };
}

describe("ProjectsPage", () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockListProjects.mockReset();
    mockListProjects.mockReturnValue([]);
    mockAddProject.mockReset();
    mockRemoveProject.mockReset();
    mockRenameProject.mockReset();
    mockSaveLocalProject.mockReset();
    mockTouchProjectLastUsed.mockReset();
    mockListThreads.mockReset();
    mockListThreads.mockResolvedValue({ threads: [] });
    mockProjectCatalog.mockReset();
    mockProjectCatalog.mockResolvedValue(emptyCatalog);
    mockCreateServerProject.mockReset();
    mockCreateServerProject.mockResolvedValue(emptyCatalog);
    mockRenameServerProject.mockReset();
    mockDeleteServerProject.mockReset();
    mockTouchServerProject.mockReset();
    mockTouchServerProject.mockResolvedValue(emptyCatalog);
  });

  it("两边目录为空且服务端读取成功时显示空状态", async () => {
    render(<ProjectsPage />);

    expect(await screen.findByText("还没有项目")).toBeInTheDocument();
    expect(screen.getByText("添加项目")).toBeInTheDocument();
  });

  it("合并展示客户端与服务端项目并标识存储位置", async () => {
    mockListProjects.mockReturnValue([clientProject()]);
    mockProjectCatalog.mockResolvedValue({ revision: 1, defaultStorage: "server", projects: [serverProject()] });
    mockListThreads.mockResolvedValue({ threads: [{ id: "t1" }, { id: "t2" }] });

    render(<ProjectsPage />);

    expect(screen.getByText("Client Project")).toBeInTheDocument();
    expect(await screen.findByText("Server Project")).toBeInTheDocument();
    expect(screen.getByText("当前设备")).toBeInTheDocument();
    expect(screen.getByText("服务端")).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByText(/2 个会话/)).toHaveLength(2));
  });

  it("新增弹窗默认选择服务端并允许改为仅当前设备", async () => {
    const user = userEvent.setup();
    render(<ProjectsPage />);
    await screen.findByText("还没有项目");

    await user.click(screen.getByLabelText("添加项目"));
    const select = screen.getByLabelText("保存位置") as HTMLSelectElement;
    expect(select.value).toBe("server");

    await user.selectOptions(select, "client");
    await user.type(screen.getByPlaceholderText(/C:\/Users/), "C:/new/project");
    await user.click(screen.getByRole("button", { name: "添加" }));

    await waitFor(() => {
      expect(mockAddProject).toHaveBeenCalledWith("C:/new/project", "project");
      expect(mockCreateServerProject).not.toHaveBeenCalled();
    });
  });

  it("默认服务端新增通过项目目录 API", async () => {
    const user = userEvent.setup();
    mockCreateServerProject.mockResolvedValue({
      revision: 1,
      defaultStorage: "server",
      projects: [serverProject({ path: "C:/new/project", name: "project" })]
    });
    render(<ProjectsPage />);
    await screen.findByText("还没有项目");

    await user.click(screen.getByLabelText("添加项目"));
    await user.type(screen.getByPlaceholderText(/C:\/Users/), "C:/new/project");
    await user.click(screen.getByRole("button", { name: "添加" }));

    await waitFor(() => expect(mockCreateServerProject).toHaveBeenCalledWith(
      { name: "project", path: "C:/new/project" },
      0
    ));
    expect(mockAddProject).not.toHaveBeenCalled();
  });

  it("服务端目录失败时保留客户端项目并提供重试", async () => {
    mockListProjects.mockReturnValue([clientProject()]);
    mockProjectCatalog.mockRejectedValue(new Error("服务端项目加载失败"));
    render(<ProjectsPage />);

    expect(screen.getByText("Client Project")).toBeInTheDocument();
    expect(await screen.findByRole("alert")).toHaveTextContent("服务端项目加载失败");
    expect(screen.getByRole("button", { name: "重试" })).toBeInTheDocument();
    expect(screen.queryByText("还没有项目")).not.toBeInTheDocument();
  });

  it("should enter a client project and touch it locally", async () => {
    const user = userEvent.setup();
    mockListProjects.mockReturnValue([clientProject()]);
    render(<ProjectsPage />);
    await screen.findByText("Client Project");

    await user.click(screen.getByText("Client Project"));
    expect(mockTouchProjectLastUsed).toHaveBeenCalledWith("client-1");
    expect(mockPush).toHaveBeenCalledWith("/projects/client-1");
  });

  it("should not open a project action menu from the project list", async () => {
    const user = userEvent.setup();
    mockListProjects.mockReturnValue([clientProject()]);
    render(<ProjectsPage />);
    await screen.findByText("Client Project");

    await user.pointer([{ target: screen.getByText("Client Project"), keys: "[MouseLeft]" }]);
    expect(screen.queryByRole("button", { name: "重命名" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "保存到服务端" })).not.toBeInTheDocument();
  });

  it("should enter a server project and update its last-used time", async () => {
    const user = userEvent.setup();
    const project = serverProject();
    mockProjectCatalog.mockResolvedValue({ revision: 1, defaultStorage: "server", projects: [project] });
    render(<ProjectsPage />);
    await screen.findByText("Server Project");

    await user.click(screen.getByText("Server Project"));

    expect(mockTouchServerProject).toHaveBeenCalledWith("server-1", expect.any(Number));
    expect(mockPush).toHaveBeenCalledWith("/projects/server-1");
  });

  it("同路径碰撞要求显式选择保留服务端", async () => {
    const user = userEvent.setup();
    mockListProjects.mockReturnValue([clientProject({ path: "C:/test/demo", name: "Local alias" })]);
    mockProjectCatalog.mockResolvedValue({
      revision: 1,
      defaultStorage: "server",
      projects: [serverProject({ path: "c:\\test\\demo\\", name: "Server alias" })]
    });
    render(<ProjectsPage />);

    await user.click(await screen.findByText(/存在存储冲突/));
    expect(screen.getByText("处理项目冲突")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "保留服务端记录" }));

    expect(mockRemoveProject).toHaveBeenCalledWith("client-1");
    expect(mockDeleteServerProject).not.toHaveBeenCalled();
  });
});
