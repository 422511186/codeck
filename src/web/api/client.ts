import type { ApiErr, ApiOk, ApiResponse } from "./types";
import { sanitizePublicErrorMessage } from "../../shared/errors";

export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;
  constructor(message: string, status: number, body: unknown = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

export type SessionInvalidHandler = () => void;

let sessionInvalidHandler: SessionInvalidHandler | null = null;

export function setSessionInvalidHandler(handler: SessionInvalidHandler | null): void {
  sessionInvalidHandler = handler;
}

const DEFAULT_TIMEOUT_MS = 30_000;

export type ApiRequestOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  body?: unknown;
  formData?: FormData;
  query?: Record<string, string | number | boolean | null | undefined>;
  signal?: AbortSignal;
  timeoutMs?: number;
  headers?: Record<string, string>;
  /**
   * Allow caller to suppress the global 401 handler — used by login flows.
   */
  skipSessionRedirect?: boolean;
};

function buildUrl(path: string, query?: ApiRequestOptions["query"]): string {
  if (!query) return path;
  const params: string[] = [];
  for (const [key, value] of Object.entries(query)) {
    if (value === null || value === undefined || value === "") continue;
    params.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  }
  if (!params.length) return path;
  return `${path}${path.includes("?") ? "&" : "?"}${params.join("&")}`;
}

async function readBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { ok: false, error: sanitizePublicErrorMessage(text) };
  }
}

export async function api<T = Record<string, unknown>>(
  path: string,
  options: ApiRequestOptions = {}
): Promise<ApiOk<T>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  if (options.signal) {
    options.signal.addEventListener("abort", () => controller.abort(), { once: true });
  }

  const init: RequestInit = {
    method: options.method ?? "GET",
    credentials: "include",
    signal: controller.signal
  };

  const headers: Record<string, string> = { ...(options.headers ?? {}) };

  if (options.formData) {
    init.body = options.formData;
  } else if (options.body !== undefined) {
    init.body = JSON.stringify(options.body);
    headers["content-type"] = "application/json";
  }

  init.headers = headers;

  try {
    const response = await fetch(buildUrl(path, options.query), init);
    const body = (await readBody(response)) as ApiResponse<T>;

    if (response.status === 401) {
      if (!options.skipSessionRedirect && sessionInvalidHandler) {
        sessionInvalidHandler();
      }
      throw new ApiError("未登录或 session 已失效", 401, body);
    }

    if (!response.ok) {
      const message =
        sanitizePublicErrorMessage((body as ApiErr)?.error ?? "", `请求失败 (${response.status})`);
      throw new ApiError(message, response.status, body);
    }

    if (body && typeof body === "object" && (body as ApiResponse<T>).ok === false) {
      throw new ApiError(
        sanitizePublicErrorMessage((body as ApiErr).error ?? "", "请求失败"),
        response.status,
        body
      );
    }

    return body as ApiOk<T>;
  } finally {
    clearTimeout(timer);
  }
}
