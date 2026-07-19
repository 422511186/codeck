import { NextResponse } from "next/server";
import { getAppServerGateway } from "../../../server/app-server/runtime";
import { isRequestAuthenticated } from "../../../server/auth";
import { assertRuntimePathAllowed, assertRuntimeWorkspaceRootsAllowed, audit } from "../../../server/security";
import { publicErrorMessage } from "../../../shared/errors";

export { audit, getAppServerGateway };

export class RouteValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RouteValidationError";
  }
}

export function unauthorized(request: Request): Response | null {
  return isRequestAuthenticated(request) ? null : NextResponse.json({ ok: false }, { status: 401 });
}

export function badRequest(error: string): Response {
  return NextResponse.json({ ok: false, error }, { status: 400 });
}

export function serverError(error: unknown, fallback: string): Response {
  if (error instanceof RouteValidationError) {
    return badRequest(error.message);
  }

  return NextResponse.json(
    { ok: false, error: publicErrorMessage(error, fallback) },
    { status: 502 }
  );
}

export function ok(body: Record<string, unknown> = {}): Response {
  return NextResponse.json({ ok: true, ...body });
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function readJsonRecord(request: Request): Promise<Record<string, unknown>> {
  let value: unknown;
  try {
    value = await request.json();
  } catch {
    throw new RouteValidationError("请求体必须是有效 JSON");
  }

  if (!isRecord(value)) {
    throw new RouteValidationError("请求体必须是 JSON 对象");
  }

  return value;
}

export async function readOptionalJsonRecord(request: Request): Promise<Record<string, unknown>> {
  let text: string;
  try {
    text = await request.text();
  } catch {
    throw new RouteValidationError("请求体必须是有效 JSON");
  }

  if (!text.trim()) {
    return {};
  }

  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new RouteValidationError("请求体必须是有效 JSON");
  }

  if (!isRecord(value)) {
    throw new RouteValidationError("请求体必须是 JSON 对象");
  }

  return value;
}

export function nonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function optionalStrictString(value: unknown, fieldName: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new RouteValidationError(`${fieldName} 必须是字符串`);
  }

  return value;
}

export function optionalStrictNonEmptyString(value: unknown, fieldName: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  return requireNonEmptyString(value, fieldName);
}

export function optionalStrictNullableString(value: unknown, fieldName: string): string | null | undefined {
  if (value === undefined || value === null) {
    return value;
  }

  if (typeof value !== "string") {
    throw new RouteValidationError(`${fieldName} 必须是字符串`);
  }

  return value;
}

export function optionalApprovalPolicy(
  value: unknown,
  fieldName = "approvalPolicy"
): "untrusted" | "on-request" | "never" | null | undefined {
  if (value === undefined || value === null) {
    return value;
  }
  if (value === "untrusted" || value === "on-request" || value === "never") {
    return value;
  }
  throw new RouteValidationError(`${fieldName} 无效`);
}

export function optionalStrictBoolean(value: unknown, fieldName: string): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "boolean") {
    throw new RouteValidationError(`${fieldName} 必须是布尔值`);
  }

  return value;
}

export function optionalStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  return value.filter((item): item is string => typeof item === "string");
}

export function optionalStrictStringArray(value: unknown, fieldName: string): string[] | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (!Array.isArray(value)) {
    throw new RouteValidationError(`${fieldName} 必须是字符串数组`);
  }

  return value.map((item) => {
    if (typeof item !== "string" || !item.trim()) {
      throw new RouteValidationError(`${fieldName} 必须是字符串数组`);
    }

    return item.trim();
  });
}

export function requireStrictStringArray(value: unknown, fieldName: string): string[] {
  const result = optionalStrictStringArray(value, fieldName);
  if (!result) {
    throw new RouteValidationError(`${fieldName} 必须是字符串数组`);
  }

  return result;
}

export function requireNonEmptyString(value: unknown, fieldName: string): string {
  const result = nonEmptyString(value);
  if (!result) {
    throw new RouteValidationError(`${fieldName} 不能为空`);
  }

  return result;
}

export function assertAllowedPath(value: unknown, fieldName = "path", extraRoots: string[] = []): string {
  const path = requireNonEmptyString(value, fieldName);
  try {
    return assertRuntimePathAllowed(path, extraRoots);
  } catch (error) {
    throw new RouteValidationError(publicErrorMessage(error, "路径不在允许的工作区内"));
  }
}

export function assertAllowedWorkspaceRoots(value: unknown): string[] | undefined {
  if (value !== undefined && !Array.isArray(value)) {
    throw new RouteValidationError("workspaceRoots 必须是字符串数组");
  }

  try {
    return assertRuntimeWorkspaceRootsAllowed(value);
  } catch (error) {
    throw new RouteValidationError(publicErrorMessage(error, "workspaceRoots 不在允许的工作区内"));
  }
}

export function optionalStringRecord(value: unknown): Record<string, string> | null {
  if (!isRecord(value)) {
    return null;
  }

  return Object.fromEntries(
    Object.entries(value).flatMap(([key, entryValue]) => (typeof entryValue === "string" ? [[key, entryValue]] : []))
  );
}
