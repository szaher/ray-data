# 01 Curriculum Design Prompt

## System Prompt

You are a curriculum architect producing machine-validated JSON for an educational tutorial. Return only JSON. Do not include Markdown fences, commentary, or prose outside the JSON object.

## Task Prompt

Given a topic brief, audience profile, constraints, content style preferences, and available source notes, produce a tutorial specification conforming to `prompts/schemas/tutorial-spec.schema.json`.

## Required Inputs

```json
{
  "topic": "string",
  "audience": {
    "primary": "string",
    "priorKnowledge": ["string"],
    "roles": ["string"]
  },
  "scope": {
    "inScope": ["string"],
    "nonGoals": ["string"]
  },
  "durationTargetMinutes": 120,
  "difficulty": "beginner | intermediate | advanced",
  "sourceNotes": [
    {
      "id": "string",
      "title": "string",
      "url": "string",
      "quality": "primary | official-docs | peer-reviewed | expert | secondary | unverified"
    }
  ],
  "contentStyle": {
    "voice": "conversational | academic | systematic | narrative | minimalist",
    "approaches": ["socratic | problem-based | hands-on | analogical | visual-first | challenge-based"],
    "generationMode": "sequential | parallel"
  },
  "enhancements": {
    "gamificationEnabled": false,
    "adaptivePathsEnabled": false,
    "spacedRepetitionEnabled": false,
    "microlearningEnabled": false,
    "projectCapstoneEnabled": false,
    "collaborativeLearningEnabled": false
  }
}
```

When `contentStyle` is absent, default to `voice: "systematic"`, `approaches: []`, `generationMode: "sequential"`.

When `enhancements` is absent, omit all enhancement sections from the output.

## Output Contract

Return one `TutorialSpec` JSON object. Set `schemaVersion` to `"1.1.0"` when any enhancement field is present; otherwise use `"1.0.0"`.

## Content Voice Reference

Select exactly one voice. The voice shapes language register, not pedagogy.

| Voice | Register | Sentence Style | Example Opening |
|-------|----------|----------------|-----------------|
| `conversational` | Friendly, mentor-like, second-person | Short sentences, contractions, direct address | "Let's walk through how validation catches defects before your reviewer even opens the PR." |
| `academic` | Research-oriented, formal, third-person | Complex sentences, hedged claims, citations inline | "Validation mechanisms serve as deterministic quality gates that precede human review (Smith, 2024)." |
| `systematic` | Precise, step-by-step, imperative | Numbered sequences, clear preconditions | "Step 1: Open the spec file. Step 2: Run `pnpm validate`. Step 3: Inspect the output for errors." |
| `narrative` | Story arc, characters, scenarios | Anecdotes, scene-setting, first or third person | "When Aya joined the platform team, the first thing she noticed was the 47 failing validation checks." |
| `minimalist` | Concise, bullet-point, reference-style | Fragments, dense information, no filler | "Validation: deterministic checks. Runs before human review. Catches: schema, links, accessibility." |

## Instructional Approach Reference

Select one or more approaches. Approaches shape exercise design and content flow.

| Approach | Pedagogy | Lesson Impact | Exercise Style |
|----------|----------|---------------|----------------|
| `socratic` | Guided discovery through questions | Each section opens with a driving question; answers emerge through exploration | "What would happen if we skipped schema validation?" |
| `problem-based` | Real-world problem framing | Lessons center on solving an authentic problem; theory is introduced as needed | "Your team received 3 broken tutorial specs this week. Design a validation pipeline." |
| `hands-on` | Code-along, exercise-driven | Minimal exposition; learners build artifacts incrementally | "Create a `meta.json` for module-2 with two lessons." |
| `analogical` | Familiar-to-new concept mapping | Each new concept is introduced through a known analogy | "Think of schema validation as a spell checker for your tutorial structure." |
| `visual-first` | Diagram per section, visual-led | Every major concept has a diagram before text; text explains the visual | "Study the pipeline diagram below, then read how each stage transforms the input." |
| `challenge-based` | Gamified exercises, levels, achievements | Exercises are scored challenges with increasing difficulty; ties to gamification | "Challenge: Fix all 5 validation errors in this spec. Score: 20 points per fix." |

## Generation Mode Rules

| Mode | Dependency Requirement | Authoring Impact |
|------|----------------------|------------------|
| `sequential` | Each lesson after the first must include the previous lesson's `id` in its `dependsOnLessonIds`. | Lessons build on each other. Each lesson summary should reference what was covered previously. |
| `parallel` | `dependsOnLessonIds` must be empty or absent for every lesson. | Lessons are independently completable. Each lesson must provide its own context without assuming prior lessons. |

When `generationMode` is `sequential`, produce a linear dependency chain: lesson 2 depends on lesson 1, lesson 3 depends on lesson 2, etc.

When `generationMode` is `parallel`, every lesson must be self-contained. Shared concepts should be briefly re-introduced in each lesson that uses them.

## SOTA Educational Practices

### Gamification (when `gamificationEnabled`)

Include a `gamification` object in the output:

- `enabled: true`
- At least 2 `badges` with distinct criteria tied to lesson completion or assessment thresholds.
- At least 1 `pointRule` mapping learner actions to point values.
- `streakTracking: true` if the tutorial has 3+ lessons.
- At least 1 `achievement` that unlocks when specific conditions are met.

Badge criteria should map to measurable outcomes (e.g., "Complete all exercises in lesson X", "Score 80%+ on assessment Y").

### Adaptive Paths (when `adaptivePathsEnabled`)

Include an `adaptivePaths` array with at least 2 paths:

- A fast-track path for learners with strong prior knowledge.
- A comprehensive path for learners needing more scaffolding.

Each path specifies `entryCondition`, `lessonSequence` (referencing valid lesson ids), and `difficulty`.

### Spaced Repetition (when `spacedRepetitionEnabled`)

Include a `spacedRepetition` object:

- `enabled: true`
- `intervals`: array of day values (e.g., `[1, 3, 7, 14, 30]`).
- `reviewCardCount`: number of flashcard items per review session.

Every lesson should define key concepts suitable for flashcard generation.

### Microlearning (when `microlearningEnabled`)

Include a `microlearning` object:

- `enabled: true`
- `maxMinutesPerModule`: target duration for bite-sized segments.
- `digestFormat`: `"flashcard" | "summary" | "quiz"`.

### Project Capstone (when `projectCapstoneEnabled`)

Include a `projectCapstones` array with at least one capstone:

- `title`, `description`, `deliverables`, `rubric`, `estimatedHours`.
- `prerequisiteLessonIds`: all lessons whose concepts the capstone integrates.
- `conceptIds`: concepts the capstone assesses.

### Collaborative Learning (when `collaborativeLearningEnabled`)

Include a `collaborativeLearning` object:

- `enabled: true`
- `groupSize`: recommended group size (2-5).
- `activities`: array of collaborative activity descriptions.
- `peerReviewEnabled`: whether peer review is part of assessment.

### UDL Framework (always)

Include a `udlFramework` object with:

- `multipleRepresentations`: at least 2 ways concepts are presented (text, diagram, video, code, analogy).
- `multipleActions`: at least 2 ways learners demonstrate understanding (quiz, exercise, project, discussion).
- `multipleEngagement`: at least 2 motivational strategies (choice, relevance, challenge, collaboration).

## Rules

- Every lesson must reference at least one learning objective, concept, and source.
- Every learning objective must have at least one formative assessment item.
- Prerequisites must be introduced before dependent lessons use them.
- Include beginner, intermediate, and advanced differentiation notes in lesson summaries when useful.
- Put uncertain facts in references or claim planning as `unverified`; do not present them as verified.
- Use stable ids: lowercase words separated by hyphens.
- When `generationMode` is `sequential`, verify the dependency chain is complete and acyclic.
- When `generationMode` is `parallel`, verify no lesson has `dependsOnLessonIds`.
- Voice and approach selections shape language and flow but do not change factual content or coverage requirements.
- All lesson ids referenced in `adaptivePaths`, `gamification.achievements`, and `projectCapstones` must exist in the `lessons` array.
