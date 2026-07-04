import { beforeEach, describe, expect, it, vi } from "vitest";

const mockStartThread = vi.fn();
const mockAudit = vi.fn();

vi.mock("../../src/server/auth", () => ({
  isRequestAuthenticated: () => true
}));

vi.mock("../../src/server/security", () => ({
  assertRuntimePathAllowed: (path: string) => path,
  assertRuntimeWorkspaceRootsAllowed: (roots?: string[]) => roots,
  audit: (...args: unknown[]) => mockAudit(...args)
}));

vi.mock("../../src/server/app-server/runtime", () => ({
  getAppServerGateway: () => ({
    startThread: (...args: unknown[]) => mockStartThread(...args)
  })
}));

describe("codex thread start route", () => {
  beforeEach(() => {
    vi.resetModules();
    mockStartThread.mockReset();
    mockAudit.mockReset();
    mockStartThread.mockResolvedValue({
      id: "thread-1",
      title: "新会话",
      preview: "",
      cwd: "C:\\repo",
      modelProvider: "custom",
      status: "idle",
      updatedAt: 1
    });
  });

  it("旧请求不传 clientOperationId 时保持直接启动会话", async () => {
    const { POST } = await import("../../src/app/api/codex/threads/start/route");

    const response = await POST(
      new Request("http://localhost/api/codex/threads/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cwd: "C:\\repo" })
      })
    );

    expect(response.status).toBe(200);
    expect(mockStartThread).toHaveBeenCalledWith({
      cwd: "C:\\repo",
      workspaceRoots: undefined,
      model: undefined,
      permissions: undefined
    });
  });

  it("把 permissions null 从 HTTP body 转发给 app-server", async () => {
    const { POST } = await import("../../src/app/api/codex/threads/start/route");

    const response = await POST(
      new Request("http://localhost/api/codex/threads/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cwd: "C:\\repo", permissions: null })
      })
    );

    expect(response.status).toBe(200);
    expect(mockStartThread).toHaveBeenCalledWith({
      cwd: "C:\\repo",
      workspaceRoots: undefined,
      model: undefined,
      permissions: null
    });
  });

  it("同一个 clientOperationId 的并发重复请求只创建一个会话", async () => {
    const { POST } = await import("../../src/app/api/codex/threads/start/route");
    const requestBody = {
      cwd: "C:\\repo",
      clientOperationId: "new-thread-op-1"
    };

    const [first, second] = await Promise.all([
      POST(
        new Request("http://localhost/api/codex/threads/start", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(requestBody)
        })
      ),
      POST(
        new Request("http://localhost/api/codex/threads/start", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(requestBody)
        })
      )
    ]);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(mockStartThread).toHaveBeenCalledTimes(1);
    await expect(first.json()).resolves.toMatchObject({ thread: { id: "thread-1" } });
    await expect(second.json()).resolves.toMatchObject({ thread: { id: "thread-1" } });
  });

  it("新建会话失败后释放 clientOperationId 缓存，允许重试", async () => {
    const { POST } = await import("../../src/app/api/codex/threads/start/route");
    mockStartThread.mockRejectedValueOnce(new Error("start failed")).mockResolvedValueOnce({
      id: "thread-after-retry",
      title: "新会话",
      preview: "",
      cwd: "C:\\repo",
      modelProvider: "custom",
      status: "idle",
      updatedAt: 2
    });
    const request = () =>
      POST(
        new Request("http://localhost/api/codex/threads/start", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ cwd: "C:\\repo", clientOperationId: "retry-op" })
        })
      );

    const failed = await request();
    expect(failed.status).toBe(502);

    const retried = await request();
    expect(retried.status).toBe(200);
    expect(mockStartThread).toHaveBeenCalledTimes(2);
    await expect(retried.json()).resolves.toMatchObject({ thread: { id: "thread-after-retry" } });
  });
});
