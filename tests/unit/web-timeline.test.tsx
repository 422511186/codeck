import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { Timeline } from "../../src/web/components/Timeline";

describe("Timeline", () => {
  it("把 Default 模式工具不可用提示作为普通 Markdown 文本展示，不生成 question 卡片", () => {
    render(
      <Timeline
        entries={[
          {
            id: "agent-1",
            createdAt: 1,
            body: {
              kind: "agent-message",
              text: "request_user_input is unavailable in Default mode"
            }
          }
        ]}
        approvals={[]}
      />
    );

    expect(screen.getByText("request_user_input is unavailable in Default mode")).toBeInTheDocument();
    expect(screen.queryByText("需要你回答")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "同意" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "拒绝" })).not.toBeInTheDocument();
  });

  it("在本页弹窗预览用户消息图片，不打开新页面", async () => {
    const user = userEvent.setup();
    const open = vi.spyOn(window, "open").mockImplementation(() => null);

    render(
      <Timeline
        entries={[
          {
            id: "user-1",
            createdAt: 1,
            body: {
              kind: "user-message",
              text: "看图",
              imagePaths: ["C:/Users/huang/AppData/Local/Temp/shot.png"],
              status: "sent"
            }
          }
        ]}
      />
    );

    await user.click(screen.getByRole("button", { name: "预览图片" }));

    expect(open).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "图片预览" })).toBeInTheDocument();
    expect(screen.getByAltText("图片预览")).toHaveAttribute(
      "src",
      "/api/codex/images/preview?path=C%3A%2FUsers%2Fhuang%2FAppData%2FLocal%2FTemp%2Fshot.png"
    );

    await user.click(screen.getByRole("button", { name: "关闭预览" }));
    expect(screen.queryByRole("dialog", { name: "图片预览" })).not.toBeInTheDocument();
  });
});
