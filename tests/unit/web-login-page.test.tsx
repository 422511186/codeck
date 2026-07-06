import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import LoginPage from "../../src/app/login/page";

// Mock Next.js navigation
const mockGet = vi.fn();

vi.mock("next/navigation", () => ({
  useSearchParams: () => ({ get: mockGet })
}));

const mockReplaceDocumentLocation = vi.fn();

vi.mock("../../src/web/navigation/location", () => ({
  replaceDocumentLocation: (...args: unknown[]) => mockReplaceDocumentLocation(...args)
}));

// Mock auth endpoints
const mockLogin = vi.fn();
const mockSession = vi.fn();

vi.mock("../../src/web/api/endpoints", () => ({
  auth: {
    login: (...args: unknown[]) => mockLogin(...args),
    session: (...args: unknown[]) => mockSession(...args)
  }
}));

// Mock ApiError
vi.mock("../../src/web/api/client", () => ({
  ApiError: class ApiError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  }
}));

describe("LoginPage", () => {
  beforeEach(() => {
    mockGet.mockClear();
    mockReplaceDocumentLocation.mockClear();
    mockLogin.mockClear();
    mockSession.mockClear();
    mockGet.mockReturnValue(null);
    mockSession.mockResolvedValue({ authenticated: false });
  });

  it("should honor return path after successful login", async () => {
    const user = userEvent.setup();
    mockLogin.mockResolvedValue(undefined);
    mockGet.mockImplementation((key: string) => (key === "return" ? "/threads/abc" : null));

    render(<LoginPage />);

    await user.type(screen.getByPlaceholderText("粘贴你的 access token"), "valid-token");
    await user.click(screen.getByRole("button", { name: /登录/ }));

    await waitFor(() => {
      expect(mockReplaceDocumentLocation).toHaveBeenCalledWith("/threads/abc");
    });
  });

  it("should reject external next path after successful login", async () => {
    const user = userEvent.setup();
    mockLogin.mockResolvedValue(undefined);
    mockGet.mockImplementation((key: string) => (key === "next" ? "https://example.com" : null));

    render(<LoginPage />);

    await user.type(screen.getByPlaceholderText("粘贴你的 access token"), "valid-token");
    await user.click(screen.getByRole("button", { name: /登录/ }));

    await waitFor(() => {
      expect(mockReplaceDocumentLocation).toHaveBeenCalledWith("/projects");
    });
    expect(mockReplaceDocumentLocation).not.toHaveBeenCalledWith("https://example.com");
  });

  it("should reject protocol-relative return path when already authenticated", async () => {
    mockSession.mockResolvedValue({ authenticated: true });
    mockGet.mockImplementation((key: string) => (key === "return" ? "//example.com/path" : null));

    render(<LoginPage />);

    await waitFor(() => {
      expect(mockReplaceDocumentLocation).toHaveBeenCalledWith("/projects");
    });
    expect(mockReplaceDocumentLocation).not.toHaveBeenCalledWith("//example.com/path");
  });

  it("should redirect to projects if already authenticated", async () => {
    mockSession.mockResolvedValue({ authenticated: true });

    render(<LoginPage />);

    await waitFor(() => {
      expect(mockReplaceDocumentLocation).toHaveBeenCalledWith("/projects");
    });
  });

  it("should redirect to next param if already authenticated", async () => {
    mockSession.mockResolvedValue({ authenticated: true });
    mockGet.mockReturnValue("/threads/abc");

    render(<LoginPage />);

    await waitFor(() => {
      expect(mockReplaceDocumentLocation).toHaveBeenCalledWith("/threads/abc");
    });
  });

  it("should show error when login fails with 401", async () => {
    const user = userEvent.setup();
    const { ApiError } = await import("../../src/web/api/client");
    mockLogin.mockRejectedValue(new ApiError("Unauthorized", 401));

    render(<LoginPage />);

    const input = screen.getByPlaceholderText("粘贴你的 access token");
    const button = screen.getByRole("button", { name: /登录/ });

    await user.type(input, "wrong-token");
    await user.click(button);

    await waitFor(() => {
      expect(screen.getByText("Token 不正确")).toBeInTheDocument();
    });
  });

  it("should show generic error when login fails with non-401", async () => {
    const user = userEvent.setup();
    mockLogin.mockRejectedValue(new Error("Network error"));

    render(<LoginPage />);

    const input = screen.getByPlaceholderText("粘贴你的 access token");
    const button = screen.getByRole("button", { name: /登录/ });

    await user.type(input, "test-token");
    await user.click(button);

    await waitFor(() => {
      expect(screen.getByText("Network error")).toBeInTheDocument();
    });
  });

  it("should redirect after successful login", async () => {
    const user = userEvent.setup();
    mockLogin.mockResolvedValue(undefined);

    render(<LoginPage />);

    const input = screen.getByPlaceholderText("粘贴你的 access token");
    const button = screen.getByRole("button", { name: /登录/ });

    await user.type(input, "valid-token");
    await user.click(button);

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith("valid-token");
      expect(mockReplaceDocumentLocation).toHaveBeenCalledWith("/projects");
    });
  });

  it("should disable submit when input is empty", () => {
    render(<LoginPage />);

    const button = screen.getByRole("button", { name: /登录/ });
    expect(button).toBeDisabled();
  });
});
