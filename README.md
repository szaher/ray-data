# Ray Data Academy

An interactive learning platform for mastering distributed data processing with [Ray Data](https://docs.ray.io/en/latest/data/data.html). Built on the [learn-template](https://github.com/szaher/learn-template) platform.

## Features

- **13 modules, 58 lessons** covering Ray Data from foundations to production patterns
- **Interactive MDX content** with live code blocks, Mermaid diagrams, and quizzes
- **AI tutor** powered by Claude — ask questions, get diagrams and code examples
- **Text-to-speech** with voice selection for accessible learning
- **Export** lessons to Markdown or Jupyter notebooks
- **Slide decks** built with Marp for presentations

## Quick Start

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Development

```bash
pnpm validate    # content quality gates (MDX, links, accessibility)
pnpm lint        # ESLint
pnpm test        # Vitest test suite
pnpm build       # production build
```

## Content Authoring

Lessons live in `content/module-N/*.mdx`. See [`content/CLAUDE.md`](content/CLAUDE.md) for the authoring guide and [`docs/authoring-flow.md`](docs/authoring-flow.md) for the full content creation process.

## Presentations

```bash
cd presentations && bash build.sh
```

Slide decks are in `presentations/*.md` using [Marp](https://marp.app/). Exports to HTML, PDF, and PPTX.

## Docker

```bash
docker compose up --build
```

Requires `ANTHROPIC_VERTEX_PROJECT_ID` and GCP credentials for the AI tutor.

## Template Updates

This repo is based on [learn-template](https://github.com/szaher/learn-template). To sync platform updates:

```bash
pnpm update:template -- --source /path/to/learn-template
```

See [`AGENTS.md`](AGENTS.md) for details on what's preserved during updates.

## Tech Stack

Next.js 16 · React 19 · TypeScript · Tailwind CSS 4 · MDX · Vitest · Marp

## License

This work is licensed under [CC-BY-4.0](./LICENSE). You are free to share and adapt the material with appropriate attribution. See [LICENSE](./LICENSE).
