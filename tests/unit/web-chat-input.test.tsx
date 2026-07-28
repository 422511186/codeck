import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { ChatInput } from "../../src/web/components/ChatInput";
import { useStore } from "../../src/web/state/store";

vi.setConfig({ testTimeout: 15_000 });

const mockUploadImage = vi.fn();
const mockUploadFile = vi.fn();
const mockListSkills = vi.fn();

const sampleGoal = {
  threadId: "thread-1",
  objective: "完成移动端目标模式接入",
  status: "active",
  tokenBudget: 12_000,
  tokensUsed: 0,
  timeUsedSeconds: 0,
  createdAt: 1,
  updatedAt: 1
};

vi.mock("../../src/web/api/endpoints", () => ({
  codex: {
    uploadImage: (...args: unknown[]) => mockUploadImage(...args),
    uploadFile: (...args: unknown[]) => mockUploadFile(...args),
    skills: (...args: unknown[]) => mockListSkills(...args)
  }
}));

function renderInput(overrides: Partial<React.ComponentProps<typeof ChatInput>> = {}) {
  const props: React.ComponentProps<typeof ChatInput> = {
    threadId: "thread-1",
    running: false,
    permissionLabel: "完全访问",
    permissionDescription: "允许自动执行命令",
    modelLabel: "gpt-5-codex",
    reasoningEffortLabel: "Medium",
    onOpenPermissionPicker: vi.fn(),
    onOpenModelPicker: vi.fn(),
    onOpenReasoningPicker: vi.fn(),
    onSend: vi.fn().mockResolvedValue(undefined),
    onInterrupt: vi.fn().mockResolvedValue(undefined),
    ...overrides
  };
  return { ...render(<ChatInput {...props} />), props };
}

async function openAddPanel(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "添加内容" }));
  return screen.getByRole("dialog", { name: "添加内容" });
}

async function openSkillPickerFromAddPanel(user: ReturnType<typeof userEvent.setup>) {
  const panel = await openAddPanel(user);
  await user.click(within(panel).getByRole("button", { name: "引用 Skill" }));
}

describe("ChatInput", () => {
  beforeEach(() => {
    localStorage.clear();
    useStore.setState({
      wsState: "idle",
      appServer: null,
      threads: {},
      activeThreadId: null,
      skillsCacheVersion: 0
    });
    mockUploadImage.mockReset();
    mockUploadFile.mockReset();
    mockListSkills.mockReset();
    mockUploadImage.mockResolvedValue({ path: "uploads/image.png" });
    mockUploadFile.mockImplementation(async (file: File) => ({
      id: `id-${file.name}`,
      name: file.name,
      path: `uploads/${file.name}`,
      mimeType: file.type || "application/octet-stream",
      size: file.size
    }));
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

  it("only applies restored file drafts to the matching thread", async () => {
    const fileReference = {
      id: "file-restored",
      name: "fork-note.txt",
      path: "C:/uploads/fork-note.txt",
      mimeType: "text/plain",
      size: 9
    };
    const draftOverride = {
      threadId: "thread-2",
      text: "continue with file",
      version: 1,
      fileReferences: [fileReference]
    };
    const { rerender, props } = renderInput({ threadId: "thread-1", draftOverride });

    expect(screen.getByPlaceholderText("输入消息")).toHaveValue("");
    expect(screen.queryByText("fork-note.txt")).not.toBeInTheDocument();

    rerender(<ChatInput {...props} threadId="thread-2" draftOverride={draftOverride} />);

    await waitFor(() => expect(screen.getByText("fork-note.txt")).toBeInTheDocument());
    expect(screen.getByPlaceholderText("输入消息")).toHaveValue("continue with file");
    expect(mockUploadFile).not.toHaveBeenCalled();
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

    expect(onSend).toHaveBeenCalledWith("look at this", ["uploads/image.png"], [], []);
    await waitFor(() => expect(screen.getByPlaceholderText("输入消息")).toHaveValue(""));
  });

  it("保留 text-only 模型不兼容的草稿图片，并在移除图片或切回 image 后恢复发送", async () => {
    const user = userEvent.setup();
    const onSend = vi.fn().mockResolvedValue(undefined);
    const { container, rerender, props } = renderInput({ onSend });

    await user.type(screen.getByPlaceholderText("输入消息"), "保留这份草稿");
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [new File(["image"], "image.png", { type: "image/png" })] }
    });
    await waitFor(() => expect(screen.getByLabelText("发送")).toBeEnabled());

    rerender(<ChatInput {...props} onSend={onSend} imageInputSupported={false} />);
    expect(screen.getByText("当前模型不支持图片，请移除草稿图片或切换模型")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("输入消息")).toHaveValue("保留这份草稿");
    expect(container.querySelector("img")).toBeInTheDocument();
    expect(screen.getByLabelText("发送")).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "移除图片" }));
    expect(screen.queryByText("当前模型不支持图片，请移除草稿图片或切换模型")).not.toBeInTheDocument();
    expect(screen.getByLabelText("发送")).toBeEnabled();

    fireEvent.change(input, {
      target: { files: [new File(["image"], "image.png", { type: "image/png" })] }
    });
    await waitFor(() => expect(screen.getByText("当前模型不支持图片，请移除草稿图片或切换模型")).toBeInTheDocument());
    rerender(<ChatInput {...props} onSend={onSend} imageInputSupported />);
    expect(screen.queryByText("当前模型不支持图片，请移除草稿图片或切换模型")).not.toBeInTheDocument();
    expect(screen.getByLabelText("发送")).toBeEnabled();
  });

  it("appends multiple selected images and sends all uploaded paths", async () => {
    const user = userEvent.setup();
    const onSend = vi.fn().mockResolvedValue(undefined);
    mockUploadImage.mockImplementation(async (file: File) => ({ path: `uploads/${file.name}` }));
    const { container } = renderInput({ onSend });

    await user.type(screen.getByPlaceholderText("输入消息"), "look at these");
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input).toHaveAttribute("multiple");

    fireEvent.change(input, {
      target: {
        files: [
          new File(["image-one"], "one.png", { type: "image/png" }),
          new File(["image-two"], "two.png", { type: "image/png" })
        ]
      }
    });

    await waitFor(() => expect(mockUploadImage).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(container.querySelectorAll("img")).toHaveLength(2));

    fireEvent.change(input, {
      target: { files: [new File(["image-three"], "three.png", { type: "image/png" })] }
    });

    await waitFor(() => expect(mockUploadImage).toHaveBeenCalledTimes(3));
    await waitFor(() => expect(container.querySelectorAll("img")).toHaveLength(3));
    await user.click(screen.getByLabelText("发送"));

    expect(onSend).toHaveBeenCalledWith("look at these", [
      "uploads/one.png",
      "uploads/two.png",
      "uploads/three.png"
    ], [], []);
    await waitFor(() => expect(container.querySelectorAll("img")).toHaveLength(0));
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

  it("keeps the composer available while running and replaces send with interrupt", async () => {
    const user = userEvent.setup();
    const onInterrupt = vi.fn().mockResolvedValue(undefined);
    renderInput({ running: true, onInterrupt });

    expect(screen.getByPlaceholderText("输入消息")).toBeInTheDocument();
    expect(screen.getByLabelText("添加内容")).toBeEnabled();
    expect(screen.getByRole("button", { name: "权限 完全访问" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "模型 gpt-5-codex" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "推理强度 Medium" })).toBeEnabled();
    expect(screen.getByLabelText("中断")).toBeInTheDocument();
    expect(screen.queryByLabelText("发送")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("添加图片")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("展开编辑")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("重发上一条")).not.toBeInTheDocument();

    await user.click(screen.getByLabelText("中断"));

    expect(onInterrupt).toHaveBeenCalled();
  });

  it("keeps a draft typed while running and sends it after the thread becomes idle", async () => {
    const user = userEvent.setup();
    const onSend = vi.fn().mockResolvedValue(undefined);
    const { rerender, props } = renderInput({ running: true, onSend });

    await user.type(screen.getByPlaceholderText("输入消息"), "next prompt");

    expect(onSend).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("发送")).not.toBeInTheDocument();

    rerender(<ChatInput {...props} running={false} />);

    expect(screen.getByPlaceholderText("输入消息")).toHaveValue("next prompt");
    await user.click(screen.getByLabelText("发送"));

    expect(onSend).toHaveBeenCalledWith("next prompt", [], [], []);
    await waitFor(() => expect(screen.getByPlaceholderText("输入消息")).toHaveValue(""));
  });

  it("lets users prepare skill context while running without sending", async () => {
    const user = userEvent.setup();
    const onSend = vi.fn().mockResolvedValue(undefined);
    renderInput({ running: true, onSend, cwd: "/repo" });

    await openSkillPickerFromAddPanel(user);
    expect(await screen.findByRole("dialog", { name: "选择 Skill" })).toBeInTheDocument();
    await user.click(await screen.findByText("openai-docs"));
    await user.click(screen.getByRole("button", { name: "完成" }));

    expect(screen.getByLabelText("移除 Skill openai-docs")).toBeInTheDocument();
    expect(screen.queryByLabelText("发送")).not.toBeInTheDocument();
    expect(onSend).not.toHaveBeenCalled();
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

  
  it("sends with Cmd+Enter when the composer is ready", async () => {
    const user = userEvent.setup();
    const onSend = vi.fn().mockResolvedValue(undefined);
    renderInput({ onSend });

    const composer = screen.getByPlaceholderText("输入消息");
    await user.type(composer, "hello from mac");
    fireEvent.keyDown(composer, { key: "Enter", code: "Enter", metaKey: true });

    await waitFor(() =>
      expect(onSend).toHaveBeenCalledWith(
        "hello from mac", [], [], []
      )
    );
  });

  it("sends with Ctrl+Enter when the composer is ready", async () => {
    const user = userEvent.setup();
    const onSend = vi.fn().mockResolvedValue(undefined);
    renderInput({ onSend });

    const composer = screen.getByPlaceholderText("输入消息");
    await user.type(composer, "hello from windows");
    fireEvent.keyDown(composer, { key: "Enter", code: "Enter", ctrlKey: true });

    await waitFor(() =>
      expect(onSend).toHaveBeenCalledWith(
        "hello from windows", [], [], []
      )
    );
  });

  it("does not send with Cmd/Ctrl+Enter while IME is composing", async () => {
    const onSend = vi.fn().mockResolvedValue(undefined);
    renderInput({ onSend });

    const composer = screen.getByPlaceholderText("输入消息");
    fireEvent.change(composer, { target: { value: "组字中" } });
    fireEvent.keyDown(composer, { key: "Enter", code: "Enter", metaKey: true, isComposing: true });
    fireEvent.keyDown(composer, { key: "Enter", code: "Enter", ctrlKey: true, keyCode: 229 });

    expect(onSend).not.toHaveBeenCalled();
    expect(composer).toHaveValue("组字中");
  });

  it("does not send with Cmd/Ctrl+Enter when send is blocked", async () => {
    const onSend = vi.fn().mockResolvedValue(undefined);
    const { rerender, props } = renderInput({ onSend });

    const blank = screen.getByPlaceholderText("输入消息");
    fireEvent.keyDown(blank, { key: "Enter", code: "Enter", metaKey: true });
    expect(onSend).not.toHaveBeenCalled();

    fireEvent.change(blank, { target: { value: "running no send" } });
    rerender(<ChatInput {...props} running />);
    const runningComposer = screen.getByPlaceholderText("输入消息");
    fireEvent.keyDown(runningComposer, { key: "Enter", code: "Enter", ctrlKey: true });
    expect(onSend).not.toHaveBeenCalled();
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
    const runningComposer = screen.getByPlaceholderText("输入消息");
    expect(fireEvent.keyDown(runningComposer, { key: "Enter", code: "Enter" })).toBe(true);
    expect(onSend).not.toHaveBeenCalled();
  });

  it("uses the inline textarea for multiline editing without a half-screen editor", () => {
    const onSend = vi.fn().mockResolvedValue(undefined);
    renderInput({ onSend });

    expect(screen.queryByLabelText("展开编辑")).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "半屏编辑器" })).not.toBeInTheDocument();

    const composer = screen.getByPlaceholderText("输入消息");
    fireEvent.change(composer, { target: { value: "line one\nline two" } });

    expect(onSend).not.toHaveBeenCalled();
    expect(composer).toHaveValue("line one\nline two");
    expect(composer).toHaveStyle({ maxHeight: "min(220px, 35dvh)", overflowY: "auto" });
  });

  it("moves image selection into the add panel and appends selected images", async () => {
    const user = userEvent.setup();
    const { container } = renderInput();

    expect(screen.queryByLabelText("添加图片")).not.toBeInTheDocument();
    const panel = await openAddPanel(user);
    expect(within(panel).getByRole("button", { name: "图片" })).toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: "引用 Skill" })).toBeInTheDocument();
    await user.click(within(panel).getByRole("button", { name: "图片" }));
    expect(screen.queryByRole("dialog", { name: "添加内容" })).not.toBeInTheDocument();

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
    await waitFor(() => expect(container.querySelectorAll("img")).toHaveLength(2));
    expect(screen.getByLabelText("已选上下文")).toBeInTheDocument();
  });

  it("renders the add panel as a compact action list with only supported actions", async () => {
    const user = userEvent.setup();
    const onOpenGoalEditor = vi.fn();
    renderInput({ onOpenGoalEditor } as Partial<React.ComponentProps<typeof ChatInput>>);

    const panel = await openAddPanel(user);

    expect(within(panel).getByText("添加内容")).toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: "完成" })).toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: /图片/ })).toHaveTextContent("上传图片到本轮消息");
    expect(within(panel).getByRole("button", { name: /文件/ })).toHaveTextContent("上传普通文件到本轮消息");
    expect(within(panel).getByRole("button", { name: /引用 Skill/ })).toHaveTextContent("管理本次消息引用的 Skill");
    expect(within(panel).getByRole("button", { name: /设定目标/ })).toHaveTextContent("设置当前会话目标");
    expect(within(panel).queryByText("插件")).not.toBeInTheDocument();
  });

  it("追加多选普通文件并发送结构化引用", async () => {
    const user = userEvent.setup();
    const onSend = vi.fn().mockResolvedValue(undefined);
    const { container } = renderInput({ onSend });
    const inputs = container.querySelectorAll('input[type="file"]');
    const ordinaryInput = inputs[1] as HTMLInputElement;
    expect(ordinaryInput).toHaveAttribute("multiple");

    fireEvent.change(ordinaryInput, { target: { files: [
      new File(["one"], "one.txt", { type: "text/plain" }),
      new File(["two"], "two.json", { type: "application/json" })
    ] } });
    fireEvent.change(ordinaryInput, { target: { files: [new File(["three"], "three.zip", { type: "application/zip" })] } });

    await waitFor(() => expect(mockUploadFile).toHaveBeenCalledTimes(3));
    await waitFor(() => expect(screen.getByText("three.zip")).toBeInTheDocument());
    expect(screen.getByLabelText("已选上下文")).toHaveStyle({
      flexWrap: "wrap"
    });
    expect(screen.getByLabelText("已选上下文")).not.toHaveStyle({
      overflowX: "auto"
    });
    await user.type(screen.getByPlaceholderText("输入消息"), "检查文件");
    await user.click(screen.getByLabelText("发送"));

    expect(onSend).toHaveBeenCalledWith("检查文件", [], [], [
      expect.objectContaining({ name: "one.txt", path: "uploads/one.txt" }),
      expect.objectContaining({ name: "two.json", path: "uploads/two.json" }),
      expect.objectContaining({ name: "three.zip", path: "uploads/three.zip" })
    ]);
  });

  it("文件入口选到图片时分流到图片上传", async () => {
    const { container } = renderInput();
    const ordinaryInput = container.querySelectorAll('input[type="file"]')[1] as HTMLInputElement;
    fireEvent.change(ordinaryInput, { target: { files: [
      new File(["image"], "shot.png", { type: "image/png" }),
      new File(["text"], "note.txt", { type: "text/plain" })
    ] } });
    await waitFor(() => expect(mockUploadImage).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mockUploadFile).toHaveBeenCalledTimes(1));
  });

  it("普通文件失败后可重试并可移除", async () => {
    const user = userEvent.setup();
    mockUploadFile.mockRejectedValueOnce(new Error("上传失败")).mockResolvedValueOnce({
      id: "retry", name: "retry.txt", path: "uploads/retry.txt", mimeType: "text/plain", size: 5
    });
    const { container } = renderInput();
    const ordinaryInput = container.querySelectorAll('input[type="file"]')[1] as HTMLInputElement;
    fireEvent.change(ordinaryInput, { target: { files: [new File(["retry"], "retry.txt", { type: "text/plain" })] } });
    await waitFor(() => expect(screen.getByText("失败")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "重试" }));
    await waitFor(() => expect(mockUploadFile).toHaveBeenCalledTimes(2));
    await user.click(screen.getByRole("button", { name: "移除文件 retry.txt" }));
    expect(screen.queryByText("retry.txt")).not.toBeInTheDocument();
  });

  it("shows selected skill count and existing goal status in the add panel", async () => {
    const user = userEvent.setup();
    renderInput({
      cwd: "/repo",
      goal: sampleGoal,
      onOpenGoalEditor: vi.fn()
    } as Partial<React.ComponentProps<typeof ChatInput>>);

    await openSkillPickerFromAddPanel(user);
    await user.click(await screen.findByText("openai-docs"));
    await user.click(screen.getByText("repo-helper"));
    await user.click(screen.getByRole("button", { name: "完成" }));

    const panel = await openAddPanel(user);

    expect(within(panel).getByRole("button", { name: /引用 Skill/ })).toHaveTextContent("已选 2");
    expect(within(panel).getByRole("button", { name: /编辑目标/ })).toHaveTextContent("已设置");
    expect(within(panel).queryByText("完成移动端目标模式接入")).not.toBeInTheDocument();
  });

  it("does not expose resend from the idle composer", () => {
    renderInput();

    expect(screen.queryByLabelText("重发上一条")).not.toBeInTheDocument();
  });

  it("selects, removes, and sends structured skill references", async () => {
    const user = userEvent.setup();
    const onSend = vi.fn().mockResolvedValue(undefined);
    renderInput({ onSend, cwd: "/repo" });

    await openSkillPickerFromAddPanel(user);
    expect(await screen.findByRole("dialog", { name: "选择 Skill" })).toBeInTheDocument();
    expect(mockListSkills).toHaveBeenCalledWith(true, "/repo");

    await user.type(screen.getByPlaceholderText("搜索 Skill"), "repo");
    expect(screen.queryByText("openai-docs")).not.toBeInTheDocument();
    await user.click(screen.getByText("repo-helper"));
    await user.click(screen.getByRole("button", { name: "完成" }));

    expect(screen.getByText("repo-helper")).toBeInTheDocument();
    await user.click(screen.getByLabelText("移除 Skill repo-helper"));
    expect(screen.queryByText("repo-helper")).not.toBeInTheDocument();

    await openSkillPickerFromAddPanel(user);
    await user.click(await screen.findByText("openai-docs"));
    await user.click(screen.getByRole("button", { name: "完成" }));
    await user.type(screen.getByPlaceholderText("输入消息"), "查一下文档");
    await user.click(screen.getByLabelText("发送"));

    expect(onSend).toHaveBeenCalledWith("查一下文档", [], [
      { name: "openai-docs", path: "/home/hzy/.codex/skills/openai-docs/SKILL.md" }
    ], []);
    await waitFor(() => expect(screen.queryByLabelText("移除 Skill openai-docs")).not.toBeInTheDocument());
    expect(mockListSkills).toHaveBeenCalledTimes(1);
  });

  it("toggles a selected skill off from the picker list", async () => {
    const user = userEvent.setup();
    renderInput({ cwd: "/repo" });

    await openSkillPickerFromAddPanel(user);
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

    const panel = screen.getByRole("button", { name: "添加内容" });
    fireEvent.click(panel);
    const skillButton = within(screen.getByRole("dialog", { name: "添加内容" })).getByRole("button", { name: "引用 Skill" });
    fireEvent.click(skillButton);
    fireEvent.click(skillButton);

    expect(mockListSkills).toHaveBeenCalledTimes(1);
    expect(mockListSkills).toHaveBeenCalledWith(true, "/repo");
    resolveList?.({ skills: [], skillErrors: [] });
    await waitFor(() => expect(screen.getByText("没有匹配的 Skill")).toBeInTheDocument());
  });

  it("reloads the skill list after a Skills changed event invalidates the cache", async () => {
    const user = userEvent.setup();
    renderInput({ cwd: "/repo" });

    await openSkillPickerFromAddPanel(user);
    expect(await screen.findByText("openai-docs")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "完成" }));
    await openSkillPickerFromAddPanel(user);
    expect(mockListSkills).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "完成" }));

    useStore.getState().dispatchEvent({
      type: "codex-event",
      event: { kind: "skills_changed" }
    });

    await openSkillPickerFromAddPanel(user);
    expect(mockListSkills).toHaveBeenCalledTimes(2);
    expect(mockListSkills).toHaveBeenNthCalledWith(2, true, "/repo");
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

    await openSkillPickerFromAddPanel(user);
    expect(await screen.findByText("skills unavailable")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "重试" }));

    expect(await screen.findByText("openai-docs")).toBeInTheDocument();
    expect(mockListSkills).toHaveBeenNthCalledWith(1, true, "/repo");
    expect(mockListSkills).toHaveBeenNthCalledWith(2, true, "/repo");
  });

  it("renders permission and model chips as bottom toolbar actions", async () => {
    const user = userEvent.setup();
    const onOpenPermissionPicker = vi.fn();
    const onOpenModelPicker = vi.fn();
    const onOpenReasoningPicker = vi.fn();
    renderInput({ onOpenPermissionPicker, onOpenModelPicker, onOpenReasoningPicker });

    await user.click(screen.getByRole("button", { name: "权限 完全访问" }));
    await user.click(screen.getByRole("button", { name: "模型 gpt-5-codex" }));
    await user.click(screen.getByRole("button", { name: "推理强度 Medium" }));

    expect(onOpenPermissionPicker).toHaveBeenCalledTimes(1);
    expect(onOpenModelPicker).toHaveBeenCalledTimes(1);
    expect(onOpenReasoningPicker).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "权限 完全访问" })).toHaveTextContent("完全访问");
    expect(screen.getByRole("button", { name: "权限 完全访问" })).not.toHaveTextContent("⌄");
    const modelButton = screen.getByRole("button", { name: "模型 gpt-5-codex" });
    expect(modelButton).toHaveTextContent("gpt-5-codex");
    expect(modelButton).not.toHaveTextContent("，");
    expect(modelButton).not.toHaveTextContent(",");
    expect(modelButton).not.toHaveTextContent("⌄");
    expect(screen.getByRole("button", { name: "推理强度 Medium" })).toHaveTextContent("Medium");
  });

  it("权限 pending 状态切换为已生效时不混用边框 shorthand", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { rerender, props } = renderInput({
      permissionLabel: "权限状态待确认",
      permissionPending: true
    });
    const pendingChip = screen.getByRole("button", { name: "权限 权限状态待确认" });

    expect(pendingChip.style.border).toBe("");
    expect(pendingChip.style.borderWidth).toBe("1px");
    expect(pendingChip.style.borderStyle).toBe("solid");
    expect(pendingChip.style.borderColor).toContain("var(--cw-warning)");

    rerender(
      <ChatInput
        {...props}
        permissionLabel="完全访问权限"
        permissionPending={false}
      />
    );

    const styleWarnings = consoleError.mock.calls.filter((call) =>
      call.some((value) => String(value).includes("Removing a style property during rerender"))
    );
    consoleError.mockRestore();

    expect(styleWarnings).toEqual([]);
  });
});
