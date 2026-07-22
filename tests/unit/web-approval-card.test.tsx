import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { ApprovalCard } from "../../src/web/components/cards/ApprovalCard";
import type { PendingServerRequest } from "../../src/web/api/types";

const mockResolveRequest = vi.fn();
vi.mock("../../src/web/api/endpoints", () => ({
  codex: {
    resolveRequest: (...args: unknown[]) => mockResolveRequest(...args)
  }
}));

describe("ApprovalCard", () => {
  beforeEach(() => {
    mockResolveRequest.mockReset();
    mockResolveRequest.mockResolvedValue({});
  });

  it("should render command approval", () => {
    const approval: PendingServerRequest = {
      requestId: "req-1",
      kind: "command_approval",
      request: { command: "npm test" }
    };

    render(<ApprovalCard approval={approval} />);

    expect(screen.getByText("执行命令需要授权")).toBeInTheDocument();
    expect(screen.getByText("npm test")).toBeInTheDocument();
  });

  it("should render file approval", () => {
    const approval: PendingServerRequest = {
      requestId: "req-2",
      kind: "file_approval",
      request: { path: "src/app.ts" }
    };

    render(<ApprovalCard approval={approval} />);

    expect(screen.getByText("写入文件需要授权")).toBeInTheDocument();
    expect(screen.getByText("src/app.ts")).toBeInTheDocument();
  });

  it("should render file approval diff when present", () => {
    const approval: PendingServerRequest = {
      requestId: "req-2",
      kind: "file_approval",
      request: { path: "src/app.ts", diff: "-old\n+new" }
    };

    render(<ApprovalCard approval={approval} />);

    expect(screen.getByText(/src\/app\.ts/)).toBeInTheDocument();
    expect(screen.getByText(/-old/)).toBeInTheDocument();
    expect(screen.getByText(/\+new/)).toBeInTheDocument();
  });

  it("should submit dynamic tool protocol values", async () => {
    const user = userEvent.setup();
    const approval: PendingServerRequest = {
      requestId: "req-dynamic",
      kind: "dynamic_tool",
      title: "动态工具调用",
      description: "browser/search",
      options: [
        { value: "submit", label: "回传结果" },
        { value: "fail", label: "标记失败" }
      ],
      request: { tool: "search" }
    };

    render(<ApprovalCard approval={approval} />);

    await user.click(screen.getByText("标记失败"));

    await waitFor(() => {
      expect(mockResolveRequest).toHaveBeenCalledWith("req-dynamic", { value: "fail" });
    });
  });

  it("should approve request successfully", async () => {
    const user = userEvent.setup();
    const onResolved = vi.fn();
    const approval: PendingServerRequest = {
      requestId: "req-1",
      kind: "command_approval",
      request: { command: "npm test" }
    };

    render(<ApprovalCard approval={approval} onResolved={onResolved} />);

    const approveButton = screen.getByText("同意");
    await user.click(approveButton);

    await waitFor(() => {
      expect(mockResolveRequest).toHaveBeenCalledWith("req-1", { value: "accept" });
      expect(onResolved).toHaveBeenCalledWith("accept");
    });
  });

  it("should render and submit every supported command approval decision", async () => {
    const user = userEvent.setup();
    const approval: PendingServerRequest = {
      requestId: "req-decisions",
      kind: "command_approval",
      options: [
        { value: "accept", label: "允许一次" },
        { value: "acceptForSession", label: "本次会话允许" },
        { value: "decision:2", label: "允许并应用命令规则", description: "npm test" },
        { value: "decline", label: "拒绝" },
        { value: "cancel", label: "中断" }
      ],
      request: { command: "npm test" }
    };

    render(<ApprovalCard approval={approval} />);

    expect(screen.getByRole("button", { name: "允许一次" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "本次会话允许" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /允许并应用命令规则/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "拒绝" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "中断" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "本次会话允许" }));

    await waitFor(() => {
      expect(mockResolveRequest).toHaveBeenCalledWith("req-decisions", {
        value: "acceptForSession"
      });
    });
  });

  it("should disable unsupported decisions while keeping decline available", () => {
    const approval = {
      requestId: "req-unsupported",
      kind: "command_approval",
      options: [
        {
          value: "decision:0",
          label: "不支持的审批选项",
          description: "当前客户端无法安全表达该审批选项",
          disabled: true
        },
        { value: "decline", label: "拒绝" }
      ],
      request: { command: "npm test" }
    } as PendingServerRequest;

    render(<ApprovalCard approval={approval} />);

    expect(screen.getByRole("button", { name: /不支持的审批选项/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: "拒绝" })).toBeEnabled();
  });

  it("should deny request successfully", async () => {
    const user = userEvent.setup();
    const onResolved = vi.fn();
    const approval: PendingServerRequest = {
      requestId: "req-1",
      kind: "command_approval",
      request: { command: "npm test" }
    };

    render(<ApprovalCard approval={approval} onResolved={onResolved} />);

    const denyButton = screen.getByText("拒绝");
    await user.click(denyButton);

    await waitFor(() => {
      expect(mockResolveRequest).toHaveBeenCalledWith("req-1", { value: "decline" });
      expect(onResolved).toHaveBeenCalledWith("decline");
    });
  });

  it("should display error when resolve fails", async () => {
    const user = userEvent.setup();
    mockResolveRequest.mockRejectedValue(new Error("Network error"));

    const approval: PendingServerRequest = {
      requestId: "req-1",
      kind: "command_approval",
      request: { command: "npm test" }
    };

    render(<ApprovalCard approval={approval} />);

    const approveButton = screen.getByText("同意");
    await user.click(approveButton);

    await waitFor(() => {
      expect(screen.getByText("Network error")).toBeInTheDocument();
    });
  });

  it("should be disabled when disabled prop is true", () => {
    const approval: PendingServerRequest = {
      requestId: "req-1",
      kind: "command_approval",
      request: { command: "npm test" }
    };

    render(<ApprovalCard approval={approval} disabled={true} />);

    const approveButton = screen.getByText("同意");
    const denyButton = screen.getByText("拒绝");

    expect(approveButton).toBeDisabled();
    expect(denyButton).toBeDisabled();
  });

  it("should render multiple approval types correctly", () => {
    const approvals: PendingServerRequest[] = [
      {
        requestId: "req-1",
        kind: "command_approval",
        request: { command: "npm install" }
      },
      {
        requestId: "req-2",
        kind: "permissions_approval",
        request: { reason: "Need elevated access" }
      },
      {
        requestId: "req-3",
        kind: "question",
        request: { question: "Should we proceed?" }
      }
    ];

    const { rerender } = render(<ApprovalCard approval={approvals[0]} />);
    expect(screen.getByText("执行命令需要授权")).toBeInTheDocument();

    rerender(<ApprovalCard approval={approvals[1]} />);
    expect(screen.getByText("提升权限")).toBeInTheDocument();

    rerender(<ApprovalCard approval={approvals[2]} />);
    expect(screen.getByText("Should we proceed?")).toBeInTheDocument();
  });

  it("should render question options and submit the selected option value", async () => {
    const user = userEvent.setup();
    const onResolved = vi.fn();
    const approval = {
      requestId: "req-question",
      kind: "question",
      title: "需要你回答",
      description: "请选择执行方式",
      options: [
        { value: "fast", label: "快速", description: "尽快给出结果" },
        { value: "safe", label: "稳妥", description: "多做验证" }
      ],
      request: {
        questions: [
          {
            id: "mode",
            question: "请选择执行方式"
          }
        ]
      }
    } as PendingServerRequest;

    render(<ApprovalCard approval={approval} onResolved={onResolved} />);

    expect(screen.getByText("请选择执行方式")).toBeInTheDocument();
    expect(screen.getByText("快速")).toBeInTheDocument();
    expect(screen.getByText("尽快给出结果")).toBeInTheDocument();
    expect(screen.queryByText("同意")).not.toBeInTheDocument();
    expect(screen.queryByText("拒绝")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /快速/ }));

    await waitFor(() => {
      expect(mockResolveRequest).toHaveBeenCalledWith("req-question", { value: "fast" });
      expect(onResolved).toHaveBeenCalledWith("fast");
    });
  });

  it("should keep question options clickable and show an error when resolve fails", async () => {
    const user = userEvent.setup();
    mockResolveRequest.mockRejectedValueOnce(new Error("missing field answers")).mockResolvedValueOnce({});
    const approval = {
      requestId: "req-question",
      kind: "question",
      description: "请选择执行方式",
      options: [{ value: "fast", label: "快速", description: "尽快给出结果" }],
      request: {}
    } as PendingServerRequest;

    render(<ApprovalCard approval={approval} />);

    const option = screen.getByRole("button", { name: /快速/ });
    await user.click(option);

    await waitFor(() => {
      expect(screen.getByText("missing field answers")).toBeInTheDocument();
      expect(option).not.toBeDisabled();
    });

    await user.click(option);
    expect(mockResolveRequest).toHaveBeenCalledTimes(2);
  });

  it("should render question without options as a non-submittable state", () => {
    const approval = {
      requestId: "req-question",
      kind: "question",
      description: "请输入自定义内容",
      options: [],
      request: {}
    } as PendingServerRequest;

    render(<ApprovalCard approval={approval} />);

    expect(screen.getByText("请输入自定义内容")).toBeInTheDocument();
    expect(screen.getByText("当前问题没有可用选项，无法在移动端回答")).toBeInTheDocument();
    expect(screen.queryByText("同意")).not.toBeInTheDocument();
    expect(screen.queryByText("拒绝")).not.toBeInTheDocument();
  });

  it("should prevent double submission", async () => {
    const user = userEvent.setup();
    let resolvePromise: () => void;
    const slowResolve = new Promise<void>((resolve) => {
      resolvePromise = resolve;
    });
    mockResolveRequest.mockReturnValue(slowResolve);

    const approval: PendingServerRequest = {
      requestId: "req-1",
      kind: "command_approval",
      request: { command: "npm test" }
    };

    render(<ApprovalCard approval={approval} />);

    const approveButton = screen.getByText("同意");
    await user.click(approveButton);

    // Button should show "处理中…"
    expect(screen.getByText("处理中…")).toBeInTheDocument();

    // Try clicking again - should not call resolveRequest again
    await user.click(approveButton);
    expect(mockResolveRequest).toHaveBeenCalledTimes(1);

    // Resolve the promise
    await act(async () => {
      resolvePromise!();
      await slowResolve;
    });
  });
});
