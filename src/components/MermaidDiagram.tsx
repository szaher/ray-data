"use client";

import React, { useEffect, useId, useRef, useState } from "react";

let mermaidMod: any = null;
let mermaidReady: Promise<void> | null = null;

function loadMermaid() {
  if (!mermaidReady) {
    mermaidReady = import("mermaid").then((mod) => {
      mermaidMod = mod;
      mod.default.initialize({
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
    });
  }
  return mermaidReady;
}

interface MermaidDiagramProps {
  chart?: string;
  children?: React.ReactNode;
}

function extractText(node: React.ReactNode): string {
  if (typeof node === "string") return node;
  if (Array.isArray(node)) return node.map(extractText).join("");
  if (node && typeof node === "object" && "props" in node) {
    return extractText((node as any).props.children);
  }
  return "";
}

export default function MermaidDiagram({ chart, children }: MermaidDiagramProps) {
  const chartText = chart || extractText(children) || "";
  const id = useId().replace(/:/g, "-");
  const [svgHtml, setSvgHtml] = useState<string | null>(null);

  useEffect(() => {
    if (!chartText) return;
    let cancelled = false;

    const renderDiagram = async () => {
      try {
        await loadMermaid();
        const { svg } = await mermaidMod.default.render(`mermaid-${id}`, chartText);
        if (!cancelled) setSvgHtml(svg);
      } catch {
        if (!cancelled) setSvgHtml(`<pre>${chartText}</pre>`);
      }
    };

    renderDiagram();
    return () => { cancelled = true; };
  }, [chartText, id]);

  return (
    <div className="my-6 p-4 bg-[var(--bg-tertiary)] rounded-xl border border-[var(--border)] overflow-x-auto">
      {svgHtml ? (
        <div className="mermaid flex justify-center" dangerouslySetInnerHTML={{ __html: svgHtml }} />
      ) : (
        <div className="mermaid flex justify-center">
          <span className="text-sm text-[var(--text-secondary)]">Loading diagram...</span>
        </div>
      )}
    </div>
  );
}
