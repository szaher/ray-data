import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { compile } from "@mdx-js/mdx";
import remarkGfm from "remark-gfm";

import {
  parseFrontmatter,
  checkFrontmatter,
  findAll,
  checkDiagramFallback,
  extractLinks,
  classifyLink,
  classifyExternalUrl,
  detectLinkIssues,
  checkRiskyClaimPatterns,
  checkDuplicateParagraphs,
} from "./validate-lib.mjs";

import { checkLocalLinks, checkExternalLinks } from "./validate-io.mjs";

async function listFiles(dir, predicate) {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await listFiles(fullPath, predicate)));
    else if (predicate(fullPath)) files.push(fullPath);
  }
  return files;
}

function ids(items) {
  return new Set(
    Array.isArray(items) ? items.map((item) => item?.id).filter(Boolean) : [],
  );
}

function validateRefs(file, refs, validIds, label, errors) {
  if (!Array.isArray(refs)) {
    errors.push({ file, message: `Expected ${label} references to be an array.` });
    return;
  }
  for (const ref of refs) {
    if (!validIds.has(ref)) {
      errors.push({ file, message: `Unknown ${label} id '${ref}'.` });
    }
  }
}

function validateTutorialSpec(file, spec, errors, warnings) {
  const required = [
    "schemaVersion", "id", "title", "audience", "learningObjectives",
    "scope", "lessons", "references", "concepts", "formativeAssessment",
    "masteryCriteria", "accessibility", "localization",
  ];
  for (const key of required) {
    if (!(key in spec)) errors.push({ file, message: `Missing required field '${key}'.` });
  }
  const VALID_VERSIONS = ["1.0.0", "1.1.0"];
  if (!VALID_VERSIONS.includes(spec.schemaVersion)) {
    errors.push({ file, message: `schemaVersion must be one of: ${VALID_VERSIONS.join(", ")}.` });
  }

  const objectiveIds = ids(spec.learningObjectives);
  const assessmentIds = ids(spec.formativeAssessment);
  const conceptIds = ids(spec.concepts);
  const referenceIds = ids(spec.references);
  const answerIds = ids(spec.answers);
  const exerciseIds = ids(spec.exercises);

  for (const objective of spec.learningObjectives ?? []) {
    validateRefs(file, objective.assessmentIds, assessmentIds, "assessment", errors);
  }
  for (const lesson of spec.lessons ?? []) {
    validateRefs(file, lesson.objectiveIds, objectiveIds, "objective", errors);
    validateRefs(file, lesson.conceptIds, conceptIds, "concept", errors);
    validateRefs(file, lesson.referenceIds, referenceIds, "reference", errors);
    if (lesson.artifacts?.mdxPath && !lesson.artifacts.mdxPath.endsWith(".mdx")) {
      errors.push({ file, message: `Lesson '${lesson.id}' mdxPath must point to an .mdx file.` });
    }
  }
  for (const item of spec.misconceptions ?? []) {
    validateRefs(file, item.conceptIds, conceptIds, "concept", errors);
  }
  for (const item of spec.workedExamples ?? []) {
    validateRefs(file, item.conceptIds, conceptIds, "concept", errors);
    if (item.referenceIds) validateRefs(file, item.referenceIds, referenceIds, "reference", errors);
  }
  for (const item of spec.exercises ?? []) {
    validateRefs(file, item.conceptIds, conceptIds, "concept", errors);
    if (!answerIds.has(item.answerId)) {
      errors.push({ file, message: `Exercise '${item.id}' references missing answer '${item.answerId}'.` });
    }
  }
  for (const item of spec.answers ?? []) {
    if (!exerciseIds.has(item.exerciseId)) {
      errors.push({ file, message: `Answer '${item.id}' references missing exercise '${item.exerciseId}'.` });
    }
  }

  const CONTENT_VOICES = ["conversational", "academic", "systematic", "narrative", "minimalist"];
  const INSTRUCTIONAL_APPROACHES = ["socratic", "problem-based", "hands-on", "analogical", "visual-first", "challenge-based"];
  const GENERATION_MODES = ["sequential", "parallel"];
  const MULTIMEDIA_TYPES = ["slides", "narration", "mermaid", "mind-map", "infographic", "timeline", "comparison-matrix", "decision-tree", "concept-map", "interactive-simulation"];
  const ARTIFACT_STATUSES = ["planned", "generated", "approved"];

  const lessonIdSet = ids(spec.lessons);

  if (spec.contentStyle) {
    if (spec.contentStyle.voice && !CONTENT_VOICES.includes(spec.contentStyle.voice)) {
      errors.push({ file, message: `Invalid content voice '${spec.contentStyle.voice}'.` });
    }
    if (spec.contentStyle.generationMode && !GENERATION_MODES.includes(spec.contentStyle.generationMode)) {
      errors.push({ file, message: `Invalid generation mode '${spec.contentStyle.generationMode}'.` });
    }
    if (Array.isArray(spec.contentStyle.approaches)) {
      for (const approach of spec.contentStyle.approaches) {
        if (!INSTRUCTIONAL_APPROACHES.includes(approach)) {
          errors.push({ file, message: `Invalid instructional approach '${approach}'.` });
        }
      }
    }
  }

  for (const lesson of spec.lessons ?? []) {
    if (Array.isArray(lesson.dependsOnLessonIds)) {
      for (const dep of lesson.dependsOnLessonIds) {
        if (!lessonIdSet.has(dep)) errors.push({ file, message: `Lesson '${lesson.id}' depends on unknown lesson '${dep}'.` });
        if (dep === lesson.id) errors.push({ file, message: `Lesson '${lesson.id}' has a self-dependency.` });
      }
    }
    if (Array.isArray(lesson.artifacts?.items)) {
      for (const ad of lesson.artifacts.items) {
        if (!MULTIMEDIA_TYPES.includes(ad.type)) errors.push({ file, message: `Lesson '${lesson.id}' artifact has invalid type '${ad.type}'.` });
        if (!ARTIFACT_STATUSES.includes(ad.status)) errors.push({ file, message: `Lesson '${lesson.id}' artifact has invalid status '${ad.status}'.` });
        if (!ad.accessibility?.fallbackText) errors.push({ file, message: `Lesson '${lesson.id}' artifact '${ad.id}' is missing accessibility.fallbackText.` });
      }
    }
  }

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
      errors.push({ file, message: `Dependency cycle detected involving lesson '${id}'.` });
      break;
    }
  }

  if (spec.contentStyle?.generationMode === "sequential") {
    const orderedIds = (spec.lessons ?? []).map((l) => l.id);
    for (let i = 1; i < orderedIds.length; i++) {
      const deps = spec.lessons[i].dependsOnLessonIds ?? [];
      if (!deps.includes(orderedIds[i - 1])) {
        errors.push({ file, message: `Sequential mode: lesson '${orderedIds[i]}' must depend on predecessor '${orderedIds[i - 1]}'.` });
      }
    }
  } else if (spec.contentStyle?.generationMode === "parallel") {
    for (const lesson of spec.lessons ?? []) {
      if (Array.isArray(lesson.dependsOnLessonIds) && lesson.dependsOnLessonIds.length > 0) {
        errors.push({ file, message: `Parallel mode: lesson '${lesson.id}' must not have dependency edges.` });
      }
    }
  }

  if (spec.gamification?.enabled) {
    if (!Array.isArray(spec.gamification.badges) || spec.gamification.badges.length === 0) {
      warnings.push({ file, message: "Gamification enabled but no badges defined." });
    }
    for (const ach of spec.gamification.achievements ?? []) {
      for (const lid of ach.unlocksLessonIds ?? []) {
        if (!lessonIdSet.has(lid)) errors.push({ file, message: `Achievement '${ach.id}' references unknown lesson '${lid}'.` });
      }
    }
  }

  for (const ap of spec.adaptivePaths ?? []) {
    for (const lid of ap.lessonSequence ?? []) {
      if (!lessonIdSet.has(lid)) errors.push({ file, message: `Adaptive path '${ap.id}' references unknown lesson '${lid}'.` });
    }
  }

  for (const cap of spec.projectCapstones ?? []) {
    for (const lid of cap.prerequisiteLessonIds ?? []) {
      if (!lessonIdSet.has(lid)) errors.push({ file, message: `Capstone '${cap.id}' references unknown lesson '${lid}'.` });
    }
    validateRefs(file, cap.conceptIds ?? [], conceptIds, "concept", errors);
  }

  if (spec.udlFramework) {
    if (Array.isArray(spec.udlFramework.multipleRepresentations) && spec.udlFramework.multipleRepresentations.length < 2) {
      warnings.push({ file, message: "UDL framework should include at least 2 representation modes." });
    }
    if (Array.isArray(spec.udlFramework.multipleActions) && spec.udlFramework.multipleActions.length < 2) {
      warnings.push({ file, message: "UDL framework should include at least 2 action modes." });
    }
    if (Array.isArray(spec.udlFramework.multipleEngagement) && spec.udlFramework.multipleEngagement.length < 2) {
      warnings.push({ file, message: "UDL framework should include at least 2 engagement modes." });
    }
  }
}

async function validateMdx(file, rootDir, knownCitationIds, errors, warnings, externalUrls) {
  const raw = await fs.readFile(file, "utf8");

  const isLesson = /\/content\/module-\d+\//.test(file);
  if (isLesson) {
    const fm = checkFrontmatter(raw);
    for (const e of fm.errors) errors.push({ file, message: e });
    for (const w of fm.warnings) warnings.push({ file, message: w });
  }

  const { content: body } = parseFrontmatter(raw);

  try {
    await compile(body, {
      jsx: true,
      remarkPlugins: [remarkGfm],
      development: false,
    });
  } catch (error) {
    errors.push({ file, message: `MDX compilation failed: ${error.message}` });
  }

  const extracted = extractLinks(body);

  const localLinks = [];
  for (const link of extracted.inlineLinks) {
    const classified = classifyLink(link.url);
    if (classified.type === "external") {
      const safety = classifyExternalUrl(link.url);
      if (!safety.safe) {
        errors.push({ file, message: safety.reason });
      } else {
        externalUrls.push(link.url);
      }
    } else if (classified.type === "local") {
      localLinks.push(classified.url);
    }
  }

  for (const [, def] of extracted.referenceDefinitions) {
    const classified = classifyLink(def.url);
    if (classified.type === "external") {
      const safety = classifyExternalUrl(def.url);
      if (!safety.safe) {
        errors.push({ file, message: safety.reason });
      } else {
        externalUrls.push(def.url);
      }
    } else if (classified.type === "local") {
      localLinks.push(classified.url);
    }
  }

  const localErrors = await checkLocalLinks(localLinks, file, rootDir);
  for (const e of localErrors) errors.push({ file, message: e });

  const linkIssues = detectLinkIssues(extracted);
  for (const e of linkIssues.errors) errors.push({ file, message: e });
  for (const w of linkIssues.warnings) warnings.push({ file, message: w });

  for (const match of findAll(/<Citation[^>]*\sid=["']([^"']+)["'][^>]*>/g, body)) {
    if (!knownCitationIds.has(match[1])) {
      errors.push({ file, message: `Citation id '${match[1]}' is not declared in tutorial references.` });
    }
  }

  for (const match of findAll(/<img\b[^>]*>/g, body)) {
    if (!/\salt=["'][^"']+["']/.test(match[0])) {
      errors.push({ file, message: "Image is missing non-empty alt text." });
    }
  }

  for (const match of findAll(/<iframe\b[^>]*>/g, body)) {
    if (!/\stitle=["'][^"']+["']/.test(match[0])) {
      errors.push({ file, message: "Embedded frame is missing a title." });
    }
  }

  const diagramErrors = checkDiagramFallback(body);
  for (const e of diagramErrors) errors.push({ file, message: e });

  const claimWarnings = checkRiskyClaimPatterns(body);
  for (const w of claimWarnings) warnings.push({ file, message: w });

  const dupeWarnings = checkDuplicateParagraphs(body);
  for (const w of dupeWarnings) warnings.push({ file, message: w });
}

export async function validateContent({ rootDir, contentDir, checkExternal = false }) {
  const errors = [];
  const warnings = [];
  const externalUrls = [];

  const tutorialsDir = path.join(contentDir, "tutorials");
  const specFiles = await listFiles(tutorialsDir, (f) => f.endsWith(".json"));
  const citationIds = new Set();
  for (const file of specFiles) {
    const spec = JSON.parse(await fs.readFile(file, "utf8"));
    validateTutorialSpec(file, spec, errors, warnings);
    for (const ref of spec.references ?? []) citationIds.add(ref.id);
  }

  const mdxFiles = await listFiles(contentDir, (f) => f.endsWith(".mdx"));
  for (const file of mdxFiles) {
    await validateMdx(file, rootDir, citationIds, errors, warnings, externalUrls);
  }

  if (checkExternal && externalUrls.length > 0) {
    const extResult = await checkExternalLinks(externalUrls);
    for (const e of extResult.errors) errors.push({ file: "(external)", message: e });
    for (const w of extResult.warnings) warnings.push({ file: "(external)", message: w });
  }

  return { errors, warnings, specCount: specFiles.length, mdxCount: mdxFiles.length };
}

async function main() {
  const args = process.argv.slice(2);
  const checkExternal = args.includes("--check-external");

  let contentDir;
  const contentDirIdx = args.indexOf("--content-dir");
  if (contentDirIdx !== -1 && args[contentDirIdx + 1]) {
    contentDir = path.resolve(args[contentDirIdx + 1]);
  }

  const root = contentDir
    ? path.dirname(contentDir)
    : path.dirname(path.dirname(fileURLToPath(import.meta.url)));
  const finalContentDir = contentDir || path.join(root, "content");

  const { errors, warnings, specCount, mdxCount } = await validateContent({
    rootDir: root,
    contentDir: finalContentDir,
    checkExternal,
  });

  for (const w of warnings) {
    const target = path.relative(root, w.file);
    console.warn(`warning ${target}: ${w.message}`);
  }
  for (const e of errors) {
    const target = path.relative(root, e.file);
    console.error(`error ${target}: ${e.message}`);
  }

  if (errors.length > 0) {
    console.error(
      `Validation failed with ${errors.length} error(s) and ${warnings.length} warning(s).`,
    );
    process.exit(1);
  }

  console.log(
    `Validation passed for ${specCount} tutorial spec(s) and ${mdxCount} MDX file(s).`,
  );
  if (warnings.length > 0) console.log(`${warnings.length} warning(s) reported.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
