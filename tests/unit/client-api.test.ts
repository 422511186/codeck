import { afterEach, describe, expect, it, vi } from "vitest";
import {
  archiveThread,
  clearThreadGoal,
  compactThread,
  deleteThread,
  disableRemoteControl,
  enableRemoteControl,
  installPlugin,
  listThreads,
  renameThread,
  readPlugin,
  readRemoteControlPairingStatus,
  resumeThread,
  resetMemory,
  revokeRemoteControlClient,
  setThreadGoal,
  setThreadMemoryMode,
  startRemoteControlPairing,
  startReview,
  uninstallPlugin,
  updateThreadSettings
} from "../../src/lib/client-api";

describe("client-api", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("搜索会话历史时把 search 参数发送给后端", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ threads: [], nextCursor: null })
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(listThreads("示例")).resolves.toEqual({ threads: [], nextCursor: null });

    expect(fetchMock).toHaveBeenCalledWith("/api/codex/threads?search=%E7%A4%BA%E4%BE%8B", { cache: "no-store" });
  });

  it("重命名会话时向后端发送新名称", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ thread: { id: "thread-1", title: "新标题" } })
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(renameThread("thread-1", "新标题")).resolves.toEqual({ id: "thread-1", title: "新标题" });

    expect(fetchMock).toHaveBeenCalledWith("/api/codex/threads/thread-1/name", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "新标题" })
    });
  });

  it("恢复会话时调用 resume 端点", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ thread: { id: "thread-1", title: "登录修复", timeline: [] } })
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(resumeThread("thread-1")).resolves.toEqual({ id: "thread-1", title: "登录修复", timeline: [] });

    expect(fetchMock).toHaveBeenCalledWith("/api/codex/threads/thread-1/resume", { method: "POST" });
  });

  it("归档和删除会话时调用对应端点", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true })
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(archiveThread("thread-1")).resolves.toBeUndefined();
    await expect(deleteThread("thread-1")).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/codex/threads/thread-1/archive", { method: "POST" });
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/codex/threads/thread-1/delete", { method: "POST" });
  });

  it("更新会话设置时调用 settings 端点", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true })
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      updateThreadSettings({
        threadId: "thread-1",
        model: "gpt-5-mini",
        reasoningEffort: "high",
        permissions: "full-auto"
      })
    ).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenCalledWith("/api/codex/threads/thread-1/settings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: "gpt-5-mini",
        reasoningEffort: "high",
        permissions: "full-auto"
      })
    });
  });

  it("设置和清除会话目标时调用 goal 端点", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ goal: { threadId: "thread-1", objective: "完整目标", status: "active" } })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true })
      });
    vi.stubGlobal("fetch", fetchMock);

    await expect(setThreadGoal({ threadId: "thread-1", objective: "完整目标", tokenBudget: 9000 })).resolves.toEqual({
      threadId: "thread-1",
      objective: "完整目标",
      status: "active"
    });
    await expect(clearThreadGoal("thread-1")).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/codex/threads/thread-1/goal", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ objective: "完整目标", tokenBudget: 9000 })
    });
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/codex/threads/thread-1/goal", { method: "DELETE" });
  });

  it("压缩会话上下文时调用 compact 端点", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true })
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(compactThread("thread-1")).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenCalledWith("/api/codex/threads/thread-1/compact", { method: "POST" });
  });

  it("启动代码审查时调用 review 端点并返回刷新后的线程", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ thread: { id: "thread-1", title: "登录修复", timeline: [{ text: "代码审查已开始" }] } })
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(startReview("thread-1")).resolves.toEqual({
      id: "thread-1",
      title: "登录修复",
      timeline: [{ text: "代码审查已开始" }]
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/codex/threads/thread-1/review", { method: "POST" });
  });

  it("切换记忆模式和重置记忆时调用 memory 端点", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true })
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(setThreadMemoryMode("thread-1", "disabled")).resolves.toBeUndefined();
    await expect(resetMemory()).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/codex/threads/thread-1/memory", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode: "disabled" })
    });
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/codex/memory/reset", { method: "POST" });
  });

  it("管理远程控制时调用对应端点", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: { status: "connected", environmentId: "env-1" } })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: { status: "disabled", environmentId: null } })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          pairing: {
            pairingCode: "pair-code-1",
            manualPairingCode: "123-456",
            environmentId: "env-1",
            expiresAt: 1_800_000_500
          }
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ pairingStatus: { claimed: true } })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true })
      });
    vi.stubGlobal("fetch", fetchMock);

    await expect(enableRemoteControl()).resolves.toMatchObject({ status: "connected", environmentId: "env-1" });
    await expect(disableRemoteControl()).resolves.toMatchObject({ status: "disabled", environmentId: null });
    await expect(startRemoteControlPairing()).resolves.toMatchObject({
      pairingCode: "pair-code-1",
      manualPairingCode: "123-456"
    });
    await expect(
      readRemoteControlPairingStatus({ pairingCode: "pair-code-1", manualPairingCode: "123-456" })
    ).resolves.toEqual({ claimed: true });
    await expect(revokeRemoteControlClient("env-1", "phone-1")).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/codex/remote-control/enable", { method: "POST" });
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/codex/remote-control/disable", { method: "POST" });
    expect(fetchMock).toHaveBeenNthCalledWith(3, "/api/codex/remote-control/pairing", { method: "POST" });
    expect(fetchMock).toHaveBeenNthCalledWith(4, "/api/codex/remote-control/pairing/status", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pairingCode: "pair-code-1", manualPairingCode: "123-456" })
    });
    expect(fetchMock).toHaveBeenNthCalledWith(5, "/api/codex/remote-control/clients/phone-1/revoke", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ environmentId: "env-1" })
    });
  });

  it("读取、安装和卸载插件时调用插件端点", async () => {
    const lookup = {
      marketplaceName: "个人插件市场",
      marketplacePath: "C:\\Users\\huang\\.codex\\plugins\\marketplace.json",
      pluginName: "browser-tools"
    };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ plugin: { id: "browser-tools", displayName: "浏览器工具", skillCount: 1 } })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: { authPolicy: "ON_USE", appsNeedingAuth: [] } })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true })
      });
    vi.stubGlobal("fetch", fetchMock);

    await expect(readPlugin(lookup)).resolves.toEqual({ id: "browser-tools", displayName: "浏览器工具", skillCount: 1 });
    await expect(installPlugin(lookup)).resolves.toEqual({ authPolicy: "ON_USE", appsNeedingAuth: [] });
    await expect(uninstallPlugin("browser-tools")).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/codex/plugins/browser-tools", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        marketplaceName: "个人插件市场",
        marketplacePath: "C:\\Users\\huang\\.codex\\plugins\\marketplace.json"
      })
    });
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/codex/plugins/browser-tools/install", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        marketplaceName: "个人插件市场",
        marketplacePath: "C:\\Users\\huang\\.codex\\plugins\\marketplace.json"
      })
    });
    expect(fetchMock).toHaveBeenNthCalledWith(3, "/api/codex/plugins/browser-tools/uninstall", { method: "POST" });
  });
});
