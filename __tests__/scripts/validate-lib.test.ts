import { describe, it, expect } from "vitest";
import {
  parseFrontmatter,
  checkFrontmatter,
  checkDiagramFallback,
  stripCodeBlocks,
  extractLinks,
  classifyLink,
  classifyExternalUrl,
  isPrivateAddress,
  detectLinkIssues,
  checkRiskyClaimPatterns,
  checkDuplicateParagraphs,
} from "../../scripts/validate-lib.mjs";

describe("parseFrontmatter", () => {
  it("parses valid YAML frontmatter", () => {
    const raw = '---\ntitle: "Hello"\ndescription: "World"\n---\nBody';
    const result = parseFrontmatter(raw);
    expect(result.data.title).toBe("Hello");
    expect(result.data.description).toBe("World");
    expect(result.content.trim()).toBe("Body");
    expect(result.error).toBeNull();
  });

  it("returns empty data for files without frontmatter", () => {
    const raw = "Just body text";
    const result = parseFrontmatter(raw);
    expect(result.data).toEqual({});
    expect(result.content.trim()).toBe("Just body text");
    expect(result.error).toBeNull();
  });

  it("returns error for malformed YAML", () => {
    const raw = "---\ntitle: [unclosed\n---\nBody";
    const result = parseFrontmatter(raw);
    expect(result.error).toBeTruthy();
  });
});

describe("checkFrontmatter", () => {
  it("passes with valid title and description", () => {
    const raw = '---\ntitle: "Hello"\ndescription: "World"\n---\n';
    const result = checkFrontmatter(raw);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it("errors on missing title", () => {
    const raw = '---\ndescription: "World"\n---\n';
    const result = checkFrontmatter(raw);
    expect(result.errors).toContainEqual(
      expect.stringContaining("title"),
    );
  });

  it("errors on missing description", () => {
    const raw = '---\ntitle: "Hello"\n---\n';
    const result = checkFrontmatter(raw);
    expect(result.errors).toContainEqual(
      expect.stringContaining("description"),
    );
  });

  it("errors on empty string title", () => {
    const raw = '---\ntitle: ""\ndescription: "World"\n---\n';
    const result = checkFrontmatter(raw);
    expect(result.errors).toContainEqual(
      expect.stringContaining("title"),
    );
  });

  it("errors on empty string description", () => {
    const raw = '---\ntitle: "Hello"\ndescription: ""\n---\n';
    const result = checkFrontmatter(raw);
    expect(result.errors).toContainEqual(
      expect.stringContaining("description"),
    );
  });

  it("errors on whitespace-only title", () => {
    const raw = '---\ntitle: "   "\ndescription: "World"\n---\n';
    const result = checkFrontmatter(raw);
    expect(result.errors).toContainEqual(
      expect.stringContaining("title"),
    );
  });

  it("errors on whitespace-only description", () => {
    const raw = '---\ntitle: "Hello"\ndescription: "   "\n---\n';
    const result = checkFrontmatter(raw);
    expect(result.errors).toContainEqual(
      expect.stringContaining("description"),
    );
  });

  it("errors on non-string title", () => {
    const raw = "---\ntitle: 42\ndescription: \"World\"\n---\n";
    const result = checkFrontmatter(raw);
    expect(result.errors).toContainEqual(
      expect.stringContaining("title"),
    );
  });

  it("errors on non-string description", () => {
    const raw = "---\ntitle: \"Hello\"\ndescription: 42\n---\n";
    const result = checkFrontmatter(raw);
    expect(result.errors).toContainEqual(
      expect.stringContaining("description"),
    );
  });

  it("errors on malformed YAML with parser message", () => {
    const raw = "---\ntitle: [unclosed\n---\n";
    const result = checkFrontmatter(raw);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain("Malformed YAML");
  });
});

describe("checkDiagramFallback", () => {
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

describe("stripCodeBlocks", () => {
  it("removes fenced code blocks", () => {
    const body = "before\n```python\nprint('hello')\n```\nafter";
    expect(stripCodeBlocks(body)).toBe("before\n\nafter");
  });

  it("removes MDX code-string content", () => {
    const body = 'before <CodeBlock code={`print("hello")`} /> after';
    const result = stripCodeBlocks(body);
    expect(result).not.toContain('print("hello")');
    expect(result).toContain("before");
    expect(result).toContain("after");
  });

  it("removes multi-line JSX template literals", () => {
    const body =
      'before\n<MermaidDiagram chart={`graph LR\n  A[B1] --> C[B2]`} />\nafter';
    expect(stripCodeBlocks(body)).not.toContain("B2");
    expect(stripCodeBlocks(body)).toContain("before");
    expect(stripCodeBlocks(body)).toContain("after");
  });

  it("preserves regular text", () => {
    const body = "This is regular text with no code.";
    expect(stripCodeBlocks(body)).toBe(body);
  });
});

describe("extractLinks", () => {
  it("extracts inline markdown links", () => {
    const body = 'Check [this link](https://example.com) out';
    const result = extractLinks(body);
    expect(result.inlineLinks).toContainEqual({
      text: "this link",
      url: "https://example.com",
    });
  });

  it("extracts href attributes", () => {
    const body = '<a href="https://example.com">link</a>';
    const result = extractLinks(body);
    expect(result.inlineLinks).toContainEqual({
      text: "",
      url: "https://example.com",
    });
  });

  it("extracts src attributes", () => {
    const body = '<img src="/images/photo.png" alt="photo" />';
    const result = extractLinks(body);
    expect(result.inlineLinks).toContainEqual({
      text: "",
      url: "/images/photo.png",
    });
  });

  it("extracts reference-style definitions", () => {
    const body =
      'See [docs].\n\n[docs]: https://docs.ray.io/en/latest "Ray Docs"';
    const result = extractLinks(body);
    expect(result.referenceDefinitions.has("docs")).toBe(true);
    expect(result.referenceDefinitions.get("docs").url).toBe(
      "https://docs.ray.io/en/latest",
    );
  });

  it("extracts reference-style definitions with angle brackets", () => {
    const body = "[label]: <https://example.com/path>";
    const result = extractLinks(body);
    expect(result.referenceDefinitions.has("label")).toBe(true);
    expect(result.referenceDefinitions.get("label").url).toBe(
      "https://example.com/path",
    );
  });

  it("excludes links inside fenced code blocks", () => {
    const body =
      "```python\n[link](https://example.com)\n```\nReal [text](https://real.com)";
    const result = extractLinks(body);
    expect(result.inlineLinks).toHaveLength(1);
    expect(result.inlineLinks[0].url).toBe("https://real.com");
  });

  it("excludes links inside MDX code-string content", () => {
    const body =
      '<CodeBlock code={`[link](https://example.com)`} />\n[real](https://real.com)';
    const result = extractLinks(body);
    expect(result.inlineLinks).toHaveLength(1);
    expect(result.inlineLinks[0].url).toBe("https://real.com");
  });

  it("does not count inline links as reference usages", () => {
    const body = "[text](https://example.com)";
    const result = extractLinks(body);
    expect(result.referenceLabelUsages.size).toBe(0);
  });

  it("does not count image references as label usages", () => {
    const body = "![alt][label]\n\n[label]: https://example.com";
    const result = extractLinks(body);
    expect(result.referenceLabelUsages.size).toBe(0);
  });

  it("excludes escaped brackets", () => {
    const body = "\\[not a link\\]";
    const result = extractLinks(body);
    expect(result.referenceLabelUsages.size).toBe(0);
  });

  it("does not count definition lines as usages", () => {
    const body = "[label]: https://example.com\n\nSome text.";
    const result = extractLinks(body);
    expect(result.referenceLabelUsages.size).toBe(0);
  });

  it("detects shortcut reference usages for defined labels", () => {
    const body = "See [docs] for more.\n\n[docs]: https://example.com";
    const result = extractLinks(body);
    expect(result.referenceLabelUsages.has("docs")).toBe(true);
  });

  it("detects full reference usages", () => {
    const body =
      "See [the docs][docs] for more.\n\n[docs]: https://example.com";
    const result = extractLinks(body);
    expect(result.referenceLabelUsages.has("docs")).toBe(true);
  });
});

describe("classifyLink", () => {
  it("classifies HTTP links as external", () => {
    expect(classifyLink("https://example.com").type).toBe("external");
  });

  it("classifies relative paths as local", () => {
    expect(classifyLink("./file.mdx").type).toBe("local");
    expect(classifyLink("../other/file.mdx").type).toBe("local");
  });

  it("classifies fragment-only as fragment", () => {
    expect(classifyLink("#section").type).toBe("fragment");
  });

  it("classifies mailto as skip", () => {
    expect(classifyLink("mailto:user@example.com").type).toBe("skip");
  });

  it("classifies tel as skip", () => {
    expect(classifyLink("tel:+1234567890").type).toBe("skip");
  });

  it("classifies data URIs as skip", () => {
    expect(classifyLink("data:image/png;base64,abc").type).toBe("skip");
  });

  it("classifies root-relative paths as routes", () => {
    expect(classifyLink("/modules/1").type).toBe("route");
  });
});

describe("classifyExternalUrl", () => {
  it("accepts valid HTTPS URLs", () => {
    expect(classifyExternalUrl("https://example.com").safe).toBe(true);
  });

  it("accepts valid HTTP URLs", () => {
    expect(classifyExternalUrl("http://example.com").safe).toBe(true);
  });

  it("rejects localhost", () => {
    const result = classifyExternalUrl("http://localhost:3000");
    expect(result.safe).toBe(false);
    expect(result.reason).toContain("localhost");
  });

  it("rejects 127.0.0.1", () => {
    const result = classifyExternalUrl("http://127.0.0.1");
    expect(result.safe).toBe(false);
  });

  it("rejects private IP 10.x.x.x", () => {
    expect(classifyExternalUrl("http://10.0.0.1").safe).toBe(false);
  });

  it("rejects private IP 172.16.x.x", () => {
    expect(classifyExternalUrl("http://172.16.0.1").safe).toBe(false);
  });

  it("rejects private IP 192.168.x.x", () => {
    expect(classifyExternalUrl("http://192.168.1.1").safe).toBe(false);
  });

  it("rejects IPv6 loopback", () => {
    expect(classifyExternalUrl("http://[::1]").safe).toBe(false);
  });

  it("rejects IPv4-mapped IPv6", () => {
    expect(classifyExternalUrl("http://[::ffff:127.0.0.1]").safe).toBe(
      false,
    );
  });

  it("rejects URLs with credentials", () => {
    const result = classifyExternalUrl("http://user:pass@example.com");
    expect(result.safe).toBe(false);
    expect(result.reason).toContain("credentials");
  });

  it("rejects non-HTTP schemes", () => {
    const result = classifyExternalUrl("ftp://example.com");
    expect(result.safe).toBe(false);
    expect(result.reason).toContain("scheme");
  });

  it("rejects invalid URLs", () => {
    expect(classifyExternalUrl("not a url").safe).toBe(false);
  });
});

describe("isPrivateAddress", () => {
  it("detects link-local IPv6", () => {
    expect(isPrivateAddress("fe80::1")).toBe(true);
  });

  it("detects unique-local IPv6", () => {
    expect(isPrivateAddress("fc00::1")).toBe(true);
    expect(isPrivateAddress("fd12::1")).toBe(true);
  });

  it("detects link-local IPv4", () => {
    expect(isPrivateAddress("169.254.1.1")).toBe(true);
  });

  it("passes public IPs", () => {
    expect(isPrivateAddress("8.8.8.8")).toBe(false);
    expect(isPrivateAddress("example.com")).toBe(false);
  });
});

describe("detectLinkIssues", () => {
  it("reports undefined reference labels", () => {
    const extracted = {
      inlineLinks: [],
      referenceDefinitions: new Map(),
      referenceLabelUsages: new Map([["missing", 1]]),
    };
    const result = detectLinkIssues(extracted);
    expect(result.errors).toContainEqual(
      expect.stringContaining("missing"),
    );
  });

  it("reports duplicate reference definitions", () => {
    const extracted = {
      inlineLinks: [],
      referenceDefinitions: new Map([
        ["dup", { url: "https://example.com", count: 2 }],
      ]),
      referenceLabelUsages: new Map(),
    };
    const result = detectLinkIssues(extracted);
    expect(result.warnings).toContainEqual(
      expect.stringContaining("dup"),
    );
  });

  it("returns clean when all labels are defined", () => {
    const extracted = {
      inlineLinks: [],
      referenceDefinitions: new Map([
        ["docs", { url: "https://example.com", count: 1 }],
      ]),
      referenceLabelUsages: new Map([["docs", 1]]),
    };
    const result = detectLinkIssues(extracted);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });
});

describe("checkRiskyClaimPatterns", () => {
  it("warns on risky claims outside VerifyClaim", () => {
    const body = "This is the best framework ever.";
    expect(checkRiskyClaimPatterns(body).length).toBeGreaterThan(0);
  });

  it("does not warn on claims inside VerifyClaim", () => {
    const body = "<VerifyClaim>This is the best framework</VerifyClaim>";
    expect(checkRiskyClaimPatterns(body)).toEqual([]);
  });
});

describe("checkDuplicateParagraphs", () => {
  it("detects duplicate long paragraphs", () => {
    const longParagraph =
      "This is a sufficiently long paragraph that exceeds the eighty character minimum threshold for duplicate detection.";
    const body = `${longParagraph}\n\n${longParagraph}`;
    expect(checkDuplicateParagraphs(body).length).toBeGreaterThan(0);
  });

  it("does not flag short duplicates", () => {
    const body = "Short.\n\nShort.";
    expect(checkDuplicateParagraphs(body)).toEqual([]);
  });
});
