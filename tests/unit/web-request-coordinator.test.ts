import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  dedupeRequest,
  isRequestAbort,
  resetRequestCoordinatorForTests,
  runLockedAction
} from "../../src/web/api/requestCoordinator";

describe("web/api/requestCoordinator", () => {
  beforeEach(() => {
    resetRequestCoordinatorForTests();
  });

  it("复用同 key 的读取请求", async () => {
    const run = vi.fn().mockResolvedValue("ok");

    const [first, second] = await Promise.all([
      dedupeRequest("thread:1", run),
      dedupeRequest("thread:1", run)
    ]);

    expect(run).toHaveBeenCalledTimes(1);
    expect(first).toBe("ok");
    expect(second).toBe("ok");
  });

  it("读取失败后释放 key，允许重试", async () => {
    const run = vi.fn().mockRejectedValueOnce(new Error("fail")).mockResolvedValueOnce("ok");

    await expect(dedupeRequest("thread:1", run)).rejects.toThrow("fail");
    await expect(dedupeRequest("thread:1", run)).resolves.toBe("ok");
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("同 key mutation pending 时只执行一次动作", async () => {
    const resolver: { current?: (value: string) => void } = {};
    const run = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          resolver.current = resolve;
        })
    );

    const first = runLockedAction("archive:1", run);
    const second = runLockedAction("archive:1", run);
    await Promise.resolve();
    if (!resolver.current) {
      throw new Error("action promise was not started");
    }
    resolver.current("done");

    await expect(first).resolves.toEqual({ started: true, value: "done" });
    await expect(second).resolves.toEqual({ started: false, value: "done" });
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("mutation 失败后释放 key，允许重试", async () => {
    const run = vi.fn().mockRejectedValueOnce(new Error("fail")).mockResolvedValueOnce("ok");

    await expect(runLockedAction("compact:1", run)).rejects.toThrow("fail");
    await expect(runLockedAction("compact:1", run)).resolves.toEqual({ started: true, value: "ok" });
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("识别 AbortError", () => {
    expect(isRequestAbort(new DOMException("aborted", "AbortError"))).toBe(true);
    const error = new Error("aborted");
    error.name = "AbortError";
    expect(isRequestAbort(error)).toBe(true);
    expect(isRequestAbort(new Error("other"))).toBe(false);
  });
});
