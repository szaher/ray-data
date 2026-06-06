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
