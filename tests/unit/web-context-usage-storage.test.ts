import { beforeEach, describe, expect, it } from "vitest";
import {
  clearContextUsage,
  getContextUsage,
  setContextUsage,
  type ContextUsageSnapshot
} from "../../src/web/storage/contextUsage";

const mockStorage: Record<string, string> = {};

beforeEach(() => {
  Object.keys(mockStorage).forEach((key) => delete mockStorage[key]);

  Object.defineProperty(window, "localStorage", {
    value: {
      getItem: (key: string) => mockStorage[key] ?? null,
      setItem: (key: string, value: string) => {
        mockStorage[key] = value;
      },
      removeItem: (key: string) => {
        delete mockStorage[key];
      },
      clear: () => Object.keys(mockStorage).forEach((key) => delete mockStorage[key]),
      key: (index: number) => Object.keys(mockStorage)[index] ?? null,
      get length() {
        return Object.keys(mockStorage).length;
      }
    },
    writable: true,
    configurable: true
  });
});

describe("context usage storage", () => {
  const snapshot: ContextUsageSnapshot = {
    totalTokens: 128000,
    inputTokens: 96000,
    outputTokens: 24000,
    reasoningOutputTokens: 8000,
    modelContextWindow: 200000,
    updatedAt: 1_783_280_000_000
  };

  it("saves and restores usage by thread id", () => {
    setContextUsage("thread-1", snapshot);

    expect(getContextUsage("thread-1")).toEqual(snapshot);
    expect(getContextUsage("thread-2")).toBeNull();
  });

  it("clears one thread without removing other cached usage", () => {
    setContextUsage("thread-1", snapshot);
    setContextUsage("thread-2", { ...snapshot, totalTokens: 64000 });

    clearContextUsage("thread-1");

    expect(getContextUsage("thread-1")).toBeNull();
    expect(getContextUsage("thread-2")).toEqual({ ...snapshot, totalTokens: 64000 });
  });

  it("returns null for invalid cached usage", () => {
    window.localStorage.setItem(
      "codex-web:context-usage",
      JSON.stringify({
        "thread-1": {
          totalTokens: "128000",
          inputTokens: 96000,
          outputTokens: 24000,
          reasoningOutputTokens: 8000,
          modelContextWindow: 200000,
          updatedAt: 1_783_280_000_000
        }
      })
    );

    expect(getContextUsage("thread-1")).toBeNull();
  });
});
