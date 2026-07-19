import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ThreadNotices } from "../../src/web/components/ThreadNotices";

describe("ThreadNotices", () => {
  it("renders warning notices as dismissible status messages without error presentation", () => {
    const onDismiss = vi.fn();

    render(
      <ThreadNotices
        notices={[{
          id: "warning-1",
          kind: "warning",
          source: "app-server",
          text: "模型元数据待确认",
          createdAt: 1
        }]}
        onDismiss={onDismiss}
      />
    );

    expect(screen.getByRole("status")).toHaveAttribute("data-thread-notice", "warning");
    expect(screen.getByRole("status")).toHaveTextContent("模型元数据待确认");
    expect(screen.getByRole("status")).not.toHaveTextContent("操作失败");

    fireEvent.click(screen.getByRole("button", { name: "关闭提示" }));
    expect(onDismiss).toHaveBeenCalledWith("warning-1");
  });

  it("groups multiple warnings into a compact summary and expands localized details", () => {
    render(
      <ThreadNotices
        notices={[
          {
            id: "warning-1",
            kind: "warning",
            source: "app-server",
            text: "This session was recorded with model `mimo-v2.5-pro` but is resuming with `gpt-5.6-terra`. Consider switching back to `mimo-v2.5-pro` as it may affect Codex performance.",
            createdAt: 1
          },
          {
            id: "warning-2",
            kind: "warning",
            source: "app-server",
            text: "Model metadata for `mimo-v2.5-pro` not found. Defaulting to fallback metadata; this can degrade performance and cause issues.",
            createdAt: 2
          }
        ]}
        onDismiss={() => undefined}
      />
    );

    expect(screen.getByRole("status")).toHaveTextContent("2 条模型与配置提示");
    expect(screen.queryByText(/This session was recorded/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "展开提示" }));

    expect(screen.getByText("会话原使用 mimo-v2.5-pro，当前以 gpt-5.6-terra 恢复，可能影响模型表现。")).toBeInTheDocument();
    expect(screen.getByText("未找到 mimo-v2.5-pro 的模型元数据，当前使用回退配置，可能影响模型表现。")).toBeInTheDocument();
  });
});
