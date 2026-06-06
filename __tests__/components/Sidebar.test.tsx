import { render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Sidebar from "@/components/Sidebar";
import type { CurriculumData } from "@/types";

vi.mock("next/navigation", () => ({
  usePathname: () => "/lesson/1/01-why-distributed",
  useRouter: () => ({ push: vi.fn() }),
}));

const mockCurriculum: CurriculumData = {
  modules: [
    {
      id: 1,
      title: "Foundations",
      description: "Test",
      color: "#68d391",
      lessons: [
        { slug: "01-why-distributed", title: "Why Distributed?", description: "", estimatedMinutes: 10, diagramTypes: [], hasCode: false, hasQuiz: true },
        { slug: "02-gil", title: "GIL Problem", description: "", estimatedMinutes: 10, diagramTypes: [], hasCode: false, hasQuiz: true },
      ],
    },
  ],
};

describe("Sidebar", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders module titles", () => {
    render(<Sidebar curriculum={mockCurriculum} />);
    expect(screen.getByText("Foundations")).toBeDefined();
  });

  it("renders lesson titles", () => {
    render(<Sidebar curriculum={mockCurriculum} />);
    expect(screen.getByText("Why Distributed?")).toBeDefined();
  });
});
