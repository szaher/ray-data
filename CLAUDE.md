# Ray Data Academy

## Build, Test, Lint

```bash
pnpm install
pnpm build
pnpm test              # full suite
pnpm test -- __tests__/lib/curriculum.test.ts   # single file
pnpm test -- -t "pattern"                       # pattern match
pnpm lint
pnpm validate          # content quality gates (MDX, links, accessibility)
```

Run `validate`, `lint`, `test`, and `build` before considering any task done.

## Code Style

- TypeScript strict mode — no `any`, no `as` casts without justification
- Imports: `@/*` alias for `src/` (e.g., `@/lib/curriculum`), relative for same-directory
- Files: kebab-case for scripts, PascalCase for components, camelCase for hooks/lib
- Components: React functional components with named exports
- Styling: Tailwind CSS v4 via `@tailwindcss/postcss`, utility classes in JSX
- State: localStorage via `storageKeys` from `academy.config.ts` — never hardcode keys
- Tests: Vitest + React Testing Library in `__tests__/`, mirror `src/` structure
- MDX: content in `content/module-N/`, rendered via `next-mdx-remote`

## Architecture

```
src/
  app/                  # Next.js App Router pages and API routes
    api/chat/           # SSE streaming chat with Claude
    api/curriculum/     # Curriculum data endpoint
    api/export/         # Export to markdown/notebook via Python sidecar
    lesson/[module]/    # Dynamic lesson pages with MDX rendering
  components/           # React components (LessonContent, SidePanel, CodeBlock, MermaidDiagram)
  hooks/                # useSpeechSynthesis, useVoices, useTheme
  lib/                  # curriculum, progress, notes, claude, tutorialSpec
  types/                # TypeScript type definitions
content/
  module-1..13/         # 13 modules, 58 MDX lessons + meta.json per module
  tutorials/            # TutorialSpec JSON files (v1.0/v1.1 schema)
presentations/          # Marp slide decks + themes + build scripts
scripts/                # validate.mjs, build-book.sh, export.py, update-template.sh
prompts/                # Staged LLM prompts for content generation
```

Data flow: `content/*.mdx` → Next.js static generation → MDX rendering → interactive UI
Config flow: `academy.config.ts` → components, storage keys, theming, chat prompts

## Do's and Don'ts

- Do NOT install packages without discussing first.
- Do NOT hardcode display text — use `academy.config.ts` for all branding and config.
- Do NOT modify `content/`, `presentations/`, or `academy.config.ts` during platform work.
- Do NOT modify `src/`, `__tests__/`, or root config during content work.
- Do use `storageKeys` from `academy.config.ts` for all localStorage access.
- Do use `VerifyClaim` for uncertain factual claims in MDX content.
- Do run `pnpm validate` after any content change — it checks MDX compilation, links, accessibility.
- Do keep CI gates (`ci.yml`) in sync with the commands listed above.
