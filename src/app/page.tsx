import Link from "next/link";
import { getCurriculum } from "@/lib/curriculum";
import { academy } from "../../academy.config";

export default async function HomePage() {
  const curriculum = await getCurriculum();

  return (
    <div className="max-w-4xl mx-auto px-8 py-12">
      <h1 className="text-3xl font-bold mb-2">Welcome to {academy.name}</h1>
      <p className="text-[var(--text-secondary)] mb-8">
        {academy.tagline}. {curriculum.modules.length} modules,{" "}
        {curriculum.modules.reduce((s, m) => s + m.lessons.length, 0)} lessons.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {curriculum.modules.map((mod) => (
          <Link
            key={mod.id}
            href={`/lesson/${mod.id}/${mod.lessons[0].slug}`}
            className="block p-5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] hover:border-[var(--border-hover)] transition-colors"
          >
            <div className="flex items-center gap-2 mb-2">
              <span
                className="text-xs font-semibold uppercase tracking-wider"
                style={{ color: mod.color }}
              >
                Module {mod.id}
              </span>
            </div>
            <h2 className="text-lg font-semibold mb-1">{mod.title}</h2>
            <p className="text-sm text-[var(--text-secondary)]">{mod.description}</p>
            <p className="text-xs text-[var(--text-secondary)] mt-2">
              {mod.lessons.length} lessons
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
