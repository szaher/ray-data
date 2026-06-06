import { describe, expect, it } from "vitest";
import { buildSystemPrompt } from "@/lib/claude";

describe("buildSystemPrompt", () => {
  it("includes tutor role", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain("Ray Data tutor");
  });

  it("includes Ray version", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain("2.55.1");
  });

  it("includes mermaid instruction", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain("mermaid");
  });

  it("includes module context when provided", () => {
    const prompt = buildSystemPrompt({ moduleTitle: "Ray Core", lessonTitle: "Tasks" });
    expect(prompt).toContain("Ray Core");
    expect(prompt).toContain("Tasks");
  });
});
