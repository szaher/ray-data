"use client";

import { useState } from "react";
import type { QuizQuestion } from "@/types";

interface QuizProps {
  questions: QuizQuestion[];
  onComplete: (score: number) => void;
}

export default function Quiz({ questions, onComplete }: QuizProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);

  const q = questions[currentIndex];

  const handleSubmit = () => {
    if (selected === null) return;
    const isCorrect = selected === q.correctIndex;
    const newScore = score + (isCorrect ? 1 : 0);
    setScore(newScore);
    setSubmitted(true);

    if (currentIndex === questions.length - 1) {
      setFinished(true);
      onComplete(newScore);
    }
  };

  const handleNext = () => {
    setCurrentIndex((i) => i + 1);
    setSelected(null);
    setSubmitted(false);
  };

  if (finished) {
    return (
      <div className="my-6 p-6 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)]">
        <h3 className="text-lg font-semibold mb-2">Quiz Complete</h3>
        <p className="text-[var(--text-secondary)]">
          You got {score} out of {questions.length} correct.
        </p>
      </div>
    );
  }

  return (
    <div className="my-6 p-6 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)]">
      <div className="text-xs text-[var(--text-secondary)] mb-3">
        Question {currentIndex + 1} of {questions.length}
      </div>
      <h3 className="text-base font-medium mb-4">{q.question}</h3>

      <div className="space-y-2 mb-4">
        {q.options.map((opt, i) => {
          let style = "border-[var(--border)] hover:border-[var(--border-hover)]";
          if (submitted && i === q.correctIndex) {
            style = "border-[var(--accent-green)] bg-[var(--accent-green)]/10";
          } else if (submitted && i === selected && i !== q.correctIndex) {
            style = "border-[var(--accent-red)] bg-[var(--accent-red)]/10";
          } else if (!submitted && i === selected) {
            style = "border-[var(--accent-blue)] bg-[var(--accent-blue)]/10";
          }

          return (
            <button
              key={i}
              onClick={() => !submitted && setSelected(i)}
              className={`w-full text-left px-4 py-2.5 rounded-lg border text-sm transition-colors ${style}`}
              disabled={submitted}
            >
              {opt}
            </button>
          );
        })}
      </div>

      {submitted && (
        <p className="text-sm text-[var(--text-secondary)] mb-4 p-3 rounded-lg bg-[var(--bg-tertiary)]">
          {q.explanation}
        </p>
      )}

      <div className="flex justify-end">
        {!submitted ? (
          <button
            onClick={handleSubmit}
            disabled={selected === null}
            className="px-4 py-2 text-sm rounded-lg bg-[var(--accent-blue)] text-white disabled:opacity-40 hover:opacity-90 transition-opacity"
          >
            Submit
          </button>
        ) : currentIndex < questions.length - 1 ? (
          <button
            onClick={handleNext}
            className="px-4 py-2 text-sm rounded-lg bg-[var(--accent-blue)] text-white hover:opacity-90 transition-opacity"
          >
            Next
          </button>
        ) : null}
      </div>
    </div>
  );
}
