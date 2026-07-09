import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockAudit = vi.fn();
const mockAssertRuntimePathAllowed = vi.fn((path: string, _extraRoots?: string[]) => path);
const mockAssertRuntimeWorkspaceRootsAllowed = vi.fn((roots?: string[]) => roots);
const mockSetSkillsExtraRoots = vi.fn();
const mockStartThread = vi.fn();
const mockStartTurn = vi.fn();
const mockWriteFile = vi.fn();
const mockStartProcessSession = vi.fn();
const mockListInstalledPlugins = vi.fn();

const defaultRuntimeConfig = {
  accessToken: "test-token",
  generatedAccessToken: false,
  workspaceRoots: ["/workspace"],
  bindHost: "127.0.0.1",
  bindPort: 3000,
  uploadDir: "/uploads",
  auditLogPath: "/tmp/audit.jsonl",
  appServer: { mode: "mock" as const }
};

let runtimeConfig = { ...defaultRuntimeConfig };

vi.mock("../../src/server/auth", () => ({
  isRequestAuthenticated: () => true
}));

vi.mock("../../src/server/runtime", () => ({
  getRuntimeConfig: () => runtimeConfig
}));

vi.mock("../../src/server/security", () => ({
  assertRuntimePathAllowed: (path: string, extraRoots?: string[]) => mockAssertRuntimePathAllowed(path, extraRoots),
  assertRuntimeWorkspaceRootsAllowed: (roots?: string[]) => mockAssertRuntimeWorkspaceRootsAllowed(roots),
  audit: (...args: unknown[]) => mockAudit(...args)
}));

vi.mock("../../src/server/app-server/runtime", () => ({
  getAppServerGateway: () => ({
    setSkillsExtraRoots: (...args: unknown[]) => mockSetSkillsExtraRoots(...args),
    startThread: (...args: unknown[]) => mockStartThread(...args),
    startTurn: (...args: unknown[]) => mockStartTurn(...args),
    writeFile: (...args: unknown[]) => mockWriteFile(...args),
    startProcessSession: (...args: unknown[]) => mockStartProcessSession(...args),
    listInstalledPlugins: (...args: unknown[]) => mockListInstalledPlugins(...args)
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

describe("codex proxy input boundaries", () => {
  beforeEach(() => {
    vi.resetModules();
    runtimeConfig = { ...defaultRuntimeConfig };
    mockAudit.mockReset();
    mockAssertRuntimePathAllowed.mockReset();
    mockAssertRuntimePathAllowed.mockImplementation((path: string) => {
      if (path.startsWith("/outside")) {
        throw new Error("路径不在允许的工作区内");
      }
      return path;
    });
    mockAssertRuntimeWorkspaceRootsAllowed.mockReset();
    mockAssertRuntimeWorkspaceRootsAllowed.mockImplementation((roots?: string[]) => roots);
    mockSetSkillsExtraRoots.mockReset();
    mockStartThread.mockReset();
    mockStartTurn.mockReset();
    mockWriteFile.mockReset();
    mockStartProcessSession.mockReset();
    mockListInstalledPlugins.mockReset();
    mockSetSkillsExtraRoots.mockResolvedValue(undefined);
    mockStartThread.mockResolvedValue({ id: "thread-1", cwd: "/workspace", status: "idle" });
    mockStartTurn.mockResolvedValue({ turnId: "turn-1" });
    mockWriteFile.mockResolvedValue(undefined);
    mockStartProcessSession.mockResolvedValue({ processHandle: "process-1" });
    mockListInstalledPlugins.mockResolvedValue({ marketplaces: [], marketplaceLoadErrors: [] });
  });

  it("skills extra-roots malformed JSON 返回 400 且不调用 app-server", async () => {
    const { POST } = await import("../../src/app/api/codex/skills/extra-roots/route");

    const response = await POST(malformedJsonRequest("/api/codex/skills/extra-roots"));

    expect(response.status).toBe(400);
    expect(mockSetSkillsExtraRoots).not.toHaveBeenCalled();
    expect(mockAudit).not.toHaveBeenCalled();
  });

  it("代表性旧 JSON routes 在 malformed JSON 时返回 400 且不调用 app-server", async () => {
    const threadStartRoute = await import("../../src/app/api/codex/threads/start/route");
    const turnStartRoute = await import("../../src/app/api/codex/turns/start/route");
    const fileRoute = await import("../../src/app/api/codex/fs/file/route");
    const processRoute = await import("../../src/app/api/codex/process/spawn/route");

    const responses = await Promise.all([
      threadStartRoute.POST(malformedJsonRequest("/api/codex/threads/start")),
      turnStartRoute.POST(malformedJsonRequest("/api/codex/turns/start")),
      fileRoute.PUT(malformedJsonRequest("/api/codex/fs/file")),
      processRoute.POST(malformedJsonRequest("/api/codex/process/spawn"))
    ]);

    expect(responses.map((response) => response.status)).toEqual([400, 400, 400, 400]);
    expect(mockStartThread).not.toHaveBeenCalled();
    expect(mockStartTurn).not.toHaveBeenCalled();
    expect(mockWriteFile).not.toHaveBeenCalled();
    expect(mockStartProcessSession).not.toHaveBeenCalled();
  });

  it("plugins/installed 校验 workspace 内 cwds 后调用 app-server", async () => {
    mockAssertRuntimePathAllowed.mockImplementation((path: string) => `/allowed${path}`);
    const { POST } = await import("../../src/app/api/codex/plugins/installed/route");

    const response = await POST(jsonRequest("/api/codex/plugins/installed", { cwds: ["/workspace/repo"] }));

    expect(response.status).toBe(200);
    expect(mockAssertRuntimePathAllowed).toHaveBeenCalledWith("/workspace/repo", []);
    expect(mockListInstalledPlugins).toHaveBeenCalledWith({
      cwds: ["/allowed/workspace/repo"],
      installSuggestionPluginNames: null
    });
  });

  it("plugins/installed 拒绝 workspace 外 cwd 且不调用 app-server", async () => {
    const { POST } = await import("../../src/app/api/codex/plugins/installed/route");

    const response = await POST(jsonRequest("/api/codex/plugins/installed", { cwds: ["/outside/repo"] }));

    expect(response.status).toBe(400);
    expect(mockListInstalledPlugins).not.toHaveBeenCalled();
  });

  it("plugins/installed 拒绝非字符串数组 cwds 且不调用 app-server", async () => {
    const { POST } = await import("../../src/app/api/codex/plugins/installed/route");

    const response = await POST(jsonRequest("/api/codex/plugins/installed", { cwds: ["/workspace/repo", 1] }));

    expect(response.status).toBe(400);
    expect(mockListInstalledPlugins).not.toHaveBeenCalled();
  });

  it("images/preview 只允许 workspace 和 uploadDir 内的图片", async () => {
    const root = await mkdtemp(join(tmpdir(), "codex-web-preview-"));
    const workspace = join(root, "workspace");
    const uploadDir = join(root, "uploads");
    const outside = join(root, "outside");
    const workspaceImage = join(workspace, "a.png");
    const uploadImage = join(uploadDir, "b.png");
    const outsideImage = join(outside, "c.png");
    const textFile = join(workspace, "note.txt");
    await mkdir(workspace, { recursive: true });
    await mkdir(uploadDir, { recursive: true });
    await mkdir(outside, { recursive: true });
    await writeFile(workspaceImage, "workspace-image");
    await writeFile(uploadImage, "upload-image");
    await writeFile(outsideImage, "outside-image");
    await writeFile(textFile, "not image");
    runtimeConfig = {
      ...runtimeConfig,
      workspaceRoots: [workspace],
      uploadDir
    };
    const { GET } = await import("../../src/app/api/codex/images/preview/route");

    const workspaceResponse = await GET(
      new Request(`http://localhost/api/codex/images/preview?path=${encodeURIComponent(workspaceImage)}`)
    );
    const uploadResponse = await GET(
      new Request(`http://localhost/api/codex/images/preview?path=${encodeURIComponent(uploadImage)}`)
    );
    const outsideResponse = await GET(
      new Request(`http://localhost/api/codex/images/preview?path=${encodeURIComponent(outsideImage)}`)
    );
    const textResponse = await GET(
      new Request(`http://localhost/api/codex/images/preview?path=${encodeURIComponent(textFile)}`)
    );

    expect(workspaceResponse.status).toBe(200);
    expect(workspaceResponse.headers.get("content-type")).toBe("image/png");
    expect(uploadResponse.status).toBe(200);
    expect(outsideResponse.status).not.toBe(200);
    expect(textResponse.status).not.toBe(200);
  });

  it("turns/start imagePaths 仍允许 uploadDir 作为额外根", async () => {
    const { POST } = await import("../../src/app/api/codex/turns/start/route");

    const response = await POST(
      jsonRequest("/api/codex/turns/start", {
        threadId: "thread-1",
        text: "看图",
        imagePaths: ["/uploads/a.png"]
      })
    );

    expect(response.status).toBe(200);
    expect(mockAssertRuntimePathAllowed).toHaveBeenCalledWith("/uploads/a.png", [runtimeConfig.uploadDir]);
  });
});
