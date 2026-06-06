"use client";

import { useRouter } from "next/navigation";
import type { LessonMeta, ModuleMeta, QuizQuestion } from "@/types";
import { markLessonComplete } from "@/lib/progress";
import Quiz from "./Quiz";

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

  const handleQuizComplete = (score: number) => {
    markLessonComplete(mod.id, lesson.slug, score);
  };

  const handleNext = () => {
    markLessonComplete(mod.id, lesson.slug);
    if (nextHref) router.push(nextHref);
  };

  return (
    <div className="max-w-3xl mx-auto px-8 py-10">
      <div className="mb-6">
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: mod.color }}>
          Module {mod.id}: {mod.title}
        </span>
        <h1 className="text-2xl font-bold mt-1">{lesson.title}</h1>
        <p className="text-[var(--text-secondary)] text-sm mt-1">{lesson.description}</p>
        <div className="flex items-center gap-3 mt-2 text-xs text-[var(--text-secondary)]">
          <span>~{lesson.estimatedMinutes} min read</span>
          {lesson.hasCode && <span>Includes code</span>}
        </div>
      </div>

      <div className="prose prose-invert max-w-none">{children}</div>

      {quiz && quiz.length > 0 && (
        <div className="mt-10">
          <h2 className="text-lg font-semibold mb-4">Check Your Understanding</h2>
          <Quiz questions={quiz} onComplete={handleQuizComplete} />
        </div>
      )}

      <div className="flex items-center justify-between mt-12 pt-6 border-t border-white/[0.08]">
        {prevHref ? (
          <a href={prevHref} className="text-sm text-[var(--accent-blue)] hover:underline">
            ← Previous
          </a>
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

      <div className="mt-8 p-4 rounded-xl bg-[var(--bg-secondary)] border border-white/[0.08]">
        <a
          href={`/chat?context=${mod.id}:${lesson.slug}`}
          className="flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-[var(--accent-blue)] transition-colors"
        >
          <span>💬</span>
          <span>Ask about this lesson...</span>
        </a>
      </div>
    </div>
  );
}
