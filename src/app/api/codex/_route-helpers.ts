import { NextResponse } from "next/server";
import { getAppServerGateway } from "../../../server/app-server/runtime";
import { isRequestAuthenticated } from "../../../server/auth";
import { audit } from "../../../server/security";

export { audit, getAppServerGateway };

export function unauthorized(request: Request): Response | null {
  return isRequestAuthenticated(request) ? null : NextResponse.json({ ok: false }, { status: 401 });
}

export function badRequest(error: string): Response {
  return NextResponse.json({ ok: false, error }, { status: 400 });
}

export function serverError(error: unknown, fallback: string): Response {
  return NextResponse.json(
    { ok: false, error: error instanceof Error ? error.message : fallback },
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
  const value = await request.json();
  return isRecord(value) ? value : {};
}

export function nonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function optionalStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  return value.filter((item): item is string => typeof item === "string");
}

export function optionalStringRecord(value: unknown): Record<string, string> | null {
  if (!isRecord(value)) {
    return null;
  }

  return Object.fromEntries(
    Object.entries(value).flatMap(([key, entryValue]) => (typeof entryValue === "string" ? [[key, entryValue]] : []))
  );
}
