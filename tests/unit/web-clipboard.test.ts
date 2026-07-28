import { afterEach, describe, expect, it, vi } from "vitest";
import { copyText } from "../../src/web/clipboard";

describe("copyText", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("uses Clipboard API when available", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true
    });

    await expect(copyText("hello clipboard")).resolves.toEqual({ ok: true });
    expect(writeText).toHaveBeenCalledWith("hello clipboard");
  });

  it("falls back to execCommand when Clipboard API is unavailable", async () => {
    Object.defineProperty(navigator, "clipboard", {
      value: undefined,
      configurable: true
    });
    const execCommand = vi.fn().mockReturnValue(true);
    Object.defineProperty(document, "execCommand", {
      value: execCommand,
      configurable: true
    });

    await expect(copyText("fallback text")).resolves.toEqual({ ok: true });
    expect(execCommand).toHaveBeenCalledWith("copy");
  });

  it("returns failure when both clipboard paths fail", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("denied"));
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true
    });
    const execCommand = vi.fn().mockReturnValue(false);
    Object.defineProperty(document, "execCommand", {
      value: execCommand,
      configurable: true
    });

    await expect(copyText("cannot copy")).resolves.toEqual({ ok: false });
  });
});
