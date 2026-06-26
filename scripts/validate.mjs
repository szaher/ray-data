import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { compile } from "@mdx-js/mdx";
import remarkGfm from "remark-gfm";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const contentDir = path.join(root, "content");

const errors = [];
const warnings = [];

function add(kind, file, message) {
  const target = path.relative(root, file);
  const item = `${target}: ${message}`;
  if (kind === "error") errors.push(item);
  else warnings.push(item);
}

async function exists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

async function listFiles(dir, predicate) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await listFiles(fullPath, predicate)));
    else if (predicate(fullPath)) files.push(fullPath);
  }
  return files;
}

function stripFrontmatter(raw) {
  if (!raw.startsWith("---")) return { frontmatter: "", body: raw };
  const end = raw.indexOf("\n---", 3);
  if (end === -1) return { frontmatter: "", body: raw };
  return {
    frontmatter: raw.slice(3, end).trim(),
    body: raw.slice(end + 4).trimStart(),
  };
}

function findAll(pattern, text) {
  return Array.from(text.matchAll(pattern));
}

function ids(items) {
  return new Set(Array.isArray(items) ? items.map((item) => item?.id).filter(Boolean) : []);
}

function validateRefs(file, refs, validIds, label) {
  if (!Array.isArray(refs)) {
    add("error", file, `Expected ${label} references to be an array.`);
    return;
  }
  for (const ref of refs) {
    if (!validIds.has(ref)) add("error", file, `Unknown ${label} id '${ref}'.`);
  }
}

function validateTutorialSpec(file, spec) {
  const required = [
    "schemaVersion",
    "id",
    "title",
    "audience",
    "learningObjectives",
    "scope",
    "lessons",
    "references",
    "concepts",
    "formativeAssessment",
    "masteryCriteria",
    "accessibility",
    "localization",
  ];
  for (const key of required) {
    if (!(key in spec)) add("error", file, `Missing required field '${key}'.`);
  }
  const VALID_VERSIONS = ["1.0.0", "1.1.0"];
  if (!VALID_VERSIONS.includes(spec.schemaVersion)) add("error", file, `schemaVersion must be one of: ${VALID_VERSIONS.join(", ")}.`);

  const objectiveIds = ids(spec.learningObjectives);
  const assessmentIds = ids(spec.formativeAssessment);
  const conceptIds = ids(spec.concepts);
  const referenceIds = ids(spec.references);
  const answerIds = ids(spec.answers);
  const exerciseIds = ids(spec.exercises);

  for (const objective of spec.learningObjectives ?? []) {
    validateRefs(file, objective.assessmentIds, assessmentIds, "assessment");
  }
  for (const lesson of spec.lessons ?? []) {
    validateRefs(file, lesson.objectiveIds, objectiveIds, "objective");
    validateRefs(file, lesson.conceptIds, conceptIds, "concept");
    validateRefs(file, lesson.referenceIds, referenceIds, "reference");
    if (lesson.artifacts?.mdxPath && !lesson.artifacts.mdxPath.endsWith(".mdx")) {
      add("error", file, `Lesson '${lesson.id}' mdxPath must point to an .mdx file.`);
    }
  }
  for (const item of spec.misconceptions ?? []) validateRefs(file, item.conceptIds, conceptIds, "concept");
  for (const item of spec.workedExamples ?? []) {
    validateRefs(file, item.conceptIds, conceptIds, "concept");
    if (item.referenceIds) validateRefs(file, item.referenceIds, referenceIds, "reference");
  }
  for (const item of spec.exercises ?? []) {
    validateRefs(file, item.conceptIds, conceptIds, "concept");
    if (!answerIds.has(item.answerId)) add("error", file, `Exercise '${item.id}' references missing answer '${item.answerId}'.`);
  }
  for (const item of spec.answers ?? []) {
    if (!exerciseIds.has(item.exerciseId)) add("error", file, `Answer '${item.id}' references missing exercise '${item.exerciseId}'.`);
  }

  // ── Enhancement field validation ────────────────────────────

  const CONTENT_VOICES = ["conversational", "academic", "systematic", "narrative", "minimalist"];
  const INSTRUCTIONAL_APPROACHES = ["socratic", "problem-based", "hands-on", "analogical", "visual-first", "challenge-based"];
  const GENERATION_MODES = ["sequential", "parallel"];
  const MULTIMEDIA_TYPES = ["slides", "narration", "mermaid", "mind-map", "infographic", "timeline", "comparison-matrix", "decision-tree", "concept-map", "interactive-simulation"];
  const ARTIFACT_STATUSES = ["planned", "generated", "approved"];

  const lessonIdSet = ids(spec.lessons);

  if (spec.contentStyle) {
    if (spec.contentStyle.voice && !CONTENT_VOICES.includes(spec.contentStyle.voice)) {
      add("error", file, `Invalid content voice '${spec.contentStyle.voice}'.`);
    }
    if (spec.contentStyle.generationMode && !GENERATION_MODES.includes(spec.contentStyle.generationMode)) {
      add("error", file, `Invalid generation mode '${spec.contentStyle.generationMode}'.`);
    }
    if (Array.isArray(spec.contentStyle.approaches)) {
      for (const approach of spec.contentStyle.approaches) {
        if (!INSTRUCTIONAL_APPROACHES.includes(approach)) {
          add("error", file, `Invalid instructional approach '${approach}'.`);
        }
      }
    }
  }

  for (const lesson of spec.lessons ?? []) {
    if (Array.isArray(lesson.dependsOnLessonIds)) {
      for (const dep of lesson.dependsOnLessonIds) {
        if (!lessonIdSet.has(dep)) add("error", file, `Lesson '${lesson.id}' depends on unknown lesson '${dep}'.`);
        if (dep === lesson.id) add("error", file, `Lesson '${lesson.id}' has a self-dependency.`);
      }
    }
    if (Array.isArray(lesson.artifacts?.items)) {
      for (const ad of lesson.artifacts.items) {
        if (!MULTIMEDIA_TYPES.includes(ad.type)) add("error", file, `Lesson '${lesson.id}' artifact has invalid type '${ad.type}'.`);
        if (!ARTIFACT_STATUSES.includes(ad.status)) add("error", file, `Lesson '${lesson.id}' artifact has invalid status '${ad.status}'.`);
        if (!ad.accessibility?.fallbackText) add("error", file, `Lesson '${lesson.id}' artifact '${ad.id}' is missing accessibility.fallbackText.`);
      }
    }
  }

  // Dependency cycle detection
  const depGraph = new Map();
  for (const lesson of spec.lessons ?? []) {
    depGraph.set(lesson.id, Array.isArray(lesson.dependsOnLessonIds) ? lesson.dependsOnLessonIds : []);
  }
  const visited = new Set();
  const inStack = new Set();
  function hasCycle(nodeId) {
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
      add("error", file, `Dependency cycle detected involving lesson '${id}'.`);
      break;
    }
  }

  // Generation mode compliance
  if (spec.contentStyle?.generationMode === "sequential") {
    const orderedIds = (spec.lessons ?? []).map((l) => l.id);
    for (let i = 1; i < orderedIds.length; i++) {
      const deps = spec.lessons[i].dependsOnLessonIds ?? [];
      if (!deps.includes(orderedIds[i - 1])) {
        add("error", file, `Sequential mode: lesson '${orderedIds[i]}' must depend on predecessor '${orderedIds[i - 1]}'.`);
      }
    }
  } else if (spec.contentStyle?.generationMode === "parallel") {
    for (const lesson of spec.lessons ?? []) {
      if (Array.isArray(lesson.dependsOnLessonIds) && lesson.dependsOnLessonIds.length > 0) {
        add("error", file, `Parallel mode: lesson '${lesson.id}' must not have dependency edges.`);
      }
    }
  }

  // Gamification validation
  if (spec.gamification?.enabled) {
    if (!Array.isArray(spec.gamification.badges) || spec.gamification.badges.length === 0) {
      add("warning", file, "Gamification enabled but no badges defined.");
    }
    for (const ach of spec.gamification.achievements ?? []) {
      for (const lid of ach.unlocksLessonIds ?? []) {
        if (!lessonIdSet.has(lid)) add("error", file, `Achievement '${ach.id}' references unknown lesson '${lid}'.`);
      }
    }
  }

  // Adaptive paths validation
  for (const ap of spec.adaptivePaths ?? []) {
    for (const lid of ap.lessonSequence ?? []) {
      if (!lessonIdSet.has(lid)) add("error", file, `Adaptive path '${ap.id}' references unknown lesson '${lid}'.`);
    }
  }

  // Project capstone validation
  for (const cap of spec.projectCapstones ?? []) {
    for (const lid of cap.prerequisiteLessonIds ?? []) {
      if (!lessonIdSet.has(lid)) add("error", file, `Capstone '${cap.id}' references unknown lesson '${lid}'.`);
    }
    validateRefs(file, cap.conceptIds ?? [], conceptIds, "concept");
  }

  // UDL framework validation
  if (spec.udlFramework) {
    if (Array.isArray(spec.udlFramework.multipleRepresentations) && spec.udlFramework.multipleRepresentations.length < 2) {
      add("warning", file, "UDL framework should include at least 2 representation modes.");
    }
    if (Array.isArray(spec.udlFramework.multipleActions) && spec.udlFramework.multipleActions.length < 2) {
      add("warning", file, "UDL framework should include at least 2 action modes.");
    }
    if (Array.isArray(spec.udlFramework.multipleEngagement) && spec.udlFramework.multipleEngagement.length < 2) {
      add("warning", file, "UDL framework should include at least 2 engagement modes.");
    }
  }
}

async function validateMdx(file, knownCitationIds) {
  const raw = await fs.readFile(file, "utf8");
  const { body } = stripFrontmatter(raw);

  try {
    await compile(body, {
      jsx: true,
      remarkPlugins: [remarkGfm],
      development: false,
    });
  } catch (error) {
    add("error", file, `MDX compilation failed: ${error.message}`);
  }

  const links = [
    ...findAll(/\]\(([^)]+)\)/g, body).map((match) => match[1]),
    ...findAll(/href=["']([^"']+)["']/g, body).map((match) => match[1]),
    ...findAll(/src=["']([^"']+)["']/g, body).map((match) => match[1]),
  ];

  for (const link of links) {
    if (link.startsWith("http://") || link.startsWith("https://") || link.startsWith("#") || link.startsWith("data:")) {
      try {
        new URL(link, "https://example.com");
      } catch {
        add("error", file, `Invalid URL '${link}'.`);
      }
      continue;
    }
    const localTarget = path.join(root, link.replace(/^\//, ""));
    if (!(await exists(localTarget))) add("error", file, `Broken local link or asset '${link}'.`);
  }

  for (const match of findAll(/<Citation[^>]*\sid=["']([^"']+)["'][^>]*>/g, body)) {
    if (!knownCitationIds.has(match[1])) add("error", file, `Citation id '${match[1]}' is not declared in tutorial references.`);
  }

  for (const match of findAll(/<img\b[^>]*>/g, body)) {
    if (!/\salt=["'][^"']+["']/.test(match[0])) add("error", file, "Image is missing non-empty alt text.");
  }

  for (const match of findAll(/<iframe\b[^>]*>/g, body)) {
    if (!/\stitle=["'][^"']+["']/.test(match[0])) add("error", file, "Embedded frame is missing a title.");
  }

  for (const match of findAll(/<Diagram\b/g, body)) {
    const nextComponent = body.slice(match.index + 1).search(/\n\s*<[A-Z/]/);
    const end = nextComponent === -1 ? body.length : match.index + 1 + nextComponent;
    const componentSource = body.slice(match.index, end);
    if (!/\sfallback=/.test(componentSource)) add("error", file, "Diagram is missing fallback text.");
  }

  const riskyClaimPattern = /\b(best|most popular|guaranteed|always|never|latest)\b/i;
  const verifyBlocks = findAll(/<VerifyClaim[\s\S]*?<\/VerifyClaim>/g, body).map((match) => match[0]);
  const bodyWithoutVerifyBlocks = verifyBlocks.reduce((text, block) => text.replace(block, ""), body);
  if (riskyClaimPattern.test(bodyWithoutVerifyBlocks)) {
    add("warning", file, "Potential unsupported claim outside VerifyClaim.");
  }

  const paragraphs = body
    .split(/\n{2,}/)
    .map((item) => item.trim().replace(/\s+/g, " "))
    .filter((item) => item.length > 80 && !item.startsWith("```"));
  const seen = new Set();
  for (const paragraph of paragraphs) {
    if (seen.has(paragraph)) add("warning", file, "Duplicate paragraph content detected.");
    seen.add(paragraph);
  }
}

async function main() {
  const specFiles = await listFiles(path.join(contentDir, "tutorials"), (file) => file.endsWith(".json"));
  const citationIds = new Set();
  for (const file of specFiles) {
    const spec = JSON.parse(await fs.readFile(file, "utf8"));
    validateTutorialSpec(file, spec);
    for (const ref of spec.references ?? []) citationIds.add(ref.id);
  }

  const mdxFiles = await listFiles(contentDir, (file) => file.endsWith(".mdx"));
  for (const file of mdxFiles) await validateMdx(file, citationIds);

  for (const warning of warnings) console.warn(`warning ${warning}`);
  for (const error of errors) console.error(`error ${error}`);

  if (errors.length > 0) {
    console.error(`Validation failed with ${errors.length} error(s) and ${warnings.length} warning(s).`);
    process.exit(1);
  }

  console.log(`Validation passed for ${specFiles.length} tutorial spec(s) and ${mdxFiles.length} MDX file(s).`);
  if (warnings.length > 0) console.log(`${warnings.length} warning(s) reported.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
