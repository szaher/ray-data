export interface LessonMeta {
  slug: string;
  title: string;
  description: string;
  estimatedMinutes: number;
  diagramTypes: string[];
  hasCode: boolean;
  hasQuiz: boolean;
}

export interface ModuleMeta {
  id: number;
  title: string;
  description: string;
  color: string;
  lessons: LessonMeta[];
}

export interface CurriculumData {
  modules: ModuleMeta[];
}

export interface LessonProgress {
  completed: boolean;
  quizScore?: number;
  completedAt?: string;
}

export interface ProgressState {
  lessons: Record<string, LessonProgress>;
  currentModule: number;
  currentLesson: number;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export interface ChatContext {
  module?: number;
  lesson?: number;
  history: ChatMessage[];
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface ExportRequest {
  module?: number;
  lesson?: number;
  format: "markdown" | "notebook" | "both";
}

export interface ExportProgress {
  status: "running" | "done" | "error";
  message: string;
  files?: string[];
}

export type * from "./tutorial";
