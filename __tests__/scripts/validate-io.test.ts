// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";

import {
  checkLocalLinks,
  checkExternalLinks,
} from "../../scripts/validate-io.mjs";

describe("checkLocalLinks", () => {
  let tmpDir: string;
  let sourceFile: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "validate-io-"));
    await fs.mkdir(path.join(tmpDir, "content", "module-1"), {
      recursive: true,
    });
    sourceFile = path.join(tmpDir, "content", "module-1", "01-lesson.mdx");
    await fs.writeFile(sourceFile, "test");
    await fs.writeFile(
      path.join(tmpDir, "content", "module-1", "02-other.mdx"),
      "test",
    );
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("passes for existing local files", async () => {
    const errors = await checkLocalLinks(["02-other.mdx"], sourceFile, tmpDir);
    expect(errors).toEqual([]);
  });

  it("errors for missing local files", async () => {
    const errors = await checkLocalLinks(
      ["nonexistent.mdx"],
      sourceFile,
      tmpDir,
    );
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("nonexistent.mdx");
  });

  it("resolves relative paths from source file directory", async () => {
    await fs.mkdir(path.join(tmpDir, "content", "module-2"), {
      recursive: true,
    });
    await fs.writeFile(
      path.join(tmpDir, "content", "module-2", "01-target.mdx"),
      "t",
    );
    const errors = await checkLocalLinks(
      ["../module-2/01-target.mdx"],
      sourceFile,
      tmpDir,
    );
    expect(errors).toEqual([]);
  });

  it("strips query strings before checking", async () => {
    const errors = await checkLocalLinks(
      ["02-other.mdx?v=1"],
      sourceFile,
      tmpDir,
    );
    expect(errors).toEqual([]);
  });

  it("strips fragments before checking", async () => {
    const errors = await checkLocalLinks(
      ["02-other.mdx#section"],
      sourceFile,
      tmpDir,
    );
    expect(errors).toEqual([]);
  });
});

describe("checkExternalLinks", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("passes on 200 OK", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
    });
    const result = await checkExternalLinks(["https://example.com"]);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it("warns on 404", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    });
    const result = await checkExternalLinks(["https://example.com/missing"]);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain("404");
  });

  it("falls back to GET on HEAD 405", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 405, headers: new Headers() })
      .mockResolvedValueOnce({
        ok: true,
        status: 206,
        body: { cancel: vi.fn() },
      });
    globalThis.fetch = fetchMock;
    const result = await checkExternalLinks(["https://example.com"]);
    expect(result.warnings).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][1].method).toBe("GET");
    expect(fetchMock.mock.calls[1][1].headers.Range).toBe("bytes=0-0");
  });

  it("falls back to GET on HEAD 501", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 501, headers: new Headers() })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        body: { cancel: vi.fn() },
      });
    globalThis.fetch = fetchMock;
    const result = await checkExternalLinks(["https://example.com"]);
    expect(result.warnings).toEqual([]);
  });

  it("warns on timeout", async () => {
    globalThis.fetch = vi.fn().mockImplementation(
      () =>
        new Promise((_, reject) => {
          const err = new Error("Aborted");
          err.name = "AbortError";
          setTimeout(() => reject(err), 10);
        }),
    );
    const result = await checkExternalLinks(["https://slow.example.com"]);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain("Timeout");
  });

  it("rejects private IP via classifyExternalUrl", async () => {
    globalThis.fetch = vi.fn();
    const result = await checkExternalLinks(["http://192.168.1.1/api"]);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("private");
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("rejects URLs with credentials", async () => {
    globalThis.fetch = vi.fn();
    const result = await checkExternalLinks([
      "http://user:pass@example.com",
    ]);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("credentials");
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("deduplicates URLs by URL-without-fragment", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    globalThis.fetch = fetchMock;
    const result = await checkExternalLinks([
      "https://example.com/page#a",
      "https://example.com/page#b",
    ]);
    expect(result.warnings).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("follows redirects up to 3 hops", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 301,
        headers: new Headers({
          location: "https://example.com/step2",
        }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 302,
        headers: new Headers({
          location: "https://example.com/step3",
        }),
      })
      .mockResolvedValueOnce({ ok: true, status: 200 });
    globalThis.fetch = fetchMock;
    const result = await checkExternalLinks(["https://example.com/step1"]);
    expect(result.warnings).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("rejects redirect to private IP", async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 301,
      headers: new Headers({
        location: "http://192.168.1.1/internal",
      }),
    });
    const result = await checkExternalLinks([
      "https://redirector.example.com",
    ]);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("private");
  });
});
