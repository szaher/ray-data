# Ray Data Academy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an interactive web-based teaching platform for Ray and Ray Data, powered by Claude Code (Vertex AI), with structured lessons, conversational AI tutor, live diagram rendering, and exportable materials.

**Architecture:** Next.js 15 full-stack app. MDX files serve the curriculum. API routes spawn the `claude` CLI for chat. Mermaid.js and D3.js render diagrams client-side. A Python sidecar handles notebook/markdown export. All state in localStorage.

**Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind CSS 4, MDX, Mermaid.js, D3.js, Monaco Editor, Claude CLI (Vertex AI), Python (nbformat, plotly, graphviz), Ray 2.55.1

**Spec:** `docs/superpowers/specs/2026-06-06-ray-data-academy-design.md`

**Note on scope:** This plan covers the full application infrastructure (Tasks 1-22) plus a content starter kit (Task 23 — Module 1 lessons as templates). The remaining 30 MDX lessons follow the same template pattern and should be authored in a follow-up content plan.

---

## File Structure

```
ray-data/
├── package.json
├── next.config.ts
├── tsconfig.json
├── tailwind.config.ts
├── postcss.config.mjs
├── mdx-components.tsx                ← Required by @next/mdx
├── content/
│   ├── module-1/
│   │   ├── meta.json
│   │   ├── 01-why-distributed.mdx
│   │   ├── 02-gil-problem.mdx
│   │   ├── 03-map-reduce.mdx
│   │   └── 04-rays-big-idea.mdx
│   ├── module-2/
│   │   └── meta.json
│   ├── module-3/ ... module-6/
│   │   └── meta.json
│   └── module-7/
│       └── meta.json
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── globals.css
│   │   ├── lesson/
│   │   │   └── [module]/[lesson]/page.tsx
│   │   ├── chat/
│   │   │   └── page.tsx
│   │   └── api/
│   │       ├── chat/route.ts
│   │       ├── curriculum/route.ts
│   │       ├── lesson/[module]/[lesson]/route.ts
│   │       └── export/route.ts
│   ├── components/
│   │   ├── Sidebar.tsx
│   │   ├── Header.tsx
│   │   ├── LessonContent.tsx
│   │   ├── ChatInterface.tsx
│   │   ├── ChatMessage.tsx
│   │   ├── MermaidDiagram.tsx
│   │   ├── CodeBlock.tsx
│   │   ├── D3Visualization.tsx
│   │   ├── Quiz.tsx
│   │   ├── ExportMenu.tsx
│   │   └── ProgressBar.tsx
│   ├── lib/
│   │   ├── claude.ts
│   │   ├── curriculum.ts
│   │   ├── mdx.ts
│   │   └── progress.ts
│   └── types/
│       └── index.ts
├── scripts/
│   ├── export.py
│   └── requirements.txt
├── exports/                          ← gitignored
│   ├── markdown/
│   └── notebooks/
├── __tests__/
│   ├── lib/
│   │   ├── curriculum.test.ts
│   │   ├── progress.test.ts
│   │   └── claude.test.ts
│   └── components/
│       ├── MermaidDiagram.test.tsx
│       ├── Quiz.test.tsx
│       └── Sidebar.test.tsx
├── vitest.config.ts
├── .gitignore
└── docs/
```

---

### Task 1: Project Scaffold

**Files:**
- Create: `package.json`, `next.config.ts`, `tsconfig.json`, `tailwind.config.ts`, `postcss.config.mjs`, `mdx-components.tsx`, `.gitignore`, `vitest.config.ts`, `src/app/globals.css`, `src/app/layout.tsx`, `src/app/page.tsx`

- [ ] **Step 1: Initialize Next.js 15 project**

```bash
cd /Users/szaher/go/src/github.com/szaher/saad/learn/ray-data
pnpm create next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-pnpm --yes
```

Expected: Project scaffolded with `src/app/` structure, `package.json`, `next.config.ts`, etc.

- [ ] **Step 2: Install additional dependencies**

```bash
cd /Users/szaher/go/src/github.com/szaher/saad/learn/ray-data
pnpm add @next/mdx @mdx-js/loader @mdx-js/react mermaid d3 @monaco-editor/react monaco-editor gray-matter
pnpm add -D @types/mdx @types/d3 vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

Expected: All deps installed in `node_modules/`, updated `package.json`.

- [ ] **Step 3: Configure next.config.ts for MDX**

Replace `next.config.ts` with:

```typescript
import createMDX from "@next/mdx";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  pageExtensions: ["js", "jsx", "md", "mdx", "ts", "tsx"],
};

const withMDX = createMDX({
  extension: /\.mdx?$/,
});

export default withMDX(nextConfig);
```

- [ ] **Step 4: Create mdx-components.tsx in project root**

```typescript
import type { MDXComponents } from "mdx/types";

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    ...components,
  };
}
```

- [ ] **Step 5: Configure Vitest**

Create `vitest.config.ts`:

```typescript
import react from "@vitejs/plugin-react";
import { resolve } from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: [],
    include: ["__tests__/**/*.test.{ts,tsx}"],
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
});
```

Add to `package.json` scripts:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 6: Update .gitignore**

Append these lines to `.gitignore`:

```
exports/
.superpowers/
```

- [ ] **Step 7: Set up globals.css with dark theme**

Replace `src/app/globals.css` with:

```css
@import "tailwindcss";

:root {
  --bg-primary: #0f1117;
  --bg-secondary: #1a1d27;
  --bg-tertiary: #242734;
  --text-primary: #e0e0e0;
  --text-secondary: #a0aec0;
  --accent-blue: #63b3ed;
  --accent-green: #68d391;
  --accent-purple: #b794f4;
  --accent-orange: #ed8936;
  --accent-red: #fc8181;
  --accent-yellow: #ecc94b;
  --accent-teal: #4fd1c5;
  --border: rgba(255, 255, 255, 0.08);
}

body {
  background: var(--bg-primary);
  color: var(--text-primary);
  font-family: system-ui, -apple-system, sans-serif;
}
```

- [ ] **Step 8: Verify scaffold runs**

```bash
cd /Users/szaher/go/src/github.com/szaher/saad/learn/ray-data
pnpm dev &
sleep 3
curl -s http://localhost:3000 | head -5
kill %1
```

Expected: HTML output from Next.js dev server.

- [ ] **Step 9: Commit**

```bash
cd /Users/szaher/go/src/github.com/szaher/saad/learn/ray-data
git init
git add -A
git commit -m "feat: scaffold Next.js 15 project with MDX, Mermaid, Vitest"
```

---

### Task 2: Type Definitions

**Files:**
- Create: `src/types/index.ts`

- [ ] **Step 1: Define all shared types**

Create `src/types/index.ts`:

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
cd /Users/szaher/go/src/github.com/szaher/saad/learn/ray-data
git add src/types/index.ts
git commit -m "feat: add shared TypeScript type definitions"
```

---

### Task 3: Curriculum Data Layer

**Files:**
- Create: `content/module-1/meta.json`, `content/module-2/meta.json`, `content/module-3/meta.json`, `content/module-4/meta.json`, `content/module-5/meta.json`, `content/module-6/meta.json`, `content/module-7/meta.json`, `src/lib/curriculum.ts`, `__tests__/lib/curriculum.test.ts`

- [ ] **Step 1: Write the failing test for curriculum loading**

Create `__tests__/lib/curriculum.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { getCurriculum, getModuleMeta, getLessonPath } from "@/lib/curriculum";

describe("getCurriculum", () => {
  it("returns all 7 modules", async () => {
    const curriculum = await getCurriculum();
    expect(curriculum.modules).toHaveLength(7);
  });

  it("module 1 has 4 lessons", async () => {
    const curriculum = await getCurriculum();
    expect(curriculum.modules[0].lessons).toHaveLength(4);
  });

  it("module IDs are sequential starting at 1", async () => {
    const curriculum = await getCurriculum();
    const ids = curriculum.modules.map((m) => m.id);
    expect(ids).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });
});

describe("getModuleMeta", () => {
  it("returns module by ID", async () => {
    const mod = await getModuleMeta(1);
    expect(mod?.title).toBe("Foundations");
  });

  it("returns undefined for invalid ID", async () => {
    const mod = await getModuleMeta(99);
    expect(mod).toBeUndefined();
  });
});

describe("getLessonPath", () => {
  it("returns correct MDX path", () => {
    const path = getLessonPath(1, "01-why-distributed");
    expect(path).toContain("content/module-1/01-why-distributed.mdx");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/szaher/go/src/github.com/szaher/saad/learn/ray-data
pnpm test -- __tests__/lib/curriculum.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create all meta.json files**

Create `content/module-1/meta.json`:

```json
{
  "id": 1,
  "title": "Foundations",
  "description": "Why distributed computing exists, Python's limitations, and how Ray solves them",
  "color": "#68d391",
  "lessons": [
    {
      "slug": "01-why-distributed",
      "title": "Why Distributed Computing?",
      "description": "Single-machine limits, data growth, and compute needs",
      "estimatedMinutes": 10,
      "diagramTypes": ["architecture", "comparison"],
      "hasCode": false,
      "hasQuiz": true
    },
    {
      "slug": "02-gil-problem",
      "title": "The GIL Problem & Python's Limits",
      "description": "Why Python can't just use threads",
      "estimatedMinutes": 12,
      "diagramTypes": ["flowchart", "bottleneck"],
      "hasCode": false,
      "hasQuiz": true
    },
    {
      "slug": "03-map-reduce",
      "title": "Map-Reduce & Data Parallelism",
      "description": "The foundational pattern: split, process, combine",
      "estimatedMinutes": 15,
      "diagramTypes": ["flowchart", "data-flow"],
      "hasCode": true,
      "hasQuiz": true
    },
    {
      "slug": "04-rays-big-idea",
      "title": "Ray's Big Idea",
      "description": "Architecture overview: driver, workers, object store, scheduler",
      "estimatedMinutes": 15,
      "diagramTypes": ["architecture"],
      "hasCode": false,
      "hasQuiz": true
    }
  ]
}
```

Create `content/module-2/meta.json`:

```json
{
  "id": 2,
  "title": "Ray Core",
  "description": "Hands-on with Ray's primitives: tasks, actors, and the object store",
  "color": "#63b3ed",
  "lessons": [
    { "slug": "01-ray-init", "title": "ray.init() & Clusters", "description": "Starting Ray, local vs cluster mode", "estimatedMinutes": 12, "diagramTypes": ["architecture"], "hasCode": true, "hasQuiz": true },
    { "slug": "02-tasks", "title": "Tasks", "description": "@ray.remote functions, ObjectRef, ray.get()", "estimatedMinutes": 15, "diagramTypes": ["flowchart", "scheduling"], "hasCode": true, "hasQuiz": true },
    { "slug": "03-actors", "title": "Actors", "description": "Stateful workers with @ray.remote classes", "estimatedMinutes": 15, "diagramTypes": ["lifecycle", "state"], "hasCode": true, "hasQuiz": true },
    { "slug": "04-object-store", "title": "Object Store & Object Refs", "description": "Distributed shared memory and zero-copy reads", "estimatedMinutes": 15, "diagramTypes": ["data-flow", "memory"], "hasCode": true, "hasQuiz": true },
    { "slug": "05-placement-groups", "title": "Placement Groups & Resources", "description": "Resource scheduling, PACK vs SPREAD", "estimatedMinutes": 12, "diagramTypes": ["topology"], "hasCode": true, "hasQuiz": true }
  ]
}
```

Create `content/module-3/meta.json`:

```json
{
  "id": 3,
  "title": "Ray Data Basics",
  "description": "The Dataset API: reading, transforming, and consuming data",
  "color": "#b794f4",
  "lessons": [
    { "slug": "01-what-is-ray-data", "title": "What is Ray Data?", "description": "The Dataset concept and when to use it", "estimatedMinutes": 10, "diagramTypes": ["comparison", "architecture"], "hasCode": false, "hasQuiz": true },
    { "slug": "02-reading-data", "title": "Reading Data", "description": "read_csv, read_parquet, read_json, read_images", "estimatedMinutes": 15, "diagramTypes": ["data-flow"], "hasCode": true, "hasQuiz": true },
    { "slug": "03-transformations", "title": "Transformations", "description": "map, map_batches, filter, flat_map", "estimatedMinutes": 18, "diagramTypes": ["pipeline", "comparison"], "hasCode": true, "hasQuiz": true },
    { "slug": "04-consuming-data", "title": "Consuming Data", "description": "iter_batches, iter_torch_batches, show, take", "estimatedMinutes": 12, "diagramTypes": ["data-flow"], "hasCode": true, "hasQuiz": true },
    { "slug": "05-schemas-types", "title": "Schemas & Types", "description": "Arrow-based type system", "estimatedMinutes": 10, "diagramTypes": ["schema"], "hasCode": true, "hasQuiz": true },
    { "slug": "06-lazy-execution", "title": "Lazy Execution & Materialization", "description": "Deferred execution and when it actually runs", "estimatedMinutes": 15, "diagramTypes": ["execution-graph"], "hasCode": true, "hasQuiz": true }
  ]
}
```

Create `content/module-4/meta.json`:

```json
{
  "id": 4,
  "title": "Intermediate",
  "description": "Production patterns: GPU inference, streaming, ML integration",
  "color": "#ed8936",
  "lessons": [
    { "slug": "01-gpu-batch-inference", "title": "GPU Batch Inference", "description": "map_batches with num_gpus, actor pools", "estimatedMinutes": 18, "diagramTypes": ["pipeline", "resource"], "hasCode": true, "hasQuiz": true },
    { "slug": "02-streaming-execution", "title": "Streaming Execution", "description": "Windowed execution and operator concurrency", "estimatedMinutes": 15, "diagramTypes": ["streaming", "pipeline"], "hasCode": true, "hasQuiz": true },
    { "slug": "03-data-train", "title": "Ray Data + Ray Train", "description": "Feeding datasets into distributed training", "estimatedMinutes": 18, "diagramTypes": ["integration", "data-flow"], "hasCode": true, "hasQuiz": true },
    { "slug": "04-data-serve", "title": "Ray Data + Ray Serve", "description": "Online inference pipelines", "estimatedMinutes": 15, "diagramTypes": ["deployment", "pipeline"], "hasCode": true, "hasQuiz": true },
    { "slug": "05-preprocessors", "title": "Data Preprocessors for ML", "description": "Built-in and custom preprocessors", "estimatedMinutes": 12, "diagramTypes": ["chain", "comparison"], "hasCode": true, "hasQuiz": true }
  ]
}
```

Create `content/module-5/meta.json`:

```json
{
  "id": 5,
  "title": "Advanced",
  "description": "Internals: execution plans, memory, custom datasources, fault tolerance",
  "color": "#fc8181",
  "lessons": [
    { "slug": "01-execution-plans", "title": "Execution Plans & Operator Fusion", "description": "Logical vs physical plans, optimization rules", "estimatedMinutes": 18, "diagramTypes": ["tree", "optimization"], "hasCode": true, "hasQuiz": true },
    { "slug": "02-memory-management", "title": "Memory Management", "description": "Block sizes, backpressure, tuning knobs", "estimatedMinutes": 18, "diagramTypes": ["memory", "tuning"], "hasCode": true, "hasQuiz": true },
    { "slug": "03-custom-datasources", "title": "Custom Datasources", "description": "Writing your own Datasource", "estimatedMinutes": 20, "diagramTypes": ["interface", "data-flow"], "hasCode": true, "hasQuiz": true },
    { "slug": "04-fault-tolerance", "title": "Fault Tolerance & Lineage", "description": "Task retries and object reconstruction", "estimatedMinutes": 15, "diagramTypes": ["lineage", "recovery"], "hasCode": true, "hasQuiz": true },
    { "slug": "05-shuffles-aggregations", "title": "Shuffles & Aggregations", "description": "sort, groupby, repartition", "estimatedMinutes": 15, "diagramTypes": ["shuffle", "comparison"], "hasCode": true, "hasQuiz": true }
  ]
}
```

Create `content/module-6/meta.json`:

```json
{
  "id": 6,
  "title": "Real-World Projects",
  "description": "Complete end-to-end projects tying together multiple concepts",
  "color": "#ecc94b",
  "lessons": [
    { "slug": "01-image-pipeline", "title": "Image Processing Pipeline", "description": "Read, resize, augment, infer, write", "estimatedMinutes": 25, "diagramTypes": ["pipeline", "architecture"], "hasCode": true, "hasQuiz": false },
    { "slug": "02-llm-batch-inference", "title": "LLM Batch Inference", "description": "GPU actors processing text at scale", "estimatedMinutes": 25, "diagramTypes": ["pipeline", "resource"], "hasCode": true, "hasQuiz": false },
    { "slug": "03-etl-pipeline", "title": "ETL Pipeline", "description": "Parquet to transformed partitioned output", "estimatedMinutes": 20, "diagramTypes": ["pipeline", "data-flow"], "hasCode": true, "hasQuiz": false },
    { "slug": "04-serve-online", "title": "Ray Data + Ray Serve Online", "description": "Real-time inference endpoint", "estimatedMinutes": 25, "diagramTypes": ["deployment", "pipeline"], "hasCode": true, "hasQuiz": false },
    { "slug": "05-performance-benchmarking", "title": "Performance Benchmarking", "description": "Compare approaches, measure throughput", "estimatedMinutes": 20, "diagramTypes": ["chart", "comparison"], "hasCode": true, "hasQuiz": false }
  ]
}
```

Create `content/module-7/meta.json`:

```json
{
  "id": 7,
  "title": "Future & Emerging Patterns",
  "description": "Forward-looking: lineage, streaming, feature stores, multi-modal",
  "color": "#4fd1c5",
  "lessons": [
    { "slug": "01-data-lineage", "title": "Data Lineage & Observability", "description": "End-to-end transformation tracking", "estimatedMinutes": 15, "diagramTypes": ["lineage", "dashboard"], "hasCode": false, "hasQuiz": true },
    { "slug": "02-streaming-pipelines", "title": "Streaming Data Pipelines", "description": "Continuous ingestion, Ray Data Gen, backpressure", "estimatedMinutes": 18, "diagramTypes": ["streaming", "comparison"], "hasCode": false, "hasQuiz": true },
    { "slug": "03-feature-stores", "title": "Ray Data + Feature Stores", "description": "Feast/Tecton integration, online vs offline", "estimatedMinutes": 15, "diagramTypes": ["architecture", "integration"], "hasCode": false, "hasQuiz": true },
    { "slug": "04-multi-modal", "title": "Multi-Modal Data Pipelines", "description": "Unified text/image/audio/video processing", "estimatedMinutes": 15, "diagramTypes": ["pipeline", "routing"], "hasCode": false, "hasQuiz": true }
  ]
}
```

- [ ] **Step 4: Implement curriculum.ts**

Create `src/lib/curriculum.ts`:

```typescript
import fs from "fs/promises";
import path from "path";
import type { CurriculumData, ModuleMeta } from "@/types";

const CONTENT_DIR = path.join(process.cwd(), "content");

export async function getCurriculum(): Promise<CurriculumData> {
  const entries = await fs.readdir(CONTENT_DIR);
  const moduleDirs = entries
    .filter((e) => e.startsWith("module-"))
    .sort((a, b) => {
      const numA = parseInt(a.split("-")[1]);
      const numB = parseInt(b.split("-")[1]);
      return numA - numB;
    });

  const modules: ModuleMeta[] = [];
  for (const dir of moduleDirs) {
    const metaPath = path.join(CONTENT_DIR, dir, "meta.json");
    const raw = await fs.readFile(metaPath, "utf-8");
    modules.push(JSON.parse(raw) as ModuleMeta);
  }

  return { modules };
}

export async function getModuleMeta(
  moduleId: number
): Promise<ModuleMeta | undefined> {
  const curriculum = await getCurriculum();
  return curriculum.modules.find((m) => m.id === moduleId);
}

export function getLessonPath(moduleId: number, lessonSlug: string): string {
  return path.join(CONTENT_DIR, `module-${moduleId}`, `${lessonSlug}.mdx`);
}

export async function getLessonContent(
  moduleId: number,
  lessonSlug: string
): Promise<string | null> {
  const filePath = getLessonPath(moduleId, lessonSlug);
  try {
    return await fs.readFile(filePath, "utf-8");
  } catch {
    return null;
  }
}
```

- [ ] **Step 5: Run tests**

```bash
cd /Users/szaher/go/src/github.com/szaher/saad/learn/ray-data
pnpm test -- __tests__/lib/curriculum.test.ts
```

Expected: All 5 tests PASS.

- [ ] **Step 6: Commit**

```bash
cd /Users/szaher/go/src/github.com/szaher/saad/learn/ray-data
git add content/ src/lib/curriculum.ts __tests__/lib/curriculum.test.ts
git commit -m "feat: add curriculum data layer with meta.json for all 7 modules"
```

---

### Task 4: Progress Tracking Library

**Files:**
- Create: `src/lib/progress.ts`, `__tests__/lib/progress.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/lib/progress.test.ts`:

```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getProgress,
  markLessonComplete,
  getLessonProgress,
  getModuleProgress,
  resetProgress,
} from "@/lib/progress";

const mockStorage: Record<string, string> = {};

beforeEach(() => {
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => mockStorage[key] ?? null,
    setItem: (key: string, value: string) => {
      mockStorage[key] = value;
    },
    removeItem: (key: string) => {
      delete mockStorage[key];
    },
  });
});

afterEach(() => {
  Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
  vi.restoreAllMocks();
});

describe("getProgress", () => {
  it("returns default state when empty", () => {
    const progress = getProgress();
    expect(progress.currentModule).toBe(1);
    expect(progress.currentLesson).toBe(1);
    expect(Object.keys(progress.lessons)).toHaveLength(0);
  });
});

describe("markLessonComplete", () => {
  it("marks a lesson as completed", () => {
    markLessonComplete(1, "01-why-distributed");
    const lp = getLessonProgress(1, "01-why-distributed");
    expect(lp?.completed).toBe(true);
    expect(lp?.completedAt).toBeDefined();
  });

  it("records quiz score", () => {
    markLessonComplete(1, "01-why-distributed", 3);
    const lp = getLessonProgress(1, "01-why-distributed");
    expect(lp?.quizScore).toBe(3);
  });
});

describe("getModuleProgress", () => {
  it("returns 0 for untouched module", () => {
    expect(getModuleProgress(1, 4)).toBe(0);
  });

  it("returns fraction of completed lessons", () => {
    markLessonComplete(1, "01-why-distributed");
    markLessonComplete(1, "02-gil-problem");
    expect(getModuleProgress(1, 4)).toBe(0.5);
  });
});

describe("resetProgress", () => {
  it("clears all progress", () => {
    markLessonComplete(1, "01-why-distributed");
    resetProgress();
    const progress = getProgress();
    expect(Object.keys(progress.lessons)).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/szaher/go/src/github.com/szaher/saad/learn/ray-data
pnpm test -- __tests__/lib/progress.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement progress.ts**

Create `src/lib/progress.ts`:

```typescript
import type { LessonProgress, ProgressState } from "@/types";

const STORAGE_KEY = "ray-data-academy-progress";

const DEFAULT_STATE: ProgressState = {
  lessons: {},
  currentModule: 1,
  currentLesson: 1,
};

function lessonKey(moduleId: number, lessonSlug: string): string {
  return `${moduleId}:${lessonSlug}`;
}

export function getProgress(): ProgressState {
  if (typeof localStorage === "undefined") return { ...DEFAULT_STATE };
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return { ...DEFAULT_STATE, lessons: {} };
  return JSON.parse(raw) as ProgressState;
}

function saveProgress(state: ProgressState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function markLessonComplete(
  moduleId: number,
  lessonSlug: string,
  quizScore?: number
): void {
  const state = getProgress();
  const key = lessonKey(moduleId, lessonSlug);
  state.lessons[key] = {
    completed: true,
    quizScore,
    completedAt: new Date().toISOString(),
  };
  saveProgress(state);
}

export function getLessonProgress(
  moduleId: number,
  lessonSlug: string
): LessonProgress | undefined {
  const state = getProgress();
  return state.lessons[lessonKey(moduleId, lessonSlug)];
}

export function getModuleProgress(
  moduleId: number,
  totalLessons: number
): number {
  if (totalLessons === 0) return 0;
  const state = getProgress();
  const prefix = `${moduleId}:`;
  const completed = Object.entries(state.lessons).filter(
    ([k, v]) => k.startsWith(prefix) && v.completed
  ).length;
  return completed / totalLessons;
}

export function setCurrentPosition(
  moduleId: number,
  lessonIndex: number
): void {
  const state = getProgress();
  state.currentModule = moduleId;
  state.currentLesson = lessonIndex;
  saveProgress(state);
}

export function resetProgress(): void {
  saveProgress({ ...DEFAULT_STATE, lessons: {} });
}
```

- [ ] **Step 4: Run tests**

```bash
cd /Users/szaher/go/src/github.com/szaher/saad/learn/ray-data
pnpm test -- __tests__/lib/progress.test.ts
```

Expected: All 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/szaher/go/src/github.com/szaher/saad/learn/ray-data
git add src/lib/progress.ts __tests__/lib/progress.test.ts
git commit -m "feat: add localStorage progress tracking"
```

---

### Task 5: Header Component

**Files:**
- Create: `src/components/Header.tsx`

- [ ] **Step 1: Create Header component**

Create `src/components/Header.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Header() {
  const pathname = usePathname();
  const isChat = pathname.startsWith("/chat");
  const isLesson = pathname.startsWith("/lesson") || pathname === "/";

  return (
    <header className="flex items-center justify-between px-6 py-3 border-b border-white/[0.08] bg-[var(--bg-secondary)]">
      <Link href="/" className="flex items-center gap-2 text-[var(--accent-blue)] font-semibold text-lg">
        <span className="w-2.5 h-2.5 rounded-full bg-[var(--accent-blue)]" />
        Ray Data Academy
      </Link>

      <nav className="flex items-center gap-1 bg-[var(--bg-tertiary)] rounded-lg p-1">
        <Link
          href="/"
          className={`px-4 py-1.5 rounded-md text-sm transition-colors ${
            isLesson
              ? "bg-[var(--bg-primary)] text-[var(--text-primary)]"
              : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          }`}
        >
          Lesson Mode
        </Link>
        <Link
          href="/chat"
          className={`px-4 py-1.5 rounded-md text-sm transition-colors ${
            isChat
              ? "bg-[var(--bg-primary)] text-[var(--text-primary)]"
              : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          }`}
        >
          Chat Mode
        </Link>
      </nav>

      <div className="flex items-center gap-3">
        <ExportButton />
        <button className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </div>
    </header>
  );
}

function ExportButton() {
  return (
    <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--bg-tertiary)] rounded-lg transition-colors">
      Export
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </button>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/szaher/go/src/github.com/szaher/saad/learn/ray-data
git add src/components/Header.tsx
git commit -m "feat: add Header component with mode toggle and export button"
```

---

### Task 6: Sidebar Component

**Files:**
- Create: `src/components/Sidebar.tsx`, `src/components/ProgressBar.tsx`, `__tests__/components/Sidebar.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `__tests__/components/Sidebar.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Sidebar from "@/components/Sidebar";
import type { CurriculumData } from "@/types";

vi.mock("next/navigation", () => ({
  usePathname: () => "/lesson/1/01-why-distributed",
  useRouter: () => ({ push: vi.fn() }),
}));

const mockCurriculum: CurriculumData = {
  modules: [
    {
      id: 1,
      title: "Foundations",
      description: "Test",
      color: "#68d391",
      lessons: [
        { slug: "01-why-distributed", title: "Why Distributed?", description: "", estimatedMinutes: 10, diagramTypes: [], hasCode: false, hasQuiz: true },
        { slug: "02-gil", title: "GIL Problem", description: "", estimatedMinutes: 10, diagramTypes: [], hasCode: false, hasQuiz: true },
      ],
    },
  ],
};

describe("Sidebar", () => {
  it("renders module titles", () => {
    render(<Sidebar curriculum={mockCurriculum} />);
    expect(screen.getByText("Foundations")).toBeDefined();
  });

  it("renders lesson titles", () => {
    render(<Sidebar curriculum={mockCurriculum} />);
    expect(screen.getByText("Why Distributed?")).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/szaher/go/src/github.com/szaher/saad/learn/ray-data
pnpm test -- __tests__/components/Sidebar.test.tsx
```

Expected: FAIL — component not found.

- [ ] **Step 3: Create ProgressBar component**

Create `src/components/ProgressBar.tsx`:

```tsx
export default function ProgressBar({ value, color }: { value: number; color: string }) {
  const pct = Math.round(value * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-xs text-[var(--text-secondary)] w-8 text-right">{pct}%</span>
    </div>
  );
}
```

- [ ] **Step 4: Create Sidebar component**

Create `src/components/Sidebar.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { CurriculumData } from "@/types";
import { getLessonProgress, getModuleProgress } from "@/lib/progress";
import ProgressBar from "./ProgressBar";

interface SidebarProps {
  curriculum: CurriculumData;
}

export default function Sidebar({ curriculum }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState<Record<number, boolean>>({});

  const toggleModule = (id: number) => {
    setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const totalLessons = curriculum.modules.reduce((sum, m) => sum + m.lessons.length, 0);
  const completedLessons = curriculum.modules.reduce((sum, m) => {
    return sum + m.lessons.filter((l) => getLessonProgress(m.id, l.slug)?.completed).length;
  }, 0);
  const overallProgress = totalLessons > 0 ? completedLessons / totalLessons : 0;

  return (
    <aside className="w-64 min-h-0 flex flex-col border-r border-white/[0.08] bg-[var(--bg-secondary)]">
      <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {curriculum.modules.map((mod) => {
          const isCollapsed = collapsed[mod.id] ?? false;
          const modProgress = getModuleProgress(mod.id, mod.lessons.length);

          return (
            <div key={mod.id}>
              <button
                onClick={() => toggleModule(mod.id)}
                className="w-full flex items-center gap-2 px-2 py-1.5 text-sm font-medium rounded-md hover:bg-white/[0.04] transition-colors"
                style={{ color: mod.color }}
              >
                <svg
                  className={`w-3 h-3 transition-transform ${isCollapsed ? "" : "rotate-90"}`}
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M6 6l6 4-6 4V6z" />
                </svg>
                <span className="uppercase text-xs tracking-wider">Module {mod.id}</span>
                {modProgress > 0 && modProgress < 1 && (
                  <span className="ml-auto text-xs text-[var(--text-secondary)]">
                    {Math.round(modProgress * 100)}%
                  </span>
                )}
                {modProgress === 1 && (
                  <span className="ml-auto text-xs" style={{ color: mod.color }}>
                    ✓
                  </span>
                )}
              </button>

              {!isCollapsed && (
                <ul className="ml-4 mt-0.5 space-y-0.5">
                  {mod.lessons.map((lesson) => {
                    const href = `/lesson/${mod.id}/${lesson.slug}`;
                    const isCurrent = pathname === href;
                    const lp = getLessonProgress(mod.id, lesson.slug);

                    return (
                      <li key={lesson.slug}>
                        <Link
                          href={href}
                          className={`flex items-center gap-2 px-2 py-1 text-sm rounded-md transition-colors ${
                            isCurrent
                              ? "bg-white/[0.08] text-[var(--text-primary)]"
                              : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/[0.04]"
                          }`}
                        >
                          <span className="w-4 text-center">
                            {lp?.completed ? (
                              <span style={{ color: mod.color }}>✓</span>
                            ) : isCurrent ? (
                              <span style={{ color: mod.color }}>▶</span>
                            ) : (
                              <span className="text-[var(--text-secondary)]">○</span>
                            )}
                          </span>
                          <span className="truncate">{lesson.title}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      <div className="p-4 border-t border-white/[0.08]">
        <div className="text-xs text-[var(--text-secondary)] mb-1.5">
          Progress: {Math.round(overallProgress * 100)}%
        </div>
        <ProgressBar value={overallProgress} color="var(--accent-green)" />
      </div>
    </aside>
  );
}
```

- [ ] **Step 5: Run tests**

```bash
cd /Users/szaher/go/src/github.com/szaher/saad/learn/ray-data
pnpm test -- __tests__/components/Sidebar.test.tsx
```

Expected: All 2 tests PASS.

- [ ] **Step 6: Commit**

```bash
cd /Users/szaher/go/src/github.com/szaher/saad/learn/ray-data
git add src/components/Sidebar.tsx src/components/ProgressBar.tsx __tests__/components/Sidebar.test.tsx
git commit -m "feat: add Sidebar with curriculum tree, progress tracking"
```

---

### Task 7: Root Layout Integration

**Files:**
- Modify: `src/app/layout.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Create the root layout with sidebar**

Replace `src/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import "./globals.css";
import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import { getCurriculum } from "@/lib/curriculum";

export const metadata: Metadata = {
  title: "Ray Data Academy",
  description: "Interactive platform for learning Ray and Ray Data",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const curriculum = await getCurriculum();

  return (
    <html lang="en" className="dark">
      <body className="min-h-screen flex flex-col">
        <Header />
        <div className="flex flex-1 min-h-0">
          <Sidebar curriculum={curriculum} />
          <main className="flex-1 overflow-y-auto">{children}</main>
        </div>
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Create the home page (dashboard)**

Replace `src/app/page.tsx`:

```tsx
import { getCurriculum } from "@/lib/curriculum";

export default async function HomePage() {
  const curriculum = await getCurriculum();

  return (
    <div className="max-w-4xl mx-auto px-8 py-12">
      <h1 className="text-3xl font-bold mb-2">Welcome to Ray Data Academy</h1>
      <p className="text-[var(--text-secondary)] mb-8">
        Master Ray and Ray Data from the ground up. {curriculum.modules.length} modules,{" "}
        {curriculum.modules.reduce((s, m) => s + m.lessons.length, 0)} lessons.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {curriculum.modules.map((mod) => (
          <a
            key={mod.id}
            href={`/lesson/${mod.id}/${mod.lessons[0].slug}`}
            className="block p-5 rounded-xl bg-[var(--bg-secondary)] border border-white/[0.08] hover:border-white/[0.16] transition-colors"
          >
            <div className="flex items-center gap-2 mb-2">
              <span
                className="text-xs font-semibold uppercase tracking-wider"
                style={{ color: mod.color }}
              >
                Module {mod.id}
              </span>
            </div>
            <h2 className="text-lg font-semibold mb-1">{mod.title}</h2>
            <p className="text-sm text-[var(--text-secondary)]">{mod.description}</p>
            <p className="text-xs text-[var(--text-secondary)] mt-2">
              {mod.lessons.length} lessons
            </p>
          </a>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify the app renders**

```bash
cd /Users/szaher/go/src/github.com/szaher/saad/learn/ray-data
pnpm dev &
sleep 5
curl -s http://localhost:3000 | grep -o "Ray Data Academy" | head -1
kill %1
```

Expected: "Ray Data Academy" appears in output.

- [ ] **Step 4: Commit**

```bash
cd /Users/szaher/go/src/github.com/szaher/saad/learn/ray-data
git add src/app/layout.tsx src/app/page.tsx
git commit -m "feat: integrate layout with sidebar and dashboard home page"
```

---

### Task 8: MermaidDiagram Component

**Files:**
- Create: `src/components/MermaidDiagram.tsx`, `__tests__/components/MermaidDiagram.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `__tests__/components/MermaidDiagram.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import MermaidDiagram from "@/components/MermaidDiagram";

vi.mock("mermaid", () => ({
  default: {
    initialize: vi.fn(),
    run: vi.fn(),
  },
}));

describe("MermaidDiagram", () => {
  it("renders a container with the chart code", () => {
    const chart = "graph TD; A-->B;";
    render(<MermaidDiagram chart={chart} />);
    const container = document.querySelector(".mermaid");
    expect(container).toBeDefined();
    expect(container?.textContent).toContain("graph TD");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/szaher/go/src/github.com/szaher/saad/learn/ray-data
pnpm test -- __tests__/components/MermaidDiagram.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement MermaidDiagram**

Create `src/components/MermaidDiagram.tsx`:

```tsx
"use client";

import mermaid from "mermaid";
import { useEffect, useId, useRef } from "react";

mermaid.initialize({
  startOnLoad: false,
  theme: "dark",
  themeVariables: {
    primaryColor: "#242734",
    primaryTextColor: "#e0e0e0",
    primaryBorderColor: "#63b3ed",
    lineColor: "#a0aec0",
    secondaryColor: "#1a1d27",
    tertiaryColor: "#0f1117",
  },
});

interface MermaidDiagramProps {
  chart: string;
}

export default function MermaidDiagram({ chart }: MermaidDiagramProps) {
  const ref = useRef<HTMLDivElement>(null);
  const id = useId().replace(/:/g, "-");

  useEffect(() => {
    if (!ref.current) return;

    const renderDiagram = async () => {
      try {
        const { svg } = await mermaid.render(`mermaid-${id}`, chart);
        if (ref.current) {
          ref.current.innerHTML = svg;
        }
      } catch {
        if (ref.current) {
          ref.current.textContent = chart;
        }
      }
    };

    renderDiagram();
  }, [chart, id]);

  return (
    <div className="my-6 p-4 bg-[var(--bg-tertiary)] rounded-xl border border-white/[0.08] overflow-x-auto">
      <div ref={ref} className="mermaid flex justify-center">
        {chart}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests**

```bash
cd /Users/szaher/go/src/github.com/szaher/saad/learn/ray-data
pnpm test -- __tests__/components/MermaidDiagram.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/szaher/go/src/github.com/szaher/saad/learn/ray-data
git add src/components/MermaidDiagram.tsx __tests__/components/MermaidDiagram.test.tsx
git commit -m "feat: add MermaidDiagram client component with dark theme"
```

---

### Task 9: CodeBlock Component

**Files:**
- Create: `src/components/CodeBlock.tsx`

- [ ] **Step 1: Create CodeBlock with Monaco**

Create `src/components/CodeBlock.tsx`:

```tsx
"use client";

import Editor from "@monaco-editor/react";
import { useState } from "react";

interface CodeBlockProps {
  code: string;
  language?: string;
  filename?: string;
}

export default function CodeBlock({ code, language = "python", filename }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const lineCount = code.split("\n").length;
  const height = Math.min(Math.max(lineCount * 20 + 20, 80), 500);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-4 rounded-xl border border-white/[0.08] overflow-hidden bg-[var(--bg-tertiary)]">
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.08]">
        <span className="text-xs text-[var(--text-secondary)]">
          {filename || language}
        </span>
        <button
          onClick={handleCopy}
          className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <Editor
        height={height}
        language={language}
        value={code}
        theme="vs-dark"
        options={{
          readOnly: true,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          fontSize: 13,
          lineNumbers: "on",
          folding: false,
          padding: { top: 12, bottom: 12 },
          renderLineHighlight: "none",
          overviewRulerLanes: 0,
          hideCursorInOverviewRuler: true,
          overviewRulerBorder: false,
          scrollbar: { vertical: "hidden", horizontal: "auto" },
        }}
      />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/szaher/go/src/github.com/szaher/saad/learn/ray-data
git add src/components/CodeBlock.tsx
git commit -m "feat: add CodeBlock component with Monaco editor, copy button"
```

---

### Task 10: Quiz Component

**Files:**
- Create: `src/components/Quiz.tsx`, `__tests__/components/Quiz.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `__tests__/components/Quiz.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Quiz from "@/components/Quiz";
import type { QuizQuestion } from "@/types";

const questions: QuizQuestion[] = [
  {
    question: "What does GIL stand for?",
    options: ["Global Interpreter Lock", "General Input Layer", "Graphics Interface Library"],
    correctIndex: 0,
    explanation: "The GIL is Python's Global Interpreter Lock.",
  },
];

describe("Quiz", () => {
  it("renders the question", () => {
    render(<Quiz questions={questions} onComplete={vi.fn()} />);
    expect(screen.getByText("What does GIL stand for?")).toBeDefined();
  });

  it("shows all options", () => {
    render(<Quiz questions={questions} onComplete={vi.fn()} />);
    expect(screen.getByText("Global Interpreter Lock")).toBeDefined();
    expect(screen.getByText("General Input Layer")).toBeDefined();
  });

  it("calls onComplete with score after answering", () => {
    const onComplete = vi.fn();
    render(<Quiz questions={questions} onComplete={onComplete} />);
    fireEvent.click(screen.getByText("Global Interpreter Lock"));
    fireEvent.click(screen.getByText("Submit"));
    expect(onComplete).toHaveBeenCalledWith(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/szaher/go/src/github.com/szaher/saad/learn/ray-data
pnpm test -- __tests__/components/Quiz.test.tsx
```

Expected: FAIL.

- [ ] **Step 3: Implement Quiz**

Create `src/components/Quiz.tsx`:

```tsx
"use client";

import { useState } from "react";
import type { QuizQuestion } from "@/types";

interface QuizProps {
  questions: QuizQuestion[];
  onComplete: (score: number) => void;
}

export default function Quiz({ questions, onComplete }: QuizProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);

  const q = questions[currentIndex];

  const handleSubmit = () => {
    if (selected === null) return;
    const isCorrect = selected === q.correctIndex;
    const newScore = score + (isCorrect ? 1 : 0);
    setScore(newScore);
    setSubmitted(true);

    if (currentIndex === questions.length - 1) {
      setFinished(true);
      onComplete(newScore);
    }
  };

  const handleNext = () => {
    setCurrentIndex((i) => i + 1);
    setSelected(null);
    setSubmitted(false);
  };

  if (finished) {
    return (
      <div className="my-6 p-6 rounded-xl bg-[var(--bg-secondary)] border border-white/[0.08]">
        <h3 className="text-lg font-semibold mb-2">Quiz Complete</h3>
        <p className="text-[var(--text-secondary)]">
          You got {score} out of {questions.length} correct.
        </p>
      </div>
    );
  }

  return (
    <div className="my-6 p-6 rounded-xl bg-[var(--bg-secondary)] border border-white/[0.08]">
      <div className="text-xs text-[var(--text-secondary)] mb-3">
        Question {currentIndex + 1} of {questions.length}
      </div>
      <h3 className="text-base font-medium mb-4">{q.question}</h3>

      <div className="space-y-2 mb-4">
        {q.options.map((opt, i) => {
          let style = "border-white/[0.08] hover:border-white/[0.16]";
          if (submitted && i === q.correctIndex) {
            style = "border-[var(--accent-green)] bg-[var(--accent-green)]/10";
          } else if (submitted && i === selected && i !== q.correctIndex) {
            style = "border-[var(--accent-red)] bg-[var(--accent-red)]/10";
          } else if (!submitted && i === selected) {
            style = "border-[var(--accent-blue)] bg-[var(--accent-blue)]/10";
          }

          return (
            <button
              key={i}
              onClick={() => !submitted && setSelected(i)}
              className={`w-full text-left px-4 py-2.5 rounded-lg border text-sm transition-colors ${style}`}
              disabled={submitted}
            >
              {opt}
            </button>
          );
        })}
      </div>

      {submitted && (
        <p className="text-sm text-[var(--text-secondary)] mb-4 p-3 rounded-lg bg-[var(--bg-tertiary)]">
          {q.explanation}
        </p>
      )}

      <div className="flex justify-end">
        {!submitted ? (
          <button
            onClick={handleSubmit}
            disabled={selected === null}
            className="px-4 py-2 text-sm rounded-lg bg-[var(--accent-blue)] text-white disabled:opacity-40 hover:opacity-90 transition-opacity"
          >
            Submit
          </button>
        ) : currentIndex < questions.length - 1 ? (
          <button
            onClick={handleNext}
            className="px-4 py-2 text-sm rounded-lg bg-[var(--accent-blue)] text-white hover:opacity-90 transition-opacity"
          >
            Next
          </button>
        ) : null}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests**

```bash
cd /Users/szaher/go/src/github.com/szaher/saad/learn/ray-data
pnpm test -- __tests__/components/Quiz.test.tsx
```

Expected: All 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/szaher/go/src/github.com/szaher/saad/learn/ray-data
git add src/components/Quiz.tsx __tests__/components/Quiz.test.tsx
git commit -m "feat: add Quiz component with scoring and explanations"
```

---

### Task 11: MDX Components Wiring

**Files:**
- Modify: `mdx-components.tsx`

- [ ] **Step 1: Wire custom components into MDX**

Replace `mdx-components.tsx`:

```tsx
import type { MDXComponents } from "mdx/types";
import MermaidDiagram from "@/components/MermaidDiagram";
import CodeBlock from "@/components/CodeBlock";

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    ...components,
    MermaidDiagram,
    CodeBlock,
    pre: ({ children, ...props }: React.ComponentPropsWithoutRef<"pre">) => {
      return <pre {...props}>{children}</pre>;
    },
  };
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/szaher/go/src/github.com/szaher/saad/learn/ray-data
git add mdx-components.tsx
git commit -m "feat: wire MermaidDiagram and CodeBlock into MDX components"
```

---

### Task 12: Curriculum API Route

**Files:**
- Create: `src/app/api/curriculum/route.ts`

- [ ] **Step 1: Create the curriculum API**

Create `src/app/api/curriculum/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { getCurriculum } from "@/lib/curriculum";

export const dynamic = "force-dynamic";

export async function GET() {
  const curriculum = await getCurriculum();
  return NextResponse.json(curriculum);
}
```

- [ ] **Step 2: Verify the endpoint**

```bash
cd /Users/szaher/go/src/github.com/szaher/saad/learn/ray-data
pnpm dev &
sleep 5
curl -s http://localhost:3000/api/curriculum | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'{len(d[\"modules\"])} modules')"
kill %1
```

Expected: `7 modules`

- [ ] **Step 3: Commit**

```bash
cd /Users/szaher/go/src/github.com/szaher/saad/learn/ray-data
git add src/app/api/curriculum/route.ts
git commit -m "feat: add /api/curriculum endpoint"
```

---

### Task 13: Lesson API Route

**Files:**
- Create: `src/app/api/lesson/[module]/[lesson]/route.ts`, `src/lib/mdx.ts`

- [ ] **Step 1: Create MDX parsing utility**

Create `src/lib/mdx.ts`:

```typescript
import matter from "gray-matter";

export interface ParsedLesson {
  frontmatter: Record<string, unknown>;
  content: string;
}

export function parseMDX(raw: string): ParsedLesson {
  const { data, content } = matter(raw);
  return { frontmatter: data, content };
}
```

- [ ] **Step 2: Create the lesson API route**

Create directories and file `src/app/api/lesson/[module]/[lesson]/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getLessonContent, getModuleMeta } from "@/lib/curriculum";
import { parseMDX } from "@/lib/mdx";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ module: string; lesson: string }> }
) {
  const { module: moduleStr, lesson: lessonSlug } = await params;
  const moduleId = parseInt(moduleStr, 10);

  if (isNaN(moduleId)) {
    return NextResponse.json({ error: "Invalid module ID" }, { status: 400 });
  }

  const moduleMeta = await getModuleMeta(moduleId);
  if (!moduleMeta) {
    return NextResponse.json({ error: "Module not found" }, { status: 404 });
  }

  const lessonMeta = moduleMeta.lessons.find((l) => l.slug === lessonSlug);
  if (!lessonMeta) {
    return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
  }

  const raw = await getLessonContent(moduleId, lessonSlug);
  if (!raw) {
    return NextResponse.json({ error: "Lesson content not found" }, { status: 404 });
  }

  const { frontmatter, content } = parseMDX(raw);

  return NextResponse.json({
    module: moduleMeta,
    lesson: lessonMeta,
    frontmatter,
    content,
  });
}
```

- [ ] **Step 3: Commit**

```bash
cd /Users/szaher/go/src/github.com/szaher/saad/learn/ray-data
git add src/lib/mdx.ts src/app/api/lesson/
git commit -m "feat: add /api/lesson/[module]/[lesson] route with MDX parsing"
```

---

### Task 14: Lesson Page Component

**Files:**
- Create: `src/app/lesson/[module]/[lesson]/page.tsx`, `src/components/LessonContent.tsx`

- [ ] **Step 1: Create LessonContent component**

Create `src/components/LessonContent.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import type { LessonMeta, ModuleMeta, QuizQuestion } from "@/types";
import { markLessonComplete } from "@/lib/progress";
import Quiz from "./Quiz";

interface LessonContentProps {
  module: ModuleMeta;
  lesson: LessonMeta;
  children: React.ReactNode;
  quiz?: QuizQuestion[];
  prevHref?: string;
  nextHref?: string;
}

export default function LessonContent({
  module: mod,
  lesson,
  children,
  quiz,
  prevHref,
  nextHref,
}: LessonContentProps) {
  const router = useRouter();

  const handleQuizComplete = (score: number) => {
    markLessonComplete(mod.id, lesson.slug, score);
  };

  const handleNext = () => {
    markLessonComplete(mod.id, lesson.slug);
    if (nextHref) router.push(nextHref);
  };

  return (
    <div className="max-w-3xl mx-auto px-8 py-10">
      <div className="mb-6">
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: mod.color }}>
          Module {mod.id}: {mod.title}
        </span>
        <h1 className="text-2xl font-bold mt-1">{lesson.title}</h1>
        <p className="text-[var(--text-secondary)] text-sm mt-1">{lesson.description}</p>
        <div className="flex items-center gap-3 mt-2 text-xs text-[var(--text-secondary)]">
          <span>~{lesson.estimatedMinutes} min read</span>
          {lesson.hasCode && <span>Includes code</span>}
        </div>
      </div>

      <div className="prose prose-invert max-w-none">{children}</div>

      {quiz && quiz.length > 0 && (
        <div className="mt-10">
          <h2 className="text-lg font-semibold mb-4">Check Your Understanding</h2>
          <Quiz questions={quiz} onComplete={handleQuizComplete} />
        </div>
      )}

      <div className="flex items-center justify-between mt-12 pt-6 border-t border-white/[0.08]">
        {prevHref ? (
          <a href={prevHref} className="text-sm text-[var(--accent-blue)] hover:underline">
            ← Previous
          </a>
        ) : (
          <div />
        )}
        {nextHref ? (
          <button
            onClick={handleNext}
            className="px-5 py-2 text-sm rounded-lg bg-[var(--accent-blue)] text-white hover:opacity-90 transition-opacity"
          >
            Next →
          </button>
        ) : (
          <div />
        )}
      </div>

      <div className="mt-8 p-4 rounded-xl bg-[var(--bg-secondary)] border border-white/[0.08]">
        <a
          href={`/chat?context=${mod.id}:${lesson.slug}`}
          className="flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-[var(--accent-blue)] transition-colors"
        >
          <span>💬</span>
          <span>Ask about this lesson...</span>
        </a>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create the lesson page**

Create `src/app/lesson/[module]/[lesson]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { getCurriculum, getLessonContent, getModuleMeta } from "@/lib/curriculum";
import LessonContent from "@/components/LessonContent";
import { parseMDX } from "@/lib/mdx";
import { MDXRemote } from "@/components/MDXRemote";

interface LessonPageProps {
  params: Promise<{ module: string; lesson: string }>;
}

export default async function LessonPage({ params }: LessonPageProps) {
  const { module: moduleStr, lesson: lessonSlug } = await params;
  const moduleId = parseInt(moduleStr, 10);

  const moduleMeta = await getModuleMeta(moduleId);
  if (!moduleMeta) notFound();

  const lessonIndex = moduleMeta.lessons.findIndex((l) => l.slug === lessonSlug);
  if (lessonIndex === -1) notFound();

  const lesson = moduleMeta.lessons[lessonIndex];
  const raw = await getLessonContent(moduleId, lessonSlug);
  if (!raw) notFound();

  const { frontmatter, content } = parseMDX(raw);
  const quiz = (frontmatter.quiz as unknown[]) ?? [];

  const curriculum = await getCurriculum();

  let prevHref: string | undefined;
  let nextHref: string | undefined;

  if (lessonIndex > 0) {
    prevHref = `/lesson/${moduleId}/${moduleMeta.lessons[lessonIndex - 1].slug}`;
  } else {
    const prevModule = curriculum.modules.find((m) => m.id === moduleId - 1);
    if (prevModule) {
      prevHref = `/lesson/${prevModule.id}/${prevModule.lessons[prevModule.lessons.length - 1].slug}`;
    }
  }

  if (lessonIndex < moduleMeta.lessons.length - 1) {
    nextHref = `/lesson/${moduleId}/${moduleMeta.lessons[lessonIndex + 1].slug}`;
  } else {
    const nextModule = curriculum.modules.find((m) => m.id === moduleId + 1);
    if (nextModule) {
      nextHref = `/lesson/${nextModule.id}/${nextModule.lessons[0].slug}`;
    }
  }

  return (
    <LessonContent
      module={moduleMeta}
      lesson={lesson}
      quiz={quiz as any}
      prevHref={prevHref}
      nextHref={nextHref}
    >
      <MDXRemote source={content} />
    </LessonContent>
  );
}
```

- [ ] **Step 3: Create MDXRemote wrapper**

Since we're loading MDX dynamically (from content/ dir, not as pages), install `next-mdx-remote`:

```bash
cd /Users/szaher/go/src/github.com/szaher/saad/learn/ray-data
pnpm add next-mdx-remote
```

Create `src/components/MDXRemote.tsx`:

```tsx
import { MDXRemote as BaseMDXRemote } from "next-mdx-remote/rsc";
import MermaidDiagram from "./MermaidDiagram";
import CodeBlock from "./CodeBlock";

const components = {
  MermaidDiagram,
  CodeBlock,
};

interface MDXRemoteProps {
  source: string;
}

export function MDXRemote({ source }: MDXRemoteProps) {
  return <BaseMDXRemote source={source} components={components} />;
}
```

- [ ] **Step 4: Commit**

```bash
cd /Users/szaher/go/src/github.com/szaher/saad/learn/ray-data
git add src/app/lesson/ src/components/LessonContent.tsx src/components/MDXRemote.tsx
git commit -m "feat: add lesson page with MDX rendering, navigation, quiz"
```

---

### Task 15: Claude CLI Wrapper

**Files:**
- Create: `src/lib/claude.ts`, `__tests__/lib/claude.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/lib/claude.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { buildSystemPrompt } from "@/lib/claude";

describe("buildSystemPrompt", () => {
  it("includes tutor role", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain("Ray Data tutor");
  });

  it("includes Ray version", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain("2.55.1");
  });

  it("includes mermaid instruction", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain("mermaid");
  });

  it("includes module context when provided", () => {
    const prompt = buildSystemPrompt({ moduleTitle: "Ray Core", lessonTitle: "Tasks" });
    expect(prompt).toContain("Ray Core");
    expect(prompt).toContain("Tasks");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/szaher/go/src/github.com/szaher/saad/learn/ray-data
pnpm test -- __tests__/lib/claude.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement claude.ts**

Create `src/lib/claude.ts`:

```typescript
import { spawn } from "child_process";
import type { ChatMessage } from "@/types";

interface PromptContext {
  moduleTitle?: string;
  lessonTitle?: string;
  history?: ChatMessage[];
}

export function buildSystemPrompt(context?: PromptContext): string {
  let prompt = `You are an expert Ray Data tutor. You teach distributed computing concepts using Ray (version 2.55.1).

Your role:
- Explain concepts clearly with visual diagrams and code examples
- Use \`\`\`mermaid code blocks for architecture diagrams, flowcharts, and sequence diagrams
- Use \`\`\`python code blocks with Ray 2.55.1 APIs for code examples
- Break complex topics into digestible pieces
- Use analogies to connect new concepts to familiar ones
- Be encouraging and patient — the student is a complete beginner

When generating diagrams, always use mermaid syntax. For example:
\`\`\`mermaid
graph TD
    A[Input Data] --> B[Ray Dataset]
    B --> C[Transform]
    C --> D[Output]
\`\`\`

Always use Ray 2.55.1 APIs. Key imports: ray, ray.data. The Dataset class is the core abstraction.`;

  if (context?.moduleTitle) {
    prompt += `\n\nThe student is currently studying: Module "${context.moduleTitle}"`;
    if (context.lessonTitle) {
      prompt += `, Lesson "${context.lessonTitle}"`;
    }
    prompt += ". Tailor your answers to this context.";
  }

  if (context?.history && context.history.length > 0) {
    const recent = context.history.slice(-10);
    prompt += "\n\nRecent conversation history:\n";
    for (const msg of recent) {
      prompt += `${msg.role === "user" ? "Student" : "Tutor"}: ${msg.content}\n`;
    }
  }

  return prompt;
}

export function streamClaude(
  userMessage: string,
  context?: PromptContext
): { stream: AsyncIterable<string>; kill: () => void } {
  const systemPrompt = buildSystemPrompt(context);

  const proc = spawn(
    "claude",
    ["--print", "--output-format", "text", "-p", userMessage],
    {
      shell: true,
      env: {
        ...process.env,
        CLAUDE_SYSTEM_PROMPT: systemPrompt,
      },
      stdio: ["ignore", "pipe", "pipe"],
    }
  );

  const stream = (async function* () {
    if (!proc.stdout) return;

    for await (const chunk of proc.stdout) {
      yield chunk.toString();
    }
  })();

  return {
    stream,
    kill: () => proc.kill(),
  };
}
```

- [ ] **Step 4: Run tests**

```bash
cd /Users/szaher/go/src/github.com/szaher/saad/learn/ray-data
pnpm test -- __tests__/lib/claude.test.ts
```

Expected: All 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/szaher/go/src/github.com/szaher/saad/learn/ray-data
git add src/lib/claude.ts __tests__/lib/claude.test.ts
git commit -m "feat: add Claude CLI wrapper with system prompt builder and streaming"
```

---

### Task 16: Chat API Route

**Files:**
- Create: `src/app/api/chat/route.ts`

- [ ] **Step 1: Create the SSE chat endpoint**

Create `src/app/api/chat/route.ts`:

```typescript
import { NextRequest } from "next/server";
import { streamClaude } from "@/lib/claude";
import type { ChatMessage } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const {
    message,
    context,
  }: {
    message: string;
    context?: {
      moduleTitle?: string;
      lessonTitle?: string;
      history?: ChatMessage[];
    };
  } = body;

  if (!message || typeof message !== "string") {
    return new Response(JSON.stringify({ error: "Message required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { stream, kill } = streamClaude(message, context);

  const encoder = new TextEncoder();
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();

  (async () => {
    try {
      for await (const chunk of stream) {
        await writer.write(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
      }
      await writer.write(encoder.encode("data: [DONE]\n\n"));
    } catch (err) {
      await writer.write(
        encoder.encode(`data: ${JSON.stringify({ error: String(err) })}\n\n`)
      );
    } finally {
      await writer.close();
    }
  })();

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/szaher/go/src/github.com/szaher/saad/learn/ray-data
git add src/app/api/chat/route.ts
git commit -m "feat: add /api/chat SSE streaming endpoint"
```

---

### Task 17: ChatMessage Component

**Files:**
- Create: `src/components/ChatMessage.tsx`

- [ ] **Step 1: Create ChatMessage with Mermaid detection**

Create `src/components/ChatMessage.tsx`:

```tsx
"use client";

import MermaidDiagram from "./MermaidDiagram";

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
}

export default function ChatMessage({ role, content }: ChatMessageProps) {
  const parts = parseContent(content);

  return (
    <div className={`py-4 ${role === "user" ? "pl-12" : "pr-12"}`}>
      <div className="text-xs text-[var(--text-secondary)] mb-1.5">
        {role === "user" ? "You" : "Claude"}
      </div>
      <div
        className={`rounded-xl px-4 py-3 ${
          role === "user"
            ? "bg-[var(--accent-blue)]/10 border border-[var(--accent-blue)]/20"
            : "bg-[var(--bg-secondary)] border border-white/[0.08]"
        }`}
      >
        {parts.map((part, i) => {
          if (part.type === "mermaid") {
            return <MermaidDiagram key={i} chart={part.content} />;
          }
          if (part.type === "code") {
            return (
              <pre
                key={i}
                className="my-3 p-3 bg-[var(--bg-tertiary)] rounded-lg text-sm overflow-x-auto"
              >
                <code>{part.content}</code>
              </pre>
            );
          }
          return (
            <div key={i} className="text-sm leading-relaxed whitespace-pre-wrap">
              {part.content}
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface ContentPart {
  type: "text" | "mermaid" | "code";
  content: string;
  language?: string;
}

function parseContent(content: string): ContentPart[] {
  const parts: ContentPart[] = [];
  const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      const text = content.slice(lastIndex, match.index).trim();
      if (text) parts.push({ type: "text", content: text });
    }

    const language = match[1];
    const code = match[2].trim();

    if (language === "mermaid") {
      parts.push({ type: "mermaid", content: code });
    } else {
      parts.push({ type: "code", content: code, language });
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    const text = content.slice(lastIndex).trim();
    if (text) parts.push({ type: "text", content: text });
  }

  if (parts.length === 0) {
    parts.push({ type: "text", content });
  }

  return parts;
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/szaher/go/src/github.com/szaher/saad/learn/ray-data
git add src/components/ChatMessage.tsx
git commit -m "feat: add ChatMessage with mermaid/code block detection"
```

---

### Task 18: Chat Interface Component

**Files:**
- Create: `src/components/ChatInterface.tsx`

- [ ] **Step 1: Create the full chat UI**

Create `src/components/ChatInterface.tsx`:

```tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatMessage as ChatMessageType } from "@/types";
import ChatMessage from "./ChatMessage";

interface ChatInterfaceProps {
  initialContext?: {
    moduleTitle?: string;
    lessonTitle?: string;
  };
}

const STORAGE_KEY = "ray-data-academy-chat";

function loadHistory(): ChatMessageType[] {
  if (typeof localStorage === "undefined") return [];
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : [];
}

function saveHistory(messages: ChatMessageType[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
}

export default function ChatInterface({ initialContext }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages(loadHistory());
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || streaming) return;

      const userMsg: ChatMessageType = {
        id: crypto.randomUUID(),
        role: "user",
        content: text.trim(),
        timestamp: new Date().toISOString(),
      };

      const assistantMsg: ChatMessageType = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "",
        timestamp: new Date().toISOString(),
      };

      const updated = [...messages, userMsg, assistantMsg];
      setMessages(updated);
      setInput("");
      setStreaming(true);

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: text.trim(),
            context: {
              ...initialContext,
              history: messages.slice(-10),
            },
          }),
        });

        if (!response.ok || !response.body) {
          throw new Error("Chat request failed");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullContent = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const text = decoder.decode(value);
          const lines = text.split("\n");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6);
              if (data === "[DONE]") break;
              try {
                const chunk = JSON.parse(data);
                fullContent += chunk;
                setMessages((prev) => {
                  const copy = [...prev];
                  copy[copy.length - 1] = {
                    ...copy[copy.length - 1],
                    content: fullContent,
                  };
                  return copy;
                });
              } catch {
                // skip malformed chunks
              }
            }
          }
        }

        setMessages((prev) => {
          saveHistory(prev);
          return prev;
        });
      } catch (err) {
        setMessages((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = {
            ...copy[copy.length - 1],
            content: `Error: ${err instanceof Error ? err.message : "Unknown error"}`,
          };
          return copy;
        });
      } finally {
        setStreaming(false);
      }
    },
    [messages, streaming, initialContext]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full text-[var(--text-secondary)]">
            <div className="text-center">
              <p className="text-lg mb-2">Ask anything about Ray Data</p>
              <p className="text-sm">I'll explain with diagrams and code examples</p>
            </div>
          </div>
        )}
        {messages.map((msg) => (
          <ChatMessage key={msg.id} role={msg.role} content={msg.content} />
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="p-4 border-t border-white/[0.08]">
        <div className="flex items-center gap-2 bg-[var(--bg-secondary)] rounded-xl border border-white/[0.08] px-4 py-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question about Ray Data..."
            className="flex-1 bg-transparent outline-none text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]"
            disabled={streaming}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || streaming}
            className="px-3 py-1.5 text-sm rounded-lg bg-[var(--accent-blue)] text-white disabled:opacity-40 hover:opacity-90 transition-opacity"
          >
            {streaming ? "..." : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/szaher/go/src/github.com/szaher/saad/learn/ray-data
git add src/components/ChatInterface.tsx
git commit -m "feat: add ChatInterface with SSE streaming and localStorage history"
```

---

### Task 19: Chat Page

**Files:**
- Create: `src/app/chat/page.tsx`

- [ ] **Step 1: Create the chat page**

Create `src/app/chat/page.tsx`:

```tsx
import ChatInterface from "@/components/ChatInterface";

export default function ChatPage() {
  return (
    <div className="h-full flex flex-col">
      <ChatInterface />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/szaher/go/src/github.com/szaher/saad/learn/ray-data
git add src/app/chat/page.tsx
git commit -m "feat: add chat page"
```

---

### Task 20: Export API Route

**Files:**
- Create: `src/app/api/export/route.ts`

- [ ] **Step 1: Create the export endpoint**

Create `src/app/api/export/route.ts`:

```typescript
import { spawn } from "child_process";
import path from "path";
import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { module: moduleId, format = "both" } = body;

  const scriptPath = path.join(process.cwd(), "scripts", "export.py");
  const args = ["scripts/export.py"];

  if (moduleId) {
    args.push("--module", String(moduleId));
  }
  args.push("--format", format);

  const encoder = new TextEncoder();
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();

  const proc = spawn("python3", args, {
    cwd: process.cwd(),
    stdio: ["ignore", "pipe", "pipe"],
  });

  (async () => {
    try {
      if (proc.stdout) {
        for await (const chunk of proc.stdout) {
          await writer.write(
            encoder.encode(`data: ${JSON.stringify({ message: chunk.toString() })}\n\n`)
          );
        }
      }
      await writer.write(encoder.encode(`data: ${JSON.stringify({ status: "done" })}\n\n`));
    } catch (err) {
      await writer.write(
        encoder.encode(`data: ${JSON.stringify({ error: String(err) })}\n\n`)
      );
    } finally {
      await writer.close();
    }
  })();

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/szaher/go/src/github.com/szaher/saad/learn/ray-data
git add src/app/api/export/route.ts
git commit -m "feat: add /api/export SSE endpoint for Python sidecar"
```

---

### Task 21: Python Export Sidecar

**Files:**
- Create: `scripts/export.py`, `scripts/requirements.txt`

- [ ] **Step 1: Create requirements.txt**

Create `scripts/requirements.txt`:

```
nbformat>=5.10
plotly>=6.0
graphviz>=0.20
```

- [ ] **Step 2: Create export.py**

Create `scripts/export.py`:

```python
#!/usr/bin/env python3
"""Export Ray Data Academy lessons to Markdown and Jupyter Notebooks."""

import argparse
import json
import os
import re
import sys
from pathlib import Path

try:
    import nbformat
except ImportError:
    print("Error: nbformat not installed. Run: pip install -r scripts/requirements.txt", file=sys.stderr)
    sys.exit(1)


ROOT = Path(__file__).resolve().parent.parent
CONTENT_DIR = ROOT / "content"
EXPORTS_DIR = ROOT / "exports"


def log(msg: str) -> None:
    print(msg, flush=True)


def load_meta(module_id: int) -> dict:
    meta_path = CONTENT_DIR / f"module-{module_id}" / "meta.json"
    with open(meta_path) as f:
        return json.load(f)


def read_mdx(module_id: int, slug: str) -> str | None:
    mdx_path = CONTENT_DIR / f"module-{module_id}" / f"{slug}.mdx"
    if not mdx_path.exists():
        return None
    return mdx_path.read_text()


def strip_frontmatter(content: str) -> str:
    if content.startswith("---"):
        end = content.find("---", 3)
        if end != -1:
            return content[end + 3 :].strip()
    return content


def mdx_to_markdown(content: str) -> str:
    content = strip_frontmatter(content)
    content = re.sub(r"<MermaidDiagram\s+chart=\{`([^`]+)`\}\s*/>", r"```mermaid\n\1\n```", content)
    content = re.sub(r"<CodeBlock[^>]*code=\{`([^`]+)`\}[^>]*/>", r"```python\n\1\n```", content)
    content = re.sub(r"<Quiz[^/]*/>\s*", "", content)
    content = re.sub(r"<[A-Z]\w+[^>]*/>\s*", "", content)
    return content.strip()


def mdx_to_notebook(content: str, meta: dict) -> nbformat.NotebookNode:
    nb = nbformat.v4.new_notebook()
    nb.metadata["kernelspec"] = {
        "display_name": "Python 3",
        "language": "python",
        "name": "python3",
    }

    nb.cells.append(nbformat.v4.new_markdown_cell(f"# {meta.get('title', 'Lesson')}\n\n{meta.get('description', '')}"))

    content = strip_frontmatter(content)
    chunks = re.split(r"(```\w*\n[\s\S]*?```)", content)

    for chunk in chunks:
        chunk = chunk.strip()
        if not chunk:
            continue

        code_match = re.match(r"```(\w*)\n([\s\S]*?)```", chunk)
        if code_match:
            lang = code_match.group(1)
            code = code_match.group(2).strip()
            if lang == "python":
                nb.cells.append(nbformat.v4.new_code_cell(code))
            elif lang == "mermaid":
                nb.cells.append(nbformat.v4.new_markdown_cell(f"```mermaid\n{code}\n```"))
            else:
                nb.cells.append(nbformat.v4.new_markdown_cell(f"```{lang}\n{code}\n```"))
        else:
            clean = re.sub(r"<[A-Z]\w+[^>]*/>\s*", "", chunk).strip()
            if clean:
                nb.cells.append(nbformat.v4.new_markdown_cell(clean))

    return nb


def export_lesson(module_id: int, lesson_meta: dict, fmt: str) -> list[str]:
    slug = lesson_meta["slug"]
    title = lesson_meta["title"]
    raw = read_mdx(module_id, slug)
    if raw is None:
        log(f"  Skipping {slug} (no MDX file)")
        return []

    files = []
    md_dir = EXPORTS_DIR / "markdown" / f"module-{module_id}"
    nb_dir = EXPORTS_DIR / "notebooks" / f"module-{module_id}"

    if fmt in ("markdown", "both"):
        md_dir.mkdir(parents=True, exist_ok=True)
        md_content = mdx_to_markdown(raw)
        md_path = md_dir / f"{slug}.md"
        md_path.write_text(f"# {title}\n\n{md_content}\n")
        files.append(str(md_path))
        log(f"  Wrote {md_path.relative_to(ROOT)}")

    if fmt in ("notebook", "both"):
        nb_dir.mkdir(parents=True, exist_ok=True)
        nb = mdx_to_notebook(raw, lesson_meta)
        nb_path = nb_dir / f"{slug}.ipynb"
        nbformat.write(nb, str(nb_path))
        files.append(str(nb_path))
        log(f"  Wrote {nb_path.relative_to(ROOT)}")

    return files


def export_module(module_id: int, fmt: str) -> list[str]:
    meta = load_meta(module_id)
    log(f"Exporting Module {module_id}: {meta['title']}")
    all_files = []
    for lesson in meta["lessons"]:
        all_files.extend(export_lesson(module_id, lesson, fmt))
    return all_files


def main():
    parser = argparse.ArgumentParser(description="Export Ray Data Academy lessons")
    parser.add_argument("--module", type=int, help="Module number to export (default: all)")
    parser.add_argument("--format", choices=["markdown", "notebook", "both"], default="both")
    args = parser.parse_args()

    all_files = []

    if args.module:
        all_files = export_module(args.module, args.format)
    else:
        modules = sorted(CONTENT_DIR.glob("module-*/meta.json"))
        for meta_path in modules:
            module_id = int(meta_path.parent.name.split("-")[1])
            all_files.extend(export_module(module_id, args.format))

    log(f"\nDone: {len(all_files)} files written")


if __name__ == "__main__":
    main()
```

- [ ] **Step 3: Install Python dependencies**

```bash
pip3 install -r /Users/szaher/go/src/github.com/szaher/saad/learn/ray-data/scripts/requirements.txt
```

- [ ] **Step 4: Commit**

```bash
cd /Users/szaher/go/src/github.com/szaher/saad/learn/ray-data
git add scripts/
git commit -m "feat: add Python export sidecar for markdown and notebook generation"
```

---

### Task 22: ExportMenu Component

**Files:**
- Create: `src/components/ExportMenu.tsx`
- Modify: `src/components/Header.tsx` (replace ExportButton)

- [ ] **Step 1: Create ExportMenu**

Create `src/components/ExportMenu.tsx`:

```tsx
"use client";

import { useState } from "react";

export default function ExportMenu() {
  const [open, setOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [status, setStatus] = useState("");

  const handleExport = async (scope: "all" | number, format: string) => {
    setExporting(true);
    setStatus("Starting export...");
    setOpen(false);

    try {
      const body: Record<string, unknown> = { format };
      if (scope !== "all") body.module = scope;

      const response = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok || !response.body) throw new Error("Export failed");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value);
        const lines = text.split("\n");
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.message) setStatus(data.message.trim());
              if (data.status === "done") setStatus("Export complete!");
            } catch {
              // skip
            }
          }
        }
      }
    } catch (err) {
      setStatus(`Error: ${err instanceof Error ? err.message : "Unknown"}`);
    } finally {
      setExporting(false);
      setTimeout(() => setStatus(""), 5000);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--bg-tertiary)] rounded-lg transition-colors"
        disabled={exporting}
      >
        {exporting ? "Exporting..." : "Export"}
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-48 bg-[var(--bg-secondary)] border border-white/[0.08] rounded-xl shadow-xl z-50">
          <div className="py-1">
            <button onClick={() => handleExport("all", "both")} className="w-full text-left px-4 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/[0.04]">
              Export All (MD + Notebook)
            </button>
            <button onClick={() => handleExport("all", "markdown")} className="w-full text-left px-4 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/[0.04]">
              Export All (Markdown only)
            </button>
            <button onClick={() => handleExport("all", "notebook")} className="w-full text-left px-4 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/[0.04]">
              Export All (Notebooks only)
            </button>
          </div>
        </div>
      )}

      {status && (
        <div className="absolute right-0 mt-2 w-64 px-3 py-2 bg-[var(--bg-secondary)] border border-white/[0.08] rounded-lg text-xs text-[var(--text-secondary)] z-50">
          {status}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Update Header to use ExportMenu**

In `src/components/Header.tsx`, replace the `ExportButton` function and its usage with:

```tsx
import ExportMenu from "./ExportMenu";
```

And replace `<ExportButton />` with `<ExportMenu />`. Remove the old `ExportButton` function.

- [ ] **Step 3: Commit**

```bash
cd /Users/szaher/go/src/github.com/szaher/saad/learn/ray-data
git add src/components/ExportMenu.tsx src/components/Header.tsx
git commit -m "feat: add ExportMenu with streaming progress"
```

---

### Task 23: Module 1 Content (Starter Lessons)

**Files:**
- Create: `content/module-1/01-why-distributed.mdx`, `content/module-1/02-gil-problem.mdx`, `content/module-1/03-map-reduce.mdx`, `content/module-1/04-rays-big-idea.mdx`

These 4 lessons serve as the template for all remaining content. Each follows the 5-step pattern: concept, diagram, code (if applicable), deep dive prompt, quiz.

- [ ] **Step 1: Create lesson 1.1 — Why Distributed Computing?**

Create `content/module-1/01-why-distributed.mdx`:

```mdx
---
title: "Why Distributed Computing?"
quiz:
  - question: "What is the main reason we need distributed computing?"
    options:
      - "To make code look more complex"
      - "Single machines can't handle the scale of modern data and compute needs"
      - "It's always faster than single-machine processing"
      - "Python requires it"
    correctIndex: 1
    explanation: "Distributed computing exists because modern datasets and compute workloads exceed what a single machine can handle in reasonable time."
  - question: "Which of these is NOT a limitation of single-machine processing?"
    options:
      - "RAM capacity"
      - "CPU core count"
      - "Network bandwidth between cores"
      - "Disk I/O throughput"
    correctIndex: 2
    explanation: "CPU cores on the same machine communicate via shared memory, not network. Network bandwidth is a concern in distributed systems, not single-machine processing."
---

## The Problem: Why One Machine Isn't Enough

Imagine you have a dataset of 10 billion rows. At 100 bytes per row, that's **1 terabyte** of data. Your laptop has 16 GB of RAM. You can't even load the data, let alone process it.

This is the fundamental problem distributed computing solves: **when your data or computation exceeds what a single machine can handle**.

<MermaidDiagram chart={`graph LR
    subgraph "Single Machine"
        A[16 GB RAM] --> B[4 CPU Cores]
        B --> C[1 TB Disk]
    end
    subgraph "The Problem"
        D[10 Billion Rows\n1 TB Data]
    end
    D -->|"Won't fit in RAM"| A
    style D fill:#fc8181,stroke:#fc8181,color:#1a1d27
    style A fill:#242734,stroke:#63b3ed,color:#e0e0e0
    style B fill:#242734,stroke:#63b3ed,color:#e0e0e0
    style C fill:#242734,stroke:#63b3ed,color:#e0e0e0
`} />

## The Solution: Use More Machines

Instead of one machine with 16 GB, use **64 machines** with 16 GB each. Now you have 1 TB of combined RAM. Split the data across all machines, process in parallel, combine the results.

<MermaidDiagram chart={`graph TD
    D[1 TB Dataset] --> S[Split]
    S --> M1[Machine 1\n16 GB slice]
    S --> M2[Machine 2\n16 GB slice]
    S --> M3[Machine 3\n16 GB slice]
    S --> M4[... Machine 64\n16 GB slice]
    M1 --> C[Combine Results]
    M2 --> C
    M3 --> C
    M4 --> C
    C --> R[Final Result]
    style D fill:#63b3ed,stroke:#63b3ed,color:#1a1d27
    style R fill:#68d391,stroke:#68d391,color:#1a1d27
`} />

## Three Reasons You Need Distribution

**1. Data doesn't fit in memory** — Your dataset is larger than any single machine's RAM. You need to spread it across many machines.

**2. Computation takes too long** — Processing 1 TB on 4 cores might take 10 hours. On 256 cores across 64 machines, it takes ~10 minutes.

**3. Fault tolerance** — If one machine dies, you don't lose everything. The work can be redistributed.

## The Challenge

Distributed computing sounds simple — just split the work! But it introduces hard problems:

- **How do you split the data?** Not all splits are equal.
- **How do machines communicate?** Network is 1000x slower than memory.
- **What happens when a machine fails?** Mid-computation.
- **How do you collect results?** Some operations (like sorting) need coordination.

This is what frameworks like **Ray** solve for you. Instead of managing machines, networks, and failures yourself, you write Python code and Ray handles the distribution.
```

- [ ] **Step 2: Create lesson 1.2 — The GIL Problem**

Create `content/module-1/02-gil-problem.mdx`:

```mdx
---
title: "The GIL Problem & Python's Limits"
quiz:
  - question: "What does the GIL prevent in Python?"
    options:
      - "Running Python on multiple machines"
      - "True parallel execution of Python bytecode across threads"
      - "Using more than 4 GB of RAM"
      - "Installing third-party packages"
    correctIndex: 1
    explanation: "The GIL (Global Interpreter Lock) ensures only one thread executes Python bytecode at a time, preventing true CPU parallelism with threads."
  - question: "Why is multiprocessing limited for data processing?"
    options:
      - "It can't use more than one CPU core"
      - "Data must be serialized/copied between processes, which is slow for large datasets"
      - "It only works on Linux"
      - "It doesn't support Python 3"
    correctIndex: 1
    explanation: "Each Python process has its own memory space. Sharing data between processes requires serialization (pickling), which is slow and doubles memory usage for large datasets."
---

## Python's Dirty Secret: The GIL

Python has a **Global Interpreter Lock (GIL)** — a mutex that allows only one thread to execute Python bytecode at any given time. Even on a machine with 16 cores, a multi-threaded Python program uses just one core for Python code.

<MermaidDiagram chart={`graph TD
    subgraph "What you expect"
        T1A[Thread 1] --> C1A[Core 1]
        T2A[Thread 2] --> C2A[Core 2]
        T3A[Thread 3] --> C3A[Core 3]
        T4A[Thread 4] --> C4A[Core 4]
    end
    subgraph "What actually happens with GIL"
        T1B[Thread 1] --> GIL[GIL Lock]
        T2B[Thread 2] --> GIL
        T3B[Thread 3] --> GIL
        T4B[Thread 4] --> GIL
        GIL --> C1B[Core 1 only]
    end
    style GIL fill:#fc8181,stroke:#fc8181,color:#1a1d27
    style C1B fill:#ecc94b,stroke:#ecc94b,color:#1a1d27
`} />

## The Multiprocessing Workaround

Python's `multiprocessing` module bypasses the GIL by creating separate processes, each with its own Python interpreter and memory space. But this has costs:

**The serialization problem:** To send data between processes, Python must *serialize* (pickle) it — convert it to bytes, copy it, then deserialize on the other side. For a 1 GB DataFrame, this means:

1. Serialize: ~2 seconds + 1 GB memory
2. Copy: ~0.5 seconds
3. Deserialize: ~2 seconds + 1 GB memory

You've spent 4.5 seconds and doubled your memory usage just to *move* the data.

<MermaidDiagram chart={`graph LR
    P1[Process 1\n1 GB DataFrame] -->|"pickle\n~2s"| B[Bytes\n1 GB copy]
    B -->|"copy\n~0.5s"| P2[Process 2\nunpickle ~2s]
    style B fill:#fc8181,stroke:#fc8181,color:#1a1d27
`} />

## What Ray Does Differently

Ray solves both problems:

1. **No GIL limitation** — Ray tasks run in separate worker processes automatically
2. **Shared memory** — Ray's object store uses shared memory (Apache Arrow format), so data doesn't need to be copied between workers

This is why Ray exists: **it gives you the parallelism of multiprocessing without the serialization overhead**.
```

- [ ] **Step 3: Create lesson 1.3 — Map-Reduce**

Create `content/module-1/03-map-reduce.mdx`:

```mdx
---
title: "Map-Reduce & Data Parallelism"
quiz:
  - question: "In the Map-Reduce pattern, what does the 'Map' step do?"
    options:
      - "Combines all results into one"
      - "Applies a function to each piece of data independently"
      - "Sorts the data"
      - "Sends data to a database"
    correctIndex: 1
    explanation: "The Map step applies a transformation function to each data element independently — this is what makes it parallelizable."
  - question: "Why is Map-Reduce important for distributed computing?"
    options:
      - "It was invented by Google"
      - "The Map step is embarrassingly parallel — each piece can be processed independently"
      - "It only works with key-value pairs"
      - "It requires exactly two machines"
    correctIndex: 1
    explanation: "Map-Reduce's power comes from the Map step being embarrassingly parallel — no data element depends on another during mapping, so you can split across any number of workers."
---

## The Pattern Behind Everything

Almost every data processing operation follows a three-step pattern:

1. **Split** — Divide data into chunks
2. **Process** — Apply a function to each chunk (independently)
3. **Combine** — Merge the results

This is **Map-Reduce**, and it's the foundation of distributed data processing.

<MermaidDiagram chart={`graph TD
    D[Dataset\n1000 rows] --> S[Split into chunks]
    S --> C1[Chunk 1\n250 rows]
    S --> C2[Chunk 2\n250 rows]
    S --> C3[Chunk 3\n250 rows]
    S --> C4[Chunk 4\n250 rows]
    C1 -->|"Map: transform"| R1[Result 1]
    C2 -->|"Map: transform"| R2[Result 2]
    C3 -->|"Map: transform"| R3[Result 3]
    C4 -->|"Map: transform"| R4[Result 4]
    R1 --> RED[Reduce: combine]
    R2 --> RED
    R3 --> RED
    R4 --> RED
    RED --> F[Final Result]
    style D fill:#63b3ed,stroke:#63b3ed,color:#1a1d27
    style F fill:#68d391,stroke:#68d391,color:#1a1d27
`} />

## A Concrete Example

**Task:** Count the word frequency in 1 million documents.

**Map step:** Each worker counts words in its chunk of documents. Worker 1 gets documents 1-250K, Worker 2 gets 250K-500K, etc.

**Reduce step:** Merge all the word counts by summing them up.

<CodeBlock language="python" code={`# Pseudocode — this is the pattern Ray Data uses internally
# Split
chunks = split_documents(all_documents, num_workers=4)

# Map (runs in parallel across workers)
partial_counts = [count_words(chunk) for chunk in chunks]

# Reduce (combine results)
total_counts = merge_counts(partial_counts)`} />

## Why This Matters for Ray Data

When you write `ds.map_batches(transform)` in Ray Data, you're doing exactly this:

- Ray **splits** your dataset into blocks
- Each block is **mapped** through your transform function on a separate worker
- Results are **combined** back into a new dataset

You don't write the split/combine logic — Ray Data handles it. You just write the transform function.
```

- [ ] **Step 4: Create lesson 1.4 — Ray's Big Idea**

Create `content/module-1/04-rays-big-idea.mdx`:

```mdx
---
title: "Ray's Big Idea"
quiz:
  - question: "What is the role of the Ray Driver?"
    options:
      - "It stores all the data"
      - "It's the main program that submits tasks and collects results"
      - "It runs on every worker node"
      - "It manages the network switches"
    correctIndex: 1
    explanation: "The Driver is your main Python program — it calls ray.init(), submits tasks, creates actors, and collects results. It coordinates work but doesn't do the heavy processing itself."
  - question: "What makes Ray's object store special?"
    options:
      - "It uses a SQL database"
      - "It stores objects in shared memory using Apache Arrow, enabling zero-copy reads"
      - "It compresses all data automatically"
      - "It only works with small objects"
    correctIndex: 1
    explanation: "Ray's object store uses shared memory with Apache Arrow format. Workers on the same node can read objects without copying them — zero-copy access — which is dramatically faster than serialization."
---

## Ray: Distributed Python That Feels Like Python

Ray's core insight is simple: **distributed computing shouldn't require you to think about distribution**. You write Python functions, and Ray runs them across a cluster.

Here's regular Python vs Ray:

<CodeBlock language="python" code={`# Regular Python
def process(data):
    return transform(data)

results = [process(chunk) for chunk in chunks]  # Sequential, one core`} />

<CodeBlock language="python" code={`# Ray
import ray

@ray.remote
def process(data):
    return transform(data)

futures = [process.remote(chunk) for chunk in chunks]  # Parallel, many cores
results = ray.get(futures)`} />

The only differences: `@ray.remote` decorator, `.remote()` to call, `ray.get()` to collect. Everything else is Python.

## The Architecture

<MermaidDiagram chart={`graph TD
    subgraph "Your Machine (Driver)"
        D[Driver Program\nray.init, submit tasks]
    end
    subgraph "Ray Cluster"
        H[Head Node\nGCS + Scheduler]
        subgraph "Worker Node 1"
            W1[Worker Process]
            O1[Object Store\nShared Memory]
        end
        subgraph "Worker Node 2"
            W2[Worker Process]
            O2[Object Store\nShared Memory]
        end
        subgraph "Worker Node N"
            W3[Worker Process]
            O3[Object Store\nShared Memory]
        end
    end
    D -->|"Submit tasks"| H
    H -->|"Schedule"| W1
    H -->|"Schedule"| W2
    H -->|"Schedule"| W3
    W1 <-->|"Zero-copy read"| O1
    W2 <-->|"Zero-copy read"| O2
    W3 <-->|"Zero-copy read"| O3
    O1 <-->|"Transfer large objects"| O2
    O2 <-->|"Transfer large objects"| O3
    style D fill:#63b3ed,stroke:#63b3ed,color:#1a1d27
    style H fill:#ecc94b,stroke:#ecc94b,color:#1a1d27
`} />

## The Key Components

**Driver** — Your Python program. It connects to the cluster, submits tasks, and collects results. Think of it as the conductor of an orchestra.

**Head Node** — Runs the **Global Control Store (GCS)** and **scheduler**. The GCS tracks all objects, actors, and cluster state. The scheduler decides which worker runs which task.

**Workers** — Python processes that execute your tasks. Each worker can use CPU and/or GPU. Workers run on any node in the cluster.

**Object Store** — Distributed shared memory on each node. Uses Apache Arrow format for zero-copy access. When a worker on Node 1 needs data from Node 2, the object store handles the transfer automatically.

## Why This Matters

When we get to Ray Data, you'll see that datasets are stored in the object store as Arrow-formatted blocks. Transformations are tasks scheduled by the Ray scheduler. The streaming execution engine decides how many blocks to process at once based on available memory.

All of this happens automatically. You just write `ds.map_batches(my_function)`.
```

- [ ] **Step 5: Test the full flow**

```bash
cd /Users/szaher/go/src/github.com/szaher/saad/learn/ray-data
pnpm dev &
sleep 5
curl -s http://localhost:3000/api/lesson/1/01-why-distributed | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['lesson']['title'])"
kill %1
```

Expected: `Why Distributed Computing?`

- [ ] **Step 6: Test export**

```bash
cd /Users/szaher/go/src/github.com/szaher/saad/learn/ray-data
python3 scripts/export.py --module 1 --format both
ls exports/markdown/module-1/ && ls exports/notebooks/module-1/
```

Expected: 4 `.md` files and 4 `.ipynb` files listed.

- [ ] **Step 7: Commit**

```bash
cd /Users/szaher/go/src/github.com/szaher/saad/learn/ray-data
git add content/module-1/
git commit -m "feat: add Module 1 lessons — Foundations (4 MDX files)"
```

---

### Task 24: Final Integration Test

**Files:** None — verification only.

- [ ] **Step 1: Run all tests**

```bash
cd /Users/szaher/go/src/github.com/szaher/saad/learn/ray-data
pnpm test
```

Expected: All tests PASS.

- [ ] **Step 2: Build the project**

```bash
cd /Users/szaher/go/src/github.com/szaher/saad/learn/ray-data
pnpm build
```

Expected: Build succeeds with no errors.

- [ ] **Step 3: Start dev server and verify pages**

```bash
cd /Users/szaher/go/src/github.com/szaher/saad/learn/ray-data
pnpm dev &
sleep 5
echo "--- Home ---"
curl -s http://localhost:3000 | grep -c "Ray Data Academy"
echo "--- Curriculum API ---"
curl -s http://localhost:3000/api/curriculum | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'{len(d[\"modules\"])} modules, {sum(len(m[\"lessons\"]) for m in d[\"modules\"])} lessons')"
echo "--- Lesson API ---"
curl -s http://localhost:3000/api/lesson/1/01-why-distributed | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['lesson']['title'])"
kill %1
```

Expected:
```
--- Home ---
1
--- Curriculum API ---
7 modules, 34 lessons
--- Lesson API ---
Why Distributed Computing?
```

- [ ] **Step 4: Open in browser and verify visually**

```bash
cd /Users/szaher/go/src/github.com/szaher/saad/learn/ray-data
pnpm dev
```

Open http://localhost:3000 in browser. Verify:
- Dark theme renders correctly
- Sidebar shows all 7 modules with lessons
- Clicking Module 1, Lesson 1 shows content with Mermaid diagrams
- Mode toggle switches between Lesson and Chat
- Navigation (Next/Previous) works between lessons
- "Ask about this lesson" link navigates to Chat

- [ ] **Step 5: Final commit**

```bash
cd /Users/szaher/go/src/github.com/szaher/saad/learn/ray-data
git add -A
git commit -m "chore: final integration verification"
```

---

## Follow-Up Work (Not in This Plan)

After completing Tasks 1-24, the following remain:

1. **Content authoring** — Write MDX lessons for Modules 2-6 (30 lessons). Each follows the template established in Task 23. Module 7 has no pre-authored content (dynamically generated by Claude).

2. **D3 visualization component** — `src/components/D3Visualization.tsx` for data visualizations in Module 5-6 lessons. Not needed until those lessons exist.

3. **Claude CLI spawn resilience** — The Claude CLI has a [known issue](https://github.com/anthropics/claude-code/issues/771) when spawned from Node.js. If this blocks chat mode, the fallback is using the [Claude Agent SDK (Python)](https://github.com/anthropics/claude-agent-sdk-python) with a small FastAPI bridge, or calling the Anthropic API directly.

4. **Keyboard shortcuts** — Arrow key navigation, `/` to focus chat input.

5. **Export enhancements** — Per-lesson export, Mermaid-to-SVG via `mmdc` CLI for static images in exports.
