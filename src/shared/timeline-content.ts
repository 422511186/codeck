export const TIMELINE_ITEM_INLINE_BYTE_BUDGET = 96 * 1024;
export const TIMELINE_PAGE_BYTE_BUDGET = 1024 * 1024;
export const TIMELINE_RESPONSE_BYTE_BUDGET = 2 * 1024 * 1024;
export const TIMELINE_EVENT_BYTE_BUDGET = 256 * 1024;
export const TIMELINE_CONTENT_CHUNK_BYTE_BUDGET = 2 * 1024 * 1024;

export type TimelineCompletenessStatus = "complete" | "partial" | "truncated" | "repair-required";

export type TimelineCompletenessReason =
  | "page-budget"
  | "response-budget"
  | "item-budget"
  | "event-budget"
  | "source-gap"
  | "cursor-loop"
  | "zero-progress"
  | "invalid-content-ref"
  | "source-revision";

export type TimelineCompleteness = {
  status: TimelineCompletenessStatus;
  reason?: TimelineCompletenessReason;
  nextCursor?: string | null;
  originalBytes?: number;
  includedBytes?: number;
  contentRef?: string;
  contentCursor?: string | null;
};

const textEncoder = new TextEncoder();

export function utf8ByteLength(value: string): number {
  return textEncoder.encode(value).byteLength;
}

export function utf8SafePrefix(value: string, maxBytes: number): { text: string; bytes: number } {
  if (maxBytes <= 0 || !value) {
    return { text: "", bytes: 0 };
  }
  const totalBytes = utf8ByteLength(value);
  if (totalBytes <= maxBytes) {
    return { text: value, bytes: totalBytes };
  }

  let low = 0;
  let high = value.length;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (utf8ByteLength(value.slice(0, middle)) <= maxBytes) {
      low = middle;
    } else {
      high = middle - 1;
    }
  }
  let end = low;
  if (
    end > 0 &&
    end < value.length &&
    value.charCodeAt(end - 1) >= 0xd800 &&
    value.charCodeAt(end - 1) <= 0xdbff &&
    value.charCodeAt(end) >= 0xdc00 &&
    value.charCodeAt(end) <= 0xdfff
  ) {
    end -= 1;
  }
  const text = value.slice(0, end);
  return { text, bytes: utf8ByteLength(text) };
}

export function utf8SafeChunk(
  value: string,
  byteOffset: number,
  maxBytes: number
): { text: string; startOffset: number; endOffset: number; totalBytes: number } {
  const encoded = textEncoder.encode(value);
  const startOffset = Math.max(0, Math.min(Math.floor(byteOffset), encoded.byteLength));
  let endOffset = Math.min(encoded.byteLength, startOffset + Math.max(0, Math.floor(maxBytes)));
  while (endOffset > startOffset && endOffset < encoded.byteLength && (encoded[endOffset]! & 0xc0) === 0x80) {
    endOffset -= 1;
  }
  return {
    text: new TextDecoder().decode(encoded.subarray(startOffset, endOffset)),
    startOffset,
    endOffset,
    totalBytes: encoded.byteLength
  };
}

export function boundedTimelineText(
  value: string,
  options: { maxBytes?: number; contentRef?: string; reason?: TimelineCompletenessReason } = {}
): { text: string; completeness: TimelineCompleteness } {
  const maxBytes = options.maxBytes ?? TIMELINE_ITEM_INLINE_BYTE_BUDGET;
  const originalBytes = utf8ByteLength(value);
  if (originalBytes <= maxBytes) {
    return {
      text: value,
      completeness: { status: "complete", originalBytes, includedBytes: originalBytes }
    };
  }
  const preview = utf8SafePrefix(value, maxBytes);
  return {
    text: preview.text,
    completeness: {
      status: "truncated",
      reason: options.reason ?? "item-budget",
      originalBytes,
      includedBytes: preview.bytes,
      ...(options.contentRef ? { contentRef: options.contentRef, contentCursor: null } : {})
    }
  };
}

export function createOpaqueTimelineContentRef(parts: ReadonlyArray<string | number | null | undefined>): string {
  const input = parts.map((part) => String(part ?? "")).join("\u001f");
  let first = 0x811c9dc5;
  let second = 0x9e3779b9;
  for (let index = 0; index < input.length; index += 1) {
    const code = input.charCodeAt(index);
    first = Math.imul(first ^ code, 0x01000193) >>> 0;
    second = Math.imul(second ^ code, 0x85ebca6b) >>> 0;
  }
  return `tlc_${first.toString(36)}${second.toString(36)}`;
}
