#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
TARGET_DIR="$(pwd)"
DRY_RUN=0
DELETE_OLD=0

PRESERVE_PATHS=(
  ".git/"
  ".env*"
  "academy.config.ts"
  "content/"
  "presentations/"
  "docker-compose.yml"
  "node_modules/"
  ".next/"
  "out/"
  "build/"
  "coverage/"
  "exports/"
  ".superpowers/"
)

usage() {
  cat <<'EOF'
Usage: scripts/update-template.sh [options]

Sync template-owned files from a learn-template checkout into an academy
instance while preserving academy-owned content and configuration.

Typical use from an academy instance:
  /path/to/learn-template/scripts/update-template.sh

Options:
  --source DIR           Template checkout to copy from
                         (default: parent directory of this script)
  --target DIR           Academy instance to update (default: current directory)
  --preserve PATH        Additional path or glob to preserve. May be repeated.
  --delete-old           Delete target files that no longer exist in the source,
                         except preserved paths
  --dry-run              Show what would change without writing files
  -h, --help             Show this help

Preserved by default:
  .git/, .env*, academy.config.ts, content/, presentations/,
  docker-compose.yml, node_modules/, .next/, out/, build/, coverage/,
  exports/, .superpowers/
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --source)
      SOURCE_DIR="${2:-}"
      shift 2
      ;;
    --target)
      TARGET_DIR="${2:-}"
      shift 2
      ;;
    --preserve)
      PRESERVE_PATHS+=("${2:-}")
      shift 2
      ;;
    --delete-old)
      DELETE_OLD=1
      shift
      ;;
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

if [[ -z "$SOURCE_DIR" || -z "$TARGET_DIR" ]]; then
  echo "Source and target directories must be non-empty." >&2
  exit 2
fi

SOURCE_DIR="$(cd "$SOURCE_DIR" && pwd)"
TARGET_DIR="$(cd "$TARGET_DIR" && pwd)"

if [[ "$SOURCE_DIR" == "$TARGET_DIR" ]]; then
  echo "Source and target are the same directory: $SOURCE_DIR" >&2
  echo "Run this from an academy instance, or pass --target /path/to/instance." >&2
  exit 1
fi

if [[ ! -f "$SOURCE_DIR/package.json" || ! -d "$SOURCE_DIR/src" ]]; then
  echo "Source does not look like the learn-template checkout: $SOURCE_DIR" >&2
  exit 1
fi

if [[ ! -d "$TARGET_DIR" ]]; then
  echo "Target directory does not exist: $TARGET_DIR" >&2
  exit 1
fi

if [[ -d "$TARGET_DIR/.git" && -n "$(git -C "$TARGET_DIR" status --porcelain)" ]]; then
  cat >&2 <<'EOF'
Target working tree has uncommitted changes.

Commit or stash them before updating from the template. This keeps template
updates separate from local academy work.
EOF
  exit 1
fi

if ! command -v rsync >/dev/null 2>&1; then
  echo "rsync is required for template updates." >&2
  exit 1
fi

PACKAGE_NAME=""
if [[ -f "$TARGET_DIR/package.json" ]] && command -v node >/dev/null 2>&1; then
  PACKAGE_NAME="$(node -e "const fs=require('fs'); const p=JSON.parse(fs.readFileSync(process.argv[1], 'utf8')); process.stdout.write(p.name || '')" "$TARGET_DIR/package.json")"
fi

rsync_args=(
  "-av"
  "--exclude=.git/"
)

if [[ "$DRY_RUN" == "1" ]]; then
  rsync_args+=("--dry-run")
fi

if [[ "$DELETE_OLD" == "1" ]]; then
  rsync_args+=("--delete")
fi

for path in "${PRESERVE_PATHS[@]}"; do
  rsync_args+=("--exclude=$path")
done

cat <<EOF
Updating academy instance from template...

Source: $SOURCE_DIR
Target: $TARGET_DIR
Mode:   $(if [[ "$DRY_RUN" == "1" ]]; then echo "dry run"; else echo "write"; fi)
Delete: $(if [[ "$DELETE_OLD" == "1" ]]; then echo "yes"; else echo "no"; fi)
EOF

rsync "${rsync_args[@]}" "$SOURCE_DIR/" "$TARGET_DIR/"

if [[ "$DRY_RUN" == "1" ]]; then
  echo "Dry run complete. No files were changed."
  exit 0
fi

if [[ -n "$PACKAGE_NAME" && -f "$TARGET_DIR/package.json" ]] && command -v node >/dev/null 2>&1; then
  node -e "const fs=require('fs'); const file=process.argv[1]; const name=process.argv[2]; const p=JSON.parse(fs.readFileSync(file, 'utf8')); p.name=name; fs.writeFileSync(file, JSON.stringify(p, null, 2) + '\n')" "$TARGET_DIR/package.json" "$PACKAGE_NAME"
  echo "Preserved package.json name: $PACKAGE_NAME"
fi

cat <<'EOF'
Template update complete.

Review the changes, then run the usual checks:
  pnpm install
  pnpm validate
  pnpm test
  pnpm lint
  pnpm build
EOF
