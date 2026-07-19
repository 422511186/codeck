import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { ReasoningEffortPicker } from "../../src/web/components/ReasoningEffortPicker";
import type { ThreadModelStateView } from "../../src/shared/custom-models";

const current: ThreadModelStateView = {
  selection: { source: "app-server", model: "gpt-5-codex" },
  model: "gpt-5-codex",
  label: "GPT-5 Codex",
  contextWindow: 272_000,
  inputModalities: ["text"],
  supportedReasoningEfforts: ["low", "medium", "vendor-ultra"],
  defaultReasoningEffort: "medium",
  reasoningEffort: "vendor-ultra",
  bindingVersion: null,
  sourceUpdatedAt: null,
  blocked: false,
  operationId: null
};

describe("ReasoningEffortPicker", () => {
  it("shows supported efforts, keeps unknown values, and submits the raw value", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn().mockResolvedValue(undefined);

    render(<ReasoningEffortPicker current={current} onSelect={onSelect} onClose={vi.fn()} />);

    const dialog = screen.getByRole("dialog", { name: "选择推理强度" });
    expect(within(dialog).getByRole("button", { name: "vendor-ultra" })).toHaveAttribute("aria-pressed", "true");
    expect(within(dialog).getByRole("button", { name: "Low" })).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Low" }));
    expect(onSelect).toHaveBeenCalledWith("low");
  });

  it("shows an explicit empty state when the model has no effort options", () => {
    render(
      <ReasoningEffortPicker
        current={{ ...current, supportedReasoningEfforts: [], reasoningEffort: null }}
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText("当前模型不支持独立推理强度")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Low" })).not.toBeInTheDocument();
  });
});
