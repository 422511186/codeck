import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  listProjects,
  getProject,
  addProject,
  removeProject,
  renameProject,
  touchProjectLastUsed
} from "../../src/web/storage/projects";

const mockStorage: Record<string, string> = {};

// Mock window.localStorage globally
global.window = {
  localStorage: {
    getItem: (key: string) => mockStorage[key] ?? null,
    setItem: (key: string, value: string) => {
      mockStorage[key] = value;
    },
    removeItem: (key: string) => {
      delete mockStorage[key];
    },
    clear: () => Object.keys(mockStorage).forEach((k) => delete mockStorage[k]),
    key: (index: number) => Object.keys(mockStorage)[index] ?? null,
    get length() {
      return Object.keys(mockStorage).length;
    }
  }
} as unknown as Window & typeof globalThis;

beforeEach(() => {
  Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("projects storage", () => {
  it("should return empty list initially", () => {
    expect(listProjects()).toEqual([]);
  });

  it("should add a project", () => {
    const p = addProject("C:/test", "Test");
    expect(p.name).toBe("Test");
    expect(p.path).toBe("C:/test");
    expect(p.id).toBeTruthy();
    expect(p.addedAt).toBeGreaterThan(0);
    expect(p.lastUsedAt).toBeGreaterThan(0);
  });

  it("should deduplicate by normalized path", () => {
    const p1 = addProject("C:/Test", "A");
    vi.advanceTimersByTime(10);
    const p2 = addProject("c:/test", "B");
    const all = listProjects();
    expect(all.length).toBe(1);
    expect(all[0].lastUsedAt).toBe(p2.lastUsedAt);
  });

  it("should list projects sorted by lastUsedAt desc", () => {
    const p1 = addProject("C:/old", "Old");
    vi.advanceTimersByTime(10);
    const p2 = addProject("C:/new", "New");
    vi.advanceTimersByTime(10);
    touchProjectLastUsed(p1.id);
    const all = listProjects();
    expect(all[0].id).toBe(p1.id);
    expect(all[1].id).toBe(p2.id);
  });

  it("should get project by id", () => {
    const p = addProject("C:/test", "Test");
    const found = getProject(p.id);
    expect(found?.id).toBe(p.id);
    expect(found?.name).toBe("Test");
  });

  it("should return undefined for unknown id", () => {
    expect(getProject("unknown")).toBeUndefined();
  });

  it("should rename project", () => {
    const p = addProject("C:/test", "Old");
    renameProject(p.id, "New");
    const found = getProject(p.id);
    expect(found?.name).toBe("New");
  });

  it("should remove project", () => {
    const p = addProject("C:/test", "Test");
    removeProject(p.id);
    expect(getProject(p.id)).toBeUndefined();
    expect(listProjects()).toEqual([]);
  });

  it("should touch lastUsedAt", () => {
    const p = addProject("C:/test", "Test");
    const before = p.lastUsedAt;
    vi.advanceTimersByTime(100);
    touchProjectLastUsed(p.id);
    const after = getProject(p.id)?.lastUsedAt ?? 0;
    expect(after).toBeGreaterThan(before);
  });
});
