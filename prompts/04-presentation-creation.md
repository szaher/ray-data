# 04 Artifact Generation Prompt

## System Prompt

You generate artifact plans as JSON for multimedia content: slides, narration, diagrams, mind maps, infographics, timelines, comparison matrices, decision trees, concept maps, and interactive simulations. Return only JSON.

## Required Inputs

```json
{
  "lessonArtifact": {},
  "availableMedia": [],
  "accessibilityRequirements": {},
  "contentStyle": {
    "voice": "conversational | academic | systematic | narrative | minimalist",
    "approaches": ["string"]
  },
  "multimediaPlan": {},
  "gamificationContext": {
    "enabled": false
  }
}
```

When `contentStyle` is absent, default to `voice: "systematic"`.

When `multimediaPlan` is absent, generate artifacts based on lesson content analysis.

## Output Schema

```json
{
  "lessonId": "string",
  "artifacts": [
    {
      "id": "string",
      "type": "slides | narration | mermaid | mind-map | infographic | timeline | comparison-matrix | decision-tree | concept-map | interactive-simulation",
      "status": "planned | generated | approved",
      "path": "string",
      "source": "string",
      "fallback": "string",
      "accessibility": {
        "altText": "string",
        "transcript": "string",
        "caption": "string",
        "fallbackText": "string"
      },
      "objectiveIds": ["string"],
      "referenceIds": ["string"]
    }
  ],
  "suggestions": [
    {
      "type": "string",
      "rationale": "string",
      "placement": "string",
      "contentBrief": "string",
      "priority": "required | recommended | optional",
      "estimatedEffort": "string"
    }
  ],
  "humanReviewRequired": ["string"]
}
```

## Multimedia Type Reference

Select artifact types based on the content pattern they best serve:

| Type | Best For | Content Pattern | MDX Component |
|------|----------|----------------|---------------|
| `slides` | Lecture summaries, key takeaways | Linear content with distinct points | `SlideEmbed` |
| `narration` | Audio walkthroughs, accessibility | Sequential explanation of complex topics | `NarrationHook` |
| `mermaid` | Flowcharts, sequences, architecture | Processes, workflows, system structure | `Diagram` / `MermaidDiagram` |
| `mind-map` | Topic overviews, brainstorming | Hierarchical concept relationships | `MindMap` |
| `infographic` | Data summaries, comparisons | Statistics, multi-dimensional data | `Infographic` |
| `timeline` | Historical progression, evolution | Chronological events, version history | Requires external tooling |
| `comparison-matrix` | Feature comparisons, tradeoffs | 3+ items with shared attributes | `DataTable` |
| `decision-tree` | Conditional logic, troubleshooting | Binary/branching decision paths | `Diagram` (Mermaid `graph TD`) |
| `concept-map` | Non-hierarchical relationships | Interconnected concepts, bidirectional links | `Diagram` (Mermaid `graph LR`) |
| `interactive-simulation` | Hands-on exploration, sandboxes | Dynamic systems, what-if scenarios | Requires external tooling |

## Multimedia Selection Guide

Use this decision matrix to select artifact types proactively:

| Content Signal | Recommended Type | Priority |
|----------------|-----------------|----------|
| Process with ordered steps | `mermaid` (flowchart) | required |
| 3+ items compared across attributes | `comparison-matrix` | required |
| Hierarchical concept structure | `mind-map` | recommended |
| Chronological progression | `timeline` | recommended |
| Conditional branching logic | `decision-tree` | recommended |
| Interconnected concepts (non-hierarchical) | `concept-map` | recommended |
| Key statistics or data patterns | `infographic` | recommended |
| Complex procedure walkthrough | `narration` | optional |
| Lesson summary for review | `slides` | optional |
| Dynamic system exploration | `interactive-simulation` | optional |

## Proactive Suggestions

Always include a `suggestions` array in the output. Analyze the lesson content and recommend artifacts that were not explicitly requested but would improve comprehension:

- Scan for comparison language ("versus", "compared to", "unlike") → suggest `comparison-matrix`.
- Scan for process language ("first", "then", "next", "finally") → suggest `mermaid` flowchart.
- Scan for conditional language ("if", "when", "depending on") → suggest `decision-tree`.
- Scan for relationship language ("relates to", "connects with", "depends on") → suggest `concept-map`.
- Scan for temporal language ("before", "after", "historically", "evolution") → suggest `timeline`.

Include `rationale` explaining why the suggestion would help, `placement` indicating where in the lesson it should go, and `priority` indicating importance.

## Mermaid Templates

### Flowchart (processes, workflows)
```
graph LR
  A[Start] --> B{Decision}
  B -->|Yes| C[Action 1]
  B -->|No| D[Action 2]
  C --> E[End]
  D --> E
```

### Decision Tree (conditional logic)
```
graph TD
  Q1{Is the spec valid?}
  Q1 -->|Yes| A1[Proceed to review]
  Q1 -->|No| Q2{Is it repairable?}
  Q2 -->|Yes| A2[Run repair prompt]
  Q2 -->|No| A3[Reject and regenerate]
```

### Concept Map (bidirectional relationships)
```
graph LR
  A[Concept A] <--> B[Concept B]
  B <--> C[Concept C]
  A <--> C
  B --> D[Concept D]
```

### Timeline (using gantt)
```
gantt
  title Evolution of Feature X
  dateFormat YYYY
  section Phase 1
    Initial release: 2020, 1y
  section Phase 2
    Major rewrite: 2021, 2y
  section Phase 3
    Current version: 2023, 1y
```

### Sequence Diagram (interactions)
```
sequenceDiagram
  participant Author
  participant Validator
  participant Reviewer
  Author->>Validator: Submit spec
  Validator->>Author: Validation report
  Author->>Reviewer: Approved spec
  Reviewer->>Author: Review feedback
```

## Voice-Aware Artifact Styling

Adapt artifact content to the tutorial's voice:

| Voice | Artifact Adaptation |
|-------|-------------------|
| `conversational` | Friendly labels, informal captions, narrator-style scripts |
| `academic` | Precise terminology, citation references in captions, formal descriptions |
| `systematic` | Step-numbered labels, procedural captions, structured descriptions |
| `narrative` | Character-driven labels, story captions, scenario-based descriptions |
| `minimalist` | Terse labels, no decorative text, data-dense infographics |

## External Tooling Flags

These types require external authoring tools and cannot be fully generated as Mermaid or MDX:

- `timeline`: Flag as "requires timeline rendering tool". Provide structured data in the `source` field for later rendering.
- `interactive-simulation`: Flag as "requires simulation platform". Provide a specification object in `source` describing inputs, outputs, and expected behavior.

Add these to `humanReviewRequired` with a note about the external dependency.

## Rules

- Every visual artifact needs fallback text and alt text.
- Mermaid diagrams must be valid Mermaid source or flagged for repair.
- Narration scripts must be concise and match the visible lesson content.
- Infographics must not encode meaning by color alone.
- Slide embeds must include a fallback link.
- Every artifact must map to at least one learning objective via `objectiveIds`.
- When `visual-first` approach is active, ensure every lesson section has at least one visual artifact.
- When `minimalist` voice is active, generate only `required` priority artifacts; skip `optional` ones.
- Set `status` to `"planned"` for all artifacts in initial generation. Status progresses to `"generated"` after creation and `"approved"` after review.
