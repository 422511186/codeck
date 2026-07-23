export type StreamingMarkdownParts = {
  stableMarkdown: string;
  pendingPlain: string;
};

const FENCE_LINE = /^( {0,3})(`{3,}|~{3,})(.*)$/;

export function splitStreamingMarkdown(text: string): StreamingMarkdownParts {
  const value = String(text ?? "");
  if (!value) {
    return { stableMarkdown: "", pendingPlain: "" };
  }

  const lines = value.split("\n");
  const lineEndsAt = buildLineEndOffsets(value, lines);

  let fence: { marker: string } | null = null;
  let stableEnd = 0;
  let paragraphStartIndex = 0;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const fenceMatch = FENCE_LINE.exec(line);

    if (fence) {
      const closed =
        Boolean(fenceMatch) &&
        fenceMatch![2]![0] === fence.marker[0] &&
        fenceMatch![2]!.length >= fence.marker.length &&
        fenceMatch![3]!.trim() === "";
      if (closed) {
        fence = null;
        stableEnd = lineEndsAt[index] ?? stableEnd;
        paragraphStartIndex = index + 1;
      }
      continue;
    }

    if (fenceMatch) {
      // Any content before this fence line that formed completed paragraphs is already tracked.
      fence = { marker: fenceMatch[2]! };
      continue;
    }

    if (line.trim() === "") {
      if (index > paragraphStartIndex) {
        // End stable content before this blank line.
        const previousIndex = index - 1;
        stableEnd = lineEndsAt[previousIndex] ?? stableEnd;
      }
      paragraphStartIndex = index + 1;
    }
  }

  // If stream ended with an explicit blank-line boundary, all content is stable.
  if (!fence && /\n\s*\n\s*$/.test(value)) {
    stableEnd = value.length;
  }

  // If no completed boundary was found, everything remains pending.
  if (stableEnd <= 0) {
    return { stableMarkdown: "", pendingPlain: value };
  }

  let stableMarkdown = value.slice(0, stableEnd);
  let pendingPlain = value.slice(stableEnd);

  // Drop blank separators between stable and pending for cleaner progressive UI.
  stableMarkdown = stableMarkdown.replace(/[ \t]+$/u, "").replace(/\n+$/u, "");
  pendingPlain = pendingPlain.replace(/^\n+/u, "");

  if (!stableMarkdown) {
    return { stableMarkdown: "", pendingPlain: value };
  }

  return { stableMarkdown, pendingPlain };
}

function buildLineEndOffsets(value: string, lines: string[]): number[] {
  const ends: number[] = [];
  let cursor = 0;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    cursor += line.length;
    if (index < lines.length - 1) {
      // split("\n") implies a newline existed here unless value has no more chars.
      if (value[cursor] === "\n") {
        cursor += 1;
      }
    } else if (value.endsWith("\n") && value[cursor] === "\n") {
      cursor += 1;
    }
    ends.push(cursor);
  }
  return ends;
}
