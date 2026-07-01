import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const analyzerPath = path.join(root, "scripts", "analyze-gpu-patterns.py");

const GPU_ONLY_ALLOWLIST = [
  {
    path: "content/module-7/02-llm-batch-inference.mdx",
    lineRange: [95, 110],
    reason: "vLLM requires GPU; resource note documents 8-GPU requirement",
  },
];

const RESERVATION_API_MAP = {
  num_gpus: "num_gpus",
  actor_options_num_gpus: "actor_options",
  scaling_config_use_gpu: "scaling_config",
};

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

  const fenced = /```(?:python|py)\n([\s\S]*?)```/g;
  let match;
  while ((match = fenced.exec(content)) !== null) {
    const startLine = content.slice(0, match.index).split("\n").length;
    blocks.push({ code: match[1], offsetLine: startLine });
  }

  const codeProps = /code=\{`([\s\S]*?)`\}/g;
  while ((match = codeProps.exec(content)) !== null) {
    const startLine = content.slice(0, match.index).split("\n").length;
    blocks.push({ code: match[1], offsetLine: startLine });
  }

  return blocks;
}

function analyzeBlock(code) {
  try {
    const result = execFileSync("python3", [analyzerPath], {
      input: code,
      encoding: "utf-8",
      timeout: 10000,
    });
    return JSON.parse(result);
  } catch (err) {
    if (err.stdout) {
      try {
        return JSON.parse(err.stdout);
      } catch {
        // fall through
      }
    }
    return {
      markers: [],
      violations: [],
      gpu_reservations: [],
      api_calls: [],
      parse_error: { line: 1, message: err.message || "Unknown error" },
      has_serve_deployment: false,
    };
  }
}

function hasInlineCpuComment(code, reservationLine) {
  const lines = code.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("# omit for CPU-only")) {
      const lineNum = i + 1;
      if (lineNum === reservationLine || lineNum === reservationLine - 1) {
        return true;
      }
    }
  }
  return false;
}

export async function scanForGpuPatterns(dirs) {
  const violations = [];
  const allowlisted = [];
  const parseErrors = [];
  const parseWarnings = [];
  const allowlistUsed = new Set();

  const allFiles = [];
  for (const dir of dirs) {
    const predicate = (f) => f.endsWith(".mdx") || f.endsWith(".md");
    allFiles.push(...(await listFiles(dir, predicate)));
  }

  for (const file of allFiles) {
    const content = await fs.readFile(file, "utf8");
    const relPath = path.relative(root, file);
    const blocks = extractPythonCodeBlocks(content);

    const fileGpuMarkers = [];
    const fileCpuMarkers = [];
    const fileResourceRefMarkers = [];
    const fileBlockAnalyses = [];

    for (const block of blocks) {
      const analysis = analyzeBlock(block.code);
      fileBlockAnalyses.push({ block, analysis });

      if (analysis.parse_error) {
        const tf = analysis.token_fallback;
        if (tf) {
          // Token fallback found violations — report as fatal
          for (const v of tf.violations) {
            violations.push({
              file: relPath,
              line: block.offsetLine + v.line - 1,
              pattern: v.pattern,
              detail: v.detail,
            });
          }

          // Parse-failed blocks with positive GPU reservations are always fatal
          if (tf.gpu_reservations.length > 0) {
            parseErrors.push({
              file: relPath,
              line: block.offsetLine + (analysis.parse_error.line || 1) - 1,
              message: `Parse-failed block contains GPU reservation(s) — fix syntax or use non-Python fence: ${analysis.parse_error.message}`,
            });
          } else if (tf.violations.length === 0) {
            if (tf.tokenize_failed) {
              // Tokenize also failed — check raw text for any GPU-related content
              const GPU_TOKENS = [".cuda", "device=", "num_gpus", "ray_actor_options", "use_gpu"];
              const hasGpuText = GPU_TOKENS.some((t) => block.code.includes(t));
              if (hasGpuText) {
                parseErrors.push({
                  file: relPath,
                  line: block.offsetLine + (analysis.parse_error.line || 1) - 1,
                  message: `Unparseable block contains GPU-related text: ${analysis.parse_error.message}`,
                });
              } else {
                parseWarnings.push({
                  file: relPath,
                  line: block.offsetLine + (analysis.parse_error.line || 1) - 1,
                  message: analysis.parse_error.message,
                });
              }
            } else {
              // Tokenize succeeded, no violations or reservations found — warning only
              parseWarnings.push({
                file: relPath,
                line: block.offsetLine + (analysis.parse_error.line || 1) - 1,
                message: analysis.parse_error.message,
              });
            }
          }
        } else {
          // No token_fallback — old-style parse error (shouldn't happen with updated helper)
          parseErrors.push({
            file: relPath,
            line: block.offsetLine + (analysis.parse_error.line || 1) - 1,
            message: analysis.parse_error.message,
          });
        }

        // Extract markers even from parse-failed blocks (for auditing, but won't trust them)
        for (const m of analysis.markers || []) {
          const adjusted = { ...m, line: block.offsetLine + m.line - 1, blockIndex: fileBlockAnalyses.length - 1 };
          if (m.type === "gpu-resource-reference") fileResourceRefMarkers.push(adjusted);
        }

        continue;
      }

      for (const v of analysis.violations) {
        violations.push({
          file: relPath,
          line: block.offsetLine + v.line - 1,
          pattern: v.pattern,
          detail: v.detail,
        });
      }

      for (const m of analysis.markers) {
        const adjusted = { ...m, line: block.offsetLine + m.line - 1, blockIndex: fileBlockAnalyses.length - 1 };
        if (m.type === "gpu-example") fileGpuMarkers.push(adjusted);
        else if (m.type === "cpu-alternative") fileCpuMarkers.push(adjusted);
        else if (m.type === "gpu-resource-reference") fileResourceRefMarkers.push(adjusted);
      }
    }

    // Check for duplicate marker IDs
    const gpuIds = new Set();
    for (const m of fileGpuMarkers) {
      if (gpuIds.has(m.id)) {
        violations.push({
          file: relPath,
          line: m.line,
          pattern: `duplicate gpu-example: ${m.id}`,
          detail: "Duplicate marker ID in same file",
        });
      }
      gpuIds.add(m.id);
    }
    const cpuIds = new Set();
    for (const m of fileCpuMarkers) {
      if (cpuIds.has(m.id)) {
        violations.push({
          file: relPath,
          line: m.line,
          pattern: `duplicate cpu-alternative: ${m.id}`,
          detail: "Duplicate marker ID in same file",
        });
      }
      cpuIds.add(m.id);
    }

    // Build marker-to-blockIndex maps
    const gpuMarkerByBlock = new Map();
    for (const m of fileGpuMarkers) {
      gpuMarkerByBlock.set(m.blockIndex, m);
    }
    const cpuMarkerById = new Map();
    for (const m of fileCpuMarkers) {
      cpuMarkerById.set(m.id, m);
    }

    // Build resource-reference markers by block index
    const resourceRefsByBlock = new Map();
    for (const m of fileResourceRefMarkers) {
      if (!resourceRefsByBlock.has(m.blockIndex)) {
        resourceRefsByBlock.set(m.blockIndex, []);
      }
      resourceRefsByBlock.get(m.blockIndex).push(m);
    }

    // Enforce paired markers for GPU reservations
    for (let bi = 0; bi < fileBlockAnalyses.length; bi++) {
      const { block, analysis } = fileBlockAnalyses[bi];
      if (analysis.parse_error) continue;

      const blockViolations = analysis.violations || [];
      const hasDeviceViolations = blockViolations.length > 0;

      // Track which resource-ref annotations are matched
      const refMarkers = resourceRefsByBlock.get(bi) || [];
      const matchedRefIndices = new Set();

      for (const res of analysis.gpu_reservations) {
        const resLine = block.offsetLine + res.line - 1;
        const resApi = RESERVATION_API_MAP[res.type];

        // Check allowlist
        const allowEntry = GPU_ONLY_ALLOWLIST.find(
          (a) => a.path === relPath && resLine >= a.lineRange[0] && resLine <= a.lineRange[1]
        );
        if (allowEntry) {
          allowlisted.push({
            file: relPath,
            line: resLine,
            reason: allowEntry.reason,
            type: res.type,
          });
          allowlistUsed.add(GPU_ONLY_ALLOWLIST.indexOf(allowEntry));
          continue;
        }

        // Check for inline CPU comment (presentations)
        if (hasInlineCpuComment(block.code, res.line)) {
          if (hasDeviceViolations) {
            violations.push({
              file: relPath,
              line: resLine,
              pattern: `# omit for CPU-only with device violations`,
              detail: "Cannot use # omit for CPU-only in blocks with device-placement violations — fix device patterns first",
            });
          } else {
            allowlisted.push({
              file: relPath,
              line: resLine,
              reason: `# omit for CPU-only (${res.type})`,
              type: res.type,
            });
          }
          continue;
        }

        // Check for gpu-resource-reference marker in same block (one-to-one matching)
        let refMatched = false;
        for (let ri = 0; ri < refMarkers.length; ri++) {
          if (matchedRefIndices.has(ri)) continue;
          const ref = refMarkers[ri];
          if (ref.api === resApi) {
            if (hasDeviceViolations) {
              violations.push({
                file: relPath,
                line: ref.line,
                pattern: `gpu-resource-reference with device violations`,
                detail: "gpu-resource-reference cannot be used with device-placement code; use gpu-example/cpu-alternative instead",
              });
            } else {
              allowlisted.push({
                file: relPath,
                line: resLine,
                reason: `gpu-resource-reference: ${ref.api} (line ${ref.line})`,
                type: res.type,
              });
            }
            matchedRefIndices.add(ri);
            refMatched = true;
            break;
          }
        }
        if (refMatched) continue;

        // Check for mismatched resource-reference (wrong API)
        const unmatchedRef = refMarkers.find(
          (ref, ri) => !matchedRefIndices.has(ri) && ref.api !== resApi
        );
        if (unmatchedRef) {
          violations.push({
            file: relPath,
            line: unmatchedRef.line,
            pattern: `gpu-resource-reference API mismatch`,
            detail: `Annotation API "${unmatchedRef.api}" does not match reservation type "${resApi}"`,
          });
          continue;
        }

        // Check for gpu-example marker in SAME block
        const gpuMarker = gpuMarkerByBlock.get(bi);
        if (!gpuMarker) {
          violations.push({
            file: relPath,
            line: resLine,
            pattern: `${res.type} without gpu-example marker`,
            detail: "GPU reservation must be in a code block with a # gpu-example: <id> marker",
          });
          continue;
        }

        // Check for matching cpu-alternative
        const cpuMarker = cpuMarkerById.get(gpuMarker.id);
        if (!cpuMarker) {
          violations.push({
            file: relPath,
            line: resLine,
            pattern: `gpu-example: ${gpuMarker.id} without cpu-alternative`,
            detail: "Missing matching # cpu-alternative: " + gpuMarker.id,
          });
          continue;
        }

        // Validate CPU alternative content
        const cpuBlockAnalysis = fileBlockAnalyses[cpuMarker.blockIndex]?.analysis;
        if (cpuBlockAnalysis && !cpuBlockAnalysis.parse_error) {
          if (cpuBlockAnalysis.gpu_reservations.length > 0) {
            violations.push({
              file: relPath,
              line: cpuMarker.line,
              pattern: `cpu-alternative: ${gpuMarker.id} contains GPU reservation`,
              detail: "CPU alternative block must not contain GPU reservations",
            });
          }

          const hasMatchingApi = validateCpuApiMatch(res.type, cpuBlockAnalysis);
          if (!hasMatchingApi) {
            violations.push({
              file: relPath,
              line: cpuMarker.line,
              pattern: `cpu-alternative: ${gpuMarker.id} missing scheduling API`,
              detail: getCpuMismatchDetail(res.type),
            });
          }
        }
      }

      // Check for unmatched resource-reference annotations (one-to-one enforcement)
      for (let ri = 0; ri < refMarkers.length; ri++) {
        if (matchedRefIndices.has(ri)) continue;
        const ref = refMarkers[ri];
        violations.push({
          file: relPath,
          line: ref.line,
          pattern: `unmatched gpu-resource-reference`,
          detail: `gpu-resource-reference annotation has no matching positive GPU reservation in this block`,
        });
      }
    }
  }

  // Check for stale allowlist entries (only for files that were actually scanned)
  const scannedRelPaths = new Set(allFiles.map((f) => path.relative(root, f)));
  for (let i = 0; i < GPU_ONLY_ALLOWLIST.length; i++) {
    if (!allowlistUsed.has(i)) {
      const entry = GPU_ONLY_ALLOWLIST[i];
      if (scannedRelPaths.has(entry.path)) {
        parseErrors.push({
          file: entry.path,
          line: entry.lineRange[0],
          message: `Stale allowlist entry: "${entry.reason}" — no GPU reservation found in line range [${entry.lineRange[0]}, ${entry.lineRange[1]}]`,
        });
      }
    }
  }

  return { violations, allowlisted, parseErrors, parseWarnings };
}

function validateCpuApiMatch(gpuType, cpuAnalysis) {
  switch (gpuType) {
    case "num_gpus":
      return cpuAnalysis.api_calls.some((c) => c.type === "ray_data_transform");
    case "actor_options_num_gpus":
      return cpuAnalysis.has_serve_deployment || cpuAnalysis.api_calls.some((c) => c.type === "serve_bind");
    case "scaling_config_use_gpu":
      return cpuAnalysis.api_calls.some((c) => c.type === "scaling_config");
    default:
      return true;
  }
}

function getCpuMismatchDetail(gpuType) {
  switch (gpuType) {
    case "num_gpus":
      return "CPU alternative must contain a map_batches/map call without num_gpus";
    case "actor_options_num_gpus":
      return "CPU alternative must contain a Serve deployment definition without GPU actor options";
    case "scaling_config_use_gpu":
      return "CPU alternative must contain ScalingConfig(use_gpu=False) or ScalingConfig without use_gpu";
    default:
      return "CPU alternative missing matching scheduling API";
  }
}

async function main() {
  const contentDir = path.join(root, "content");
  const presentationsDir = path.join(root, "presentations");
  const { violations, allowlisted, parseErrors, parseWarnings } = await scanForGpuPatterns([contentDir, presentationsDir]);

  if (parseWarnings.length > 0) {
    console.log("PARSE WARNINGS (non-GPU code blocks, informational):\n");
    for (const w of parseWarnings) {
      console.log(`  ${w.file}:${w.line}`);
      console.log(`    ${w.message}\n`);
    }
  }

  if (parseErrors.length > 0) {
    console.error("PARSE ERRORS (fatal — GPU-related code blocks):\n");
    for (const e of parseErrors) {
      console.error(`  ${e.file}:${e.line}`);
      console.error(`    ${e.message}\n`);
    }
  }

  if (violations.length > 0) {
    console.error("GPU PATTERN VIOLATIONS:\n");
    for (const v of violations) {
      console.error(`  ${v.file}:${v.line}`);
      console.error(`    ${v.pattern}: ${v.detail}\n`);
    }
  }

  if (allowlisted.length > 0) {
    console.log("\nAllowlisted GPU reservations:\n");
    for (const a of allowlisted) {
      console.log(`  ${a.file}:${a.line} [${a.type}]`);
      console.log(`    ${a.reason}\n`);
    }
  }

  const errorCount = violations.length + parseErrors.length;
  if (errorCount > 0) {
    console.error(
      `\n${violations.length} violation(s), ${parseErrors.length} parse error(s). Fix GPU patterns.`
    );
    process.exit(1);
  }

  const warnCount = parseWarnings.length;
  console.log(
    `\nNo GPU pattern violations. ${allowlisted.length} allowlisted reservation(s). ${warnCount} parse warning(s).`
  );
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
