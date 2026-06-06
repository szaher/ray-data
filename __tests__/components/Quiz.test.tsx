import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Quiz from "@/components/Quiz";
import type { QuizQuestion } from "@/types";

const questions: QuizQuestion[] = [
  {
    question: "What does GIL stand for?",
    options: ["Global Interpreter Lock", "General Input Layer", "Graphics Interface Library"],
    correctIndex: 0,
    explanation: "The GIL is Python's Global Interpreter Lock.",
  },
];

describe("Quiz", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders the question", () => {
    render(<Quiz questions={questions} onComplete={vi.fn()} />);
    expect(screen.getByText("What does GIL stand for?")).toBeDefined();
  });

  it("shows all options", () => {
    render(<Quiz questions={questions} onComplete={vi.fn()} />);
    expect(screen.getByText("Global Interpreter Lock")).toBeDefined();
    expect(screen.getByText("General Input Layer")).toBeDefined();
  });

  it("calls onComplete with score after answering", () => {
    const onComplete = vi.fn();
    render(<Quiz questions={questions} onComplete={onComplete} />);
    fireEvent.click(screen.getByText("Global Interpreter Lock"));
    fireEvent.click(screen.getByText("Submit"));
    expect(onComplete).toHaveBeenCalledWith(1);
  });
});
