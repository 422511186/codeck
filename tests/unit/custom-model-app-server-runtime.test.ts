import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ThreadRuntimeBusyError,
  ThreadRuntimeVerificationError,
  createAppServerGateway
} from "../../src/server/app-server/runtime";
import type { MobileThreadDetail, MobileThreadSummary } from "../../src/shared/codex";

function summary(status = "idle"): MobileThreadSummary {
  return {
    id: "thread-1",
    title: "测试会话",
    preview: "",
    cwd: "/workspace",
    modelProvider: "openai",
    status,
    updatedAt: 1
  };
}

function detail(overrides: Partial<MobileThreadDetail> = {}): MobileThreadDetail {
  return {
    ...summary(),
    lastTurnId: null,
    nextCursor: null,
    timeline: [],
    model: "mimo-v2.5-pro",
    modelProvider: "openai",
    reasoningEffort: "xhigh",
    ...overrides
  };
}

describe("AppServerGateway 自定义模型运行时原语", () => {
  const gateway = createAppServerGateway({ mode: "mock" });

  beforeEach(async () => {
    vi.restoreAllMocks();
    await gateway.ensureReady();
  });

  it("从 Codex 当前配置读取 provider，不持久化旧 provider", async () => {
    vi.spyOn(gateway, "readModelDefaults").mockResolvedValue({
      model: "gpt-5.6-sol",
      modelProvider: "provider-after-rename",
      reasoningEffort: "high",
      reasoningSummary: null
    });

    await expect(gateway.readCurrentModelProvider()).resolves.toBe("provider-after-rename");
  });

  it("空闲会话按 unsubscribe 后冷 resume，并核验实际身份", async () => {
    const calls: string[] = [];
    vi.spyOn(gateway, "readThreadSummary").mockImplementation(async () => {
      calls.push("read");
      return summary("idle");
    });
    vi.spyOn(gateway, "unsubscribeThread").mockImplementation(async () => {
      calls.push("unsubscribe");
      return { status: "unsubscribed" };
    });
    const resume = vi.spyOn(gateway, "resumeThread").mockImplementation(async () => {
      calls.push("resume");
      return detail();
    });

    await expect(
      gateway.reloadThreadRuntime({
        threadId: "thread-1",
        model: "mimo-v2.5-pro",
        modelProvider: "openai",
        modelContextWindow: 200_000,
        reasoningEffort: "xhigh"
      })
    ).resolves.toMatchObject({ model: "mimo-v2.5-pro", modelProvider: "openai" });
    expect(calls).toEqual(["read", "unsubscribe", "resume"]);
    expect(resume).toHaveBeenCalledWith("thread-1", {
      model: "mimo-v2.5-pro",
      modelProvider: "openai",
      modelContextWindow: 200_000,
      reasoningEffort: "xhigh"
    });
  });

  it("运行中会话在 unsubscribe 前返回稳定 busy 错误", async () => {
    vi.spyOn(gateway, "readThreadSummary").mockResolvedValue(summary("active"));
    const unsubscribe = vi.spyOn(gateway, "unsubscribeThread");

    await expect(
      gateway.reloadThreadRuntime({
        threadId: "thread-1",
        model: "mimo-v2.5-pro",
        modelProvider: "openai"
      })
    ).rejects.toBeInstanceOf(ThreadRuntimeBusyError);
    expect(unsubscribe).not.toHaveBeenCalled();
  });

  it("其他订阅者导致覆盖未生效时返回稳定核验失败", async () => {
    vi.spyOn(gateway, "readThreadSummary").mockResolvedValue(summary("idle"));
    vi.spyOn(gateway, "unsubscribeThread").mockResolvedValue({ status: "unsubscribed" });
    vi.spyOn(gateway, "resumeThread").mockResolvedValue(
      detail({ model: "gpt-5.6-sol", modelProvider: "openai", reasoningEffort: "high" })
    );

    await expect(
      gateway.reloadThreadRuntime({
        threadId: "thread-1",
        model: "mimo-v2.5-pro",
        modelProvider: "openai",
        reasoningEffort: "xhigh"
      })
    ).rejects.toMatchObject({
      name: ThreadRuntimeVerificationError.name,
      code: "RUNTIME_VERIFICATION_FAILED",
      actual: { model: "gpt-5.6-sol", modelProvider: "openai", reasoningEffort: "high" }
    });
  });
});
