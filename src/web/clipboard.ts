export type CopyTextResult = {
  ok: boolean;
};

export async function copyText(text: string): Promise<CopyTextResult> {
  const value = String(text ?? "");

  try {
    const clipboard = typeof navigator !== "undefined" ? navigator.clipboard : undefined;
    if (clipboard && typeof clipboard.writeText === "function") {
      await clipboard.writeText(value);
      return { ok: true };
    }
  } catch {
    // Fall through to the compatibility path.
  }

  return copyTextWithExecCommand(value);
}

function copyTextWithExecCommand(text: string): CopyTextResult {
  if (typeof document === "undefined") {
    return { ok: false };
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.top = "0";
  textarea.style.left = "0";
  textarea.style.width = "1px";
  textarea.style.height = "1px";
  textarea.style.padding = "0";
  textarea.style.border = "none";
  textarea.style.outline = "none";
  textarea.style.boxShadow = "none";
  textarea.style.background = "transparent";
  textarea.style.opacity = "0";

  document.body.appendChild(textarea);

  const selection = document.getSelection();
  const previousRange = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

  textarea.focus();
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);

  let ok = false;
  try {
    ok = typeof document.execCommand === "function" ? document.execCommand("copy") : false;
  } catch {
    ok = false;
  }

  textarea.remove();

  if (selection) {
    selection.removeAllRanges();
    if (previousRange) {
      selection.addRange(previousRange);
    }
  }

  return { ok: Boolean(ok) };
}
