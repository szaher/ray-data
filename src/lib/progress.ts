import type { LessonProgress, ProgressState } from "@/types";

const STORAGE_KEY = "ray-data-academy-progress";

const DEFAULT_STATE: ProgressState = {
  lessons: {},
  currentModule: 1,
  currentLesson: 1,
};

function lessonKey(moduleId: number, lessonSlug: string): string {
  return `${moduleId}:${lessonSlug}`;
}

export function getProgress(): ProgressState {
  if (typeof localStorage === "undefined") return { ...DEFAULT_STATE };
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return { ...DEFAULT_STATE, lessons: {} };
  return JSON.parse(raw) as ProgressState;
}

function saveProgress(state: ProgressState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function markLessonComplete(moduleId: number, lessonSlug: string, quizScore?: number): void {
  const state = getProgress();
  const key = lessonKey(moduleId, lessonSlug);
  state.lessons[key] = {
    completed: true,
    quizScore,
    completedAt: new Date().toISOString(),
  };
  saveProgress(state);
}

export function getLessonProgress(moduleId: number, lessonSlug: string): LessonProgress | undefined {
  const state = getProgress();
  return state.lessons[lessonKey(moduleId, lessonSlug)];
}

export function getModuleProgress(moduleId: number, totalLessons: number): number {
  if (totalLessons === 0) return 0;
  const state = getProgress();
  const prefix = `${moduleId}:`;
  const completed = Object.entries(state.lessons).filter(
    ([k, v]) => k.startsWith(prefix) && v.completed
  ).length;
  return completed / totalLessons;
}

export function setCurrentPosition(moduleId: number, lessonIndex: number): void {
  const state = getProgress();
  state.currentModule = moduleId;
  state.currentLesson = lessonIndex;
  saveProgress(state);
}

export function resetProgress(): void {
  saveProgress({ ...DEFAULT_STATE, lessons: {} });
}
