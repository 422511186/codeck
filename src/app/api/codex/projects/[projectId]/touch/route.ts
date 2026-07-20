import { NextResponse } from "next/server";
import { getProjectCatalogStore } from "../../../../../../server/projects/runtime";
import { RouteValidationError, audit, readJsonRecord, unauthorized } from "../../../_route-helpers";
import { assertProjectFields, projectErrorResponse, projectTimestamp } from "../../_helpers";

type RouteContext = { params: Promise<{ projectId: string }> };

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  const auth = unauthorized(request);
  if (auth) return auth;
  const store = getProjectCatalogStore();
  try {
    const { projectId } = await context.params;
    if (!projectId) throw new RouteValidationError("projectId 不能为空");
    const body = await readJsonRecord(request);
    assertProjectFields(body, ["lastUsedAt"]);
    const lastUsedAt = projectTimestamp(body.lastUsedAt, "lastUsedAt");
    if (lastUsedAt === undefined) throw new RouteValidationError("lastUsedAt 不能为空");
    const catalog = await store.touch(projectId, lastUsedAt);
    await audit("project.touch", { projectId, lastUsedAt });
    return NextResponse.json({ ok: true, ...catalog });
  } catch (error) {
    return projectErrorResponse(error, store);
  }
}
