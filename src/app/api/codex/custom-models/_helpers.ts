import { NextResponse } from "next/server";
import type { CustomModelCatalogStore } from "../../../../server/custom-models/catalog-store";
import {
  CatalogRevisionConflictError,
  CustomModelStoreError
} from "../../../../server/custom-models/catalog-store";
import { CustomModelValidationError } from "../../../../server/custom-models/validation";
import { RouteValidationError } from "../_route-helpers";

export function expectedRevision(value: unknown): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new RouteValidationError("expectedRevision 必须是非负安全整数");
  }
  return value as number;
}

export async function customModelErrorResponse(
  error: unknown,
  store: CustomModelCatalogStore
): Promise<Response> {
  if (error instanceof RouteValidationError) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }
  if (error instanceof CustomModelValidationError) {
    return NextResponse.json(
      { ok: false, code: error.code, error: error.message, issues: error.issues },
      { status: error.code === "CUSTOM_MODEL_DUPLICATE" ? 409 : 400 }
    );
  }
  const structured = typeof error === "object" && error !== null
    ? error as { code?: unknown; message?: unknown; latestCatalog?: unknown }
    : null;
  if (
    error instanceof CatalogRevisionConflictError ||
    (structured?.code === "CATALOG_REVISION_CONFLICT" &&
      typeof structured.latestCatalog === "object" &&
      structured.latestCatalog !== null)
  ) {
    const conflict = error as CatalogRevisionConflictError;
    return NextResponse.json(
      {
        ok: false,
        code: "CATALOG_REVISION_CONFLICT",
        error: error instanceof Error ? error.message : "自定义模型目录已被其他客户端修改",
        ...conflict.latestCatalog
      },
      { status: 409 }
    );
  }
  const storeCode = error instanceof CustomModelStoreError
    ? error.code
    : typeof structured?.code === "string"
      ? structured.code
      : null;
  if (storeCode?.startsWith("CUSTOM_MODEL_") || storeCode === "CATALOG_REVISION_CONFLICT") {
    const status = storeCode === "CUSTOM_MODEL_NOT_FOUND"
      ? 404
      : storeCode === "CUSTOM_MODEL_DUPLICATE" || storeCode === "CUSTOM_MODEL_LIMIT_REACHED"
        ? 409
        : storeCode === "CUSTOM_MODEL_LOCK_TIMEOUT"
          ? 503
          : storeCode === "CUSTOM_MODEL_VALIDATION_FAILED"
            ? 400
            : 500;
    const latest = status === 409 ? await store.read().catch(() => null) : null;
    return NextResponse.json(
      {
        ok: false,
        code: storeCode,
        error: error instanceof Error ? error.message : "自定义模型目录操作失败",
        ...(latest ?? {})
      },
      { status }
    );
  }
  return NextResponse.json(
    { ok: false, code: "CUSTOM_MODEL_STORAGE_ERROR", error: "自定义模型目录操作失败" },
    { status: 500 }
  );
}
