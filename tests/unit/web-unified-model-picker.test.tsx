import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { UnifiedModelPicker } from "../../src/web/components/UnifiedModelPicker";
import type { ThreadModelStateView, UnifiedModelCatalog } from "../../src/shared/custom-models";

const mockModelCatalog = vi.fn();

vi.mock("../../src/web/api/endpoints", () => ({
  codex: {
    modelCatalog: () => mockModelCatalog()
  }
}));

const current: ThreadModelStateView = {
  selection: { source: "app-server", model: "shared-name" },
  model: "shared-name",
  label: "当前 Codex",
  contextWindow: null,
  inputModalities: ["text", "image"],
  supportedReasoningEfforts: ["medium", "vendor-ultra"],
  defaultReasoningEffort: "medium",
  reasoningEffort: "vendor-ultra",
  bindingVersion: null,
  sourceUpdatedAt: null,
  blocked: false,
  operationId: null
};

const catalog: UnifiedModelCatalog = {
  catalogRevision: 7,
  appServerModelNames: ["gpt-5.6-sol", "shared-name"],
  models: [
    {
      source: "custom",
      customModelId: "custom-shadow",
      model: "shared-name",
      label: "私有同名模型",
      contextWindow: 200_000,
      inputModalities: ["text"],
      supportedReasoningEfforts: [],
      defaultReasoningEffort: null,
      isDefault: false,
      updatedAt: "2026-07-18T00:00:00.000Z"
    },
    {
      source: "app-server",
      model: "gpt-5.6-sol",
      label: "GPT-5.6 Sol",
      contextWindow: 272_000,
      inputModalities: ["text", "image"],
      supportedReasoningEfforts: ["high"],
      defaultReasoningEffort: "high",
      isDefault: true
    }
  ]
};

describe("UnifiedModelPicker", () => {
  beforeEach(() => {
    mockModelCatalog.mockReset();
    mockModelCatalog.mockResolvedValue(catalog);
  });

  it("每次挂载刷新目录，并按当前会话、自定义、Codex 分组展示来源身份", async () => {
    const onSelect = vi.fn();
    const first = render(
      <UnifiedModelPicker
        current={current}
        onSelect={onSelect}
        onReapply={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(await screen.findByRole("heading", { name: "当前会话" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "自定义" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Codex" })).toBeInTheDocument();
    expect(within(screen.getByTestId("current-thread-models")).getByText("当前 Codex")).toBeInTheDocument();
    expect(within(screen.getByTestId("custom-models")).getByText("私有同名模型")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "管理自定义模型" })).toHaveAttribute("href", "/settings/custom-models");
    expect(mockModelCatalog).toHaveBeenCalledTimes(1);

    first.unmount();
    render(
      <UnifiedModelPicker
        current={current}
        onSelect={onSelect}
        onReapply={vi.fn()}
        onClose={vi.fn()}
      />
    );
    await waitFor(() => expect(mockModelCatalog).toHaveBeenCalledTimes(2));
  });

  it("按 label 与 model 搜索，并用目录修订号提交来源敏感选择", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn().mockResolvedValue(undefined);
    render(
      <UnifiedModelPicker
        current={current}
        onSelect={onSelect}
        onReapply={vi.fn()}
        onClose={vi.fn()}
      />
    );
    await screen.findByText("私有同名模型");

    await user.type(screen.getByRole("searchbox", { name: "搜索模型" }), "gpt-5.6");
    expect(screen.queryByText("私有同名模型")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /GPT-5.6 Sol/ }));

    expect(onSelect).toHaveBeenCalledWith({ source: "app-server", model: "gpt-5.6-sol" }, 7);
  });

  it("模型选择器只展示模型，不再内嵌推理强度", async () => {
    render(
      <UnifiedModelPicker
        current={current}
        onSelect={vi.fn()}
        onReapply={vi.fn()}
        onClose={vi.fn()}
      />
    );

    const currentGroup = await screen.findByTestId("current-thread-models");
    expect(within(currentGroup).queryByText("推理强度")).not.toBeInTheDocument();
    expect(within(currentGroup).queryByRole("button", { name: "vendor-ultra" })).not.toBeInTheDocument();
    expect(within(screen.getByTestId("codex-models")).queryByText("推理强度")).not.toBeInTheDocument();
  });

  it("自定义绑定配置更新时提供重新应用，最新绑定不执行无效重建", async () => {
    const customCurrent: ThreadModelStateView = {
      ...current,
      selection: { source: "custom", customModelId: "custom-shadow" },
      label: "私有同名模型",
      contextWindow: 100_000,
      inputModalities: ["text"],
      supportedReasoningEfforts: [],
      reasoningEffort: null,
      bindingVersion: "binding-1",
      sourceUpdatedAt: "2026-07-17T00:00:00.000Z"
    };
    const onReapply = vi.fn().mockResolvedValue(undefined);
    const { rerender } = render(
      <UnifiedModelPicker
        current={customCurrent}
        onSelect={vi.fn()}
        onReapply={onReapply}
        onClose={vi.fn()}
      />
    );

    expect(await screen.findByText("配置有更新")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "重新应用" }));
    expect(onReapply).toHaveBeenCalledWith(7);

    rerender(
      <UnifiedModelPicker
        current={{ ...customCurrent, sourceUpdatedAt: "2026-07-18T00:00:00.000Z" }}
        onSelect={vi.fn()}
        onReapply={onReapply}
        onClose={vi.fn()}
      />
    );
    expect(screen.queryByRole("button", { name: "重新应用" })).not.toBeInTheDocument();
  });
});
