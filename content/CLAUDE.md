# Content Authoring Guide

## File Layout

Each module has a directory `content/module-N/` containing:
- `meta.json` — module title, description, lesson order
- `NN-slug.mdx` — individual lessons, numbered for ordering

Tutorial specs live in `content/tutorials/*.json` (v1.0 or v1.1 schema).

## Authoring Flow

1. Design curriculum with `prompts/01-curriculum-design.md` → produce TutorialSpec JSON
2. Generate lessons with `prompts/02-lesson-writing.md` → MDX files
3. Create quizzes with `prompts/03-quiz-creation.md`
4. Build presentations with `prompts/04-presentation-creation.md`
5. Validate: `pnpm validate && pnpm build`
6. Preview: `pnpm dev` and inspect each lesson

See `docs/authoring-flow.md` for the full process including multimedia planning.

## MDX Components Available

- `CodeBlock` — syntax-highlighted code with copy button (use fenced code blocks)
- `MermaidDiagram` — render `mermaid` fenced code blocks as diagrams
- `Quiz` — inline assessment component
- `VerifyClaim` — wrap uncertain factual claims for review flagging
- `Callout` / `KeyTakeaway` / `DeepDive` / `ProTip` — pedagogical callout boxes

## Content Rules

- Use Ray 2.55.1 APIs — key imports: `ray`, `ray.data`
- Mark uncertain claims with `VerifyClaim` — never present unverified facts as instruction
- Replace universal claims ("every", "all", "always") with qualified language
- All images must have meaningful alt text (not "image", "screenshot")
- All diagrams need fallback text for accessibility
- No duplicate paragraphs, no placeholder text
- Frontmatter: `title` (required), `description` (required)

## Validation

`pnpm validate` checks: MDX compilation, broken links, alt text, duplicate content,
frontmatter schema, claim verification, tutorial spec integrity. Errors block CI.
