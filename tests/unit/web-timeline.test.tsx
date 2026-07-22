import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import {
  Timeline,
  __getTimelineDerivationDiagnostics,
  __resetTimelineDerivationDiagnostics,
  deriveTimelineRenderBlocks
} from "../../src/web/components/Timeline";
import { __getMarkdownDiagnostics, __resetMarkdownDiagnostics } from "../../src/web/components/Markdown";
import { __getDiffViewDiagnostics, __resetDiffViewDiagnostics } from "../../src/web/components/cards/DiffCard";
import {
  createTextPreview,
  __getTextPreviewDiagnostics,
  __resetTextPreviewDiagnostics
} from "../../src/web/components/cards/LongTextPreview";
import { useStore } from "../../src/web/state/store";
import { codex } from "../../src/web/api/endpoints";

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

  it("发送后的实时事件与快照具有相同结构化身份时只渲染最新条目", () => {
    render(
      <Timeline
        entries={[
          {
            id: "item-1",
            turnId: "turn-1",
            bootId: "boot-1",
            generation: 0,
            snapshotSequence: 10,
            createdAt: 1,
            body: { kind: "agent-message", text: "实时旧版本" }
          },
          {
            id: "item-1",
            turnId: "turn-1",
            bootId: "boot-1",
            generation: 0,
            snapshotSequence: 11,
            createdAt: 1,
            body: { kind: "agent-message", text: "快照最新版本" }
          }
        ]}
      />
    );

    expect(screen.queryByText("实时旧版本")).not.toBeInTheDocument();
    expect(screen.getByText("快照最新版本")).toBeInTheDocument();
  });

  it("同名 item 位于不同 turn 时都渲染且不产生重复 key 告警", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    render(
      <Timeline
        entries={[
          {
            id: "item-1",
            turnId: "turn-1",
            generation: 1,
            createdAt: 1,
            body: { kind: "agent-message", text: "第一个 turn" }
          },
          {
            id: "item-1",
            turnId: "turn-2",
            generation: 1,
            createdAt: 2,
            body: { kind: "agent-message", text: "第二个 turn" }
          }
        ]}
      />
    );

    const duplicateKeyWarnings = consoleError.mock.calls.filter((call) =>
      call.some((value) => String(value).includes("same key"))
    );
    consoleError.mockRestore();

    expect(screen.getByText("第一个 turn")).toBeInTheDocument();
    expect(screen.getByText("第二个 turn")).toBeInTheDocument();
    expect(duplicateKeyWarnings).toEqual([]);
  });

  it("同名 item 位于不同 generation 时生成不同的稳定渲染身份", () => {
    const blocks = deriveTimelineRenderBlocks([
      {
        id: "item-1",
        turnId: "turn-1",
        bootId: "boot-1",
        generation: 1,
        createdAt: 1,
        body: { kind: "agent-message", text: "旧 generation" }
      },
      {
        id: "item-1",
        turnId: "turn-1",
        bootId: "boot-1",
        generation: 2,
        createdAt: 2,
        body: { kind: "agent-message", text: "新 generation" }
      }
    ]);

    expect(blocks).toHaveLength(2);
    expect(new Set(blocks.map((block) => block.identity))).toHaveLength(2);
  });

  it("同 turn 的不同 generation 复用 item ID 时保留两条且不产生重复 key warning", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    render(
      <Timeline
        entries={[
          {
            id: "item-1",
            turnId: "turn-reused",
            bootId: "boot-1",
            generation: 0,
            createdAt: 1,
            body: { kind: "agent-message", text: "旧历史" }
          },
          {
            id: "item-1",
            turnId: "turn-reused",
            bootId: "boot-1",
            generation: 1,
            createdAt: 2,
            body: { kind: "agent-message", text: "新历史" }
          }
        ]}
      />
    );

    expect(screen.getByText("旧历史")).toBeInTheDocument();
    expect(screen.getByText("新历史")).toBeInTheDocument();
    expect(consoleError.mock.calls.flat().join(" ")).not.toContain("same key");
    consoleError.mockRestore();
  });

  it("完全相同逻辑身份的重复记录只保留最后版本", () => {
    const blocks = deriveTimelineRenderBlocks([
      {
        id: "item-1",
        turnId: "turn-1",
        historyStamp: { bootId: "boot-1", generation: 1 },
        createdAt: 1,
        body: { kind: "error", text: "旧错误" }
      },
      {
        id: "item-1",
        turnId: "turn-1",
        historyStamp: { bootId: "boot-1", generation: 1 },
        createdAt: 2,
        body: { kind: "error", text: "新错误" }
      }
    ]);

    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({
      kind: "entry",
      entry: { body: { kind: "error", text: "新错误" } }
    });
  });

  it("被普通消息分隔的同名 activity block 仍生成唯一身份", () => {
    const blocks = deriveTimelineRenderBlocks([
      {
        id: "item-1",
        turnId: "turn-1",
        generation: 1,
        createdAt: 1,
        body: {
          kind: "tool",
          tool: "first",
          status: "success"
        }
      },
      {
        id: "agent-divider",
        turnId: "turn-1",
        generation: 2,
        createdAt: 2,
        body: { kind: "agent-message", text: "分隔消息" }
      },
      {
        id: "item-1",
        turnId: "turn-1",
        generation: 2,
        createdAt: 3,
        body: {
          kind: "tool",
          tool: "second",
          status: "success"
        }
      }
    ]);

    expect(blocks).toHaveLength(3);
    expect(new Set(blocks.map((block) => block.identity))).toHaveLength(3);
  });

  it("不为用户、助手和 activity 消息显示相对时间", () => {
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

    expect(screen.queryByText("3 分钟前")).not.toBeInTheDocument();
    expect(screen.queryByText("2 天前")).not.toBeInTheDocument();
    expect(screen.queryByText("10 分钟前")).not.toBeInTheDocument();
    expect(document.querySelector("time")).toBeNull();
  });

  it("隐藏完成态 reasoning，不展示摘要或 Thinking 行", () => {
    render(
      <Timeline
        entries={[
          {
            id: "reasoning-complete",
            turnId: "turn-1",
            createdAt: 1,
            body: {
              kind: "reasoning",
              text: "Planning the implementation",
              done: true
            }
          },
          {
            id: "agent-1",
            turnId: "turn-1",
            createdAt: 2,
            body: { kind: "agent-message", text: "实现完成" }
          }
        ]}
      />
    );

    expect(screen.queryByText("Planning the implementation")).not.toBeInTheDocument();
    expect(screen.queryByText(/^Thinking/)).not.toBeInTheDocument();
    expect(screen.getByText("实现完成")).toBeInTheDocument();
  });

  it("运行态最多显示一个临时 Thinking，占位在后续 activity 到达后消失", () => {
    const reasoningEntries = [
      {
        id: "reasoning-running-1",
        turnId: "turn-live",
        createdAt: 1,
        body: {
          kind: "reasoning" as const,
          text: "Inspecting the repository",
          done: false
        }
      },
      {
        id: "reasoning-running-2",
        turnId: "turn-live",
        createdAt: 2,
        body: {
          kind: "reasoning" as const,
          text: "Planning the fix",
          done: false
        }
      }
    ];
    const { rerender } = render(
      <Timeline running activeTurnId="turn-live" entries={reasoningEntries} />
    );

    expect(screen.getAllByText("Thinking...")).toHaveLength(1);
    expect(screen.queryByText("Inspecting the repository")).not.toBeInTheDocument();
    expect(screen.queryByText("Planning the fix")).not.toBeInTheDocument();

    rerender(
      <Timeline
        running
        activeTurnId="turn-live"
        entries={[
          ...reasoningEntries,
          {
            id: "tool-after-reasoning",
            turnId: "turn-live",
            createdAt: 3,
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

    expect(screen.queryByText("Thinking...")).not.toBeInTheDocument();
    expect(screen.getByText("搜索了代码")).toBeInTheDocument();
  });

  it("上下文压缩开始时显示轻量运行状态，完成后原位更新", () => {
    const entry = {
      id: "compact-1",
      turnId: "turn-live",
      createdAt: 1,
      body: {
        kind: "system" as const,
        text: "正在自动压缩上下文",
        systemKind: "context-compaction" as const,
        status: "running" as const
      }
    };
    const { container, rerender } = render(<Timeline running activeTurnId="turn-live" entries={[entry]} />);

    expect(screen.getByText("正在自动压缩上下文")).toBeInTheDocument();
    expect(screen.queryByText("压缩上下文已完成")).not.toBeInTheDocument();
    expect(container.querySelector("[data-context-compaction-status='running'] svg")).not.toBeNull();

    rerender(
      <Timeline
        entries={[
          {
            ...entry,
            body: { ...entry.body, text: "压缩上下文已完成", status: "success" }
          }
        ]}
      />
    );

    expect(screen.queryByText("正在自动压缩上下文")).not.toBeInTheDocument();
    expect(screen.getByText("压缩上下文已完成")).toBeInTheDocument();
    expect(container.querySelector("[data-context-compaction-status='success'] svg")).not.toBeNull();
  });

  it("操作级 warning 使用紧凑非折叠状态提示", () => {
    const { container } = render(
      <Timeline
        entries={[
          {
            id: "warning-1",
            createdAt: 1,
            body: {
              kind: "system",
              systemKind: "warning" as const,
              text: "目标模型未生效，已恢复原模型"
            }
          }
        ]}
      />
    );

    expect(screen.getByRole("status")).toHaveTextContent("目标模型未生效，已恢复原模型");
    expect(container.querySelector("[data-system-warning='true']")).not.toBeNull();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByText("出错了")).not.toBeInTheDocument();
  });

  it("真正错误使用紧凑操作失败 alert，不渲染折叠卡片或嵌套 pre", () => {
    const { container } = render(
      <Timeline
        entries={[
          {
            id: "error-1",
            createdAt: 1,
            body: { kind: "error", text: "运行时无法恢复" }
          }
        ]}
      />
    );

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("操作失败");
    expect(alert).toHaveTextContent("运行时无法恢复");
    expect(screen.queryByText("出错了")).not.toBeInTheDocument();
    expect(container.querySelector("button")).toBeNull();
    expect(container.querySelector("pre")).toBeNull();
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

  it("同名 item 不会把旧 turn 的助手消息误标为 live", () => {
    const { container } = render(
      <Timeline
        running
        activeTurnId="turn-live"
        entries={[
          {
            id: "item-1",
            turnId: "turn-old",
            generation: 1,
            createdAt: 1,
            body: {
              kind: "agent-message",
              text: "```ts\nconst historical = true;\n```"
            }
          },
          {
            id: "item-1",
            turnId: "turn-live",
            generation: 1,
            createdAt: 2,
            body: {
              kind: "agent-message",
              text: "```ts\nconst streaming = true;\n```"
            }
          }
        ]}
      />
    );

    expect(container.textContent).toContain("```ts");
    expect(screen.getAllByRole("button", { name: "复制代码" })).toHaveLength(1);
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

  it("truncated 消息按 cursor 读取完整内容并替换 preview", async () => {
    const user = userEvent.setup();
    const entry = {
      id: "agent-truncated",
      turnId: "turn-1",
      createdAt: 1,
      completeness: {
        status: "truncated" as const,
        reason: "item-budget",
        originalBytes: 33,
        includedBytes: 6,
        contentRef: "tlc-agent"
      },
      body: { kind: "agent-message" as const, text: "预览" }
    };
    const readContent = vi.spyOn(codex, "readTimelineContent")
      .mockResolvedValueOnce({
        text: "完整内容第一段",
        startOffset: 0,
        endOffset: 21,
        nextCursor: "cursor-2",
        includedBytes: 21,
        completeness: { status: "partial", nextCursor: "cursor-2" }
      })
      .mockResolvedValueOnce({
        text: "，第二段",
        startOffset: 21,
        endOffset: 33,
        nextCursor: null,
        includedBytes: 12,
        completeness: { status: "complete", nextCursor: null }
      });

    useStore.getState().setThreadEntries("thread-1", [entry], null);

    render(
      <Timeline
        threadId="thread-1"
        entries={[entry]}
      />
    );

    expect(screen.getByText("内容已截断")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "读取完整内容" }));

    expect(await screen.findByText("完整内容第一段，第二段")).toBeInTheDocument();
    expect(readContent).toHaveBeenNthCalledWith(1, "thread-1", "tlc-agent", null);
    expect(readContent).toHaveBeenNthCalledWith(2, "thread-1", "tlc-agent", "cursor-2");
    expect(useStore.getState().threads["thread-1"]?.entries).toEqual([
      expect.objectContaining({
        id: "agent-truncated",
        completeness: expect.objectContaining({ status: "complete" }),
        body: { kind: "agent-message", text: "完整内容第一段，第二段" }
      })
    ]);
    readContent.mockRestore();
  });

  it("truncated user-message 按 cursor 读取完整内容后会替换 preview", async () => {
    const user = userEvent.setup();
    const entry = {
      id: "user-truncated",
      turnId: "turn-1",
      createdAt: 1,
      completeness: {
        status: "truncated" as const,
        reason: "item-budget",
        originalBytes: 33,
        includedBytes: 6,
        contentRef: "tlc-user"
      },
      body: { kind: "user-message" as const, text: "预览", status: "sent" as const }
    };
    const readContent = vi.spyOn(codex, "readTimelineContent")
      .mockResolvedValueOnce({
        text: "完整内容第一段",
        startOffset: 0,
        endOffset: 21,
        nextCursor: "cursor-2",
        includedBytes: 21,
        completeness: { status: "partial", nextCursor: "cursor-2" }
      })
      .mockResolvedValueOnce({
        text: "，第二段",
        startOffset: 21,
        endOffset: 33,
        nextCursor: null,
        includedBytes: 12,
        completeness: { status: "complete", nextCursor: null }
      });

    useStore.getState().setThreadEntries("thread-1", [entry], null);

    render(<Timeline threadId="thread-1" entries={[entry]} />);

    expect(screen.getByText("内容已截断")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "读取完整内容" }));

    expect(await screen.findByText("完整内容第一段，第二段")).toBeInTheDocument();
    expect(screen.queryByText("预览")).not.toBeInTheDocument();
    expect(readContent).toHaveBeenNthCalledWith(1, "thread-1", "tlc-user", null);
    expect(readContent).toHaveBeenNthCalledWith(2, "thread-1", "tlc-user", "cursor-2");
    expect(useStore.getState().threads["thread-1"]?.entries).toEqual([
      expect.objectContaining({
        id: "user-truncated",
        turnId: "turn-1",
        completeness: expect.objectContaining({ status: "complete" }),
        body: { kind: "user-message", text: "完整内容第一段，第二段", status: "sent" }
      })
    ]);
    readContent.mockRestore();
  });

  it("full-content 请求期间 contentRef 变更时丢弃旧响应且不写回 store", async () => {
    const user = userEvent.setup();
    const oldEntry = {
      id: "agent-truncated",
      turnId: "turn-1",
      createdAt: 1,
      completeness: {
        status: "truncated" as const,
        reason: "item-budget",
        originalBytes: 18,
        includedBytes: 6,
        contentRef: "old-ref"
      },
      body: { kind: "agent-message" as const, text: "旧预览" }
    };
    const newEntry = {
      ...oldEntry,
      completeness: {
        ...oldEntry.completeness,
        contentRef: "new-ref"
      },
      body: { kind: "agent-message" as const, text: "新预览" }
    };
    let resolveContent: ((value: Awaited<ReturnType<typeof codex.readTimelineContent>>) => void) | null = null;
    const contentPromise = new Promise<Awaited<ReturnType<typeof codex.readTimelineContent>>>((resolve) => {
      resolveContent = resolve;
    });
    const readContent = vi.spyOn(codex, "readTimelineContent").mockReturnValueOnce(contentPromise);
    const replaceOrAddEntry = vi.spyOn(useStore.getState(), "replaceOrAddEntry");

    useStore.getState().setThreadEntries("thread-1", [oldEntry], null);
    const { rerender } = render(<Timeline threadId="thread-1" entries={[oldEntry]} />);

    await user.click(screen.getByRole("button", { name: "读取完整内容" }));
    expect(readContent).toHaveBeenCalledWith("thread-1", "old-ref", null);

    useStore.getState().setThreadEntries("thread-1", [newEntry], null);
    rerender(<Timeline threadId="thread-1" entries={[newEntry]} />);

    expect(screen.getByText("新预览")).toBeInTheDocument();

    await act(async () => {
      resolveContent?.({
        text: "旧完整内容",
        startOffset: 0,
        endOffset: 18,
        nextCursor: null,
        includedBytes: 18,
        completeness: { status: "complete", nextCursor: null }
      });
      await contentPromise;
    });

    expect(screen.getByText("新预览")).toBeInTheDocument();
    expect(screen.queryByText("旧完整内容")).not.toBeInTheDocument();
    expect(replaceOrAddEntry).not.toHaveBeenCalled();
    expect(useStore.getState().threads["thread-1"]?.entries).toEqual([
      expect.objectContaining({
        id: "agent-truncated",
        completeness: expect.objectContaining({ contentRef: "new-ref" }),
        body: { kind: "agent-message", text: "新预览" }
      })
    ]);
    readContent.mockRestore();
    replaceOrAddEntry.mockRestore();
  });

  it("长文本 preview 使用有界扫描而不是 split 完整文本", () => {
    const split = vi.spyOn(String.prototype, "split");
    const longText = Array.from({ length: 1_000 }, (_value, index) => `line-${index}`).join("\n");

    const preview = createTextPreview(longText, {
      maxLines: 4,
      maxChars: 80,
      cacheKey: `bounded-scan-${Date.now()}`
    });

    expect(split).not.toHaveBeenCalled();
    expect(preview.preview).toContain("line-0");
    expect(preview.preview).not.toContain("line-999");
    expect(preview.truncated).toBe(true);
    expect(preview.omittedLines).toBe(996);
    split.mockRestore();
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

  it("连续 activity 先合并为 render block 再参与窗口和 spacer 计算", () => {
    const entries = [
      ...Array.from({ length: 100 }, (_value, index) => ({
        id: `agent-${index}`,
        turnId: `turn-${index}`,
        createdAt: index,
        body: { kind: "agent-message" as const, text: `历史回复 ${index}` }
      })),
      ...Array.from({ length: 100 }, (_value, index) => ({
        id: `tool-${index}`,
        turnId: "turn-activity",
        createdAt: 100 + index,
        body: {
          kind: "tool" as const,
          toolKind: "command" as const,
          server: "command",
          tool: `command-${index}`,
          status: "success" as const,
          result: `result-${index}`
        }
      }))
    ];

    const { container } = render(<Timeline entries={entries} />);

    const topSpacer = container.querySelector("[data-timeline-spacer='top']") as HTMLDivElement;
    expect(topSpacer.style.minHeight).toBe("1722px");
    expect(container.querySelectorAll("[data-timeline-row='true']")).toHaveLength(80);
    expect(screen.getByRole("button", { name: "运行了命令" })).toBeInTheDocument();
  });

  it("activity group 跨旧 entry window 边界时保持完整成员和稳定 block key", () => {
    const entries = [
      ...Array.from({ length: 140 }, (_value, index) => ({
        id: `agent-${index}`,
        turnId: `turn-${index}`,
        createdAt: index,
        body: { kind: "agent-message" as const, text: `历史回复 ${index}` }
      })),
      ...Array.from({ length: 90 }, (_value, index) => ({
        id: `activity-${index}`,
        turnId: "turn-shared-activity",
        createdAt: 140 + index,
        body: {
          kind: "tool" as const,
          toolKind: "command" as const,
          server: "command",
          tool: `npm test ${index}`,
          status: "success" as const,
          result: `passed ${index}`
        }
      }))
    ];

    const { container, rerender } = render(<Timeline entries={entries} />);
    const activityRow = container.querySelector("[data-timeline-block-id*='turn-shared-activity']");
    expect(activityRow).not.toBeNull();
    expect(screen.getByRole("button", { name: "运行了命令" })).toBeInTheDocument();

    rerender(
      <Timeline
        entries={[
          ...entries,
          {
            id: "activity-90",
            turnId: "turn-shared-activity",
            createdAt: 230,
            body: {
              kind: "tool",
              toolKind: "command",
              server: "command",
              tool: "npm test 90",
              status: "success",
              result: "passed 90"
            }
          }
        ]}
      />
    );

    expect(screen.getByRole("button", { name: "运行了命令" })).toBeInTheDocument();
    expect(container.querySelector("[data-timeline-block-id*='turn-shared-activity']")).not.toBeNull();
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

  it("长列表重新启用 follow tail 后先切换尾部窗口再滚到底部", () => {
    const entries = Array.from({ length: 240 }, (_value, index) => ({
      id: `agent-follow-${index}`,
      turnId: `turn-follow-${index}`,
      createdAt: index,
      body: { kind: "agent-message" as const, text: `历史回复 ${index}` }
    }));
    const { container, rerender } = render(
      <div className="cw-thread-scroller">
        <Timeline entries={entries} followTail={false} />
      </div>
    );
    const scroller = container.querySelector(".cw-thread-scroller") as HTMLDivElement;
    let scrollTop = 7_000;
    let scrollHeight = 18_000;
    Object.defineProperty(scroller, "scrollTop", {
      configurable: true,
      get: () => scrollTop,
      set: (value) => {
        scrollTop = value;
      }
    });
    Object.defineProperty(scroller, "scrollHeight", {
      configurable: true,
      get: () => scrollHeight
    });
    Object.defineProperty(scroller, "clientHeight", { configurable: true, get: () => 600 });
    fireEvent.scroll(scroller);

    const optimistic = {
      id: "local-user-follow",
      clientUserMessageId: "local-user-follow",
      createdAt: 241,
      body: { kind: "user-message" as const, text: "新发送消息", status: "sending" as const }
    };
    scrollHeight = 18_072;
    rerender(
      <div className="cw-thread-scroller">
        <Timeline entries={[...entries, optimistic]} followTail />
      </div>
    );

    expect(screen.getByText("新发送消息")).toBeInTheDocument();
    expect(container.querySelectorAll("[data-timeline-row='true']").length).toBeGreaterThan(0);
    expect(scrollTop).toBe(18_072);
  });

  it("长时间上下滚动后回收 viewport 外的 timeline rows", () => {
    const entries = Array.from({ length: 360 }, (_value, index) => ({
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
    let scrollTop = 25_000;
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

    expect(container.querySelectorAll("[data-timeline-row='true']").length).toBeLessThanOrEqual(80);

    scrollTop = 11_480;
    act(() => {
      fireEvent.scroll(scroller);
    });

    expect(screen.getByText("历史回复 140")).toBeInTheDocument();
    expect(screen.queryByText("历史回复 350")).not.toBeInTheDocument();
    expect(container.querySelectorAll("[data-timeline-row='true']").length).toBeLessThanOrEqual(100);

    scrollTop = 28_700;
    act(() => {
      fireEvent.scroll(scroller);
    });

    expect(screen.getByText("历史回复 350")).toBeInTheDocument();
    expect(screen.queryByText("历史回复 140")).not.toBeInTheDocument();
    expect(container.querySelectorAll("[data-timeline-row='true']").length).toBeLessThanOrEqual(100);
  });

  it("回收窗口使用已测量的动态 row height 更新 spacer", () => {
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
    const getBoundingClientRect = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockImplementation(function (this: HTMLElement) {
        const text = this.textContent ?? "";
        const match = text.match(/历史回复 (\d+)/);
        const index = match ? Number(match[1]) : -1;
        const height = index >= 185 ? 96 : 72;
        return {
          x: 0,
          y: 0,
          width: 360,
          height,
          top: 0,
          right: 360,
          bottom: height,
          left: 0,
          toJSON: () => ({})
        };
      });

    const { container } = render(
      <div className="cw-thread-scroller">
        <Timeline entries={entries} />
      </div>
    );
    const scroller = container.querySelector(".cw-thread-scroller") as HTMLDivElement;
    let scrollTop = 10_250;
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

    act(() => {
      fireEvent.scroll(scroller);
    });

    const bottomSpacer = container.querySelector("[data-timeline-spacer='bottom']") as HTMLDivElement;
    expect(bottomSpacer.style.minHeight).toBe("5830px");
    expect(bottomSpacer.style.minHeight).not.toBe("3960px");

    getBoundingClientRect.mockRestore();
  });

  it("同 identity 正文变化时更新 block version 并失效旧高度缓存", () => {
    const entries = Array.from({ length: 120 }, (_value, index) => ({
      id: `agent-version-${index}`,
      turnId: `turn-version-${index}`,
      createdAt: index,
      body: { kind: "agent-message" as const, text: `版本一 ${index}` }
    }));
    const { container, rerender } = render(<Timeline entries={entries} />);
    const before = container
      .querySelector("[data-timeline-block-id='agent-version-119']")
      ?.getAttribute("data-timeline-block-version");

    rerender(
      <Timeline
        entries={entries.map((entry, index) =>
          index === 119
            ? { ...entry, body: { kind: "agent-message" as const, text: `版本二 ${index} ${"长正文".repeat(200)}` } }
            : entry
        )}
      />
    );

    const after = container
      .querySelector("[data-timeline-block-id='agent-version-119']")
      ?.getAttribute("data-timeline-block-version");
    expect(after).not.toBe(before);
  });

  it("动态高度参与 scroll offset 到 render block 的定位", () => {
    const entries = Array.from({ length: 240 }, (_value, index) => ({
      id: `agent-${index}`,
      turnId: `turn-${index}`,
      turnIndex: index,
      createdAt: index,
      body: {
        kind: "agent-message" as const,
        text: index >= 160 ? `超长历史回复 ${index}\n${"内容\n".repeat(80)}` : `历史回复 ${index}`
      }
    }));
    const getBoundingClientRect = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockImplementation(function (this: HTMLElement) {
        const text = this.textContent ?? "";
        const match = text.match(/历史回复 (\d+)/);
        const index = match ? Number(match[1]) : -1;
        const height = index >= 160 ? 144 : 72;
        return {
          x: 0,
          y: 0,
          width: 360,
          height,
          top: 0,
          right: 360,
          bottom: height,
          left: 0,
          toJSON: () => ({})
        };
      });

    const { container } = render(
      <div className="cw-thread-scroller">
        <Timeline entries={entries} />
      </div>
    );
    const scroller = container.querySelector(".cw-thread-scroller") as HTMLDivElement;
    let scrollTop = 9_000;
    Object.defineProperty(scroller, "scrollTop", {
      configurable: true,
      get: () => scrollTop
    });
    Object.defineProperty(scroller, "clientHeight", {
      configurable: true,
      get: () => 600
    });

    act(() => {
      fireEvent.scroll(scroller);
    });

    scrollTop = 12_500;
    act(() => {
      fireEvent.scroll(scroller);
    });

    expect(screen.getByText("历史回复 150")).toBeInTheDocument();
    expect(screen.queryByText(/历史回复 239/)).not.toBeInTheDocument();
    expect(container.querySelectorAll("[data-timeline-row='true']").length).toBeLessThanOrEqual(80);

    getBoundingClientRect.mockRestore();
  });

  it("prepend 历史后按 render block identity 恢复 scroll anchor", () => {
    const entries = Array.from({ length: 200 }, (_value, index) => ({
      id: `agent-${index}`,
      turnId: `turn-${index}`,
      createdAt: index,
      body: { kind: "agent-message" as const, text: `历史回复 ${index}` }
    }));
    const { container, rerender } = render(
      <div className="cw-thread-scroller">
        <Timeline entries={entries} />
      </div>
    );
    const scroller = container.querySelector(".cw-thread-scroller") as HTMLDivElement;
    let scrollTop = 10_250;
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

    act(() => {
      fireEvent.scroll(scroller);
    });
    expect(screen.getByText("历史回复 125")).toBeInTheDocument();

    const olderEntries = Array.from({ length: 10 }, (_value, index) => ({
      id: `older-${index}`,
      turnId: `older-turn-${index}`,
      createdAt: -10 + index,
      body: { kind: "agent-message" as const, text: `更早回复 ${index}` }
    }));
    rerender(
      <div className="cw-thread-scroller">
        <Timeline entries={[...olderEntries, ...entries]} />
      </div>
    );

    expect(scroller.scrollTop).toBe(11_070);
    expect(screen.getByText("历史回复 125")).toBeInTheDocument();
  });

  it("短列表 prepend 与高度变化均不与页面 DOM 锚点争抢 scrollTop", () => {
    let resizeCallback: ResizeObserverCallback | null = null;
    class ResizeObserverMock {
      constructor(callback: ResizeObserverCallback) {
        resizeCallback = callback;
      }

      observe(): void {}

      unobserve(): void {}

      disconnect(): void {}
    }
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
    let expanded = false;
    const getBoundingClientRect = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockImplementation(function (this: HTMLElement) {
        const height = this.dataset.timelineBlockId?.startsWith("older-") && expanded ? 200 : 72;
        return {
          x: 0,
          y: 0,
          width: 360,
          height,
          top: 0,
          right: 360,
          bottom: height,
          left: 0,
          toJSON: () => ({})
        };
      });
    const entries = Array.from({ length: 40 }, (_value, index) => ({
      id: `agent-short-${index}`,
      turnId: `turn-short-${index}`,
      createdAt: index,
      body: { kind: "agent-message" as const, text: `短列表回复 ${index}` }
    }));
    const { container, rerender } = render(
      <div className="cw-thread-scroller">
        <Timeline entries={entries} />
      </div>
    );
    const scroller = container.querySelector(".cw-thread-scroller") as HTMLDivElement;
    let scrollTop = 0;
    Object.defineProperty(scroller, "scrollTop", {
      configurable: true,
      get: () => scrollTop,
      set: (value) => {
        scrollTop = value;
      }
    });
    Object.defineProperty(scroller, "clientHeight", { configurable: true, get: () => 600 });
    act(() => {
      fireEvent.scroll(scroller);
    });

    const olderEntries = Array.from({ length: 3 }, (_value, index) => ({
      id: `older-${index}`,
      turnId: `older-turn-${index}`,
      createdAt: -3 + index,
      body: { kind: "agent-message" as const, text: `新加载历史 ${index}` }
    }));
    rerender(
      <div className="cw-thread-scroller">
        <Timeline entries={[...olderEntries, ...entries]} />
      </div>
    );

    expect(scrollTop).toBe(0);
    expanded = true;
    act(() => {
      resizeCallback?.([], {} as ResizeObserver);
    });

    expect(scrollTop).toBe(0);
    expect(screen.getByText("短列表回复 0")).toBeInTheDocument();

    getBoundingClientRect.mockRestore();
    vi.unstubAllGlobals();
  });

  it("长 Markdown、图片和 activity 混合滚动时每个 viewport 都挂载真实 block", () => {
    const entries = [
      ...Array.from({ length: 160 }, (_value, index) => ({
        id: `message-${index}`,
        turnId: `turn-${index}`,
        createdAt: index,
        body:
          index % 40 === 0
            ? {
                kind: "user-message" as const,
                text: `图片提问 ${index}`,
                status: "sent" as const,
                imagePaths: [`/api/files/preview-${index}.png`]
              }
            : {
                kind: "agent-message" as const,
                text: index % 15 === 0 ? `超长 Markdown ${index}\n${"段落内容\n".repeat(120)}` : `历史回复 ${index}`
              }
      })),
      ...Array.from({ length: 40 }, (_value, index) => ({
        id: `mixed-activity-${index}`,
        turnId: "turn-mixed-activity",
        createdAt: 160 + index,
        body: {
          kind: "tool" as const,
          toolKind: "command" as const,
          server: "command",
          tool: `command-${index}`,
          status: "success" as const,
          result: `result-${index}`
        }
      }))
    ];
    const { container } = render(
      <div className="cw-thread-scroller">
        <Timeline entries={entries} />
      </div>
    );
    const scroller = container.querySelector(".cw-thread-scroller") as HTMLDivElement;
    let scrollTop = 0;
    Object.defineProperty(scroller, "scrollTop", {
      configurable: true,
      get: () => scrollTop,
      set: (value) => {
        scrollTop = value;
      }
    });
    Object.defineProperty(scroller, "clientHeight", {
      configurable: true,
      get: () => 640
    });

    for (const nextScrollTop of [0, 3_000, 7_000, 11_000]) {
      scrollTop = nextScrollTop;
      act(() => {
        fireEvent.scroll(scroller);
      });
      const rows = container.querySelectorAll("[data-timeline-row='true']");
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.length).toBeLessThanOrEqual(80);
      expect(Array.from(rows).some((row) => Boolean(row.textContent?.trim()))).toBe(true);
    }

    scrollTop = 20_000;
    act(() => {
      fireEvent.scroll(scroller);
    });
    expect(screen.getByRole("button", { name: "运行了命令" })).toBeInTheDocument();
  });

  it("锚点 block 被删除时优先恢复相邻 before block", () => {
    const entries = Array.from({ length: 200 }, (_value, index) => ({
      id: `agent-${index}`,
      turnId: `turn-${index}`,
      createdAt: index,
      body: { kind: "agent-message" as const, text: `历史回复 ${index}` }
    }));
    const { container, rerender } = render(
      <div className="cw-thread-scroller">
        <Timeline entries={entries} />
      </div>
    );
    const scroller = container.querySelector(".cw-thread-scroller") as HTMLDivElement;
    let scrollTop = 10_250;
    Object.defineProperty(scroller, "scrollTop", {
      configurable: true,
      get: () => scrollTop,
      set: (value) => {
        scrollTop = value;
      }
    });
    Object.defineProperty(scroller, "clientHeight", { configurable: true, get: () => 600 });
    act(() => {
      fireEvent.scroll(scroller);
    });

    const olderEntries = Array.from({ length: 5 }, (_value, index) => ({
      id: `older-${index}`,
      turnId: `older-turn-${index}`,
      createdAt: -5 + index,
      body: { kind: "agent-message" as const, text: `更早回复 ${index}` }
    }));
    rerender(
      <div className="cw-thread-scroller">
        <Timeline entries={[...olderEntries, ...entries.filter((entry) => entry.id !== "agent-125")]} />
      </div>
    );

    expect(scroller.scrollTop).toBe(10_578);
    expect(screen.getByText("历史回复 124")).toBeInTheDocument();
  });

  it("activity regroup 改变 block id 时按成员 identity 恢复 anchor", () => {
    const headEntries = Array.from({ length: 120 }, (_value, index) => ({
      id: `head-${index}`,
      turnId: `head-turn-${index}`,
      createdAt: index,
      body: { kind: "agent-message" as const, text: `头部回复 ${index}` }
    }));
    const activityEntries = Array.from({ length: 20 }, (_value, index) => ({
      id: `activity-${index}`,
      turnId: "turn-regroup",
      createdAt: 120 + index,
      body: {
        kind: "tool" as const,
        toolKind: "command" as const,
        server: "command",
        tool: `command-${index}`,
        status: "success" as const,
        result: `result-${index}`
      }
    }));
    const tailEntries = Array.from({ length: 100 }, (_value, index) => ({
      id: `tail-${index}`,
      turnId: `tail-turn-${index}`,
      createdAt: 140 + index,
      body: { kind: "agent-message" as const, text: `尾部回复 ${index}` }
    }));
    const { container, rerender } = render(
      <div className="cw-thread-scroller">
        <Timeline entries={[...headEntries, ...activityEntries, ...tailEntries]} />
      </div>
    );
    const scroller = container.querySelector(".cw-thread-scroller") as HTMLDivElement;
    let scrollTop = 9_840;
    Object.defineProperty(scroller, "scrollTop", {
      configurable: true,
      get: () => scrollTop,
      set: (value) => {
        scrollTop = value;
      }
    });
    Object.defineProperty(scroller, "clientHeight", { configurable: true, get: () => 600 });
    act(() => {
      fireEvent.scroll(scroller);
    });
    expect(screen.getByRole("button", { name: "运行了命令" })).toBeInTheDocument();

    const olderEntries = Array.from({ length: 5 }, (_value, index) => ({
      id: `older-${index}`,
      turnId: `older-turn-${index}`,
      createdAt: -5 + index,
      body: { kind: "agent-message" as const, text: `更早回复 ${index}` }
    }));
    rerender(
      <div className="cw-thread-scroller">
        <Timeline
          entries={[
            ...olderEntries,
            ...headEntries,
            {
              id: "activity-before",
              turnId: "turn-regroup",
              createdAt: 119,
              body: {
                kind: "tool",
                toolKind: "command",
                server: "command",
                tool: "command-before",
                status: "success",
                result: "result-before"
              }
            },
            ...activityEntries,
            ...tailEntries
          ]}
        />
      </div>
    );

    expect(scroller.scrollTop).toBe(10_250);
    expect(screen.getByRole("button", { name: "运行了命令" })).toBeInTheDocument();
  });

  it("分页边界活动组使用末尾成员作为稳定 DOM 锚点", () => {
    const recentActivities = Array.from({ length: 3 }, (_value, index) => ({
      id: `activity-${index}`,
      turnId: "turn-pagination-boundary",
      createdAt: index,
      body: {
        kind: "tool" as const,
        toolKind: "command" as const,
        server: "command",
        tool: `command-${index}`,
        status: "success" as const,
        result: `result-${index}`
      }
    }));
    const { container, rerender } = render(
      <div className="cw-thread-scroller">
        <Timeline entries={recentActivities} />
      </div>
    );

    expect(container.querySelector("[data-timeline-row='true']")).toHaveAttribute(
      "data-timeline-entry-id",
      "activity-2"
    );

    rerender(
      <div className="cw-thread-scroller">
        <Timeline
          entries={[
            {
              id: "activity-before",
              turnId: "turn-pagination-boundary",
              createdAt: -1,
              body: {
                kind: "tool",
                toolKind: "command",
                server: "command",
                tool: "command-before",
                status: "success",
                result: "result-before"
              }
            },
            ...recentActivities
          ]}
        />
      </div>
    );

    expect(container.querySelector("[data-timeline-row='true']")).toHaveAttribute(
      "data-timeline-entry-id",
      "activity-2"
    );
  });

  it("ResizeObserver 高度修正后保持 block intra-offset", () => {
    let resizeCallback: ResizeObserverCallback | null = null;
    class ResizeObserverMock {
      constructor(callback: ResizeObserverCallback) {
        resizeCallback = callback;
      }

      observe(): void {}

      unobserve(): void {}

      disconnect(): void {}
    }
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
    let expanded = false;
    const getBoundingClientRect = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockImplementation(function (this: HTMLElement) {
        const height = this.dataset.timelineBlockId === "agent-110" && expanded ? 144 : 72;
        return {
          x: 0,
          y: 0,
          width: 360,
          height,
          top: 0,
          right: 360,
          bottom: height,
          left: 0,
          toJSON: () => ({})
        };
      });
    const entries = Array.from({ length: 200 }, (_value, index) => ({
      id: `agent-${index}`,
      turnId: `turn-${index}`,
      createdAt: index,
      body: { kind: "agent-message" as const, text: `历史回复 ${index}` }
    }));
    const { container } = render(
      <div className="cw-thread-scroller">
        <Timeline entries={entries} />
      </div>
    );
    const scroller = container.querySelector(".cw-thread-scroller") as HTMLDivElement;
    let scrollTop = 10_250;
    Object.defineProperty(scroller, "scrollTop", {
      configurable: true,
      get: () => scrollTop,
      set: (value) => {
        scrollTop = value;
      }
    });
    Object.defineProperty(scroller, "clientHeight", { configurable: true, get: () => 600 });
    act(() => {
      fireEvent.scroll(scroller);
    });

    expanded = true;
    act(() => {
      resizeCallback?.([], {} as ResizeObserver);
    });

    expect(scroller.scrollTop).toBe(10_322);

    getBoundingClientRect.mockRestore();
    vi.unstubAllGlobals();
  });

  it("窗口化后仍渲染尾部系统消息、错误提示和审批卡片", () => {
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
    expect(screen.getByRole("alert")).toHaveTextContent("错误提示仍可见");
    expect(screen.queryByText("出错了")).not.toBeInTheDocument();
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

  it("1200+ entries 与长 activity run 保持 block 派生和挂载有界", () => {
    __resetTimelineDerivationDiagnostics();
    const entries = [
      ...Array.from({ length: 1_200 }, (_value, index) => ({
        id: `agent-scale-${index}`,
        turnId: `turn-scale-${index}`,
        createdAt: index,
        body: { kind: "agent-message" as const, text: `规模回复 ${index}` }
      })),
      ...Array.from({ length: 1_000 }, (_value, index) => ({
        id: `activity-scale-${index}`,
        turnId: "turn-scale-activity",
        createdAt: 1_200 + index,
        completeness:
          index === 999
            ? {
                status: "truncated" as const,
                reason: "item-budget" as const,
                originalBytes: 4 * 1024 * 1024,
                includedBytes: 64,
                contentRef: "tlc-scale"
              }
            : undefined,
        body: {
          kind: "tool" as const,
          toolKind: "command" as const,
          server: "command",
          tool: `command-${index}`,
          status: "success" as const,
          result: `result-${index}`
        }
      }))
    ];

    const { container } = render(<Timeline entries={entries} />);

    expect(container.querySelectorAll("[data-timeline-row='true']")).toHaveLength(80);
    expect(screen.getByRole("button", { name: "运行了命令" })).toBeInTheDocument();
    expect((container.querySelector("[data-timeline-spacer='top']") as HTMLDivElement).style.minHeight).toBe(
      `${1_121 * 82}px`
    );
    const diagnostics = __getTimelineDerivationDiagnostics();
    expect(diagnostics.derivationRuns).toBe(1);
    expect(diagnostics.rowEntryScans).toBe(0);
    expect(diagnostics.inlineActivitySectionRuns).toBeLessThanOrEqual(1);
  });

  it("单个 entry 更新只重渲染对应 TimelineRow", () => {
    const first = {
      id: "agent-first",
      turnId: "turn-1",
      createdAt: 1,
      body: { kind: "agent-message" as const, text: "first" }
    };
    const second = {
      id: "agent-second",
      turnId: "turn-2",
      createdAt: 2,
      body: { kind: "agent-message" as const, text: "second" }
    };
    const third = {
      id: "agent-third",
      turnId: "turn-3",
      createdAt: 3,
      body: { kind: "agent-message" as const, text: "third" }
    };
    const { rerender } = render(<Timeline entries={[first, second, third]} />);
    __resetTimelineDerivationDiagnostics();

    rerender(
      <Timeline
        entries={[
          first,
          { ...second, body: { ...second.body, text: "second updated" } },
          third
        ]}
      />
    );

    expect(__getTimelineDerivationDiagnostics().timelineRowRenderRuns).toBe(1);
  });

  it("无关 timeline 更新不会重新派生未变化的长 Markdown、diff、tool 和 activity detail", async () => {
    const user = userEvent.setup();
    const longToolResult = Array.from({ length: 180 }, (_value, index) => `tool output line ${index}`).join("\n");
    const diff = [
      "--- a/src/app.ts",
      "+++ b/src/app.ts",
      "@@ -1,3 +1,4 @@",
      " context",
      "-old",
      "+new",
      "+added"
    ].join("\n");
    const entries = [
      {
        id: "agent-markdown",
        turnId: "turn-1",
        createdAt: 1,
        body: {
          kind: "agent-message" as const,
          text: "```ts\nconst cachedMarkdown = true;\n```"
        }
      },
      {
        id: "tool-long",
        turnId: "turn-1",
        createdAt: 2,
        body: {
          kind: "tool" as const,
          toolKind: "command" as const,
          server: "/repo",
          tool: "npm test",
          status: "success" as const,
          result: longToolResult
        }
      },
      {
        id: "diff-long",
        turnId: "turn-1",
        createdAt: 3,
        body: {
          kind: "diff" as const,
          path: "src/app.ts",
          added: 2,
          removed: 1,
          diff
        }
      },
      {
        id: "agent-stable",
        turnId: "turn-1",
        createdAt: 4,
        body: {
          kind: "agent-message" as const,
          text: "已完成"
        }
      }
    ];

    const { rerender } = render(<Timeline entries={entries} />);
    await user.click(screen.getByText("编辑了文件并运行了命令").closest("button")!);
    await user.click(screen.getByRole("button", { name: "已运行 npm test" }));
    await user.click(screen.getByRole("button", { name: "已编辑 src/app.ts +2 -1" }));

    __resetMarkdownDiagnostics();
    __resetDiffViewDiagnostics();
    __resetTextPreviewDiagnostics();
    __resetTimelineDerivationDiagnostics();

    rerender(
      <Timeline
        running
        activeTurnId="turn-2"
        entries={[
          ...entries,
          {
            id: "agent-unrelated",
            turnId: "turn-2",
            createdAt: 5,
            body: {
              kind: "agent-message" as const,
              text: "无关更新"
            }
          }
        ]}
      />
    );

    expect(__getMarkdownDiagnostics().renderRuns).toBe(0);
    expect(__getDiffViewDiagnostics().parseRuns).toBe(0);
    expect(__getTextPreviewDiagnostics().previewRuns).toBe(0);
    expect(__getTimelineDerivationDiagnostics().inlineActivitySectionRuns).toBe(0);
  });

  it("entry generation 或文本变化会失效长输出派生缓存", async () => {
    const user = userEvent.setup();
    const longToolResult = Array.from({ length: 160 }, (_value, index) => `tool output line ${index}`).join("\n");
    const diff = [
      "--- a/src/app.ts",
      "+++ b/src/app.ts",
      "@@ -1,2 +1,3 @@",
      " context",
      "-old",
      "+new",
      "+added"
    ].join("\n");
    const baseEntries = [
      {
        id: "agent-markdown",
        turnId: "turn-1",
        generation: 1,
        createdAt: 1,
        body: {
          kind: "agent-message" as const,
          text: "```ts\nconst cachedMarkdown = true;\n```"
        }
      },
      {
        id: "tool-long",
        turnId: "turn-1",
        generation: 1,
        createdAt: 2,
        body: {
          kind: "tool" as const,
          toolKind: "command" as const,
          server: "/repo",
          tool: "npm test",
          status: "success" as const,
          result: longToolResult
        }
      },
      {
        id: "diff-long",
        turnId: "turn-1",
        generation: 1,
        createdAt: 3,
        body: {
          kind: "diff" as const,
          path: "src/app.ts",
          added: 2,
          removed: 1,
          diff
        }
      }
    ];

    const { rerender } = render(<Timeline entries={baseEntries} />);
    await user.click(screen.getByText("编辑了文件并运行了命令").closest("button")!);
    await user.click(screen.getByRole("button", { name: "已运行 npm test" }));
    await user.click(screen.getByRole("button", { name: "已编辑 src/app.ts +2 -1" }));

    __resetMarkdownDiagnostics();
    __resetDiffViewDiagnostics();
    __resetTextPreviewDiagnostics();
    __resetTimelineDerivationDiagnostics();

    rerender(
      <Timeline
        entries={baseEntries.map((entry) => ({
          ...entry,
          generation: 2
        }))}
      />
    );

    expect(__getMarkdownDiagnostics().renderRuns).toBeGreaterThan(0);
    expect(__getDiffViewDiagnostics().parseRuns).toBeGreaterThan(0);
    expect(__getTextPreviewDiagnostics().previewRuns).toBeGreaterThan(0);
    expect(__getTimelineDerivationDiagnostics().inlineActivitySectionRuns).toBeGreaterThan(0);

    __resetMarkdownDiagnostics();
    __resetDiffViewDiagnostics();
    __resetTextPreviewDiagnostics();

    rerender(
      <Timeline
        entries={[
          {
            ...baseEntries[0]!,
            generation: 2,
            body: {
              kind: "agent-message" as const,
              text: "```ts\nconst changedMarkdown = true;\n```"
            }
          },
          {
            ...baseEntries[1]!,
            generation: 2,
            body: {
              ...baseEntries[1]!.body,
              result: `${longToolResult}\nchanged`
            }
          },
          {
            ...baseEntries[2]!,
            generation: 2,
            body: {
              ...baseEntries[2]!.body,
              diff: `${diff}\n+changed`,
              added: 3
            }
          }
        ]}
      />
    );

    expect(__getMarkdownDiagnostics().renderRuns).toBeGreaterThan(0);
    expect(__getDiffViewDiagnostics().parseRuns).toBeGreaterThan(0);
    expect(__getTextPreviewDiagnostics().previewRuns).toBeGreaterThan(0);
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

  it("用户消息把 Skill 引用显示在同一气泡顶部，复制时只复制正文", () => {
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

    const skillChip = screen.getByText("OpenSpec Explore").closest("[data-skill-reference-chip='true']");
    const bubble = screen.getByText("自建 agent 的意义是什么？").closest("[data-user-message-bubble='true']");
    expect(skillChip).toBeInTheDocument();
    expect(skillChip?.querySelector("svg")).not.toBeNull();
    expect(bubble).toContainElement(skillChip as HTMLElement);
    expect(bubble?.firstElementChild).toHaveAttribute("data-skill-reference-group", "true");
    expect(screen.queryByText("[skill]")).not.toBeInTheDocument();

    fireEvent.pointerDown(screen.getByText("自建 agent 的意义是什么？"));
    act(() => {
      vi.advanceTimersByTime(450);
    });
    vi.useRealTimers();

    fireEvent.click(screen.getByRole("button", { name: "复制" }));
    expect(writeText).toHaveBeenCalledWith("自建 agent 的意义是什么？");
  });

  it("仅含 Skill 引用时显示一个顶部上下文气泡，不渲染空正文或绝对路径", () => {
    const { container } = render(
      <Timeline
        entries={[
          {
            id: "user-skill-only",
            createdAt: 1,
            body: {
              kind: "user-message",
              text: "",
              skillReferences: [
                {
                  name: "grill-with-docs",
                  path: "/Users/huangzy/.cc-switch/skills/grill-with-docs/SKILL.md"
                },
                {
                  name: "domain-modeling",
                  path: "/Users/huangzy/.codex/skills/domain-modeling/SKILL.md"
                }
              ],
              status: "sent"
            }
          }
        ]}
      />
    );

    expect(screen.getByText("Grill with Docs")).toBeInTheDocument();
    expect(screen.getByText("Domain Modeling")).toBeInTheDocument();
    expect(container.querySelectorAll("[data-user-message-bubble='true']")).toHaveLength(1);
    const bubble = container.querySelector("[data-user-message-bubble='true']");
    const skillGroup = bubble?.querySelector("[data-skill-reference-group='true']");
    expect(skillGroup).toHaveStyle({
      display: "flex",
      flexWrap: "wrap",
      justifyContent: "flex-start"
    });
    expect(bubble?.querySelector("[data-user-message-text='true']")).toBeNull();
    expect(container.innerHTML).not.toContain("/Users/huangzy");
  });

  it("普通文件 chip 与正文同气泡且不显示绝对路径", () => {
    const { container } = render(
      <Timeline entries={[{
        id: "user-file",
        createdAt: 1,
        body: {
          kind: "user-message",
          text: "检查附件",
          fileReferences: [{ id: "a", name: "very-long-notes.txt", path: "C:/secret/uploads/a.txt", mimeType: "text/plain", size: 10 }],
          status: "sent"
        }
      }]} />
    );
    const chip = container.querySelector("[data-file-reference-chip='true']");
    const bubble = container.querySelector("[data-user-message-bubble='true']");
    expect(chip).toHaveTextContent("very-long-notes.txt");
    expect(bubble).toContainElement(chip as HTMLElement);
    expect(container).not.toHaveTextContent("C:/secret/uploads/a.txt");
  });

  it("将同一 turn 内连续活动渲染为两级内联日志而不是 Activity 卡片", async () => {
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
    expect(screen.queryByText("Thinking")).not.toBeInTheDocument();
    expect(screen.queryByText("先看结构")).not.toBeInTheDocument();
    expect(screen.queryByText("再运行测试")).not.toBeInTheDocument();
    expect(screen.getByText("编辑了文件并运行了命令")).toBeInTheDocument();
    expect(screen.queryByText("已运行 npm test")).not.toBeInTheDocument();
    expect(screen.queryByText("已编辑 src/app.ts +2 -1")).not.toBeInTheDocument();
    expect(container.innerHTML).not.toContain("border-left: 3px solid");

    await user.click(screen.getByText("编辑了文件并运行了命令").closest("button")!);

    expect(screen.getByRole("button", { name: "已运行 npm test" })).toBeInTheDocument();
    const fileAction = screen.getByRole("button", { name: "已编辑 src/app.ts +2 -1" });
    expect(fileAction).toBeInTheDocument();
    expect(screen.queryByText("passed")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "已运行 npm test" }));
    expect(screen.getByText("passed")).toBeInTheDocument();

    await user.click(fileAction);
    expect(screen.getByText("src/app.ts")).toBeInTheDocument();
    expect(screen.getByText(/--- a\/src\/app.ts/)).toBeInTheDocument();
    expect(screen.getAllByText("已完成").length).toBeGreaterThanOrEqual(1);
  });

  it("密集 activity 折叠为一个分类摘要，展开后保持原始顺序", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <Timeline
        entries={[
          {
            id: "reasoning-hidden",
            turnId: "turn-dense",
            createdAt: 1,
            body: { kind: "reasoning", text: "Inspecting activity", done: true }
          },
          {
            id: "skill-read",
            turnId: "turn-dense",
            createdAt: 2,
            body: {
              kind: "tool",
              toolKind: "command",
              server: "/repo",
              tool: "sed -n '1,220p' /repo/.codex/skills/openspec-apply-change/SKILL.md",
              status: "success",
              result: "skill instructions"
            }
          },
          {
            id: "subagent-a-started",
            turnId: "turn-dense",
            createdAt: 3,
            body: {
              kind: "tool",
              toolKind: "dynamic",
              server: "sub-agent",
              tool: "started",
              status: "running",
              result: JSON.stringify({
                agentThreadId: "agent-thread-a",
                agentPath: "draft_specs",
                kind: "started"
              })
            }
          },
          {
            id: "read-source",
            turnId: "turn-dense",
            createdAt: 4,
            body: {
              kind: "tool",
              toolKind: "command",
              server: "/repo",
              tool: "sed -n '1,80p' src/app.ts",
              status: "success",
              result: "source content"
            }
          },
          {
            id: "subagent-a-completed",
            turnId: "turn-dense",
            createdAt: 5,
            body: {
              kind: "tool",
              toolKind: "dynamic",
              server: "sub-agent",
              tool: "completed",
              status: "success",
              result: JSON.stringify({
                agentThreadId: "agent-thread-a",
                agentPath: "draft_specs",
                kind: "completed"
              })
            }
          },
          {
            id: "diff-source",
            turnId: "turn-dense",
            createdAt: 6,
            body: {
              kind: "diff",
              path: "src/app.ts",
              added: 1,
              removed: 0,
              diff: "--- a/src/app.ts\n+++ b/src/app.ts\n@@ -1 +1,2 @@\n old\n+new"
            }
          },
          {
            id: "subagent-b-started",
            turnId: "turn-dense",
            createdAt: 7,
            body: {
              kind: "tool",
              toolKind: "dynamic",
              server: "sub-agent",
              tool: "started",
              status: "running",
              result: JSON.stringify({
                agentThreadId: "agent-thread-b",
                agentPath: "review_specs",
                kind: "started"
              })
            }
          },
          {
            id: "command-failed",
            turnId: "turn-dense",
            createdAt: 8,
            body: {
              kind: "tool",
              toolKind: "command",
              server: "/repo",
              tool: "npm test",
              status: "failed",
              result: "one test failed"
            }
          },
          {
            id: "mcp-search",
            turnId: "turn-dense",
            createdAt: 9,
            body: {
              kind: "tool",
              toolKind: "mcp",
              server: "mcp",
              tool: "search",
              status: "success",
              result: "search result"
            }
          }
        ]}
      />
    );

    const headline = "编辑了文件、运行了命令等操作";
    const disclosure = screen.getByRole("button", { name: `${headline}，失败` });
    expect(disclosure).toHaveAttribute("aria-expanded", "false");
    expect(container.querySelectorAll("button[aria-expanded='false']")).toHaveLength(1);
    expect(container.textContent).not.toContain("▣");
    expect(container.querySelector("[data-activity-summary-icon='tool'] svg")).not.toBeNull();
    expect(screen.queryByText("已加载 openspec-apply-change Skill")).not.toBeInTheDocument();
    expect(screen.queryByText(/Subagent draft_specs/)).not.toBeInTheDocument();
    expect(screen.queryByText("src/app.ts")).not.toBeInTheDocument();
    expect(screen.queryByText("one test failed")).not.toBeInTheDocument();

    await user.click(disclosure);

    const expandedText = container.textContent ?? "";
    const actionList = container.querySelector("[data-activity-action-list='true']");
    expect(actionList).toHaveStyle({ maxHeight: "320px", overflowY: "auto" });
    expect(container.querySelector("[data-activity-detail]")).toBeNull();
    const skillAction = screen.getByRole("button", { name: "已加载 openspec-apply-change Skill" });
    const completedSubagentAction = screen.getByRole("button", { name: "Subagent draft_specs · completed" });
    const readAction = screen.getByRole("button", { name: "已读取 src/app.ts" });
    const fileAction = screen.getByRole("button", { name: "已编辑 src/app.ts +1 -0" });
    const secondSubagentAction = screen.getByRole("button", { name: "Subagent review_specs · started" });
    const commandAction = screen.getByRole("button", { name: "已运行 npm test" });
    const mcpAction = screen.getByRole("button", { name: "已调用 mcp · search" });
    expect(skillAction).toBeInTheDocument();
    expect(skillAction.querySelector("svg")).not.toBeNull();
    expect(screen.queryByRole("button", { name: "Subagent draft_specs · started" })).not.toBeInTheDocument();
    expect(readAction).toBeInTheDocument();
    expect(completedSubagentAction).toBeInTheDocument();
    expect(fileAction).toBeInTheDocument();
    expect(secondSubagentAction).toBeInTheDocument();
    expect(commandAction).toBeInTheDocument();
    expect(mcpAction).toBeInTheDocument();
    expect(screen.queryByText("one test failed")).not.toBeInTheDocument();
    expect(screen.queryByText("old")).not.toBeInTheDocument();
    expect(expandedText.indexOf("已加载 openspec-apply-change Skill")).toBeLessThan(
      expandedText.indexOf("Subagent draft_specs · completed")
    );
    expect(expandedText.indexOf("Subagent draft_specs · completed")).toBeLessThan(
      expandedText.indexOf("已读取 src/app.ts")
    );
    expect(expandedText.indexOf("已读取 src/app.ts")).toBeLessThan(
      expandedText.indexOf("已编辑 src/app.ts +1 -0")
    );
    expect(expandedText.indexOf("已编辑 src/app.ts +1 -0")).toBeLessThan(
      expandedText.indexOf("Subagent review_specs · started")
    );

    await user.click(fileAction);
    expect(screen.getByText("old")).toBeInTheDocument();
    expect(screen.queryByText("one test failed")).not.toBeInTheDocument();
    const diffDetail = container.querySelector("[data-activity-detail='diff']");
    expect(diffDetail).not.toBeNull();
    expect(diffDetail?.querySelector("[data-diff-old-line='true']")).not.toBeNull();
    expect(diffDetail?.querySelector("[data-diff-new-line='true']")).not.toBeNull();

    await user.click(commandAction);
    expect(screen.getByText("one test failed")).toBeInTheDocument();
    expect(screen.getByText("输出")).toBeInTheDocument();
    const stdoutDetail = container.querySelector("[data-activity-detail='stdout']");
    expect(stdoutDetail).not.toBeNull();
    expect(stdoutDetail?.querySelector("pre")).toHaveStyle({
      maxWidth: "100%",
      overflowX: "auto",
      whiteSpace: "pre"
    });

    await user.click(mcpAction);
    expect(screen.queryByText("mcp · search")).not.toBeInTheDocument();
    expect(container.querySelector("[data-activity-detail='tool']")).not.toBeNull();
    expect(screen.getByText("结果")).toBeInTheDocument();
  });

  it("将 user message 渲染为右对齐内容宽气泡而不是全宽色带", () => {
    const { container } = render(
      <Timeline
        entries={[
          {
            id: "user-short",
            turnId: "turn-short",
            createdAt: 1,
            body: { kind: "user-message", text: "继续", status: "sent" }
          },
          {
            id: "user-long",
            turnId: "turn-long",
            createdAt: 2,
            body: {
              kind: "user-message",
              text: `请继续处理 ${"long-token-".repeat(60)}`,
              status: "sent"
            }
          }
        ]}
      />
    );

    const rows = container.querySelectorAll<HTMLElement>("[data-user-message-row='true']");
    const bubbles = container.querySelectorAll<HTMLElement>("[data-user-message-bubble='true']");
    expect(rows).toHaveLength(2);
    expect(bubbles).toHaveLength(2);
    expect(rows[0]).toHaveStyle({ display: "flex", justifyContent: "flex-end", width: "100%" });
    expect(bubbles[0]).toHaveStyle({
      width: "fit-content",
      maxWidth: "min(82%, 760px)",
      borderRadius: "16px",
      overflowWrap: "anywhere"
    });
    expect(bubbles[0]?.style.borderLeft).toBe("");
    expect(bubbles[0]?.textContent).toContain("继续");
    expect(bubbles[1]?.textContent).toContain("long-token-");
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

    expect(screen.getByText("运行了命令、读取了文件等操作")).toBeInTheDocument();
    expect(screen.queryByText("已读取 src/app.ts")).not.toBeInTheDocument();
    expect(screen.queryByText("已浏览 src")).not.toBeInTheDocument();
    expect(screen.queryByText("已搜索 timeline")).not.toBeInTheDocument();
    expect(screen.queryByText("已运行 npm test")).not.toBeInTheDocument();

    await user.click(screen.getByText("运行了命令、读取了文件等操作").closest("button")!);

    expect(screen.getByRole("button", { name: "已读取 src/app.ts" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "已浏览 src" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "已搜索 timeline" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "已运行 npm test" })).toBeInTheDocument();
    expect(screen.queryByText("content")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "已读取 src/app.ts" }));

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

    await user.click(screen.getByText("运行了命令").closest("button")!);
    await user.click(screen.getByRole("button", { name: "已运行 npm test" }));

    expect(
      screen.getByText((_content, element) => element?.tagName.toLowerCase() === "pre" && Boolean(element.textContent?.includes("output-line-0")))
    ).toBeInTheDocument();
    expect(
      screen.queryByText((_content, element) => element?.tagName.toLowerCase() === "pre" && Boolean(element.textContent?.includes("output-line-159")))
    ).not.toBeInTheDocument();
    expect(screen.getByText(/已截断/)).toBeInTheDocument();
  });

  it("失败活动使用中文状态并在第二次展开后显示错误详情", async () => {
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

    await user.click(screen.getByText("读取了文件").closest("button")!);

    const failedAction = screen.getByRole("button", { name: "已读取 missing.md" });
    expect(failedAction).toBeInTheDocument();
    expect(screen.queryByText(/No such file/)).not.toBeInTheDocument();

    await user.click(failedAction);

    expect(screen.getByText(/sed -n '1,80p' missing.md/)).toBeInTheDocument();
    expect(screen.getByText(/No such file or directory/)).toBeInTheDocument();
  });

  it("file 工具活动第二次展开后显示文件输出详情", async () => {
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

    expect(screen.getByText("编辑了文件")).toBeInTheDocument();
    expect(screen.queryByText(/--- a\/src\/app.ts/)).not.toBeInTheDocument();

    await user.click(screen.getByText("编辑了文件").closest("button")!);

    const fileAction = screen.getByRole("button", { name: "已编辑 src/app.ts +1 -1" });
    expect(screen.queryByText(/--- a\/src\/app.ts/)).not.toBeInTheDocument();
    await user.click(fileAction);

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

    expect(screen.getByText("编辑了文件")).toBeInTheDocument();
    expect(screen.queryByText("old")).not.toBeInTheDocument();

    await user.click(screen.getByText("编辑了文件").closest("button")!);
    const fileAction = screen.getByRole("button", { name: "已编辑 src/app.ts +131 -1" });
    expect(screen.queryByText("old")).not.toBeInTheDocument();
    await user.click(fileAction);

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

  it("file 工具 activity 第二次展开后使用 diff view fallback", async () => {
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

    await user.click(screen.getByText("编辑了文件").closest("button")!);
    const fileAction = screen.getByRole("button", { name: "已编辑 src/file-tool.ts +1 -1" });
    expect(screen.queryByText("before")).not.toBeInTheDocument();
    await user.click(fileAction);

    expect(screen.getByText("src/file-tool.ts")).toBeInTheDocument();
    expect(screen.getByText("@@ -4,1 +4,1 @@")).toBeInTheDocument();
    expect(screen.getByText("before")).toBeInTheDocument();
    expect(screen.getByText("after")).toBeInTheDocument();
    expect(screen.getAllByText("4").length).toBeGreaterThan(0);
  });

  it("多文件活动按 entry 顺序展开动作，再分别显示 diff block", async () => {
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

    await user.click(screen.getByText("编辑了文件").closest("button")!);

    const firstFile = screen.getByRole("button", { name: "已编辑 src/a.ts +1 -1" });
    const secondFile = screen.getByRole("button", { name: "已编辑 src/b.ts +1 -1" });
    expect(screen.queryByText("oldA")).not.toBeInTheDocument();
    expect(screen.queryByText("oldB")).not.toBeInTheDocument();
    await user.click(firstFile);
    await user.click(secondFile);
    expect(screen.getByText("oldA")).toBeInTheDocument();
    expect(screen.getByText("newA")).toBeInTheDocument();
    expect(screen.getByText("oldB")).toBeInTheDocument();
    expect(screen.getByText("newB")).toBeInTheDocument();

    const text = container.textContent ?? "";
    expect(text.indexOf("src/a.ts")).toBeLessThan(text.indexOf("oldA"));
    expect(text.indexOf("oldA")).toBeLessThan(text.indexOf("src/b.ts"));
    expect(text.indexOf("src/b.ts")).toBeLessThan(text.indexOf("oldB"));
  });

  it("Skill 活动默认只显示自然标题，展开后显示具体动作列表", async () => {
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

    expect(screen.getByText("加载了 Skill")).toBeInTheDocument();
    expect(screen.queryByText("已加载 openspec-explore Skill")).not.toBeInTheDocument();
    expect(screen.queryByText("已加载 systematic-debugging Skill")).not.toBeInTheDocument();
    expect(screen.queryByText(/Skills loaded/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Used tools/)).not.toBeInTheDocument();

    await user.click(screen.getByText("加载了 Skill").closest("button")!);

    expect(screen.getByRole("button", { name: "已加载 openspec-explore Skill" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "已加载 systematic-debugging Skill" })).toBeInTheDocument();
  });

  it("单个 Skill 活动也使用自然动作标题", () => {
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

    expect(screen.getByText("加载了 Skill")).toBeInTheDocument();
    expect(screen.queryByText(/Loaded/)).not.toBeInTheDocument();
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
    expect(text.indexOf("先说明第一段")).toBeLessThan(text.indexOf("运行了命令"));
    expect(text.indexOf("运行了命令")).toBeLessThan(text.indexOf("再说明第二段"));
    expect(text.indexOf("再说明第二段")).toBeLessThan(text.indexOf("编辑了文件"));
    expect(text.indexOf("编辑了文件")).toBeLessThan(text.indexOf("最后说明第三段"));
    expect(screen.queryByText("Activity")).not.toBeInTheDocument();
  });

  it("repair 输入按权威来源顺序渲染且不依赖 createdAt 重排", () => {
    useStore.getState().appendEntries("thread-1", [
      {
        id: "user-1",
        turnId: "turn-1",
        createdAt: 1,
        body: { kind: "user-message", text: "分析 bug", status: "sent" }
      },
      {
        id: "tool-repaired",
        turnId: "turn-1",
        createdAt: 3,
        body: {
          kind: "tool",
          toolKind: "command",
          server: "/repo",
          tool: "rg timeline src",
          status: "success",
          result: "src/web/state/store.ts"
        }
      },
      {
        id: "agent-final",
        turnId: "turn-1",
        createdAt: 2,
        body: { kind: "agent-message", text: "最终结论" }
      }
    ]);

    const entries = useStore.getState().threads["thread-1"]?.entries ?? [];
    const { container } = render(<Timeline entries={entries} />);

    const text = container.textContent ?? "";
    expect(text.indexOf("分析 bug")).toBeLessThan(text.indexOf("搜索了代码"));
    expect(text.indexOf("搜索了代码")).toBeLessThan(text.indexOf("最终结论"));
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

    expect(screen.getByText("编辑了文件并运行了命令")).toBeInTheDocument();
    expect(screen.queryByText("已运行 npm test")).not.toBeInTheDocument();

    await user.click(screen.getByText("编辑了文件并运行了命令").closest("button")!);

    const text = container.textContent ?? "";
    expect(text.indexOf("已编辑 src/app.ts +1 -0")).toBeLessThan(text.indexOf("已运行 npm test"));
    expect(screen.getByRole("button", { name: "已编辑 src/app.ts +1 -0" })).toBeInTheDocument();
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
    expect(screen.getByText("编辑了文件并运行了命令")).toBeInTheDocument();
    expect(screen.queryByText("line 1")).not.toBeInTheDocument();
    expect(screen.queryByText("--- a/src/app.ts")).not.toBeInTheDocument();

    await user.click(screen.getByText("编辑了文件并运行了命令").closest("button")!);
    expect(screen.getByRole("button", { name: "已运行 npm test" })).toBeInTheDocument();
    const fileAction = screen.getByRole("button", { name: "已编辑 src/app.ts +1 -1" });
    expect(fileAction).toBeInTheDocument();
    expect(screen.queryByText("line 1")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "已运行 npm test" }));
    expect(screen.getByText(/line 1/)).toBeInTheDocument();

    await user.click(fileAction);
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
