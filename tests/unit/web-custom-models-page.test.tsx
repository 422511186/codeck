import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import CustomModelsPage from "../../src/app/settings/custom-models/page";
import { ApiError } from "../../src/web/api/client";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() })
}));

const mockCustomModels = vi.fn();
const mockCreate = vi.fn();
const mockReplace = vi.fn();
const mockDelete = vi.fn();

vi.mock("../../src/web/api/endpoints", () => ({
  codex: {
    customModels: (...args: unknown[]) => mockCustomModels(...args),
    createCustomModel: (...args: unknown[]) => mockCreate(...args),
    replaceCustomModel: (...args: unknown[]) => mockReplace(...args),
    deleteCustomModel: (...args: unknown[]) => mockDelete(...args)
  }
}));

const model = {
  customModelId: "custom-1",
  model: "mimo-v2.5-pro",
  label: "MIMO 2.5 Pro",
  contextWindow: 200_000,
  inputModalities: ["text", "image"] as const,
  supportedReasoningEfforts: ["medium", "vendor-ultra"],
  defaultReasoningEffort: "medium",
  createdAt: "2026-07-18T00:00:00.000Z",
  updatedAt: "2026-07-18T00:00:00.000Z"
};

describe("CustomModelsPage", () => {
  beforeEach(() => {
    mockCustomModels.mockReset();
    mockCreate.mockReset();
    mockReplace.mockReset();
    mockDelete.mockReset();
    mockCustomModels.mockResolvedValue({ revision: 1, models: [model] });
  });

  it("显示紧凑列表和能力摘要", async () => {
    render(<CustomModelsPage />);

    expect(await screen.findByText("MIMO 2.5 Pro")).toBeInTheDocument();
    expect(screen.getByText("mimo-v2.5-pro")).toBeInTheDocument();
    expect(screen.getByText(/200,000/)).toBeInTheDocument();
    expect(screen.getByText(/图片/)).toBeInTheDocument();

  });

  it("加载错误后允许重试", async () => {
    mockCustomModels.mockRejectedValueOnce(new Error("目录损坏"));
    render(<CustomModelsPage />);

    expect(await screen.findByText("目录损坏")).toBeInTheDocument();
    mockCustomModels.mockResolvedValueOnce({ revision: 1, models: [model] });
    await userEvent.click(screen.getByRole("button", { name: "重试" }));
    expect(await screen.findByText("MIMO 2.5 Pro")).toBeInTheDocument();
  });

  it("新增表单使用 200k/text 保守默认且不显示 provider 字段", async () => {
    render(<CustomModelsPage />);
    await screen.findByText("MIMO 2.5 Pro");
    await userEvent.click(screen.getByRole("button", { name: "新增自定义模型" }));

    expect(screen.getByRole("dialog", { name: "新增自定义模型" })).toBeInTheDocument();
    expect(screen.getByLabelText("上下文窗口")).toHaveValue(200_000);
    expect(screen.getByLabelText("文本输入")).toBeChecked();
    expect(screen.getByLabelText("文本输入")).toBeDisabled();
    expect(screen.getByLabelText("图片输入")).not.toBeChecked();
    expect(screen.queryByLabelText(/provider|url|api key/i)).not.toBeInTheDocument();
  });

  it("字段校验阻止非法窗口和缺失 model，并支持开放 reasoning 默认值", async () => {
    render(<CustomModelsPage />);
    await screen.findByText("MIMO 2.5 Pro");
    await userEvent.click(screen.getByRole("button", { name: "新增自定义模型" }));

    await userEvent.type(screen.getByLabelText("显示名称"), "My Model");
    fireEvent.change(screen.getByLabelText("上下文窗口"), { target: { value: "1000001" } });
    await userEvent.click(screen.getByRole("button", { name: "保存" }));
    expect(screen.getByText("模型标识不能为空")).toBeInTheDocument();
    expect(screen.getByText("上下文窗口必须在 1 到 1,000,000 之间")).toBeInTheDocument();
    expect(mockCreate).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("模型标识"), { target: { value: "my-model" } });
    fireEvent.change(screen.getByLabelText("上下文窗口"), { target: { value: "200000" } });
    await userEvent.click(screen.getByRole("button", { name: "新增 reasoning 档位" }));
    fireEvent.change(screen.getByLabelText("Reasoning 档位 1"), { target: { value: "vendor-ultra" } });
    fireEvent.change(screen.getByLabelText("默认 reasoning"), { target: { value: "vendor-ultra" } });
    mockCreate.mockResolvedValue({ revision: 2, models: [model] });
    await userEvent.click(screen.getByRole("button", { name: "保存" }));

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "my-model",
        supportedReasoningEfforts: ["vendor-ultra"],
        defaultReasoningEffort: "vendor-ultra"
      }),
      1
    );
  });

  it("编辑使用完整替换，revision 冲突保留用户表单", async () => {
    render(<CustomModelsPage />);
    await screen.findByText("MIMO 2.5 Pro");
    await userEvent.click(screen.getByRole("button", { name: "编辑 MIMO 2.5 Pro" }));
    fireEvent.change(screen.getByLabelText("显示名称"), { target: { value: "Unsaved Label" } });
    mockReplace.mockRejectedValue(
      new ApiError("目录冲突", 409, {
        ok: false,
        code: "CATALOG_REVISION_CONFLICT",
        revision: 2,
        models: [model]
      })
    );

    await userEvent.click(screen.getByRole("button", { name: "保存" }));

    expect(await screen.findByText("目录已在其他设备更新，请检查后重试")).toBeInTheDocument();
    expect(screen.getByLabelText("显示名称")).toHaveValue("Unsaved Label");
    expect(mockReplace).toHaveBeenCalledWith(
      "custom-1",
      expect.objectContaining({ label: "Unsaved Label", model: "mimo-v2.5-pro" }),
      1
    );
  });

  it("删除确认说明已有绑定不受影响，成功后使用完整目录响应替换列表", async () => {
    render(<CustomModelsPage />);
    await screen.findByText("MIMO 2.5 Pro");
    await userEvent.click(screen.getByRole("button", { name: "删除 MIMO 2.5 Pro" }));

    expect(screen.getByRole("dialog", { name: "确认删除自定义模型" })).toBeInTheDocument();
    expect(screen.getByText(/已有会话绑定不受影响/)).toBeInTheDocument();
    mockDelete.mockResolvedValue({ revision: 2, models: [] });
    await userEvent.click(screen.getByRole("button", { name: "确认删除" }));

    await waitFor(() => expect(screen.queryByText("MIMO 2.5 Pro")).not.toBeInTheDocument());
    expect(screen.getByText("还没有自定义模型")).toBeInTheDocument();
  });
});
