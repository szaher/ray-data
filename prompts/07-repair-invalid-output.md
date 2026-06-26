# 07 Repair Invalid Output Prompt

## System Prompt

You repair invalid structured output. Return only corrected JSON that conforms to the requested schema. Do not explain the repair.

## Required Inputs

```json
{
  "schemaName": "string",
  "schema": {},
  "invalidOutput": {},
  "validationIssues": [
    {
      "path": "string",
      "message": "string",
      "severity": "error | warning"
    }
  ],
  "originalTask": {}
}
```

## Repair Rules

- Preserve valid ids and content where possible.
- Fill missing required fields with conservative placeholders only when the original task supports them.
- Remove prose outside the JSON object.
- Do not invent citations. If a citation is missing, mark the related claim as `verify`.
- If a required cross-reference cannot be repaired from context, add a review note and use an existing valid id only when semantically correct.
- Maintain beginner, intermediate, and advanced differentiation if it appeared in the original task.

## Enhancement Field Preservation (v1.1.0)

When repairing a v1.1.0 spec or artifact, preserve these fields if they were present in the invalid output:

- `contentStyle` (voice, approaches, generationMode) — do not change style values unless they are the source of the validation error.
- `gamification` — preserve badge definitions, point rules, achievements. Fix only broken references (unknown lesson ids, missing required fields).
- `adaptivePaths` — preserve path definitions. Fix unknown lesson references by removing invalid ids and adding a review note.
- `spacedRepetition`, `microlearning` — preserve configuration. Do not remove these fields during repair.
- `projectCapstones` — fix unknown lesson/concept references by removing invalid ids and adding a review note.
- `udlFramework` — preserve as-is unless arrays are malformed.
- `collaborativeLearning` — preserve as-is.
- `dependsOnLessonIds` — fix unknown ids by removing them. If this breaks sequential mode compliance, add a review note.
- `artifacts.items` (ArtifactDescriptor array) — preserve valid descriptors. Fix invalid `type` values by replacing with the closest valid type or removing the descriptor with a review note. Ensure `accessibility.fallbackText` is present on all descriptors.
- `multimediaPlan` — preserve valid recommendations. Fix invalid types.
- `metacognition`, `scaffolding` — preserve as-is.

## Schema Version Handling

- If the invalid output has enhancement fields but `schemaVersion` is `"1.0.0"`, upgrade to `"1.1.0"`.
- If the invalid output has `schemaVersion: "1.1.0"` but no enhancement fields, downgrade to `"1.0.0"` only if all enhancement fields are truly absent.
- Valid schema versions are `"1.0.0"` and `"1.1.0"`. Replace any other version with the appropriate one based on content.

## Dependency Chain Repair

If the output has `generationMode: "sequential"` but the dependency chain is broken:

1. Reconstruct the chain: lesson N depends on lesson N-1.
2. Remove any dependency cycles.
3. Remove self-dependencies.
4. Add a review note listing all dependency changes made.

If the output has `generationMode: "parallel"` but lessons have `dependsOnLessonIds`:

1. Clear all `dependsOnLessonIds` arrays.
2. Add a review note explaining the change.

## Output

Return the repaired JSON object for `schemaName`.
