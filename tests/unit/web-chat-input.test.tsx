import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { ChatInput } from "../../src/web/components/ChatInput";

const mockUploadImage = vi.fn();
const mockListSkills = vi.fn();

vi.mock("../../src/web/api/endpoints", () => ({
  codex: {
    uploadImage: (...args: unknown[]) => mockUploadImage(...args),
    skills: (...args: unknown[]) => mockListSkills(...args)
  }
}));

function renderInput(overrides: Partial<React.ComponentProps<typeof ChatInput>> = {}) {
  const props: React.ComponentProps<typeof ChatInput> = {
    threadId: "thread-1",
    running: false,
    onSend: vi.fn().mockResolvedValue(undefined),
    onInterrupt: vi.fn().mockResolvedValue(undefined),
    ...overrides
  };
  return { ...render(<ChatInput {...props} />), props };
}

describe("ChatInput", () => {
  beforeEach(() => {
    localStorage.clear();
    mockUploadImage.mockReset();
    mockListSkills.mockReset();
    mockUploadImage.mockResolvedValue({ path: "uploads/image.png" });
    mockListSkills.mockResolvedValue({
      skills: [
        {
          cwd: "/repo",
          name: "openai-docs",
          path: "/home/hzy/.codex/skills/openai-docs/SKILL.md",
          description: "查询 OpenAI 官方文档",
          shortDescription: "OpenAI 文档",
          scope: "user",
          enabled: true
        },
        {
          cwd: "/repo",
          name: "repo-helper",
          path: "/repo/.codex/skills/repo-helper/SKILL.md",
          description: "项目辅助",
          shortDescription: null,
          scope: "repo",
          enabled: true
        }
      ],
      skillErrors: []
    });
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: vi.fn(() => "blob:preview")
    });
  });

  it("saves and restores drafts per thread", async () => {
    const user = userEvent.setup();
    const { rerender, props } = renderInput();

    await user.type(screen.getByPlaceholderText("输入消息"), "thread one draft");

    rerender(<ChatInput {...props} threadId="thread-2" />);
    expect(screen.getByPlaceholderText("输入消息")).toHaveValue("");

    await user.type(screen.getByPlaceholderText("输入消息"), "thread two draft");
    rerender(<ChatInput {...props} threadId="thread-1" />);

    expect(screen.getByPlaceholderText("输入消息")).toHaveValue("thread one draft");
  });

  it("disables send for blank text and image-only messages", async () => {
    const { container } = renderInput();

    expect(screen.getByLabelText("发送")).toBeDisabled();

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [new File(["image"], "image.png", { type: "image/png" })] }
    });

    await waitFor(() => expect(mockUploadImage).toHaveBeenCalled());
    await waitFor(() => expect(container.querySelector("img")).toBeInTheDocument());

    expect(screen.getByLabelText("发送")).toBeDisabled();
  });

  it("sends text with uploaded image path and clears the draft", async () => {
    const user = userEvent.setup();
    const onSend = vi.fn().mockResolvedValue(undefined);
    const { container } = renderInput({ onSend });

    await user.type(screen.getByPlaceholderText("输入消息"), "look at this");
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [new File(["image"], "image.png", { type: "image/png" })] }
    });

    await waitFor(() => expect(screen.getByLabelText("发送")).toBeEnabled());
    await user.click(screen.getByLabelText("发送"));

    expect(onSend).toHaveBeenCalledWith("look at this", ["uploads/image.png"], []);
    await waitFor(() => expect(screen.getByPlaceholderText("输入消息")).toHaveValue(""));
  });

  it("shows upload failure and retries from the thumbnail", async () => {
    const user = userEvent.setup();
    mockUploadImage
      .mockRejectedValueOnce(new Error("upload failed"))
      .mockResolvedValueOnce({ path: "uploads/retry.png" });
    const { container } = renderInput();

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [new File(["image"], "image.png", { type: "image/png" })] }
    });

    await waitFor(() => expect(screen.getByText("重试")).toBeInTheDocument());
    await user.click(screen.getByText("重试"));

    await waitFor(() => expect(mockUploadImage).toHaveBeenCalledTimes(2));
    expect(screen.queryByText("重试")).not.toBeInTheDocument();
  });

  it("shows a running status bar with only the interrupt action while running", async () => {
    const user = userEvent.setup();
    const onInterrupt = vi.fn().mockResolvedValue(undefined);
    renderInput({ running: true, onInterrupt });

    expect(screen.getByText("正在生成…")).toBeInTheDocument();
    expect(screen.getByLabelText("中断")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("输入消息")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("添加图片")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("展开编辑")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("发送")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("重发上一条")).not.toBeInTheDocument();

    await user.click(screen.getByLabelText("中断"));

    expect(onInterrupt).toHaveBeenCalled();
  });

  it("does not send with Enter from the inline composer", async () => {
    const user = userEvent.setup();
    const onSend = vi.fn().mockResolvedValue(undefined);
    renderInput({ onSend });

    const composer = screen.getByPlaceholderText("输入消息");
    await user.type(composer, "hello from keyboard");
    const notPrevented = fireEvent.keyDown(composer, { key: "Enter", code: "Enter" });
    fireEvent.change(composer, { target: { value: "hello from keyboard\n" } });

    expect(notPrevented).toBe(true);
    expect(onSend).not.toHaveBeenCalled();
    expect(composer).toHaveValue("hello from keyboard\n");
  });

  it("does not submit twice while the first send is still pending", async () => {
    const user = userEvent.setup();
    let resolveSend: (() => void) | null = null;
    const onSend = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveSend = resolve;
        })
    );
    renderInput({ onSend });

    await user.type(screen.getByPlaceholderText("输入消息"), "不要重复");
    const sendButton = screen.getByLabelText("发送");
    fireEvent.click(sendButton);
    fireEvent.click(sendButton);

    expect(onSend).toHaveBeenCalledTimes(1);
    resolveSend?.();
    await waitFor(() => expect(screen.getByPlaceholderText("输入消息")).toHaveValue(""));
  });

  it("does not send with Enter from the inline composer in any send state", async () => {
    const onSend = vi.fn().mockResolvedValue(undefined);
    const { container, rerender, props } = renderInput({ onSend });

    const blankComposer = screen.getByPlaceholderText("输入消息");
    expect(fireEvent.keyDown(blankComposer, { key: "Enter", code: "Enter" })).toBe(true);
    expect(onSend).not.toHaveBeenCalled();

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [new File(["image"], "image.png", { type: "image/png" })] }
    });
    await waitFor(() => expect(mockUploadImage).toHaveBeenCalled());
    await waitFor(() => expect(container.querySelector("img")).toBeInTheDocument());

    expect(fireEvent.keyDown(blankComposer, { key: "Enter", code: "Enter" })).toBe(true);
    expect(onSend).not.toHaveBeenCalled();

    rerender(<ChatInput {...props} running />);
    expect(screen.queryByPlaceholderText("输入消息")).not.toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Enter", code: "Enter" });
    expect(onSend).not.toHaveBeenCalled();
  });

  it("keeps Enter as newline inside the half-screen editor", async () => {
    const user = userEvent.setup();
    const onSend = vi.fn().mockResolvedValue(undefined);
    renderInput({ onSend });

    await user.click(screen.getByLabelText("展开编辑"));
    expect(screen.getByRole("dialog", { name: "半屏编辑器" })).toHaveStyle({ height: "50dvh" });
    const editors = screen.getAllByRole("textbox");
    const halfScreenEditor = editors[editors.length - 1];

    await user.type(halfScreenEditor, "line one");
    fireEvent.keyDown(halfScreenEditor, { key: "Enter", code: "Enter" });
    fireEvent.change(halfScreenEditor, { target: { value: "line one\nline two" } });

    expect(onSend).not.toHaveBeenCalled();
    expect(halfScreenEditor).toHaveValue("line one\nline two");
  });

  it("keeps the image entry visible in the idle composer and replaces the selected image", async () => {
    const { container } = renderInput();

    expect(screen.getByLabelText("添加图片")).toBeInTheDocument();
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(input, {
      target: { files: [new File(["image-one"], "one.png", { type: "image/png" })] }
    });
    await waitFor(() => expect(mockUploadImage).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(container.querySelectorAll("img")).toHaveLength(1));

    fireEvent.change(input, {
      target: { files: [new File(["image-two"], "two.png", { type: "image/png" })] }
    });
    await waitFor(() => expect(mockUploadImage).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(container.querySelectorAll("img")).toHaveLength(1));
  });

  it("does not expose resend from the idle composer", () => {
    renderInput();

    expect(screen.queryByLabelText("重发上一条")).not.toBeInTheDocument();
  });

  it("selects, removes, and sends structured skill references", async () => {
    const user = userEvent.setup();
    const onSend = vi.fn().mockResolvedValue(undefined);
    renderInput({ onSend, cwd: "/repo" });

    await user.click(screen.getByLabelText("引用 Skill"));
    expect(await screen.findByRole("dialog", { name: "选择 Skill" })).toBeInTheDocument();
    expect(mockListSkills).toHaveBeenCalledWith(true, "/repo");

    await user.type(screen.getByPlaceholderText("搜索 Skill"), "repo");
    expect(screen.queryByText("openai-docs")).not.toBeInTheDocument();
    await user.click(screen.getByText("repo-helper"));
    await user.click(screen.getByRole("button", { name: "完成" }));

    expect(screen.getByText("repo-helper")).toBeInTheDocument();
    await user.click(screen.getByLabelText("移除 Skill repo-helper"));
    expect(screen.queryByText("repo-helper")).not.toBeInTheDocument();

    await user.click(screen.getByLabelText("引用 Skill"));
    await user.click(await screen.findByText("openai-docs"));
    await user.click(screen.getByRole("button", { name: "完成" }));
    await user.type(screen.getByPlaceholderText("输入消息"), "查一下文档");
    await user.click(screen.getByLabelText("发送"));

    expect(onSend).toHaveBeenCalledWith("查一下文档", [], [
      { name: "openai-docs", path: "/home/hzy/.codex/skills/openai-docs/SKILL.md" }
    ]);
    await waitFor(() => expect(screen.queryByLabelText("移除 Skill openai-docs")).not.toBeInTheDocument());
    expect(mockListSkills).toHaveBeenCalledTimes(1);
  });

  it("toggles a selected skill off from the picker list", async () => {
    const user = userEvent.setup();
    renderInput({ cwd: "/repo" });

    await user.click(screen.getByLabelText("引用 Skill"));
    const skill = await screen.findByText("openai-docs");
    await user.click(skill);
    expect(screen.getByText("已选")).toBeInTheDocument();

    const dialog = screen.getByRole("dialog", { name: "选择 Skill" });
    await user.click(within(dialog).getByText("openai-docs"));
    expect(screen.queryByText("已选")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "完成" }));
    expect(screen.queryByLabelText("移除 Skill openai-docs")).not.toBeInTheDocument();
  });

  it("does not request the skill list twice while an open request is pending", async () => {
    let resolveList: ((value: { skills: []; skillErrors: [] }) => void) | null = null;
    mockListSkills.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveList = resolve;
      })
    );
    renderInput({ cwd: "/repo" });

    const skillButton = screen.getByLabelText("引用 Skill");
    fireEvent.click(skillButton);
    fireEvent.click(skillButton);

    expect(mockListSkills).toHaveBeenCalledTimes(1);
    expect(mockListSkills).toHaveBeenCalledWith(true, "/repo");
    resolveList?.({ skills: [], skillErrors: [] });
    await waitFor(() => expect(screen.getByText("没有匹配的 Skill")).toBeInTheDocument());
  });

  it("shows skill list load failure and retries", async () => {
    const user = userEvent.setup();
    mockListSkills.mockRejectedValueOnce(new Error("skills unavailable")).mockResolvedValueOnce({
      skills: [
        {
          cwd: "/repo",
          name: "openai-docs",
          path: "/home/hzy/.codex/skills/openai-docs/SKILL.md",
          description: "查询 OpenAI 官方文档",
          shortDescription: "OpenAI 文档",
          scope: "user",
          enabled: true
        }
      ],
      skillErrors: []
    });
    renderInput({ cwd: "/repo" });

    await user.click(screen.getByLabelText("引用 Skill"));
    expect(await screen.findByText("skills unavailable")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "重试" }));

    expect(await screen.findByText("openai-docs")).toBeInTheDocument();
    expect(mockListSkills).toHaveBeenNthCalledWith(1, true, "/repo");
    expect(mockListSkills).toHaveBeenNthCalledWith(2, true, "/repo");
  });

  it("sends half-screen editor text instead of the stale inline value", async () => {
    const user = userEvent.setup();
    const onSend = vi.fn().mockResolvedValue(undefined);
    renderInput({ onSend });

    await user.click(screen.getByLabelText("展开编辑"));
    const editors = screen.getAllByRole("textbox");
    await user.type(editors[editors.length - 1], "half-screen message");
    const sendButtons = screen.getAllByRole("button", { name: "发送" });
    await user.click(sendButtons[sendButtons.length - 1]);

    expect(onSend).toHaveBeenCalledWith("half-screen message", [], []);
    expect(screen.queryByText("取消")).not.toBeInTheDocument();
  });
});
