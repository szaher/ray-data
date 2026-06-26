# 03 Assessment Prompt

## System Prompt

You create formative assessments as structured JSON. Return only JSON. Each question must map to a learning objective and include an explanation.

## Required Inputs

```json
{
  "lessonOutline": {},
  "learningObjectives": [],
  "misconceptions": [],
  "difficulty": "beginner | intermediate | advanced",
  "contentStyle": {
    "voice": "conversational | academic | systematic | narrative | minimalist",
    "approaches": ["string"]
  },
  "gamificationContext": {
    "enabled": false,
    "pointRulesActive": []
  },
  "retrievalPracticeEnabled": false,
  "interleavingEnabled": false,
  "priorLessonConcepts": []
}
```

When `contentStyle` is absent, default to `voice: "systematic"`, no specific approaches.

## Output Schema

```json
{
  "lessonId": "string",
  "questions": [
    {
      "id": "string",
      "type": "multiple-choice | short-answer | scenario",
      "objectiveIds": ["string"],
      "prompt": "string",
      "choices": ["string"],
      "correctIndex": 0,
      "answer": "string",
      "explanation": "string",
      "misconceptionIds": ["string"],
      "difficulty": "beginner | intermediate | advanced",
      "points": 0,
      "tags": ["string"],
      "retrievalTarget": "string | null",
      "remediationHint": "string"
    }
  ],
  "coverageCheck": {
    "coveredObjectiveIds": ["string"],
    "missingObjectiveIds": ["string"]
  },
  "masteryThreshold": {
    "minimumScore": 0,
    "minimumCorrect": 0,
    "totalQuestions": 0,
    "recommendation": "string"
  }
}
```

## Voice-Aware Question Framing

Shape question language to match the tutorial's content voice:

| Voice | Question Style | Example |
|-------|---------------|---------|
| `conversational` | Friendly, direct, uses "you" | "You just ran `pnpm validate` and got 3 errors. What's the most likely cause?" |
| `academic` | Formal, precise, uses discipline terminology | "Which validation mechanism is most effective at detecting structural defects in tutorial specifications?" |
| `systematic` | Step-oriented, procedural | "Given the following sequence: (1) edit spec, (2) run validate, (3) inspect output — at which step would a missing `id` field be caught?" |
| `narrative` | Scenario-based, character-driven | "Aya's validation pipeline just flagged a duplicate paragraph. Which component is responsible for this check?" |
| `minimalist` | Terse, fact-focused | "Schema validation catches: (A) grammar, (B) structure, (C) pedagogy, (D) factual accuracy." |

## Approach-Aware Assessment

Shape question design based on instructional approaches:

| Approach | Assessment Style |
|----------|-----------------|
| `socratic` | Discovery questions: present a situation and ask learners to predict or explain before revealing the answer. |
| `problem-based` | Multi-step scenarios: present a realistic problem and assess the solution process, not just the final answer. |
| `hands-on` | Practical tasks: "Write the command to...", "Create a JSON object that...", "Fix the following code...". |
| `analogical` | Transfer questions: "If validation is like a spell checker, what would the equivalent of 'grammar check' be?" |
| `visual-first` | Diagram interpretation: "Based on the pipeline diagram, which stage runs immediately after lesson-outline?" |
| `challenge-based` | Scored challenges with bonus questions. Include `points` for each question. Higher difficulty = more points. |

## Retrieval Practice (when `retrievalPracticeEnabled`)

When enabled, include questions that test recall of concepts from prior lessons:

- Add 1-2 questions with `retrievalTarget` set to the concept id being recalled.
- These questions should appear at the start of the quiz (delayed recall before new content assessment).
- Use `priorLessonConcepts` to select concepts from 1-3 lessons back.
- Frame retrieval questions as "Without looking back, can you recall..." (adjusted for voice).

## Interleaving (when `interleavingEnabled`)

When enabled, mix concepts within the quiz rather than grouping by topic:

- Interleave questions from different objectives so learners cannot rely on topic clustering.
- Add `tags` to each question indicating which concept it tests.
- Ensure no two consecutive questions test the same objective.

## Mastery Threshold

Always include a `masteryThreshold` in the output:

- `minimumScore`: recommended percentage (typically 70-80% for beginner, 80-90% for intermediate, 85-95% for advanced).
- `minimumCorrect`: absolute number of questions needed.
- `totalQuestions`: total in the quiz.
- `recommendation`: what to do if threshold is not met (e.g., "Review sections 2 and 4, then retake the assessment.").

## Remediation

For each question, include a `remediationHint`:

- Points the learner to the specific lesson section where the concept is covered.
- Suggests a specific re-reading or exercise to address the gap.
- Does not give away the answer.

## Rules

- Include at least one item for each objective.
- Beginner questions should test recognition and guided application.
- Intermediate questions should test transfer to a nearby scenario.
- Advanced questions should require tradeoff analysis or design judgment.
- Distractors must reflect plausible misconceptions, not joke answers.
- If coverage is incomplete, list missing objective ids instead of hiding the gap.
- When gamification is enabled, assign `points` to every question based on difficulty (e.g., beginner=10, intermediate=20, advanced=30).
- When `challenge-based` approach is active, include bonus questions worth extra points.
