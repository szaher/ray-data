import { storageKeys } from "../../academy.config";

function noteKey(moduleId: number, lessonSlug: string): string {
  return `${moduleId}:${lessonSlug}`;
}

function getAllNotes(): Record<string, string> {
  if (typeof localStorage === "undefined") return {};
  const raw = localStorage.getItem(storageKeys.notes);
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function saveAllNotes(notes: Record<string, string>): void {
  localStorage.setItem(storageKeys.notes, JSON.stringify(notes));
}

export function getLessonNote(moduleId: number, lessonSlug: string): string {
  return getAllNotes()[noteKey(moduleId, lessonSlug)] || "";
}

export function saveLessonNote(moduleId: number, lessonSlug: string, text: string): void {
  const notes = getAllNotes();
  const key = noteKey(moduleId, lessonSlug);
  if (text.trim()) {
    notes[key] = text;
  } else {
    delete notes[key];
  }
  saveAllNotes(notes);
}
