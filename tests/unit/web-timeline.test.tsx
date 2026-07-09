import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import {
  Timeline,
  __getTimelineDerivationDiagnostics,
  __resetTimelineDerivationDiagnostics
} from "../../src/web/components/Timeline";
import { useStore } from "../../src/web/state/store";

describe("Timeline", () => {
  beforeEach(() => {
    useStore.setState({
      wsState: "idle",
      appServer: null,
      threads: {},
      activeThreadId: null,
      skillsCacheVersion: 0
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("为用户、助手和 activity 消息显示相对时间", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-09T12:00:00.000Z"));
    const now = Date.now();

    render(
      <Timeline
        entries={[
          {
            id: "user-1",
            turnId: "turn-1",
            createdAt: now - 3 * 60 * 1000,
            body: {
              kind: "user-message",
              text: "请分析 timeline",
              status: "sent"
            }
          },
          {
            id: "agent-1",
            turnId: "turn-1",
            createdAt: now - 2 * 24 * 60 * 60 * 1000,
            body: {
              kind: "agent-message",
              text: "分析完成"
            }
          },
          {
            id: "tool-1",
            turnId: "turn-1",
            createdAt: now - 10 * 60 * 1000,
            body: {
              kind: "tool",
              toolKind: "command",
              server: "/repo",
              tool: "rg timeline src",
              status: "success",
              result: "src/web/components/Timeline.tsx"
            }
          }
        ]}
      />
    );

    expect(screen.getByText("3 分钟前")).toBeInTheDocument();
    expect(screen.getByText("2 天前")).toBeInTheDocument();
    expect(screen.getByText("10 分钟前")).toBeInTheDocument();
  });

  it("不为排序占位 createdAt 显示错误的远古相对时间", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-09T12:00:00.000Z"));
    const { container } = render(
      <Timeline
        entries={[
          {
            id: "agent-placeholder-created-at",
            createdAt: 1,
            body: {
              kind: "agent-message",
              text: "这条消息只有排序占位时间"
            }
          }
        ]}
      />
    );

    expect(screen.getByText("这条消息只有排序占位时间")).toBeInTheDocument();
    expect(screen.queryByText("56 年前")).not.toBeInTheDocument();
    expect(container.querySelector("time")).toBeNull();
  });

  it("Markdown 长内容不会撑出 timeline 横向滚动", () => {
    const longWord = "x".repeat(240);
    const { container } = render(
      <Timeline
        entries={[
          {
            id: "agent-wide-markdown",
            createdAt: Date.parse("2026-07-09T12:00:00.000Z"),
            body: {
              kind: "agent-message",
              text: [
                `普通长词 ${longWord}`,
                "",
                "| State | Very long column |",
                "| --- | --- |",
                `| A | ${longWord} |`,
                "",
                "```text",
                longWord,
                "```"
              ].join("\n")
            }
          }
        ]}
      />
    );

    const row = container.querySelector("[data-timeline-row='true']");
    const markdown = container.querySelector(".cw-markdown");
    const codeBlock = container.querySelector("pre");
    const tableScroller = container.querySelector("[data-markdown-table-scroll='true']");

    expect(row).toHaveStyle({ maxWidth: "100%", minWidth: "0" });
    expect(markdown).toHaveStyle({ maxWidth: "100%", minWidth: "0", overflowX: "hidden" });
    expect(codeBlock).toHaveStyle({ maxWidth: "100%", overflowX: "auto" });
    expect(tableScroller).toHaveStyle({ maxWidth: "100%", overflowX: "auto" });
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

  it("滚入顶部占位区域时扩展可见窗口，避免出现空白历史区域", () => {
    const entries = Array.from({ length: 240 }, (_value, index) => ({
      id: `agent-${index}`,
      turnId: `turn-${index}`,
      turnIndex: index,
      createdAt: index,
      body: {
        kind: "agent-message" as const,
        text: `历史回复 ${index}`
      }
    }));

    const { container } = render(
      <div className="cw-thread-scroller">
        <Timeline entries={entries} />
      </div>
    );
    const scroller = container.querySelector(".cw-thread-scroller") as HTMLDivElement;
    let scrollTop = 10_000;
    Object.defineProperty(scroller, "scrollTop", {
      configurable: true,
      get: () => scrollTop,
      set: (value) => {
        scrollTop = value;
      }
    });
    Object.defineProperty(scroller, "clientHeight", {
      configurable: true,
      get: () => 600
    });

    expect(screen.queryByText("历史回复 130")).not.toBeInTheDocument();

    fireEvent.scroll(scroller);

    expect(screen.getByText("历史回复 130")).toBeInTheDocument();
    expect(container.querySelectorAll("[data-timeline-row='true']").length).toBeLessThan(entries.length);
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

  it("将同一 turn 内连续活动渲染为内联日志而不是 Activity 卡片", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <Timeline
        entries={[
          {
            id: "reasoning-1",
            turnId: "turn-1",
            createdAt: 2,
            body: { kind: "reasoning", text: "**先看结构**\n再运行测试", done: true }
          },
          {
            id: "tool-1",
            turnId: "turn-1",
            createdAt: 3,
            body: {
              kind: "tool",
              toolKind: "command",
              server: "/repo",
              tool: "npm test",
              status: "success",
              result: "passed"
            }
          },
          {
            id: "diff-1",
            turnId: "turn-1",
            createdAt: 4,
            body: {
              kind: "diff",
              path: "src/app.ts",
              added: 2,
              removed: 1,
              diff: "--- a/src/app.ts\n+++ b/src/app.ts\n@@ -1 +1,2 @@\n-old\n+new\n+added"
            }
          },
          {
            id: "agent-1",
            turnId: "turn-1",
            createdAt: 5,
            body: { kind: "agent-message", text: "已完成" }
          }
        ]}
      />
    );

    expect(screen.queryByText("Activity")).not.toBeInTheDocument();
    expect(screen.getByText("Thinking")).toBeInTheDocument();
    expect(screen.queryByText("先看结构")).not.toBeInTheDocument();
    expect(screen.queryByText("再运行测试")).not.toBeInTheDocument();
    expect(screen.getByText("已运行 1 条命令")).toBeInTheDocument();
    expect(screen.queryByText("已运行 npm test")).not.toBeInTheDocument();
    expect(screen.getByText("Files changed · 1 · +2 -1")).toBeInTheDocument();
    expect(container.innerHTML).not.toContain("border-left: 3px solid");

    await user.click(screen.getByText("Thinking").closest("button")!);

    expect(screen.getAllByRole("button", { name: "Thinking" })).toHaveLength(1);
    expect(screen.getByText(/\*\*先看结构\*\*/)).toBeInTheDocument();
    expect(screen.getByText(/再运行测试/)).toBeInTheDocument();

    await user.click(screen.getByText("已运行 1 条命令").closest("button")!);

    expect(screen.getByRole("button", { name: "已运行 npm test" })).toBeInTheDocument();
    expect(screen.queryByText("passed")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "已运行 npm test" }));
    expect(screen.getByText("passed")).toBeInTheDocument();

    await user.click(screen.getByText("Files changed · 1 · +2 -1").closest("button")!);

    expect(screen.queryByRole("button", { name: "src/app.ts · +2 -1" })).not.toBeInTheDocument();
    expect(screen.getByText("src/app.ts")).toBeInTheDocument();
    expect(screen.getByText(/--- a\/src\/app.ts/)).toBeInTheDocument();
    expect(screen.getByText("已完成")).toBeInTheDocument();
  });

  it("read/search/list/command 混合活动默认只显示摘要，展开后显示动作列表", async () => {
    const user = userEvent.setup();
    render(
      <Timeline
        entries={[
          {
            id: "read-1",
            turnId: "turn-1",
            createdAt: 1,
            body: {
              kind: "tool",
              toolKind: "command",
              server: "/repo",
              tool: "sed -n '1,80p' src/app.ts",
              status: "success",
              result: "content"
            }
          },
          {
            id: "search-1",
            turnId: "turn-1",
            createdAt: 2,
            body: {
              kind: "tool",
              toolKind: "command",
              server: "/repo",
              tool: "rg timeline src",
              status: "success",
              result: "src/app.ts"
            }
          },
          {
            id: "list-1",
            turnId: "turn-1",
            createdAt: 2.5,
            body: {
              kind: "tool",
              toolKind: "command",
              actionKind: "list",
              server: "/repo",
              tool: "ls src",
              status: "success",
              result: "app.ts"
            }
          },
          {
            id: "cmd-1",
            turnId: "turn-1",
            createdAt: 3,
            body: {
              kind: "tool",
              toolKind: "command",
              server: "/repo",
              tool: "npm test",
              status: "success",
              result: "passed"
            }
          }
        ]}
      />
    );

    expect(screen.getByText("已读取 1 个文件已浏览 1 个目录已搜索 1 次已运行 1 条命令")).toBeInTheDocument();
    expect(screen.queryByText("Read src/app.ts")).not.toBeInTheDocument();
    expect(screen.queryByText("List src")).not.toBeInTheDocument();
    expect(screen.queryByText("Searched timeline")).not.toBeInTheDocument();
    expect(screen.queryByText("已运行 npm test")).not.toBeInTheDocument();

    await user.click(screen.getByText("已读取 1 个文件已浏览 1 个目录已搜索 1 次已运行 1 条命令").closest("button")!);

    expect(screen.getByRole("button", { name: "Read src/app.ts" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "List src" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Searched timeline" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "已运行 npm test" })).toBeInTheDocument();
    expect(screen.queryByText("content")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Read src/app.ts" }));

    expect(screen.getByText("content")).toBeInTheDocument();
  });

  it("inline activity 展开长文本时只挂载有界预览", async () => {
    const user = userEvent.setup();
    const longOutput = Array.from({ length: 160 }, (_value, index) => `output-line-${index}`).join("\n");
    render(
      <Timeline
        entries={[
          {
            id: "cmd-long-output",
            turnId: "turn-1",
            createdAt: 1,
            body: {
              kind: "tool",
              toolKind: "command",
              server: "/repo",
              tool: "npm test",
              status: "success",
              result: longOutput
            }
          }
        ]}
      />
    );

    await user.click(screen.getByText("已运行 1 条命令").closest("button")!);
    await user.click(screen.getByRole("button", { name: "已运行 npm test" }));

    expect(
      screen.getByText((_content, element) => element?.tagName.toLowerCase() === "pre" && Boolean(element.textContent?.includes("output-line-0")))
    ).toBeInTheDocument();
    expect(
      screen.queryByText((_content, element) => element?.tagName.toLowerCase() === "pre" && Boolean(element.textContent?.includes("output-line-159")))
    ).not.toBeInTheDocument();
    expect(screen.getByText(/已截断/)).toBeInTheDocument();
  });

  it("失败活动使用中文状态并在展开后直接显示错误详情", async () => {
    const user = userEvent.setup();
    render(
      <Timeline
        entries={[
          {
            id: "cmd-failed",
            turnId: "turn-1",
            createdAt: 1,
            body: {
              kind: "tool",
              toolKind: "command",
              server: "/repo",
              tool: "sed -n '1,80p' missing.md",
              status: "failed",
              result: "sed: can't read missing.md: No such file or directory"
            }
          }
        ]}
      />
    );

    expect(screen.getByText("失败")).toBeInTheDocument();
    expect(screen.queryByText("Failed")).not.toBeInTheDocument();
    expect(screen.queryByText(/No such file/)).not.toBeInTheDocument();

    await user.click(screen.getByText("已读取 1 个文件").closest("button")!);

    expect(screen.queryByRole("button", { name: "已运行 sed -n '1,80p' missing.md" })).not.toBeInTheDocument();
    expect(screen.getByText(/sed -n '1,80p' missing.md/)).toBeInTheDocument();
    expect(screen.getByText(/No such file or directory/)).toBeInTheDocument();
  });

  it("file 工具活动展开后直接显示文件输出详情", async () => {
    const user = userEvent.setup();
    render(
      <Timeline
        entries={[
          {
            id: "file-1",
            turnId: "turn-1",
            createdAt: 1,
            body: {
              kind: "tool",
              toolKind: "file",
              server: "file",
              tool: "src/app.ts",
              diffPath: "src/app.ts",
              added: 1,
              removed: 1,
              status: "success",
              result: "--- a/src/app.ts\n+++ b/src/app.ts\n@@ -1 +1 @@\n-old\n+new"
            }
          }
        ]}
      />
    );

    expect(screen.getByText("Files changed · 1 · +1 -1")).toBeInTheDocument();
    expect(screen.queryByText(/--- a\/src\/app.ts/)).not.toBeInTheDocument();

    await user.click(screen.getByText("Files changed · 1 · +1 -1").closest("button")!);

    expect(screen.queryByRole("button", { name: "src/app.ts · +1 -1" })).not.toBeInTheDocument();
    expect(screen.getByText("src/app.ts")).toBeInTheDocument();
    expect(screen.getByText(/--- a\/src\/app.ts/)).toBeInTheDocument();
  });

  it("diff activity 展开后显示结构化 diff view 和完整 diff 复制入口", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText }
    });
    const diff = [
      "--- a/src/app.ts",
      "+++ b/src/app.ts",
      "@@ -1,1 +1,130 @@",
      "-old",
      "+new",
      ...Array.from({ length: 130 }, (_value, index) => `+added-${index}`)
    ].join("\n");

    render(
      <Timeline
        entries={[
          {
            id: "diff-structured",
            turnId: "turn-1",
            createdAt: 1,
            body: {
              kind: "diff",
              path: "src/app.ts",
              added: 131,
              removed: 1,
              diff
            }
          }
        ]}
      />
    );

    expect(screen.getByText("Files changed · 1 · +131 -1")).toBeInTheDocument();
    expect(screen.queryByText("old")).not.toBeInTheDocument();

    await user.click(screen.getByText("Files changed · 1 · +131 -1").closest("button")!);

    expect(screen.queryByRole("button", { name: "src/app.ts · +131 -1" })).not.toBeInTheDocument();
    expect(screen.getByText("src/app.ts")).toBeInTheDocument();
    expect(screen.getByText("+131")).toBeInTheDocument();
    expect(screen.getByText("-1")).toBeInTheDocument();
    expect(screen.getByText("@@ -1,1 +1,130 @@")).toBeInTheDocument();
    expect(screen.getByText("old")).toBeInTheDocument();
    expect(screen.getByText("new")).toBeInTheDocument();
    expect(screen.getAllByText("1").length).toBeGreaterThan(0);
    expect(screen.queryByText("added-129")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "复制完整 diff" }));
    expect(writeText).toHaveBeenCalledWith(diff);
  });

  it("file 工具 activity 展开后使用 diff view fallback 且不出现第二层文件按钮", async () => {
    const user = userEvent.setup();
    render(
      <Timeline
        entries={[
          {
            id: "file-tool-structured",
            turnId: "turn-1",
            createdAt: 1,
            body: {
              kind: "tool",
              toolKind: "file",
              server: "file",
              tool: "src/file-tool.ts",
              diffPath: "src/file-tool.ts",
              added: 1,
              removed: 1,
              status: "success",
              result: "--- a/src/file-tool.ts\n+++ b/src/file-tool.ts\n@@ -4,1 +4,1 @@\n-before\n+after"
            }
          }
        ]}
      />
    );

    await user.click(screen.getByText("Files changed · 1 · +1 -1").closest("button")!);

    expect(screen.queryByRole("button", { name: "src/file-tool.ts · +1 -1" })).not.toBeInTheDocument();
    expect(screen.getByText("src/file-tool.ts")).toBeInTheDocument();
    expect(screen.getByText("@@ -4,1 +4,1 @@")).toBeInTheDocument();
    expect(screen.getByText("before")).toBeInTheDocument();
    expect(screen.getByText("after")).toBeInTheDocument();
    expect(screen.getAllByText("4").length).toBeGreaterThan(0);
  });

  it("多文件 Files changed 展开后按 entry 顺序直接显示多个 diff block", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <Timeline
        entries={[
          {
            id: "diff-a",
            turnId: "turn-1",
            createdAt: 1,
            body: {
              kind: "diff",
              path: "src/a.ts",
              added: 1,
              removed: 1,
              diff: "--- a/src/a.ts\n+++ b/src/a.ts\n@@ -1,1 +1,1 @@\n-oldA\n+newA"
            }
          },
          {
            id: "diff-b",
            turnId: "turn-1",
            createdAt: 2,
            body: {
              kind: "diff",
              path: "src/b.ts",
              added: 1,
              removed: 1,
              diff: "--- a/src/b.ts\n+++ b/src/b.ts\n@@ -2,1 +2,1 @@\n-oldB\n+newB"
            }
          }
        ]}
      />
    );

    await user.click(screen.getByText("Files changed · 2 · +2 -2").closest("button")!);

    expect(screen.queryByRole("button", { name: "src/a.ts · +1 -1" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "src/b.ts · +1 -1" })).not.toBeInTheDocument();
    expect(screen.getByText("oldA")).toBeInTheDocument();
    expect(screen.getByText("newA")).toBeInTheDocument();
    expect(screen.getByText("oldB")).toBeInTheDocument();
    expect(screen.getByText("newB")).toBeInTheDocument();

    const text = container.textContent ?? "";
    expect(text.indexOf("src/a.ts")).toBeLessThan(text.indexOf("oldA"));
    expect(text.indexOf("oldA")).toBeLessThan(text.indexOf("src/b.ts"));
    expect(text.indexOf("src/b.ts")).toBeLessThan(text.indexOf("oldB"));
  });

  it("Loaded tools 活动默认只显示标题，展开后显示 Skill 动作列表", async () => {
    const user = userEvent.setup();
    render(
      <Timeline
        entries={[
          {
            id: "turn-1-skills-loaded",
            turnId: "turn-1",
            createdAt: 1,
            body: {
              kind: "tool",
              toolKind: "dynamic",
              server: "skills",
              tool: "loaded",
              status: "success",
              result: "openspec-explore, systematic-debugging"
            }
          }
        ]}
      />
    );

    expect(screen.getByText("Loaded 2 tools")).toBeInTheDocument();
    expect(screen.queryByText("读取 openspec-explore 技能")).not.toBeInTheDocument();
    expect(screen.queryByText("读取 systematic-debugging 技能")).not.toBeInTheDocument();
    expect(screen.queryByText(/Skills loaded/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Used tools/)).not.toBeInTheDocument();

    await user.click(screen.getByText("Loaded 2 tools").closest("button")!);

    expect(screen.getByRole("button", { name: "读取 openspec-explore 技能" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "读取 systematic-debugging 技能" })).toBeInTheDocument();
  });

  it("单个 Loaded tool 活动使用 Codex App 风格单数标题", () => {
    render(
      <Timeline
        entries={[
          {
            id: "turn-1-skill-loaded",
            turnId: "turn-1",
            createdAt: 1,
            body: {
              kind: "tool",
              toolKind: "dynamic",
              server: "skills",
              tool: "loaded",
              status: "success",
              result: "systematic-debugging"
            }
          }
        ]}
      />
    );

    expect(screen.getByText("Loaded a tool")).toBeInTheDocument();
    expect(screen.queryByText("Loaded 1 tools")).not.toBeInTheDocument();
  });

  it("assistant 消息和内联活动按真实顺序穿插渲染", () => {
    const { container } = render(
      <Timeline
        entries={[
          {
            id: "agent-1",
            turnId: "turn-1",
            createdAt: 1,
            body: { kind: "agent-message", text: "先说明第一段" }
          },
          {
            id: "cmd-1",
            turnId: "turn-1",
            createdAt: 2,
            body: {
              kind: "tool",
              toolKind: "command",
              server: "/repo",
              tool: "npm test",
              status: "success",
              result: "passed"
            }
          },
          {
            id: "agent-2",
            turnId: "turn-1",
            createdAt: 3,
            body: { kind: "agent-message", text: "再说明第二段" }
          },
          {
            id: "diff-1",
            turnId: "turn-1",
            createdAt: 4,
            body: {
              kind: "diff",
              path: "src/app.ts",
              added: 1,
              removed: 0,
              diff: "--- a/src/app.ts\n+++ b/src/app.ts\n@@ -1 +1,2 @@\n old\n+new"
            }
          },
          {
            id: "agent-3",
            turnId: "turn-1",
            createdAt: 5,
            body: { kind: "agent-message", text: "最后说明第三段" }
          }
        ]}
      />
    );

    const text = container.textContent ?? "";
    expect(text.indexOf("先说明第一段")).toBeLessThan(text.indexOf("已运行 1 条命令"));
    expect(text.indexOf("已运行 1 条命令")).toBeLessThan(text.indexOf("再说明第二段"));
    expect(text.indexOf("再说明第二段")).toBeLessThan(text.indexOf("Files changed · 1 · +1 -0"));
    expect(text.indexOf("Files changed · 1 · +1 -0")).toBeLessThan(text.indexOf("最后说明第三段"));
    expect(screen.queryByText("Activity")).not.toBeInTheDocument();
  });

  it("repair 后补活动按 store 语义顺序渲染在最终助手回复之前", () => {
    useStore.getState().appendEntries("thread-1", [
      {
        id: "user-1",
        turnId: "turn-1",
        createdAt: 1,
        body: { kind: "user-message", text: "分析 bug", status: "sent" }
      },
      {
        id: "agent-final",
        turnId: "turn-1",
        createdAt: 3,
        body: { kind: "agent-message", text: "最终结论" }
      },
      {
        id: "tool-repaired",
        turnId: "turn-1",
        createdAt: 2,
        body: {
          kind: "tool",
          toolKind: "command",
          server: "/repo",
          tool: "rg timeline src",
          status: "success",
          result: "src/web/state/store.ts"
        }
      }
    ]);

    const entries = useStore.getState().threads["thread-1"]?.entries ?? [];
    const { container } = render(<Timeline entries={entries} />);

    const text = container.textContent ?? "";
    expect(text.indexOf("分析 bug")).toBeLessThan(text.indexOf("已搜索 1 次"));
    expect(text.indexOf("已搜索 1 次")).toBeLessThan(text.indexOf("最终结论"));
  });

  it("连续活动摘要按原始事件顺序显示，动作列表需展开后显示", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <Timeline
        entries={[
          {
            id: "diff-1",
            turnId: "turn-1",
            createdAt: 1,
            body: {
              kind: "diff",
              path: "src/app.ts",
              added: 1,
              removed: 0,
              diff: "--- a/src/app.ts\n+++ b/src/app.ts\n@@ -1 +1,2 @@\n old\n+new"
            }
          },
          {
            id: "cmd-1",
            turnId: "turn-1",
            createdAt: 2,
            body: {
              kind: "tool",
              toolKind: "command",
              server: "/repo",
              tool: "npm test",
              status: "success",
              result: "passed"
            }
          }
        ]}
      />
    );

    const text = container.textContent ?? "";
    expect(text.indexOf("Files changed · 1 · +1 -0")).toBeLessThan(text.indexOf("已运行 1 条命令"));
    expect(screen.queryByText("已运行 npm test")).not.toBeInTheDocument();

    await user.click(screen.getByText("已运行 1 条命令").closest("button")!);

    expect(screen.getByRole("button", { name: "已运行 npm test" })).toBeInTheDocument();
  });

  it("长输出和 diff 默认折叠，展开组后显示动作，展开动作后显示完整详情", async () => {
    const user = userEvent.setup();
    render(
      <Timeline
        entries={[
          {
            id: "cmd-1",
            turnId: "turn-1",
            createdAt: 1,
            body: {
              kind: "tool",
              toolKind: "command",
              server: "/repo",
              tool: "npm test",
              status: "success",
              result: "line 1\nline 2\nline 3"
            }
          },
          {
            id: "diff-1",
            turnId: "turn-1",
            createdAt: 2,
            body: {
              kind: "diff",
              path: "src/app.ts",
              added: 1,
              removed: 1,
              diff: "--- a/src/app.ts\n+++ b/src/app.ts\n@@ -1 +1 @@\n-old\n+new"
            }
          }
        ]}
      />
    );

    expect(screen.queryByText("已运行 npm test")).not.toBeInTheDocument();
    expect(screen.getByText("Files changed · 1 · +1 -1")).toBeInTheDocument();
    expect(screen.queryByText("line 1")).not.toBeInTheDocument();
    expect(screen.queryByText("--- a/src/app.ts")).not.toBeInTheDocument();

    await user.click(screen.getByText("已运行 1 条命令").closest("button")!);
    expect(screen.getByRole("button", { name: "已运行 npm test" })).toBeInTheDocument();
    expect(screen.queryByText("line 1")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "已运行 npm test" }));
    expect(screen.getByText(/line 1/)).toBeInTheDocument();

    await user.click(screen.getByText("Files changed · 1 · +1 -1").closest("button")!);
    expect(screen.queryByRole("button", { name: "src/app.ts · +1 -1" })).not.toBeInTheDocument();
    expect(screen.getByText(/--- a\/src\/app.ts/)).toBeInTheDocument();
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
