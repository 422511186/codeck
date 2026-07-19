import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../src/web/api/client";
import type { CustomModelInput } from "../../src/shared/custom-models";

const mockApi = vi.fn();

vi.mock("../../src/web/api/client", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../src/web/api/client")>();
  return { ...original, api: (...args: unknown[]) => mockApi(...args) };
});

describe("自定义模型前端 endpoints", () => {
  beforeEach(() => {
    mockApi.mockReset();
  });

  it("读取统一目录时保留 catalogRevision 与 app-server 原始模型名", async () => {
    mockApi.mockResolvedValue({
      ok: true,
      catalogRevision: 4,
      appServerModelNames: ["gpt-5.6-sol"],
      models: [{ source: "app-server", model: "gpt-5.6-sol" }]
    });
    const { codex } = await import("../../src/web/api/endpoints");

    await expect(codex.modelCatalog()).resolves.toEqual({
      catalogRevision: 4,
      appServerModelNames: ["gpt-5.6-sol"],
      models: [{ source: "app-server", model: "gpt-5.6-sol" }]
    });
  });

  it("CRUD mutation 发送 expectedRevision 并解析完整目录", async () => {
    mockApi.mockResolvedValue({ ok: true, revision: 2, models: [] });
    const { codex } = await import("../../src/web/api/endpoints");
    const input: CustomModelInput = {
      model: "mimo-v2.5-pro",
      label: "MIMO",
      contextWindow: 200_000,
      inputModalities: ["text"],
      supportedReasoningEfforts: [],
      defaultReasoningEffort: null
    };

    await expect(codex.createCustomModel(input, 1)).resolves.toEqual({ revision: 2, models: [] });
    expect(mockApi).toHaveBeenCalledWith("/api/codex/custom-models", {
      method: "POST",
      body: { expectedRevision: 1, ...input }
    });
  });

  it("switch 对 409/502/500 返回结构化结果而非丢失 body", async () => {
    const terminal = {
      ok: false,
      outcome: "recovered",
      code: "SWITCH_TARGET_FAILED",
      operationId: "operation-1",
      latestState: { blocked: false }
    };
    mockApi.mockRejectedValue(new ApiError("target failed", 502, terminal));
    const { codex } = await import("../../src/web/api/endpoints");

    await expect(
      codex.switchThreadModel("thread-1", {
        target: { source: "custom", customModelId: "custom-1" },
        expectedCatalogRevision: 1,
        expectedCurrent: {
          selection: { source: "app-server", model: "gpt-5.6-sol" },
          reasoningEffort: "high",
          bindingVersion: null
        }
      })
    ).resolves.toEqual(terminal);
  });

  it("恢复命令解析结构化终态", async () => {
    mockApi.mockResolvedValue({
      ok: true,
      outcome: "recovered",
      operationId: "operation-1",
      latestState: { blocked: false }
    });
    const { codex } = await import("../../src/web/api/endpoints");

    await codex.recoverThreadModel("thread-1", "restore-old");
    expect(mockApi).toHaveBeenCalledWith("/api/codex/threads/thread-1/model/recover", {
      method: "POST",
      body: { action: "restore-old" }
    });
  });
});
