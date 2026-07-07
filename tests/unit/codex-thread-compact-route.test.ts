import { beforeEach, describe, expect, it, vi } from "vitest";

const mockReadThreadSummary = vi.fn();
const mockCompactThread = vi.fn();
const mockAudit = vi.fn();

vi.mock("../../src/server/auth", () => ({
  isRequestAuthenticated: () => true
}));

vi.mock("../../src/server/security", () => ({
  audit: (...args: unknown[]) => mockAudit(...args)
}));

vi.mock("../../src/server/app-server/runtime", () => ({
  getAppServerGateway: () => ({
    readThreadSummary: (...args: unknown[]) => mockReadThreadSummary(...args),
    compactThread: (...args: unknown[]) => mockCompactThread(...args)
  })
}));

describe("codex thread compact route", () => {
  beforeEach(() => {
    vi.resetModules();
    mockReadThreadSummary.mockReset();
    mockCompactThread.mockReset();
    mockAudit.mockReset();
    mockReadThreadSummary.mockResolvedValue({
      id: "thread-1",
      title: "会话",
      preview: "",
      cwd: "/repo",
      modelProvider: "custom",
      status: "idle",
      updatedAt: 1
    });
    mockCompactThread.mockResolvedValue(undefined);
  });

  it("拒绝压缩运行中的会话并避免调用 app-server compact", async () => {
    mockReadThreadSummary.mockResolvedValue({
      id: "thread-1",
      title: "会话",
      preview: "",
      cwd: "/repo",
      modelProvider: "custom",
      status: "active",
      updatedAt: 1
    });
    const { POST } = await import("../../src/app/api/codex/threads/[threadId]/compact/route");

    const response = await POST(
      new Request("http://localhost/api/codex/threads/thread-1/compact", { method: "POST" }),
      { params: Promise.resolve({ threadId: "thread-1" }) }
    );

    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "会话仍在运行，停止后才能压缩上下文"
    });
    expect(response.status).toBe(409);
    expect(mockReadThreadSummary).toHaveBeenCalledWith("thread-1");
    expect(mockCompactThread).not.toHaveBeenCalled();
  });

  it.each(["notLoaded", "systemError", "summary"])(
    "拒绝压缩非空闲状态 %s 并避免调用 app-server compact",
    async (status) => {
      mockReadThreadSummary.mockResolvedValue({
        id: "thread-1",
        title: "会话",
        preview: "",
        cwd: "/repo",
        modelProvider: "custom",
        status,
        updatedAt: 1
      });
      const { POST } = await import("../../src/app/api/codex/threads/[threadId]/compact/route");

      const response = await POST(
        new Request("http://localhost/api/codex/threads/thread-1/compact", { method: "POST" }),
        { params: Promise.resolve({ threadId: "thread-1" }) }
      );

      await expect(response.json()).resolves.toEqual({
        ok: false,
        error: "会话未处于空闲状态，恢复或停止后才能压缩上下文"
      });
      expect(response.status).toBe(409);
      expect(mockReadThreadSummary).toHaveBeenCalledWith("thread-1");
      expect(mockCompactThread).not.toHaveBeenCalled();
    }
  );

  it("压缩空闲会话时先预检再调用 app-server compact", async () => {
    const { POST } = await import("../../src/app/api/codex/threads/[threadId]/compact/route");

    const response = await POST(
      new Request("http://localhost/api/codex/threads/thread-1/compact", { method: "POST" }),
      { params: Promise.resolve({ threadId: "thread-1" }) }
    );

    expect(response.status).toBe(200);
    expect(mockReadThreadSummary).toHaveBeenCalledWith("thread-1");
    expect(mockAudit).toHaveBeenCalledWith("thread.compact.start", { threadId: "thread-1" });
    expect(mockCompactThread).toHaveBeenCalledWith("thread-1");
  });

  it("app-server 在 compact 阶段发现非可转向 active turn 时返回 409 而不是 502", async () => {
    mockCompactThread.mockRejectedValue(
      new Error("current turn cannot accept same-turn steering for manual compact")
    );
    const { POST } = await import("../../src/app/api/codex/threads/[threadId]/compact/route");

    const response = await POST(
      new Request("http://localhost/api/codex/threads/thread-1/compact", { method: "POST" }),
      { params: Promise.resolve({ threadId: "thread-1" }) }
    );

    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "会话仍在运行，停止后才能压缩上下文"
    });
    expect(response.status).toBe(409);
    expect(mockAudit).toHaveBeenCalledWith("thread.compact.start", { threadId: "thread-1" });
    expect(mockCompactThread).toHaveBeenCalledWith("thread-1");
  });
});
