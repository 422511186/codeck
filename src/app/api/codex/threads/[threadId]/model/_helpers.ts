import { NextResponse } from "next/server";
import {
  type ModelSelection,
  type ModelSwitchExpectedCurrent,
  type ModelSwitchRequest
} from "../../../../../../shared/custom-models";
import { RouteValidationError, isRecord } from "../../../_route-helpers";

function assertOnlyKeys(value: Record<string, unknown>, allowed: string[], subject: string): void {
  const unknown = Object.keys(value).find((key) => !allowed.includes(key));
  if (unknown) {
    throw new RouteValidationError(`${subject}.${unknown} 不是允许的字段`);
  }
}

export function readModelSelection(value: unknown, fieldName: string): ModelSelection {
  if (!isRecord(value)) {
    throw new RouteValidationError(`${fieldName} 必须是来源敏感模型身份`);
  }
  if (value.source === "custom") {
    assertOnlyKeys(value, ["source", "customModelId"], fieldName);
    if (typeof value.customModelId !== "string" || !value.customModelId) {
      throw new RouteValidationError(`${fieldName}.customModelId 不能为空`);
    }
    return { source: "custom", customModelId: value.customModelId };
  }
  if (value.source === "app-server") {
    assertOnlyKeys(value, ["source", "model"], fieldName);
    if (typeof value.model !== "string" || !value.model) {
      throw new RouteValidationError(`${fieldName}.model 不能为空`);
    }
    return { source: "app-server", model: value.model };
  }
  throw new RouteValidationError(`${fieldName}.source 无效`);
}

function readExpectedCurrent(value: unknown): ModelSwitchExpectedCurrent {
  if (!isRecord(value)) {
    throw new RouteValidationError("expectedCurrent 必须是对象");
  }
  assertOnlyKeys(
    value,
    ["selection", "reasoningEffort", "bindingVersion"],
    "expectedCurrent"
  );
  if (value.reasoningEffort !== null && typeof value.reasoningEffort !== "string") {
    throw new RouteValidationError("expectedCurrent.reasoningEffort 必须是字符串或 null");
  }
  if (value.bindingVersion !== null && typeof value.bindingVersion !== "string") {
    throw new RouteValidationError("expectedCurrent.bindingVersion 必须是字符串或 null");
  }
  return {
    selection: readModelSelection(value.selection, "expectedCurrent.selection"),
    reasoningEffort: value.reasoningEffort,
    bindingVersion: value.bindingVersion
  };
}

export function readSwitchRequest(body: Record<string, unknown>): ModelSwitchRequest {
  assertOnlyKeys(body, ["target", "expectedCatalogRevision", "expectedCurrent", "kind"], "request");
  if (!Number.isSafeInteger(body.expectedCatalogRevision) || (body.expectedCatalogRevision as number) < 0) {
    throw new RouteValidationError("expectedCatalogRevision 必须是非负安全整数");
  }
  if (body.kind !== undefined && body.kind !== "switch" && body.kind !== "reapply") {
    throw new RouteValidationError("kind 必须是 switch 或 reapply");
  }
  return {
    target: readModelSelection(body.target, "target"),
    expectedCatalogRevision: body.expectedCatalogRevision as number,
    expectedCurrent: readExpectedCurrent(body.expectedCurrent),
    ...(body.kind ? { kind: body.kind } : {})
  };
}

export function switchTerminalResponse(result: {
  httpStatus: number;
  outcome: string;
  [key: string]: unknown;
}): Response {
  const { httpStatus, ...body } = result;
  return NextResponse.json({ ok: httpStatus === 200, ...body }, { status: httpStatus });
}

export function switchErrorResponse(error: unknown): Response {
  if (error instanceof RouteValidationError) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }
  const structured = typeof error === "object" && error !== null
    ? error as {
        httpStatus?: unknown;
        code?: unknown;
        operationId?: unknown;
        latestState?: unknown;
        latestCatalog?: unknown;
        message?: unknown;
      }
    : null;
  if (structured?.httpStatus === 409 && typeof structured.code === "string") {
    return NextResponse.json(
      {
        ok: false,
        code: structured.code,
        error: error instanceof Error ? error.message : "模型切换前置状态已变化",
        operationId: structured.operationId,
        latestState: structured.latestState ?? null,
        catalog: structured.latestCatalog ?? null
      },
      { status: 409 }
    );
  }
  const code = typeof structured?.code === "string" ? structured.code : "MODEL_SWITCH_FAILED";
  return NextResponse.json(
    {
      ok: false,
      code,
      error: error instanceof Error ? error.message : "模型切换失败",
      operationId: structured?.operationId ?? null,
      latestState: structured?.latestState ?? null
    },
    { status: 500 }
  );
}
