import { describe, it, expect } from "vitest";

const DIAGRAM_REGEX = /<(?:Diagram|MermaidDiagram)\b/g;

function findAll(re: RegExp, text: string) {
  const matches: RegExpExecArray[] = [];
  let m: RegExpExecArray | null;
  const copy = new RegExp(re.source, re.flags);
  while ((m = copy.exec(text)) !== null) matches.push(m);
  return matches;
}

function checkDiagramFallback(body: string): string[] {
  const errors: string[] = [];
  for (const match of findAll(DIAGRAM_REGEX, body)) {
    const nextComponent = body.slice(match.index + 1).search(/\n\s*<[A-Z/]/);
    const end =
      nextComponent === -1 ? body.length : match.index + 1 + nextComponent;
    const componentSource = body.slice(match.index, end);
    if (!/\sfallback=/.test(componentSource)) {
      errors.push("Diagram is missing fallback text.");
    }
  }
  return errors;
}

describe("diagram fallback validation", () => {
  it("flags MermaidDiagram without fallback", () => {
    const body = '<MermaidDiagram chart={`graph LR\nA --> B`} />';
    expect(checkDiagramFallback(body)).toEqual([
      "Diagram is missing fallback text.",
    ]);
  });

  it("flags Diagram without fallback", () => {
    const body = "<Diagram chart={`graph LR`} />";
    expect(checkDiagramFallback(body)).toEqual([
      "Diagram is missing fallback text.",
    ]);
  });

  it("passes MermaidDiagram with fallback", () => {
    const body =
      '<MermaidDiagram chart={`graph LR`} fallback="A flows to B" />';
    expect(checkDiagramFallback(body)).toEqual([]);
  });

  it("passes Diagram with fallback", () => {
    const body = '<Diagram chart={`graph LR`} fallback="A flows to B" />';
    expect(checkDiagramFallback(body)).toEqual([]);
  });

  it("does not flag non-diagram components", () => {
    const body = "<CodeBlock code={`print(1)`} />";
    expect(checkDiagramFallback(body)).toEqual([]);
  });

  it("flags multiple diagrams independently", () => {
    const body = [
      '<MermaidDiagram chart={`graph LR`} fallback="ok" />',
      '<MermaidDiagram chart={`graph TD`} />',
    ].join("\n");
    expect(checkDiagramFallback(body)).toEqual([
      "Diagram is missing fallback text.",
    ]);
  });
});
