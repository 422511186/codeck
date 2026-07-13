import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  readTimelineContent: vi.fn(),
  audit: vi.fn(),
  unauthorized: vi.fn((_request: Request) => null as Response | null)
}));

vi.mock("../../src/app/api/codex/_route-helpers", () => ({
  audit: (...args: unknown[]) => mocks.audit(...args),
  getAppServerGateway: () => ({
    readTimelineContent: (...args: unknown[]) => mocks.readTimelineContent(...args)
  }),
  ok: (body: Record<string, unknown>) => Response.json({ ok: true, ...body }),
  serverError: (error: unknown, fallback: string) =>
    Response.json({ ok: false, error: error instanceof Error ? error.message : fallback }, { status: 502 }),
  unauthorized: (request: Request) => mocks.unauthorized(request),
  RouteValidationError: class RouteValidationError extends Error {}
}));

describe("timeline content route", () => {
  beforeEach(() => {
    mocks.readTimelineContent.mockReset();
    mocks.audit.mockReset();
    mocks.unauthorized.mockReset();
    mocks.unauthorized.mockReturnValue(null);
  });

  it("forwards only opaque contentRef cursor and byte budget", async () => {
    mocks.readTimelineContent.mockResolvedValue({
      text: "chunk",
      startOffset: 64,
      endOffset: 69,
      nextCursor: null,
      includedBytes: 5,
      completeness: { status: "complete", nextCursor: null }
    });
    const { GET } = await import("../../src/app/api/codex/threads/[threadId]/content/route");

    const response = await GET(
      new Request(
        "http://localhost/api/codex/threads/thread-1/content?contentRef=tlc-ref&cursor=tlcc-current&maxBytes=65536&path=/etc/passwd"
      ),
      { params: Promise.resolve({ threadId: "thread-1" }) }
    );

    expect(response.status).toBe(200);
    expect(mocks.readTimelineContent).toHaveBeenCalledWith({
      threadId: "thread-1",
      contentRef: "tlc-ref",
      cursor: "tlcc-current",
      maxBytes: 65536
    });
    expect(mocks.audit).toHaveBeenCalledWith("timeline.content.read", {
      threadId: "thread-1",
      startOffset: 64,
      endOffset: 69,
      status: "complete"
    });
  });

  it("rejects unauthenticated content reads before gateway access", async () => {
    mocks.unauthorized.mockReturnValue(Response.json({ ok: false }, { status: 401 }));
    const { GET } = await import("../../src/app/api/codex/threads/[threadId]/content/route");

    const response = await GET(
      new Request("http://localhost/api/codex/threads/thread-1/content?contentRef=tlc-ref"),
      { params: Promise.resolve({ threadId: "thread-1" }) }
    );

    expect(response.status).toBe(401);
    expect(mocks.readTimelineContent).not.toHaveBeenCalled();
  });
});
