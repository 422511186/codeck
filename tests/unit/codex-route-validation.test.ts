import { beforeEach, describe, expect, it, vi } from "vitest";

const mockAudit = vi.fn();
const mockAssertRuntimePathAllowed = vi.fn((path: string, _extraRoots?: string[]) => path);
const mockExecCommand = vi.fn();
const mockUploadFeedback = vi.fn();
const mockDetectExternalAgentConfig = vi.fn();
const mockImportExternalAgentConfig = vi.fn();
const mockStartWindowsSandboxSetup = vi.fn();
const mockListThreads = vi.fn();
const mockSearchThreads = vi.fn();

vi.mock("../../src/server/auth", () => ({
  isRequestAuthenticated: () => true
}));

vi.mock("../../src/server/security", () => ({
  assertRuntimePathAllowed: (path: string, extraRoots?: string[]) => mockAssertRuntimePathAllowed(path, extraRoots),
  audit: (...args: unknown[]) => mockAudit(...args)
}));

vi.mock("../../src/server/app-server/runtime", () => ({
  getAppServerGateway: () => ({
    execCommand: (...args: unknown[]) => mockExecCommand(...args),
    uploadFeedback: (...args: unknown[]) => mockUploadFeedback(...args),
    detectExternalAgentConfig: (...args: unknown[]) => mockDetectExternalAgentConfig(...args),
    importExternalAgentConfig: (...args: unknown[]) => mockImportExternalAgentConfig(...args),
    startWindowsSandboxSetup: (...args: unknown[]) => mockStartWindowsSandboxSetup(...args),
    listThreads: (...args: unknown[]) => mockListThreads(...args),
    searchThreads: (...args: unknown[]) => mockSearchThreads(...args)
  })
}));

function jsonRequest(pathname: string, body: unknown): Request {
  return new Request(`http://localhost${pathname}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}

function malformedJsonRequest(pathname: string): Request {
  return new Request(`http://localhost${pathname}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{"
  });
}

describe("codex route validation", () => {
  beforeEach(() => {
    vi.resetModules();
    mockAudit.mockReset();
    mockAssertRuntimePathAllowed.mockReset();
    mockAssertRuntimePathAllowed.mockImplementation((path: string) => {
      if (path.startsWith("/outside")) {
        throw new Error("路径不在允许的工作区内");
      }
      return `/allowed${path}`;
    });
    mockExecCommand.mockReset();
    mockUploadFeedback.mockReset();
    mockDetectExternalAgentConfig.mockReset();
    mockImportExternalAgentConfig.mockReset();
    mockStartWindowsSandboxSetup.mockReset();
    mockListThreads.mockReset();
    mockSearchThreads.mockReset();

    mockExecCommand.mockResolvedValue({ exitCode: 0, stdout: "", stderr: "" });
    mockUploadFeedback.mockResolvedValue({ uploadId: "feedback-1" });
    mockDetectExternalAgentConfig.mockResolvedValue({ items: [] });
    mockImportExternalAgentConfig.mockResolvedValue({ importId: "import-1" });
    mockStartWindowsSandboxSetup.mockResolvedValue({ status: "started" });
    mockListThreads.mockResolvedValue({ threads: [], nextCursor: null });
    mockSearchThreads.mockResolvedValue({ threads: [], nextCursor: null });
  });

  it("terminal/exec 缺少 cwd 时返回 400 且不调用 app-server", async () => {
    const { POST } = await import("../../src/app/api/codex/terminal/exec/route");

    const response = await POST(jsonRequest("/api/codex/terminal/exec", { command: ["pwd"] }));

    expect(response.status).toBe(400);
    expect(mockExecCommand).not.toHaveBeenCalled();
  });

  it("terminal/exec 拒绝非字符串数组 command", async () => {
    const { POST } = await import("../../src/app/api/codex/terminal/exec/route");

    const response = await POST(jsonRequest("/api/codex/terminal/exec", { command: "pwd", cwd: "/repo" }));

    expect(response.status).toBe(400);
    expect(mockExecCommand).not.toHaveBeenCalled();
  });

  it("terminal/exec 使用 allowlist 后的 cwd 调用 app-server", async () => {
    const { POST } = await import("../../src/app/api/codex/terminal/exec/route");

    const response = await POST(jsonRequest("/api/codex/terminal/exec", { command: ["pwd"], cwd: "/repo" }));

    expect(response.status).toBe(200);
    expect(mockAssertRuntimePathAllowed).toHaveBeenCalledWith("/repo", []);
    expect(mockExecCommand).toHaveBeenCalledWith({ command: ["pwd"], cwd: "/allowed/repo", timeoutMs: undefined });
  });

  it("feedback/upload 在 malformed JSON 时返回 400 且不调用 app-server", async () => {
    const { POST } = await import("../../src/app/api/codex/feedback/upload/route");

    const response = await POST(malformedJsonRequest("/api/codex/feedback/upload"));

    expect(response.status).toBe(400);
    expect(mockUploadFeedback).not.toHaveBeenCalled();
  });

  it("feedback/upload 拒绝 extraLogFiles 中 allowlist 外路径", async () => {
    const { POST } = await import("../../src/app/api/codex/feedback/upload/route");

    const response = await POST(
      jsonRequest("/api/codex/feedback/upload", {
        classification: "bug",
        extraLogFiles: ["/outside/secret.log"]
      })
    );

    expect(response.status).toBe(400);
    expect(mockUploadFeedback).not.toHaveBeenCalled();
  });

  it("feedback/upload 使用 allowlist 后的 extraLogFiles 调用 app-server", async () => {
    const { POST } = await import("../../src/app/api/codex/feedback/upload/route");

    const response = await POST(
      jsonRequest("/api/codex/feedback/upload", {
        classification: "bug",
        extraLogFiles: ["/repo/log.txt"]
      })
    );

    expect(response.status).toBe(200);
    expect(mockUploadFeedback).toHaveBeenCalledWith(
      expect.objectContaining({ classification: "bug", extraLogFiles: ["/allowed/repo/log.txt"] })
    );
  });

  it("external-agent-config/detect 校验每个 cwd", async () => {
    const { POST } = await import("../../src/app/api/codex/external-agent-config/detect/route");

    const response = await POST(
      jsonRequest("/api/codex/external-agent-config/detect", { includeHome: true, cwds: ["/repo"] })
    );

    expect(response.status).toBe(200);
    expect(mockDetectExternalAgentConfig).toHaveBeenCalledWith({ includeHome: true, cwds: ["/allowed/repo"] });
  });

  it("external-agent-config/detect 拒绝 allowlist 外 cwd 且不调用 app-server", async () => {
    const { POST } = await import("../../src/app/api/codex/external-agent-config/detect/route");

    const response = await POST(
      jsonRequest("/api/codex/external-agent-config/detect", { cwds: ["/outside/repo"] })
    );

    expect(response.status).toBe(400);
    expect(mockDetectExternalAgentConfig).not.toHaveBeenCalled();
  });

  it("external-agent-config/import 校验 migrationItems 中的 cwd", async () => {
    const { POST } = await import("../../src/app/api/codex/external-agent-config/import/route");

    const response = await POST(
      jsonRequest("/api/codex/external-agent-config/import", {
        migrationItems: [{ itemType: "agents", description: "Agents", cwd: "/repo", details: null }]
      })
    );

    expect(response.status).toBe(200);
    expect(mockImportExternalAgentConfig).toHaveBeenCalledWith({
      migrationItems: [{ itemType: "agents", description: "Agents", cwd: "/allowed/repo", details: null }]
    });
  });

  it("windows-sandbox/setup 校验 cwd 后再调用 app-server", async () => {
    const { POST } = await import("../../src/app/api/codex/windows-sandbox/setup/route");

    const response = await POST(
      jsonRequest("/api/codex/windows-sandbox/setup", { mode: "elevated", cwd: "/repo" })
    );

    expect(response.status).toBe(200);
    expect(mockStartWindowsSandboxSetup).toHaveBeenCalledWith({ mode: "elevated", cwd: "/allowed/repo" });
  });

  it("threads?cwd 拒绝 allowlist 外路径且不调用 app-server", async () => {
    const { GET } = await import("../../src/app/api/codex/threads/route");

    const response = await GET(new Request("http://localhost/api/codex/threads?cwd=%2Foutside%2Frepo"));

    expect(response.status).toBe(400);
    expect(mockListThreads).not.toHaveBeenCalled();
    expect(mockSearchThreads).not.toHaveBeenCalled();
  });

  it("threads?cwd 使用 allowlist 后的 cwd 调用 app-server", async () => {
    const { GET } = await import("../../src/app/api/codex/threads/route");

    const response = await GET(new Request("http://localhost/api/codex/threads?cwd=%2Frepo&archived=false"));

    expect(response.status).toBe(200);
    expect(mockListThreads).toHaveBeenCalledWith(
      expect.objectContaining({ cwd: "/allowed/repo", archived: false })
    );
  });
});
