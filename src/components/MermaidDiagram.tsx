"use client";

import mermaid from "mermaid";
import { useEffect, useId, useRef } from "react";

mermaid.initialize({
  startOnLoad: false,
  theme: "dark",
  themeVariables: {
    primaryColor: "#242734",
    primaryTextColor: "#e0e0e0",
    primaryBorderColor: "#63b3ed",
    lineColor: "#a0aec0",
    secondaryColor: "#1a1d27",
    tertiaryColor: "#0f1117",
  },
});

interface MermaidDiagramProps {
  chart: string;
}

export default function MermaidDiagram({ chart }: MermaidDiagramProps) {
  const ref = useRef<HTMLDivElement>(null);
  const id = useId().replace(/:/g, "-");

  useEffect(() => {
    if (!ref.current) return;

    const renderDiagram = async () => {
      try {
        const { svg } = await mermaid.render(`mermaid-${id}`, chart);
        if (ref.current) {
          ref.current.innerHTML = svg;
        }
      } catch {
        if (ref.current) {
          ref.current.textContent = chart;
        }
      }
    };

    renderDiagram();
  }, [chart, id]);

  return (
    <div className="my-6 p-4 bg-[var(--bg-tertiary)] rounded-xl border border-white/[0.08] overflow-x-auto">
      <div ref={ref} className="mermaid flex justify-center">
        {chart}
      </div>
    </div>
  );
}
