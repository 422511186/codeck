import { NextResponse } from "next/server";
import { getProjectCatalogStore } from "../../../../../server/projects/runtime";
import { RouteValidationError, audit, readJsonRecord, unauthorized } from "../../_route-helpers";
import { assertProjectFields, expectedProjectRevision, projectErrorResponse } from "../_helpers";

export async function PUT(request: Request): Promise<Response> {
  const auth = unauthorized(request);
  if (auth) return auth;
  const store = getProjectCatalogStore();
  try {
    const body = await readJsonRecord(request);
    assertProjectFields(body, ["expectedRevision", "defaultStorage"]);
    const expectedRevision = expectedProjectRevision(body.expectedRevision);
    if (body.defaultStorage !== "client" && body.defaultStorage !== "server") {
      throw new RouteValidationError("defaultStorage 必须是 client 或 server");
    }
    const catalog = await store.setDefaultStorage(body.defaultStorage, expectedRevision);
    await audit("project.defaultStorage.update", {
      defaultStorage: body.defaultStorage,
      oldRevision: expectedRevision,
      newRevision: catalog.revision
    });
    return NextResponse.json({ ok: true, ...catalog });
  } catch (error) {
    return projectErrorResponse(error, store);
  }
}
