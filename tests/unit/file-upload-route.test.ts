import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authenticated: true,
  cleanup: vi.fn(),
  save: vi.fn(),
  audit: vi.fn()
}));

vi.mock("../../src/server/auth", () => ({ isRequestAuthenticated: () => mocks.authenticated }));
vi.mock("../../src/server/runtime", () => ({ getRuntimeConfig: () => ({ uploadDir: "C:/uploads" }) }));
vi.mock("../../src/server/security", () => ({ audit: (...args: unknown[]) => mocks.audit(...args) }));
vi.mock("../../src/server/uploads", () => ({
  cleanupExpiredUploads: (...args: unknown[]) => mocks.cleanup(...args),
  saveUploadedFile: (...args: unknown[]) => mocks.save(...args)
}));

describe("file upload route", () => {
  beforeEach(() => {
    mocks.authenticated = true;
    mocks.cleanup.mockReset().mockResolvedValue(0);
    mocks.audit.mockReset().mockResolvedValue(undefined);
    mocks.save.mockReset().mockResolvedValue({
      id: "file-1", name: "note.txt", path: "C:/uploads/file-1.txt", mimeType: "text/plain", size: 5
    });
  });

  it("要求认证", async () => {
    mocks.authenticated = false;
    const { POST } = await import("../../src/app/api/codex/uploads/files/route");
    expect((await POST(new Request("http://localhost/api/codex/uploads/files", { method: "POST" }))).status).toBe(401);
  });

  it("保存单个普通文件并只审计受控元数据", async () => {
    const { POST } = await import("../../src/app/api/codex/uploads/files/route");
    const form = new FormData();
    form.set("file", new File(["hello"], "note.txt", { type: "text/plain" }));
    const response = await POST({
      headers: new Headers(),
      formData: async () => form
    } as Request);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ ok: true, file: { id: "file-1", name: "note.txt" } });
    expect(mocks.audit).toHaveBeenCalledWith("upload.file", {
      id: "file-1", path: "C:/uploads/file-1.txt", mimeType: "text/plain", size: 5
    });
    expect(mocks.audit).not.toHaveBeenCalledWith("upload.file", expect.objectContaining({ name: expect.anything(), content: expect.anything() }));
  });

  it("通过 Content-Length 预检拒绝明显超限请求", async () => {
    const { POST } = await import("../../src/app/api/codex/uploads/files/route");
    const response = await POST(new Request("http://localhost/api/codex/uploads/files", {
      method: "POST", headers: { "content-length": String(22 * 1024 * 1024) }
    }));
    expect(response.status).toBe(400);
    expect(mocks.save).not.toHaveBeenCalled();
  });
});
