import { afterEach, describe, expect, it, vi } from "vitest";
import { listThreads } from "../../src/lib/client-api";

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
});
