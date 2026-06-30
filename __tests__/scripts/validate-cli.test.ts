// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";

const execFileAsync = promisify(execFile);
const scriptPath = path.resolve("scripts/validate.mjs");

async function runValidator(contentDir: string) {
  try {
    const { stdout, stderr } = await execFileAsync(
      "node",
      [scriptPath, "--content-dir", contentDir],
      { timeout: 15000 },
    );
    return { exitCode: 0, stdout, stderr };
  } catch (err: unknown) {
    const e = err as { code?: number; stdout?: string; stderr?: string };
    return {
      exitCode: e.code ?? 1,
      stdout: e.stdout ?? "",
      stderr: e.stderr ?? "",
    };
  }
}

describe("validate CLI", () => {
  let tmpDir: string;
  let contentDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "validate-cli-"));
    contentDir = path.join(tmpDir, "content");
    await fs.mkdir(path.join(contentDir, "module-1"), { recursive: true });
    await fs.mkdir(path.join(contentDir, "tutorials"), { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("exits 0 for valid content", async () => {
    await fs.writeFile(
      path.join(contentDir, "module-1", "01-lesson.mdx"),
      '---\ntitle: "Hello"\ndescription: "World"\n---\n\nSome body text.\n',
    );

    const result = await runValidator(contentDir);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Validation passed");
  });

  it("exits 1 for MDX with compilation error", async () => {
    await fs.writeFile(
      path.join(contentDir, "module-1", "01-broken.mdx"),
      '---\ntitle: "Broken"\ndescription: "Test"\n---\n\n<Unclosed\n',
    );

    const result = await runValidator(contentDir);
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain("MDX compilation failed");
  });

  it("errors on missing description", async () => {
    await fs.writeFile(
      path.join(contentDir, "module-1", "01-nodesc.mdx"),
      '---\ntitle: "No Description"\n---\n\nBody.\n',
    );

    const result = await runValidator(contentDir);
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain("description");
  });

  it("reports diagram missing fallback", async () => {
    await fs.writeFile(
      path.join(contentDir, "module-1", "01-diagram.mdx"),
      '---\ntitle: "Diag"\ndescription: "Test"\n---\n\n<MermaidDiagram chart={`graph LR`} />\n',
    );

    const result = await runValidator(contentDir);
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain("fallback");
  });

  it("reports broken local link", async () => {
    await fs.writeFile(
      path.join(contentDir, "module-1", "01-links.mdx"),
      '---\ntitle: "Links"\ndescription: "Test"\n---\n\n[bad](./nonexistent.mdx)\n',
    );

    const result = await runValidator(contentDir);
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain("Broken local link");
  });
});
