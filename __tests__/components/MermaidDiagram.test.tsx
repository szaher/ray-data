import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import MermaidDiagram from "@/components/MermaidDiagram";

vi.mock("mermaid", () => ({
  default: {
    initialize: vi.fn(),
    run: vi.fn(),
    render: vi.fn().mockResolvedValue({ svg: "<svg>mock</svg>" }),
  },
}));

describe("MermaidDiagram", () => {
  it("renders a container with the chart code", () => {
    const chart = "graph TD; A-->B;";
    render(<MermaidDiagram chart={chart} />);
    const container = document.querySelector(".mermaid");
    expect(container).toBeDefined();
    expect(container?.textContent).toContain("graph TD");
  });
});
