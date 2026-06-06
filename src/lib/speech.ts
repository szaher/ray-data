export interface SpeechSection {
  id: string;
  heading: string;
  headingElement: HTMLElement;
  text: string;
  level: number;
}

const SKIP_TAGS = new Set(["PRE", "CODE", "SVG", "STYLE", "SCRIPT"]);

export function extractSpeakableText(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent || "";
  }

  if (node.nodeType !== Node.ELEMENT_NODE) return "";

  const el = node as HTMLElement;

  if (SKIP_TAGS.has(el.tagName)) return "";
  if (el.classList.contains("mermaid")) return "";
  if (el.closest("[data-tts-skip]")) return "";

  let text = "";
  for (const child of Array.from(el.childNodes)) {
    text += extractSpeakableText(child);
  }

  const tag = el.tagName;
  if ((tag === "P" || tag === "LI" || tag === "BLOCKQUOTE" || tag === "DIV") && text.trim()) {
    const trimmed = text.trim();
    const lastChar = trimmed[trimmed.length - 1];
    if (lastChar !== "." && lastChar !== "!" && lastChar !== "?" && lastChar !== ":") {
      text = trimmed + ". ";
    } else {
      text = trimmed + " ";
    }
  }

  return text;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function extractSections(container: HTMLElement): SpeechSection[] {
  const sections: SpeechSection[] = [];
  const children = Array.from(container.children) as HTMLElement[];

  let currentHeading: HTMLElement | null = null;
  let currentText = "";
  let currentLevel = 0;

  function flush() {
    if (currentHeading && currentText.trim()) {
      const heading = currentHeading.textContent || "";
      sections.push({
        id: slugify(heading) || `section-${sections.length}`,
        heading,
        headingElement: currentHeading,
        text: currentText.trim(),
        level: currentLevel,
      });
    } else if (!currentHeading && currentText.trim() && sections.length === 0) {
      sections.push({
        id: "introduction",
        heading: "Introduction",
        headingElement: container,
        text: currentText.trim(),
        level: 1,
      });
    }
  }

  for (const child of children) {
    const tag = child.tagName;
    if (tag === "H2" || tag === "H3") {
      flush();
      currentHeading = child;
      currentLevel = tag === "H2" ? 2 : 3;
      currentText = "";
    } else {
      currentText += extractSpeakableText(child) + " ";
    }
  }

  flush();
  return sections;
}
