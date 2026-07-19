import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import SettingsPage from "../../src/app/settings/page";

const mockReplace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace })
}));

const mockModelCatalog = vi.fn();
const mockAuthStatus = vi.fn();
const mockTokenUsage = vi.fn();
const mockLogout = vi.fn();

vi.mock("../../src/web/api/endpoints", () => ({
  codex: {
    modelCatalog: () => mockModelCatalog(),
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
const mockMigrateLegacyDefaultModel = vi.fn();

vi.mock("../../src/web/storage/settings", () => ({
  settingsStore: {
    load: () => mockLoadSettings(),
    update: (...args: unknown[]) => mockUpdateSettings(...args)
  },
  migrateLegacyDefaultModel: (...args: unknown[]) => mockMigrateLegacyDefaultModel(...args),
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
    mockModelCatalog.mockResolvedValue({
      catalogRevision: 1,
      appServerModelNames: ["openai/gpt-5"],
      models: [{
        source: "app-server",
        model: "openai/gpt-5",
        label: "GPT-5",
        contextWindow: null,
        isDefault: false,
        supportedReasoningEfforts: [],
        defaultReasoningEffort: null,
        inputModalities: ["text"]
      }]
    });
    mockAuthStatus.mockResolvedValue({ authMethod: "chatgpt", hasAuthToken: true, requiresOpenaiAuth: false });
    mockTokenUsage.mockResolvedValue({
      summary: { lifetimeTokens: 2_000_000, peakDailyTokens: 500_000 }
    });
    mockLogout.mockResolvedValue(undefined);
    mockLoadSettings.mockReturnValue({ defaultMode: "build", defaultModel: null, theme: "system" });
    mockMigrateLegacyDefaultModel.mockImplementation(() => mockLoadSettings());
    mockUpdateSettings.mockClear();
    mockApplyTheme.mockClear();
    mockResetTimelineEventStreamClient.mockClear();
  });

  it("persists default mode and model selections", async () => {
    render(<SettingsPage />);

    await waitFor(() => expect(screen.getByText("GPT-5")).toBeInTheDocument());

    fireEvent.change(screen.getByDisplayValue("Build"), { target: { value: "plan" } });
    fireEvent.change(screen.getByDisplayValue("（跟随后端默认）"), {
      target: { value: "app-server:openai/gpt-5" }
    });

    expect(mockUpdateSettings).toHaveBeenCalledWith({ defaultMode: "plan" });
    expect(mockUpdateSettings).toHaveBeenCalledWith({
      defaultModel: { source: "app-server", model: "openai/gpt-5" }
    });
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

  it("提供独立自定义模型入口且不暴露 provider、URL 或凭据管理", async () => {
    render(<SettingsPage />);

    const link = await screen.findByRole("link", { name: "自定义模型" });
    expect(link).toHaveAttribute("href", "/settings/custom-models");
    expect(screen.queryByText(/provider/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/base url|api key|凭据/i)).not.toBeInTheDocument();
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
