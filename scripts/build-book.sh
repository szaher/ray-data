#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
CONTENT_DIR="$PROJECT_DIR/content"
BOOK_DIR="$PROJECT_DIR/book"
MANUSCRIPT_DIR="$BOOK_DIR/manuscript"
ASSETS_DIR="$BOOK_DIR/assets/diagrams"
OUTPUT_DIR="$BOOK_DIR/output"
STYLE_DIR="$BOOK_DIR/style"

FORMATS="pdf"
SKIP_DIAGRAMS=false
SKIP_EPUB_CHECK=false

usage() {
  cat <<EOF
Usage: $(basename "$0") [OPTIONS]

Convert academy content into a publishable book.

Options:
  --formats FORMATS   Comma-separated output formats: pdf,epub,html (default: pdf)
  --skip-diagrams     Skip Mermaid diagram pre-rendering
  --skip-epubcheck    Skip ePub validation
  --clean             Remove book/ directory and start fresh
  --help              Show this help

Prerequisites:
  pandoc              Document converter (brew install pandoc)
  xelatex             PDF engine (install TinyTeX or MacTeX)
  mmdc                Mermaid CLI (npm install -g @mermaid-js/mermaid-cli)
  mermaid-filter      Pandoc filter (npm install -g mermaid-filter)
  epubcheck           ePub validator (brew install epubcheck) [optional]

Example:
  bash scripts/build-book.sh --formats pdf,epub
EOF
  exit 0
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --formats) FORMATS="$2"; shift 2 ;;
    --skip-diagrams) SKIP_DIAGRAMS=true; shift ;;
    --skip-epubcheck) SKIP_EPUB_CHECK=true; shift ;;
    --clean) rm -rf "$BOOK_DIR"; echo "Cleaned book/ directory."; exit 0 ;;
    --help) usage ;;
    *) echo "Unknown option: $1"; usage ;;
  esac
done

echo ""
echo "========================================="
echo "  Academy → Book Builder"
echo "========================================="
echo ""

check_tool() {
  if ! command -v "$1" &> /dev/null; then
    echo "  [MISSING] $1 — $2"
    return 1
  fi
  echo "  [ok] $1"
  return 0
}

echo "Checking tools..."
TOOLS_OK=true
check_tool pandoc "brew install pandoc" || TOOLS_OK=false

if echo "$FORMATS" | grep -q "pdf"; then
  check_tool xelatex "install TinyTeX: curl -sL https://yihui.org/tinytex/install-bin-unix.sh | sh" || TOOLS_OK=false
fi

HAS_MMDC=true
check_tool mmdc "npm install -g @mermaid-js/mermaid-cli" || HAS_MMDC=false

HAS_MERMAID_FILTER=true
check_tool mermaid-filter "npm install -g mermaid-filter" || HAS_MERMAID_FILTER=false

if echo "$FORMATS" | grep -q "epub" && [[ "$SKIP_EPUB_CHECK" != "true" ]]; then
  check_tool epubcheck "brew install epubcheck (optional, use --skip-epubcheck to skip)" || true
fi

if [[ "$TOOLS_OK" == "false" ]]; then
  echo ""
  echo "ERROR: Required tools are missing. Install them and try again."
  exit 1
fi

echo ""

mkdir -p "$MANUSCRIPT_DIR" "$ASSETS_DIR" "$OUTPUT_DIR" "$STYLE_DIR"

echo "Scanning content..."

MODULES=()
while IFS= read -r meta_file; do
  MODULES+=("$meta_file")
done < <(find "$CONTENT_DIR" -name "meta.json" -path "*/module-*/meta.json" | sort)

if [[ ${#MODULES[@]} -eq 0 ]]; then
  echo "ERROR: No modules found in $CONTENT_DIR"
  exit 1
fi

echo "  Found ${#MODULES[@]} module(s)"

TOTAL_WORDS=0
TOTAL_DIAGRAMS=0
TOTAL_QUIZZES=0
CHAPTER_NUM=0
ALL_QUIZ_ENTRIES=""
ALL_GLOSSARY_TERMS=""

convert_mdx_to_markdown() {
  local input_file="$1"
  local content

  content=$(cat "$input_file")

  content=$(echo "$content" | sed '/^---$/,/^---$/d')

  content=$(echo "$content" | python3 -c "
import re, sys
content = sys.stdin.read()

def convert_mermaid(match):
    chart = match.group(1).strip()
    return '\`\`\`mermaid\n' + chart + '\n\`\`\`'

content = re.sub(
    r'<MermaidDiagram\s+chart=\{\`(.*?)\`\}\s*/>',
    convert_mermaid, content, flags=re.DOTALL
)

def convert_codeblock(match):
    code = match.group(1).strip()
    lang = match.group(2) if match.group(2) else ''
    filename = match.group(3) if match.group(3) else ''
    result = ''
    if filename:
        result += '**' + filename + '**\n\n'
    result += '\`\`\`' + lang + '\n' + code + '\n\`\`\`'
    return result

content = re.sub(
    r'<CodeBlock\s+code=\{\`(.*?)\`\}\s*language=\"([^\"]*)\"\s*(?:filename=\"([^\"]*)\"\s*)?/>',
    convert_codeblock, content, flags=re.DOTALL
)

print(content)
")

  echo "$content"
}

extract_quizzes() {
  local input_file="$1"
  local chapter_title="$2"
  local chapter_num="$3"

  python3 -c "
import yaml, sys, re

with open('$input_file', 'r') as f:
    content = f.read()

match = re.match(r'^---\n(.*?)\n---', content, re.DOTALL)
if not match:
    sys.exit(0)

fm = yaml.safe_load(match.group(1))
if not fm or 'quiz' not in fm:
    sys.exit(0)

quiz = fm['quiz']
for i, q in enumerate(quiz, 1):
    print(f\"**Q{i}.** {q['question']}\")
    for j, opt in enumerate(q['options']):
        letter = chr(ord('a') + j)
        print(f'  {letter}) {opt}')
    print()

print('---answers---')
for i, q in enumerate(quiz, 1):
    correct_idx = q['correctIndex']
    letter = chr(ord('a') + correct_idx)
    print(f'Q{i}: {letter}) {q[\"options\"][correct_idx]}')
"
}

extract_bold_terms() {
  local input_file="$1"
  grep -oP '\*\*([^*]+)\*\*' "$input_file" | sed 's/\*\*//g' | sort -u
}

extract_title_from_frontmatter() {
  local input_file="$1"
  python3 -c "
import yaml, re, sys
with open('$input_file', 'r') as f:
    content = f.read()
match = re.match(r'^---\n(.*?)\n---', content, re.DOTALL)
if match:
    fm = yaml.safe_load(match.group(1))
    if fm and 'title' in fm:
        print(fm['title'])
    else:
        print('Untitled')
else:
    print('Untitled')
"
}

ACADEMY_NAME=$(python3 -c "
import re
with open('$PROJECT_DIR/academy.config.ts', 'r') as f:
    content = f.read()
match = re.search(r'name:\s*\"([^\"]+)\"', content)
print(match.group(1) if match else 'Academy')
")

ACADEMY_DESC=$(python3 -c "
import re
with open('$PROJECT_DIR/academy.config.ts', 'r') as f:
    content = f.read()
match = re.search(r'description:\s*\"([^\"]+)\"', content)
print(match.group(1) if match else '')
")

echo "Processing modules..."
echo ""

for meta_file in "${MODULES[@]}"; do
  module_dir=$(dirname "$meta_file")
  module_title=$(python3 -c "import json; print(json.load(open('$meta_file'))['title'])")
  module_desc=$(python3 -c "import json; m=json.load(open('$meta_file')); print(m.get('description',''))")
  CHAPTER_NUM=$((CHAPTER_NUM + 1))

  chapter_file=$(printf "%s/%02d-%s.md" "$MANUSCRIPT_DIR" "$CHAPTER_NUM" "$(echo "$module_title" | tr '[:upper:]' '[:lower:]' | tr ' ' '-' | tr -cd 'a-z0-9-')")

  echo "  Chapter $CHAPTER_NUM: $module_title"

  {
    echo ""
    echo "# $module_title"
    echo ""
    if [[ -n "$module_desc" ]]; then
      echo "*$module_desc*"
      echo ""
    fi

    SECTION_NUM=0
    for mdx_file in "$module_dir"/*.mdx; do
      [[ -f "$mdx_file" ]] || continue
      SECTION_NUM=$((SECTION_NUM + 1))

      lesson_title=$(extract_title_from_frontmatter "$mdx_file")
      echo "    Section $CHAPTER_NUM.$SECTION_NUM: $lesson_title"

      converted=$(convert_mdx_to_markdown "$mdx_file")

      converted=$(echo "$converted" | sed "s/^## /## $CHAPTER_NUM.$SECTION_NUM /")

      diagram_count=$(echo "$converted" | grep -c '```mermaid' || true)
      TOTAL_DIAGRAMS=$((TOTAL_DIAGRAMS + diagram_count))

      word_count=$(echo "$converted" | wc -w | tr -d ' ')
      TOTAL_WORDS=$((TOTAL_WORDS + word_count))

      quiz_output=$(extract_quizzes "$mdx_file" "$module_title" "$CHAPTER_NUM" 2>/dev/null || true)
      if [[ -n "$quiz_output" ]]; then
        questions=$(echo "$quiz_output" | sed '/^---answers---$/,$d')
        answers=$(echo "$quiz_output" | sed -n '/^---answers---$/,$p' | tail -n +2)
        if [[ -n "$questions" ]]; then
          TOTAL_QUIZZES=$((TOTAL_QUIZZES + $(echo "$questions" | grep -c '^**Q' || true)))
          ALL_QUIZ_ENTRIES+="### Chapter $CHAPTER_NUM: $module_title — $lesson_title"$'\n\n'
          ALL_QUIZ_ENTRIES+="$questions"$'\n'
          ALL_QUIZ_ENTRIES+="**Answers:** $answers"$'\n\n'
        fi
      fi

      terms=$(extract_bold_terms "$mdx_file" 2>/dev/null || true)
      if [[ -n "$terms" ]]; then
        while IFS= read -r term; do
          ALL_GLOSSARY_TERMS+="- **$term**"$'\n'
        done <<< "$terms"
      fi

      echo ""
      echo "$converted"
      echo ""
      echo "---"
      echo ""
    done
  } > "$chapter_file"
done

echo ""
echo "Generating front matter..."

cat > "$MANUSCRIPT_DIR/00-front-matter.md" << FRONTEOF

---

# $ACADEMY_NAME

$ACADEMY_DESC

---

## Preface

This book was generated from the **$ACADEMY_NAME** interactive learning platform. Each chapter corresponds to a module in the academy, and each section maps to an individual lesson.

### Who This Book Is For

This book is designed for practitioners who want a comprehensive, structured guide to the topics covered in the academy. Whether you are reading cover-to-cover or using it as a reference, each chapter builds on the concepts introduced in previous chapters.

### How This Book Is Organized

The book is organized into $CHAPTER_NUM chapters, progressing from foundational concepts to advanced topics. Each chapter includes:

- **Diagrams** that illustrate architecture and data flow
- **Code examples** you can run and modify
- **Key takeaways** summarized at the end of each section

If exercises are included, you will find them in Appendix A, organized by chapter.

### Conventions Used in This Book

- **Bold text** introduces key terms on their first occurrence
- \`Monospace text\` indicates code, commands, or filenames
- Blockquotes (indented text) highlight tips, warnings, or important notes

---

FRONTEOF

echo "  [ok] Front matter"

if [[ -n "$ALL_QUIZ_ENTRIES" ]]; then
  cat > "$MANUSCRIPT_DIR/appendix-a-exercises.md" << QUIZEOF

# Appendix A: Exercises

Review questions organized by chapter. Try answering before checking the answers.

$ALL_QUIZ_ENTRIES
QUIZEOF
  echo "  [ok] Appendix A: Exercises ($TOTAL_QUIZZES questions)"
fi

if [[ -n "$ALL_GLOSSARY_TERMS" ]]; then
  sorted_terms=$(echo "$ALL_GLOSSARY_TERMS" | sort -u)
  cat > "$MANUSCRIPT_DIR/appendix-b-glossary.md" << GLOSSEOF

# Appendix B: Glossary

$sorted_terms
GLOSSEOF
  echo "  [ok] Appendix B: Glossary"
fi

echo "Generating metadata.yaml..."

cat > "$BOOK_DIR/metadata.yaml" << METAEOF
---
title: "$ACADEMY_NAME"
author: "Author Name"
date: "$(date +%Y)"
lang: en
rights: "Copyright © $(date +%Y) Author Name"
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
linkcolor: blue
urlcolor: blue
toc: true
toc-depth: 3
numbersections: true
secnumdepth: 3
highlight-style: tango
---
METAEOF

echo "  [ok] metadata.yaml"

if [[ ! -f "$STYLE_DIR/epub.css" ]]; then
  cat > "$STYLE_DIR/epub.css" << 'CSSEOF'
body {
  font-family: Georgia, "Times New Roman", serif;
  font-size: 1em;
  line-height: 1.5;
  color: #1a1a1a;
}

h1, h2, h3, h4 {
  font-family: "Helvetica Neue", Arial, sans-serif;
  margin-top: 1.5em;
}

h1 { font-size: 1.8em; border-bottom: 2px solid #cc0000; padding-bottom: 0.3em; }
h2 { font-size: 1.4em; }
h3 { font-size: 1.2em; }

code {
  font-family: "Source Code Pro", "Courier New", monospace;
  font-size: 0.85em;
  background: #f5f5f5;
  padding: 0.1em 0.3em;
  border-radius: 3px;
}

pre {
  background: #f5f5f5;
  border: 1px solid #ddd;
  border-left: 4px solid #cc0000;
  padding: 1em;
  overflow-x: auto;
  font-size: 0.85em;
  line-height: 1.4;
}

pre code { background: none; padding: 0; }

blockquote {
  border-left: 4px solid #0066cc;
  background: #f0f7ff;
  padding: 0.8em 1em;
  margin: 1em 0;
  font-style: normal;
}

table { width: 100%; border-collapse: collapse; margin: 1em 0; font-size: 0.9em; }
th { background: #333; color: #fff; padding: 0.6em; text-align: left; }
td { padding: 0.5em; border: 1px solid #ddd; }
tr:nth-child(even) { background: #f9f9f9; }

img { max-width: 100%; height: auto; display: block; margin: 1em auto; }

p { widows: 3; orphans: 3; }
CSSEOF
  echo "  [ok] epub.css"
fi

echo ""
echo "Building book..."
echo ""

MERMAID_FILTER_FLAG=""
if [[ "$HAS_MERMAID_FILTER" == "true" ]]; then
  MERMAID_FILTER_FLAG="--filter mermaid-filter"
elif [[ "$SKIP_DIAGRAMS" != "true" ]] && [[ "$HAS_MMDC" == "true" ]]; then
  echo "  [info] mermaid-filter not found, pre-rendering diagrams with mmdc..."
  for md_file in "$MANUSCRIPT_DIR"/*.md; do
    python3 -c "
import re, subprocess, sys, os

with open('$md_file', 'r') as f:
    content = f.read()

diagram_num = [0]
assets_dir = '$ASSETS_DIR'
basename = os.path.splitext(os.path.basename('$md_file'))[0]

def render_mermaid(match):
    diagram_num[0] += 1
    code = match.group(1).strip()
    svg_name = f'{basename}-diagram-{diagram_num[0]}.svg'
    svg_path = os.path.join(assets_dir, svg_name)

    tmp_file = f'/tmp/mermaid-{basename}-{diagram_num[0]}.mmd'
    with open(tmp_file, 'w') as f:
        f.write(code)

    try:
        subprocess.run(['mmdc', '-i', tmp_file, '-o', svg_path, '-b', 'transparent'],
                      capture_output=True, timeout=30)
        os.unlink(tmp_file)
        return f'![Diagram]({svg_path})'
    except Exception as e:
        print(f'  Warning: Failed to render diagram: {e}', file=sys.stderr)
        return match.group(0)

new_content = re.sub(r'\`\`\`mermaid\n(.*?)\`\`\`', render_mermaid, content, flags=re.DOTALL)

with open('$md_file', 'w') as f:
    f.write(new_content)
" 2>/dev/null || true
  done
fi

MANUSCRIPT_FILES=$(find "$MANUSCRIPT_DIR" -name "*.md" | sort)

IFS=',' read -ra FORMAT_ARRAY <<< "$FORMATS"
for fmt in "${FORMAT_ARRAY[@]}"; do
  fmt=$(echo "$fmt" | tr -d ' ')
  case "$fmt" in
    pdf)
      echo "  Building PDF..."
      pandoc $MANUSCRIPT_FILES \
        --metadata-file="$BOOK_DIR/metadata.yaml" \
        --pdf-engine=xelatex \
        $MERMAID_FILTER_FLAG \
        --highlight-style=tango \
        --toc --toc-depth=3 \
        --number-sections \
        -o "$OUTPUT_DIR/book.pdf" 2>/dev/null || {
          echo "  [WARN] PDF build failed. Check LaTeX installation."
          echo "         Try: tlmgr install collection-fontsrecommended"
        }
      if [[ -f "$OUTPUT_DIR/book.pdf" ]]; then
        pdf_pages=$(python3 -c "
try:
    import subprocess
    result = subprocess.run(['pdfinfo', '$OUTPUT_DIR/book.pdf'], capture_output=True, text=True)
    for line in result.stdout.split('\n'):
        if 'Pages:' in line:
            print(line.split(':')[1].strip())
            break
except: print('?')
" 2>/dev/null || echo "?")
        echo "  [ok] PDF: $OUTPUT_DIR/book.pdf ($pdf_pages pages)"
      fi
      ;;
    epub)
      echo "  Building ePub..."
      EPUB_COVER=""
      if [[ -f "$BOOK_DIR/assets/cover.png" ]]; then
        EPUB_COVER="--epub-cover-image=$BOOK_DIR/assets/cover.png"
      fi
      pandoc $MANUSCRIPT_FILES \
        --metadata-file="$BOOK_DIR/metadata.yaml" \
        $MERMAID_FILTER_FLAG \
        --toc --toc-depth=2 \
        --css="$STYLE_DIR/epub.css" \
        $EPUB_COVER \
        -o "$OUTPUT_DIR/book.epub" 2>/dev/null || {
          echo "  [WARN] ePub build failed."
        }
      if [[ -f "$OUTPUT_DIR/book.epub" ]]; then
        echo "  [ok] ePub: $OUTPUT_DIR/book.epub"
        if command -v epubcheck &> /dev/null && [[ "$SKIP_EPUB_CHECK" != "true" ]]; then
          echo "  Validating ePub..."
          epubcheck "$OUTPUT_DIR/book.epub" 2>/dev/null && echo "  [ok] ePub validation passed" || echo "  [WARN] ePub has validation warnings"
        fi
      fi
      ;;
    html)
      echo "  Building HTML..."
      pandoc $MANUSCRIPT_FILES \
        --metadata-file="$BOOK_DIR/metadata.yaml" \
        $MERMAID_FILTER_FLAG \
        --toc --toc-depth=2 \
        --standalone \
        --self-contained \
        --highlight-style=tango \
        -o "$OUTPUT_DIR/book.html" 2>/dev/null || {
          echo "  [WARN] HTML build failed."
        }
      if [[ -f "$OUTPUT_DIR/book.html" ]]; then
        echo "  [ok] HTML: $OUTPUT_DIR/book.html"
      fi
      ;;
    *)
      echo "  [SKIP] Unknown format: $fmt"
      ;;
  esac
done

echo ""
echo "========================================="
echo "  Build Summary"
echo "========================================="
echo ""
echo "  Chapters:  $CHAPTER_NUM"
echo "  Words:     $TOTAL_WORDS"
echo "  Diagrams:  $TOTAL_DIAGRAMS"
echo "  Quizzes:   $TOTAL_QUIZZES questions"
echo "  Est pages: $((TOTAL_WORDS / 300))"
echo ""
echo "  Output:    $OUTPUT_DIR/"
ls -lh "$OUTPUT_DIR"/ 2>/dev/null | tail -n +2 | awk '{print "             " $NF " (" $5 ")"}'
echo ""
