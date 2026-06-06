"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { CurriculumData } from "@/types";
import { getLessonProgress, getModuleProgress } from "@/lib/progress";
import ProgressBar from "./ProgressBar";

interface SidebarProps {
  curriculum: CurriculumData;
}

export default function Sidebar({ curriculum }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState<Record<number, boolean>>({});

  const toggleModule = (id: number) => {
    setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const totalLessons = curriculum.modules.reduce((sum, m) => sum + m.lessons.length, 0);
  const completedLessons = curriculum.modules.reduce((sum, m) => {
    return sum + m.lessons.filter((l) => getLessonProgress(m.id, l.slug)?.completed).length;
  }, 0);
  const overallProgress = totalLessons > 0 ? completedLessons / totalLessons : 0;

  return (
    <aside className="w-64 min-h-0 flex flex-col border-r border-[var(--border)] bg-[var(--bg-secondary)]">
      <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {curriculum.modules.map((mod) => {
          const isCollapsed = collapsed[mod.id] ?? false;
          const modProgress = getModuleProgress(mod.id, mod.lessons.length);

          return (
            <div key={mod.id}>
              <button
                onClick={() => toggleModule(mod.id)}
                className="w-full flex items-center gap-2 px-2 py-1.5 text-sm font-medium rounded-md hover:bg-white/[0.04] transition-colors"
                style={{ color: mod.color }}
              >
                <svg
                  className={`w-3 h-3 transition-transform ${isCollapsed ? "" : "rotate-90"}`}
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M6 6l6 4-6 4V6z" />
                </svg>
                <span className="uppercase text-xs tracking-wider">Module {mod.id}</span>
                <span className="text-xs normal-case tracking-normal">{mod.title}</span>
                {modProgress > 0 && modProgress < 1 && (
                  <span className="ml-auto text-xs text-[var(--text-secondary)]">
                    {Math.round(modProgress * 100)}%
                  </span>
                )}
                {modProgress === 1 && (
                  <span className="ml-auto text-xs" style={{ color: mod.color }}>
                    ✓
                  </span>
                )}
              </button>

              {!isCollapsed && (
                <ul className="ml-4 mt-0.5 space-y-0.5">
                  {mod.lessons.map((lesson) => {
                    const href = `/lesson/${mod.id}/${lesson.slug}`;
                    const isCurrent = pathname === href;
                    const lp = getLessonProgress(mod.id, lesson.slug);

                    return (
                      <li key={lesson.slug}>
                        <Link
                          href={href}
                          className={`flex items-center gap-2 px-2 py-1 text-sm rounded-md transition-colors ${
                            isCurrent
                              ? "bg-white/[0.08] text-[var(--text-primary)]"
                              : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/[0.04]"
                          }`}
                        >
                          <span className="w-4 text-center">
                            {lp?.completed ? (
                              <span style={{ color: mod.color }}>✓</span>
                            ) : isCurrent ? (
                              <span style={{ color: mod.color }}>▶</span>
                            ) : (
                              <span className="text-[var(--text-secondary)]">○</span>
                            )}
                          </span>
                          <span className="truncate">{lesson.title}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      <div className="p-4 border-t border-[var(--border)]">
        <div className="text-xs text-[var(--text-secondary)] mb-1.5">
          Progress: {Math.round(overallProgress * 100)}%
        </div>
        <ProgressBar value={overallProgress} color="var(--accent-green)" />
      </div>
    </aside>
  );
}
