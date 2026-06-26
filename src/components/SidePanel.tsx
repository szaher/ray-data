"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getLessonNote, saveLessonNote } from "@/lib/notes";

export type SidePanelTab = "notes" | "voice";

interface SidePanelProps {
  isOpen: boolean;
  activeTab: SidePanelTab;
  onTabChange: (tab: SidePanelTab) => void;
  onClose: () => void;
  moduleId: number;
  lessonSlug: string;
  onNoteChange?: (hasNotes: boolean) => void;
  voices: SpeechSynthesisVoice[];
  selectedVoiceURI: string | null;
  onSelectVoice: (voiceURI: string) => void;
  speed: number;
  onCycleSpeed: () => void;
  isPlaying: boolean;
  isSpeechSupported: boolean;
  contentLang: string;
}

const TABS: Array<{ id: SidePanelTab; label: string }> = [
  { id: "notes", label: "Notes" },
  { id: "voice", label: "Voice" },
];

export default function SidePanel({
  isOpen,
  activeTab,
  onTabChange,
  onClose,
  moduleId,
  lessonSlug,
  onNoteChange,
  voices,
  selectedVoiceURI,
  onSelectVoice,
  speed,
  onCycleSpeed,
  isPlaying,
  isSpeechSupported,
  contentLang,
}: SidePanelProps) {
  // ── Notes state ──────────────────────────────────────────────

  const [noteText, setNoteText] = useState("");
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const focusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    queueMicrotask(() => {
      setNoteText(getLessonNote(moduleId, lessonSlug));
    });
  }, [moduleId, lessonSlug]);

  useEffect(() => {
    if (isOpen && activeTab === "notes") {
      focusTimerRef.current = setTimeout(
        () => textareaRef.current?.focus(),
        200,
      );
    }
    return () => {
      if (focusTimerRef.current) clearTimeout(focusTimerRef.current);
    };
  }, [isOpen, activeTab]);

  const handleNoteChange = useCallback(
    (value: string) => {
      setNoteText(value);
      onNoteChange?.(value.trim().length > 0);
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        saveLessonNote(moduleId, lessonSlug, value);
      }, 500);
    },
    [moduleId, lessonSlug, onNoteChange],
  );

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (focusTimerRef.current) clearTimeout(focusTimerRef.current);
    };
  }, []);

  // ── Escape to close ──────────────────────────────────────────

  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // ── Render ───────────────────────────────────────────────────

  const notesTabId = "sidepanel-tab-notes";
  const voiceTabId = "sidepanel-tab-voice";
  const notesPanelId = "sidepanel-panel-notes";
  const voicePanelId = "sidepanel-panel-voice";

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        ref={panelRef}
        className={`
          fixed right-0 top-0 h-full z-50
          lg:relative lg:z-auto lg:h-auto
          bg-[var(--bg-secondary)] border-l border-[var(--border)]
          flex flex-col
          transition-all duration-200 ease-out
          ${isOpen ? "w-[min(20rem,calc(100vw-1rem))] translate-x-0" : "w-0 translate-x-full lg:translate-x-0 overflow-hidden"}
        `}
      >
        {/* Tab bar + close */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border)] shrink-0">
          <div role="tablist" className="flex gap-1">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                id={tab.id === "notes" ? notesTabId : voiceTabId}
                role="tab"
                aria-selected={activeTab === tab.id}
                aria-controls={
                  tab.id === "notes" ? notesPanelId : voicePanelId
                }
                onClick={() => onTabChange(tab.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  activeTab === tab.id
                    ? "text-[var(--accent-blue)] bg-[var(--accent-blue)]/10"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/[0.04]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <button
            onClick={onClose}
            className="p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            aria-label="Close panel"
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

        {/* Notes tab panel */}
        <div
          id={notesPanelId}
          role="tabpanel"
          aria-labelledby={notesTabId}
          className={`flex-1 flex flex-col min-h-0 ${activeTab === "notes" ? "" : "hidden"}`}
        >
          <textarea
            ref={textareaRef}
            value={noteText}
            onChange={(e) => handleNoteChange(e.target.value)}
            placeholder="Take notes on this lesson..."
            className="flex-1 w-full resize-none bg-transparent p-4 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] outline-none"
          />
          {noteText.length > 0 && (
            <div className="px-4 py-2 text-xs text-[var(--text-secondary)] border-t border-[var(--border)]">
              {noteText.length} chars
            </div>
          )}
        </div>

        {/* Voice tab panel */}
        <div
          id={voicePanelId}
          role="tabpanel"
          aria-labelledby={voiceTabId}
          className={`flex-1 overflow-y-auto ${activeTab === "voice" ? "" : "hidden"}`}
        >
          {!isSpeechSupported ? (
            <div className="p-4 text-sm text-[var(--text-secondary)]">
              Narration is unavailable in this browser.
            </div>
          ) : (
            <div className="p-4 space-y-5">
              {/* Voice selector */}
              <div>
                <label
                  htmlFor="voice-select"
                  className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5"
                >
                  Voice
                </label>
                <select
                  id="voice-select"
                  value={selectedVoiceURI ?? ""}
                  onChange={(e) => onSelectVoice(e.target.value)}
                  disabled={isPlaying}
                  aria-label="Narration voice"
                  className="w-full px-2.5 py-1.5 rounded-md text-sm text-[var(--text-primary)] bg-[var(--bg-primary)] border border-[var(--border)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="">Default voice</option>
                  {voices.map((v) => (
                    <option key={v.voiceURI} value={v.voiceURI}>
                      {v.name} ({v.lang})
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-[var(--text-secondary)]">
                  Showing {contentLang.toUpperCase()} voices for this content.
                </p>
              </div>

              {/* Speed control */}
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                  Speed
                </label>
                <button
                  onClick={onCycleSpeed}
                  className="px-3 py-1.5 rounded-md text-sm font-mono text-[var(--text-primary)] bg-[var(--bg-primary)] border border-[var(--border)] hover:border-[var(--accent-blue)] transition-colors"
                >
                  {speed}x
                </button>
                <p className="mt-1 text-xs text-[var(--text-secondary)]">
                  Cycle through 0.75x, 1x, 1.25x, 1.5x.
                </p>
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
