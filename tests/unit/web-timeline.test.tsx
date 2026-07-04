import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import {
  Timeline,
  __getTimelineDerivationDiagnostics,
  __resetTimelineDerivationDiagnostics
} from "../../src/web/components/Timeline";

describe("Timeline", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

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

  it("运行中的当前助手消息先按纯文本渲染，避免反复执行代码高亮", () => {
    const { container } = render(
      <Timeline
        running
        activeTurnId="turn-live"
        entries={[
          {
            id: "agent-live",
            turnId: "turn-live",
            createdAt: 1,
            body: {
              kind: "agent-message",
              text: "```ts\nconst streaming = true;\n```"
            }
          }
        ]}
      />
    );

    expect(container.textContent).toContain("```ts");
    expect(screen.queryByRole("button", { name: "复制代码" })).not.toBeInTheDocument();
  });

  it("运行中但 activeTurnId 尚未到位时，最新助手消息也先按纯文本渲染", () => {
    const { container } = render(
      <Timeline
        running
        entries={[
          {
            id: "agent-old",
            turnId: "turn-old",
            createdAt: 1,
            body: {
              kind: "agent-message",
              text: "```ts\nconst oldMessage = true;\n```"
            }
          },
          {
            id: "agent-live",
            createdAt: 2,
            body: {
              kind: "agent-message",
              text: "```ts\nconst liveMessage = true;\n```"
            }
          }
        ]}
      />
    );

    expect(container.textContent).toContain("```ts");
    expect(screen.getByRole("button", { name: "复制代码" })).toBeInTheDocument();
  });

  it("运行中但新回复尚未出现时，不把上一轮助手消息当作 live 消息", () => {
    const { container } = render(
      <Timeline
        running
        entries={[
          {
            id: "agent-old",
            turnId: "turn-old",
            createdAt: 1,
            body: {
              kind: "agent-message",
              text: "```ts\nconst oldMessage = true;\n```"
            }
          },
          {
            id: "user-new",
            createdAt: 2,
            body: {
              kind: "user-message",
              text: "继续",
              status: "sending"
            }
          }
        ]}
      />
    );

    expect(container.textContent).not.toContain("```ts");
    expect(screen.getByRole("button", { name: "复制代码" })).toBeInTheDocument();
  });

  it("超长历史助手消息先按纯文本展示，避免刷新时同步执行 Markdown 高亮", () => {
    const longText = `${"长回复内容\n".repeat(400)}\n\`\`\`ts\nconst shouldNotHighlightImmediately = true;\n\`\`\``;
    const { container } = render(
      <Timeline
        entries={[
          {
            id: "agent-long",
            createdAt: 1,
            body: {
              kind: "agent-message",
              text: longText
            }
          }
        ]}
      />
    );

    expect(container.textContent).toContain("```ts");
    expect(screen.queryByRole("button", { name: "复制代码" })).not.toBeInTheDocument();
  });

  it("长 timeline 初始挂载只渲染可见窗口附近 rows，历史 Markdown 不全部同步渲染", () => {
    const entries = Array.from({ length: 240 }, (_value, index) => ({
      id: `agent-${index}`,
      turnId: `turn-${index}`,
      turnIndex: index,
      createdAt: index,
      body: {
        kind: "agent-message" as const,
        text: `历史回复 ${index}\n\n\`\`\`ts\nconst item${index} = true;\n\`\`\``
      }
    }));

    const { container } = render(<Timeline entries={entries} />);

    expect(container.querySelectorAll("[data-timeline-row='true']").length).toBeLessThanOrEqual(80);
    expect(screen.getAllByText(/历史回复/).length).toBeLessThanOrEqual(80);
    expect(screen.queryAllByRole("button", { name: "复制代码" }).length).toBeLessThanOrEqual(2);
  });

  it("窗口化后仍渲染尾部系统消息、错误卡片和审批卡片", async () => {
    const user = userEvent.setup();
    const entries = [
      ...Array.from({ length: 100 }, (_value, index) => ({
        id: `agent-${index}`,
        turnId: `turn-${index}`,
        createdAt: index,
        body: {
          kind: "agent-message" as const,
          text: `历史回复 ${index}`
        }
      })),
      {
        id: "system-tail",
        createdAt: 101,
        body: { kind: "system" as const, text: "系统提示仍可见" }
      },
      {
        id: "error-tail",
        createdAt: 102,
        body: { kind: "error" as const, text: "错误提示仍可见" }
      }
    ];

    const { container } = render(
      <Timeline
        entries={entries}
        approvals={[
          {
            requestId: "approval-1",
            kind: "command_approval",
            request: { command: "npm test" }
          }
        ]}
      />
    );

    expect(container.querySelectorAll("[data-timeline-row='true']").length).toBeLessThanOrEqual(80);
    expect(screen.getByText("系统提示仍可见")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /出错了/ })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /出错了/ }));
    expect(screen.getByText("错误提示仍可见")).toBeInTheDocument();
    expect(screen.getByText("执行命令需要授权")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "同意" })).toBeInTheDocument();
  });

  it("长 timeline 渲染前预计算行派生状态，避免每行扫描完整 entries", () => {
    __resetTimelineDerivationDiagnostics();
    const entries = Array.from({ length: 240 }, (_value, index) => ({
      id: `user-${index}`,
      turnId: `turn-${index}`,
      turnIndex: index,
      createdAt: index,
      body: {
        kind: "user-message" as const,
        text: `历史提问 ${index}`,
        status: "sent" as const
      }
    }));

    render(<Timeline entries={entries} running />);

    const diagnostics = __getTimelineDerivationDiagnostics();
    expect(diagnostics.derivationRuns).toBe(1);
    expect(diagnostics.rowEntryScans).toBe(0);
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

  it("用户消息把 Skill 引用显示为 chip，复制时只复制正文", () => {
    vi.useFakeTimers();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText }
    });

    render(
      <Timeline
        entries={[
          {
            id: "user-skill",
            turnId: "turn-skill",
            createdAt: 1,
            body: {
              kind: "user-message",
              text: "自建 agent 的意义是什么？",
              skillReferences: [
                {
                  name: "openspec-explore",
                  path: "/repo/.codex/skills/openspec-explore/SKILL.md"
                }
              ],
              status: "sent"
            }
          }
        ]}
      />
    );

    expect(screen.getByText("openspec-explore")).toBeInTheDocument();
    expect(screen.queryByText("[skill]")).not.toBeInTheDocument();

    fireEvent.pointerDown(screen.getByText("自建 agent 的意义是什么？"));
    act(() => {
      vi.advanceTimersByTime(450);
    });
    vi.useRealTimers();

    fireEvent.click(screen.getByRole("button", { name: "复制" }));
    expect(writeText).toHaveBeenCalledWith("自建 agent 的意义是什么？");
  });

  it("长按用户消息显示复制、回滚和 Fork 操作", async () => {
    vi.useFakeTimers();
    const onRewindToMessage = vi.fn();
    const onForkFromMessage = vi.fn();

    render(
      <Timeline
        entries={[
          {
            id: "user-1",
            turnId: "turn-1",
            turnIndex: 0,
            createdAt: 1,
            body: { kind: "user-message", text: "历史消息", status: "sent" }
          }
        ]}
        onRewindToMessage={onRewindToMessage}
        onForkFromMessage={onForkFromMessage}
      />
    );

    fireEvent.pointerDown(screen.getByText("历史消息"));
    act(() => {
      vi.advanceTimersByTime(450);
    });
    vi.useRealTimers();

    expect(screen.getByRole("button", { name: "复制" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "回滚到这里" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "从这里 Fork" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "取消" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "回滚到这里" }));
    expect(onRewindToMessage).toHaveBeenCalledWith(
      expect.objectContaining({ id: "user-1", turnId: "turn-1" })
    );
  });

  it("运行中长按用户消息只显示复制和取消", async () => {
    vi.useFakeTimers();
    render(
      <Timeline
        running
        entries={[
          {
            id: "user-1",
            turnId: "turn-1",
            createdAt: 1,
            body: { kind: "user-message", text: "运行中消息", status: "sent" }
          }
        ]}
      />
    );

    fireEvent.pointerDown(screen.getByText("运行中消息"));
    act(() => {
      vi.advanceTimersByTime(450);
    });
    vi.useRealTimers();

    expect(screen.getByRole("button", { name: "复制" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "回滚到这里" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "从这里 Fork" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "取消" })).toBeInTheDocument();
  });

  it("非用户消息不显示回滚或 Fork 操作", () => {
    render(
      <Timeline
        entries={[
          {
            id: "agent-1",
            createdAt: 1,
            body: { kind: "agent-message", text: "agent reply" }
          }
        ]}
      />
    );

    fireEvent.pointerDown(screen.getByText("agent reply"));

    expect(screen.queryByRole("button", { name: "回滚到这里" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "从这里 Fork" })).not.toBeInTheDocument();
  });
});
