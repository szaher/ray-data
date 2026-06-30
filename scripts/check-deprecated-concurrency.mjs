import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

async function listFiles(dir, predicate) {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await listFiles(fullPath, predicate)));
    else if (predicate(fullPath)) files.push(fullPath);
  }
  return files;
}

function extractPythonCodeBlocks(content) {
  const blocks = [];

  const fenced = /```(?:python|py)?\n([\s\S]*?)```/g;
  let match;
  while ((match = fenced.exec(content)) !== null) {
    blocks.push({ code: match[1], offset: match.index });
  }

  const codeProps = /code=\{`([\s\S]*?)`\}/g;
  while ((match = codeProps.exec(content)) !== null) {
    blocks.push({ code: match[1], offset: match.index });
  }

  return blocks;
}

const RAY_DATA_CALL = /\.\s*(?:map|map_batches|flat_map|filter)\s*\(/;

function findDeprecatedConcurrency(code, fileRelPath) {
  const violations = [];
  const lines = code.split("\n");

  let inCall = false;
  let callStartLine = 0;
  let parenDepth = 0;
  let callBuffer = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const stripped = line.replace(/#.*$/, "");

    if (!inCall) {
      if (RAY_DATA_CALL.test(stripped)) {
        inCall = true;
        callStartLine = i;
        callBuffer = stripped;
        parenDepth = 0;
        for (const ch of stripped) {
          if (ch === "(") parenDepth++;
          if (ch === ")") parenDepth--;
        }
        if (parenDepth <= 0) {
          checkCall(callBuffer, callStartLine);
          inCall = false;
          callBuffer = "";
        }
      }
    } else {
      callBuffer += "\n" + stripped;
      for (const ch of stripped) {
        if (ch === "(") parenDepth++;
        if (ch === ")") parenDepth--;
      }
      if (parenDepth <= 0) {
        checkCall(callBuffer, callStartLine);
        inCall = false;
        callBuffer = "";
      }
    }
  }

  function checkCall(buf, startLine) {
    if (/\bconcurrency\s*=/.test(buf)) {
      violations.push({
        file: fileRelPath,
        line: startLine + 1,
        snippet: buf.trim().slice(0, 120),
      });
    }
  }

  return violations;
}

export async function scanForDeprecatedConcurrency(contentDir) {
  const mdxFiles = await listFiles(contentDir, (f) => f.endsWith(".mdx"));
  const violations = [];
  const allowlist = [];

  for (const file of mdxFiles) {
    const content = await fs.readFile(file, "utf8");
    const relPath = path.relative(root, file);
    const blocks = extractPythonCodeBlocks(content);

    for (const block of blocks) {
      const found = findDeprecatedConcurrency(block.code, relPath);
      violations.push(...found);
    }

    const proseLines = content.split("\n");
    for (let i = 0; i < proseLines.length; i++) {
      if (/\bconcurrency\b/.test(proseLines[i]) && !/max_concurrency/.test(proseLines[i])) {
        let inCodeBlock = false;
        const before = proseLines.slice(0, i).join("\n");
        const fenceCount = (before.match(/```/g) || []).length;
        if (fenceCount % 2 === 1) inCodeBlock = true;
        if (/code=\{`/.test(proseLines[i])) inCodeBlock = true;

        if (!inCodeBlock) {
          allowlist.push({
            file: relPath,
            line: i + 1,
            context: proseLines[i].trim().slice(0, 120),
          });
        }
      }
    }
  }

  return { violations, allowlist };
}

async function main() {
  const contentDir = path.join(root, "content");
  const { violations, allowlist } = await scanForDeprecatedConcurrency(contentDir);

  if (violations.length > 0) {
    console.error("DEPRECATED concurrency= found in Ray Data API calls:\n");
    for (const v of violations) {
      console.error(`  ${v.file}:${v.line}`);
      console.error(`    ${v.snippet}\n`);
    }
  }

  if (allowlist.length > 0) {
    console.log("\nAllowlisted concurrency mentions (prose/quiz/diagram):\n");
    for (const a of allowlist) {
      console.log(`  ${a.file}:${a.line}`);
      console.log(`    ${a.context}\n`);
    }
  }

  if (violations.length > 0) {
    console.error(`\n${violations.length} violation(s) found. Fix deprecated concurrency= usage.`);
    process.exit(1);
  }

  console.log(`\nNo deprecated concurrency= found in code examples. ${allowlist.length} allowlisted prose mention(s).`);
}

const isDirectRun =
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isDirectRun) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
