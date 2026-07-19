import { NextResponse } from "next/server";
import { getCustomModelCatalogStore } from "../../../../server/custom-models/runtime";
import { normalizeCustomModelInput } from "../../../../server/custom-models/validation";
import { audit, readJsonRecord, unauthorized } from "../_route-helpers";
import { customModelErrorResponse, expectedRevision } from "./_helpers";

export async function GET(request: Request): Promise<Response> {
  const auth = unauthorized(request);
  if (auth) {
    return auth;
  }
  const store = getCustomModelCatalogStore();
  try {
    return NextResponse.json({ ok: true, ...(await store.read()) });
  } catch (error) {
    return customModelErrorResponse(error, store);
  }
}

export async function POST(request: Request): Promise<Response> {
  const auth = unauthorized(request);
  if (auth) {
    return auth;
  }
  const store = getCustomModelCatalogStore();
  try {
    const body = await readJsonRecord(request);
    const revision = expectedRevision(body.expectedRevision);
    const { expectedRevision: _expectedRevision, ...inputValue } = body;
    const input = normalizeCustomModelInput(inputValue);
    const catalog = await store.create(input, revision);
    const created = catalog.models.find((model) => model.model === input.model);
    await audit("customModel.create", {
      customModelId: created?.customModelId ?? null,
      model: input.model,
      oldRevision: revision,
      newRevision: catalog.revision
    });
    return NextResponse.json({ ok: true, ...catalog });
  } catch (error) {
    return customModelErrorResponse(error, store);
  }
}
