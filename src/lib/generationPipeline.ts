export type GenerationStageId =
  | "topic-decomposition"
  | "research-source-plan"
  | "lesson-outline"
  | "multimedia-blueprint"
  | "artifact-generation"
  | "structured-validation"
  | "mdx-compilation"
  | "human-review";

export interface GenerationStage {
  id: GenerationStageId;
  title: string;
  purpose: string;
  inputs: string[];
  outputs: string[];
  gates: string[];
  reviewerRequired: boolean;
}

export const generationPipeline: GenerationStage[] = [
  {
    id: "topic-decomposition",
    title: "Topic Decomposition and Curriculum Map",
    purpose: "Break the tutorial topic into prerequisite-aware lessons and concept dependencies.",
    inputs: ["topic brief", "audience profile", "scope and non-goals"],
    outputs: ["curriculum map JSON", "concept graph", "lesson sequence", "content style configuration", "gamification plan", "adaptive path definitions"],
    gates: ["all objectives map to at least one lesson", "prerequisites are stated before use", "content voice and generation mode declared"],
    reviewerRequired: true,
  },
  {
    id: "research-source-plan",
    title: "Research and Source Plan",
    purpose: "Identify primary sources, citation coverage, and claims requiring verification.",
    inputs: ["curriculum map JSON", "source policy"],
    outputs: ["reference inventory", "claim register", "source-quality labels"],
    gates: ["primary or official source preferred", "unsupported claims marked verify"],
    reviewerRequired: true,
  },
  {
    id: "lesson-outline",
    title: "Lesson Outline Generation",
    purpose: "Create lesson-level scaffolds with objectives, examples, exercises, recap, and assessment.",
    inputs: ["curriculum map JSON", "reference inventory", "content style configuration"],
    outputs: ["lesson outline JSON", "metacognition strategies per lesson"],
    gates: ["one assessment per objective", "worked examples precede independent exercises", "voice-consistent language throughout", "scaffolding present for differentiated instruction"],
    reviewerRequired: false,
  },
  {
    id: "multimedia-blueprint",
    title: "Multimedia Blueprint",
    purpose: "Analyze lesson outlines to plan media types, placements, and accessibility strategies for each lesson.",
    inputs: ["lesson outline JSON", "content style configuration", "reference inventory", "accessibility requirements"],
    outputs: ["per-lesson multimedia plans", "UDL coverage report"],
    gates: ["every lesson has at least one multimedia recommendation", "accessibility notes provided for all items", "UDL coverage includes at least two representation modes"],
    reviewerRequired: false,
  },
  {
    id: "artifact-generation",
    title: "Artifact-Specific Generation",
    purpose: "Generate MDX, quizzes, diagrams, narration scripts, mind maps, slides, and infographics.",
    inputs: ["lesson outline JSON", "approved source excerpts", "per-lesson multimedia plans", "gamification config"],
    outputs: ["MDX files", "frontmatter quiz data", "diagram source", "narration hooks", "flashcard sets", "gamification elements"],
    gates: ["all citations resolve", "diagrams include fallbacks", "media has accessibility metadata", "spaced repetition flashcards generated when enabled", "gamification elements consistent with config"],
    reviewerRequired: false,
  },
  {
    id: "structured-validation",
    title: "Structured Validation",
    purpose: "Validate JSON outputs, cross-references, coverage, unsupported claims, and duplicates.",
    inputs: ["tutorial spec JSON", "generated artifacts"],
    outputs: ["validation report"],
    gates: ["schema validation passes", "claim and citation checks pass", "voice consistency validated", "UDL coverage meets minimums", "gamification integrity check passes"],
    reviewerRequired: false,
  },
  {
    id: "mdx-compilation",
    title: "MDX Compilation and Rendering",
    purpose: "Compile lesson MDX and verify enhanced components degrade gracefully.",
    inputs: ["MDX files", "component registry"],
    outputs: ["compiled lesson pages", "rendering diagnostics"],
    gates: ["MDX compilation passes", "component imports are registered"],
    reviewerRequired: false,
  },
  {
    id: "human-review",
    title: "Human Review Checkpoints",
    purpose: "Review pedagogy, factuality, accessibility, localization, and learner experience.",
    inputs: ["validation report", "preview build", "source plan"],
    outputs: ["approval notes", "repair tasks", "release decision"],
    gates: ["subject-matter review complete", "accessibility review complete"],
    reviewerRequired: true,
  },
];
