import { NextResponse } from "next/server";
import { getAppServerGateway } from "../../../../server/app-server/runtime";
import { isRequestAuthenticated } from "../../../../server/auth";

const CWD_FILTER_SCAN_PAGE_LIMIT = 100;

function normalizePath(input: string): string {
  return input.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
}

export async function GET(request: Request): Promise<Response> {
  if (!isRequestAuthenticated(request)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const cursor = url.searchParams.get("cursor");
    const searchTerm = (url.searchParams.get("search") || url.searchParams.get("q") || "").trim();
    const cwd = url.searchParams.get("cwd")?.trim();
    const archived = url.searchParams.get("archived") === "true";
    const gateway = getAppServerGateway();
    const readPage = (nextCursor: string | null) =>
      searchTerm
        ? gateway.searchThreads({
            searchTerm,
            limit: 30,
            cursor: nextCursor,
            archived
          })
        : gateway.listThreads({
            limit: 30,
            cursor: nextCursor,
            sortKey: "updated_at",
            sortDirection: "desc",
            archived
          });

    if (cwd) {
      const target = normalizePath(cwd);
      const threads = [];
      let nextCursor: string | null = cursor;
      for (let i = 0; i < CWD_FILTER_SCAN_PAGE_LIMIT; i++) {
        const page = await readPage(nextCursor);
        threads.push(...page.threads.filter((thread) => normalizePath(thread.cwd) === target));
        if (!page.nextCursor) {
          return NextResponse.json({ ok: true, threads, nextCursor: null });
        }
        nextCursor = page.nextCursor;
      }

      return NextResponse.json({ ok: true, threads, nextCursor });
    }

    const page = await readPage(cursor);

    return NextResponse.json({ ok: true, ...page });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "无法读取会话历史" },
      { status: 502 }
    );
  }
}
