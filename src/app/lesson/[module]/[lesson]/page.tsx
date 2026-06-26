import { notFound } from "next/navigation";
import { getCurriculum, getLessonContent, getModuleMeta } from "@/lib/curriculum";
import LessonContent from "@/components/LessonContent";
import { parseMDX } from "@/lib/mdx";
import { MDXRemote } from "@/components/MDXRemote";
import type { QuizQuestion } from "@/types";

interface LessonPageProps {
  params: Promise<{ module: string; lesson: string }>;
}

type RawQuizQuestion = Omit<QuizQuestion, "explanation"> & { explanation?: string };

function isQuizQuestion(value: unknown): value is RawQuizQuestion {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.question === "string" &&
    Array.isArray(item.options) &&
    item.options.every((option) => typeof option === "string") &&
    typeof item.correctIndex === "number" &&
    (typeof item.explanation === "string" || item.explanation === undefined)
  );
}

export default async function LessonPage({ params }: LessonPageProps) {
  const { module: moduleStr, lesson: lessonSlug } = await params;
  const moduleId = parseInt(moduleStr, 10);

  const moduleMeta = await getModuleMeta(moduleId);
  if (!moduleMeta) notFound();

  const lessonIndex = moduleMeta.lessons.findIndex((l) => l.slug === lessonSlug);
  if (lessonIndex === -1) notFound();

  const lesson = moduleMeta.lessons[lessonIndex];
  const raw = await getLessonContent(moduleId, lessonSlug);
  if (!raw) notFound();

  const { frontmatter, content } = parseMDX(raw);
  const quiz: QuizQuestion[] = Array.isArray(frontmatter.quiz)
    ? frontmatter.quiz.filter(isQuizQuestion).map((item) => ({
        ...item,
        explanation: item.explanation ?? "Review the lesson section above and try the concept again.",
      }))
    : [];

  const curriculum = await getCurriculum();

  let prevHref: string | undefined;
  let nextHref: string | undefined;

  if (lessonIndex > 0) {
    prevHref = `/lesson/${moduleId}/${moduleMeta.lessons[lessonIndex - 1].slug}`;
  } else {
    const prevModule = curriculum.modules.find((m) => m.id === moduleId - 1);
    if (prevModule) {
      prevHref = `/lesson/${prevModule.id}/${prevModule.lessons[prevModule.lessons.length - 1].slug}`;
    }
  }

  if (lessonIndex < moduleMeta.lessons.length - 1) {
    nextHref = `/lesson/${moduleId}/${moduleMeta.lessons[lessonIndex + 1].slug}`;
  } else {
    const nextModule = curriculum.modules.find((m) => m.id === moduleId + 1);
    if (nextModule) {
      nextHref = `/lesson/${nextModule.id}/${nextModule.lessons[0].slug}`;
    }
  }

  return (
    <LessonContent
      module={moduleMeta}
      lesson={lesson}
      quiz={quiz}
      prevHref={prevHref}
      nextHref={nextHref}
    >
      <MDXRemote source={content} />
    </LessonContent>
  );
}
