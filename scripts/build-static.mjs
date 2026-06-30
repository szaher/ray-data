#!/usr/bin/env node

/**
 * Build a static export of the Next.js app for GitHub Pages.
 *
 * Hides API routes (they can't run in static hosting), switches Next.js
 * to `output: "export"`, builds, then restores everything.
 */

import { execSync } from "node:child_process";
import { existsSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const API_DIR = join(ROOT, "src/app/api");
const API_STASH = join(ROOT, ".api-stash");
const OUT_DIR = join(ROOT, "out");

function run(cmd) {
  console.log(`$ ${cmd}`);
  execSync(cmd, { cwd: ROOT, stdio: "inherit", env: { ...process.env, NEXT_PUBLIC_STATIC_EXPORT: "true" } });
}

function stashApiRoutes() {
  if (existsSync(API_DIR)) {
    console.log("Stashing API routes...");
    renameSync(API_DIR, API_STASH);
  }
}

function restoreApiRoutes() {
  if (existsSync(API_STASH)) {
    console.log("Restoring API routes...");
    if (existsSync(API_DIR)) rmSync(API_DIR, { recursive: true });
    renameSync(API_STASH, API_DIR);
  }
}

function verify() {
  const index = join(OUT_DIR, "index.html");
  if (!existsSync(index)) {
    console.error("ERROR: out/index.html not found — static export failed.");
    process.exit(1);
  }

  const apiInOutput = join(OUT_DIR, "api");
  if (existsSync(apiInOutput)) {
    console.error("ERROR: api/ directory leaked into static export.");
    process.exit(1);
  }

  console.log("Static export verified: out/index.html exists, no api/ leak.");
}

try {
  stashApiRoutes();
  run("npx next build");
  verify();

  writeFileSync(join(OUT_DIR, ".nojekyll"), "");
  console.log("Wrote .nojekyll to out/");

  console.log("\nStatic export complete. Output in out/");
} finally {
  restoreApiRoutes();
}
