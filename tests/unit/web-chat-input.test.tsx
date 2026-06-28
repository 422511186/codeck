import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { ChatInput } from "../../src/web/components/ChatInput";

const mockUploadImage = vi.fn();

vi.mock("../../src/web/api/endpoints", () => ({
  codex: {
    uploadImage: (...args: unknown[]) => mockUploadImage(...args)
  }
}));

function renderInput(overrides: Partial<React.ComponentProps<typeof ChatInput>> = {}) {
  const props: React.ComponentProps<typeof ChatInput> = {
    threadId: "thread-1",
    running: false,
    onSend: vi.fn().mockResolvedValue(undefined),
    onInterrupt: vi.fn().mockResolvedValue(undefined),
    onResendLast: vi.fn().mockResolvedValue(undefined),
    ...overrides
  };
  return { ...render(<ChatInput {...props} />), props };
}

describe("ChatInput", () => {
  beforeEach(() => {
    localStorage.clear();
    mockUploadImage.mockReset();
    mockUploadImage.mockResolvedValue({ path: "uploads/image.png" });
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

    expect(onSend).toHaveBeenCalledWith("look at this", ["uploads/image.png"]);
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

  it("replaces send with interrupt and disables input while running", async () => {
    const user = userEvent.setup();
    const onInterrupt = vi.fn().mockResolvedValue(undefined);
    renderInput({ running: true, onInterrupt });

    expect(screen.getByPlaceholderText("agent 正在运行…")).toBeDisabled();
    await user.click(screen.getByLabelText("中断"));

    expect(onInterrupt).toHaveBeenCalled();
  });

  it("sends fullscreen editor text instead of the stale inline value", async () => {
    const user = userEvent.setup();
    const onSend = vi.fn().mockResolvedValue(undefined);
    renderInput({ onSend });

    await user.click(screen.getByLabelText("全屏编辑"));
    const editors = screen.getAllByRole("textbox");
    await user.type(editors[editors.length - 1], "fullscreen message");
    const sendButtons = screen.getAllByRole("button", { name: "发送" });
    await user.click(sendButtons[sendButtons.length - 1]);

    expect(onSend).toHaveBeenCalledWith("fullscreen message", []);
    expect(screen.queryByText("取消")).not.toBeInTheDocument();
  });
});
