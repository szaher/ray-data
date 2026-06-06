import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getProgress, markLessonComplete, getLessonProgress, getModuleProgress, resetProgress } from "@/lib/progress";

const mockStorage: Record<string, string> = {};

beforeEach(() => {
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => mockStorage[key] ?? null,
    setItem: (key: string, value: string) => { mockStorage[key] = value; },
    removeItem: (key: string) => { delete mockStorage[key]; },
  });
});

afterEach(() => {
  Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
  vi.restoreAllMocks();
});

describe("getProgress", () => {
  it("returns default state when empty", () => {
    const progress = getProgress();
    expect(progress.currentModule).toBe(1);
    expect(progress.currentLesson).toBe(1);
    expect(Object.keys(progress.lessons)).toHaveLength(0);
  });
});

describe("markLessonComplete", () => {
  it("marks a lesson as completed", () => {
    markLessonComplete(1, "01-why-distributed");
    const lp = getLessonProgress(1, "01-why-distributed");
    expect(lp?.completed).toBe(true);
    expect(lp?.completedAt).toBeDefined();
  });

  it("records quiz score", () => {
    markLessonComplete(1, "01-why-distributed", 3);
    const lp = getLessonProgress(1, "01-why-distributed");
    expect(lp?.quizScore).toBe(3);
  });
});

describe("getModuleProgress", () => {
  it("returns 0 for untouched module", () => {
    expect(getModuleProgress(1, 4)).toBe(0);
  });

  it("returns fraction of completed lessons", () => {
    markLessonComplete(1, "01-why-distributed");
    markLessonComplete(1, "02-gil-problem");
    expect(getModuleProgress(1, 4)).toBe(0.5);
  });
});

describe("resetProgress", () => {
  it("clears all progress", () => {
    markLessonComplete(1, "01-why-distributed");
    resetProgress();
    const progress = getProgress();
    expect(Object.keys(progress.lessons)).toHaveLength(0);
  });
});
