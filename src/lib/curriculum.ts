import fs from "fs/promises";
import path from "path";
import type { CurriculumData, ModuleMeta } from "@/types";

const CONTENT_DIR = path.join(process.cwd(), "content");

export async function getCurriculum(): Promise<CurriculumData> {
  const entries = await fs.readdir(CONTENT_DIR);
  const moduleDirs = entries
    .filter((e) => e.startsWith("module-"))
    .sort((a, b) => {
      const numA = parseInt(a.split("-")[1]);
      const numB = parseInt(b.split("-")[1]);
      return numA - numB;
    });

  const modules: ModuleMeta[] = [];
  for (const dir of moduleDirs) {
    const metaPath = path.join(CONTENT_DIR, dir, "meta.json");
    const raw = await fs.readFile(metaPath, "utf-8");
    modules.push(JSON.parse(raw) as ModuleMeta);
  }

  return { modules };
}

export async function getModuleMeta(moduleId: number): Promise<ModuleMeta | undefined> {
  const curriculum = await getCurriculum();
  return curriculum.modules.find((m) => m.id === moduleId);
}

export function getLessonPath(moduleId: number, lessonSlug: string): string {
  return path.join(CONTENT_DIR, `module-${moduleId}`, `${lessonSlug}.mdx`);
}

export async function getLessonContent(moduleId: number, lessonSlug: string): Promise<string | null> {
  const filePath = getLessonPath(moduleId, lessonSlug);
  try {
    return await fs.readFile(filePath, "utf-8");
  } catch {
    return null;
  }
}
