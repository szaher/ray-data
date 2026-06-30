import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import MermaidDiagram from "@/components/MermaidDiagram";

const mockRender = vi.fn().mockResolvedValue({ svg: "<svg>mock</svg>" });

vi.mock("mermaid", () => ({
  default: {
    initialize: vi.fn(),
    run: vi.fn(),
    render: (...args: unknown[]) => mockRender(...args),
  },
}));

describe("MermaidDiagram", () => {
  beforeEach(() => {
    mockRender.mockResolvedValue({ svg: "<svg>mock</svg>" });
  });

  afterEach(() => {
    cleanup();
  });

  it("renders a container with the chart code", () => {
    const chart = "graph TD; A-->B;";
    const { container } = render(<MermaidDiagram chart={chart} />);
    const el = container.querySelector(".mermaid");
    expect(el).not.toBeNull();
    expect(el?.textContent).toContain("graph TD");
  });

  it("uses default accessible label when no fallback is provided", async () => {
    const { container } = render(
      <MermaidDiagram chart="graph LR; A-->B;" />,
    );
    await waitFor(() => {
      const imgContainer = container.querySelector("[role='img']");
      expect(imgContainer).not.toBeNull();
      expect(imgContainer!.getAttribute("aria-label")).toBe("Mermaid diagram");
    });
  });

  it("uses fallback as accessible label when provided", async () => {
    const { container } = render(
      <MermaidDiagram
        chart="graph LR; A-->B;"
        fallback="Data flows from source to sink"
      />,
    );
    await waitFor(() => {
      const imgContainer = container.querySelector("[role='img']");
      expect(imgContainer).not.toBeNull();
      expect(imgContainer!.getAttribute("aria-label")).toBe(
        "Data flows from source to sink",
      );
    });
  });

  it("hides SVG from assistive technology with aria-hidden", async () => {
    const { container } = render(
      <MermaidDiagram chart="graph LR; A-->B;" />,
    );
    await waitFor(() => {
      const imgContainer = container.querySelector("[role='img']");
      expect(imgContainer).not.toBeNull();
      const svgContainer = imgContainer!.querySelector("[aria-hidden='true']");
      expect(svgContainer).not.toBeNull();
    });
  });

  it("shows fallback text in loading state", () => {
    mockRender.mockReturnValue(new Promise(() => {}));
    render(
      <MermaidDiagram chart="graph LR; A-->B;" fallback="Loading fallback" />,
    );
    expect(screen.getByText("Loading fallback")).toBeDefined();
  });

  it("shows fallback text on render failure", async () => {
    mockRender.mockRejectedValue(new Error("parse error"));
    render(
      <MermaidDiagram chart="graph LR; A-->B;" fallback="Error fallback" />,
    );
    await waitFor(() => {
      expect(screen.getByText("Error fallback")).toBeDefined();
    });
  });
});
