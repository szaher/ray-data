import { describe, expect, it } from "vitest";
import { getCurriculum, getModuleMeta, getLessonPath } from "@/lib/curriculum";

describe("getCurriculum", () => {
  it("returns all 7 modules", async () => {
    const curriculum = await getCurriculum();
    expect(curriculum.modules).toHaveLength(7);
  });

  it("module 1 has 4 lessons", async () => {
    const curriculum = await getCurriculum();
    expect(curriculum.modules[0].lessons).toHaveLength(4);
  });

  it("module IDs are sequential starting at 1", async () => {
    const curriculum = await getCurriculum();
    const ids = curriculum.modules.map((m) => m.id);
    expect(ids).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });
});

describe("getModuleMeta", () => {
  it("returns module by ID", async () => {
    const mod = await getModuleMeta(1);
    expect(mod?.title).toBe("Foundations");
  });

  it("returns undefined for invalid ID", async () => {
    const mod = await getModuleMeta(99);
    expect(mod).toBeUndefined();
  });
});

describe("getLessonPath", () => {
  it("returns correct MDX path", () => {
    const p = getLessonPath(1, "01-why-distributed");
    expect(p).toContain("content/module-1/01-why-distributed.mdx");
  });
});
