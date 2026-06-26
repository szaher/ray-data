# Prompt: Book Conversion

Use this prompt to convert your academy content into a real, publishable book — PDF for print, ePub for e-readers, and HTML for the web.

---

## Book Publishing Fundamentals

Before converting content, understand what makes a professional book.

### Book Anatomy

Every well-structured book has three parts:

**Front Matter** (numbered with roman numerals: i, ii, iii...):
- **Half-title page** — book title only, no author
- **Title page** — full title, subtitle, author name
- **Copyright page** — copyright notice, ISBN, publisher, edition, license
- **Dedication** — optional, one short line
- **Table of Contents** — auto-generated from headings
- **Preface / Foreword** — why this book exists, who it's for, how to read it
- **Acknowledgments** — optional, can go in back matter instead

**Body** (numbered with arabic numerals: 1, 2, 3...):
- **Parts** — optional grouping of related chapters (Part I, Part II...)
- **Chapters** — one per academy module, with sections from lessons
- **Sections** — numbered (1.1, 1.2...) within each chapter

**Back Matter:**
- **Appendix A: Exercises** — all quiz questions collected with answer key
- **Appendix B: Glossary** — key terms with definitions (harvested from bold terms)
- **Bibliography / References** — cited works, further reading
- **Index** — keyword index with page numbers (PDF only)
- **About the Author** — brief bio

### Print Formatting

| Property | Technical Book Standard |
|----------|----------------------|
| Trim size | 7.5 x 9.25" (Crown Quarto) or 6 x 9" |
| Body font | Serif, 10-11pt (e.g., Linux Libertine, Palatino, Charter) |
| Code font | Monospace, 8-9pt (e.g., Fira Code, Source Code Pro, Inconsolata) |
| Heading font | Sans-serif (e.g., Fira Sans, Source Sans Pro) |
| Line spacing | 1.2-1.4x for body text |
| Margins | Top: 1", Bottom: 1.25", Outside: 0.75", Inside/Gutter: 1" |
| Code blocks | Light gray background, thin border, 0.5em padding |
| Diagrams | Centered, max 80% page width, captioned ("Figure 3.1: ...") |

### Digital Formats

- **PDF** — fixed layout, exact page control, print-ready. Built via Pandoc + LaTeX (XeLaTeX for Unicode/custom fonts) or Typst.
- **ePub** — reflowable, adapts to screen size, used by Apple Books, Kobo, Google Play Books. Built via Pandoc. Validate with `epubcheck`.
- **MOBI/KF8** — Amazon Kindle format. Convert ePub via Calibre or Amazon's KindleGen.
- **HTML** — web edition. Built via Pandoc or Quarto. Can host on GitHub Pages.

### Licensing & Copyright

```
Copyright © {{YEAR}} {{AUTHOR_NAME}}

All rights reserved. No part of this publication may be reproduced,
distributed, or transmitted without the prior written permission of
the author.

ISBN: {{ISBN}} (if applicable)
First Edition: {{MONTH}} {{YEAR}}
```

For open-source/educational content, consider Creative Commons:
- **CC BY 4.0** — anyone can share/adapt with attribution
- **CC BY-SA 4.0** — same, but derivatives must use the same license
- **CC BY-NC 4.0** — non-commercial use only

---

## Toolchain

### Required Tools

```bash
# Pandoc — the core document converter
brew install pandoc          # macOS
# or: apt install pandoc     # Ubuntu/Debian

# LaTeX — for PDF generation (TinyTeX is lightweight)
curl -sL "https://yihui.org/tinytex/install-bin-unix.sh" | sh
# Install required LaTeX packages:
tlmgr install \
  xetex fontspec unicode-math \
  fancyhdr titlesec tocloft \
  listings minted fvextra \
  geometry hyperref bookmark \
  caption float wrapfig \
  booktabs longtable multirow \
  xcolor colortbl \
  environ tcolorbox etoolbox trimspaces \
  pgf adjustbox collectbox \
  babel csquotes

# Mermaid diagram rendering
npm install -g @mermaid-js/mermaid-cli    # provides 'mmdc' command
npm install -g mermaid-filter             # Pandoc filter

# ePub validation
brew install epubcheck       # macOS
# or download from: https://www.w3.org/publishing/epubcheck/

# Optional: Calibre for MOBI/Kindle conversion
brew install --cask calibre
```

### Alternative: Quarto

Quarto is an all-in-one alternative that bundles Pandoc with built-in Mermaid support:

```bash
# Install Quarto
brew install quarto    # macOS

# Create a Quarto book project
quarto create project book my-book
# Edit _quarto.yml to configure chapters
quarto render          # Builds PDF + HTML + ePub
```

Quarto is easier to set up but less flexible than raw Pandoc for custom LaTeX templates.

---

## Input Variables

- `{{BOOK_TITLE}}` — The book title
- `{{BOOK_SUBTITLE}}` — Subtitle (optional)
- `{{AUTHOR_NAME}}` — Author name(s)
- `{{YEAR}}` — Publication year
- `{{TARGET_FORMATS}}` — Output formats: pdf, epub, html (comma-separated)
- `{{BOOK_STYLE}}` — "technical-manual", "tutorial-workbook", or "narrative"
- `{{INCLUDE_EXERCISES}}` — Whether to include quiz-based exercises (true/false)
- `{{CODE_LANGUAGE}}` — Primary code language for syntax highlighting

## Prompt

```
Convert this academy's content into a publishable book.

Book: "{{BOOK_TITLE}}" by {{AUTHOR_NAME}}
Style: {{BOOK_STYLE}}
Formats: {{TARGET_FORMATS}}
Include exercises: {{INCLUDE_EXERCISES}}

STEP 1 — PLAN THE BOOK STRUCTURE

Read all content/module-N/meta.json files to build the chapter outline.
Map: Module → Chapter, Lesson → Section.

Output a book outline:
- Front matter sections
- Chapter list with section titles and estimated page counts
- Appendices
- Estimated total page count (assume ~300 words/page for technical books)

STEP 2 — TRANSFORM CONTENT

For each module, process all lessons in order:

a) Strip YAML frontmatter (extract title and quiz for later)

b) Convert MDX components to standard Markdown:
   <MermaidDiagram chart={`...`} /> →
   ```mermaid
   ...
   ```

   <CodeBlock code={`...`} language="X" filename="Y" /> →
   **Y**
   ```X
   ...
   ```

c) Convert heading levels:
   ## Section → ## 1.1 Section (numbered within chapter)
   ### Subsection → ### 1.1.1 Subsection

d) Convert cross-lesson references:
   "As we saw in [lesson name]" → "As discussed in Section N.M"

e) Add figure captions to diagrams:
   ```mermaid ... ``` → preceded by "**Figure N.M:** Description"

f) Extract bold terms for the glossary:
   **term** on first occurrence → add to glossary list with surrounding context as definition

g) Extract quiz questions for the exercises appendix:
   Transform each quiz entry into a numbered question with lettered options (a, b, c, d)
   Compile answer key separately

STEP 3 — WRITE FRONT MATTER

Generate:
- Title page content (title, subtitle, author)
- Copyright page (year, author, license)
- Preface — synthesized from the academy description, tagline, and curriculum overview:
  - Who this book is for
  - What you'll learn
  - How this book is organized (chapter summaries)
  - Prerequisites
  - How to use the code examples
  - Conventions used in this book (icons for tips, warnings, etc.)
- Table of Contents (auto-generated by Pandoc, but write the structure)

STEP 4 — WRITE BACK MATTER

Generate:
- Appendix A: Exercises — all quiz questions grouped by chapter, with answer key at the end
- Appendix B: Glossary — alphabetically sorted key terms with definitions
- Bibliography — any references cited in lessons
- About the Author — placeholder template

STEP 5 — ASSEMBLE THE MANUSCRIPT

Create the book/ directory structure:

book/
├── manuscript/
│   ├── 00-front-matter.md
│   ├── 01-chapter-slug.md      # One per module
│   ├── 02-chapter-slug.md
│   ├── ...
│   ├── appendix-a-exercises.md
│   ├── appendix-b-glossary.md
│   └── bibliography.md
├── assets/
│   └── diagrams/               # Pre-rendered SVGs (optional)
├── metadata.yaml
├── build-book.sh
└── style/
    ├── template.tex            # LaTeX template
    └── epub.css                # ePub stylesheet

STEP 6 — CREATE metadata.yaml

```yaml
---
title: "{{BOOK_TITLE}}"
subtitle: "{{BOOK_SUBTITLE}}"
author: "{{AUTHOR_NAME}}"
date: "{{YEAR}}"
lang: en
rights: "Copyright © {{YEAR}} {{AUTHOR_NAME}}"
description: |
  One-paragraph book description.
documentclass: book
classoption:
  - openright
  - twoside
fontsize: 11pt
geometry:
  - top=1in
  - bottom=1.25in
  - inner=1in
  - outer=0.75in
mainfont: "Linux Libertine O"
sansfont: "Source Sans Pro"
monofont: "Source Code Pro"
monofontoptions:
  - Scale=0.85
linkcolor: blue
urlcolor: blue
citecolor: blue
toc: true
toc-depth: 3
numbersections: true
secnumdepth: 3
highlight-style: tango
header-includes:
  - \usepackage{fancyhdr}
  - \pagestyle{fancy}
  - \fancyhead[LE]{\leftmark}
  - \fancyhead[RO]{\rightmark}
  - \usepackage{tcolorbox}
  - \newtcolorbox{tip}{colback=blue!5,colframe=blue!50,title=Tip}
  - \newtcolorbox{warning}{colback=red!5,colframe=red!50,title=Warning}
---
```

STEP 7 — CREATE BUILD SCRIPT

The build script should:
1. Check for required tools (pandoc, xelatex, mmdc, epubcheck)
2. Pre-render mermaid diagrams to SVG if mmdc is available
3. Concatenate all manuscript files in order
4. Run pandoc with mermaid-filter for each output format
5. Validate ePub with epubcheck
6. Report: page count, word count, chapter count, diagram count

OUTPUT: All files listed above, ready to build with `bash build-book.sh`.
```

## Expected Output

The LLM should produce:

1. Complete `book/` directory with all manuscript files
2. `metadata.yaml` with correct Pandoc settings
3. `build-book.sh` script
4. LaTeX template and ePub CSS
5. A build summary showing word count and chapter breakdown

## E2E Verification Checklist

After building, verify:

- [ ] `bash scripts/build-book.sh` completes without errors
- [ ] PDF exists and opens correctly
- [ ] PDF has: cover/title page, TOC with page numbers, numbered chapters, page headers/footers
- [ ] All Mermaid diagrams render as images (no raw mermaid code visible)
- [ ] Code blocks have syntax highlighting and readable font size
- [ ] Cross-references ("See Section 2.3") point to correct sections
- [ ] Exercises appendix has all quiz questions with correct answer key
- [ ] Glossary is alphabetically sorted and terms match bold terms in text
- [ ] ePub passes `epubcheck` validation (if ePub format requested)
- [ ] ePub renders correctly in Apple Books or Calibre viewer
- [ ] Word count is reasonable (technical books: 40,000-80,000 words typical)
- [ ] Page count is reasonable (150-350 pages for a technical book)
- [ ] No orphaned figures (diagram without caption) or widowed headings (heading at page bottom with content on next page)

## Pandoc Build Commands Reference

```bash
# PDF via XeLaTeX
pandoc manuscript/*.md \
  --metadata-file=metadata.yaml \
  --pdf-engine=xelatex \
  --filter mermaid-filter \
  --highlight-style=tango \
  --toc --toc-depth=3 \
  --number-sections \
  -o output/book.pdf

# ePub
pandoc manuscript/*.md \
  --metadata-file=metadata.yaml \
  --filter mermaid-filter \
  --toc --toc-depth=2 \
  --epub-cover-image=assets/cover.png \
  --css=style/epub.css \
  -o output/book.epub

# HTML (single page)
pandoc manuscript/*.md \
  --metadata-file=metadata.yaml \
  --filter mermaid-filter \
  --toc --toc-depth=2 \
  --standalone \
  --self-contained \
  --highlight-style=tango \
  -o output/book.html

# Validate ePub
epubcheck output/book.epub

# Convert ePub to MOBI (Kindle)
ebook-convert output/book.epub output/book.mobi
```

## Tips for Professional Quality

- **Cover image**: Create a 1600x2400px cover for ePub. For print PDF, the printer provides cover specifications.
- **Page breaks**: Add `\newpage` (LaTeX) or `<div style="page-break-after: always;"></div>` before each chapter.
- **Widow/orphan control**: LaTeX handles this by default; for ePub, add `widows: 3; orphans: 3;` to epub.css.
- **Code overflow**: Long lines in code blocks should wrap, not overflow. Set `breaklines=true` in listings config.
- **Diagram sizing**: Target 80% page width for diagrams. In LaTeX: `\includegraphics[width=0.8\textwidth]{diagram.svg}`.
- **Print-on-demand**: Amazon KDP, IngramSpark, and Lulu accept PDF interiors. Each has specific margin and bleed requirements — check their templates.
- **Proofreading**: After the first build, read the PDF cover-to-cover. Check diagram readability at print size, code formatting, and cross-reference accuracy.

## Next Step

After building, review the output using `05-content-quality.md` criteria. Consider hiring a technical reviewer to read the manuscript before publication.
