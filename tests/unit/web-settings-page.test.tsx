import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import SettingsPage from "../../src/app/settings/page";

const mockReplace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace })
}));

const mockModels = vi.fn();
const mockAuthStatus = vi.fn();
const mockTokenUsage = vi.fn();
const mockLogout = vi.fn();

vi.mock("../../src/web/api/endpoints", () => ({
  codex: {
    models: () => mockModels(),
    authStatus: () => mockAuthStatus(),
    tokenUsage: () => mockTokenUsage()
  },
  auth: {
    logout: () => mockLogout()
  }
}));

const mockLoadSettings = vi.fn();
const mockUpdateSettings = vi.fn();
const mockApplyTheme = vi.fn();
const mockResetTimelineEventStreamClient = vi.fn();

vi.mock("../../src/web/storage/settings", () => ({
  settingsStore: {
    load: () => mockLoadSettings(),
    update: (...args: unknown[]) => mockUpdateSettings(...args)
  },
  applyTheme: (...args: unknown[]) => mockApplyTheme(...args),
  themeLabel: (theme: string) => ({ system: "自适应", light: "明亮", dark: "暗黑" })[theme] ?? theme
}));

vi.mock("../../src/web/api/client", () => ({
  ApiError: class ApiError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  }
}));

vi.mock("../../src/web/events/client", () => ({
  resetTimelineEventStreamClient: () => mockResetTimelineEventStreamClient()
}));

describe("SettingsPage", () => {
  beforeEach(() => {
    mockReplace.mockClear();
    mockModels.mockResolvedValue([
      {
        id: "openai/gpt-5",
        label: "GPT-5",
        isDefault: false,
        supportedReasoningEfforts: [],
        inputModalities: ["text"]
      }
    ]);
    mockAuthStatus.mockResolvedValue({ authMethod: "chatgpt", hasAuthToken: true, requiresOpenaiAuth: false });
    mockTokenUsage.mockResolvedValue({
      summary: { lifetimeTokens: 2_000_000, peakDailyTokens: 500_000 }
    });
    mockLogout.mockResolvedValue(undefined);
    mockLoadSettings.mockReturnValue({ defaultMode: "build", defaultModel: null, theme: "system" });
    mockUpdateSettings.mockClear();
    mockApplyTheme.mockClear();
    mockResetTimelineEventStreamClient.mockClear();
  });

  it("persists default mode and model selections", async () => {
    render(<SettingsPage />);

    await waitFor(() => expect(screen.getByText("GPT-5")).toBeInTheDocument());

    fireEvent.change(screen.getByDisplayValue("Build"), { target: { value: "plan" } });
    fireEvent.change(screen.getByDisplayValue("（跟随后端默认）"), {
      target: { value: "openai/gpt-5" }
    });

    expect(mockUpdateSettings).toHaveBeenCalledWith({ defaultMode: "plan" });
    expect(mockUpdateSettings).toHaveBeenCalledWith({ defaultModel: "openai/gpt-5" });
  });

  it("persists and applies theme selection", async () => {
    render(<SettingsPage />);

    await waitFor(() => expect(screen.getByText("GPT-5")).toBeInTheDocument());

    fireEvent.change(screen.getByDisplayValue("自适应"), { target: { value: "dark" } });

    expect(mockUpdateSettings).toHaveBeenCalledWith({ theme: "dark" });
    expect(mockApplyTheme).toHaveBeenCalledWith("dark");
  });

  it("shows account and token usage without Codex account logout controls", async () => {
    render(<SettingsPage />);

    await waitFor(() => expect(screen.getByText("chatgpt")).toBeInTheDocument());

    expect(screen.getByText("已配置")).toBeInTheDocument();
    expect(screen.getByText("2.00M tokens")).toBeInTheDocument();
    expect(screen.queryByText("ChatGPT 登录")).not.toBeInTheDocument();
    expect(screen.queryByText("Codex 账号登出")).not.toBeInTheDocument();
  });

  it("keeps account status visible when token usage is unavailable", async () => {
    mockTokenUsage.mockRejectedValue(new Error("当前账号不支持用量查询"));

    render(<SettingsPage />);

    await waitFor(() => expect(screen.getByText("chatgpt")).toBeInTheDocument());

    expect(screen.getByText("已配置")).toBeInTheDocument();
    expect(screen.getByText("用量暂不可用：当前账号不支持用量查询")).toBeInTheDocument();
  });

  it("logs out web session and returns to login", async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);

    await user.click(screen.getByRole("button", { name: "登出" }));

    await waitFor(() => expect(mockLogout).toHaveBeenCalled());
    expect(mockResetTimelineEventStreamClient).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith("/login");
  });
});
