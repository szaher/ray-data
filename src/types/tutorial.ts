export type Difficulty = "beginner" | "intermediate" | "advanced";

export type SourceQuality =
  | "primary"
  | "official-docs"
  | "peer-reviewed"
  | "expert"
  | "secondary"
  | "unverified";

export type ClaimStatus = "verified" | "verify" | "unsupported";

// ── Canonical constants (single source of truth for enums) ─────

export const CONTENT_VOICES = [
  "conversational",
  "academic",
  "systematic",
  "narrative",
  "minimalist",
] as const;

export const INSTRUCTIONAL_APPROACHES = [
  "socratic",
  "problem-based",
  "hands-on",
  "analogical",
  "visual-first",
  "challenge-based",
] as const;

export const GENERATION_MODES = ["sequential", "parallel"] as const;

export const MULTIMEDIA_TYPES = [
  "slides",
  "narration",
  "mermaid",
  "mind-map",
  "infographic",
  "timeline",
  "comparison-matrix",
  "decision-tree",
  "concept-map",
  "interactive-simulation",
] as const;

export const ARTIFACT_STATUSES = [
  "planned",
  "generated",
  "approved",
] as const;

// ── Derived union types ────────────────────────────────────────

export type ContentVoice = (typeof CONTENT_VOICES)[number];
export type InstructionalApproach = (typeof INSTRUCTIONAL_APPROACHES)[number];
export type GenerationMode = (typeof GENERATION_MODES)[number];
export type MultimediaType = (typeof MULTIMEDIA_TYPES)[number];
export type ArtifactStatus = (typeof ARTIFACT_STATUSES)[number];

export interface TutorialReference {
  id: string;
  title: string;
  url: string;
  publisher?: string;
  accessedAt: string;
  quality: SourceQuality;
  notes?: string;
}

export interface LearningObjective {
  id: string;
  description: string;
  bloomLevel: "remember" | "understand" | "apply" | "analyze" | "evaluate" | "create";
  assessmentIds: string[];
}

export interface TutorialAudience {
  primary: string;
  priorKnowledge: string[];
  roles?: string[];
  readingLevel?: string;
}

export interface TutorialScope {
  inScope: string[];
  nonGoals: string[];
}

export interface TutorialConcept {
  id: string;
  term: string;
  definition: string;
  relatedConceptIds?: string[];
}

export interface TutorialMisconception {
  id: string;
  misconception: string;
  correction: string;
  conceptIds: string[];
}

export interface WorkedExample {
  id: string;
  title: string;
  prompt: string;
  steps: string[];
  explanation: string;
  conceptIds: string[];
  referenceIds?: string[];
}

export interface Exercise {
  id: string;
  prompt: string;
  type: "short-answer" | "multiple-choice" | "coding" | "reflection" | "scenario";
  difficulty: Difficulty;
  conceptIds: string[];
  answerId: string;
}

export interface ExerciseAnswer {
  id: string;
  exerciseId: string;
  answer: string;
  rubric?: string[];
}

// ── Content style ──────────────────────────────────────────────

export interface ContentStyle {
  voice?: ContentVoice;
  approaches?: InstructionalApproach[];
  generationMode?: GenerationMode;
}

// ── Artifact descriptor ────────────────────────────────────────

export interface ArtifactAccessibility {
  altText?: string;
  transcriptPath?: string;
  captionsPath?: string;
  fallbackText: string;
}

export interface ArtifactDescriptor {
  id: string;
  type: MultimediaType;
  status: ArtifactStatus;
  sourcePath?: string;
  renderedPath?: string;
  objectiveIds: string[];
  accessibility: ArtifactAccessibility;
}

// ── Gamification ───────────────────────────────────────────────

export interface Badge {
  id: string;
  title: string;
  description: string;
  criteria: string;
  iconHint: string;
}

export interface PointRule {
  action: string;
  points: number;
  description: string;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  unlocksLessonIds?: string[];
}

export interface GamificationConfig {
  enabled: boolean;
  badges?: Badge[];
  pointRules?: PointRule[];
  streakTracking?: boolean;
  achievements?: Achievement[];
  unlockableContent?: string[];
}

// ── Adaptive and spaced learning ───────────────────────────────

export interface AdaptivePath {
  id: string;
  title: string;
  description: string;
  entryCondition: string;
  lessonSequence: string[];
  difficulty: Difficulty;
}

export interface SpacedRepetitionConfig {
  enabled: boolean;
  intervals: number[];
  reviewCardCount: number;
}

export interface MicrolearningConfig {
  enabled: boolean;
  maxMinutesPerModule: number;
  digestFormat: "flashcard" | "summary" | "quiz";
}

// ── Project capstones ──────────────────────────────────────────

export interface ProjectCapstone {
  id: string;
  title: string;
  description: string;
  deliverables: string[];
  rubric: string[];
  estimatedHours: number;
  prerequisiteLessonIds: string[];
  conceptIds: string[];
}

// ── Scaffolding and pedagogy ───────────────────────────────────

export interface ScaffoldingConfig {
  hintLevels: number;
  differentiatedPaths: boolean;
  graduatedComplexity: boolean;
}

export interface UDLFramework {
  multipleRepresentations: string[];
  multipleActions: string[];
  multipleEngagement: string[];
}

export interface MetacognitionStrategy {
  type: "self-assessment" | "reflection" | "goal-setting" | "knowledge-monitoring";
  prompt: string;
  placement: "before-lesson" | "mid-lesson" | "after-lesson";
}

// ── Multimedia planning ────────────────────────────────────────

export interface MultimediaRecommendation {
  id: string;
  type: MultimediaType;
  rationale: string;
  priority: "required" | "recommended" | "optional";
  placement: string;
  contentBrief: string;
  accessibilityNotes: string;
  objectiveIds?: string[];
  mermaidSource?: string;
  estimatedEffort: "low" | "medium" | "high";
}

export interface MultimediaPlan {
  recommendations: MultimediaRecommendation[];
}

// ── Collaborative learning ─────────────────────────────────────

export interface CollaborativeConfig {
  enabled: boolean;
  groupSize?: number;
  activities?: string[];
  peerReviewEnabled?: boolean;
}

// ── Assessment ─────────────────────────────────────────────────

export interface AssessmentItem {
  id: string;
  type: "quiz" | "free-response" | "performance-task" | "self-check";
  prompt: string;
  expectedAnswer?: string;
  objectiveIds: string[];
}

export interface MasteryCriterion {
  id: string;
  description: string;
  objectiveIds: string[];
  threshold: string;
}

export interface AccessibilityMetadata {
  altTextRequired: boolean;
  captionsRequired: boolean;
  transcriptRequired: boolean;
  colorIndependent: boolean;
  keyboardNavigable: boolean;
  readingOrderChecked: boolean;
}

export interface LocalizationMetadata {
  sourceLocale: string;
  targetLocales: string[];
  glossaryTerms: string[];
  culturalAssumptions: string[];
}

export interface LessonSpec {
  id: string;
  slug: string;
  title: string;
  summary: string;
  estimatedMinutes: number;
  difficulty: Difficulty;
  prerequisites: string[];
  objectiveIds: string[];
  conceptIds: string[];
  referenceIds: string[];
  dependsOnLessonIds?: string[];
  multimediaPlan?: MultimediaPlan;
  metacognition?: MetacognitionStrategy[];
  scaffolding?: ScaffoldingConfig;
  artifacts: {
    mdxPath: string;
    items?: ArtifactDescriptor[];
    slidesPath?: string;
    narrationScriptPath?: string;
    infographicPath?: string;
  };
}

export interface TutorialSpec {
  schemaVersion: "1.0.0" | "1.1.0";
  id: string;
  title: string;
  description: string;
  audience: TutorialAudience;
  prerequisites: string[];
  learningObjectives: LearningObjective[];
  scope: TutorialScope;
  lessons: LessonSpec[];
  references: TutorialReference[];
  concepts: TutorialConcept[];
  misconceptions: TutorialMisconception[];
  workedExamples: WorkedExample[];
  exercises: Exercise[];
  answers: ExerciseAnswer[];
  formativeAssessment: AssessmentItem[];
  masteryCriteria: MasteryCriterion[];
  recap: string[];
  nextSteps: string[];
  accessibility: AccessibilityMetadata;
  localization: LocalizationMetadata;
  contentStyle?: ContentStyle;
  gamification?: GamificationConfig;
  adaptivePaths?: AdaptivePath[];
  spacedRepetition?: SpacedRepetitionConfig;
  microlearning?: MicrolearningConfig;
  projectCapstones?: ProjectCapstone[];
  udlFramework?: UDLFramework;
  collaborativeLearning?: CollaborativeConfig;
}

export interface ValidationIssue {
  path: string;
  message: string;
  severity: "error" | "warning";
}

export interface ValidationResult {
  ok: boolean;
  issues: ValidationIssue[];
}
