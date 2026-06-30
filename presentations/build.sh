#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

MARP="npx --yes @marp-team/marp-cli"
OUTPUT_DIR="$SCRIPT_DIR/dist"

mkdir -p "$OUTPUT_DIR"

echo "Building Ray Data Academy presentations..."
echo ""

for deck in 01-*.md 02-*.md 03-*.md 04-*.md 05-*.md; do
  [ -f "$deck" ] || continue
  name="${deck%.md}"
  echo "  Building $deck -> $name.html"
  $MARP "$deck" \
    --config marp.config.mjs \
    --theme-set themes/ \
    --html \
    --output "$OUTPUT_DIR/$name.html"
done

echo ""
echo "Done. Presentations are in $OUTPUT_DIR/"
echo ""
echo "To present: open dist/<deck>.html in your browser"
echo "  - Press F for fullscreen"
echo "  - Press P for presenter view (notes)"
echo "  - Arrow keys to navigate"
