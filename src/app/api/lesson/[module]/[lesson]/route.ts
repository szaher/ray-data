import { NextRequest, NextResponse } from "next/server";
import { getLessonContent, getModuleMeta } from "@/lib/curriculum";
import { parseMDX } from "@/lib/mdx";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ module: string; lesson: string }> }
) {
  const { module: moduleStr, lesson: lessonSlug } = await params;
  const moduleId = parseInt(moduleStr, 10);

  if (isNaN(moduleId)) {
    return NextResponse.json({ error: "Invalid module ID" }, { status: 400 });
  }

  const moduleMeta = await getModuleMeta(moduleId);
  if (!moduleMeta) {
    return NextResponse.json({ error: "Module not found" }, { status: 404 });
  }

  const lessonMeta = moduleMeta.lessons.find((l) => l.slug === lessonSlug);
  if (!lessonMeta) {
    return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
  }

  const raw = await getLessonContent(moduleId, lessonSlug);
  if (!raw) {
    return NextResponse.json({ error: "Lesson content not found" }, { status: 404 });
  }

  const { frontmatter, content } = parseMDX(raw);

  return NextResponse.json({
    module: moduleMeta,
    lesson: lessonMeta,
    frontmatter,
    content,
  });
}
