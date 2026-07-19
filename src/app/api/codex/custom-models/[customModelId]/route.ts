import { NextResponse } from "next/server";
import { getCustomModelCatalogStore } from "../../../../../server/custom-models/runtime";
import { normalizeCustomModelInput } from "../../../../../server/custom-models/validation";
import { RouteValidationError, audit, readJsonRecord, unauthorized } from "../../_route-helpers";
import { customModelErrorResponse, expectedRevision } from "../_helpers";

type RouteContext = { params: Promise<{ customModelId: string }> };

export async function PUT(request: Request, context: RouteContext): Promise<Response> {
  const auth = unauthorized(request);
  if (auth) {
    return auth;
  }
  const store = getCustomModelCatalogStore();
  try {
    const { customModelId } = await context.params;
    if (!customModelId) {
      throw new RouteValidationError("customModelId 不能为空");
    }
    const body = await readJsonRecord(request);
    const revision = expectedRevision(body.expectedRevision);
    const { expectedRevision: _expectedRevision, ...inputValue } = body;
    const input = normalizeCustomModelInput(inputValue, { requireComplete: true });
    const catalog = await store.replace(customModelId, input, revision);
    await audit("customModel.replace", {
      customModelId,
      model: input.model,
      oldRevision: revision,
      newRevision: catalog.revision
    });
    return NextResponse.json({ ok: true, ...catalog });
  } catch (error) {
    return customModelErrorResponse(error, store);
  }
}

export async function DELETE(request: Request, context: RouteContext): Promise<Response> {
  const auth = unauthorized(request);
  if (auth) {
    return auth;
  }
  const store = getCustomModelCatalogStore();
  try {
    const { customModelId } = await context.params;
    if (!customModelId) {
      throw new RouteValidationError("customModelId 不能为空");
    }
    const body = await readJsonRecord(request);
    const revision = expectedRevision(body.expectedRevision);
    const extraFields = Object.keys(body).filter((field) => field !== "expectedRevision");
    if (extraFields.length > 0) {
      throw new RouteValidationError(`${extraFields[0]} 不是允许的删除字段`);
    }
    const previous = await store.read();
    const deleted = previous.models.find((model) => model.customModelId === customModelId);
    const catalog = await store.delete(customModelId, revision);
    await audit("customModel.delete", {
      customModelId,
      model: deleted?.model ?? null,
      oldRevision: revision,
      newRevision: catalog.revision
    });
    return NextResponse.json({ ok: true, ...catalog });
  } catch (error) {
    return customModelErrorResponse(error, store);
  }
}
