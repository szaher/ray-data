"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getLessonNote, saveLessonNote } from "@/lib/notes";

interface NotesPanelProps {
  moduleId: number;
  lessonSlug: string;
  isOpen: boolean;
  onClose: () => void;
  onNoteChange?: (hasNotes: boolean) => void;
}

export default function NotesPanel({
  moduleId,
  lessonSlug,
  isOpen,
  onClose,
  onNoteChange,
}: NotesPanelProps) {
  const [text, setText] = useState("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setText(getLessonNote(moduleId, lessonSlug));
  }, [moduleId, lessonSlug]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => textareaRef.current?.focus(), 200);
    }
  }, [isOpen]);

  const handleChange = useCallback(
    (value: string) => {
      setText(value);
      onNoteChange?.(value.trim().length > 0);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        saveLessonNote(moduleId, lessonSlug, value);
      }, 500);
    },
    [moduleId, lessonSlug, onNoteChange]
  );

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <div
        className={`
          fixed right-0 top-0 h-full z-50
          lg:relative lg:z-auto lg:h-auto
          bg-[var(--bg-secondary)] border-l border-[var(--border)]
          flex flex-col
          transition-all duration-200 ease-out
          ${isOpen ? "w-80 translate-x-0" : "w-0 translate-x-full lg:translate-x-0 overflow-hidden"}
        `}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] shrink-0">
          <div className="flex items-center gap-2">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-[var(--accent-blue)]"
            >
              <path d="M12 20h9" />
              <path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z" />
            </svg>
            <span className="text-sm font-medium text-[var(--text-primary)]">
              Notes
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--text-secondary)]">
              {text.length > 0 ? `${text.length} chars` : ""}
            </span>
            <button
              onClick={onClose}
              className="p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
          </div>
        </div>

        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="Take notes on this lesson..."
          className="flex-1 w-full resize-none bg-transparent p-4 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] outline-none"
        />
      </div>
    </>
  );
}
