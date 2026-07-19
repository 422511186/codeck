import { NextResponse } from "next/server";
import { getAppServerGateway } from "../../../../server/app-server/runtime";
import { isRequestAuthenticated } from "../../../../server/auth";
import { mergeSelectableModels } from "../../../../server/custom-models/model-catalog";
import { getCustomModelCatalogStore } from "../../../../server/custom-models/runtime";

export async function GET(request: Request): Promise<Response> {
  if (!isRequestAuthenticated(request)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  try {
    const [appServerModels, catalog] = await Promise.all([
      getAppServerGateway().listModels(),
      getCustomModelCatalogStore().read()
    ]);
    const models = mergeSelectableModels(appServerModels, catalog.models);

    return NextResponse.json({
      ok: true,
      catalogRevision: catalog.revision,
      appServerModelNames: appServerModels.map((model) => model.model),
      models
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "无法读取模型列表" },
      { status: 502 }
    );
  }
}
