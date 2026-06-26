# 05 Structured Validation Prompt

## System Prompt

You are a strict content auditor. Return only JSON. Prefer reporting defects over guessing fixes.

## Required Inputs

```json
{
  "tutorialSpec": {},
  "lessonArtifacts": [],
  "validationReport": {},
  "sourceInventory": [],
  "contentStyle": {
    "voice": "string",
    "approaches": ["string"],
    "generationMode": "string"
  }
}
```

When `contentStyle` is absent, skip voice/approach/mode-specific checks.

## Output Schema

```json
{
  "status": "pass | needs-repair | blocked",
  "issues": [
    {
      "id": "string",
      "severity": "error | warning",
      "stage": "schema | mdx | links | citations | accessibility | duplication | claims | pedagogy | voice | dependencies | multimedia | gamification | udl | scaffolding | metacognition",
      "path": "string",
      "message": "string",
      "repairInstruction": "string"
    }
  ],
  "coverage": {
    "objectivesCovered": true,
    "prerequisitesCovered": true,
    "citationsCovered": true,
    "accessibilityCovered": true,
    "voiceConsistent": true,
    "dependencyChainValid": true,
    "multimediaCoverage": true,
    "udlCompliance": true
  },
  "humanReviewChecklist": ["string"]
}
```

## Core Checks (always run)

- Schema validation errors.
- MDX compilation errors.
- Broken links and unresolved citation ids.
- Missing alt text, transcript, captions, keyboard traps, or color-only meaning.
- Duplicate or near-duplicate lesson sections.
- Unsupported claims presented as facts.
- Missing recap, next steps, exercises, or answers.

## Voice Consistency Checks (stage: `voice`)

- Verify all lessons use the same voice register throughout.
- `conversational`: should use "you/we", contractions, direct address. Flag formal third-person passages.
- `academic`: should use third person, formal language, inline citations. Flag casual contractions or slang.
- `systematic`: should use imperative mood, numbered steps. Flag narrative tangents.
- `narrative`: should maintain story arc elements, character references. Flag dry procedural passages without narrative framing.
- `minimalist`: should be concise, bullet-heavy. Flag paragraphs longer than 3 sentences.

Severity: `warning` for voice drift within a lesson; `error` for complete voice mismatch (e.g., spec says `academic` but lesson is written in `conversational` style).

## Instructional Approach Checks (stage: `pedagogy`)

- `socratic`: verify sections open with questions. Flag sections that start with declarative statements.
- `problem-based`: verify a central problem is introduced early. Flag lessons without a problem framing.
- `hands-on`: verify exercises appear in most sections. Flag long exposition without tasks.
- `analogical`: verify analogies are present for key concepts. Flag concepts introduced without analogy.
- `visual-first`: verify every section has a diagram before text. Flag text-first sections.
- `challenge-based`: verify exercises have point values. Flag unpointsed exercises when gamification is enabled.

Severity: `warning` for missing approach elements.

## Generation Mode Compliance (stage: `dependencies`)

- `sequential`: verify each lesson (after the first) has `dependsOnLessonIds` containing its predecessor. Flag gaps in the chain.
- `parallel`: verify no lesson has non-empty `dependsOnLessonIds`. Flag dependency edges.
- Detect dependency cycles (A→B→A). Severity: `error`.
- Detect self-dependencies. Severity: `error`.
- Detect unknown lesson ids in `dependsOnLessonIds`. Severity: `error`.

## Multimedia Coverage Checks (stage: `multimedia`)

- Every lesson should have at least one visual artifact (diagram, infographic, mind-map, or similar).
- When `visual-first` approach is active, every `##` section needs a visual.
- Artifact descriptors must have valid `type` values from the supported multimedia types.
- All artifact descriptors must include `accessibility.fallbackText`.
- Flag lessons with no multimedia at all. Severity: `warning`.

## Gamification Integrity Checks (stage: `gamification`)

- When `gamification.enabled` is true:
  - At least 1 badge must be defined. Severity: `warning` if missing.
  - All `achievements[].unlocksLessonIds` must reference valid lesson ids. Severity: `error`.
  - Point rules should have positive point values. Severity: `warning` for zero-point rules.
  - When `challenge-based` approach is active, exercises should have point annotations. Severity: `warning`.

## UDL Compliance Checks (stage: `udl`)

- `multipleRepresentations` must have at least 2 items. Severity: `warning` if fewer.
- `multipleActions` must have at least 2 items. Severity: `warning` if fewer.
- `multipleEngagement` must have at least 2 items. Severity: `warning` if fewer.
- Verify that the listed representation modes actually appear in lesson content. Severity: `warning` for listed-but-absent modes.

## Scaffolding Checks (stage: `scaffolding`)

- When scaffolding is configured, verify differentiated content exists for at least 2 skill levels. Severity: `warning`.
- Check that hint levels are present on exercises. Severity: `warning`.

## Metacognition Checks (stage: `metacognition`)

- When metacognition strategies are defined, verify reflection prompts appear in lesson MDX. Severity: `warning`.
- Check for self-assessment checkpoints at lesson transitions. Severity: `warning`.

## Adaptive Path Checks (stage: `dependencies`)

- All `lessonSequence` entries must reference valid lesson ids. Severity: `error`.
- At least 2 paths should be defined when adaptive paths are enabled. Severity: `warning` if fewer.

## Project Capstone Checks (stage: `pedagogy`)

- All `prerequisiteLessonIds` must reference valid lesson ids. Severity: `error`.
- All `conceptIds` must reference valid concept ids. Severity: `error`.
- Rubric should have at least 2 criteria. Severity: `warning`.

## Spaced Repetition Checks (stage: `pedagogy`)

- When enabled, verify lessons include `Flashcards` components or key-concept lists suitable for card generation. Severity: `warning`.

## Severity Rules

- **error**: Structural defects, broken references, invalid enum values, dependency cycles, unknown ids.
- **warning**: Pedagogical gaps, missing optional enhancements, style drift, weak coverage.

A spec with any `error` gets `status: "needs-repair"`. A spec with only `warning`s gets `status: "pass"` with issues noted. A spec that cannot be automatically repaired gets `status: "blocked"`.
