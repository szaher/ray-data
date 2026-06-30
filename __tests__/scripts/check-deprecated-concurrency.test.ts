// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";

import { scanForDeprecatedConcurrency } from "../../scripts/check-deprecated-concurrency.mjs";

describe("scanForDeprecatedConcurrency", () => {
  let tmpDir: string;
  let contentDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(
      path.join(os.tmpdir(), "deprecated-concurrency-"),
    );
    contentDir = path.join(tmpDir, "content");
    await fs.mkdir(path.join(contentDir, "module-1"), { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  async function writeFixture(name: string, content: string) {
    await fs.writeFile(
      path.join(contentDir, "module-1", name),
      `---\ntitle: "Test"\ndescription: "Test"\n---\n\n${content}`,
    );
  }

  it("flags concurrency= in fenced Python code", async () => {
    await writeFixture(
      "01.mdx",
      '```python\nds = ds.map_batches(Foo, concurrency=4)\n```',
    );
    const { violations } = await scanForDeprecatedConcurrency(contentDir);
    expect(violations).toHaveLength(1);
  });

  it("flags concurrency= in CodeBlock code prop", async () => {
    await writeFixture(
      "01.mdx",
      '<CodeBlock code={`ds = ds.map_batches(Foo, concurrency=4)`} />',
    );
    const { violations } = await scanForDeprecatedConcurrency(contentDir);
    expect(violations).toHaveLength(1);
  });

  it("flags multiline map_batches call with concurrency=", async () => {
    await writeFixture(
      "01.mdx",
      [
        "```python",
        "ds = ds.map_batches(",
        "    Foo,",
        "    batch_size=64,",
        "    concurrency=4,",
        "    num_gpus=1,",
        ")",
        "```",
      ].join("\n"),
    );
    const { violations } = await scanForDeprecatedConcurrency(contentDir);
    expect(violations).toHaveLength(1);
  });

  it("does not flag max_concurrency in prose", async () => {
    await writeFixture(
      "01.mdx",
      "The actor uses `max_concurrency=4` for parallel calls.",
    );
    const { violations, allowlist } =
      await scanForDeprecatedConcurrency(contentDir);
    expect(violations).toHaveLength(0);
    expect(allowlist).toHaveLength(0);
  });

  it("does not flag compute= (non-deprecated) usage", async () => {
    await writeFixture(
      "01.mdx",
      '```python\nds = ds.map_batches(Foo, compute=ray.data.ActorPoolStrategy(size=4))\n```',
    );
    const { violations } = await scanForDeprecatedConcurrency(contentDir);
    expect(violations).toHaveLength(0);
  });

  it("flags concurrency= in .map() calls", async () => {
    await writeFixture(
      "01.mdx",
      '```python\nds = ds.map(Bar, concurrency=2)\n```',
    );
    const { violations } = await scanForDeprecatedConcurrency(contentDir);
    expect(violations).toHaveLength(1);
  });

  it("flags concurrency= in .flat_map() calls", async () => {
    await writeFixture(
      "01.mdx",
      '```python\nds = ds.flat_map(fn, concurrency=2)\n```',
    );
    const { violations } = await scanForDeprecatedConcurrency(contentDir);
    expect(violations).toHaveLength(1);
  });

  it("flags concurrency= in .filter() calls", async () => {
    await writeFixture(
      "01.mdx",
      '```python\nds = ds.filter(fn, concurrency=2)\n```',
    );
    const { violations } = await scanForDeprecatedConcurrency(contentDir);
    expect(violations).toHaveLength(1);
  });

  it("reports prose mentions of concurrency in allowlist", async () => {
    await writeFixture(
      "01.mdx",
      "The `concurrency` parameter controls parallelism.",
    );
    const { violations, allowlist } =
      await scanForDeprecatedConcurrency(contentDir);
    expect(violations).toHaveLength(0);
    expect(allowlist).toHaveLength(1);
  });

  it("handles comments in Python code", async () => {
    await writeFixture(
      "01.mdx",
      [
        "```python",
        "# concurrency=4 was the old way",
        "ds = ds.map_batches(Foo, compute=ray.data.ActorPoolStrategy(size=4))",
        "```",
      ].join("\n"),
    );
    const { violations } = await scanForDeprecatedConcurrency(contentDir);
    expect(violations).toHaveLength(0);
  });

  it("handles string literals containing concurrency=", async () => {
    await writeFixture(
      "01.mdx",
      [
        "```python",
        'msg = "use concurrency=4 for best results"',
        "ds = ds.map_batches(Foo, compute=ray.data.ActorPoolStrategy(size=4))",
        "```",
      ].join("\n"),
    );
    const { violations } = await scanForDeprecatedConcurrency(contentDir);
    expect(violations).toHaveLength(0);
  });

  it("returns empty for clean files", async () => {
    await writeFixture(
      "01.mdx",
      '```python\nds = ds.map_batches(Foo, compute=ray.data.ActorPoolStrategy(size=4))\n```',
    );
    const { violations, allowlist } =
      await scanForDeprecatedConcurrency(contentDir);
    expect(violations).toHaveLength(0);
    expect(allowlist).toHaveLength(0);
  });
});
