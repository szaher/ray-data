# Architecture

This template separates generated educational content from deterministic validation and rendering.

## Core Contracts

- `src/types/tutorial.ts` defines the production tutorial specification contract.
- `src/lib/tutorialSpec.ts` validates required fields and cross-references for model-produced JSON.
- `prompts/schemas/tutorial-spec.schema.json` gives prompt authors and external tools a JSON Schema contract.
- `content/tutorials/sample-tutorial.json` is the canonical v1.0.0 fixture for end-to-end validation.
- `content/tutorials/sample-enhanced-tutorial.json` is the v1.1.0 fixture demonstrating enhancement fields.
- Optional enhancement contracts (v1.1.0): `ContentStyle`, `GamificationConfig`, `AdaptivePath`, `SpacedRepetitionConfig`, `MicrolearningConfig`, `ProjectCapstone`, `UDLFramework`, `CollaborativeConfig`, `MultimediaPlan`, `ArtifactDescriptor`.
- Schema versioning: `1.0.0` specs are always valid; `1.1.0` specs may include enhancement fields. The validator accepts both.

## Generation Pipeline

`src/lib/generationPipeline.ts` defines the required stages:

1. Topic decomposition and curriculum map.
2. Research and source plan.
3. Lesson-outline generation.
4. Multimedia blueprint (v1.1.0 — plans media types, placements, and accessibility per lesson).
5. Artifact-specific generation.
6. Structured validation.
7. MDX compilation and rendering.
8. Human-review checkpoints.

Each stage declares inputs, outputs, quality gates, and whether human review is required.

## MDX Rendering Model

Lessons live in `content/module-N/*.mdx`. The MDX runtime registers reusable educational components from `src/components/learning.tsx`, including:

- Objectives, prerequisites, key terms, callouts, and warnings.
- Mermaid diagrams with fallback text.
- Flashcards, quiz blocks, worked examples, exercises, and tables.
- Narration hooks, mind maps, infographics, slide embeds, citations, source-quality labels, and claim verification states.

Components render semantic HTML first and progressively enhance where client-side rendering is useful.

## Quality Gates

`pnpm validate` runs `scripts/validate.mjs`, which checks:

- Tutorial spec shape and cross-references.
- MDX compilation.
- Broken local links and malformed URLs.
- Citation ids against tutorial references.
- Basic accessibility requirements for images, diagrams, and embeds.
- Duplicate paragraphs.
- Risky unsupported-claim wording outside `VerifyClaim`.

CI runs validate, lint, tests, and build.

## Human Review

Automated checks do not replace subject-matter review. Human reviewers should approve:

- Source quality and factual interpretation.
- Pedagogical sequencing and assessment fairness.
- Accessibility beyond static checks.
- Localization readiness and cultural assumptions.

## Runtime Capability Contracts

Enhancement features modeled in v1.1.0 specs produce authoring metadata. Some features require runtime platform support to function for learners:

| Feature | Authoring (available now) | Runtime (future work) |
|---------|--------------------------|----------------------|
| Gamification | Config, badges, points, achievements in spec | Points state, badge UI, persistence, anti-duplication |
| Adaptive paths | Path definitions, entry conditions, lesson sequences | Diagnostic signals, route selection, conditional navigation |
| Spaced repetition | Intervals, card count, Flashcard components | Deck format, review scheduler, due-date persistence |
| Microlearning | Module segmentation config | Session segmentation, resume state |
| Collaboration | Group size, activities, peer review config | Backend integration, identity, moderation |
| Interactive simulations | Artifact descriptors with type and accessibility | Component registry, execution sandboxing |

Authors can generate rich metadata for these features today. The platform renders what it can (Flashcards, MindMap, Diagram, etc.) and flags the rest for future implementation.
