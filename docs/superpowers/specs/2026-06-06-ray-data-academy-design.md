# Ray Data Academy — Design Spec

An interactive web-based teaching platform for learning Ray and Ray Data from scratch, powered by Claude Code (Vertex AI).

## Overview

A Next.js full-stack application that serves as a personal tutor for Ray Data. It combines pre-built structured lessons with an AI-powered conversational tutor, generating diagrams, infographics, and architecture visualizations on the fly. All materials are exportable as markdown reference docs and Jupyter notebooks for reuse.

**Target Ray version:** 2.55.1 (latest stable)
**Target audience:** Complete beginner (no prior distributed computing experience)

## Architecture

### System Components

```
Browser (React UI)
├── Lesson Mode — slide-style navigation through structured curriculum
├── Chat Mode — free-form conversation with Claude as Ray Data tutor
├── Diagram Renderer — Mermaid.js (flowcharts/sequences) + D3.js (data viz)
└── Shared — MDX renderer, Monaco code editor, export buttons
        │
        │ HTTP / SSE (Server-Sent Events)
        ▼
Next.js API Routes (Node.js)
├── /api/chat — spawns claude CLI, streams response via SSE
├── /api/lesson — serves MDX curriculum content + metadata
├── /api/curriculum — returns full curriculum tree + user progress
└── /api/export — triggers Python sidecar for material generation
        │                           │
        ▼                           ▼
Claude CLI (Vertex AI)        Python Sidecar
• Existing local install      • nbformat (notebooks)
• --print for non-interactive • plotly/graphviz (charts)
• System prompt with tutor    • mmdc (Mermaid → SVG)
  role + curriculum context   • Ray code execution
```

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15 + React 19 + TypeScript + Tailwind CSS |
| Diagrams | Mermaid.js (flowcharts, sequences) + D3.js (data viz) + Monaco Editor (code) |
| AI Backend | `claude` CLI via `child_process` (user's existing Vertex AI config) |
| Content | MDX files (Markdown + JSX) with frontmatter metadata |
| Export | Python sidecar (nbformat, plotly, graphviz, markdown, mmdc) |
| State | localStorage only — no database, no auth |

### Claude CLI Integration

The `/api/chat` route spawns the `claude` CLI as a child process:

```
claude --print --system-prompt <tutor-prompt> -p <user-question>
```

The system prompt includes:
- Role: "You are an expert Ray Data tutor"
- Current module context (what the student has covered so far)
- Instruction to use ` ```mermaid ` blocks for architecture/flow diagrams
- Instruction to use ` ```python ` with Ray 2.55.1 APIs only
- The full curriculum outline for topic awareness
- Student's current progress level

Response streams back via stdout, piped to SSE for real-time rendering in the browser.

### Chat Conversation Context

Each `claude --print` invocation is stateless. To maintain conversation continuity, the API route includes the recent chat history (last 10 messages) in the prompt. The system prompt is prepended with the curriculum context, and the user's message is appended after a formatted history block. This keeps each call self-contained while preserving conversational flow. History is trimmed to avoid exceeding context limits.

## Curriculum

7 modules, 34 lessons, progressing from distributed computing fundamentals to future/emerging patterns.

### Module 1 — Foundations (4 lessons)

No code required. Builds mental models before touching any API.

- **1.1 Why Distributed Computing?** — The problem: single-machine limits, data growth, compute needs
- **1.2 The GIL Problem & Python's Limits** — Why Python can't just use threads, the multiprocessing workaround, and its limitations
- **1.3 Map-Reduce & Data Parallelism** — The foundational pattern: split, process, combine. How it applies to data processing
- **1.4 Ray's Big Idea** — Architecture overview: driver, workers, object store, scheduler. How Ray makes distributed Python feel like regular Python

**Diagram types:** Single vs multi-node execution, GIL bottleneck visualization, MapReduce flow, Ray architecture overview

### Module 2 — Ray Core (5 lessons)

Hands-on with Ray's primitives. Each lesson pairs a concept explanation with an architecture diagram and runnable code.

- **2.1 ray.init() & Clusters** — Starting Ray, local vs cluster mode, the dashboard
- **2.2 Tasks** — `@ray.remote` functions, `ObjectRef`, `ray.get()`, task dependencies
- **2.3 Actors** — `@ray.remote` classes, stateful workers, actor lifecycle
- **2.4 Object Store & Object Refs** — Distributed shared memory, `ray.put()`, zero-copy reads, immutability
- **2.5 Placement Groups & Resources** — Resource scheduling, PACK vs SPREAD, GPU allocation

**Diagram types:** Task scheduling flow, actor lifecycle, object store data flow, placement group topologies

### Module 3 — Ray Data Basics (6 lessons)

The core of the curriculum. Covers the Dataset API from reading through transformations to consumption.

- **3.1 What is Ray Data?** — The Dataset concept, how it differs from pandas/Spark, when to use it
- **3.2 Reading Data** — `read_csv()`, `read_parquet()`, `read_json()`, `read_images()`, custom datasources
- **3.3 Transformations** — `map()`, `map_batches()`, `filter()`, `flat_map()` — row vs batch operations
- **3.4 Consuming Data** — `iter_batches()`, `iter_torch_batches()`, `show()`, `take()`, `count()`
- **3.5 Schemas & Types** — Arrow-based type system, schema inference, type casting
- **3.6 Lazy Execution & Materialization** — Deferred execution, `materialize()`, when execution actually happens

**Diagram types:** Dataset block structure, transformation pipeline visualization, lazy execution graph, Arrow schema diagrams

### Module 4 — Intermediate (5 lessons)

Production patterns for ML workloads.

- **4.1 GPU Batch Inference** — `map_batches()` with `num_gpus=1`, actor pools, model loading patterns
- **4.2 Streaming Execution** — How Ray Data avoids materializing full datasets, windowed execution, operator concurrency
- **4.3 Ray Data + Ray Train** — Feeding datasets into distributed training, `get_dataset_shard()`, preprocessors
- **4.4 Ray Data + Ray Serve** — Online inference pipelines, request batching, deployment patterns
- **4.5 Data Preprocessors for ML** — Built-in preprocessors, custom preprocessors, feature engineering at scale

**Diagram types:** Streaming pipeline animation, Train integration data flow, Serve request pipeline, preprocessor chain

### Module 5 — Advanced (5 lessons)

Under the hood: internals, tuning, and extending Ray Data.

- **5.1 Execution Plans & Operator Fusion** — Logical vs physical plans, `OperatorFusionRule`, plan optimization
- **5.2 Memory Management** — Block sizes (1-128 MiB default), backpressure, memory-aware scheduling, tuning knobs
- **5.3 Custom Datasources** — Writing your own `Datasource` for proprietary formats, read/write interfaces
- **5.4 Fault Tolerance & Lineage** — Task retries, object reconstruction, lineage tracking
- **5.5 Shuffles & Aggregations** — `sort()`, `groupby()`, repartition, why shuffles break streaming

**Diagram types:** Logical/physical plan trees, memory pressure visualization, block size tuning charts, lineage graphs

### Module 6 — Real-World Projects (5 lessons)

Complete end-to-end projects that tie together multiple concepts.

- **6.1 Image Processing Pipeline** — Read images → resize → augment → batch inference → write results
- **6.2 LLM Batch Inference** — Load model on GPU actors → process text dataset → collect outputs
- **6.3 ETL Pipeline** — Read Parquet → transform → validate → write partitioned output
- **6.4 Ray Data + Ray Serve Online** — Deploy a real-time inference endpoint backed by Ray Data preprocessing
- **6.5 Performance Benchmarking** — Compare approaches, measure throughput, identify bottlenecks

**Diagram types:** Full pipeline architectures, performance comparison charts (plotly), deployment topology diagrams

### Module 7 — Future & Emerging Patterns (4 lessons)

Forward-looking content, dynamically generated by Claude at lesson time to stay current.

- **7.1 Data Lineage & Observability** — End-to-end transformation tracking, audit trails, observability tool integration
- **7.2 Streaming Data Pipelines** — Continuous ingestion, Ray Data Gen concepts, backpressure, comparison with Kafka/Flink/Spark Streaming
- **7.3 Ray Data + Feature Stores** — Feast/Tecton integration, online vs offline features, training-serving skew prevention
- **7.4 Multi-Modal Data Pipelines** — Unified text/image/audio/video processing, edge computing, IoT data streams

**Key difference:** Module 7 content is not pre-authored MDX. The teaching agent generates it at lesson time by pulling from the latest Ray docs and community sources. This keeps the content current as the ecosystem evolves.

### Lesson Structure

Every lesson (Modules 1-6) follows the same 5-step pattern:

1. **Concept** — What & Why (prose explanation)
2. **Diagram** — Visual model (Mermaid/D3 rendered inline)
3. **Code** — Runnable example (syntax-highlighted, copyable)
4. **Deep Dive** — "Ask about this lesson" triggers Claude for follow-up questions
5. **Quiz** — 2-3 multiple-choice questions to check understanding

Module 7 lessons follow steps 1-2-4 (concept, diagram, deep dive) with code examples where applicable.

## UI Design

### Layout

Dark theme, two-panel layout with collapsible left sidebar:

**Header:**
- App title ("Ray Data Academy")
- Mode toggle: Lesson Mode | Chat Mode
- Export dropdown (current lesson / module / all)
- Settings gear

**Left Sidebar:**
- **Lesson Mode:** Curriculum tree with module/lesson hierarchy. Checkmarks for completed lessons, highlight for current. Collapsible module sections. Progress bar and percentage at bottom.
- **Chat Mode:** Topic categories for quick navigation + AI-generated follow-up suggestions based on current conversation.

**Main Content Area:**
- **Lesson Mode:** Scrollable lesson content with inline Mermaid diagrams, syntax-highlighted code blocks (Monaco editor), and a floating "Ask about this lesson" input at the bottom. Prev/Next navigation buttons.
- **Chat Mode:** Conversation thread with interleaved text and live-rendered diagrams. Full chat history preserved per topic.

**Footer Bar:**
- Current module/lesson indicator, lesson count, estimated read time

### Interaction Patterns

- **Mode toggle:** Top header switches between Lesson and Chat. "Ask about this lesson" in Lesson Mode sends the question to Chat Mode with the current lesson as context.
- **Keyboard shortcuts:** Arrow keys for prev/next lesson, `/` to focus chat input, `Esc` to close sidebar on mobile.
- **Progress:** Saved to localStorage. Lesson marked complete when user reaches the bottom or clicks "Next."
- **Chat history:** Stored in localStorage as `messages[]` with `{ role, content, diagrams[] }`.

### Design Principles

- Content-first: diagrams and code are first-class, not afterthoughts
- No login, no auth: local-only app, all state in localStorage
- Responsive sidebar: collapsible on narrow screens
- Dark theme: comfortable for long study sessions, matches IDE aesthetic

## Data Flow

### Lesson Mode

1. Browser requests `GET /api/curriculum` → returns full module/lesson tree from `meta.json` files
2. Browser requests `GET /api/lesson/{module}/{lesson}` → reads MDX file, parses frontmatter, returns `{ content, meta, diagrams[], code[] }`
3. React renders MDX with Mermaid diagrams (client-side) and Monaco code blocks
4. Progress updates saved to localStorage

### Chat Mode

1. User types question → `POST /api/chat` with `{ message, context: { module, lesson, history } }`
2. API builds system prompt (tutor role + curriculum context + diagram instructions)
3. API spawns `claude --print --system-prompt <prompt> -p <question>`
4. stdout piped to SSE stream → browser receives chunks in real-time
5. Frontend parses response: plain text → markdown, ` ```mermaid ` → Mermaid.js render, ` ```python ` → Monaco highlight
6. Chat history appended to localStorage

### Export Pipeline

1. User clicks export → `POST /api/export` with `{ module, format: "both" }`
2. API spawns `python3 scripts/export.py --module <n> --format both`
3. Python script for each lesson:
   - Reads MDX source
   - Converts Mermaid blocks to SVG via `mmdc` CLI
   - Builds notebook cells via `nbformat` (explanation + code + plotly charts)
   - Writes markdown with embedded SVG images
4. Progress streamed back via stdout → SSE
5. Output written to `exports/markdown/` and `exports/notebooks/`
6. API returns file list and path for download

## File Structure

```
ray-data/
├── package.json
├── next.config.js
├── tsconfig.json
├── tailwind.config.ts
├── content/                    ← MDX curriculum
│   ├── module-1/
│   │   ├── meta.json           ← { title, description, lessons[] }
│   │   ├── 01-why-distributed.mdx
│   │   ├── 02-gil-problem.mdx
│   │   ├── 03-map-reduce.mdx
│   │   └── 04-rays-big-idea.mdx
│   ├── module-2/
│   │   ├── meta.json
│   │   ├── 01-ray-init.mdx
│   │   └── ...
│   ├── module-3/ ... module-6/
│   └── module-7/
│       └── meta.json           ← Lesson titles only, content generated by Claude
├── src/
│   ├── app/
│   │   ├── layout.tsx          ← Root layout with sidebar
│   │   ├── page.tsx            ← Home / dashboard
│   │   ├── lesson/
│   │   │   └── [module]/[lesson]/page.tsx
│   │   ├── chat/
│   │   │   └── page.tsx
│   │   └── api/
│   │       ├── chat/route.ts
│   │       ├── lesson/[module]/[lesson]/route.ts
│   │       ├── curriculum/route.ts
│   │       └── export/route.ts
│   ├── components/
│   │   ├── Sidebar.tsx
│   │   ├── LessonContent.tsx
│   │   ├── ChatInterface.tsx
│   │   ├── MermaidDiagram.tsx
│   │   ├── D3Visualization.tsx
│   │   ├── CodeBlock.tsx       ← Monaco-based
│   │   ├── Quiz.tsx
│   │   ├── ExportMenu.tsx
│   │   └── ProgressBar.tsx
│   └── lib/
│       ├── claude.ts           ← Claude CLI wrapper (spawn + stream)
│       ├── curriculum.ts       ← Read meta.json, build tree
│       ├── mdx.ts              ← MDX parsing utilities
│       └── progress.ts         ← localStorage progress helpers
├── scripts/
│   ├── export.py               ← Python export sidecar
│   └── requirements.txt        ← nbformat, plotly, graphviz, mermaid-cli
├── exports/                    ← Generated materials (gitignored)
│   ├── markdown/
│   └── notebooks/
└── docs/
    └── superpowers/specs/
        └── this file
```

## Dependencies

### Node.js (package.json)

- `next` 15.x — framework
- `react` / `react-dom` 19.x — UI
- `tailwindcss` 4.x — styling
- `@mdx-js/mdx` + `@mdx-js/react` — MDX rendering
- `mermaid` — client-side diagram rendering
- `d3` — data visualizations
- `monaco-editor` / `@monaco-editor/react` — code blocks
- `eventsource-parser` — SSE parsing (if needed client-side)

### Python (scripts/requirements.txt)

- `nbformat` — Jupyter notebook generation
- `plotly` — interactive charts for exports
- `graphviz` — graph rendering
- `@mermaid-js/mermaid-cli` (npm global) — `mmdc` for Mermaid → SVG conversion
- `ray[data]==2.55.1` — for runnable examples in notebooks

## Non-Goals

- No multi-user support or authentication
- No server-side database or persistence
- No deployment to cloud — runs locally only
- No real-time Ray cluster management from the dashboard
- No video or audio content generation
