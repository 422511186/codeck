import { NextResponse } from "next/server";
import { getProjectCatalogStore } from "../../../../server/projects/runtime";
import {
  RouteValidationError,
  assertAllowedPath,
  audit,
  readJsonRecord,
  requireNonEmptyString,
  unauthorized
} from "../_route-helpers";
import {
  assertProjectFields,
  expectedProjectRevision,
  projectErrorResponse,
  projectTimestamp
} from "./_helpers";

export async function GET(request: Request): Promise<Response> {
  const auth = unauthorized(request);
  if (auth) return auth;
  const store = getProjectCatalogStore();
  try {
    return NextResponse.json({ ok: true, ...(await store.read()) });
  } catch (error) {
    return projectErrorResponse(error, store);
  }
}
export async function POST(request: Request): Promise<Response> {
  const auth = unauthorized(request);
  if (auth) return auth;
  const store = getProjectCatalogStore();
  try {
    const body = await readJsonRecord(request);
    assertProjectFields(body, ["expectedRevision", "id", "name", "path", "addedAt", "lastUsedAt"]);
    const expectedRevision = expectedProjectRevision(body.expectedRevision);
    const input = {
      ...(body.id === undefined ? {} : { id: requireNonEmptyString(body.id, "id") }),
      name: requireNonEmptyString(body.name, "name"),
      path: assertAllowedPath(body.path, "path"),
      ...(projectTimestamp(body.addedAt, "addedAt") === undefined
        ? {}
        : { addedAt: projectTimestamp(body.addedAt, "addedAt") }),
      ...(projectTimestamp(body.lastUsedAt, "lastUsedAt") === undefined
        ? {}
        : { lastUsedAt: projectTimestamp(body.lastUsedAt, "lastUsedAt") })
    };
    const catalog = await store.create(input, expectedRevision);
    const created = catalog.projects.find((project) => project.id === input.id) ??
      catalog.projects.find((project) => project.path === input.path);
    await audit("project.create", {
      projectId: created?.id ?? null,
      path: input.path,
      oldRevision: expectedRevision,
      newRevision: catalog.revision
    });
    return NextResponse.json({ ok: true, ...catalog });
  } catch (error) {
    return projectErrorResponse(error, store);
  }
}
