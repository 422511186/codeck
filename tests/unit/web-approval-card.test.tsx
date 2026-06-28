import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
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
    mockResolveRequest.mockClear();
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
      expect(mockResolveRequest).toHaveBeenCalledWith("req-1", { decision: "approve" });
      expect(onResolved).toHaveBeenCalledWith("approve");
    });
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
      expect(mockResolveRequest).toHaveBeenCalledWith("req-1", { decision: "deny" });
      expect(onResolved).toHaveBeenCalledWith("deny");
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
    resolvePromise!();
  });
});
