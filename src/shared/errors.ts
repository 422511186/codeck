const MAX_PUBLIC_ERROR_LENGTH = 500;

export function publicErrorMessage(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : fallback;
  return sanitizePublicErrorMessage(message, fallback);
}

export function sanitizePublicErrorMessage(message: string, fallback = "请求失败"): string {
  const trimmed = message.trim();
  if (!trimmed) {
    return fallback;
  }

  if (looksLikeHtml(trimmed)) {
    const summary = summarizeHtmlError(trimmed);
    return summary ?? "上游服务返回了不可读的 HTML 错误页面";
  }

  return trimmed.length > MAX_PUBLIC_ERROR_LENGTH
    ? `${trimmed.slice(0, MAX_PUBLIC_ERROR_LENGTH)}…`
    : trimmed;
}

function looksLikeHtml(text: string): boolean {
  return /<!doctype\s+html/i.test(text) || /<html[\s>]/i.test(text) || /<title[\s>]/i.test(text);
}

function summarizeHtmlError(html: string): string | null {
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]
    ?.replace(/\s+/g, " ")
    .trim();
  const source = title || html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const status = source.match(/\b(4\d\d|5\d\d)\b/)?.[1];
  const reason = source.match(/\bBad gateway\b/i)?.[0];

  if (status === "502" || reason) {
    return `上游服务暂不可用（${status ?? "502"} ${reason ?? "Bad gateway"}）`;
  }
  if (status) {
    return `上游服务返回错误（${status}）`;
  }

  return null;
}
