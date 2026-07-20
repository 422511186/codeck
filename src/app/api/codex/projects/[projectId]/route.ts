import { NextResponse } from "next/server";
import { getProjectCatalogStore } from "../../../../../server/projects/runtime";
import {
  RouteValidationError,
  audit,
  readJsonRecord,
  requireNonEmptyString,
  unauthorized
} from "../../_route-helpers";
import { assertProjectFields, expectedProjectRevision, projectErrorResponse } from "../_helpers";

type RouteContext = { params: Promise<{ projectId: string }> };

export async function PUT(request: Request, context: RouteContext): Promise<Response> {
  const auth = unauthorized(request);
  if (auth) return auth;
  const store = getProjectCatalogStore();
  try {
    const { projectId } = await context.params;
    if (!projectId) throw new RouteValidationError("projectId 不能为空");
    const body = await readJsonRecord(request);
    assertProjectFields(body, ["expectedRevision", "name"]);
    const expectedRevision = expectedProjectRevision(body.expectedRevision);
    const catalog = await store.rename(projectId, requireNonEmptyString(body.name, "name"), expectedRevision);
    await audit("project.rename", { projectId, oldRevision: expectedRevision, newRevision: catalog.revision });
    return NextResponse.json({ ok: true, ...catalog });
  } catch (error) {
    return projectErrorResponse(error, store);
  }
}
export async function DELETE(request: Request, context: RouteContext): Promise<Response> {
  const auth = unauthorized(request);
  if (auth) return auth;
  const store = getProjectCatalogStore();
  try {
    const { projectId } = await context.params;
    if (!projectId) throw new RouteValidationError("projectId 不能为空");
    const body = await readJsonRecord(request);
    assertProjectFields(body, ["expectedRevision"]);
    const expectedRevision = expectedProjectRevision(body.expectedRevision);
    const catalog = await store.delete(projectId, expectedRevision);
    await audit("project.delete", { projectId, oldRevision: expectedRevision, newRevision: catalog.revision });
    return NextResponse.json({ ok: true, ...catalog });
  } catch (error) {
    return projectErrorResponse(error, store);
  }
}
