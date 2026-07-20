import { NextResponse } from "next/server";
import type { ProjectCatalogStore } from "../../../../server/projects/catalog-store";
import {
  ProjectCatalogRevisionConflictError,
  ProjectCatalogStoreError,
  ProjectPathConflictError
} from "../../../../server/projects/catalog-store";
import { RouteValidationError } from "../_route-helpers";

export function expectedProjectRevision(value: unknown): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new RouteValidationError("expectedRevision 必须是非负安全整数");
  }
  return value as number;
}

export function projectTimestamp(value: unknown, fieldName: string): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new RouteValidationError(`${fieldName} 必须是非负安全整数`);
  }
  return value as number;
}

export function assertProjectFields(body: Record<string, unknown>, allowed: string[]): void {
  const allowedSet = new Set(allowed);
  const extra = Object.keys(body).find((field) => !allowedSet.has(field));
  if (extra) {
    throw new RouteValidationError(`${extra} 不是允许的项目字段`);
  }
}

export async function projectErrorResponse(error: unknown, store: ProjectCatalogStore): Promise<Response> {
  if (error instanceof RouteValidationError) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }
  const structured = typeof error === "object" && error !== null
    ? error as {
        code?: unknown;
        message?: unknown;
        latestCatalog?: unknown;
        conflictingProject?: unknown;
      }
    : null;
  if (
    error instanceof ProjectCatalogRevisionConflictError ||
    (structured?.code === "PROJECT_CATALOG_REVISION_CONFLICT" && structured.latestCatalog)
  ) {
    const latestCatalog = error instanceof ProjectCatalogRevisionConflictError
      ? error.latestCatalog
      : structured?.latestCatalog as Record<string, unknown>;
    return NextResponse.json(
      {
        ok: false,
        code: "PROJECT_CATALOG_REVISION_CONFLICT",
        error: error instanceof Error ? error.message : "项目目录已被其他设备修改",
        ...latestCatalog
      },
      { status: 409 }
    );
  }
  if (
    error instanceof ProjectPathConflictError ||
    (structured?.code === "PROJECT_PATH_CONFLICT" && structured.latestCatalog)
  ) {
    const latestCatalog = error instanceof ProjectPathConflictError
      ? error.latestCatalog
      : structured?.latestCatalog as Record<string, unknown>;
    const conflictingProject = error instanceof ProjectPathConflictError
      ? error.conflictingProject
      : structured?.conflictingProject;
    return NextResponse.json(
      {
        ok: false,
        code: "PROJECT_PATH_CONFLICT",
        error: error instanceof Error ? error.message : "该工作区路径已存在服务端项目",
        conflictingProject,
        ...latestCatalog
      },
      { status: 409 }
    );
  }
  const code = error instanceof ProjectCatalogStoreError
    ? error.code
    : typeof structured?.code === "string"
      ? structured.code
      : null;
  if (code?.startsWith("PROJECT_")) {
    const status = code === "PROJECT_NOT_FOUND"
      ? 404
      : code === "PROJECT_ID_CONFLICT" || code === "PROJECT_PATH_CONFLICT"
        ? 409
        : code === "PROJECT_CATALOG_VALIDATION_FAILED"
          ? 400
          : code === "PROJECT_CATALOG_LOCK_TIMEOUT"
            ? 503
            : 500;
    const latest = status === 409 ? await store.read().catch(() => null) : null;
    return NextResponse.json(
      {
        ok: false,
        code,
        error: error instanceof Error ? error.message : "项目目录操作失败",
        ...(latest ?? {})
      },
      { status }
    );
  }
  return NextResponse.json(
    { ok: false, code: "PROJECT_CATALOG_STORAGE_ERROR", error: "项目目录操作失败" },
    { status: 500 }
  );
}
