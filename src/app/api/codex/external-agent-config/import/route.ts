import {
  assertAllowedPath,
  audit,
  badRequest,
  getAppServerGateway,
  isRecord,
  nonEmptyString,
  ok,
  readJsonRecord,
  RouteValidationError,
  serverError,
  unauthorized
} from "../../_route-helpers";
import type { MobileExternalAgentConfigMigrationItem } from "../../../../../shared/codex";

function parseMigrationItem(value: unknown): MobileExternalAgentConfigMigrationItem {
  if (!isRecord(value)) {
    throw new RouteValidationError("migrationItems 必须是对象数组");
  }

  const itemType = nonEmptyString(value.itemType);
  const description = nonEmptyString(value.description);
  if (!itemType) {
    throw new RouteValidationError("migrationItems.itemType 不能为空");
  }
  if (!description) {
    throw new RouteValidationError("migrationItems.description 不能为空");
  }

  let cwd: string | null = null;
  if (typeof value.cwd === "string" && value.cwd.trim()) {
    cwd = assertAllowedPath(value.cwd, "cwd");
  } else if (value.cwd !== undefined && value.cwd !== null) {
    throw new RouteValidationError("migrationItems.cwd 必须是字符串或 null");
  }

  return {
    itemType,
    description,
    cwd,
    details: value.details === undefined ? null : (value.details as MobileExternalAgentConfigMigrationItem["details"])
  };
}

export async function POST(request: Request): Promise<Response> {
  const auth = unauthorized(request);
  if (auth) {
    return auth;
  }

  try {
    const body = await readJsonRecord(request);
    if (!Array.isArray(body.migrationItems)) {
      return badRequest("migrationItems 必须是数组");
    }

    const migrationItems = body.migrationItems.map(parseMigrationItem);
    await audit("externalAgentConfig.import", { count: migrationItems.length });
    const result = await getAppServerGateway().importExternalAgentConfig({ migrationItems });
    return ok({ result });
  } catch (error) {
    return serverError(error, "无法导入 external agent config");
  }
}
