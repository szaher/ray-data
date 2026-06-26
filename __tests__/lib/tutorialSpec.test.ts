import { describe, expect, it } from "vitest";
import { validateTutorialSpec, migrateSpec } from "@/lib/tutorialSpec";
import {
  CONTENT_VOICES,
  INSTRUCTIONAL_APPROACHES,
  GENERATION_MODES,
  MULTIMEDIA_TYPES,
  ARTIFACT_STATUSES,
} from "@/types/tutorial";
import type { TutorialSpec } from "@/types";

const validSpec: TutorialSpec = {
  schemaVersion: "1.0.0",
  id: "tutorial-test",
  title: "Tutorial Test",
  description: "A valid tutorial spec for tests.",
  audience: {
    primary: "Developers",
    priorKnowledge: ["Markdown"],
  },
  prerequisites: ["Can use a terminal"],
  learningObjectives: [
    {
      id: "obj-one",
      description: "Explain validation.",
      bloomLevel: "understand",
      assessmentIds: ["assess-one"],
    },
  ],
  scope: {
    inScope: ["Validation"],
    nonGoals: ["Deployment"],
  },
  lessons: [
    {
      id: "lesson-one",
      slug: "lesson-one",
      title: "Lesson One",
      summary: "A lesson.",
      estimatedMinutes: 5,
      difficulty: "beginner",
      prerequisites: [],
      objectiveIds: ["obj-one"],
      conceptIds: ["concept-one"],
      referenceIds: ["ref-one"],
      artifacts: {
        mdxPath: "content/module-1/lesson-one.mdx",
      },
    },
  ],
  references: [
    {
      id: "ref-one",
      title: "Reference",
      url: "https://example.com",
      accessedAt: "2026-06-19",
      quality: "primary",
    },
  ],
  concepts: [
    {
      id: "concept-one",
      term: "Validation",
      definition: "A deterministic check.",
    },
  ],
  misconceptions: [
    {
      id: "mis-one",
      misconception: "Validation replaces review.",
      correction: "Validation supports review.",
      conceptIds: ["concept-one"],
    },
  ],
  workedExamples: [
    {
      id: "example-one",
      title: "Example",
      prompt: "Check a spec.",
      steps: ["Read it", "Validate it"],
      explanation: "The validator catches structure defects.",
      conceptIds: ["concept-one"],
      referenceIds: ["ref-one"],
    },
  ],
  exercises: [
    {
      id: "exercise-one",
      prompt: "Name one gate.",
      type: "short-answer",
      difficulty: "beginner",
      conceptIds: ["concept-one"],
      answerId: "answer-one",
    },
  ],
  answers: [
    {
      id: "answer-one",
      exerciseId: "exercise-one",
      answer: "Schema validation.",
    },
  ],
  formativeAssessment: [
    {
      id: "assess-one",
      type: "quiz",
      prompt: "What does validation do?",
      objectiveIds: ["obj-one"],
    },
  ],
  masteryCriteria: [
    {
      id: "mastery-one",
      description: "Explains validation.",
      objectiveIds: ["obj-one"],
      threshold: "One accurate explanation.",
    },
  ],
  recap: ["Validation is deterministic."],
  nextSteps: ["Run the validator."],
  accessibility: {
    altTextRequired: true,
    captionsRequired: true,
    transcriptRequired: true,
    colorIndependent: true,
    keyboardNavigable: true,
    readingOrderChecked: true,
  },
  localization: {
    sourceLocale: "en-US",
    targetLocales: ["en-GB"],
    glossaryTerms: ["validation"],
    culturalAssumptions: [],
  },
};

describe("validateTutorialSpec", () => {
  it("accepts a valid tutorial spec", () => {
    const result = validateTutorialSpec(validSpec);
    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it("rejects invalid cross references", () => {
    const spec = structuredClone(validSpec);
    spec.lessons[0].objectiveIds = ["missing-objective"];

    const result = validateTutorialSpec(spec);

    expect(result.ok).toBe(false);
    expect(result.issues.some((item) => item.path.includes("objectiveIds"))).toBe(true);
  });

  it("rejects adversarial prose instead of JSON", () => {
    const result = validateTutorialSpec("Here is the tutorial you requested.");

    expect(result.ok).toBe(false);
    expect(result.issues[0].path).toBe("$");
  });

  it("rejects partial model responses", () => {
    const result = validateTutorialSpec({
      schemaVersion: "1.0.0",
      title: "Partial",
      lessons: [],
    });

    expect(result.ok).toBe(false);
    expect(result.issues.some((item) => item.path === "$.id")).toBe(true);
    expect(result.issues.some((item) => item.path === "$.lessons")).toBe(true);
  });
});

// ── Enhanced spec (v1.1.0) tests ─────────────────────────────

function makeEnhancedSpec(overrides: Record<string, unknown> = {}): TutorialSpec {
  return {
    ...validSpec,
    schemaVersion: "1.1.0",
    lessons: [
      {
        ...validSpec.lessons[0],
        dependsOnLessonIds: [],
      },
    ],
    contentStyle: {
      voice: "systematic",
      approaches: ["hands-on"],
      generationMode: "parallel",
    },
    ...overrides,
  };
}

function makeTwoLessonSpec(mode: "sequential" | "parallel", deps?: Record<string, string[]>): TutorialSpec {
  const base = makeEnhancedSpec();
  return {
    ...base,
    lessons: [
      { ...base.lessons[0], id: "lesson-a", dependsOnLessonIds: deps?.["lesson-a"] ?? [] },
      {
        ...base.lessons[0],
        id: "lesson-b",
        slug: "lesson-b",
        title: "Lesson B",
        dependsOnLessonIds: deps?.["lesson-b"] ?? [],
      },
    ],
    contentStyle: { voice: "systematic", generationMode: mode },
  };
}

describe("schema versioning", () => {
  it("accepts v1.0.0 spec without enhancement fields", () => {
    const result = validateTutorialSpec(validSpec);
    expect(result.ok).toBe(true);
  });

  it("accepts v1.1.0 spec with enhancement fields", () => {
    const result = validateTutorialSpec(makeEnhancedSpec());
    expect(result.ok).toBe(true);
  });

  it("rejects unknown schemaVersion", () => {
    const spec = { ...validSpec, schemaVersion: "2.0.0" };
    const result = validateTutorialSpec(spec);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.path === "$.schemaVersion")).toBe(true);
  });
});

describe("content style validation", () => {
  it("rejects invalid voice", () => {
    const result = validateTutorialSpec(makeEnhancedSpec({
      contentStyle: { voice: "dramatic", generationMode: "sequential" },
    }));
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.path === "$.contentStyle.voice")).toBe(true);
  });

  it("rejects invalid instructional approach", () => {
    const result = validateTutorialSpec(makeEnhancedSpec({
      contentStyle: { voice: "systematic", approaches: ["interpretive-dance"] },
    }));
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.path.includes("approaches"))).toBe(true);
  });

  it("rejects invalid generation mode", () => {
    const result = validateTutorialSpec(makeEnhancedSpec({
      contentStyle: { voice: "systematic", generationMode: "random" },
    }));
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.path === "$.contentStyle.generationMode")).toBe(true);
  });
});

describe("lesson dependency validation", () => {
  it("sequential mode: errors when predecessor link is missing", () => {
    const spec = makeTwoLessonSpec("sequential", { "lesson-a": [], "lesson-b": [] });
    const result = validateTutorialSpec(spec);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) =>
      i.message.includes("Sequential mode") && i.message.includes("lesson-b"),
    )).toBe(true);
  });

  it("sequential mode: accepts valid dependency chain", () => {
    const spec = makeTwoLessonSpec("sequential", { "lesson-a": [], "lesson-b": ["lesson-a"] });
    const result = validateTutorialSpec(spec);
    expect(result.ok).toBe(true);
  });

  it("parallel mode: errors when dependency edges are present", () => {
    const spec = makeTwoLessonSpec("parallel", { "lesson-a": [], "lesson-b": ["lesson-a"] });
    const result = validateTutorialSpec(spec);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.message.includes("Parallel mode"))).toBe(true);
  });

  it("parallel mode: accepts lessons without dependencies", () => {
    const spec = makeTwoLessonSpec("parallel", { "lesson-a": [], "lesson-b": [] });
    const result = validateTutorialSpec(spec);
    expect(result.ok).toBe(true);
  });

  it("detects dependency cycle", () => {
    const spec = makeTwoLessonSpec("sequential", { "lesson-a": ["lesson-b"], "lesson-b": ["lesson-a"] });
    // Remove generation mode compliance to isolate cycle test
    (spec as unknown as Record<string, unknown>).contentStyle = { voice: "systematic" };
    const result = validateTutorialSpec(spec);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.message.includes("cycle"))).toBe(true);
  });

  it("detects self-dependency", () => {
    const spec = makeEnhancedSpec({
      lessons: [{ ...validSpec.lessons[0], dependsOnLessonIds: ["lesson-one"] }],
    });
    const result = validateTutorialSpec(spec);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.message.includes("Self-dependency"))).toBe(true);
  });

  it("errors on unknown lesson in dependsOnLessonIds", () => {
    const spec = makeEnhancedSpec({
      lessons: [{ ...validSpec.lessons[0], dependsOnLessonIds: ["nonexistent"] }],
    });
    const result = validateTutorialSpec(spec);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.message.includes("Unknown lesson id"))).toBe(true);
  });
});

describe("gamification validation", () => {
  it("warns when gamification is enabled but no badges defined", () => {
    const spec = makeEnhancedSpec({ gamification: { enabled: true, badges: [] } });
    const result = validateTutorialSpec(spec);
    expect(result.ok).toBe(true);
    expect(result.issues.some((i) => i.severity === "warning" && i.path.includes("badges"))).toBe(true);
  });

  it("errors when achievement references unknown lesson", () => {
    const spec = makeEnhancedSpec({
      gamification: {
        enabled: true,
        badges: [{ id: "b1", title: "B", description: "D", criteria: "C", iconHint: "star" }],
        achievements: [{ id: "ach-1", title: "A", description: "D", unlocksLessonIds: ["nonexistent"] }],
      },
    });
    const result = validateTutorialSpec(spec);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.message.includes("Unknown lesson id") && i.path.includes("achievements"))).toBe(true);
  });
});

describe("adaptive paths validation", () => {
  it("errors when adaptive path references unknown lesson", () => {
    const spec = makeEnhancedSpec({
      adaptivePaths: [{
        id: "path-1",
        title: "P",
        description: "D",
        entryCondition: "Beginner",
        lessonSequence: ["lesson-one", "nonexistent"],
        difficulty: "beginner",
      }],
    });
    const result = validateTutorialSpec(spec);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.message.includes("Unknown lesson id") && i.path.includes("adaptivePaths"))).toBe(true);
  });
});

describe("project capstone validation", () => {
  it("errors when capstone references unknown lesson", () => {
    const spec = makeEnhancedSpec({
      projectCapstones: [{
        id: "cap-1",
        title: "C",
        description: "D",
        deliverables: ["Report"],
        rubric: ["Criterion"],
        estimatedHours: 2,
        prerequisiteLessonIds: ["nonexistent"],
        conceptIds: ["concept-one"],
      }],
    });
    const result = validateTutorialSpec(spec);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.path.includes("projectCapstones") && i.message.includes("Unknown lesson id"))).toBe(true);
  });

  it("errors when capstone references unknown concept", () => {
    const spec = makeEnhancedSpec({
      projectCapstones: [{
        id: "cap-1",
        title: "C",
        description: "D",
        deliverables: ["Report"],
        rubric: ["Criterion"],
        estimatedHours: 2,
        prerequisiteLessonIds: ["lesson-one"],
        conceptIds: ["nonexistent"],
      }],
    });
    const result = validateTutorialSpec(spec);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.path.includes("conceptIds") && i.message.includes("concept"))).toBe(true);
  });
});

describe("artifact descriptor validation", () => {
  it("errors on invalid multimedia type", () => {
    const spec = makeEnhancedSpec({
      lessons: [{
        ...validSpec.lessons[0],
        artifacts: {
          mdxPath: "content/module-1/lesson-one.mdx",
          items: [{
            id: "art-1",
            type: "hologram",
            status: "planned",
            objectiveIds: ["obj-one"],
            accessibility: { fallbackText: "A hologram" },
          }],
        },
      }],
    });
    const result = validateTutorialSpec(spec);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.message.includes("multimedia type"))).toBe(true);
  });

  it("errors on missing accessibility fallbackText", () => {
    const spec = makeEnhancedSpec({
      lessons: [{
        ...validSpec.lessons[0],
        artifacts: {
          mdxPath: "content/module-1/lesson-one.mdx",
          items: [{
            id: "art-1",
            type: "mermaid",
            status: "planned",
            objectiveIds: ["obj-one"],
            accessibility: {},
          }],
        },
      }],
    });
    const result = validateTutorialSpec(spec);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.message.includes("fallbackText"))).toBe(true);
  });
});

describe("backward compatibility", () => {
  it("v1.0.0 spec without any enhancement fields passes", () => {
    const result = validateTutorialSpec(validSpec);
    expect(result.ok).toBe(true);
    expect(result.issues.length).toBe(0);
  });
});

describe("enum parity", () => {
  it("canonical constants are defined and non-empty", () => {
    expect(CONTENT_VOICES.length).toBe(5);
    expect(INSTRUCTIONAL_APPROACHES.length).toBe(6);
    expect(GENERATION_MODES.length).toBe(2);
    expect(MULTIMEDIA_TYPES.length).toBe(10);
    expect(ARTIFACT_STATUSES.length).toBe(3);
  });

  it("validator accepts all canonical voice values", () => {
    for (const voice of CONTENT_VOICES) {
      const spec = makeEnhancedSpec({ contentStyle: { voice } });
      const result = validateTutorialSpec(spec);
      expect(result.issues.filter((i) => i.path === "$.contentStyle.voice")).toEqual([]);
    }
  });

  it("validator accepts all canonical approach values", () => {
    for (const approach of INSTRUCTIONAL_APPROACHES) {
      const spec = makeEnhancedSpec({ contentStyle: { voice: "systematic", approaches: [approach] } });
      const result = validateTutorialSpec(spec);
      expect(result.issues.filter((i) => i.path.includes("approaches"))).toEqual([]);
    }
  });
});

describe("pipeline stage order", () => {
  it("multimedia-blueprint comes after lesson-outline", async () => {
    const { generationPipeline } = await import("@/lib/generationPipeline");
    const stageIds = generationPipeline.map((s) => s.id);
    const outlineIdx = stageIds.indexOf("lesson-outline");
    const blueprintIdx = stageIds.indexOf("multimedia-blueprint");
    const artifactIdx = stageIds.indexOf("artifact-generation");
    expect(blueprintIdx).toBeGreaterThan(outlineIdx);
    expect(blueprintIdx).toBeLessThan(artifactIdx);
  });
});

describe("UDL framework validation", () => {
  it("warns when fewer than 2 representation modes", () => {
    const spec = makeEnhancedSpec({
      udlFramework: {
        multipleRepresentations: ["text"],
        multipleActions: ["quizzes", "exercises"],
        multipleEngagement: ["scenarios", "challenges"],
      },
    });
    const result = validateTutorialSpec(spec);
    expect(result.ok).toBe(true);
    expect(result.issues.some((i) => i.severity === "warning" && i.path.includes("multipleRepresentations"))).toBe(true);
  });

  it("passes when all UDL categories have 2+ items", () => {
    const spec = makeEnhancedSpec({
      udlFramework: {
        multipleRepresentations: ["text", "diagrams"],
        multipleActions: ["quizzes", "exercises"],
        multipleEngagement: ["scenarios", "challenges"],
      },
    });
    const result = validateTutorialSpec(spec);
    expect(result.issues.filter((i) => i.path.includes("udlFramework"))).toEqual([]);
  });
});

describe("migrateSpec", () => {
  it("passes through a 1.1.0 spec unchanged", () => {
    const input = { schemaVersion: "1.1.0", contentStyle: { voice: "narrative" } } as Record<string, unknown>;
    const output = migrateSpec(input);
    expect(output).toBe(input);
  });

  it("preserves all existing 1.0.0 fields", () => {
    const input = { schemaVersion: "1.0.0", id: "test" } as Record<string, unknown>;
    const output = migrateSpec(input);
    expect(output.id).toBe("test");
    expect(output.schemaVersion).toBe("1.0.0");
  });
});
