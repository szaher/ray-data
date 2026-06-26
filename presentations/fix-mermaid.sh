#!/bin/bash
set -euo pipefail

# Convert ```mermaid blocks to <div class="mermaid"> and inject Mermaid JS
# Works on all .md files in the presentations directory

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

MERMAID_INIT='<script type="module">
import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs";
mermaid.initialize({ startOnLoad: true, theme: "base", themeVariables: { primaryColor: "#e0f0ff", primaryTextColor: "#151515", primaryBorderColor: "#0066cc", lineColor: "#0066cc", secondaryColor: "#daf2f2", tertiaryColor: "#f2f2f2", noteBkgColor: "#fef0f0", noteTextColor: "#151515", fontFamily: "Red Hat Text, sans-serif" }});
</script>'

for deck in 0*.md; do
  [ -f "$deck" ] || continue
  echo "Fixing $deck..."

  # 1. Convert ```mermaid ... ``` to <div class="mermaid"> ... </div>
  python3 -c "
import re, sys

with open('$deck', 'r') as f:
    content = f.read()

def replace_mermaid(match):
    code = match.group(1).strip()
    return '<div class=\"mermaid\">\n' + code + '\n</div>'

content = re.sub(r'\`\`\`mermaid\n(.*?)\`\`\`', replace_mermaid, content, flags=re.DOTALL)

with open('$deck', 'w') as f:
    f.write(content)
"

  # 2. Inject Mermaid JS after the closing frontmatter (second ---)
  # Find line number of second --- and inject after it
  python3 -c "
import sys

with open('$deck', 'r') as f:
    lines = f.readlines()

# Find the second '---' (end of frontmatter)
count = 0
insert_at = -1
for i, line in enumerate(lines):
    if line.strip() == '---':
        count += 1
        if count == 2:
            insert_at = i + 1
            break

if insert_at == -1:
    print(f'  Warning: could not find frontmatter end in $deck')
    sys.exit(0)

# Check if mermaid script already injected
content = ''.join(lines)
if 'mermaid.esm.min.mjs' in content:
    print(f'  Already has Mermaid JS, skipping injection')
    sys.exit(0)

mermaid_block = '''
$MERMAID_INIT

'''

lines.insert(insert_at, mermaid_block)

with open('$deck', 'w') as f:
    f.writelines(lines)
"

  echo "  Done."
done

echo ""
echo "All decks fixed. Run build.sh to rebuild."
