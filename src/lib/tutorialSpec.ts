import type {
  Difficulty,
  TutorialSpec,
  ValidationIssue,
  ValidationResult,
} from "@/types/tutorial";
import {
  CONTENT_VOICES,
  INSTRUCTIONAL_APPROACHES,
  GENERATION_MODES,
  MULTIMEDIA_TYPES,
  ARTIFACT_STATUSES,
} from "@/types/tutorial";

const DIFFICULTIES: Difficulty[] = ["beginner", "intermediate", "advanced"];
const SOURCE_QUALITIES = [
  "primary",
  "official-docs",
  "peer-reviewed",
  "expert",
  "secondary",
  "unverified",
];
const BLOOM_LEVELS = ["remember", "understand", "apply", "analyze", "evaluate", "create"];
const VALID_SCHEMA_VERSIONS = ["1.0.0", "1.1.0"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function issue(path: string, message: string, severity: "error" | "warning" = "error"): ValidationIssue {
  return { path, message, severity };
}

function requireString(
  value: Record<string, unknown>,
  key: string,
  path: string,
  issues: ValidationIssue[]
) {
  if (typeof value[key] !== "string" || String(value[key]).trim().length === 0) {
    issues.push(issue(`${path}.${key}`, "Expected a non-empty string."));
  }
}

function requireStringArray(
  value: Record<string, unknown>,
  key: string,
  path: string,
  issues: ValidationIssue[],
  minLength = 0
) {
  const arr = value[key];
  if (!Array.isArray(arr) || arr.some((item) => typeof item !== "string" || item.trim() === "")) {
    issues.push(issue(`${path}.${key}`, "Expected an array of non-empty strings."));
    return;
  }
  if (arr.length < minLength) {
    issues.push(issue(`${path}.${key}`, `Expected at least ${minLength} item(s).`));
  }
}

function collectIds(items: unknown, path: string, issues: ValidationIssue[]): Set<string> {
  const ids = new Set<string>();
  if (!Array.isArray(items)) {
    issues.push(issue(path, "Expected an array."));
    return ids;
  }

  items.forEach((item, index) => {
    if (!isRecord(item) || typeof item.id !== "string" || item.id.trim() === "") {
      issues.push(issue(`${path}[${index}].id`, "Expected a non-empty id."));
      return;
    }
    if (ids.has(item.id)) {
      issues.push(issue(`${path}[${index}].id`, `Duplicate id '${item.id}'.`));
    }
    ids.add(item.id);
  });

  return ids;
}

function requireRefs(
  refs: unknown,
  ids: Set<string>,
  path: string,
  label: string,
  issues: ValidationIssue[]
) {
  if (!Array.isArray(refs)) {
    issues.push(issue(path, "Expected an array of ids."));
    return;
  }
  refs.forEach((ref, index) => {
    if (typeof ref !== "string" || !ids.has(ref)) {
      issues.push(issue(`${path}[${index}]`, `Unknown ${label} id '${String(ref)}'.`));
    }
  });
}

export function validateTutorialSpec(input: unknown): ValidationResult {
  const issues: ValidationIssue[] = [];

  if (!isRecord(input)) {
    return { ok: false, issues: [issue("$", "Expected a tutorial specification object.")] };
  }

  if (typeof input.schemaVersion !== "string" || !VALID_SCHEMA_VERSIONS.includes(input.schemaVersion)) {
    issues.push(issue("$.schemaVersion", `Expected schemaVersion ${VALID_SCHEMA_VERSIONS.map(v => `'${v}'`).join(" or ")}.`));
  }

  ["id", "title", "description"].forEach((key) => requireString(input, key, "$", issues));
  requireStringArray(input, "prerequisites", "$", issues);
  requireStringArray(input, "recap", "$", issues, 1);
  requireStringArray(input, "nextSteps", "$", issues, 1);

  if (!isRecord(input.audience)) {
    issues.push(issue("$.audience", "Expected audience metadata."));
  } else {
    requireString(input.audience, "primary", "$.audience", issues);
    requireStringArray(input.audience, "priorKnowledge", "$.audience", issues);
  }

  if (!isRecord(input.scope)) {
    issues.push(issue("$.scope", "Expected scope metadata."));
  } else {
    requireStringArray(input.scope, "inScope", "$.scope", issues, 1);
    requireStringArray(input.scope, "nonGoals", "$.scope", issues, 1);
  }

  const objectiveIds = collectIds(input.learningObjectives, "$.learningObjectives", issues);
  const lessonIds = collectIds(input.lessons, "$.lessons", issues);
  const referenceIds = collectIds(input.references, "$.references", issues);
  const conceptIds = collectIds(input.concepts, "$.concepts", issues);
  const answerIds = collectIds(input.answers, "$.answers", issues);
  collectIds(input.misconceptions, "$.misconceptions", issues);
  collectIds(input.workedExamples, "$.workedExamples", issues);
  const exerciseIds = collectIds(input.exercises, "$.exercises", issues);
  collectIds(input.formativeAssessment, "$.formativeAssessment", issues);
  collectIds(input.masteryCriteria, "$.masteryCriteria", issues);

  if (lessonIds.size === 0) {
    issues.push(issue("$.lessons", "Expected at least one lesson."));
  }

  if (Array.isArray(input.learningObjectives)) {
    input.learningObjectives.forEach((item, index) => {
      if (!isRecord(item)) return;
      requireString(item, "description", `$.learningObjectives[${index}]`, issues);
      if (typeof item.bloomLevel !== "string" || !BLOOM_LEVELS.includes(item.bloomLevel)) {
        issues.push(issue(`$.learningObjectives[${index}].bloomLevel`, "Expected a supported Bloom level."));
      }
      requireRefs(item.assessmentIds, collectIds(input.formativeAssessment, "$.formativeAssessment", []), `$.learningObjectives[${index}].assessmentIds`, "assessment", issues);
    });
  }

  if (Array.isArray(input.references)) {
    input.references.forEach((item, index) => {
      if (!isRecord(item)) return;
      requireString(item, "title", `$.references[${index}]`, issues);
      requireString(item, "url", `$.references[${index}]`, issues);
      requireString(item, "accessedAt", `$.references[${index}]`, issues);
      if (typeof item.quality !== "string" || !SOURCE_QUALITIES.includes(item.quality)) {
        issues.push(issue(`$.references[${index}].quality`, "Expected a supported source-quality label."));
      }
    });
  }

  if (Array.isArray(input.lessons)) {
    input.lessons.forEach((item, index) => {
      if (!isRecord(item)) return;
      const path = `$.lessons[${index}]`;
      ["slug", "title", "summary"].forEach((key) => requireString(item, key, path, issues));
      if (typeof item.estimatedMinutes !== "number" || item.estimatedMinutes < 1) {
        issues.push(issue(`${path}.estimatedMinutes`, "Expected a positive number."));
      }
      if (typeof item.difficulty !== "string" || !DIFFICULTIES.includes(item.difficulty as Difficulty)) {
        issues.push(issue(`${path}.difficulty`, "Expected beginner, intermediate, or advanced."));
      }
      requireStringArray(item, "prerequisites", path, issues);
      requireRefs(item.objectiveIds, objectiveIds, `${path}.objectiveIds`, "objective", issues);
      requireRefs(item.conceptIds, conceptIds, `${path}.conceptIds`, "concept", issues);
      requireRefs(item.referenceIds, referenceIds, `${path}.referenceIds`, "reference", issues);
      if (!isRecord(item.artifacts) || typeof item.artifacts.mdxPath !== "string") {
        issues.push(issue(`${path}.artifacts.mdxPath`, "Expected an MDX artifact path."));
      }
    });
  }

  if (Array.isArray(input.concepts)) {
    input.concepts.forEach((item, index) => {
      if (!isRecord(item)) return;
      requireString(item, "term", `$.concepts[${index}]`, issues);
      requireString(item, "definition", `$.concepts[${index}]`, issues);
      if (item.relatedConceptIds) {
        requireRefs(item.relatedConceptIds, conceptIds, `$.concepts[${index}].relatedConceptIds`, "concept", issues);
      }
    });
  }

  if (Array.isArray(input.misconceptions)) {
    input.misconceptions.forEach((item, index) => {
      if (!isRecord(item)) return;
      requireString(item, "misconception", `$.misconceptions[${index}]`, issues);
      requireString(item, "correction", `$.misconceptions[${index}]`, issues);
      requireRefs(item.conceptIds, conceptIds, `$.misconceptions[${index}].conceptIds`, "concept", issues);
    });
  }

  if (Array.isArray(input.workedExamples)) {
    input.workedExamples.forEach((item, index) => {
      if (!isRecord(item)) return;
      const path = `$.workedExamples[${index}]`;
      ["title", "prompt", "explanation"].forEach((key) => requireString(item, key, path, issues));
      requireStringArray(item, "steps", path, issues, 1);
      requireRefs(item.conceptIds, conceptIds, `${path}.conceptIds`, "concept", issues);
      if (item.referenceIds) {
        requireRefs(item.referenceIds, referenceIds, `${path}.referenceIds`, "reference", issues);
      }
    });
  }

  if (Array.isArray(input.exercises)) {
    input.exercises.forEach((item, index) => {
      if (!isRecord(item)) return;
      const path = `$.exercises[${index}]`;
      requireString(item, "prompt", path, issues);
      if (typeof item.difficulty !== "string" || !DIFFICULTIES.includes(item.difficulty as Difficulty)) {
        issues.push(issue(`${path}.difficulty`, "Expected beginner, intermediate, or advanced."));
      }
      requireRefs(item.conceptIds, conceptIds, `${path}.conceptIds`, "concept", issues);
      if (typeof item.answerId !== "string" || !answerIds.has(item.answerId)) {
        issues.push(issue(`${path}.answerId`, "Expected an answer id that exists in $.answers."));
      }
    });
  }

  if (Array.isArray(input.answers)) {
    input.answers.forEach((item, index) => {
      if (!isRecord(item)) return;
      requireString(item, "answer", `$.answers[${index}]`, issues);
      if (typeof item.exerciseId !== "string" || !exerciseIds.has(item.exerciseId)) {
        issues.push(issue(`$.answers[${index}].exerciseId`, "Expected an exercise id that exists in $.exercises."));
      }
    });
  }

  if (Array.isArray(input.formativeAssessment)) {
    input.formativeAssessment.forEach((item, index) => {
      if (!isRecord(item)) return;
      requireString(item, "prompt", `$.formativeAssessment[${index}]`, issues);
      requireRefs(item.objectiveIds, objectiveIds, `$.formativeAssessment[${index}].objectiveIds`, "objective", issues);
    });
  }

  if (Array.isArray(input.masteryCriteria)) {
    input.masteryCriteria.forEach((item, index) => {
      if (!isRecord(item)) return;
      requireString(item, "description", `$.masteryCriteria[${index}]`, issues);
      requireString(item, "threshold", `$.masteryCriteria[${index}]`, issues);
      requireRefs(item.objectiveIds, objectiveIds, `$.masteryCriteria[${index}].objectiveIds`, "objective", issues);
    });
  }

  ["accessibility", "localization"].forEach((key) => {
    if (!isRecord(input[key])) {
      issues.push(issue(`$.${key}`, `Expected ${key} metadata.`));
    }
  });

  // ── Optional enhancement fields (v1.1.0) ──────────────────────

  if (isRecord(input.contentStyle)) {
    const cs = input.contentStyle;
    if (cs.voice !== undefined && (typeof cs.voice !== "string" || !(CONTENT_VOICES as readonly string[]).includes(cs.voice))) {
      issues.push(issue("$.contentStyle.voice", `Unsupported voice. Expected one of: ${CONTENT_VOICES.join(", ")}.`));
    }
    if (cs.generationMode !== undefined && (typeof cs.generationMode !== "string" || !(GENERATION_MODES as readonly string[]).includes(cs.generationMode))) {
      issues.push(issue("$.contentStyle.generationMode", `Unsupported generation mode. Expected one of: ${GENERATION_MODES.join(", ")}.`));
    }
    if (Array.isArray(cs.approaches)) {
      cs.approaches.forEach((a: unknown, i: number) => {
        if (typeof a !== "string" || !(INSTRUCTIONAL_APPROACHES as readonly string[]).includes(a)) {
          issues.push(issue(`$.contentStyle.approaches[${i}]`, `Unsupported approach. Expected one of: ${INSTRUCTIONAL_APPROACHES.join(", ")}.`));
        }
      });
    }
  }

  // Lesson dependency validation
  if (Array.isArray(input.lessons)) {
    const lessonIdList = (input.lessons as Record<string, unknown>[])
      .filter(isRecord)
      .map((l) => l.id as string)
      .filter(Boolean);

    input.lessons.forEach((item: unknown, index: number) => {
      if (!isRecord(item)) return;
      const deps = item.dependsOnLessonIds;
      if (Array.isArray(deps)) {
        deps.forEach((dep: unknown, di: number) => {
          if (typeof dep !== "string" || !lessonIds.has(dep)) {
            issues.push(issue(`$.lessons[${index}].dependsOnLessonIds[${di}]`, `Unknown lesson id '${String(dep)}'.`));
          }
          if (dep === item.id) {
            issues.push(issue(`$.lessons[${index}].dependsOnLessonIds[${di}]`, "Self-dependency is not allowed."));
          }
        });
      }

      // Validate artifact descriptors
      if (isRecord(item.artifacts) && Array.isArray((item.artifacts as Record<string, unknown>).items)) {
        ((item.artifacts as Record<string, unknown>).items as unknown[]).forEach((ad: unknown, ai: number) => {
          if (!isRecord(ad)) return;
          if (typeof ad.type !== "string" || !(MULTIMEDIA_TYPES as readonly string[]).includes(ad.type)) {
            issues.push(issue(`$.lessons[${index}].artifacts.items[${ai}].type`, `Unsupported multimedia type. Expected one of: ${MULTIMEDIA_TYPES.join(", ")}.`));
          }
          if (typeof ad.status !== "string" || !(ARTIFACT_STATUSES as readonly string[]).includes(ad.status)) {
            issues.push(issue(`$.lessons[${index}].artifacts.items[${ai}].status`, `Unsupported artifact status. Expected one of: ${ARTIFACT_STATUSES.join(", ")}.`));
          }
          if (!isRecord(ad.accessibility) || typeof (ad.accessibility as Record<string, unknown>).fallbackText !== "string") {
            issues.push(issue(`$.lessons[${index}].artifacts.items[${ai}].accessibility.fallbackText`, "Artifact descriptor must include accessibility.fallbackText."));
          }
        });
      }
    });

    // Cycle detection in lesson dependencies
    const depGraph = new Map<string, string[]>();
    (input.lessons as Record<string, unknown>[]).forEach((item) => {
      if (!isRecord(item) || typeof item.id !== "string") return;
      const deps = Array.isArray(item.dependsOnLessonIds)
        ? (item.dependsOnLessonIds as string[]).filter((d) => typeof d === "string")
        : [];
      depGraph.set(item.id, deps);
    });

    const visited = new Set<string>();
    const inStack = new Set<string>();
    function hasCycle(nodeId: string): boolean {
      if (inStack.has(nodeId)) return true;
      if (visited.has(nodeId)) return false;
      visited.add(nodeId);
      inStack.add(nodeId);
      for (const dep of depGraph.get(nodeId) ?? []) {
        if (hasCycle(dep)) return true;
      }
      inStack.delete(nodeId);
      return false;
    }
    for (const id of depGraph.keys()) {
      if (hasCycle(id)) {
        issues.push(issue("$.lessons", `Dependency cycle detected involving lesson '${id}'.`));
        break;
      }
    }

    // Generation mode compliance
    if (isRecord(input.contentStyle)) {
      const mode = (input.contentStyle as Record<string, unknown>).generationMode;
      if (mode === "sequential") {
        for (let i = 1; i < lessonIdList.length; i++) {
          const lesson = (input.lessons as Record<string, unknown>[])[i];
          if (!isRecord(lesson)) continue;
          const deps = Array.isArray(lesson.dependsOnLessonIds)
            ? (lesson.dependsOnLessonIds as string[])
            : [];
          if (!deps.includes(lessonIdList[i - 1])) {
            issues.push(issue(
              `$.lessons[${i}].dependsOnLessonIds`,
              `Sequential mode: lesson '${lessonIdList[i]}' must depend on predecessor '${lessonIdList[i - 1]}'.`,
            ));
          }
        }
      } else if (mode === "parallel") {
        (input.lessons as Record<string, unknown>[]).forEach((item, idx) => {
          if (!isRecord(item)) return;
          if (Array.isArray(item.dependsOnLessonIds) && (item.dependsOnLessonIds as unknown[]).length > 0) {
            issues.push(issue(`$.lessons[${idx}].dependsOnLessonIds`, "Parallel mode: lessons must not have dependency edges."));
          }
        });
      }
    }
  }

  // Gamification validation
  if (isRecord(input.gamification)) {
    const gam = input.gamification as Record<string, unknown>;
    if (gam.enabled === true) {
      if (!Array.isArray(gam.badges) || gam.badges.length === 0) {
        issues.push(issue("$.gamification.badges", "Gamification enabled but no badges defined.", "warning"));
      }
      if (Array.isArray(gam.achievements)) {
        gam.achievements.forEach((ach: unknown, ai: number) => {
          if (!isRecord(ach)) return;
          if (Array.isArray(ach.unlocksLessonIds)) {
            (ach.unlocksLessonIds as unknown[]).forEach((lid: unknown, li: number) => {
              if (typeof lid !== "string" || !lessonIds.has(lid)) {
                issues.push(issue(`$.gamification.achievements[${ai}].unlocksLessonIds[${li}]`, `Unknown lesson id '${String(lid)}'.`));
              }
            });
          }
        });
      }
    }
  }

  // Adaptive paths validation
  if (Array.isArray(input.adaptivePaths)) {
    input.adaptivePaths.forEach((ap: unknown, ai: number) => {
      if (!isRecord(ap)) return;
      if (Array.isArray(ap.lessonSequence)) {
        (ap.lessonSequence as unknown[]).forEach((lid: unknown, li: number) => {
          if (typeof lid !== "string" || !lessonIds.has(lid)) {
            issues.push(issue(`$.adaptivePaths[${ai}].lessonSequence[${li}]`, `Unknown lesson id '${String(lid)}'.`));
          }
        });
      }
    });
  }

  // Project capstone validation
  if (Array.isArray(input.projectCapstones)) {
    input.projectCapstones.forEach((cap: unknown, ci: number) => {
      if (!isRecord(cap)) return;
      if (Array.isArray(cap.prerequisiteLessonIds)) {
        (cap.prerequisiteLessonIds as unknown[]).forEach((lid: unknown, li: number) => {
          if (typeof lid !== "string" || !lessonIds.has(lid)) {
            issues.push(issue(`$.projectCapstones[${ci}].prerequisiteLessonIds[${li}]`, `Unknown lesson id '${String(lid)}'.`));
          }
        });
      }
      requireRefs(cap.conceptIds, conceptIds, `$.projectCapstones[${ci}].conceptIds`, "concept", issues);
    });
  }

  // UDL framework validation
  if (isRecord(input.udlFramework)) {
    const udl = input.udlFramework as Record<string, unknown>;
    if (Array.isArray(udl.multipleRepresentations) && udl.multipleRepresentations.length < 2) {
      issues.push(issue("$.udlFramework.multipleRepresentations", "UDL framework should include at least 2 representation modes.", "warning"));
    }
    if (Array.isArray(udl.multipleActions) && udl.multipleActions.length < 2) {
      issues.push(issue("$.udlFramework.multipleActions", "UDL framework should include at least 2 action modes.", "warning"));
    }
    if (Array.isArray(udl.multipleEngagement) && udl.multipleEngagement.length < 2) {
      issues.push(issue("$.udlFramework.multipleEngagement", "UDL framework should include at least 2 engagement modes.", "warning"));
    }
  }

  return { ok: issues.every((item) => item.severity !== "error"), issues };
}

export function migrateSpec(input: Record<string, unknown>): Record<string, unknown> {
  if (input.schemaVersion === "1.0.0") {
    return {
      ...input,
      contentStyle: input.contentStyle ?? undefined,
      gamification: input.gamification ?? undefined,
      adaptivePaths: input.adaptivePaths ?? undefined,
      spacedRepetition: input.spacedRepetition ?? undefined,
      microlearning: input.microlearning ?? undefined,
      projectCapstones: input.projectCapstones ?? undefined,
      udlFramework: input.udlFramework ?? undefined,
      collaborativeLearning: input.collaborativeLearning ?? undefined,
    };
  }
  return input;
}

export function assertTutorialSpec(input: unknown): TutorialSpec {
  const result = validateTutorialSpec(input);
  if (!result.ok) {
    const message = result.issues.map((item) => `${item.path}: ${item.message}`).join("\n");
    throw new Error(`Invalid tutorial specification:\n${message}`);
  }
  return input as TutorialSpec;
}
