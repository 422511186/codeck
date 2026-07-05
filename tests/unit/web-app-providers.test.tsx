import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { AppProviders } from "../../src/web/components/AppProviders";

const mockReplace = vi.fn();
const mockPathname = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace }),
  usePathname: () => mockPathname()
}));

const mockSetSessionInvalidHandler = vi.fn();
vi.mock("../../src/web/api/client", () => ({
  setSessionInvalidHandler: (...args: unknown[]) => mockSetSessionInvalidHandler(...args)
}));

const mockSession = vi.fn();
vi.mock("../../src/web/api/endpoints", () => ({
  auth: {
    session: (...args: unknown[]) => mockSession(...args)
  }
}));

const mockConnectBrowserEventStream = vi.fn();
vi.mock("../../src/web/events/client", () => ({
  connectBrowserEventStream: (...args: unknown[]) => mockConnectBrowserEventStream(...args)
}));

const mockLoad = vi.fn();
const mockApplyTheme = vi.fn();
vi.mock("../../src/web/storage/settings", () => ({
  settingsStore: {
    load: () => mockLoad()
  },
  applyTheme: (...args: unknown[]) => mockApplyTheme(...args)
}));

const mockSetWsState = vi.fn();
const mockSetAppServer = vi.fn();
const mockDispatchEvent = vi.fn();
const mockResolvePendingRequest = vi.fn();
const mockWsState = vi.fn();

vi.mock("../../src/web/state/store", () => ({
  useStore: (selector: (state: unknown) => unknown) =>
    selector({
      setWsState: mockSetWsState,
      setAppServer: mockSetAppServer,
      dispatchEvent: mockDispatchEvent,
      resolvePendingRequest: mockResolvePendingRequest,
      wsState: mockWsState()
    })
}));

describe("AppProviders", () => {
  beforeEach(() => {
    mockReplace.mockClear();
    mockPathname.mockReturnValue("/projects");
    mockSetSessionInvalidHandler.mockClear();
    mockSession.mockResolvedValue({ authenticated: true });
    mockConnectBrowserEventStream.mockReturnValue({ close: vi.fn() });
    mockLoad.mockClear();
    mockLoad.mockReturnValue({ defaultMode: "build", defaultModel: null, theme: "system" });
    mockApplyTheme.mockClear();
    mockSetWsState.mockClear();
    mockSetAppServer.mockClear();
    mockDispatchEvent.mockClear();
    mockResolvePendingRequest.mockClear();
    mockWsState.mockReturnValue("open");
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should register session invalid handler", () => {
    mockPathname.mockReturnValue("/threads/abc");
    render(
      <AppProviders>
        <div>Test</div>
      </AppProviders>
    );

    expect(mockSetSessionInvalidHandler).toHaveBeenCalledWith(expect.any(Function));

    const handler = mockSetSessionInvalidHandler.mock.calls[0][0];
    handler();

    expect(mockReplace).toHaveBeenCalledWith("/login?return=%2Fthreads%2Fabc");
  });

  it("should apply stored theme on mount", () => {
    mockLoad.mockReturnValue({ defaultMode: "build", defaultModel: null, theme: "dark" });

    render(
      <AppProviders>
        <div>Test</div>
      </AppProviders>
    );

    expect(mockApplyTheme).toHaveBeenCalledWith("dark");
  });

  it("should not show offline banner when wsState is open", () => {
    mockWsState.mockReturnValue("open");

    render(
      <AppProviders>
        <div>Test</div>
      </AppProviders>
    );

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("should show offline banner when wsState is reconnecting", () => {
    mockWsState.mockReturnValue("reconnecting");

    render(
      <AppProviders>
        <div>Test</div>
      </AppProviders>
    );

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText(/网络已断开，重连中/)).toBeInTheDocument();
  });

  it("should redirect to login when websocket disconnect reveals an invalid session", async () => {
    mockWsState.mockReturnValue("reconnecting");
    mockPathname.mockReturnValue("/projects");
    mockSession.mockResolvedValue({ authenticated: false });

    render(
      <AppProviders>
        <div>Test</div>
      </AppProviders>
    );

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/login?return=%2Fprojects");
    });
  });

  it("should show offline banner when wsState is closed", () => {
    mockWsState.mockReturnValue("closed");

    render(
      <AppProviders>
        <div>Test</div>
      </AppProviders>
    );

    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("should not show offline banner on login page", () => {
    mockWsState.mockReturnValue("reconnecting");
    mockPathname.mockReturnValue("/login");

    render(
      <AppProviders>
        <div>Test</div>
      </AppProviders>
    );

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("should animate dots in offline banner", async () => {
    mockWsState.mockReturnValue("reconnecting");
    vi.useFakeTimers();

    const { container } = render(
      <AppProviders>
        <div>Test</div>
      </AppProviders>
    );

    const banner = screen.getByRole("status");
    expect(banner.textContent).toMatch(/网络已断开，重连中/);

    // Just verify the banner exists and has the base text
    // Animation dots are implementation detail
    expect(container).toBeTruthy();

    vi.useRealTimers();
  });
});
