import {
  audit,
  badRequest,
  getAppServerGateway,
  ok,
  readJsonRecord,
  serverError,
  unauthorized
} from "../../_route-helpers";
import type { MobileExternalAgentConfigMigrationItem } from "../../../../../shared/codex";

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

    const migrationItems = body.migrationItems as MobileExternalAgentConfigMigrationItem[];
    await audit("externalAgentConfig.import", { count: migrationItems.length });
    const result = await getAppServerGateway().importExternalAgentConfig({ migrationItems });
    return ok({ result });
  } catch (error) {
    return serverError(error, "无法导入 external agent config");
  }
}
