"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { LessonMeta, ModuleMeta, QuizQuestion } from "@/types";
import { markLessonComplete } from "@/lib/progress";
import { getLessonNote } from "@/lib/notes";
import { extractSections, type SpeechSection } from "@/lib/speech";
import { useSpeechSynthesis } from "@/hooks/useSpeechSynthesis";
import { useVoices } from "@/hooks/useVoices";
import Quiz from "./Quiz";
import SidePanel, { type SidePanelTab } from "./SidePanel";
import VoiceControls from "./VoiceControls";

interface LessonContentProps {
  module: ModuleMeta;
  lesson: LessonMeta;
  children: React.ReactNode;
  quiz?: QuizQuestion[];
  prevHref?: string;
  nextHref?: string;
}

export default function LessonContent({
  module: mod,
  lesson,
  children,
  quiz,
  prevHref,
  nextHref,
}: LessonContentProps) {
  const router = useRouter();
  const contentRef = useRef<HTMLDivElement>(null);

  const [panelOpen, setPanelOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<SidePanelTab>("notes");
  const [hasNotes, setHasNotes] = useState(false);
  const [sections, setSections] = useState<SpeechSection[]>([]);
  const voiceState = useVoices();

  const speech = useSpeechSynthesis({
    voice: voiceState.selectedVoice,
    onSectionChange: (index) => {
      const section = sections[index];
      if (section?.headingElement && section.headingElement !== contentRef.current) {
        section.headingElement.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    },
  });

  const openPanelTab = useCallback((tab: SidePanelTab) => {
    if (panelOpen && activeTab === tab) {
      setPanelOpen(false);
      return;
    }
    setActiveTab(tab);
    setPanelOpen(true);
  }, [panelOpen, activeTab]);

  useEffect(() => {
    queueMicrotask(() => {
      setHasNotes(getLessonNote(mod.id, lesson.slug).length > 0);
    });
  }, [mod.id, lesson.slug]);

  useEffect(() => {
    if (!contentRef.current) return;
    const timer = setTimeout(() => {
      if (contentRef.current) {
        const container = contentRef.current;
        setSections(extractSections(container).filter((section) => section.headingElement !== container));
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [children]);

  useEffect(() => {
    if (!contentRef.current) return;
    contentRef.current.querySelectorAll(".tts-active-section").forEach((el) => {
      el.classList.remove("tts-active-section");
    });

    if (speech.isPlaying && speech.currentSectionIndex >= 0 && sections[speech.currentSectionIndex]) {
      const heading = sections[speech.currentSectionIndex].headingElement;
      if (heading === contentRef.current) return;

      heading.classList.add("tts-active-section");
      let sibling = heading.nextElementSibling;
      while (sibling) {
        if (sibling.tagName === "H2" || sibling.tagName === "H3") break;
        sibling.classList.add("tts-active-section");
        sibling = sibling.nextElementSibling;
      }
    }
  }, [speech.isPlaying, speech.currentSectionIndex, sections]);

  const handleQuizComplete = (score: number) => {
    markLessonComplete(mod.id, lesson.slug, score);
  };

  const handleNext = () => {
    markLessonComplete(mod.id, lesson.slug);
    if (nextHref) router.push(nextHref);
  };

  const handlePlayAll = useCallback(() => {
    if (sections.length > 0) speech.playAll(sections);
  }, [sections, speech]);

  const handlePlaySection = useCallback(
    (index: number) => {
      if (sections[index]) speech.playSection(sections, index);
    },
    [sections, speech],
  );

  return (
    <div className="flex flex-1 min-h-0">
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-8 py-10">
          <div className="mb-6">
            <span
              className="text-xs font-semibold uppercase tracking-wider"
              style={{ color: mod.color }}
            >
              Module {mod.id}: {mod.title}
            </span>
            <h1 className="text-2xl font-bold mt-1">{lesson.title}</h1>
            <p className="text-[var(--text-secondary)] text-sm mt-1">
              {lesson.description}
            </p>
            <div className="flex items-center gap-3 mt-2 text-xs text-[var(--text-secondary)]">
              <span>~{lesson.estimatedMinutes} min read</span>
              {lesson.hasCode && <span>Includes code</span>}
            </div>
          </div>

          <div className="flex items-center justify-between mb-4 pb-3 border-b border-[var(--border)]">
            <VoiceControls
              isPlaying={speech.isPlaying}
              isPaused={speech.isPaused}
              isSupported={speech.isSupported}
              speed={speech.speed}
              currentSectionIndex={speech.currentSectionIndex}
              totalSections={sections.length}
              onPlayAll={handlePlayAll}
              onPause={speech.pause}
              onResume={speech.resume}
              onStop={speech.stop}
              onCycleSpeed={speech.cycleSpeed}
            />

            <div className="flex items-center gap-1">
              {/* Notes toggle */}
              <button
                onClick={() => openPanelTab("notes")}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm transition-colors ${
                  panelOpen && activeTab === "notes"
                    ? "text-[var(--accent-blue)] bg-[var(--accent-blue)]/10"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/[0.04]"
                }`}
                title="Notes"
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
                  <path d="M12 20h9" />
                  <path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z" />
                </svg>
                <span>Notes</span>
                {hasNotes && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-green)]" />
                )}
              </button>

              {/* Voice settings toggle */}
              {speech.isSupported && (
                <button
                  onClick={() => openPanelTab("voice")}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm transition-colors ${
                    panelOpen && activeTab === "voice"
                      ? "text-[var(--accent-blue)] bg-[var(--accent-blue)]/10"
                      : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/[0.04]"
                  }`}
                  title="Voice settings"
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
                    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          <div ref={contentRef} className="prose max-w-none relative">
            {children}

            {sections.map((section, i) => (
                <button
                  key={section.id}
                  onClick={() => handlePlaySection(i)}
                  className={`section-play-btn absolute -left-8 w-5 h-5 flex items-center justify-center rounded-full transition-colors ${
                    speech.isPlaying && speech.currentSectionIndex === i
                      ? "text-[var(--accent-blue)] bg-[var(--accent-blue)]/20"
                      : "text-[var(--text-secondary)] opacity-0 hover:opacity-100 hover:text-[var(--accent-blue)]"
                  }`}
                  style={{
                    top: section.headingElement.offsetTop + 2,
                  }}
                  title={`Read: ${section.heading}`}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                    <polygon points="6,4 20,12 6,20" />
                  </svg>
                </button>
            ))}
          </div>

          {quiz && quiz.length > 0 && (
            <div className="mt-10">
              <h2 className="text-lg font-semibold mb-4">
                Check Your Understanding
              </h2>
              <Quiz questions={quiz} onComplete={handleQuizComplete} />
            </div>
          )}

          <div className="flex items-center justify-between mt-12 pt-6 border-t border-[var(--border)]">
            {prevHref ? (
              <button
                onClick={() => router.push(prevHref)}
                className="text-sm text-[var(--accent-blue)] hover:underline"
              >
                ← Previous
              </button>
            ) : (
              <div />
            )}
            {nextHref ? (
              <button
                onClick={handleNext}
                className="px-5 py-2 text-sm rounded-lg bg-[var(--accent-blue)] text-white hover:opacity-90 transition-opacity"
              >
                Next →
              </button>
            ) : (
              <div />
            )}
          </div>

          <div className="mt-8 p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)]">
            <a
              href={`/chat?context=${mod.id}:${lesson.slug}`}
              className="flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-[var(--accent-blue)] transition-colors"
            >
              <span>💬</span>
              <span>Ask about this lesson...</span>
            </a>
          </div>
        </div>
      </div>

      <SidePanel
        isOpen={panelOpen}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onClose={() => setPanelOpen(false)}
        moduleId={mod.id}
        lessonSlug={lesson.slug}
        onNoteChange={setHasNotes}
        voices={voiceState.voices.map((v) => v.voice)}
        selectedVoiceURI={voiceState.selectedVoiceURI}
        onSelectVoice={voiceState.selectVoice}
        speed={speech.speed}
        onCycleSpeed={speech.cycleSpeed}
        isPlaying={speech.isPlaying}
        isSpeechSupported={speech.isSupported}
        contentLang={voiceState.contentLang}
      />
    </div>
  );
}
