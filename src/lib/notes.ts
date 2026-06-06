const STORAGE_KEY = "ray-data-academy-notes";

function noteKey(moduleId: number, lessonSlug: string): string {
  return `${moduleId}:${lessonSlug}`;
}

function getAllNotes(): Record<string, string> {
  if (typeof localStorage === "undefined") return {};
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : {};
}

function saveAllNotes(notes: Record<string, string>): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
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
