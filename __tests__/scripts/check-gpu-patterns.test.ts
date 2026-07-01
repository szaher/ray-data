// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";
import { execFileSync } from "node:child_process";

import { scanForGpuPatterns } from "../../scripts/check-gpu-patterns.mjs";

interface Violation {
  file: string;
  line: number;
  pattern: string;
  detail: string;
}


let pythonAvailable = false;
try {
  execFileSync("python3", ["--version"], { encoding: "utf-8", stdio: "pipe" });
  pythonAvailable = true;
} catch {
  pythonAvailable = false;
}

describe.skipIf(!pythonAvailable)("scanForGpuPatterns", () => {
  let tmpDir: string;
  let contentDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "gpu-patterns-"));
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

  // --- Device pattern violations ---

  it("flags .cuda() in fenced Python code", async () => {
    await writeFixture("01.mdx", "```python\nmodel.cuda()\n```");
    const { violations } = await scanForGpuPatterns([contentDir]);
    expect(violations).toHaveLength(1);
    expect(violations[0].pattern).toBe(".cuda()");
  });

  it("flags .cuda() in CodeBlock code prop", async () => {
    await writeFixture("01.mdx", "<CodeBlock code={`model.cuda()`} />");
    const { violations } = await scanForGpuPatterns([contentDir]);
    expect(violations).toHaveLength(1);
  });

  it('flags .to("cuda")', async () => {
    await writeFixture("01.mdx", '```python\ntensor.to("cuda")\n```');
    const { violations } = await scanForGpuPatterns([contentDir]);
    expect(violations).toHaveLength(1);
    expect(violations[0].pattern).toContain('.to("cuda")');
  });

  it('flags .to("cuda:0")', async () => {
    await writeFixture("01.mdx", '```python\ntensor.to("cuda:0")\n```');
    const { violations } = await scanForGpuPatterns([contentDir]);
    expect(violations).toHaveLength(1);
  });

  it("flags bare torch.device('cuda')", async () => {
    await writeFixture(
      "01.mdx",
      '```python\nd = torch.device("cuda")\n```',
    );
    const { violations } = await scanForGpuPatterns([contentDir]);
    expect(violations).toHaveLength(1);
    expect(violations[0].pattern).toContain("torch.device");
  });

  it("flags torch.cuda.set_device(0)", async () => {
    await writeFixture(
      "01.mdx",
      "```python\ntorch.cuda.set_device(0)\n```",
    );
    const { violations } = await scanForGpuPatterns([contentDir]);
    expect(violations).toHaveLength(1);
  });

  it('flags device="cuda" keyword argument', async () => {
    await writeFixture(
      "01.mdx",
      '```python\npipeline("text", device="cuda")\n```',
    );
    const { violations } = await scanForGpuPatterns([contentDir]);
    expect(violations).toHaveLength(1);
    expect(violations[0].pattern).toContain('device="cuda"');
  });

  it("flags device=0 keyword argument", async () => {
    await writeFixture(
      "01.mdx",
      '```python\npipeline("text", device=0)\n```',
    );
    const { violations } = await scanForGpuPatterns([contentDir]);
    expect(violations).toHaveLength(1);
    expect(violations[0].pattern).toContain("device=0");
  });

  it('flags hardcoded device = "cuda" assignment', async () => {
    await writeFixture("01.mdx", '```python\ndevice = "cuda"\n```');
    const { violations } = await scanForGpuPatterns([contentDir]);
    expect(violations).toHaveLength(1);
    expect(violations[0].detail).toContain("Hardcoded device assignment");
  });

  it("flags self.device = 'cuda:0' assignment", async () => {
    await writeFixture(
      "01.mdx",
      "```python\nclass M:\n    def __init__(self):\n        self.device = 'cuda:0'\n```",
    );
    const { violations } = await scanForGpuPatterns([contentDir]);
    expect(violations).toHaveLength(1);
  });

  // --- AST-specific non-violations ---

  it("allows torch.device with is_available() conditional", async () => {
    await writeFixture(
      "01.mdx",
      '```python\nd = torch.device("cuda" if torch.cuda.is_available() else "cpu")\n```',
    );
    const { violations } = await scanForGpuPatterns([contentDir]);
    expect(violations).toHaveLength(0);
  });

  it("flags torch.device with non-is_available conditional", async () => {
    await writeFixture(
      "01.mdx",
      '```python\nd = torch.device("cuda" if True else "cpu")\n```',
    );
    const { violations } = await scanForGpuPatterns([contentDir]);
    expect(violations).toHaveLength(1);
    expect(violations[0].detail).toContain("is_available()");
  });

  it("does not flag torch.cuda.is_available() alone", async () => {
    await writeFixture(
      "01.mdx",
      "```python\nif torch.cuda.is_available():\n    pass\n```",
    );
    const { violations } = await scanForGpuPatterns([contentDir]);
    expect(violations).toHaveLength(0);
  });

  it("excludes Python comments containing .cuda()", async () => {
    await writeFixture(
      "01.mdx",
      "```python\n# model.cuda() is the old pattern\nx = 1\n```",
    );
    const { violations } = await scanForGpuPatterns([contentDir]);
    expect(violations).toHaveLength(0);
  });

  it("excludes string literals containing .cuda()", async () => {
    await writeFixture(
      "01.mdx",
      '```python\nmsg = "call .cuda() for GPU"\n```',
    );
    const { violations } = await scanForGpuPatterns([contentDir]);
    expect(violations).toHaveLength(0);
  });

  it("does not scan prose outside code blocks", async () => {
    await writeFixture("01.mdx", "Use `.cuda()` to move tensors to GPU.");
    const { violations } = await scanForGpuPatterns([contentDir]);
    expect(violations).toHaveLength(0);
  });

  it("does not scan non-Python fenced blocks", async () => {
    await writeFixture("01.mdx", "```bash\necho cuda\n```");
    const { violations } = await scanForGpuPatterns([contentDir]);
    expect(violations).toHaveLength(0);
  });

  // --- Parse errors ---

  it("reports parse warning for non-parseable Python without GPU tokens", async () => {
    await writeFixture("01.mdx", "```python\ndef foo(\n```");
    const { parseErrors, parseWarnings } = await scanForGpuPatterns([contentDir]);
    expect(parseErrors).toHaveLength(0);
    expect(parseWarnings.length).toBeGreaterThanOrEqual(1);
    expect(parseWarnings[0].message).toBeTruthy();
  });

  // --- Paired marker enforcement ---

  it("accepts matched gpu-example/cpu-alternative pair with map_batches", async () => {
    await writeFixture(
      "01.mdx",
      [
        "```python",
        "# gpu-example: test-model",
        "ds.map_batches(Model, num_gpus=1)",
        "```",
        "",
        "```python",
        "# cpu-alternative: test-model",
        "ds.map_batches(Model, batch_size=8)",
        "```",
      ].join("\n"),
    );
    const { violations } = await scanForGpuPatterns([contentDir]);
    expect(violations).toHaveLength(0);
  });

  it("flags num_gpus=1 with gpu-example but missing cpu-alternative", async () => {
    await writeFixture(
      "01.mdx",
      "```python\n# gpu-example: lonely\nds.map_batches(Model, num_gpus=1)\n```",
    );
    const { violations } = await scanForGpuPatterns([contentDir]);
    expect(violations.some((v: Violation) => v.pattern.includes("without cpu-alternative"))).toBe(true);
  });

  it("flags num_gpus=1 without any marker", async () => {
    await writeFixture(
      "01.mdx",
      "```python\nds.map_batches(Model, num_gpus=1)\n```",
    );
    const { violations } = await scanForGpuPatterns([contentDir]);
    expect(violations.some((v: Violation) => v.pattern.includes("without gpu-example"))).toBe(true);
  });

  it("flags ray_actor_options num_gpus without marker", async () => {
    await writeFixture(
      "01.mdx",
      '```python\n@serve.deployment(ray_actor_options={"num_gpus": 1})\nclass M:\n    pass\n```',
    );
    const { violations } = await scanForGpuPatterns([contentDir]);
    expect(violations.some((v: Violation) => v.pattern.includes("without gpu-example"))).toBe(true);
  });

  it("flags ScalingConfig(use_gpu=True) without marker", async () => {
    await writeFixture(
      "01.mdx",
      "```python\nScalingConfig(use_gpu=True)\n```",
    );
    const { violations } = await scanForGpuPatterns([contentDir]);
    expect(violations.some((v: Violation) => v.pattern.includes("without gpu-example"))).toBe(true);
  });

  it("accepts ray_actor_options with matched pair", async () => {
    await writeFixture(
      "01.mdx",
      [
        "```python",
        "# gpu-example: serve-gpu",
        '@serve.deployment(ray_actor_options={"num_gpus": 1})',
        "class M:",
        "    pass",
        "```",
        "",
        "```python",
        "# cpu-alternative: serve-gpu",
        "@serve.deployment()",
        "class M:",
        "    pass",
        "app = M.bind()",
        "```",
      ].join("\n"),
    );
    const { violations } = await scanForGpuPatterns([contentDir]);
    expect(violations).toHaveLength(0);
  });

  it("flags duplicate gpu-example IDs", async () => {
    await writeFixture(
      "01.mdx",
      [
        "```python",
        "# gpu-example: dup",
        "ds.map_batches(M, num_gpus=1)",
        "```",
        "",
        "```python",
        "# gpu-example: dup",
        "ds.map_batches(N, num_gpus=1)",
        "```",
      ].join("\n"),
    );
    const { violations } = await scanForGpuPatterns([contentDir]);
    expect(violations.some((v: Violation) => v.pattern.includes("duplicate"))).toBe(true);
  });

  // --- CPU-alternative content validation ---

  it("flags cpu-alternative block containing num_gpus", async () => {
    await writeFixture(
      "01.mdx",
      [
        "```python",
        "# gpu-example: bad-cpu",
        "ds.map_batches(Model, num_gpus=1)",
        "```",
        "",
        "```python",
        "# cpu-alternative: bad-cpu",
        "ds.map_batches(Model, num_gpus=1)",
        "```",
      ].join("\n"),
    );
    const { violations } = await scanForGpuPatterns([contentDir]);
    expect(violations.some((v: Violation) => v.pattern.includes("contains GPU reservation"))).toBe(true);
  });

  it("flags cpu-alternative with ScalingConfig(use_gpu=True)", async () => {
    await writeFixture(
      "01.mdx",
      [
        "```python",
        "# gpu-example: train-bad",
        "ScalingConfig(use_gpu=True)",
        "```",
        "",
        "```python",
        "# cpu-alternative: train-bad",
        "ScalingConfig(use_gpu=True)",
        "```",
      ].join("\n"),
    );
    const { violations } = await scanForGpuPatterns([contentDir]);
    expect(violations.some((v: Violation) => v.pattern.includes("contains GPU reservation"))).toBe(true);
  });

  it("accepts cpu-alternative with ScalingConfig(use_gpu=False)", async () => {
    await writeFixture(
      "01.mdx",
      [
        "```python",
        "# gpu-example: train-ok",
        "ScalingConfig(use_gpu=True)",
        "```",
        "",
        "```python",
        "# cpu-alternative: train-ok",
        "ScalingConfig(use_gpu=False)",
        "```",
      ].join("\n"),
    );
    const { violations } = await scanForGpuPatterns([contentDir]);
    expect(violations).toHaveLength(0);
  });

  it("flags cpu-alternative with only a comment (no scheduling call)", async () => {
    await writeFixture(
      "01.mdx",
      [
        "```python",
        "# gpu-example: empty-cpu",
        "ds.map_batches(Model, num_gpus=1)",
        "```",
        "",
        "```python",
        "# cpu-alternative: empty-cpu",
        "# Just a comment, no real code",
        "x = 1",
        "```",
      ].join("\n"),
    );
    const { violations } = await scanForGpuPatterns([contentDir]);
    expect(violations.some((v: Violation) => v.pattern.includes("missing scheduling API"))).toBe(true);
  });

  // --- Inline CPU-only comment for presentations ---

  it("accepts num_gpus with inline # omit for CPU-only comment", async () => {
    await writeFixture(
      "01.mdx",
      "```python\nds.map_batches(Model, num_gpus=1)  # omit for CPU-only\n```",
    );
    const { violations, allowlisted } = await scanForGpuPatterns([contentDir]);
    expect(violations).toHaveLength(0);
    expect(allowlisted).toHaveLength(1);
  });

  // --- Token-aware parse error fallback ---

  it("reports violations via token fallback for parse errors with .cuda()", async () => {
    await writeFixture(
      "01.mdx",
      "```python\ndef foo(\nmodel.cuda()\n```",
    );
    const { violations } = await scanForGpuPatterns([contentDir]);
    expect(violations.some((v: Violation) => v.pattern.includes(".cuda()"))).toBe(true);
  });

  it("reports only a warning for parse errors without GPU tokens", async () => {
    await writeFixture(
      "01.mdx",
      "```python\nif True\n    pass\n```",
    );
    const { violations, parseErrors, parseWarnings } = await scanForGpuPatterns([contentDir]);
    expect(violations).toHaveLength(0);
    expect(parseErrors).toHaveLength(0);
    expect(parseWarnings.length).toBeGreaterThanOrEqual(1);
  });

  it("makes parse-failed blocks with num_gpus fatal even with markers", async () => {
    await writeFixture(
      "01.mdx",
      [
        "```python",
        "# gpu-example: broken",
        "def foo(",
        "ds.map_batches(Model, num_gpus=1)",
        "```",
        "",
        "```python",
        "# cpu-alternative: broken",
        "ds.map_batches(Model, batch_size=8)",
        "```",
      ].join("\n"),
    );
    const { parseErrors } = await scanForGpuPatterns([contentDir]);
    expect(parseErrors.length).toBeGreaterThanOrEqual(1);
    expect(parseErrors[0].message).toContain("GPU reservation");
  });

  // --- Zero-GPU handling ---

  it("does not flag num_gpus=0 as a reservation", async () => {
    await writeFixture(
      "01.mdx",
      "```python\nds.map_batches(Model, num_gpus=0)\n```",
    );
    const { violations } = await scanForGpuPatterns([contentDir]);
    expect(violations).toHaveLength(0);
  });

  it("does not flag ray_actor_options with num_gpus=0", async () => {
    await writeFixture(
      "01.mdx",
      '```python\n@serve.deployment(ray_actor_options={"num_gpus": 0})\nclass M:\n    pass\n```',
    );
    const { violations } = await scanForGpuPatterns([contentDir]);
    expect(violations).toHaveLength(0);
  });

  it("does not flag num_gpus=0.0 as a reservation", async () => {
    await writeFixture(
      "01.mdx",
      "```python\nds.map_batches(Model, num_gpus=0.0)\n```",
    );
    const { violations } = await scanForGpuPatterns([contentDir]);
    expect(violations).toHaveLength(0);
  });

  // --- GPU resource-reference ---

  it("accepts gpu-resource-reference: omit num_gpus with num_gpus reservation", async () => {
    await writeFixture(
      "01.mdx",
      [
        "```python",
        "# gpu-resource-reference: omit num_gpus for CPU-only use",
        "ds.map_batches(Model, num_gpus=1)",
        "```",
      ].join("\n"),
    );
    const { violations, allowlisted } = await scanForGpuPatterns([contentDir]);
    expect(violations).toHaveLength(0);
    expect(allowlisted).toHaveLength(1);
    expect(allowlisted[0].reason).toContain("gpu-resource-reference");
  });

  it("accepts gpu-resource-reference: set use_gpu=False with ScalingConfig(use_gpu=True)", async () => {
    await writeFixture(
      "01.mdx",
      [
        "```python",
        "# gpu-resource-reference: set use_gpu=False for CPU-only use",
        "ScalingConfig(use_gpu=True)",
        "```",
      ].join("\n"),
    );
    const { violations, allowlisted } = await scanForGpuPatterns([contentDir]);
    expect(violations).toHaveLength(0);
    expect(allowlisted).toHaveLength(1);
  });

  it("flags gpu-resource-reference API mismatch (num_gpus annotation with ScalingConfig)", async () => {
    await writeFixture(
      "01.mdx",
      [
        "```python",
        "# gpu-resource-reference: omit num_gpus for CPU-only use",
        "ScalingConfig(use_gpu=True)",
        "```",
      ].join("\n"),
    );
    const { violations } = await scanForGpuPatterns([contentDir]);
    expect(violations.some((v: Violation) => v.pattern.includes("mismatch"))).toBe(true);
  });

  it("flags gpu-resource-reference with device violations in same block", async () => {
    await writeFixture(
      "01.mdx",
      [
        "```python",
        "# gpu-resource-reference: omit num_gpus for CPU-only use",
        "model.cuda()",
        "ds.map_batches(Model, num_gpus=1)",
        "```",
      ].join("\n"),
    );
    const { violations } = await scanForGpuPatterns([contentDir]);
    expect(violations.some((v: Violation) => v.pattern.includes("device violations"))).toBe(true);
  });

  // --- One-to-one annotation matching ---

  it("flags unmatched gpu-resource-reference with no reservation", async () => {
    await writeFixture(
      "01.mdx",
      [
        "```python",
        "# gpu-resource-reference: omit num_gpus for CPU-only use",
        "x = 1",
        "```",
      ].join("\n"),
    );
    const { violations } = await scanForGpuPatterns([contentDir]);
    expect(violations.some((v: Violation) => v.pattern.includes("unmatched"))).toBe(true);
  });

  it("flags when single annotation covers two num_gpus reservations", async () => {
    await writeFixture(
      "01.mdx",
      [
        "```python",
        "# gpu-resource-reference: omit num_gpus for CPU-only use",
        "ds.map_batches(A, num_gpus=1)",
        "ds.map_batches(B, num_gpus=1)",
        "```",
      ].join("\n"),
    );
    const { violations } = await scanForGpuPatterns([contentDir]);
    expect(violations.some((v: Violation) => v.pattern.includes("without gpu-example"))).toBe(true);
  });

  // --- Presentation # omit for CPU-only edge cases ---

  it("rejects # omit for CPU-only in block with device violations", async () => {
    await writeFixture(
      "01.mdx",
      [
        "```python",
        "model.cuda()",
        "ds.map_batches(Model, num_gpus=1)  # omit for CPU-only",
        "```",
      ].join("\n"),
    );
    const { violations } = await scanForGpuPatterns([contentDir]);
    expect(violations.some((v: Violation) => v.pattern.includes("device violations"))).toBe(true);
  });

  it("does not flag num_gpus=0 with # omit for CPU-only (zero is not a reservation)", async () => {
    await writeFixture(
      "01.mdx",
      "```python\nds.map_batches(Model, num_gpus=0)  # omit for CPU-only\n```",
    );
    const { violations, allowlisted } = await scanForGpuPatterns([contentDir]);
    expect(violations).toHaveLength(0);
    expect(allowlisted).toHaveLength(0);
  });

  // --- Qualified constructors ---

  it("flags ray.train.ScalingConfig(use_gpu=True) as a reservation", async () => {
    await writeFixture(
      "01.mdx",
      "```python\nray.train.ScalingConfig(use_gpu=True)\n```",
    );
    const { violations } = await scanForGpuPatterns([contentDir]);
    expect(violations.some((v: Violation) => v.pattern.includes("without gpu-example"))).toBe(true);
  });

  it("accepts # omit for CPU-only on preceding line", async () => {
    await writeFixture(
      "01.mdx",
      "```python\n# omit for CPU-only\nds.map_batches(Model, num_gpus=1)\n```",
    );
    const { violations, allowlisted } = await scanForGpuPatterns([contentDir]);
    expect(violations).toHaveLength(0);
    expect(allowlisted).toHaveLength(1);
  });
});
